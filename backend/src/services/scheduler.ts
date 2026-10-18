import { Database } from "bun:sqlite";
import { createAccountRepo, createLogRepo } from "../db/repository";
import { Account } from "../domain/account";
import { applyBlAuth, checkUserState, checkSwitchValue } from "./xiaomi/client";
import { handleApplyResult, XiaomiStateAction } from "./xiaomi/state-machine";
import { logBroadcaster } from "./broadcaster";
import { getCalibratedNow, syncNtpOffset } from "./ntp";

export function getNextTargetTimestamp(nowMs: number = Date.now()): number {
  const date = new Date(nowMs);
  const target = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    16, // 16:00 UTC = 23:00 WIB = 00:00 GMT+8
    0,
    0,
    0
  ));

  if (target.getTime() <= nowMs) {
    // If 16:00 UTC has passed today, target 16:00 UTC tomorrow
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.getTime();
}

export function calculateSleepDuration(nowMs: number, targetMs: number): number {
  return Math.max(0, targetMs - nowMs);
}

export interface SchedulerController {
  stop(): void;
  triggerManual(accountId: string): Promise<any>;
}

export function startScheduler(db: Database): SchedulerController {
  let isRunning = true;
  let timerId: any = null;

  const accountRepo = createAccountRepo(db);
  const logRepo = createLogRepo(db);

  // Sync NTP offset immediately on startup and then every hour
  syncNtpOffset();
  const ntpInterval = setInterval(syncNtpOffset, 3600000);

  async function executeAccountApply(account: Account) {
    const accountId = account.id;
    console.log(`[Scheduler] Firing primary apply for account "${account.label}" (${account.cUserId})...`);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);

    try {
      const res = await applyBlAuth(account, false, { signal: abortController.signal });
      clearTimeout(timeoutId);

      const evaluation = handleApplyResult(res);

      accountRepo.update(accountId, {
        lastApplyResult: evaluation.applyResult,
      });

      const logEntry = {
        accountId,
        timestamp: Date.now(),
        action: "APPLY",
        resultCode: evaluation.applyResult ?? res.code ?? 0,
        message: evaluation.message,
        rawPayload: JSON.stringify(res),
        errorDetails: evaluation.action === XiaomiStateAction.SUCCESS ? null : evaluation.diagnosticHint,
      };

      logRepo.insert(logEntry);
      logBroadcaster.broadcast({ ...logEntry, id: Date.now() });

      // Handle immediate retry if transient failure (code 5 or 7)
      if (evaluation.action === XiaomiStateAction.RETRY_IMMEDIATE) {
        console.log(`[Scheduler] Account "${account.label}" transient error. Retrying immediately with is_retry=true...`);
        const retryRes = await applyBlAuth(account, true);
        const retryEval = handleApplyResult(retryRes);

        accountRepo.update(accountId, {
          lastApplyResult: retryEval.applyResult,
        });

        const retryLog = {
          accountId,
          timestamp: Date.now(),
          action: "RETRY",
          resultCode: retryEval.applyResult ?? retryRes.code ?? 0,
          message: `Retry: ${retryEval.message}`,
          rawPayload: JSON.stringify(retryRes),
          errorDetails: retryEval.action === XiaomiStateAction.SUCCESS ? null : retryEval.diagnosticHint,
        };

        logRepo.insert(retryLog);
        logBroadcaster.broadcast({ ...retryLog, id: Date.now() });
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const errorMsg = err?.message || String(err);
      console.error(`[Scheduler] Error applying for account ${account.label}:`, errorMsg);

      const errLog = {
        accountId,
        timestamp: Date.now(),
        action: "APPLY_ERROR",
        resultCode: 500,
        message: `Execution failed: ${errorMsg}`,
        errorDetails: `Exception during apply: ${err.stack || errorMsg}`,
      };

      logRepo.insert(errLog);
      logBroadcaster.broadcast({ ...errLog, id: Date.now() });
    }
  }

  async function scheduleLoop() {
    if (!isRunning) return;

    const now = getCalibratedNow();
    const target = getNextTargetTimestamp(now);
    const msUntilTarget = calculateSleepDuration(now, target);

    const targetDateStr = new Date(target).toISOString();
    console.log(`[Scheduler] Next quota reset target: ${targetDateStr} (in ${(msUntilTarget / 1000 / 60).toFixed(1)} minutes)`);

    // Sleep until T-15s before target (or run sooner if already close)
    const prewarmSleepMs = Math.max(0, msUntilTarget - 15000);

    timerId = setTimeout(async () => {
      if (!isRunning) return;

      const enabledAccounts = accountRepo.getEnabled();
      if (enabledAccounts.length === 0) {
        console.log("[Scheduler] No accounts enabled for auto-apply tonight.");
        // Schedule next check
        scheduleLoop();
        return;
      }

      console.log(`[Scheduler] T-15s reached! Preparing ${enabledAccounts.length} accounts...`);

      // T-10s: Pre-warm TLS connection to new.c.mi.com
      try {
        console.log("[Scheduler] Pre-warming TLS connections to Xiaomi Community...");
        await Promise.allSettled(
          enabledAccounts.map((acc) => checkSwitchValue(acc.region, { timeoutMs: 3000, proxy: acc.proxyUrl }))
        );
      } catch (err) {
        console.warn("[Scheduler] TLS pre-warm warning:", err);
      }

      // T-5s: Quick session check
      for (const acc of enabledAccounts) {
        try {
          const stateRes = await checkUserState(acc, { timeoutMs: 3000 });
          if (stateRes.code !== 0) {
            console.warn(`[Scheduler] Account "${acc.label}" cookie invalid before zero-hour!`);
            accountRepo.update(acc.id, { sessionValid: 0 });
          }
        } catch {}
      }

      // T-0s: Wait for the exact calibrated zero millisecond
      const zeroNow = getCalibratedNow();
      const finalWaitMs = Math.max(0, target - zeroNow);

      setTimeout(() => {
        if (!isRunning) return;
        console.log("⚡ [Scheduler] ZERO-HOUR 23:00 WIB (00:00 GMT+8)! Dispatching concurrent apply requests...");

        // Dispatch all active accounts simultaneously
        const activeAccounts = accountRepo.getEnabled().filter((a) => a.sessionValid === 1);
        Promise.allSettled(activeAccounts.map((acc) => executeAccountApply(acc))).then(() => {
          console.log("[Scheduler] All accounts processed for tonight.");
          // Reschedule for next day
          scheduleLoop();
        });
      }, finalWaitMs);

    }, prewarmSleepMs);
  }

  // Start the scheduling loop
  scheduleLoop();

  return {
    stop() {
      isRunning = false;
      if (timerId) clearTimeout(timerId);
      clearInterval(ntpInterval);
      console.log("[Scheduler] Background scheduler stopped.");
    },
    async triggerManual(accountId: string) {
      const acc = accountRepo.getById(accountId);
      if (!acc) throw new Error("Account not found");
      await executeAccountApply(acc);
    },
  };
}
