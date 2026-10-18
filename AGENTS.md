# AGENTS.md — OpenMi Engineering Guide

Welcome to **OpenMi**. This document is the primary operational instruction manual for AI coding agents and developers working on this codebase.

---

## 1. Project Overview & Scope

**OpenMi** is a personal multi-account management and automation platform designed to reliably monitor, test, and apply for Xiaomi bootloader unlock tokens via direct Xiaomi Community API integration.

### Core Problem & Solution
- **The Problem**: Xiaomi releases official bootloader unlock quotas once daily. Quotas deplete in seconds. Applying via the mobile app UI encounters heavy lag and network timeouts.
- **The Solution**: A headless, high-precision VPS backend (ElysiaJS + Bun) that executes scheduled, pre-warmed requests at the exact second of quota reset, controlled via a modern web dashboard (React + Vite on Vercel).

---

## 2. Architecture & Tech Stack

```
openmi/
├── backend/                  # ElysiaJS API server (VPS deployment)
│   ├── src/
│   │   ├── api/              # REST routes (auth, accounts, logs, actions)
│   │   ├── db/               # bun:sqlite schema, migrations, queries
│   │   ├── services/         # Xiaomi API client, state machine, scheduler
│   │   └── index.ts          # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React + Vite dashboard (Vercel deployment)
│   ├── src/
│   │   ├── components/       # UI cards, modals, terminal log viewer
│   │   ├── hooks/            # useAuth, useSSE, useAccounts
│   │   ├── lib/              # API client, time sync utilities
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/                     # Documentation & specifications
│   ├── api-spec.md           # Xiaomi API reference
│   ├── auth-guide.md         # Cookie extraction guide
│   └── superpowers/specs/    # System design specifications
└── reverse-engineering/      # Decompiled APK analysis & raw endpoint logs
```

### Technology Standards
- **Runtime**: Pure [Bun](https://bun.sh) ecosystem (v1.x+) — 100% Bun native. Zero Node.js runtime dependencies:
  - Database: `bun:sqlite`
  - Testing: `bun:test`
  - Package manager & Scripts: `bun install`, `bun run`, `bun test`, `bun build`
  - HTTP Server & Client: Native Bun `fetch` with proxy support, native WebSockets / SSE
- **Backend (VPS)**:
  - Framework: [ElysiaJS](https://elysiajs.com) (native Bun web framework)
  - Database: Native `bun:sqlite` with prepared statements
  - Authentication: `@elysiajs/jwt` with `MASTER_PASSWORD` stored in `.env`
  - Real-time: Server-Sent Events (SSE) for log streaming to the dashboard
  - Proxy Support: Optional HTTP/SOCKS5 proxy per account for outbound requests
  - **Diagnostic Error Logging**: Every error MUST be logged with structured metadata (timestamp ms, account ID, action, HTTP status, Xiaomi error code, raw response body, stack trace, and human-readable diagnostic explanation suitable for AI troubleshooting).
- **Frontend (Vercel)**:
  - Framework: React 19 + Vite (built with Bun)
  - Styling: Tailwind CSS
  - Communication: Fetch API with Bearer JWT + EventSource (SSE)
- **Deployment Targets**:
  - Backend: Linux VPS (Systemd service or Docker/Bun standalone)
  - Frontend: Vercel SPA (`VITE_API_BASE_URL` pointing to the VPS backend)

---

## 3. Verified Xiaomi API Mechanics

### Quota Timing Verification (Evidence-Based)
The quota reset time is **00:00:00 GMT+8 (Beijing Time)**, which is exactly **23:00:00 WIB (GMT+7)**.
*Proof*: Decompiled APK string resource `str_bl_limit_reached_tips` contains:
> `"Application quota limit reached,please try again after %1$s (mm/dd) %2$s (GMT+8)"`

### Endpoints
- **Base URL**: `https://new.c.mi.com/{region}/` (default `global`, or `id`)
- `GET bl-switch/value`: Global feature toggle check
- `GET user/bl-switch/state`: Checks user eligibility, button state, and unlock pass status
- `POST apply/bl-auth`: Applies for unlock authorization. Payload: `{"is_retry": false}` on first attempt, `{"is_retry": true}` on retry.

### Headers Required
- `Cookie: cUserId=<id>; serviceToken=<token>`
- `User-Agent: Mozilla/5.0 ... XiaoMi/MiuiBrowser/4.3` (suffix required)
- `Content-Type: application/json`

### Result Codes (`applyResult`)
- `1`: **Success** (`passResult`) — Stop, record success.
- `2`: **Monthly limit / Device cooldown** — Stop.
- `3`: **Daily quota exhausted** — Stop for tonight.
- `4`: **Verification cooldown** — Stop.
- `5`: **Transient failure** — Immediate retry with `{"is_retry": true}`.
- `6`: **Rate limit** — Cooldown for 60 seconds, then retry once.
- `7`: **Server busy** — Immediate retry with `{"is_retry": true}`.

---

## 4. Execution Timing Strategy

The VPS backend execution engine follows this timing lifecycle:
1. **Continuous**: Periodic NTP synchronization (`pool.ntp.org`) to calibrate local system clock drift to ±10ms.
2. **T-10s (22:59:50 WIB)**: Pre-warm TLS connection (open socket to `new.c.mi.com`) to eliminate DNS + TLS handshake latency at zero-hour.
3. **T-5s (22:59:55 WIB)**: Pre-check `GET user/bl-switch/state` to confirm session validity.
4. **T-0s (23:00:00.000 WIB)**: Fire primary `POST apply/bl-auth` (`is_retry: false`).
5. **T+0s to T+3s**: State machine handles response. If code 5 or 7, fire retry (`is_retry: true`). If code 1, 2, 3, or 4, conclude execution immediately.

---

## 5. Coding & Workflow Standards

### Conventional Commits
All commits in this repository MUST follow the Conventional Commits specification:
- `feat: <description>` — New feature (e.g., `feat: implement bun:sqlite account repository`)
- `fix: <description>` — Bug fix (e.g., `fix: correct timezone calculation for GMT+8 quota reset`)
- `docs: <description>` — Documentation only (e.g., `docs: add AGENTS.md`)
- `refactor: <description>` — Code change that neither fixes a bug nor adds a feature
- `test: <description>` — Adding or updating tests
- `chore: <description>` — Build process, dependency updates, or tool configurations

*Rule*: Commit frequently after completing each self-contained logical unit or milestone.

### Ponytail Principles (Senior Pragmatism)
- Write the minimum code needed to solve the problem completely.
- Avoid premature abstractions, heavy external libraries, or unrequested features.
- Never cut: validation at trust boundaries, error handling, security, or precision timing logic.
- Non-trivial logic must have corresponding unit tests or self-checks.

### Best Practices for Bun & Elysia
- Use `bun --watch` for development mode.
- Use native `bun:sqlite` with prepared statements (`db.prepare(...)`) for optimal speed and SQL injection safety.
- Use Elysia's schema validation (`t.Object(...)`) for all incoming request payloads.
- Store sensitive secrets (`MASTER_PASSWORD`, `JWT_SECRET`) in `.env`, never hardcode in source.

---

## 6. Development Checklist & Milestones

- [x] Reverse engineer Xiaomi Community APK & map endpoints
- [x] Design multi-account architecture & tech stack (Bun + Elysia + React Vite)
- [x] Verify exact quota timing (00:00 GMT+8 = 23:00 WIB)
- [x] Document development guidelines in `AGENTS.md`
- [ ] **Milestone 1**: Backend setup (Bun, Elysia, SQLite schema, JWT auth)
- [ ] **Milestone 2**: Xiaomi API client & state machine engine
- [ ] **Milestone 3**: Precision scheduler & NTP time sync
- [ ] **Milestone 4**: Frontend setup (Bun, React, Vite, Tailwind CSS)
- [ ] **Milestone 5**: Dashboard UI (Account management, status cards, countdown, SSE log viewer)
- [ ] **Milestone 6**: End-to-end testing & deployment configuration (VPS systemd / Vercel config)
