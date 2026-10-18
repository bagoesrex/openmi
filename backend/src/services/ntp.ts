/**
 * NTP / Network Time Synchronization Service
 *
 * Keeps local server clock offset calibrated to true UTC.
 * Uses HTTP Date header from high-reliability time reference with RTT compensation,
 * which works reliably in all containerized and non-root VPS environments where UDP NTP
 * might be restricted.
 */

let cachedOffsetMs: number = 0;
let lastSyncTimestamp: number = 0;

export async function syncNtpOffset(): Promise<number> {
  const referenceUrls = [
    "https://time.google.com",
    "https://time.cloudflare.com",
    "https://www.google.com",
  ];

  for (const url of referenceUrls) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      const t3 = Date.now();
      const dateHeader = res.headers.get("date");

      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        // Estimated round-trip latency compensation
        const rtt = t3 - t0;
        const estimatedTrueTime = serverTime + Math.round(rtt / 2);
        cachedOffsetMs = estimatedTrueTime - t3;
        lastSyncTimestamp = Date.now();
        console.log(`[NTP] Time synchronized via ${url}: offset = ${cachedOffsetMs}ms (RTT = ${rtt}ms)`);
        return cachedOffsetMs;
      }
    } catch (err: any) {
      // Try next reference
      continue;
    }
  }

  console.warn("[NTP] Could not reach network time servers; using system clock (offset = 0ms)");
  return cachedOffsetMs;
}

export function getCalibratedNow(): number {
  return Date.now() + cachedOffsetMs;
}

export function getCachedOffset(): number {
  return cachedOffsetMs;
}
