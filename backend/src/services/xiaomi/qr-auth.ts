import { createHash, randomUUID } from "crypto";

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

interface InternalSession extends QrSession {
  status: QrPollStatus;
  cUserId?: string;
  serviceToken?: string;
  error?: string;
  abortController: AbortController;
}

const SSO_LONGPOLLING_URL =
  "https://account.xiaomi.com/longPolling/loginUrl?sid=18n_bbs_global&_json=false&callback=https://sgp-api.buy.mi.com/bbs/api/global/user/login-back";
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
    const res = await fetch(SSO_LONGPOLLING_URL, {
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "application/json;charset=UTF-8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to initialize Xiaomi QR session: HTTP ${res.status}`);
    }

    const text = await res.text();
    const cleanText = text.startsWith("&&&START&&&") ? text.slice(11) : text;
    const data = JSON.parse(cleanText);

    if (!data.qr || !data.lp) {
      throw new Error(`Invalid QR session payload received from Xiaomi: ${cleanText}`);
    }

    const sessionId = randomUUID();
    const session: InternalSession = {
      sessionId,
      qrUrl: data.qr,
      loginUrl: data.loginUrl || "",
      lpUrl: data.lp,
      timeout: data.timeout || 300,
      createdAt: Date.now(),
      status: "WAITING",
      abortController: new AbortController(),
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
          const res = await fetch(session.lpUrl, {
            headers: {
              "User-Agent": DEFAULT_UA,
              "Accept": "application/json;charset=UTF-8",
            },
            signal: session.abortController.signal,
          });

          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }

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

  private async finalizeAuth(session: InternalSession, authData: any): Promise<void> {
    try {
      const nonce = authData.nonce;
      const ssecurity = authData.ssecurity;
      const location = authData.location;
      const userId = authData.userId ? String(authData.userId) : undefined;

      if (!location || !nonce || !ssecurity) {
        session.status = "ERROR";
        session.error = "Missing security tokens from Xiaomi response";
        return;
      }

      const clientSign = this.calculateClientSign(nonce, ssecurity);
      const finalUrl = `${location}&clientSign=${clientSign}`;

      // Call callback URL to extract authentication cookies
      const res = await fetch(finalUrl, {
        headers: {
          "User-Agent": DEFAULT_UA,
        },
        redirect: "manual",
      });

      const setCookies = res.headers.getSetCookie?.() || [];
      const cookieHeader = res.headers.get("set-cookie") || "";

      let extractedToken: string | undefined;
      let extractedUserId: string | undefined = userId;

      // Extract tokens from set-cookie headers
      const allCookies = [...setCookies, cookieHeader].join("; ");
      const tokenMatch =
        allCookies.match(/new_bbs_serviceToken=([^;]+)/) ||
        allCookies.match(/serviceToken=([^;]+)/);
      if (tokenMatch) {
        extractedToken = tokenMatch[1].trim();
      }

      const userMatch = allCookies.match(/cUserId=([^;]+)/) || allCookies.match(/userId=([^;]+)/);
      if (userMatch) {
        extractedUserId = userMatch[1].trim();
      }

      if (!extractedToken) {
        session.status = "ERROR";
        session.error = "Failed to extract serviceToken from Xiaomi redirect cookies";
        return;
      }

      session.serviceToken = extractedToken;
      session.cUserId = extractedUserId || authData.userId || "";
      session.status = "SUCCESS";
    } catch (err: any) {
      session.status = "ERROR";
      session.error = `Failed to exchange authorization token: ${err.message}`;
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
