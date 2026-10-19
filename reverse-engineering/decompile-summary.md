# Decompile Summary — Xiaomi-Community.apk

**Target:** Xiaomi Community (`com.mi.global.bbs`)  
**Versi:** `5.4.40` (Build `500440`, Target SDK 36)  
**Tanggal:** 2026-10-18  
**Tool:** JADX (headless)  
**Output:** `C:\Users\bagoe\AppData\Local\Temp\antigravity\xiaomi-decompiled\`  
**Total classes:** 9395  
**Errors:** 86 (normal, tidak mempengaruhi analisis kunci)  

## File-File Kunci yang Ditemukan

### Core UI — Bootloader Unlock
| File | Peran |
|------|-------|
| `sources/com/mi/global/bbslib/me/ui/BootloaderActivity.java` | Activity utama bootloader unlock, route `/me/bootloader` |
| `sources/com/mi/global/bbslib/me/ui/Hilt_BootloaderActivity.java` | Hilt DI base class |
| `sources/com/mi/global/bbslib/me/ui/l0.java` | JavaScript interface untuk WebView (`@JavascriptInterface`) |
| `sources/com/mi/global/bbslib/me/ui/n0.java` | WebViewClient untuk halaman H5 bootloader |
| `sources/com/mi/global/bbslib/me/ui/UnlockFunFragment.java` | Fragment unlock functions (by level) |

### Data Models
| File | Peran |
|------|-------|
| `sources/com/mi/global/bbslib/commonbiz/model/BootloaderAuthModel.java` | Response model untuk apply — berisi `applyResult`, `deadline`, `deadlineFormat` |
| `sources/com/mi/global/bbslib/commonbiz/model/BootloaderStateModel.java` | Response model untuk state — berisi `buttonState`, `functionSwitch`, `isPass`, `deadline` |
| `sources/com/mi/global/bbslib/commonbiz/model/BootloaderConfigModel.java` | Config model — berisi `code`, `data`, `msg` |

### Network / Repository
| File | Peran |
|------|-------|
| `sources/vc/i.java` | **Retrofit API interface** — semua endpoint BL ada di sini |
| `sources/com/mi/global/bbslib/commonbiz/network/repos/u7.java` | MeRepository |
| `sources/com/mi/global/bbslib/commonbiz/network/repos/u4.java` | Coroutine: GET state → `d.h().s0()` |
| `sources/com/mi/global/bbslib/commonbiz/network/repos/e4.java` | Coroutine: POST apply → `d.h().u0(body)` dengan `{is_retry: bool}` |
| `sources/com/mi/global/bbslib/commonbiz/network/d.java` | Network singleton, `d.h()` = MeApiService |

### ViewModel
| File | Peran |
|------|-------|
| `sources/com/mi/global/bbslib/commonbiz/viewmodel/j0.java` | BootloaderViewModel — LiveData untuk state & auth result |
| `sources/com/mi/global/bbslib/commonbiz/viewmodel/i0.java` | Coroutine worker: fetch state |
| `sources/com/mi/global/bbslib/commonbiz/viewmodel/h0.java` | Coroutine worker: apply auth |

### Click Handler & Navigation
| File | Peran |
|------|-------|
| `sources/com/mi/global/bbslib/forum/ui/d0.java` | OnClickListener — case 10 = apply button |
| `sources/com/mi/global/bbslib/me/ui/f5.java` | Cek bootloader enabled sebelum navigate |
| `sources/com/mi/global/bbslib/me/ui/g5.java` | Navigate ke `/me/bootloader` |
| `sources/com/alibaba/android/arouter/routes/ARouter$$Group$$me.java` | Route registry |

### Auth / Cookie
| File | Peran |
|------|-------|
| `sources/com/xiaomi/passport/utils/WebSsoCookieUtils.java` | Set cookie: `cUserId`, `serviceToken`, `{sid}_slh`, `{sid}_ph` |
| `sources/com/xiaomi/passport/utils/HttpCookies.java` | Cookie manager utility |
| `sources/com/common/network/cookie/store/MemoryCookieStore.java` | OkHttp cookie store |
| `sources/ag/a.java` | Shop interceptor — adds Cookie header |

### URL / Config
| File | Peran |
|------|-------|
| `sources/com/mi/global/bbslib/commonbiz/utils/p1.java` | Base URL: `https://new.c.mi.com/` (prod) |
| `sources/com/mi/global/bbslib/commonbiz/utils/e.java` | Region mapping (33 regions) |

### Analytics
| File | Peran |
|------|-------|
| `sources/md/a.java` | Tracking `tounlock` module, button name `apply`/`unlock` |
| `sources/md/d.java` | Event config: `user_unlockbl` page |
