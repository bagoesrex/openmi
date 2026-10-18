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
});
