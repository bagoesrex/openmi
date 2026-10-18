# OpenMi — API Reference

## Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://new.c.mi.com/{region}/` |
| Test | `https://c-new.test.mi.com/{region}/` |

**Region:** `global`, `id` (Indonesia), atau region lain (lihat mapping di app).

---

## 1. Cek Feature Switch

Apakah fitur BL unlock sedang aktif secara global.

```
GET {base}/bl-switch/value
```

**Response:**
```json
{
  "code": 0,
  "data": 1,
  "msg": "success",
  "tc": "...",
  "ts": 1234567890
}
```

| Field | Type | Keterangan |
|-------|------|------------|
| `data` | Integer | `1` = aktif, lainnya = nonaktif |

---

## 2. Cek User State

Status unlock bootloader user saat ini.

```
GET {base}/user/bl-switch/state
```

**Response:**
```json
{
  "code": 0,
  "data": {
    "button_state": 1,
    "function_switch": 1,
    "info": "...",
    "is_pass": 0,
    "deadline": 0,
    "deadline_format": ""
  },
  "msg": "success"
}
```

| Field | Type | Keterangan |
|-------|------|------------|
| `button_state` | int | `1` = bisa apply, `2` = cooldown, lainnya = error |
| `function_switch` | int | Switch fitur |
| `is_pass` | int | `1` = sudah dapat unlock |
| `deadline` | long | Unix timestamp deadline (jika cooldown) |
| `deadline_format` | string | Deadline dalam format readable |

---

## 3. Apply Unlock Bootloader ⭐

**Endpoint utama untuk CLI tool.**

```
POST {base}/apply/bl-auth
Content-Type: application/json
Cookie: cUserId=XXX; serviceToken=YYY

{"is_retry": false}
```

**Request Body:**

| Field | Type | Keterangan |
|-------|------|------------|
| `is_retry` | boolean | `false` = pertama kali, `true` = retry setelah gagal |

**Response:**
```json
{
  "code": 0,
  "data": {
    "apply_result": 1,
    "deadline": 1234567890,
    "deadline_format": "2026-11-17 23:00"
  },
  "msg": "success",
  "tc": "...",
  "ts": 1234567890
}
```

**Apply Result Codes:**

| `apply_result` | Status | Aksi Script |
|----------------|--------|-------------|
| `1` | ✅ BERHASIL | Stop — selesai! |
| `2` | Cooldown | Stop — tunggu deadline |
| `3` | Limit hari ini habis | Retry besok di waktu yang sama |
| `4` | Cooldown (variant) | Stop — tunggu deadline |
| `5` | Gagal | Retry langsung (`is_retry=true`) |
| `6` | Coba 1 menit lagi | Tunggu 60 detik, retry |
| `7` | Coba nanti | Retry (`is_retry=true`) |

---

## Headers yang Diperlukan

| Header | Value | Sumber |
|--------|-------|--------|
| `Cookie` | `cUserId=XXX; serviceToken=YYY` | Login Xiaomi account |
| `Content-Type` | `application/json` | Wajib untuk POST |
| `User-Agent` | `...XiaoMi/MiuiBrowser/4.3` | Ditambahkan app di WebView |
| `Connection` | `close` | Dari CommonRequestInterceptor |

---

## Call Flow di App

```
[User tap "Apply Unlocking"]
  │
  ├─ Cek f12144t (sudah unlock?)
  │   ├─ Ya → Toast "already granted"
  │   └─ Tidak ↓
  │
  ├─ ViewModel.c(h0(isRetry))
  │   └─ Coroutine e4 → POST apply/bl-auth {is_retry: bool}
  │
  └─ Observer handle response
      ├─ applyResult=1 → Show granted UI ✅
      ├─ applyResult=2,4 → Show cooldown + deadline
      ├─ applyResult=3 → Show limit tips, set isRetry=false
      ├─ applyResult=5 → Show failed, set isRetry=true
      ├─ applyResult=6 → Toast "try in a minute"
      └─ applyResult=7 → Toast "try later", set isRetry=true
```
