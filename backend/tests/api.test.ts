import { describe, expect, it, beforeAll } from "bun:test";
import { createApp } from "../src/app";
import { initDb } from "../src/db/client";

describe("Elysia REST API", () => {
  let app: any;
  const masterPassword = "test-master-password";

  beforeAll(() => {
    process.env.MASTER_PASSWORD = masterPassword;
    process.env.JWT_SECRET = "super-secret-jwt-key";
    const db = initDb(":memory:");
    app = createApp(db);
  });

  it("should reject unauthorized requests to /api/accounts", async () => {
    const res = await app.handle(new Request("http://localhost/api/accounts"));
    expect(res.status).toBe(401);
  });

  it("should reject invalid login attempt", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("should authenticate with MASTER_PASSWORD and return JWT", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPassword }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBeDefined();

    // Access protected route with Bearer token
    const accRes = await app.handle(
      new Request("http://localhost/api/accounts", {
        headers: { Authorization: `Bearer ${json.token}` },
      })
    );
    expect(accRes.status).toBe(200);
    const accounts = await accRes.json();
    expect(Array.isArray(accounts)).toBe(true);

    // Create a new account
    const createRes = await app.handle(
      new Request("http://localhost/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${json.token}`,
        },
        body: JSON.stringify({
          label: "API Account",
          region: "global",
          cUserId: "998877",
          serviceToken: "token_12345",
          proxyUrl: "http://127.0.0.1:8080",
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.id).toBeDefined();
    expect(created.label).toBe("API Account");

    // Fetch accounts again
    const accListRes = await app.handle(
      new Request("http://localhost/api/accounts", {
        headers: { Authorization: `Bearer ${json.token}` },
      })
    );
    const list = await accListRes.json();
    expect(list.length).toBe(1);

    // Fetch logs
    const logsRes = await app.handle(
      new Request("http://localhost/api/logs", {
        headers: { Authorization: `Bearer ${json.token}` },
      })
    );
    expect(logsRes.status).toBe(200);
  });
});
