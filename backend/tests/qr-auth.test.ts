import { describe, expect, it } from "bun:test";
import { QrAuthService, SimpleCookieJar, extractSetCookies } from "../src/services/xiaomi/qr-auth";

describe("QrAuthService", () => {
  it("creates a valid QR session with Xiaomi URLs and parses response correctly", async () => {
    const service = new QrAuthService();
    const session = await service.createSession();

    expect(session.sessionId).toBeDefined();
    expect(typeof session.sessionId).toBe("string");
    expect(session.qrUrl).toContain("account.xiaomi.com");
    expect(session.lpUrl).toContain("/lp/");
    expect(session.timeout).toBeGreaterThan(0);

    const initialStatus = service.getSessionStatus(session.sessionId);
    expect(initialStatus).toBeDefined();
    expect(initialStatus?.status).toBe("WAITING");

    service.cancelSession(session.sessionId);
  });

  it("handles invalid or non-existent session ids gracefully", () => {
    const service = new QrAuthService();
    const status = service.getSessionStatus("non-existent-session-id");
    expect(status).toBeNull();
  });

  it("calculates correct clientSign signature from nonce and ssecurity", () => {
    const service = new QrAuthService();
    const nonce = "1234567890";
    const ssecurity = "test_secret_key";
    const sign = service.calculateClientSign(nonce, ssecurity);

    expect(typeof sign).toBe("string");
    expect(sign.length).toBeGreaterThan(10);
    // sha1("nonce=1234567890&test_secret_key") in base64, URI encoded
    // Verify determinism:
    const sign2 = service.calculateClientSign(nonce, ssecurity);
    expect(sign).toBe(sign2);
  });

  it("SimpleCookieJar parses and accumulates cookies properly", () => {
    const jar = new SimpleCookieJar();
    jar.setCookies([
      "deviceId=dev123; Path=/; Domain=.xiaomi.com",
      "passToken=base64==token; Path=/",
      "uLocale=en_US",
    ]);

    expect(jar.get("deviceId")).toBe("dev123");
    expect(jar.get("passToken")).toBe("base64==token");
    expect(jar.get("uLocale")).toBe("en_US");
    expect(jar.getCookieHeader()).toContain("deviceId=dev123");
    expect(jar.getCookieHeader()).toContain("passToken=base64==token");

    // Overwrite existing cookie
    jar.setCookies(["passToken=updatedToken; Path=/"]);
    expect(jar.get("passToken")).toBe("updatedToken");
  });

  it("extractSetCookies retrieves cookies from Response", () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "cUserId=123456; Path=/");
    headers.append("Set-Cookie", "new_bbs_serviceToken=tok999; Path=/");
    const res = new Response("ok", { headers });

    const cookies = extractSetCookies(res);
    expect(cookies.length).toBe(2);
    expect(cookies.some((c) => c.includes("cUserId=123456"))).toBe(true);
    expect(cookies.some((c) => c.includes("new_bbs_serviceToken=tok999"))).toBe(true);
  });

  it("finalizeAuth follows redirect chain and extracts tokens into session", async () => {
    const service = new QrAuthService();
    const session = {
      sessionId: "test-session-1",
      qrUrl: "https://account.xiaomi.com/qr",
      loginUrl: "",
      lpUrl: "https://account.xiaomi.com/lp",
      timeout: 300,
      createdAt: Date.now(),
      status: "SCANNED" as const,
      abortController: new AbortController(),
      cookieJar: new SimpleCookieJar(),
    };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes("account.xiaomi.com/sts")) {
          // Hop 1: 302 redirect from account.xiaomi.com to sgp-api callback
          const headers = new Headers();
          headers.set("Location", "https://sgp-api.buy.mi.com/bbs/api/global/user/login-back?code=0");
          headers.append("Set-Cookie", "passToken=secret_pass_token_xyz; Path=/");
          return new Response(null, { status: 302, headers });
        }
        if (urlStr.includes("login-back")) {
          // Hop 2: sgp-api sets new_bbs_serviceToken and cUserId
          const headers = new Headers();
          headers.append("Set-Cookie", "new_bbs_serviceToken=valid_bbs_token_999; Path=/; Domain=.buy.mi.com");
          headers.append("Set-Cookie", "cUserId=88776655; Path=/; Domain=.buy.mi.com");
          return new Response(JSON.stringify({ code: 0, message: "ok" }), {
            status: 200,
            headers,
          });
        }
        return originalFetch(url, init);
      }) as any;

      await service.finalizeAuth(session, {
        nonce: "test_nonce_123",
        ssecurity: "test_sec_456",
        location: "https://account.xiaomi.com/sts?sign=abc",
        userId: 88776655,
      });

      expect(session.status).toBe("SUCCESS");
      expect(session.serviceToken).toBe("valid_bbs_token_999");
      expect(session.cUserId).toBe("88776655");
      expect(session.cookieJar.get("passToken")).toBe("secret_pass_token_xyz");
      expect(session.cookieJar.get("new_bbs_serviceToken")).toBe("valid_bbs_token_999");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("finalizeAuth falls back to serviceLogin if tokens are absent in longpoll payload", async () => {
    const service = new QrAuthService();
    const session = {
      sessionId: "test-session-2",
      qrUrl: "https://account.xiaomi.com/qr",
      loginUrl: "",
      lpUrl: "https://account.xiaomi.com/lp",
      timeout: 300,
      createdAt: Date.now(),
      status: "SCANNED" as const,
      abortController: new AbortController(),
      cookieJar: new SimpleCookieJar(),
    };

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any, init?: any) => {
        const urlStr = String(url);
        if (urlStr.includes("serviceLogin")) {
          return new Response(
            "&&&START&&&" +
              JSON.stringify({
                nonce: "fallback_nonce",
                ssecurity: "fallback_sec",
                location: "https://sgp-api.buy.mi.com/bbs/api/global/user/login-back?auth=1",
                userId: "33445566",
              }),
            { status: 200 }
          );
        }
        if (urlStr.includes("login-back")) {
          const headers = new Headers();
          headers.append("Set-Cookie", "serviceToken=fallback_token_888; Path=/");
          return new Response(JSON.stringify({ code: 0 }), { status: 200, headers });
        }
        return originalFetch(url, init);
      }) as any;

      // Pass authData without location/nonce/ssecurity
      await service.finalizeAuth(session, { code: 0 });

      expect(session.status).toBe("SUCCESS");
      expect(session.serviceToken).toBe("fallback_token_888");
      expect(session.cUserId).toBe("33445566");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
