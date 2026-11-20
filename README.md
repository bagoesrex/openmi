# OpenMi — Xiaomi Bootloader Unlock Platform

OpenMi adalah platform manajemen multi-akun dan automasi tingkat lanjut untuk memonitor, menguji, dan mendaftarkan kuota resmi unlock bootloader Xiaomi melalui integrasi langsung ke REST API Xiaomi Community.

Platform ini dibangun sepenuhnya di atas ekosistem **Bun** dengan Clean Architecture:
- **Backend (VPS)**: Bun + ElysiaJS + `bun:sqlite` + `@elysiajs/jwt` + Server-Sent Events (SSE).
- **Frontend (Vercel)**: Bun + React 19 + Vite + Tailwind CSS (Clean Light Theme).

---

## Disclaimer & Kompatibilitas Versi

Platform OpenMi dibangun dan divalidasi berdasarkan hasil rekayasa balik (*reverse engineering*) pada aplikasi resmi:
* **Basis Versi Aplikasi**: **Xiaomi Community v5.4.40** (Build `500440`, Package `com.mi.global.bbs`).
* **Status**: Versi `5.4.40` saat ini merupakan rilis resmi paling mutakhir dari Xiaomi Inc.

### Catatan Penting untuk Versi Mendatang:
Seluruh pemetaan endpoint REST API (`sgp-api.buy.mi.com`), format otorisasi dual-token (`serviceToken` & `new_bbs_serviceToken`), struktur payload apply, serta state machine 7-kode respons pada proyek ini mengacu pada arsitektur versi `5.4.40`. 

Apabila Xiaomi merilis pembaruan aplikasi versi yang lebih tinggi di masa mendatang (misalnya `v5.5.x` atau versi mayor berikutnya), pihak Xiaomi berpotensi mengubah protokol komunikasi, skema enkripsi/signature, atau parameter endpoint. Jika hal tersebut terjadi, OpenMi mungkin memerlukan pembaruan penyesuaian (*compatibility patch*). Pengguna dipersilakan membuka *Issue* di GitHub jika menemukan ketidaksesuaian respons pada rilis Xiaomi Community yang lebih baru.

### Tautan Pemantauan Versi Resmi:
Pengguna dapat memeriksa versi terkini aplikasi Xiaomi Community melalui tautan publik berikut:
* **Google Play Store**: [Xiaomi Community di Google Play Store](https://play.google.com/store/apps/details?id=com.mi.global.bbs)
* **Riwayat Versi (APKPure)**: [Xiaomi Community Version History di APKPure](https://apkpure.com/xiaomi-community/com.mi.global.bbs/versions)

---

## Fitur Utama

1. **Multi-Account Management**: Kelola banyak akun Xiaomi sekaligus (Label, Region `global`/`id`, `cUserId`, `serviceToken`, pilihan Timing Mode, dan opsi outbound HTTP/SOCKS5 Proxy).
2. **Headless QR Code SSO Login**: Pindai QR code langsung dari modal dashboard web menggunakan aplikasi Akun Xiaomi / Kamera ponsel. OpenMi secara otomatis melakukan long-polling, mengikuti redirect otentikasi STS Xiaomi, mengumpulkan session cookie (`SimpleCookieJar`), dan mengekstrak `serviceToken` serta `cUserId` tanpa perlu membuka browser luar atau memasang ekstensi.
3. **Spread-Burst Execution Engine**: Mendukung profil penembakan gelombang kuota (*Asia*, *Global*, dan *Custom Timings* berpresisi tinggi). Setiap tembakan dalam gelombang menggunakan `deviceId` acak (SHA-1 40-karakter) guna memaksimalkan probabilitas memperoleh kuota resmi tanpa risiko terblokir reputasi perangkat tunggal.
4. **Dry-Run Burst Simulation**: Uji kelayakan dan ukur latensi riil koneksi VPS ke server Xiaomi untuk setiap gelombang tembakan (`POST /api/accounts/:id/test-burst`) langsung dari kartu akun di dashboard.
5. **Direct REST API Engine**: Terhubung langsung ke host backend resmi Xiaomi (`https://sgp-api.buy.mi.com/bbs/api/{region}/`) tanpa overhead rendering HTML/WebView.
6. **High-Precision Scheduler & NTP Sync**: Berjalan 24/7 di VPS, tersinkronisasi sub-detik dengan NTP edge trace (Cloudflare drift < 10ms), melakukan TLS pre-warming pada T-15s dan T-10s, verifikasi sesi akun pada T-5s, dan mengeksekusi request tepat menyongsong pukul **23:00:00 WIB** (**00:00:00 GMT+8 Beijing Time**).
7. **State Machine 7 Kode Respons**: Menangani seluruh 7 kode hasil resmi (`applyResult`) dari dekompilasi aplikasi Xiaomi Community (termasuk auto-retry pintar untuk kode 5 dan 7, serta cooldown 60 detik untuk kode 6).
8. **Interactive Cookie Capture Tool**: Skrip pendamping berbasis Playwright (`bun run capture`) yang membuka browser Google Chrome asli dengan sesi persisten sebagai alternatif ekstraksi kredensial.
9. **Rich Diagnostic Error Logging & Permanent Clear**: Setiap aktivitas dan error dicatat terstruktur (timestamp ms, endpoint, HTTP status, kode Xiaomi, raw body, dan saran diagnostik AI). Riwayat log tersimpan di database SQLite dan dapat dihapus permanen melalui tombol **Clear**.
10. **Real-time Live Stream Console**: Log eksekusi dan progres otentikasi disiarkan detik demi detik ke dashboard web via Server-Sent Events (SSE) dengan indikator status koneksi (Live Sync).
11. **Single-Tenant Security**: Seluruh akses API diproteksi dengan `MASTER_PASSWORD` di `.env` yang menerbitkan JSON Web Token (JWT).

---

## Autentikasi dan Ekstraksi Kredensial

OpenMi mendukung beberapa cara mudah untuk mengotorisasi akun Xiaomi:

### Cara 1: Scan QR Code Langsung di Dashboard (Paling Praktis & Direkomendasikan)
1. Buka dashboard OpenMi dan klik tombol **+ Add Account**.
2. Pada tab default **Scan QR Login**, kode QR SSO Xiaomi resmi akan dimuat secara instan.
3. Buka aplikasi **Akun Xiaomi** (atau gunakan kamera / scanner HP Xiaomi) dan pindai kode QR.
4. Klik **Setujui / Authorize** di ponsel Anda.
5. OpenMi secara otomatis menangkap token, mengisi kolom `cUserId` dan `serviceToken`, serta memberikan label akun otomatis. Klik **Save Account**.

### Cara 2: Interactive Browser Capture (Otomatis via PC)
```bash
cd backend
bun run capture
```
Browser Google Chrome akan terbuka secara otomatis. Setelah Anda login sekali, skrip akan langsung mendeteksi sesi, memicu pertukaran token, menyimpan kredensial ke `captured-cookies.json`, dan menguji kelayakannya ke server Xiaomi.

### Cara 3: Manual Input (DevTools Browser / Sniffer Android)
Panduan manual selengkapnya tersedia di:
- **[Panduan Ekstraksi Kredensial Xiaomi](docs/auth-guide.md)**

---

## Struktur Monorepo

```
openmi/
├── backend/                       # VPS Daemon Service
│   ├── src/
│   │   ├── domain/                # Clean Architecture Entities (Account, Log)
│   │   ├── db/                    # bun:sqlite schema, client, migrations, & repositories
│   │   ├── services/
│   │   │   ├── xiaomi/            # REST Client (sgp-api), burst wave, qr-auth, & state machine
│   │   │   │   ├── client.ts      # HTTP wrapper with dual-token & dynamic deviceId
│   │   │   │   ├── state-machine.ts # 7-code result evaluator
│   │   │   │   ├── burst.ts       # Spread-burst latency offsets & wave scheduler
│   │   │   │   └── qr-auth.ts     # Headless SSO QR long-polling & SimpleCookieJar
│   │   │   ├── ntp.ts             # Cloudflare trace time synchronization
│   │   │   ├── scheduler.ts       # Precision countdown & zero-hour execution
│   │   │   └── broadcaster.ts     # Real-time SSE event bus
│   │   ├── api/                   # Elysia REST routes (auth, accounts, qr, logs)
│   │   ├── app.ts                 # Elysia app definition & dynamic CORS
│   │   └── index.ts               # Daemon entrypoint
│   ├── scripts/
│   │   ├── capture-cookies.ts     # Interactive Chrome cookie capture tool
│   │   └── run-e2e.ts             # Full-Stack Playwright automated test runner
│   ├── tests/                     # Unit & Integration tests (bun:test, 26 tests)
│   ├── openmi.service             # Systemd service unit template untuk VPS
│   ├── .env.example               # Template environment backend
│   └── package.json
├── frontend/                      # React SPA Dashboard (Vercel)
│   ├── src/
│   │   ├── components/            # Header, AccountCard, AccountModal (QR & Manual), LogTerminal
│   │   ├── hooks/                 # useAuth, useSSE
│   │   ├── lib/                   # API client wrapper
│   │   └── App.tsx                # Dashboard layout (Light Theme)
│   ├── vite.config.ts             # Vite dev server proxy
│   ├── .env.example               # Template environment frontend
│   └── package.json
├── docs/                          # Spesifikasi & dokumentasi lengkap
│   ├── api-spec.md                # Spesifikasi endpoint & payload Xiaomi + Internal API
│   ├── auth-guide.md              # Panduan QR Login & ekstraksi cookie cUserId/serviceToken
│   ├── automation-plan.md         # Rancangan arsitektur automasi, burst engine, & scheduler
│   ├── miunlocktool-analysis.md   # Hasil analisis komparasi & adopsi fitur miunlocktool
│   └── superpowers/               # Rancangan arsitektur & SDD execution plan
└── vercel.json                    # Konfigurasi deployment Vercel
```

---

## Panduan Menjalankan Lokal

### Prasyarat
- [Bun](https://bun.sh) v1.4+ terinstall di sistem.
- Google Chrome terinstall (opsional, untuk skrip penangkap cookie otomatis).

### 1. Menjalankan Backend
```bash
cd backend
bun install

# Buat file konfigurasi .env
cp .env.example .env
# Sesuaikan MASTER_PASSWORD dan JWT_SECRET di .env

# Jalankan server development
bun run dev
```
Backend akan berjalan di `http://localhost:3001`.

### 2. Menjalankan Frontend
```bash
cd frontend
bun install

# Jalankan Vite dev server
bun run dev
```
Buka `http://localhost:3000` di browser Anda. Masukkan `MASTER_PASSWORD` yang telah diatur di backend untuk membuka dashboard.

---

## Panduan Deployment Produksi

### A. Deploy Backend ke VPS (Ubuntu/Debian)
1. Install Bun di VPS:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc
   ```
2. Clone repo dan setup direktori:
   ```bash
   git clone <repo-url> /var/www/openmi
   cd /var/www/openmi/backend
   bun install
   cp .env.example .env
   nano .env # Set MASTER_PASSWORD, JWT_SECRET, dan CORS_ORIGIN
   ```
3. Pasang Systemd Service:
   ```bash
   cp openmi.service /etc/systemd/system/openmi.service
   systemctl daemon-reload
   systemctl enable openmi
   systemctl start openmi
   systemctl status openmi
   ```

### B. Deploy Frontend ke Vercel
1. Hubungkan repository ini ke akun Vercel Anda.
2. File `vercel.json` di root akan otomatis mengarahkan build ke direktori `frontend/`.
3. Tambahkan Environment Variable di Vercel Dashboard:
   - `VITE_API_BASE_URL`: URL backend VPS Anda (misalnya `https://api.domainanda.com` atau `http://ip-vps:3001`)
4. Klik **Deploy**. Dashboard OpenMi siap diakses.

---

## Menjalankan Pengujian (Testing)

```bash
# 1. Unit & Integration Test backend (100% native bun:test, 26 tests across 6 files)
cd backend
bun test

# 2. Automated Full-Stack E2E Test (Playwright Chromium, 16 test scenarios)
# Menguji alur Login, CRUD Akun, Live Cookie Test, SSE Sync, QR Code Login, Burst Test, dan SQLite Clear
bun run test:e2e

# 3. Typecheck & Build frontend
cd ../frontend
bun run build
```
Semua unit test backend berjalan instan (< 1 detik) dan suite E2E memvalidasi seluruh fungsionalitas UI secara komprehensif.
