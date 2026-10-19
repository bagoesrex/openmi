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

1. **Multi-Account Management**: Kelola banyak akun Xiaomi sekaligus (Label, Region `global`/`id`, `cUserId`, `serviceToken`, dan opsi outbound Proxy).
2. **Direct REST API Engine**: Terhubung langsung ke host backend resmi Xiaomi (`https://sgp-api.buy.mi.com/bbs/api/{region}/`) tanpa overhead rendering HTML/WebView.
3. **High-Precision Scheduler**: Berjalan 24/7 di VPS, tersinkronisasi sub-detik dengan NTP edge trace, melakukan TLS pre-warming pada T-10 detik, verifikasi sesi pada T-5 detik, dan eksekusi request concurrent tepat pada **23:00:00 WIB** (**00:00:00 GMT+8 Beijing Time**).
4. **State Machine 7 Kode Respons**: Menangani seluruh 7 kode hasil resmi (`applyResult`) dari dekompilasi aplikasi Xiaomi Community (termasuk auto-retry pintar untuk kode 5 dan 7, serta cooldown 60 detik untuk kode 6).
5. **Interactive Cookie Capture Tool**: Skrip berbasis Playwright yang membuka browser Google Chrome asli dengan sesi persisten untuk menangkap cookie otentikasi secara instan dan aman.
6. **Rich Diagnostic Error Logging & Permanent Clear**: Setiap aktivitas dan error dicatat terstruktur (timestamp ms, endpoint, HTTP status, kode Xiaomi, raw body, dan saran diagnostik AI). Riwayat log dapat dihapus permanen dari SQLite melalui tombol Clear.
7. **Real-time Live Stream Console**: Log eksekusi disiarkan detik demi detik ke dashboard web via Server-Sent Events (SSE) dengan indikator status koneksi (Live Sync).
8. **Single-Tenant Security**: Seluruh akses diproteksi dengan `MASTER_PASSWORD` di `.env` yang menerbitkan JSON Web Token (JWT).

---

## Autentikasi dan Ekstraksi Cookie

OpenMi menggunakan session cookie (`cUserId` dan `serviceToken`) dari akun Xiaomi yang sudah login resmi. Hal ini dilakukan untuk menghindari sistem anti-fraud captcha (Geetest) dan OTP SMS yang diterapkan Xiaomi pada endpoint login langsung.

Sistem OpenMi secara otomatis menangani kebutuhan dual-token (`serviceToken` + `new_bbs_serviceToken`) dan URL-encoding karakter Base64.

### Cara Cepat Menangkap Cookie (Otomatis):
```bash
cd backend
bun run capture
```
Browser Google Chrome akan terbuka secara otomatis. Setelah Anda login sekali, skrip akan langsung mendeteksi sesi, memicu pertukaran token, menyimpan kredensial ke `captured-cookies.json`, dan menguji kelayakannya ke server Xiaomi.

Panduan langkah demi langkah selengkapnya (termasuk metode manual DevTools dan Android packet sniffing) tersedia di:
- **[Panduan Ekstraksi Kredensial Xiaomi](docs/auth-guide.md)**

---

## Struktur Monorepo

```
openmi/
├── backend/                       # VPS Daemon Service
│   ├── src/
│   │   ├── domain/                # Clean Architecture Entities (Account, Log)
│   │   ├── db/                    # bun:sqlite schema, client, & repositories
│   │   ├── services/
│   │   │   ├── xiaomi/            # REST Client (sgp-api), normalizer & 7-code state machine
│   │   │   ├── ntp.ts             # Cloudflare trace time synchronization
│   │   │   ├── scheduler.ts       # Precision countdown & zero-hour execution
│   │   │   └── broadcaster.ts     # Real-time SSE event bus
│   │   ├── api/                   # Elysia REST routes (auth, accounts, logs)
│   │   ├── app.ts                 # Elysia app definition & dynamic CORS
│   │   └── index.ts               # Daemon entrypoint
│   ├── scripts/
│   │   ├── capture-cookies.ts     # Interactive Chrome cookie capture tool
│   │   └── run-e2e.ts             # Full-Stack Playwright automated test runner
│   ├── tests/                     # Unit & Integration tests (bun:test)
│   ├── openmi.service             # Systemd service unit template untuk VPS
│   ├── .env.example               # Template environment backend
│   └── package.json
├── frontend/                      # React SPA Dashboard (Vercel)
│   ├── src/
│   │   ├── components/            # Header, AccountCard, AccountModal, LogTerminal, LoginView
│   │   ├── hooks/                 # useAuth, useSSE
│   │   ├── lib/                   # API client wrapper
│   │   └── App.tsx                # Dashboard layout (Light Theme)
│   ├── vite.config.ts             # Vite dev server proxy
│   ├── .env.example               # Template environment frontend
│   └── package.json
├── docs/                          # Spesifikasi & dokumentasi lengkap
│   ├── api-spec.md                # Spesifikasi endpoint & payload Xiaomi
│   ├── auth-guide.md              # Panduan ekstraksi cookie cUserId & serviceToken
│   ├── automation-plan.md         # Rancangan arsitektur automasi & scheduler
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
# 1. Unit & Integration Test backend (100% native bun:test)
cd backend
bun test

# 2. Automated Full-Stack E2E Test (Playwright Chromium)
# Menguji alur Login, CRUD Akun, Live Cookie Test, SSE Sync, dan Log Clear
bun run test:e2e

# 3. Typecheck & Build frontend
cd ../frontend
bun run build
```
Semua unit test backend berjalan instan (< 100 ms) dan suite E2E memvalidasi seluruh fungsionalitas UI secara komprehensif.
