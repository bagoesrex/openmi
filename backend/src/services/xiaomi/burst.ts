import { randomBytes } from "crypto";
import { DEFAULT_USER_AGENT, normalizeServiceToken } from "./client";

export const TIMING_PROFILES = {
  asia: [58.8, 59.1, 59.3, 59.5, 59.7, 59.9],
  europe: [58.7, 58.8, 59.1, 59.3, 59.5, 59.8],
  single: [60.0],
} as const;

export type TimingMode = "asia" | "europe" | "single" | "custom";

export const VERSION_CODE = "500440";
export const VERSION_NAME = "5.4.40";

export function generateDeviceId(): string {
  return randomBytes(20).toString("hex").toUpperCase();
}

export function resolveTimings(mode?: TimingMode, custom?: string | number[] | null): number[] {
  if (mode === "europe") {
    return [...TIMING_PROFILES.europe];
  }
  if (mode === "single") {
    return [...TIMING_PROFILES.single];
  }
  if (mode === "custom") {
    if (Array.isArray(custom)) {
      const valid = custom.filter((n) => typeof n === "number" && n >= 0 && n <= 60);
      if (valid.length > 0) return valid.sort((a, b) => a - b);
    } else if (typeof custom === "string") {
      try {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed)) {
          const valid = parsed.map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 60);
          if (valid.length > 0) return valid.sort((a, b) => a - b);
        }
      } catch {}
    }
  }
  // Default fallback is Asia
  return [...TIMING_PROFILES.asia];
}

export function formatBurstHeaders(
  cUserId: string,
  serviceToken: string,
  deviceId?: string | null
): Record<string, string> {
  const safeToken = normalizeServiceToken(serviceToken);
  const devId = deviceId?.trim() || generateDeviceId();

  const cookieStr = [
    `cUserId=${cUserId.trim()}`,
    `serviceToken=${safeToken}`,
    `new_bbs_serviceToken=${safeToken}`,
    `versionCode=${VERSION_CODE}`,
    `versionName=${VERSION_NAME}`,
    `deviceId=${devId}`,
  ].join("; ");

  return {
    "Cookie": cookieStr,
    "User-Agent": DEFAULT_USER_AGENT,
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
  };
}
