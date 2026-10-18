# OpenMi — Full-Stack Design Specification

**Date:** 2026-10-18  
**Author:** AI Agent & bagoe  
**Status:** Approved by User  

---

## 1. Intent & Context

Xiaomi devices require an official bootloader unlock permission issued through the Xiaomi Community application. Quotas are extremely limited and reset daily at **00:00:00 GMT+8 (Beijing Time)**, which corresponds exactly to **23:00:00 WIB (GMT+7)** as confirmed by decompiled APK resource strings (`Application quota limit reached,please try again after %1$s (mm/dd) %2$s (GMT+8)`). Applying manually via the official mobile app UI during high traffic frequently encounters UI lag, network timeouts, and immediate quota exhaustion.

**OpenMi** is a personal multi-account management and automation platform designed to reliably monitor, test, and apply for Xiaomi bootloader unlock tokens via direct Xiaomi Community API integration.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Provide a clean, modern web dashboard (deployed to Vercel) to manage multiple Xiaomi accounts and monitor real-time application logs.
- Provide a dedicated, high-performance backend service (deployed to VPS) that handles time synchronization, background scheduling, socket pre-warming, and concurrent API requests.
- Secure backend API access with single-tenant JWT authentication backed by a `MASTER_PASSWORD` set in VPS `.env`.
- Use native `bun:sqlite` for persistent, zero-dependency data storage in the VPS.
- Implement robust handling of all 7 decompiled Xiaomi `applyResult` response codes.

### Non-Goals
- Multi-tenant SaaS with public user registration or user management (OpenMi is personal single-tenant tooling).
- Bypassing Xiaomi server-side account qualifications (e.g. account age requirements, regional restrictions, or server-side bans).
- Automated SMS/CAPTCHA bypass for login (session cookies are captured manually or via HTTP proxy and saved in OpenMi).

### Anti-Goals
- Do not flood/DDoS Xiaomi servers. Requests must be controlled, minimal, burst-timed within a strict few-second window, and respect rate-limiting cooldowns (`applyResult = 6`).
- Do not introduce bloated dependencies or external database servers (Postgres/MySQL) when `bun:sqlite` fulfills the storage requirement.

---

## 3. Architecture & Tech Stack

### 3.1 Technology Stack
- **Runtime**: [Bun](https://bun.sh) (v1.x+)
- **Backend (VPS)**:
  - Framework: [ElysiaJS](https://elysiajs.com)
  - Database: Native `bun:sqlite`
  - Authentication: `@elysiajs/jwt` + `MASTER_PASSWORD`
  - Real-Time Communication: Server-Sent Events (SSE) for live log streaming to dashboard
  - Network & Timing: HTTP/1.1 & HTTP/2 connection pooling via Bun native `fetch`, NTP clock offset calibration
- **Frontend (Vercel)**:
  - Framework: React 19 + Vite (powered by Bun)
  - Styling: Tailwind CSS
  - State/Data Fetching: React Query / SWR or lightweight reactive store, native SSE reader
- **Deployment Strategy**:
  - Backend: Linux VPS (Systemd service or Docker/Bun standalone)
  - Frontend: Vercel static/SPA deployment with `VITE_API_BASE_URL` pointing to the VPS backend

---

## 4. System Components & Flow

### 4.1 Backend Engine (`backend/`)
1. **Auth Service**:
   - `POST /api/auth/login`: Receives `{ password }`. Verifies against `process.env.MASTER_PASSWORD`. Issues a signed JWT token.
   - JWT middleware validates `Authorization: Bearer <token>` on all `/api/*` endpoints (and `?token=` for SSE).
2. **Account Management**:
   - `GET /api/accounts`: List all configured accounts with status summary.
   - `POST /api/accounts`: Create account (`label`, `region`, `cUserId`, `serviceToken`, `deviceId`).
   - `PUT /api/accounts/:id`: Update account credentials or toggle scheduler state (`enabled: boolean`).
   - `DELETE /api/accounts/:id`: Remove account.
   - `POST /api/accounts/:id/test`: Verify cookie validity by invoking `GET {region}/user/bl-switch/state`.
3. **Execution & Scheduler Engine**:
   - Background worker monitors clock drift against NTP (pool.ntp.org).
   - At target T-10s (22:59:50 WIB): Performs TLS socket pre-warming to `https://new.c.mi.com/{region}/`.
   - At target T-5s: Runs quick pre-check `GET user/bl-switch/state`.
   - At target T-0s (23:00:00 WIB): Dispatches concurrent `POST apply/bl-auth` requests (`is_retry: false`).
   - Handles result codes according to state machine (e.g. automatic retry with `is_retry: true` for code 5 & 7).
4. **Log & SSE Streaming**:
   - Every event (milisecond timestamp, level, account ID, action, status, response code) is written to `execution_logs` in SQLite.
   - `GET /api/logs/stream`: SSE stream broadcasting events in real time to connected dashboard clients.

### 4.2 Database Schema (`bun:sqlite`)
```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'global',
  c_user_id TEXT NOT NULL,
  service_token TEXT NOT NULL,
  device_id TEXT,
  proxy_url TEXT, -- Optional HTTP/SOCKS5 proxy per account
  session_valid BOOLEAN DEFAULT 1,
  last_button_state INTEGER,
  last_apply_result INTEGER,
  auto_apply_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  timestamp INTEGER NOT NULL, -- Unix ms
  action TEXT NOT NULL,       -- 'CHECK_STATE', 'APPLY', 'RETRY'
  result_code INTEGER,        -- applyResult code (1-7) or HTTP status
  message TEXT,
  raw_payload TEXT,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

### 4.3 Frontend Dashboard (`frontend/`)
- **Login Screen**: Minimalist, clean card prompt for Master Password. Stores JWT in browser storage.
- **Header**: Live NTP / Server Clock synchronized with VPS backend, connection health badge, Countdown to 23:00 WIB.
- **Account Management View**:
  - Account cards showing: Label, Region, Cookie Status (Verified / Expired), Button State, Last Apply Result, Auto-Apply Switch.
  - Modal / Drawer to Add or Edit Accounts.
  - Action buttons: "Test Connection", "Dry-Run Check", "Trigger Now".
- **Real-Time Log Console**: Terminal-styled live event stream window with color-coded log entries (Green = Success 1, Yellow = Retry/Rate-limit 5/6/7, Red = Cooldown/Error 2/3/4).

---

## 5. Xiaomi API State Machine Reference

Based on decompiled `BootloaderActivity.java` and `vc.i`:
- **Base URL**: `https://new.c.mi.com/{region}/` (typically `global` or `id`)
- **Headers**:
  - `Cookie: cUserId=<id>; serviceToken=<token>`
  - `User-Agent: Mozilla/5.0 ... XiaoMi/MiuiBrowser/4.3`
- **Result Codes**:
  - `1`: Quota successfully obtained (`passResult`) -> Stop, trigger notification.
  - `2`: Limit reached for this month / device cooldown -> Stop.
  - `3`: Daily quota exhausted -> Stop for tonight.
  - `4`: Verification error / cooldown -> Stop.
  - `5`: Transient failure -> Immediate retry with `{"is_retry": true}`.
  - `6`: Rate limited (frequency limit) -> Wait 60s cooldown, then retry.
  - `7`: Temporary server issue -> Immediate retry with `{"is_retry": true}`.

---

## 6. Development & Commit Standards

- **Runtime**: Bun across both backend and frontend.
- **Code Style**: TypeScript with strict mode, clean modular architecture.
- **Commits**: Conventional Commits specification strictly enforced:
  - `feat: ...` for new capabilities
  - `fix: ...` for bug fixes
  - `docs: ...` for documentation updates
  - `refactor: ...` for structural cleanup
  - `chore: ...` for tooling and maintenance
