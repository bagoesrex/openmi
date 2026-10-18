# OpenMi Full-Stack Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete OpenMi personal bootloader unlock platform with a Bun + ElysiaJS + `bun:sqlite` backend and a Bun + React + Vite + Tailwind CSS frontend dashboard.

**Architecture:** A decoupled full-stack architecture where the Elysia backend daemon runs 24/7 on a VPS handling scheduled, NTP-calibrated, pre-warmed API requests to Xiaomi Community, while a lightweight React SPA dashboard deployed on Vercel communicates via authenticated REST API and real-time Server-Sent Events (SSE).

**Tech Stack:** Bun 1.4+, ElysiaJS, `bun:sqlite`, `@elysiajs/jwt`, `@elysiajs/cors`, React 19, Vite, Tailwind CSS, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-18-openmi-design.md`

## Global Constraints
- Target quota reset is strictly **00:00:00 GMT+8 (Beijing Time)** = **23:00:00 WIB (GMT+7)**.
- Single-tenant security: `MASTER_PASSWORD` defined in backend `.env`, verified via signed JWT tokens (`Authorization: Bearer <token>`).
- Database must strictly use native `bun:sqlite` with prepared statements (zero external DB services).
- Commit format: Strictly Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Xiaomi requests must include `User-Agent` ending with `XiaoMi/MiuiBrowser/4.3` and valid `cUserId` + `serviceToken` cookies.

## Review Focus
1. **Clock drift handling**: Local VPS clock differs from true GMT+8 midnight by >500ms; verify NTP synchronization offsets system time.
2. **Sibling request race condition**: Concurrency dispatch at T-0s must cancel sibling in-flight requests immediately once any sibling returns terminal code 1, 2, 3, or 4.
3. **Invalid/expired cookie on scheduled run**: Account fails verification at T-5s; must flag `session_valid = 0`, log error, and skip T-0s burst to prevent unnecessary failures.
4. **Proxy format validation**: Optional `proxy_url` per account must accept `http://`, `https://`, and `socks5://` or be null/empty, without crashing Bun fetch.
5. **SSE reconnect & buffer memory**: Reconnecting dashboard clients must fetch recent history from `execution_logs` and stream live events without unbounded memory growth.

---

### Task 1: Backend Scaffolding, Database Schema & Account Repository

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/repository.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Consumes: Nothing
- Produces:
  - `initDb(path?: string): Database`
  - `accountRepo: { getAll(): Account[], getById(id: string): Account | null, create(data: NewAccount): Account, update(id: string, data: Partial<Account>): Account | null, delete(id: string): boolean }`
  - `logRepo: { insert(log: NewLog): void, getRecent(limit?: number): Log[] }`

- [ ] **Step 1: Write the failing test for database initialization & CRUD**

```typescript
// backend/tests/db.test.ts
import { describe, expect, it, beforeEach } from "bun:test";
import { initDb, closeDb } from "../src/db/client";
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

    const fetched = accountRepo.getById(acc.id);
    expect(fetched?.cUserId).toBe("12345678");

    accountRepo.update(acc.id, { autoApplyEnabled: 0, lastApplyResult: 1 });
    const updated = accountRepo.getById(acc.id);
    expect(updated?.autoApplyEnabled).toBe(0);
    expect(updated?.lastApplyResult).toBe(1);

    const deleted = accountRepo.delete(acc.id);
    expect(deleted).toBe(true);
    expect(accountRepo.getById(acc.id)).toBeNull();
  });

  it("should write and fetch execution logs", () => {
    logRepo.insert({
      accountId: "acc_1",
      timestamp: Date.now(),
      action: "APPLY",
      resultCode: 1,
      message: "Application successful",
      rawPayload: '{"code":0,"data":{"applyResult":1}}',
    });

    const logs = logRepo.getRecent(10);
    expect(logs.length).toBe(1);
    expect(logs[0].resultCode).toBe(1);
    expect(logs[0].message).toBe("Application successful");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/db.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement database schema, connection, and repositories**

Scaffold `backend/package.json` with dependencies (`elysia`, `@elysiajs/jwt`, `@elysiajs/cors`), implement `schema.ts`, `client.ts`, and `repository.ts` using `bun:sqlite` with prepared statements.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): implement bun:sqlite schema and repositories"
```

---

### Task 2: Xiaomi API Client & State Machine Engine

**Files:**
- Create: `backend/src/services/xiaomi-api.ts`
- Create: `backend/src/services/state-machine.ts`
- Test: `backend/tests/xiaomi-api.test.ts`

**Interfaces:**
- Consumes: `Account` from `backend/src/db/repository.ts`
- Produces:
  - `checkSwitchValue(region: string, proxy?: string): Promise<{ switchValue: boolean }>`
  - `checkUserState(account: Account): Promise<{ code: number, buttonState: number, deadlineFormat?: string, isPass: boolean }>`
  - `applyAuth(account: Account, isRetry: boolean): Promise<{ code: number, applyResult: number, deadlineFormat?: string }>`
  - `handleApplyResult(result: ApplyResponse): { action: "SUCCESS" | "STOP" | "RETRY_IMMEDIATE" | "RETRY_AFTER_COOLDOWN", delayMs?: number, message: string }`

- [ ] **Step 1: Write failing unit test for Xiaomi API client and State Machine**

```typescript
// backend/tests/xiaomi-api.test.ts
import { describe, expect, it } from "bun:test";
import { handleApplyResult } from "../src/services/state-machine";

describe("Xiaomi State Machine", () => {
  it("should categorize all 7 applyResult codes correctly", () => {
    // Code 1: Success
    expect(handleApplyResult({ code: 0, data: { applyResult: 1 } }).action).toBe("SUCCESS");
    // Code 2: Monthly / device limit reached
    expect(handleApplyResult({ code: 0, data: { applyResult: 2 } }).action).toBe("STOP");
    // Code 3: Daily quota exhausted
    expect(handleApplyResult({ code: 0, data: { applyResult: 3 } }).action).toBe("STOP");
    // Code 4: Cooldown / verification error
    expect(handleApplyResult({ code: 0, data: { applyResult: 4 } }).action).toBe("STOP");
    // Code 5: Transient failure -> retry immediately
    expect(handleApplyResult({ code: 0, data: { applyResult: 5 } }).action).toBe("RETRY_IMMEDIATE");
    // Code 6: Frequency limit -> wait 60s
    const rateLimit = handleApplyResult({ code: 0, data: { applyResult: 6 } });
    expect(rateLimit.action).toBe("RETRY_AFTER_COOLDOWN");
    expect(rateLimit.delayMs).toBe(60000);
    // Code 7: Server busy -> retry immediately
    expect(handleApplyResult({ code: 0, data: { applyResult: 7 } }).action).toBe("RETRY_IMMEDIATE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/xiaomi-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `xiaomi-api.ts` and `state-machine.ts`**

Implement HTTP request dispatcher using Bun's native `fetch` with proxy support, User-Agent formatting, cookie headers, and the pure state machine logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/xiaomi-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ backend/tests/xiaomi-api.test.ts
git commit -m "feat(backend): implement xiaomi api client and state machine"
```

---

### Task 3: Backend Auth, REST Endpoints & Real-time SSE Log Stream

**Files:**
- Create: `backend/src/api/auth.ts`
- Create: `backend/src/api/accounts.ts`
- Create: `backend/src/api/logs.ts`
- Create: `backend/src/index.ts`
- Test: `backend/tests/api.test.ts`

**Interfaces:**
- Consumes: Repositories from Task 1, Xiaomi API from Task 2
- Produces:
  - Elysia app running on `PORT` (default 3001)
  - `POST /api/auth/login`
  - `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/:id`, `DELETE /api/accounts/:id`, `POST /api/accounts/:id/test`
  - `GET /api/logs`, `GET /api/logs/stream` (SSE)

- [ ] **Step 1: Write integration test for Auth and Account API**

```typescript
// backend/tests/api.test.ts
import { describe, expect, it, beforeAll } from "bun:test";
import { createApp } from "../src/index";
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

    // Access protected route with token
    const accRes = await app.handle(
      new Request("http://localhost/api/accounts", {
        headers: { Authorization: `Bearer ${json.token}` },
      })
    );
    expect(accRes.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Elysia server routes, JWT auth guard, and SSE broadcaster**

Implement `createApp(db)` with CORS, JWT middleware, account CRUD endpoints, and SSE streaming route using Elysia's native generator/stream response.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/ backend/src/index.ts backend/tests/api.test.ts
git commit -m "feat(backend): implement elysia rest routes, jwt auth and sse"
```

---

### Task 4: High-Precision Scheduler & NTP Time Synchronization

**Files:**
- Create: `backend/src/services/ntp.ts`
- Create: `backend/src/services/scheduler.ts`
- Test: `backend/tests/scheduler.test.ts`

**Interfaces:**
- Consumes: `accountRepo`, `logRepo`, `xiaomi-api.ts`, `state-machine.ts`
- Produces:
  - `syncNtpOffset(): Promise<number>` (returns clock offset in ms)
  - `startScheduler(db: Database): { stop(): void, triggerManual(accountId: string): Promise<void> }`

- [ ] **Step 1: Write test for countdown calculation to 23:00 WIB and offset logic**

```typescript
// backend/tests/scheduler.test.ts
import { describe, expect, it } from "bun:test";
import { getNextTargetTimestamp, calculateSleepDuration } from "../src/services/scheduler";

describe("Scheduler Timing", () => {
  it("should calculate target timestamp for 23:00 WIB (16:00 UTC)", () => {
    // Fixed reference time: 2026-10-18 10:00:00 UTC (17:00 WIB)
    const now = new Date("2026-10-18T10:00:00Z").getTime();
    const target = getNextTargetTimestamp(now);
    const targetDate = new Date(target);

    expect(targetDate.getUTCHours()).toBe(16);
    expect(targetDate.getUTCMinutes()).toBe(0);
    expect(targetDate.getUTCSeconds()).toBe(0);
    expect(target > now).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test backend/tests/scheduler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement NTP sync client and scheduler execution lifecycle**

Implement UDP NTP client (or HTTP Date header fallback for containerized VPS), pre-warming trigger at T-10s, pre-check at T-5s, and concurrent T-0s apply with `AbortController` sibling cancellation.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test backend/tests/scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ntp.ts backend/src/services/scheduler.ts backend/tests/scheduler.test.ts
git commit -m "feat(backend): implement high-precision scheduler and ntp sync"
```

---

### Task 5: Frontend Scaffolding (Bun + React 19 + Vite + Tailwind CSS)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/index.css`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/hooks/useSSE.ts`

**Interfaces:**
- Consumes: Backend REST API & SSE endpoints
- Produces:
  - `apiClient`: Typed fetch wrapper with auto `Bearer <token>` attachment
  - `useAuth`: Hook providing `{ token, isAuthenticated, login(password), logout() }`
  - `useSSE`: Hook listening to `/api/logs/stream` and maintaining reactive log array

- [ ] **Step 1: Initialize Vite React app with Bun & configure Tailwind CSS**

Scaffold `frontend/` using Bun, configure Vite proxy / base URL env (`VITE_API_BASE_URL`), and install Tailwind CSS.

- [ ] **Step 2: Implement `api.ts`, `useAuth.ts`, and `useSSE.ts`**

Write standard typed client utilities for token persistence in `localStorage`, unified error handling, and auto-reconnecting `EventSource`.

- [ ] **Step 3: Run build check to verify frontend compiles**

Run: `cd frontend && bun run build`
Expected: PASS (builds `dist/` without type errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold react vite app with tailwind and api hooks"
```

---

### Task 6: Dashboard UI (Auth, Accounts, Countdown & Live Log Terminal)

**Files:**
- Create: `frontend/src/components/LoginModal.tsx`
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/AccountCard.tsx`
- Create: `frontend/src/components/AccountModal.tsx`
- Create: `frontend/src/components/LogTerminal.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Hooks from Task 5 (`useAuth`, `useSSE`)
- Produces: Full interactive responsive Single Page Application

- [ ] **Step 1: Implement LoginModal & Header**

Build minimal password prompt, server time display, connection status badge, and live countdown timer to 23:00 WIB.

- [ ] **Step 2: Implement AccountCard & AccountModal**

Build card view with status indicators (Cookie Valid/Expired, Last Quota Result), toggle switch for Auto-Apply, Test Connection button, and add/edit modal including optional `proxyUrl`.

- [ ] **Step 3: Implement LogTerminal**

Build terminal-style log viewer with auto-scroll, clear button, and color-coded tags based on `resultCode` (Green = 1, Yellow = 5/6/7, Red = 2/3/4).

- [ ] **Step 4: Integrate into `App.tsx` and run build**

Run: `cd frontend && bun run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ frontend/src/App.tsx
git commit -m "feat(frontend): implement dashboard ui, account cards and log console"
```

---

### Task 7: Production Configuration, Vercel SPA Setup & VPS Daemon Config

**Files:**
- Create: `vercel.json`
- Create: `backend/.env.example`
- Create: `backend/openmi.service` (Systemd unit template)
- Modify: `README.md`

**Interfaces:**
- Consumes: All backend and frontend artifacts
- Produces: Deployment-ready configurations

- [ ] **Step 1: Create `vercel.json` with SPA rewrite rules**

```json
{
  "buildCommand": "cd frontend && bun install && bun run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Create `backend/.env.example` and `backend/openmi.service`**

Document all required environment variables (`MASTER_PASSWORD`, `JWT_SECRET`, `PORT`, `DATA_DIR`) and Linux systemd service template for 24/7 background execution.

- [ ] **Step 3: Run full monorepo build check**

Run:
1. `cd backend && bun test`
2. `cd frontend && bun run build`
Expected: All tests PASS, frontend builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add vercel.json backend/.env.example backend/openmi.service README.md
git commit -m "chore: add vercel and systemd production deployment configs"
```
