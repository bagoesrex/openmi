# Full-Stack Feature Verification & Permanent Log Clear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement permanent log clearing in SQLite and execute a complete end-to-end automated test suite testing all dashboard and API features directly in a live browser.

**Architecture:** 
1. Add `clearAll()` method to `LogRepository` and expose `DELETE /api/logs` in Elysia backend.
2. Update frontend `useSSE` and `api.ts` to call `DELETE /api/logs` so cleared logs do not reappear on refresh.
3. Build a Playwright-driven automated test runner that opens the real dashboard in a browser, tests every user action (Login, Account CRUD, Live Cookie Test, SSE Sync badge, Log Terminal auto-scroll, and Clear Logs), and validates database state.

**Tech Stack:** Bun v1.4+, ElysiaJS, `bun:sqlite`, Playwright, React 19, Vite, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-10-18-openmi-design.md`

## Global Constraints
- 100% Bun ecosystem native — zero Node.js runtime dependencies.
- Conventional commits required for every milestone.
- All tests must pass before marking tasks as complete.

## Review Focus
1. `DELETE /api/logs` must be protected by `verifyAuth` (no unauthenticated truncation).
2. Clearing logs must immediately update both server database and local React state.
3. Page refresh (F5) after clearing logs must return an empty log list.
4. Live SSE connection badge must display "Live Sync" in green when connected and "Disconnected" in rose when closed.
5. All account CRUD and Xiaomi live verification flows must work without console errors.

---

### Task 1: Permanent SQLite Log Clearing Backend & Frontend Wire-up

**Files:**
- Modify: `backend/src/db/repository.ts`
- Modify: `backend/src/api/logs.ts`
- Modify: `backend/tests/api.test.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/useSSE.ts`

**Interfaces:**
- Produces: `logRepo.clearAll(): void`
- Produces: `DELETE /api/logs` -> `{ success: true, count: number }`
- Produces: `clearAllLogs(): Promise<void>` in `frontend/src/lib/api.ts`

- [ ] **Step 1: Write unit test for `clearAll()` and `DELETE /api/logs` in `backend/tests/api.test.ts`**

```ts
it("should truncate all logs via DELETE /api/logs", async () => {
  const token = await getAuthToken();
  // Insert dummy log
  logRepo.insert({
    timestamp: Date.now(),
    action: "CHECK_STATE",
    resultCode: 0,
    message: "Test log before clear",
  });
  expect(logRepo.getRecent().length).toBeGreaterThan(0);

  const res = await app.handle(
    new Request("http://localhost/api/logs", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  expect(res.status).toBe(200);
  expect(logRepo.getRecent().length).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL with route not found or method not allowed.

- [ ] **Step 3: Implement `clearAll()` in `backend/src/db/repository.ts` and `DELETE /api/logs` in `backend/src/api/logs.ts`**

In `backend/src/db/repository.ts`:
```ts
export interface LogRepository {
  // ...
  clearAll(): void;
}

// In createLogRepo:
const deleteAllStmt = db.prepare("DELETE FROM execution_logs");
// return:
clearAll(): void {
  deleteAllStmt.run();
}
```

In `backend/src/api/logs.ts`:
```ts
.delete("/api/logs", () => {
  logRepo.clearAll();
  return { success: true };
})
```

- [ ] **Step 4: Update frontend `frontend/src/lib/api.ts` and `frontend/src/hooks/useSSE.ts`**

In `frontend/src/lib/api.ts`:
```ts
export async function clearAllLogs(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear logs");
}
```

In `frontend/src/hooks/useSSE.ts`:
```ts
const clearLogs = async () => {
  try {
    await clearAllLogs();
  } catch (err) {
    console.error("Failed to clear logs on server:", err);
  } finally {
    setLogs([]);
  }
};
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `bun test` in `backend`
Expected: PASS with 11+ passing tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/repository.ts backend/src/api/logs.ts backend/tests/api.test.ts frontend/src/lib/api.ts frontend/src/hooks/useSSE.ts
git commit -m "fix(logs): add permanent log clearing in sqlite and wire up to frontend terminal"
```

---

### Task 2: Build Automated End-to-End Test Suite for All Features

**Files:**
- Create: `backend/tests/e2e-dashboard.spec.ts`

**Interfaces:**
- Exercises: Live Frontend at `http://localhost:3000`
- Exercises: Live Backend at `http://localhost:3001`
- Verifies:
  1. Login with incorrect password fails with error alert.
  2. Login with correct password ("kucink") succeeds and stores token.
  3. Header displays live 23:00 WIB countdown and "Live Sync" badge.
  4. Account list displays existing account ("Red") with "Valid" badge.
  5. Clicking "Test Cookie" makes request and produces fresh log in terminal via SSE.
  6. Creating a new test account appears in UI and SQLite.
  7. Editing and deleting the test account removes it cleanly.
  8. Clicking "Clear" in log monitor empties the terminal, and after page reload (F5) logs remain 0.

- [ ] **Step 1: Write `backend/tests/e2e-dashboard.spec.ts` using Playwright**

```ts
import { test, expect, chromium } from "@playwright/test";

// Suite covering all 8 full-stack capabilities
```

- [ ] **Step 2: Run the automated E2E test suite**

Run: `bun scripts/run-e2e.ts` (or `bun x playwright test`)
Expected: All tests pass with browser screenshots/assertions verifying every action.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/e2e-dashboard.spec.ts backend/package.json
git commit -m "test(e2e): add comprehensive full-stack dashboard and api test suite"
```

---

### Task 3: Execute Live E2E Verification & Document Checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-10-18-feature-tests-and-log-clear.md`

- [ ] **Step 1: Execute full test runner and capture output**
- [ ] **Step 2: Verify in real browser window that clicking "Clear" permanently clears logs upon F5 refresh**
- [ ] **Step 3: Provide report and user verification steps**
