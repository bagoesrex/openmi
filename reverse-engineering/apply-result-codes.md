# Apply Result Codes — BootloaderAuthModel.Data.applyResult

Extracted from `BootloaderActivity.java` lines 171-221 (observer handler).

## Response Structure

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

## applyResult Values

| Code | Status | UI Behavior | Retry? |
|------|--------|-------------|--------|
| `1` | ✅ **SUCCESS** | Show "granted" UI + success toast | No — selesai! |
| `2` | Cooldown | Show deadline, button disabled | No — tunggu deadline |
| `3` | Limit reached | Show date+time limit tips, button enabled | Ya — set `is_retry=false` |
| `4` | Cooldown (variant) | Same as 2 — show deadline, button disabled | No — tunggu deadline |
| `5` | Failed | Show failed message, button enabled | Ya — set `is_retry=true` |
| `6` | Try in 1 minute | Toast "try in a minute" | Ya — tunggu 1 menit |
| `7` | Try later | Toast "try later" | Ya — set `is_retry=true` |

## State Model (buttonState)

Dari `GET user/bl-switch/state`:

| buttonState | Arti | Button |
|-------------|------|--------|
| `1` | Ready to apply | Enabled ✅ |
| `2` | Cooldown period | Disabled ❌ (show deadline) |
| other | Error/unavailable | Disabled ❌ (error icon) |

## isPass Values

| isPass | Arti |
|--------|------|
| `1` | Already granted — sudah dapat unlock |
| other | Belum dapat |

## Key Logic (dari d0.java case 10)

```java
// Saat user klik tombol Apply:
if (bootloaderActivity.f12144t) {
    // Sudah unlock → tampilkan "already granted" toast
    toast(str_bl_granted_tips);
} else {
    // Belum unlock → call apply API
    j0Var.c(new h0(j0Var, isRetry, null));
    bootloaderActivity.showLoadingDialog();
}
```

`f12145x` (isRetry flag):
- Default: `true`
- Set `false` saat applyResult == 3 (limit reached)
- Set `true` saat applyResult == 5 atau 7
