# Raw API Endpoints — Extracted from vc/i.java (MeApiService)

**Source:** `sources/vc/i.java` (Retrofit interface)
**Base URL:** `https://new.c.mi.com/{region}/`

## Bootloader-Related Endpoints

### 1. GET bl-switch/value
```java
@retrofit2.http.GET("bl-switch/value")
retrofit2.Call<BootloaderConfigModel> Q();
```
- **Full URL:** `https://new.c.mi.com/{region}/bl-switch/value`
- **Auth:** Cookie-based
- **Response:** `BootloaderConfigModel { code, data (Integer), msg, tc, ts }`
- **Purpose:** Cek apakah fitur BL unlock aktif secara global

### 2. GET user/bl-switch/state
```java
@retrofit2.http.GET("user/bl-switch/state")
retrofit2.Call<BootloaderStateModel> s0();
```
- **Full URL:** `https://new.c.mi.com/{region}/user/bl-switch/state`
- **Auth:** Cookie-based
- **Response:** `BootloaderStateModel { code, data { buttonState, functionSwitch, info, isPass, deadline, deadlineFormat }, msg }`
- **Purpose:** Cek status BL unlock user saat ini

### 3. POST apply/bl-auth
```java
@retrofit2.http.POST("apply/bl-auth")
retrofit2.Call<BootloaderAuthModel> u0(@retrofit2.http.Body okhttp3.RequestBody requestBody);
```
- **Full URL:** `https://new.c.mi.com/{region}/apply/bl-auth`
- **Auth:** Cookie-based
- **Method:** POST
- **Content-Type:** application/json (via `b0.f10454a` MediaType)
- **Request Body:** `{"is_retry": boolean}`
- **Response:** `BootloaderAuthModel { code, data { applyResult, deadline, deadlineFormat }, msg, tc, ts }`
- **Purpose:** Apply unlock bootloader — endpoint utama

## Request Body Construction (dari e4.java)

```java
// Line 32 dari e4.java:
okhttp3.RequestBody requestBodyT = com.mi.global.bbslib.commonbiz.network.j.t(
    com.mi.global.bbslib.commonbiz.network.j.u(obj).put("is_retry", this.$isRetry),
    "toString(...)",
    okhttp3.RequestBody.Companion,
    com.mi.global.bbslib.commonbiz.utils.b0.f10454a  // MediaType: application/json
);
```

Artinya body = JSONObject dengan key `is_retry` (boolean), di-serialize ke string lalu jadi RequestBody.

## Call Flow

```
User tap "Apply Unlocking" button
  → d0.onClick() case 10
    → j0.c(new h0(j0, isRetry, null))   // ViewModel
      → e4.invokeSuspend()                // Coroutine
        → d.h().u0(requestBody)           // Retrofit call
          → POST apply/bl-auth            // HTTP request
            → BootloaderAuthModel         // Response
              → observe() di BootloaderActivity  // Handle result
```
