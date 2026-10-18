import { describe, expect, it } from "bun:test";
import { handleApplyResult, XiaomiStateAction } from "../src/services/xiaomi/state-machine";
import { formatXiaomiHeaders, buildXiaomiUrl } from "../src/services/xiaomi/client";

describe("Xiaomi API Client & State Machine", () => {
  it("should construct correct Xiaomi Community headers and URLs", () => {
    const headers = formatXiaomiHeaders("123456", "token_abc");
    expect(headers["Cookie"]).toBe("cUserId=123456; serviceToken=token_abc");
    expect(headers["User-Agent"]).toContain("XiaoMi/MiuiBrowser/4.3");
    expect(headers["Content-Type"]).toBe("application/json");

    const urlGlobal = buildXiaomiUrl("global", "apply/bl-auth");
    expect(urlGlobal).toBe("https://new.c.mi.com/global/apply/bl-auth");

    const urlId = buildXiaomiUrl("id", "user/bl-switch/state");
    expect(urlId).toBe("https://new.c.mi.com/id/user/bl-switch/state");
  });

  it("should correctly classify and produce diagnostic explanations for all 7 applyResult codes", () => {
    // 1. Success (test camelCase)
    const res1 = handleApplyResult({ code: 0, data: { applyResult: 1 } });
    expect(res1.action).toBe(XiaomiStateAction.SUCCESS);
    expect(res1.isTerminal).toBe(true);

    // 1b. Success (test snake_case from Xiaomi wire format)
    const res1b = handleApplyResult({ code: 0, data: { apply_result: 1 } });
    expect(res1b.action).toBe(XiaomiStateAction.SUCCESS);
    expect(res1b.applyResult).toBe(1);

    // 2. Monthly limit / Device cooldown
    const res2 = handleApplyResult({ code: 0, data: { applyResult: 2 } });
    expect(res2.action).toBe(XiaomiStateAction.STOP_COOLDOWN);
    expect(res2.isTerminal).toBe(true);
    expect(res2.diagnosticHint).toContain("Monthly unlock limit");

    // 3. Daily quota exhausted
    const res3 = handleApplyResult({
      code: 0,
      data: { applyResult: 3, deadlineFormat: "10/19 00:00" },
    });
    expect(res3.action).toBe(XiaomiStateAction.STOP_QUOTA_EXHAUSTED);
    expect(res3.isTerminal).toBe(true);
    expect(res3.diagnosticHint).toContain("Daily quota exhausted");

    // 4. Verification cooldown
    const res4 = handleApplyResult({ code: 0, data: { applyResult: 4 } });
    expect(res4.action).toBe(XiaomiStateAction.STOP_VERIFICATION_REQUIRED);
    expect(res4.isTerminal).toBe(true);

    // 5. Transient failure -> Immediate retry
    const res5 = handleApplyResult({ code: 0, data: { applyResult: 5 } });
    expect(res5.action).toBe(XiaomiStateAction.RETRY_IMMEDIATE);
    expect(res5.isTerminal).toBe(false);

    // 6. Frequency rate limit -> Cooldown 60s
    const res6 = handleApplyResult({ code: 0, data: { applyResult: 6 } });
    expect(res6.action).toBe(XiaomiStateAction.RETRY_AFTER_COOLDOWN);
    expect(res6.delayMs).toBe(60000);
    expect(res6.isTerminal).toBe(false);
    expect(res6.diagnosticHint).toContain("IP/Account frequency rate limited");

    // 7. Server busy -> Immediate retry
    const res7 = handleApplyResult({ code: 0, data: { applyResult: 7 } });
    expect(res7.action).toBe(XiaomiStateAction.RETRY_IMMEDIATE);
    expect(res7.isTerminal).toBe(false);

    // Unknown code / HTTP error
    const resUnknown = handleApplyResult({ code: 999, message: "Server error" });
    expect(resUnknown.action).toBe(XiaomiStateAction.ERROR);
    expect(resUnknown.diagnosticHint).toBeDefined();
  });
});
