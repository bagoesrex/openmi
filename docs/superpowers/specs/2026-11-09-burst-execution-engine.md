# High-Precision Spread-Burst Execution Engine Design

## 1. Intent & Problem Statement

OpenMi currently triggers a single `POST apply/bl-auth` at exact zero-hour (`23:00:00.000` WIB / `00:00:00.000` GMT+8). In real-world conditions against Xiaomi's quota release, this request arrives at the Singapore server between `+150ms` and `+350ms` due to internet transit time (RTT), at which point official daily unlock quotas are already exhausted.

By contrast, the reference tool **`miunlocktool`** succeeds because it employs a **multi-shot spread burst** firing 5 to 6 micro-offset requests in the final 1.5 seconds (`23:59:58.800` through `23:59:59.700` Beijing time), rotating `deviceId` per request, and using pre-baked `{"is_retry": true}` bodies.

This specification designs OpenMi's **High-Precision Spread-Burst Engine**, bringing identical multi-wave timing to OpenMi's 24/7 headless Bun runtime and multi-account architecture.

---

## 2. Goals & Non-Goals

### Goals
- **Asia Default Timing Profile**: Pre-schedule 5 micro-offset dispatch slots per active account: `58.800s`, `59.100s`, `59.300s`, `59.500s`, `59.700s` (and optional `59.900s`).
- **Dynamic Device ID Rotation**: Generate a unique random 40-character hex `deviceId` for each burst shot to avoid Xiaomi's device-level rate limit.
- **Enriched Cookie Header**: Send `versionCode=500440; versionName=5.4.40; deviceId={deviceId};` alongside `cUserId`, `serviceToken`, and `new_bbs_serviceToken`.
- **Pre-baked `is_retry: true` Payload**: Utilize `{"is_retry": true}` by default for zero-hour burst attempts.
- **Fast Early-Exit**: When any shot in the wave returns `code: 0` or `apply_result: 1` (or `100003`), immediately abort remaining pending timers/requests for that account and log success.
- **User Configurability**: Provide an Execution Mode selector in the Account Modal and Dashboard (Asia Profile [Default], Europe Profile, Single Shot, or Custom Timings).

### Non-Goals
- Modifying Fastboot USB protocols (OpenMi is server-side VPS quota reservation, not a local USB flasher).
- Bypassing Xiaomi's monthly unlock limit (code 2) which is enforced server-side by account age and device binding.

---

## 3. Architecture & Execution Mechanics

### 3.1. Burst Wave Schedule
At T-15s (`22:59:45` WIB), the scheduler pre-warms the TLS socket to `sgp-api.buy.mi.com`.
At T-5s (`22:59:55` WIB), the scheduler computes the synchronized Beijing base minute ($T_{0} = \text{23:59:00}$ Beijing time).

For each active account, the engine arms independent millisecond timers corresponding to the profile offsets:
$$\text{Target Time}_i = T_0 + \text{offset}_i$$
$$\text{Delay}_i = \max(0, \text{Target Time}_i - \text{CalibratedNow}())$$

#### Default Asia Timings:
- **Shot #1**: `23:59:58.800` (Offset: 58.8s) — Earliest arrival wave for high-latency connections (~800ms ping).
- **Shot #2**: `23:59:59.100` (Offset: 59.1s) — Arrival for ~600ms ping.
- **Shot #3**: `23:59:59.300` (Offset: 59.3s) — Arrival for ~400ms ping.
- **Shot #4**: `23:59:59.500` (Offset: 59.5s) — Arrival for ~250ms ping.
- **Shot #5**: `23:59:59.700` (Offset: 59.7s) — Sweet-spot arrival for ~100–150ms ping (Singapore VPS).
- **Shot #6**: `23:59:59.900` (Offset: 59.9s) — Final trailing shot right as zero-hour strikes.

### 3.2. Per-Shot Request Structure
Each request within the burst has its own:
1. `deviceId`: Generated via `crypto.randomBytes(20).toString("hex").toUpperCase()`.
2. `headers`:
   ```http
   Cookie: cUserId={cUserId}; serviceToken={token}; new_bbs_serviceToken={token}; versionCode=500440; versionName=5.4.40; deviceId={deviceId};
   User-Agent: Mozilla/5.0 ... XiaoMi/MiuiBrowser/4.3
   Content-Type: application/json
   ```
3. `body`: `{"is_retry": true}`.
4. `signal`: Shared `AbortSignal` for the account wave. If any shot succeeds, `abortController.abort()` cancels in-flight network requests.

### 3.3. Response Handling & Early Termination
- If `apply_result === 1` or `code === 0` or `code === 100003`:
  - Mark status `SUCCESS`.
  - Abort remaining burst timers.
  - Log: `[Burst #X @ SS.mmm] Unlock pass approved!`.
  - Broadcast over SSE.
- If `apply_result === 3` (Daily quota limit reached):
  - Mark status `QUOTA_EXHAUSTED`.
  - Record deadline format.
- If `code === 100004` (Cookie expired):
  - Mark session invalid (`sessionValid = 0`).

---

## 4. Database & API Changes

### Schema Enhancement (`openmi.sqlite`)
Add fields to `accounts` table:
- `timing_mode`: TEXT DEFAULT 'asia' ('asia' | 'europe' | 'single' | 'custom')
- `custom_timings`: TEXT (JSON array string, e.g. `"[58.8, 59.1, 59.3, 59.5, 59.7]"`)

### REST Endpoints
- `POST /api/accounts`: accepts `timingMode` and `customTimings`.
- `PUT /api/accounts/:id`: updates `timingMode` and `customTimings`.
- `POST /api/accounts/:id/test-burst`: triggers a dry-run test burst to verify timing and device ID dispatch.

---

## 5. UI Dashboard Upgrades

- **Account Modal**: Add "Execution Timing Mode" selector:
  - `⚡ Asia Burst (Recommended - 58.8s to 59.7s)`
  - `🌍 Europe Burst (58.7s to 59.8s)`
  - `🎯 Single Shot (23:00:00 exact)`
  - `⚙️ Custom Timing Offsets`
- **Account Card**: Badge showing active execution profile (e.g. `⚡ Asia Burst (5x)`).
- **Log Monitor**: Clearly display burst sequence numbers (`[Burst #1/5]`, `[Burst #2/5]`, etc.) in real time.
