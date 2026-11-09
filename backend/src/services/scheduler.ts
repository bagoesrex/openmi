import { Database } from "bun:sqlite";
import { createAccountRepo, createLogRepo, AccountRepository, LogRepository } from "../db/repository";
import { Account } from "../domain/account";
import { applyBlAuth, checkUserState, checkSwitchValue } from "./xiaomi/client";
import { handleApplyResult, XiaomiStateAction } from "./xiaomi/state-machine";
import { logBroadcaster } from "./broadcaster";
import { getCalibratedNow, syncNtpOffset } from "./ntp";
import { generateDeviceId, resolveTimings } from "./xiaomi/burst";

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
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.getTime();
}

export function calculateSleepDuration(nowMs: number, targetMs: number): number {
  return Math.max(0, targetMs - nowMs);
}

export interface BurstSlot {
  offsetSec: number;
  targetMs: number;
  delayMs: number;
}

export function calculateBurstSchedule(
  baseMinuteMs: number,
  timings: number[],
  nowMs: number
): BurstSlot[] {
  return timings.map((offsetSec) => {
    const targetMs = baseMinuteMs + Math.round(offsetSec * 1000);
    const delayMs = Math.max(0, targetMs - nowMs);
    return { offsetSec, targetMs, delayMs };
  });
}

export async function executeAccountBurst(
  account: Account,
  targetMidnightMs: number,
  accountRepo: AccountRepository,
  logRepo: LogRepository
): Promise<void> {
  const accountId = account.id;
  const timings = resolveTimings(account.timingMode, account.customTimings);
  const baseMinuteMs = targetMidnightMs - 60_000;
  const now = getCalibratedNow();
  const schedule = calculateBurstSchedule(baseMinuteMs, timings, now);

  console.log(`[Scheduler] Armed burst wave (${timings.length} shots) for "${account.label}" (${account.cUserId}). Profile: ${account.timingMode}`);

  const abortController = new AbortController();
  let isWon = false;

  const shotPromises = schedule.map((slot, index) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        if (abortController.signal.aborted || isWon) {
          resolve();
          return;
        }

        const shotDeviceId = generateDeviceId();
        const shotNumber = index + 1;
        const totalShots = schedule.length;
        const tag = `[Burst #${shotNumber}/${totalShots} @ ${slot.offsetSec.toFixed(3)}s]`;
        console.log(`[Scheduler] ⚡ ${tag} Firing for account "${account.label}" devId=${shotDeviceId.slice(0, 8)}...`);

        try {
          // Pre-baked is_retry: true for all zero-hour burst attempts
          const res = await applyBlAuth(account, true, {
            signal: abortController.signal,
            deviceId: shotDeviceId,
            timeoutMs: 5000,
          });

          const evaluation = handleApplyResult(res);

          const isSuccess =
            evaluation.action === XiaomiStateAction.SUCCESS ||
            res.code === 0 ||
            res.code === 100003;

          accountRepo.update(accountId, {
            lastApplyResult: evaluation.applyResult,
          });

          const logEntry = {
            accountId,
            timestamp: Date.now(),
            action: isSuccess ? "APPLY_SUCCESS" : "APPLY_BURST",
            resultCode: evaluation.applyResult ?? res.code ?? 0,
            message: `${tag} ${evaluation.message}`,
            rawPayload: JSON.stringify(res),
            errorDetails: isSuccess ? null : evaluation.diagnosticHint,
          };

          logRepo.insert(logEntry);
          logBroadcaster.broadcast({ ...logEntry, id: Date.now() });

          if (isSuccess) {
            console.log(`🎉 [Scheduler] ${tag} Account "${account.label}" UNLOCKED SUCCESSFULLY! Cancelling remaining wave.`);
            isWon = true;
            abortController.abort();
          }
        } catch (err: any) {
          if (abortController.signal.aborted) {
            resolve();
            return;
          }
          const errorMsg = err?.message || String(err);
          const errLog = {
            accountId,
            timestamp: Date.now(),
            action: "BURST_ERROR",
            resultCode: 500,
            message: `${tag} Request error: ${errorMsg}`,
            errorDetails: String(err.stack || errorMsg),
          };
          logRepo.insert(errLog);
          logBroadcaster.broadcast({ ...errLog, id: Date.now() });
        } finally {
          resolve();
        }
      }, slot.delayMs);

      // Cancel timer on abort
      abortController.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });

  await Promise.all(shotPromises);
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

  async function scheduleLoop() {
    if (!isRunning) return;

    const now = getCalibratedNow();
    const target = getNextTargetTimestamp(now);
    const msUntilTarget = calculateSleepDuration(now, target);

    const targetDateStr = new Date(target).toISOString();
    console.log(`[Scheduler] Next quota reset target: ${targetDateStr} (in ${(msUntilTarget / 1000 / 60).toFixed(1)} minutes)`);

    // Sleep until T-15s before target
    const prewarmSleepMs = Math.max(0, msUntilTarget - 15000);

    timerId = setTimeout(async () => {
      if (!isRunning) return;

      const enabledAccounts = accountRepo.getEnabled();
      if (enabledAccounts.length === 0) {
        console.log("[Scheduler] No accounts enabled for auto-apply tonight.");
        scheduleLoop();
        return;
      }

      console.log(`[Scheduler] T-15s reached! Preparing ${enabledAccounts.length} accounts...`);

      // T-10s: Pre-warm TLS connection to sgp-api.buy.mi.com
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

      // T-5s: Arm Spread-Burst waves across all enabled valid accounts
      const activeAccounts = accountRepo.getEnabled().filter((a) => a.sessionValid === 1);
      console.log(`⚡ [Scheduler] ZERO-HOUR APPROACHING! Arming high-speed burst waves for ${activeAccounts.length} accounts...`);

      Promise.allSettled(
        activeAccounts.map((acc) => executeAccountBurst(acc, target, accountRepo, logRepo))
      ).then(() => {
        console.log("[Scheduler] All burst waves completed for tonight.");
        // Reschedule for next day
        scheduleLoop();
      });

    }, prewarmSleepMs);
  }

  // Start the scheduling loop
  scheduleLoop();

  return {
    stop() {
      isRunning = false;
      if (timerId) clearTimeout(timerId);
      clearInterval(ntpInterval);
      console.log("[Scheduler] Scheduler stopped.");
    },
    async triggerManual(accountId: string) {
      const acc = accountRepo.getById(accountId);
      if (!acc) throw new Error("Account not found");
      const target = getNextTargetTimestamp();
      return await executeAccountBurst(acc, target, accountRepo, logRepo);
    },
  };
}
