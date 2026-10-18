import { describe, expect, it, beforeEach } from "bun:test";
import { initDb } from "../src/db/client";
import { createAccountRepo, createLogRepo } from "../src/db/repository";

describe("Database & Repositories", () => {
  let db: any;
  let accountRepo: any;
  let logRepo: any;

  beforeEach(() => {
    db = initDb(":memory:");
    accountRepo = createAccountRepo(db);
    logRepo = createLogRepo(db);
  });

  it("should create, read, update, and delete an account", () => {
    const acc = accountRepo.create({
      label: "My Test Account",
      region: "global",
      cUserId: "12345678",
      serviceToken: "token_abc_123",
      deviceId: "dev_xyz",
      proxyUrl: "http://proxy.example.com:8080",
    });

    expect(acc.id).toBeDefined();
    expect(acc.label).toBe("My Test Account");
    expect(acc.proxyUrl).toBe("http://proxy.example.com:8080");
    expect(acc.autoApplyEnabled).toBe(1);

    const fetched = accountRepo.getById(acc.id);
    expect(fetched?.cUserId).toBe("12345678");

    accountRepo.update(acc.id, { autoApplyEnabled: 0, lastApplyResult: 1 });
    const updated = accountRepo.getById(acc.id);
    expect(updated?.autoApplyEnabled).toBe(0);
    expect(updated?.lastApplyResult).toBe(1);

    const all = accountRepo.getAll();
    expect(all.length).toBe(1);

    const deleted = accountRepo.delete(acc.id);
    expect(deleted).toBe(true);
    expect(accountRepo.getById(acc.id)).toBeNull();
  });

  it("should write and fetch execution logs with diagnostic metadata", () => {
    // Create an account first to satisfy foreign key constraint
    const acc = accountRepo.create({
      label: "Log Test Account",
      cUserId: "888888",
      serviceToken: "token_xyz",
    });

    const now = Date.now();
    logRepo.insert({
      accountId: acc.id,
      timestamp: now,
      action: "APPLY",
      resultCode: 1,
      message: "Application successful",
      rawPayload: '{"code":0,"data":{"applyResult":1}}',
      errorDetails: null,
    });

    logRepo.insert({
      accountId: acc.id,
      timestamp: now + 10,
      action: "APPLY",
      resultCode: 6,
      message: "Frequency rate limit exceeded",
      rawPayload: '{"code":0,"data":{"applyResult":6}}',
      errorDetails: "Rate limited by Xiaomi API at T-0s; requires 60s cooldown",
    });

    // Also support system-level log with null accountId
    logRepo.insert({
      accountId: null,
      timestamp: now + 20,
      action: "NTP_SYNC",
      resultCode: 0,
      message: "NTP synchronized",
    });

    const logs = logRepo.getRecent(10);
    expect(logs.length).toBe(3);
    // Recent first
    expect(logs[0].action).toBe("NTP_SYNC");
    expect(logs[1].resultCode).toBe(6);
    expect(logs[1].errorDetails).toBe("Rate limited by Xiaomi API at T-0s; requires 60s cooldown");
    expect(logs[2].resultCode).toBe(1);
  });
});
