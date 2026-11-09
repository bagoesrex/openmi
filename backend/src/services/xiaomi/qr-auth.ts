import { createHash, randomUUID } from "crypto";
import { logBroadcaster } from "../broadcaster";

export interface QrSession {
  sessionId: string;
  qrUrl: string;
  loginUrl: string;
  lpUrl: string;
  timeout: number;
  createdAt: number;
}

export type QrPollStatus = "WAITING" | "SCANNED" | "SUCCESS" | "EXPIRED" | "ERROR";

export interface QrPollResult {
  status: QrPollStatus;
  cUserId?: string;
  serviceToken?: string;
  error?: string;
}

const IGNORED_COOKIE_ATTRS = new Set([
  "path",
  "domain",
  "expires",
  "max-age",
  "samesite",
  "secure",
  "httponly",
  "priority",
  "version",
]);

export class SimpleCookieJar {
  private cookies = new Map<string, string>();

  public setCookies(setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      if (!header) continue;
      // Match all key=value pairs, filtering out known Set-Cookie directives
      const matches = header.matchAll(/([a-zA-Z0-9_\-\.]+)=([^;,\r\n]+)/g);
      for (const match of matches) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!IGNORED_COOKIE_ATTRS.has(key.toLowerCase()) && value) {
          this.cookies.set(key, value);
        }
      }
    }
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public toJSON(): Record<string, string> {
    return Object.fromEntries(this.cookies);
  }
}

export function extractSetCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") {
    const list = res.headers.getSetCookie();
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

export interface InternalSession extends QrSession {
  status: QrPollStatus;
  cUserId?: string;
  serviceToken?: string;
  error?: string;
  abortController: AbortController;
  cookieJar: SimpleCookieJar;
}

const CALLBACK_URL = "https://sgp-api.buy.mi.com/bbs/api/global/user/login-back";
const SID = "18n_bbs_global";
const SSO_LONGPOLLING_URL = `https://account.xiaomi.com/longPolling/loginUrl?sid=${SID}&_json=false&callback=${encodeURIComponent(
  CALLBACK_URL
)}`;
const SERVICELOGIN_URL = "https://account.xiaomi.com/pass/serviceLogin";
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class QrAuthService {
  private sessions = new Map<string, InternalSession>();

  constructor() {
    // Periodic garbage collection for sessions older than 10 minutes
    setInterval(() => this.cleanupOldSessions(), 60_000).unref();
  }

  public calculateClientSign(nonce: string, ssecurity: string): string {
    const raw = `nonce=${nonce}&${ssecurity}`;
    const hash = createHash("sha1").update(raw).digest("base64");
    return encodeURIComponent(hash);
  }

  public async createSession(): Promise<QrSession> {
    const cookieJar = new SimpleCookieJar();
    const res = await fetch(SSO_LONGPOLLING_URL, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "application/json;charset=UTF-8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to initialize Xiaomi QR session: HTTP ${res.status}`);
    }

    cookieJar.setCookies(extractSetCookies(res));

    const text = await res.text();
    const cleanText = text.startsWith("&&&START&&&") ? text.slice(11) : text;
    let data: any;
    try {
      data = JSON.parse(cleanText);
    } catch (err: any) {
      throw new Error(`Invalid QR session payload received from Xiaomi: ${err.message}`);
    }

    if (!data.qr || !data.lp) {
      throw new Error(`Invalid QR session payload received from Xiaomi: ${cleanText}`);
    }

    const sessionId = randomUUID();
    const session: InternalSession = {
      sessionId,
      qrUrl: data.qr,
      loginUrl: data.loginUrl || "",
      lpUrl: data.lp,
      timeout: typeof data.timeout === "number" ? data.timeout : 300,
      createdAt: Date.now(),
      status: "WAITING",
      abortController: new AbortController(),
      cookieJar,
    };

    this.sessions.set(sessionId, session);
    this.startBackgroundPolling(session);

    return {
      sessionId: session.sessionId,
      qrUrl: session.qrUrl,
      loginUrl: session.loginUrl,
      lpUrl: session.lpUrl,
      timeout: session.timeout,
      createdAt: session.createdAt,
    };
  }

  public getSessionStatus(sessionId: string): QrPollResult | null {
    this.cleanupOldSessions();
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check expiration
    if (
      session.status !== "SUCCESS" &&
      session.status !== "ERROR" &&
      Date.now() - session.createdAt > session.timeout * 1000
    ) {
      session.status = "EXPIRED";
      session.abortController.abort();
    }

    return {
      status: session.status,
      cUserId: session.cUserId,
      serviceToken: session.serviceToken,
      error: session.error,
    };
  }

  public cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      this.sessions.delete(sessionId);
    }
  }

  private async startBackgroundPolling(session: InternalSession): Promise<void> {
    const startTime = Date.now();
    const maxDuration = session.timeout * 1000;

    try {
      while (
        !session.abortController.signal.aborted &&
        Date.now() - startTime < maxDuration
      ) {
        try {
          const cookieHeader = session.cookieJar.getCookieHeader();
          const res = await fetch(session.lpUrl, {
            headers: {
              "User-Agent": DEFAULT_UA,
              "Accept": "application/json;charset=UTF-8",
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            signal: session.abortController.signal,
          });

          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

          session.cookieJar.setCookies(extractSetCookies(res));

          const text = await res.text();
          const cleanText = text.startsWith("&&&START&&&") ? text.slice(11) : text;
          let data: any;
          try {
            data = JSON.parse(cleanText);
          } catch {
            continue;
          }

          const code = data.code;
          if (code === 0) {
            // Approved by user on phone
            session.status = "SCANNED";
            await this.finalizeAuth(session, data);
            return;
          } else if (code === 87001) {
            // Scanned, waiting for mobile authorization confirmation
            session.status = "SCANNED";
          } else if (code === 70016) {
            // Still waiting for scan
            session.status = "WAITING";
          }
        } catch (err: any) {
          if (session.abortController.signal.aborted) return;
          // Timeout or connection reset is normal in HTTP long polling
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!session.abortController.signal.aborted && session.status !== "SUCCESS") {
        session.status = "EXPIRED";
      }
    } catch (err: any) {
      if (!session.abortController.signal.aborted) {
        session.status = "ERROR";
        session.error = err.message || "Unknown error during polling";
      }
    }
  }

  public async finalizeAuth(session: InternalSession, authData: any): Promise<void> {
    try {
      console.log("[QR-Auth] Handshake approved. Starting finalizeAuth with data:", {
        code: authData?.code,
        userId: authData?.userId,
        location: authData?.location,
        hasNonce: !!authData?.nonce,
        hasSsecurity: !!authData?.ssecurity,
      });

      let nonce = authData?.nonce;
      let ssecurity = authData?.ssecurity;
      let location = authData?.location;
      let userId = authData?.userId ? String(authData.userId) : undefined;

      // Fallback: if tokens are missing from longPolling payload, query serviceLogin
      if (!location || !nonce || !ssecurity) {
        console.log("[QR-Auth] Missing location/nonce/ssecurity in authData. Querying serviceLogin fallback...");
        const serviceLoginUrl = `${SERVICELOGIN_URL}?sid=${SID}&_json=true`;
        const cookieHeader = session.cookieJar.getCookieHeader();
        const slRes = await fetch(serviceLoginUrl, {
          headers: {
            "User-Agent": DEFAULT_UA,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
        session.cookieJar.setCookies(extractSetCookies(slRes));
        const slText = await slRes.text();
        const cleanSlText = slText.startsWith("&&&START&&&") ? slText.slice(11) : slText;
        try {
          const slJson = JSON.parse(cleanSlText);
          nonce = slJson.nonce || nonce;
          ssecurity = slJson.ssecurity || ssecurity;
          location = slJson.location || location;
          if (slJson.userId) userId = String(slJson.userId);
          console.log("[QR-Auth] serviceLogin response:", {
            code: slJson.code,
            location: slJson.location,
            hasNonce: !!slJson.nonce,
            hasSsecurity: !!slJson.ssecurity,
          });
        } catch {
          // ignore parsing error, proceed to check below
        }
      }

      if (!location || !nonce || !ssecurity) {
        const errMsg = "Missing security tokens from Xiaomi response";
        console.error(`[QR-Auth] Error: ${errMsg}`);
        session.status = "ERROR";
        session.error = errMsg;
        return;
      }

      const clientSign = this.calculateClientSign(nonce, ssecurity);
      let currentUrl = `${location}${location.includes("?") ? "&" : "?"}clientSign=${clientSign}`;

      // Follow redirect chain, accumulating cookies at each hop until final destination
      const maxRedirects = 10;
      let redirectsCount = 0;
      let lastStatus = 0;
      let lastBody = "";

      let extractedToken: string | undefined;
      let extractedUserId: string | undefined = userId;

      while (redirectsCount < maxRedirects) {
        redirectsCount++;
        const cookieHeader = session.cookieJar.getCookieHeader();
        console.log(`[QR-Auth] Hop ${redirectsCount}: GET ${currentUrl}`);
        if (cookieHeader) console.log(`[QR-Auth] -> Sending Cookies: ${cookieHeader}`);

        const res = await fetch(currentUrl, {
          headers: {
            "User-Agent": DEFAULT_UA,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          redirect: "manual",
        });

        lastStatus = res.status;
        const setCookies = extractSetCookies(res);
        if (setCookies.length > 0) {
          session.cookieJar.setCookies(setCookies);
          console.log(`[QR-Auth] Hop ${redirectsCount} Set-Cookie:`, setCookies);
        }

        console.log(`[QR-Auth] Hop ${redirectsCount} status: ${res.status}`);

        // Check if token was set in cookies
        extractedToken =
          session.cookieJar.get("new_bbs_serviceToken") ||
          session.cookieJar.get("serviceToken") ||
          session.cookieJar.get("bbs_serviceToken");

        extractedUserId =
          session.cookieJar.get("cUserId") ||
          session.cookieJar.get("userId") ||
          extractedUserId;

        // Follow 3xx redirects
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          console.log(`[QR-Auth] Hop ${redirectsCount} Location header: ${loc}`);
          if (!loc) break;

          // Check if token was passed as a query param in redirect URL
          try {
            const u = new URL(loc, currentUrl);
            const qToken =
              u.searchParams.get("new_bbs_serviceToken") ||
              u.searchParams.get("serviceToken") ||
              u.searchParams.get("token");
            if (qToken && !extractedToken) {
              extractedToken = qToken;
            }
            const qUser = u.searchParams.get("cUserId") || u.searchParams.get("userId");
            if (qUser && !extractedUserId) {
              extractedUserId = qUser;
            }
          } catch {}

          currentUrl = new URL(loc, currentUrl).toString();
          continue;
        }

        // Final non-redirect response: inspect body
        lastBody = await res.text().catch(() => "");
        console.log(`[QR-Auth] Final body preview: ${lastBody.slice(0, 300)}`);

        // Check if token is in body JSON
        try {
          const bodyJson = JSON.parse(lastBody.startsWith("&&&START&&&") ? lastBody.slice(11) : lastBody);
          const bToken =
            bodyJson.data?.new_bbs_serviceToken ||
            bodyJson.data?.serviceToken ||
            bodyJson.new_bbs_serviceToken ||
            bodyJson.serviceToken;
          if (bToken && !extractedToken) {
            extractedToken = bToken;
          }
          const bUser = bodyJson.data?.cUserId || bodyJson.data?.userId || bodyJson.userId;
          if (bUser && !extractedUserId) {
            extractedUserId = String(bUser);
          }
        } catch {}

        break;
      }

      // Final check of cookies
      if (!extractedToken) {
        extractedToken =
          session.cookieJar.get("new_bbs_serviceToken") ||
          session.cookieJar.get("serviceToken") ||
          session.cookieJar.get("bbs_serviceToken");
      }

      if (!extractedToken) {
        const captured = session.cookieJar.toJSON();
        const cookieNames = Object.keys(captured);
        const errDetails = `Failed to extract serviceToken (hops: ${redirectsCount}, status: ${lastStatus}, cookies: [${cookieNames.join(
          ", "
        )}], body: ${lastBody.slice(0, 100) || "empty"})`;
        console.error(`[QR-Auth] Error: ${errDetails}`);
        session.status = "ERROR";
        session.error = errDetails;

        logBroadcaster.broadcast({
          id: Date.now(),
          timestamp: Date.now(),
          action: "QR_AUTH_ERROR",
          resultCode: lastStatus || 500,
          message: errDetails,
          rawPayload: JSON.stringify({ lastUrl: currentUrl, cookies: cookieNames }),
          errorDetails: errDetails,
        });
        return;
      }

      session.serviceToken = extractedToken;
      session.cUserId = extractedUserId || "";
      session.status = "SUCCESS";
      console.log(`[QR-Auth] SUCCESS! Extracted token for cUserId: ${session.cUserId}`);

      logBroadcaster.broadcast({
        id: Date.now(),
        timestamp: Date.now(),
        action: "QR_AUTH_SUCCESS",
        resultCode: 0,
        message: `Xiaomi QR login authorized successfully for Account ID ${session.cUserId}`,
        rawPayload: null,
        errorDetails: null,
      });
    } catch (err: any) {
      const errMsg = `Failed to exchange authorization token: ${err.message}`;
      console.error(`[QR-Auth] Exception: ${errMsg}`);
      session.status = "ERROR";
      session.error = errMsg;

      logBroadcaster.broadcast({
        id: Date.now(),
        timestamp: Date.now(),
        action: "QR_AUTH_ERROR",
        resultCode: 500,
        message: errMsg,
        rawPayload: null,
        errorDetails: err.stack || errMsg,
      });
    }
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > 600_000) {
        session.abortController.abort();
        this.sessions.delete(id);
      }
    }
  }
}

export const qrAuthService = new QrAuthService();
