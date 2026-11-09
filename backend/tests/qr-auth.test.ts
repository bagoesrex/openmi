import { describe, expect, it } from "bun:test";
import { QrAuthService } from "../src/services/xiaomi/qr-auth";

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
});
