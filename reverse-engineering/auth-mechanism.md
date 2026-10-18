# Auth Mechanism — Xiaomi Community App

## Cookie-Based Authentication

App menggunakan **Xiaomi Account SSO cookie** untuk auth semua API request.

### Cookie yang Di-set (dari WebSsoCookieUtils.java)

```java
// Line 165-168:
cookieManager.setCookie(url, getCookie(cookieDomain, "cUserId", serviceTokenResult.cUserId, cookiePath));
cookieManager.setCookie(url, getCookie(cookieDomain, "serviceToken", serviceTokenResult.serviceToken, cookiePath));
cookieManager.setCookie(url, getCookie(rootDomain(cookieDomain), sid + "_slh", serviceTokenResult.slh, cookiePath));
cookieManager.setCookie(url, getCookie(cookieDomain, sid + "_ph", serviceTokenResult.ph, cookiePath));
```

### Cookie Fields
| Cookie Name | Deskripsi |
|-------------|-----------|
| `cUserId` | User ID Xiaomi |
| `serviceToken` | Token autentikasi utama |
| `{sid}_slh` | Security hash (di root domain) |
| `{sid}_ph` | Password hash |

### Domain
- Cookie domain: `mi.com` (atau `mi.co.id` untuk Indonesia)
- Pengecekan di `impl/h.java` line 84:
  ```java
  String cookie = CookieManager.getInstance().getCookie(
      ma.h() ? "mi.co.id" : "mi.com"
  );
  ```

### Interceptor (ag/a.java)
Shop module menambahkan Cookie header via OkHttp interceptor:
```java
builderNewBuilder.addHeader("Cookie", sb2.toString());
builderNewBuilder.addHeader("Mi-Info", sb3.toString());
```

### WebView User-Agent
```java
// BootloaderActivity.java line 81:
webSettings.setUserAgentString(
    webSettings.getUserAgentString() + "XiaoMi/MiuiBrowser/4.3"
);
```

### Cara Capture Cookie untuk Script
1. **Via mitmproxy/HTTP Toolkit** — intercept traffic dari HP
2. **Via Chrome DevTools** — login di browser, ambil dari Network tab
3. **Via ADB** — `adb shell dumpsys webview` (jika rooted)

### Yang Dibutuhkan untuk CLI Tool
Minimal cookie string berisi:
```
cUserId=XXXXX; serviceToken=YYYYY
```
Plus header tambahan yang mungkin diperlukan:
- `User-Agent` (dengan suffix `XiaoMi/MiuiBrowser/4.3`)
- `Connection: close` (dari CommonRequestInterceptor)
