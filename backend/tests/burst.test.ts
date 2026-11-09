import { describe, expect, it } from "bun:test";
import {
  generateDeviceId,
  resolveTimings,
  formatBurstHeaders,
  TIMING_PROFILES,
} from "../src/services/xiaomi/burst";

describe("Burst Timing & Client Mechanics", () => {
  it("generates unique 40-character uppercase hex device IDs", () => {
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).toHaveLength(40);
    expect(id2).toHaveLength(40);
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9A-F]{40}$/);
  });

  it("resolves default Asia timing profile offsets", () => {
    const timings = resolveTimings("asia");
    expect(timings).toEqual([58.8, 59.1, 59.3, 59.5, 59.7, 59.9]);
    expect(TIMING_PROFILES.asia).toEqual([58.8, 59.1, 59.3, 59.5, 59.7, 59.9]);
  });

  it("resolves Europe and single timing profiles", () => {
    const europeTimings = resolveTimings("europe");
    expect(europeTimings).toEqual([58.7, 58.8, 59.1, 59.3, 59.5, 59.8]);

    const singleTimings = resolveTimings("single");
    expect(singleTimings).toEqual([60.0]);
  });

  it("resolves custom timing string or array correctly", () => {
    const customFromString = resolveTimings("custom", "[58.5, 59.2, 59.8]");
    expect(customFromString).toEqual([58.5, 59.2, 59.8]);

    const customFromInvalid = resolveTimings("custom", "invalid-json");
    expect(customFromInvalid).toEqual([58.8, 59.1, 59.3, 59.5, 59.7, 59.9]); // Fallback to Asia
  });

  it("formats enriched Cookie headers with deviceId and app versions", () => {
    const headers = formatBurstHeaders("12345", "token_abc", "DEV_ID_XYZ_40_CHARS");
    expect(headers["Cookie"]).toContain("cUserId=12345; serviceToken=token_abc");
    expect(headers["Cookie"]).toContain("new_bbs_serviceToken=token_abc");
    expect(headers["Cookie"]).toContain("deviceId=DEV_ID_XYZ_40_CHARS");
    expect(headers["Cookie"]).toContain("versionCode=500440");
    expect(headers["Cookie"]).toContain("versionName=5.4.40");
    expect(headers["User-Agent"]).toContain("XiaoMi/MiuiBrowser/4.3");
  });
});
