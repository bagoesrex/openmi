# High-Precision Spread-Burst Execution Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OpenMi's execution mechanism from a single zero-hour request to a high-speed spread-burst wave (Asia Profile: `58.8s`, `59.1s`, `59.3s`, `59.5s`, `59.7s`, `59.9s`), rotating randomized `deviceId`s, sending pre-baked `{"is_retry": true}` payloads, and early-aborting on first pass approval.

**Architecture:** The scheduler pre-warms connections at T-15s and schedules an array of millisecond-offset timers leading up to 23:00:00 WIB (00:00:00 GMT+8). Each shot sends an independent HTTP request with a unique 40-character `deviceId` and enriched cookie headers. On approval (`code: 0` / `applyResult: 1`), remaining wave timers and in-flight requests abort immediately.

**Tech Stack:** Bun v1.4+, `bun:sqlite`, ElysiaJS, React 19, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-09-burst-execution-engine.md`

## Global Constraints
- 100% Bun native runtime with zero Node.js runtime dependencies.
- Asia Timing profile defaults to: `[58.8, 59.1, 59.3, 59.5, 59.7, 59.9]`.
- Every shot in the burst wave must have a unique random 40-character uppercase hexadecimal `deviceId`.
- Headers must include `versionCode=500440; versionName=5.4.40; deviceId={deviceId};` alongside `cUserId`, `serviceToken`, and `new_bbs_serviceToken`.
- Payload body must be `{"is_retry": true}`.
- Early exit: first successful shot stops the rest of the burst immediately.

## Review Focus
- High timer density: verifying 6 concurrent timers fire at distinct millisecond offsets without blocking the Bun event loop.
- AbortController cancellation: verifying pending fetch requests are properly interrupted when the winning shot finishes.
- Device ID collision avoidance: verifying generated 40-char SHA1 hex strings are strictly unique per shot.
- Backwards compatibility: existing accounts without `timing_mode` default smoothly to `'asia'`.
- Fallback handling when network is severed mid-burst.

---

### Task 1: Client & Timing Profile Utilities (Backend)

**Files:**
- Modify: `backend/src/services/xiaomi/client.ts`
- Create: `backend/src/services/xiaomi/burst.ts`
- Test: `backend/tests/burst.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const TIMING_PROFILES = {
    asia: [58.8, 59.1, 59.3, 59.5, 59.7, 59.9],
    europe: [58.7, 58.8, 59.1, 59.3, 59.5, 59.8],
    single: [60.0],
  } as const;

  export type TimingMode = "asia" | "europe" | "single" | "custom";

  export function generateDeviceId(): string;
  export function resolveTimings(mode?: TimingMode, custom?: string | number[] | null): number[];
  export function formatBurstHeaders(cUserId: string, serviceToken: string, deviceId: string): Record<string, string>;
  ```

- [ ] **Step 1: Write failing unit test for `burst.ts`**

```ts
// backend/tests/burst.test.ts
import { describe, expect, it } from "bun:test";
import { generateDeviceId, resolveTimings, formatBurstHeaders, TIMING_PROFILES } from "../src/services/xiaomi/burst";

describe("Burst Timing & Client Mechanics", () => {
  it("generates unique 40-character uppercase hex device IDs", () => {
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).toHaveLength(40);
    expect(id2).toHaveLength(40);
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9A-F]{40}$/);
  });

  it("resolves default Asia timing profile offsets", () => {
    const timings = resolveTimings("asia");
    expect(timings).toEqual([58.8, 59.1, 59.3, 59.5, 59.7, 59.9]);
  });

  it("formats enriched Cookie headers with deviceId and app versions", () => {
    const headers = formatBurstHeaders("12345", "token_abc", "DEV_ID_XYZ");
    expect(headers["Cookie"]).toContain("cUserId=12345");
    expect(headers["Cookie"]).toContain("deviceId=DEV_ID_XYZ");
    expect(headers["Cookie"]).toContain("versionCode=500440");
    expect(headers["Cookie"]).toContain("versionName=5.4.40");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/burst.test.ts`
Expected: FAIL with "Cannot find module '../src/services/xiaomi/burst'"

- [ ] **Step 3: Implement `burst.ts` and integrate with `client.ts`**

Implement `generateDeviceId` using `crypto.randomBytes(20).toString("hex").toUpperCase()`.
Implement `resolveTimings` and `formatBurstHeaders`.
In `client.ts`, add `deviceId` support to `applyBlAuth`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/burst.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/xiaomi/burst.ts backend/src/services/xiaomi/client.ts backend/tests/burst.test.ts
git commit -m "feat(backend): implement burst timing profiles and device id rotation"
```

---

### Task 2: Database Schema & Account Domain (Backend)

**Files:**
- Modify: `backend/src/domain/account.ts`
- Modify: `backend/src/db/client.ts`
- Modify: `backend/src/db/repository.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Produces:
  - Account model fields: `timingMode: TimingMode`, `customTimings: string | null`
  - Repo methods support creating and updating `timingMode` and `customTimings`.

- [ ] **Step 1: Write failing test in `backend/tests/db.test.ts`**

```ts
it("supports timingMode and customTimings persistence", () => {
  const acc = repo.create({
    label: "Burst Account",
    cUserId: "112233",
    serviceToken: "tok",
    timingMode: "asia",
    customTimings: "[58.8, 59.1]",
  });
  expect(acc.timingMode).toBe("asia");
  expect(acc.customTimings).toBe("[58.8, 59.1]");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/db.test.ts`
Expected: FAIL

- [ ] **Step 3: Update SQLite schema in `client.ts` and repository in `repository.ts`**

Add `timing_mode TEXT DEFAULT 'asia'` and `custom_timings TEXT` to table schema and prepared queries.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/account.ts backend/src/db/client.ts backend/src/db/repository.ts backend/tests/db.test.ts
git commit -m "feat(db): add timing_mode and custom_timings to account repository"
```

---

### Task 3: Spread-Burst Wave Scheduler Engine (Backend)

**Files:**
- Modify: `backend/src/services/scheduler.ts`
- Test: `backend/tests/scheduler.test.ts`

**Interfaces:**
- Produces:
  - `executeAccountBurst(account: Account, targetBeijingTime: number): Promise<void>`
  - Dispatches micro-offset timers per timing slot.
  - Aborts subsequent shots upon `applyResult: 1` or `code: 0`.

- [ ] **Step 1: Write failing unit test in `backend/tests/scheduler.test.ts`**

Verify burst dispatch calculates accurate millisecond delay offsets for the Asia profile.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/scheduler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `executeAccountBurst` in `backend/src/services/scheduler.ts`**

Schedule micro-offset timeouts at `sendAt = baseMinute + tVal * 1000`.
Each shot uses `generateDeviceId()`, `is_retry: true`, logs `[Burst #X @ SS.mmm]`, and triggers `abortController.abort()` if any shot succeeds.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/scheduler.ts backend/tests/scheduler.test.ts
git commit -m "feat(scheduler): implement spread-burst wave dispatch engine"
```

---

### Task 4: REST API & Burst Dry-Run Endpoints (Backend)

**Files:**
- Modify: `backend/src/api/accounts.ts`
- Test: `backend/tests/api.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/accounts/:id/test-burst`: Executes a quick dry-run burst (3 fast test checks) to verify connectivity and timings.
  - Accounts CRUD handles `timingMode` and `customTimings`.

- [ ] **Step 1: Write failing test in `backend/tests/api.test.ts`**

Verify creating account with `timingMode: 'asia'` and calling `POST /api/accounts/:id/test-burst` returns 200.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Register burst route and fields in `backend/src/api/accounts.ts`**

Add schema validation and route handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/accounts.ts backend/tests/api.test.ts
git commit -m "feat(api): support timing profiles and dry-run burst test endpoint"
```

---

### Task 5: Frontend UI Upgrades (Dashboard & Modal)

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/AccountModal.tsx`
- Modify: `frontend/src/components/AccountCard.tsx`

**Interfaces:**
- Produces:
  - Timing profile selector dropdown in `AccountModal.tsx`:
    - `⚡ Asia Burst (58.8s - 59.9s) [Recommended]`
    - `🌍 Europe Burst (58.7s - 59.8s)`
    - `🎯 Single Shot (23:00:00 exact)`
  - Timing profile badge on `AccountCard.tsx`.
  - "Test Burst" action button on card.

- [ ] **Step 1: Update frontend types, API methods, and components**

Add `timingMode` and `customTimings` to `Account` and `NewAccountInput`.
Add `testAccountBurst(id)` in `api.ts`.
Add UI controls in `AccountModal.tsx` and `AccountCard.tsx`.

- [ ] **Step 2: Build frontend to verify compilation**

Run: `bun run build` in `frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts frontend/src/components/AccountModal.tsx frontend/src/components/AccountCard.tsx
git commit -m "feat(ui): add execution timing profile controls and burst status badges"
```

---

### Task 6: End-to-End Verification

**Files:**
- Modify: `backend/scripts/run-e2e.ts`
- Test: `bun run test:e2e` in `backend/`

- [ ] **Step 1: Add E2E scenario in `run-e2e.ts` testing Asia Burst profile badge and Test Burst**

- [ ] **Step 2: Run full automated E2E test suite**

Run: `bun run test:e2e` in `backend/`
Expected: 15/15 PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/run-e2e.ts
git commit -m "test(e2e): verify burst timing configuration and execution workflow"
```
