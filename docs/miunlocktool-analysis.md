# Analisis Komparatif: Xiaomi Unlock Tool (miunlocktool) vs OpenMi

Dokumen ini berisi analisis teknis mendalam terhadap proyek referensi **Xiaomi Unlock Tool (Mi Unlock Tool Revamp)** karya *AsInsideOut* (v8.2 Stable) yang berada di direktori `miunlocktool/`, serta komparasi arsitektural dan peluang adopsi fiturnya ke dalam **OpenMi**.

---

## 1. Ringkasan Eksekutif & Struktur Proyek `miunlocktool`

`miunlocktool` adalah utilitas *open-source* multi-platform (GPL-3.0) yang dirancang untuk mengatasi kuota harian *bootloader unlock* Xiaomi HyperOS (1, 2, 3) dan MIUI 14.

Proyek ini memiliki 3 sub-implementasi utama:
```
miunlocktool/
└── sourcecode/
    ├── pc/                   # Aplikasi Desktop GUI (Python 3.10 + CustomTkinter)
    │   ├── 8.2.py            # Entrypoint utama Desktop GUI (Material Design 3)
    │   └── res/
    │       ├── api_handler.py      # HTTP11Session (urllib3 pool), BL API client
    │       ├── xiaomi_auth.py      # QR Code Login SSO (account.xiaomi.com long-polling)
    │       ├── hyperos_bypass.py   # HyperOS 1 bypass (V816 -> V14 logcat patch)
    │       ├── timing_dialog.py    # Konfigurasi offset milidetik (Europe/Asia/USA)
    │       └── settings.py         # Persistensi konfigurasi JSON
    ├── cli/                  # Standalone Headless CLI (Python 3.10)
    │   └── miunlock_cli.py   # Skrip CLI mandiri untuk VPS / Linux / cron
    └── android/              # Aplikasi Native Android (Kotlin + Jetpack Compose)
        └── app/src/main/java/com/asinsideout/miunlocktool/
            ├── service/      # Foreground Service & ApplyScheduler
            ├── data/         # SNTP client, Ping tester, XiaomiApiService
            ├── fastboot/     # Fastboot USB-OTG transport & protocol
            └── unlock/       # MiUnlockApiClient & MiUnlockWorkflow (AhaUnlock)
```

---

## 2. Analisis Fitur Kunci & Temuan Teknis `miunlocktool`

### 2.1. Mekanisme Login QR Code Tanpa Browser (`xiaomi_auth.py`)
Salah satu inovasi terbaik di `miunlocktool` adalah modul otentikasi login berbasis QR Code langsung dari endpoint SSO resmi Xiaomi tanpa membuka browser:
1. **Meminta QR Sesi Baru**:
   ```http
   GET https://account.xiaomi.com/longPolling/loginUrl?sid=18n_bbs_global&_json=false&callback=https://sgp-api.buy.mi.com/bbs/api/global/user/login-back
   ```
   Server mengembalikan URL QR image (`qr`), URL *long-polling* (`lp`), dan timeout.
2. **Long-Polling Status Scan**:
   Aplikasi melakukan *long-polling* HTTP GET ke `lp`. Ketika pengguna memindai QR lewat aplikasi Xiaomi/Mi Account di ponsel, server mengembalikan data: `code: 0`, `nonce`, `ssecurity`, dan `location`.
3. **Kalkulasi Client Signature**:
   ```python
   client_sign = quote(base64.b64encode(
       hashlib.sha1(f"nonce={nonce}&{ssecurity}".encode()).digest()
   ))
   final_url = f"{location}&clientSign={client_sign}"
   ```
4. Mengunjungi `final_url` akan menerbitkan cookie `new_bbs_serviceToken` (atau `serviceToken`) resmi secara otomatis.
5. Sesi login (`userId`, `passToken`, `deviceId`) disimpan di `~/.migatesession/18n_bbs_global/session.json` sehingga token dapat di-refresh otomatis tanpa login ulang.

---

### 2.2. Format Header & Penyamaran Device ID (`api_handler.py`)
Dalam memanggil API kuota `POST /bbs/api/global/apply/bl-auth`:
* **Header Cookie yang Dikirim `miunlocktool`**:
  ```http
  Cookie: new_bbs_serviceToken={token};versionCode=500411;versionName=5.4.11;deviceId={deviceId};
  User-Agent: okhttp/4.12.0
  Content-Type: application/json; charset=utf-8
  ```
* **Rotasi Device ID**: Untuk setiap request yang ditembakkan, `miunlocktool` membangkitkan `deviceId` acak (SHA-1 hash huruf kapital sepanjang 40 karakter). Tujuannya agar server Xiaomi tidak memblokir permohonan berdasarkan reputasi ID perangkat tertentu.
* **Pre-baked Static Payload**: Payload `b'{"is_retry":true}'` langsung digunakan secara *pre-baked* dengan `Content-Length: 17` guna memangkas overhead alokasi memori saat milidetik eksekusi.

---

### 2.3. Strategi Waktu Eksekusi: "Spread-Burst" dengan Offset Latensi
Berbeda dengan OpenMi yang menggunakan strategi *single-target TLS pre-warmed* tepat di milidetik 00.000, `miunlocktool` menggunakan strategi penembakan beruntun (*spread-burst*):
* **Kompensasi Ping Dinamis**:
  Pada T-20 detik (23:59:40 Beijing Time / 22:59:40 WIB), alat mengukur latensi TCP/HTTP ke `sgp-api.buy.mi.com`.
  Rumus waktu pemicu:
  $$\text{sendTime} = 60.0 - \left(\frac{\text{pingMs}}{1000.0}\right)$$
  (Dibatasi antara rentang detik `56.0` hingga `59.95`).
* **Micro-Offset Profiles**:
  Menjadwalkan 5 hingga 6 thread paralel dengan jeda mikro (contoh profil Asia: `58.8s`, `59.1s`, `59.3s`, `59.5s`, `59.7s` dari menit ke-59). Setiap thread mengirimkan request dengan `deviceId` berbeda secara bersamaan menyongsong detik 00:00:00.

---

### 2.4. Modul Bypass HyperOS 1 via Logcat Interception (`hyperos_bypass.py`)
Fitur ini mengintegrasikan teknik eksploitasi lawas HyperOS 1 (karya MlgmXyysd):
1. Menghubungkan perangkat via ADB.
2. Membuka menu pengembang: `am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS`.
3. Membaca `adb logcat *:S CloudDeviceStatus:V`.
4. Saat pengguna mengklik tombol "Add account and device", sistem Android membocorkan data terenkripsi AES-128-CBC (`key: 20nr1aobv2xi8ax4`, `iv: 0102030405060708`).
5. Skrip langsung mematikan data seluler (`svc data disable`) untuk mencegah request asli sampai ke Xiaomi.
6. Skrip mendekripsi payload, mengubah versi ROM dari `V816...` (HyperOS) menjadi `V14...` (MIUI), mengenkripsi ulang, menandatangani dengan HMAC-SHA1 (`10f29ff413c89c8de02349cb3eb9a5f5`), lalu mengirimkan request ke `https://unlock.update.intl.miui.com/v1/unlock/applyBind`.
*(Catatan: Metode ini hanya efektif untuk HyperOS 1 patch awal 2024. Pada HyperOS 2 dan HyperOS 3 terbaru, Xiaomi sudah menolak modifikasi versi ini di sisi server).*

---

### 2.5. Implementasi Klien Fastboot Resmi di Android (`unlock/` & `fastboot/`)
Aplikasi Android `miunlocktool` menyertakan modul protokol resmi **Mi Unlock Tool**:
* Berkomunikasi langsung dengan perangkat Xiaomi dalam mode *Fastboot* via kabel USB-OTG (`FastbootUsbTransport.kt`).
* Mengambil parameter hardware (`product` dan `token` dari `fastboot oem get_token`).
* Menghubungi server otorisasi unlock resmi Xiaomi:
  * `POST /v1/unlock/user/auth`
  * `POST /v1/unlock/device/clear` (cek status wipe data)
  * `POST /v1/unlock/ahaUnlock` (meminta data token unlock terenkripsi)
* Mengirimkan token unlock terenkripsi langsung ke perangkat melalui `fastboot stage` dan mengeksekusi `fastboot oem unlock` langsung dari ponsel Android pengguna tanpa butuh komputer.

---

## 3. Matriks Perbandingan: `miunlocktool` vs `OpenMi`

| Parameter Evaluasi | `miunlocktool` (v8.2) | `OpenMi` |
| :--- | :--- | :--- |
| **Teknologi & Runtime** | Python 3.10 (CustomTkinter/urllib3) + Kotlin Android | **100% Bun ecosystem** (ElysiaJS + `bun:sqlite` + React 19 Vite) |
| **Model Arsitektur** | Aplikasi Desktop Mandiri (Client-side) & Mobile APK | **Server-side VPS Daemon + Web Control Dashboard** |
| **Dukungan Multi-Akun** | ❌ 1 Akun per sesi aplikasi |  **Multi-Akun Paralel** (manajemen UID, kuota, proxy per akun) |
| **Ketergantungan Perangkat** | Komputer / HP harus menyala aktif saat jam 23:00 WIB |  **Berjalan 24/7 di Cloud VPS** tanpa perlu menyalakan PC/HP |
| **Sinkronisasi Waktu** | NTP UDP socket (Google, Cloudflare, stratum) | NTP edge trace sub-detik terkalibrasi ke jam VPS |
| **Optimasi Jaringan** | Ping compensation trigger (`60 - ping`) | **TLS Socket Pre-warming T-15s & T-10s** (0 handshake latency) |
| **Metode Eksekusi** | *Spread-burst* (5-6 request per akun dalam 1 detik) | **Zero-Hour Single-Shot & Spread-Burst Profiles** (Asia, Global, Custom) |
| **Resiko Rate-Limit (Code 6)**| Lebih tinggi jika server Xiaomi mendeteksi burst IP | Terkendali (rotasi dinamis `deviceId` 40-karakter SHA-1 per gelombang) |
| **Manajemen Cookie** | QR Code SSO Login & Chromium Cookie Parser | **Headless QR Code SSO di Dashboard** + Browser Capture + Web Form |
| **Observabilitas / Log** | Textbox GUI lokal | **Real-time Server-Sent Events (SSE)** + SQLite Persistent Log |
| **Fitur Ekstra** | HyperOS 1 bypass & USB-OTG Fastboot flasher | Auto-normalizer Base64 URL token, Dry-Run Burst Test, Multi-region routing |

---

## 4. Status Adopsi Teknik Unggulan ke OpenMi (100% Selesai)

Berdasarkan hasil analisis terhadap `miunlocktool`, seluruh teknik kunci yang relevan telah berhasil diadopsi dan diimplementasikan ke dalam OpenMi:

1. **Rotasi Parameter Dinamis (`deviceId`, `versionCode`, `versionName`) — ✅ Selesai**:
   * OpenMi menginjeksi header identitas resmi aplikasi Xiaomi Community (`v5.4.40`) dan secara dinamis membangkitkan `deviceId` acak (hash SHA-1 40-karakter huruf kapital) per tembakan request di `client.ts` dan `burst.ts`.
2. **Fitur Generator QR Code Login Langsung di Dashboard — ✅ Selesai**:
   * Modul otentikasi headless Xiaomi SSO terintegrasi penuh melalui endpoint `POST /api/accounts/qr/session` dan `qr-auth.ts`.
   * Dashboard web menyediakan modal QR scan interaktif dengan auto-polling, resolusi redirect berantai (`SimpleCookieJar`), ekstraksi `new_bbs_serviceToken` / `cUserId`, serta telemetri status real-time (`QR_AUTH_SUCCESS` / `QR_AUTH_ERROR`).
3. **Pilihan Strategi Eksekusi Spread-Burst — ✅ Selesai**:
   * Pengguna dapat memilih mode eksekusi pada setiap akun: *Asia Burst* (`58.8s`, `59.1s`, `59.3s`, `59.5s`, `59.7s`), *Global Burst* (`59.0s`, `59.3s`, `59.6s`, `59.8s`), atau *Custom Timings*.
   * Tersedia fitur **Test Burst** (`POST /api/accounts/:id/test-burst`) di dashboard untuk menguji latensi dan urutan tembakan secara nyata (*dry-run*) sebelum eksekusi tengah malam.
