# OpenMi — Xiaomi Bootloader Unlock Platform

OpenMi adalah platform manajemen multi-akun dan automasi tingkat lanjut untuk memonitor, menguji, dan mendaftarkan kuota resmi unlock bootloader Xiaomi melalui integrasi API langsung Xiaomi Community.

Platform ini dibangun sepenuhnya di atas ekosistem **Bun** dengan Clean Architecture:
- **Backend (VPS)**: Bun + ElysiaJS + `bun:sqlite` + `@elysiajs/jwt` + Server-Sent Events (SSE).
- **Frontend (Vercel)**: Bun + React 19 + Vite + Tailwind CSS.

---

## Fitur Utama

1. **Multi-Account Management**: Kelola banyak akun Xiaomi sekaligus (Label, Region `global`/`id`, `cUserId`, `serviceToken`, dan opsi outbound Proxy).
2. **High-Precision Scheduler**: Berjalan 24/7 di VPS, tersinkronisasi dengan NTP, melakukan TLS pre-warming pada T-10 detik, verifikasi sesi pada T-5 detik, dan eksekusi request concurrent tepat pada **23:00:00 WIB** (**00:00:00 GMT+8 Beijing Time**).
3. **State Machine 7 Kode Respons**: Menangani seluruh 7 kode hasil resmi (`applyResult`) dari dekompilasi aplikasi Xiaomi Community (termasuk auto-retry pintar untuk kode 5 dan 7, serta cooldown 60 detik untuk kode 6).
4. **Rich Diagnostic Error Logging**: Setiap kegagalan dicatat secara terstruktur (timestamp ms, endpoint, HTTP status, kode Xiaomi, raw response body, dan saran diagnostik teknis yang siap dikonsumsi AI coding agent).
5. **Real-time Live Stream Console**: Log eksekusi disiarkan detik demi detik ke dashboard web via Server-Sent Events (SSE).
6. **Single-Tenant Security**: Seluruh akses diproteksi dengan `MASTER_PASSWORD` di `.env` yang menerbitkan JSON Web Token (JWT).

---

## Autentikasi dan Ekstraksi Cookie

OpenMi menggunakan session cookie (`cUserId` dan `serviceToken`) dari akun Xiaomi yang sudah login resmi. Hal ini dilakukan untuk menghindari sistem anti-fraud captcha (Geetest) dan OTP SMS yang diterapkan Xiaomi pada endpoint login langsung.

Panduan langkah demi langkah cara mengambil cookie dari browser PC atau aplikasi HP tersedia di dokumen terpisah:
- **[Panduan Ekstraksi Kredensial Xiaomi](docs/auth-guide.md)**

Kredensial cukup diinput satu kali saat pendaftaran akun di dashboard dan akan tersimpan di database lokal VPS hingga sesi kedaluwarsa.

---

## Struktur Monorepo

```
openmi/
├── backend/                       # VPS Daemon Service
│   ├── src/
│   │   ├── domain/                # Clean Architecture Entities (Account, Log)
│   │   ├── db/                    # bun:sqlite schema, client, & repositories
│   │   ├── services/
│   │   │   ├── xiaomi/            # Xiaomi API client & 7-code state machine
│   │   │   ├── ntp.ts             # Network time synchronization
│   │   │   ├── scheduler.ts       # Precision countdown & zero-hour execution
│   │   │   └── broadcaster.ts     # Real-time SSE event bus
│   │   ├── api/                   # Elysia REST routes (auth, accounts, logs)
│   │   ├── app.ts                 # Elysia app definition & CORS
│   │   └── index.ts               # Daemon entrypoint
│   ├── tests/                     # Unit & Integration tests (bun:test)
│   ├── openmi.service             # Systemd service unit template untuk VPS
│   └── package.json
├── frontend/                      # React SPA Dashboard (Vercel)
│   ├── src/
│   │   ├── components/            # Header, AccountCard, AccountModal, LogTerminal, LoginView
│   │   ├── hooks/                 # useAuth, useSSE
│   │   ├── lib/                   # API client wrapper
│   │   └── App.tsx                # Dashboard layout
│   ├── vite.config.ts
│   └── package.json
├── docs/                          # Spesifikasi & dokumentasi lengkap
│   ├── api-spec.md                # Spesifikasi endpoint & payload Xiaomi
│   ├── auth-guide.md              # Panduan ekstraksi cookie cUserId & serviceToken
│   └── superpowers/               # Rancangan arsitektur & SDD plan
└── vercel.json                    # Konfigurasi deployment Vercel
```

---

## Panduan Menjalankan Lokal

### Prasyarat
- [Bun](https://bun.sh) v1.4+ terinstall di sistem.

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
   nano .env # Set MASTER_PASSWORD dan JWT_SECRET yang aman
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

## Menjalankan Test Suite

```bash
# Test backend (100% native bun:test)
cd backend
bun test

# Typecheck & Build frontend
cd ../frontend
bun run build
```
Semua unit test dijalankan tanpa emulator/container pihak ketiga, cepat (< 100 ms).
