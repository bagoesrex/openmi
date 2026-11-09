# Xiaomi QR Code Login Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a browserless, one-click Xiaomi QR Code authentication system in OpenMi that allows users to register and refresh Xiaomi accounts directly by scanning a QR code from their mobile phone.

**Architecture:** A backend service in Bun communicates with Xiaomi's official SSO long-polling endpoints (`account.xiaomi.com`) to generate QR sessions and poll scan confirmation. When approved on mobile, the backend signs the authorization nonce via HMAC-SHA1, exchanges it for `serviceToken` / `cUserId`, and delivers the credentials to the React dashboard via a dedicated tab in `AccountModal`.

**Tech Stack:** Bun v1.4+, ElysiaJS, native `fetch` & `crypto`, React 19, Vite, Tailwind CSS v4.

**Spec:** `docs/miunlocktool-analysis.md` (Section 2.1 & Section 4)

## Global Constraints

- 100% Bun native runtime with zero Node.js dependencies.
- Single-tenant security: all QR endpoints must be protected by `@elysiajs/jwt` master password verification.
- Mobile and desktop responsive: QR viewer must fit within modal bounds on mobile screens (<400px width).
- Robust session cleanup: expired or abandoned QR sessions must be garbage collected in memory after their TTL (300 seconds).

## Review Focus

- Xiaomi long-polling response formatting (handling `&&&START&&&` prefix).
- HMAC-SHA1 signature formatting for SSO callback (`clientSign = quote(base64(sha1(nonce=...&ssec)))`).
- Token extraction from HTTP redirect Set-Cookie headers (`serviceToken` vs `new_bbs_serviceToken`).
- Fallback handling when user cancels on phone or QR ticket expires.
- Concurrency safety when multiple QR sessions are polled simultaneously.

---

### Task 1: Xiaomi QR Service Engine (Backend)

**Files:**
- Create: `backend/src/services/xiaomi/qr-auth.ts`
- Test: `backend/tests/qr-auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
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

  export class QrAuthService {
    createSession(): Promise<QrSession>;
    pollSession(sessionId: string): Promise<QrPollResult>;
  }
  ```

- [ ] **Step 1: Write the failing unit test for `QrAuthService`**

```ts
// backend/tests/qr-auth.test.ts
import { describe, expect, it } from "bun:test";
import { QrAuthService } from "../src/services/xiaomi/qr-auth";

describe("QrAuthService", () => {
  it("creates a valid QR session with Xiaomi URLs", async () => {
    const service = new QrAuthService();
    const session = await service.createSession();
    expect(session.sessionId).toBeDefined();
    expect(session.qrUrl).toContain("account.xiaomi.com/pass/qr/login");
    expect(session.lpUrl).toContain("/lp/");
    expect(session.timeout).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/qr-auth.test.ts`
Expected: FAIL with "Cannot find module '../src/services/xiaomi/qr-auth'"

- [ ] **Step 3: Implement `QrAuthService` in `backend/src/services/xiaomi/qr-auth.ts`**

Implement `createSession()` and `pollSession(sessionId)` using native `fetch` and `crypto.createHash("sha1")`. Strip `&&&START&&&` prefix from responses, calculate HMAC-SHA1 signature for final URL redirection, and parse `Set-Cookie` headers for `serviceToken` and `cUserId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/qr-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/xiaomi/qr-auth.ts backend/tests/qr-auth.test.ts
git commit -m "feat(backend): implement xiaomi qr code sso auth service"
```

---

### Task 2: REST API Routes for QR Session Management

**Files:**
- Modify: `backend/src/api/accounts.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/api.test.ts`

**Interfaces:**
- Consumes: `QrAuthService` from `backend/src/services/xiaomi/qr-auth.ts`
- Produces:
  - `POST /api/accounts/qr/session` -> `{ sessionId, qrUrl, timeout }`
  - `GET /api/accounts/qr/session/:sessionId/status` -> `{ status, cUserId, serviceToken, error }`

- [ ] **Step 1: Write the failing test for QR endpoints**

```ts
// in backend/tests/api.test.ts
it("POST /api/accounts/qr/session returns a new session for authenticated client", async () => {
  const res = await app.handle(
    new Request("http://localhost/api/accounts/qr/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` }
    })
  );
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.sessionId).toBeDefined();
  expect(data.qrUrl).toContain("account.xiaomi.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/api.test.ts`
Expected: FAIL with 404 or route not found.

- [ ] **Step 3: Register QR routes in `backend/src/api/accounts.ts`**

Bind the `POST /qr/session` and `GET /qr/session/:sessionId/status` endpoints inside the authenticated accounts router.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/accounts.ts backend/tests/api.test.ts
git commit -m "feat(api): expose authenticated qr session and status polling routes"
```

---

### Task 3: Frontend API Client & Types for QR Login

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface QrSessionResponse {
    sessionId: string;
    qrUrl: string;
    timeout: number;
  }

  export interface QrStatusResponse {
    status: "WAITING" | "SCANNED" | "SUCCESS" | "EXPIRED" | "ERROR";
    cUserId?: string;
    serviceToken?: string;
    error?: string;
  }

  export function createQrSession(): Promise<QrSessionResponse>;
  export function checkQrStatus(sessionId: string): Promise<QrStatusResponse>;
  ```

- [ ] **Step 1: Add types and API wrapper functions in `frontend/src/types/index.ts` and `frontend/src/lib/api.ts`**

- [ ] **Step 2: Verify TypeScript compilation**

Run: `bun run build` in `frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/lib/api.ts
git commit -m "feat(frontend): add qr session types and api client methods"
```

---

### Task 4: UI Integration in `AccountModal.tsx`

**Files:**
- Modify: `frontend/src/components/AccountModal.tsx`

**Interfaces:**
- Consumes: `createQrSession`, `checkQrStatus` from `frontend/src/lib/api.ts`
- Renders:
  - Tab Switcher: "Scan QR Login" (Default for new accounts) | "Manual Input".
  - Interactive QR Card with live status badges (Waiting, Scanned, Approved).
  - Auto-fill `cUserId` and `serviceToken` on scan approval.

- [ ] **Step 1: Update `AccountModal.tsx` to include QR Scanner Tab**

Implement clean tab navigation, auto-polling on mount, image display with loading spinner, and seamless handoff of `cUserId` and `serviceToken` into the save form.

- [ ] **Step 2: Build frontend to verify zero type errors or bundle issues**

Run: `bun run build` in `frontend/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AccountModal.tsx
git commit -m "feat(ui): add qr code scanner tab and auto-fill in account modal"
```

---

### Task 5: End-to-End Verification & Automated Test Suite

**Files:**
- Modify: `backend/scripts/run-e2e.ts`
- Test: `bun run test:e2e` in `backend/`

- [ ] **Step 1: Add E2E scenario in `run-e2e.ts` verifying QR Tab renders in Modal**

Check that opening "Register Xiaomi Account" modal displays the "Scan QR Login" tab and renders the live QR image from Xiaomi.

- [ ] **Step 2: Run full E2E test suite**

Run: `bun run test:e2e` in `backend/`
Expected: 13/13 scenarios PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/run-e2e.ts
git commit -m "test(e2e): add automated test coverage for qr login modal tab"
```
