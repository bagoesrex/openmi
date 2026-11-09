import { describe, expect, it } from "bun:test";
import { getNextTargetTimestamp, calculateSleepDuration } from "../src/services/scheduler";

describe("High-Precision Scheduler Timing", () => {
  it("should calculate target timestamp for 23:00 WIB (16:00 UTC / 00:00 GMT+8)", () => {
    // Reference time: 2026-10-18 10:00:00 UTC (17:00 WIB)
    const now = new Date("2026-10-18T10:00:00Z").getTime();
    const target = getNextTargetTimestamp(now);
    const targetDate = new Date(target);

    // Target must be 16:00:00 UTC on 2026-10-18
    expect(targetDate.getUTCFullYear()).toBe(2026);
    expect(targetDate.getUTCMonth()).toBe(9); // 0-indexed: 9 = October
    expect(targetDate.getUTCDate()).toBe(18);
    expect(targetDate.getUTCHours()).toBe(16);
    expect(targetDate.getUTCMinutes()).toBe(0);
    expect(targetDate.getUTCSeconds()).toBe(0);
    expect(target > now).toBe(true);
  });

  it("should roll over to next day if current time is after 16:00 UTC (23:00 WIB)", () => {
    // Reference time: 2026-10-18 16:05:00 UTC (23:05 WIB)
    const now = new Date("2026-10-18T16:05:00Z").getTime();
    const target = getNextTargetTimestamp(now);
    const targetDate = new Date(target);

    // Target must be 16:00:00 UTC on 2026-10-19
    expect(targetDate.getUTCDate()).toBe(19);
    expect(targetDate.getUTCHours()).toBe(16);
    expect(targetDate.getUTCMinutes()).toBe(0);
  });

  it("should calculate correct sleep duration in milliseconds", () => {
    const now = 1000000;
    const target = 1050000;
    expect(calculateSleepDuration(now, target)).toBe(50000);

    // If target is in the past, duration should be 0
    expect(calculateSleepDuration(target, now)).toBe(0);
  });

  it("should calculate accurate burst schedule delays for Asia profile offsets", () => {
    const { calculateBurstSchedule } = require("../src/services/scheduler");
    const baseMinute = new Date("2026-10-18T15:59:00.000Z").getTime(); // 22:59:00 WIB
    const now = new Date("2026-10-18T15:59:55.000Z").getTime(); // 22:59:55.000 WIB (T-5s)
    const timings = [58.8, 59.1, 59.3, 59.5, 59.7, 59.9];

    const schedule = calculateBurstSchedule(baseMinute, timings, now);
    expect(schedule).toHaveLength(6);
    expect(schedule[0].offsetSec).toBe(58.8);
    expect(schedule[0].delayMs).toBe(3800); // 58.800 - 55.000 = 3.8s = 3800ms
    expect(schedule[1].delayMs).toBe(4100); // 59.100 - 55.000 = 4100ms
    expect(schedule[4].delayMs).toBe(4700); // 59.700 - 55.000 = 4700ms
    expect(schedule[5].delayMs).toBe(4900); // 59.900 - 55.000 = 4900ms
  });

  it("evaluates burst shot success correctly without false positives on code 0 quota exhausted", () => {
    const { isBurstSuccess } = require("../src/services/scheduler");
    const { handleApplyResult } = require("../src/services/xiaomi/state-machine");

    // Quota exhausted: code 0, apply_result 3 -> MUST NOT be success
    const quotaExhaustedRes = { code: 0, data: { apply_result: 3 }, description: "Quota full" };
    const evalExhausted = handleApplyResult(quotaExhaustedRes);
    expect(isBurstSuccess(evalExhausted, quotaExhaustedRes)).toBe(false);

    // Rate limited: code 0, apply_result 6 -> MUST NOT be success
    const rateLimitRes = { code: 0, data: { apply_result: 6 }, description: "Rate limit" };
    const evalRateLimit = handleApplyResult(rateLimitRes);
    expect(isBurstSuccess(evalRateLimit, rateLimitRes)).toBe(false);

    // Granted: code 0, apply_result 1 -> MUST BE success
    const successRes = { code: 0, data: { apply_result: 1 }, description: "Granted" };
    const evalSuccess = handleApplyResult(successRes);
    expect(isBurstSuccess(evalSuccess, successRes)).toBe(true);

    // Pre-authorized: code 100003 -> MUST BE success
    const preAuthRes = { code: 100003, data: null, description: "Already authorized" };
    const evalPreAuth = handleApplyResult(preAuthRes);
    expect(isBurstSuccess(evalPreAuth, preAuthRes)).toBe(true);
  });
});
