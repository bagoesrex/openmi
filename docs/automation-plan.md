# OpenMi — Architecture & Automation Plan

Dokumen ini menjelaskan strategi automasi, arsitektur teknis, dan alur eksekusi presisi tinggi yang diterapkan pada platform OpenMi.

---

## 1. Latar Belakang & Motivasi

Mekanisme permohonan kuota resmi bootloader unlock Xiaomi memiliki karakteristik kritis:
* Kuota harian dibuka sekali per hari tepat pada pukul **00:00:00 GMT+8 (Beijing Time)** = **23:00:00 WIB**.
* Kuota habis dalam hitungan 1 hingga 3 detik di seluruh dunia.
* Melakukan apply melalui antarmuka visual aplikasi Xiaomi Community di smartphone sering mengalami kegagalan karena *render lag* WebView, interaksi sentuhan yang lambat, dan waktu negosiasi TLS/DNS yang terlambat.

**Solusi OpenMi**: Memindahkan seluruh proses eksekusi ke background VPS berkecepatan tinggi yang berkomunikasi langsung dengan REST API Xiaomi melalui socket ter-prewarm tepat pada milidetik ke-0.

---

## 2. Arsitektur Sistem

OpenMi mengadopsi prinsip **Clean Architecture** berbasis 100% ekosistem **Bun**:

```
openmi/
├── backend/                       # Headless Daemon Service (Linux VPS)
│   ├── src/
│   │   ├── domain/                # Entitas Inti: Account & Log
│   │   ├── db/                    # bun:sqlite schema, client, & repositories
│   │   ├── services/
│   │   │   ├── xiaomi/            # REST Client (sgp-api) & 7-Code State Machine
│   │   │   ├── ntp.ts             # Cloudflare trace sub-second time sync (±10ms)
│   │   │   ├── scheduler.ts       # Precision countdown & zero-hour execution
│   │   │   └── broadcaster.ts     # Real-time SSE event bus
│   │   ├── api/                   # REST Routes (Auth JWT, Accounts CRUD, Logs)
│   │   ├── app.ts                 # Elysia Application Definition & CORS
│   │   └── index.ts               # Daemon Entrypoint & Graceful Shutdown
│   ├── scripts/
│   │   ├── capture-cookies.ts     # Interactive Chrome cookie capture tool
│   │   └── run-e2e.ts             # Full-Stack Playwright automated test runner
│   └── tests/                     # Unit & Integration tests (bun:test)
├── frontend/                      # Web Control Dashboard (Vercel SPA)
│   ├── src/
│   │   ├── components/            # Header, AccountCard, AccountModal, LogTerminal, LoginView
│   │   ├── hooks/                 # useAuth, useSSE
│   │   ├── lib/                   # API client wrapper
│   │   └── App.tsx                # Dashboard layout & state orchestration
│   ├── vite.config.ts             # Vite configuration with tailwindcss
│   └── package.json
└── docs/                          # Technical Specifications & Guides
```

---

## 3. Strategi Waktu Eksekusi (Zero-Hour Execution Lifecycle)

Untuk memastikan request mendarat di server Xiaomi pada detik pertama kuota dibuka, scheduler OpenMi menjalankan siklus hidup berikut:

| Titik Waktu | Nama Tahapan | Aksi Teknis |
|---|---|---|
| **Berkala (Tiap Jam)** | **NTP Clock Sync** | Menghubungi edge trace time service untuk mengkalibrasi offset jam lokal VPS (toleransi drift < 10ms). |
| **T-10 Detik (22:59:50 WIB)** | **TLS Pre-warming** | Membuka koneksi TCP + TLS handshake awal ke `https://sgp-api.buy.mi.com` agar saat jam 23:00 tidak ada latensi DNS lookup atau handshake TLS. |
| **T-5 Detik (22:59:55 WIB)** | **Pre-flight Healthcheck** | Memanggil `GET user/bl-switch/state` untuk memverifikasi validitas sesi cookie semua akun aktif. |
| **T-0 Detik (23:00:00.000 WIB)** | **Zero-Hour Fire** | Mengirimkan request paralel `POST apply/bl-auth` (`{"is_retry": false}`) secara instan untuk seluruh akun yang diaktifkan (`auto_apply_enabled: 1`). |
| **T+0.2s s.d. T+3s** | **State Machine Processing** | Menganalisis kode hasil. Jika menerima kode 5 (*Transient failure*) atau kode 7 (*Server busy*), scheduler otomatis menembak retry `{"is_retry": true}` dalam rentang 300ms. |

---

## 4. Keandalan & Penanganan Error Diagnostik

Setiap aktivitas, pengujian, maupun eksekusi permohonan kuota dicatat ke database SQLite `openmi.sqlite` dan disiarkan langsung melalui Server-Sent Events (SSE) dengan metadata lengkap:
* `timestamp`: Unix timestamp milidetik.
* `action`: Jenis aksi (`CHECK_STATE`, `APPLY_AUTH`, `PRE_WARM`).
* `result_code`: Kode integer respons Xiaomi (`0`, `1`, `2`, `3`, `5`, `6`, `7`, `100004`).
* `raw_payload`: Body JSON mentah dari server Xiaomi.
* `error_details`: Catatan analisis teknis yang dapat dibaca manusia maupun AI coding agent untuk troubleshooting.
* `clear_logs`: Dukungan endpoint `DELETE /api/logs` untuk mengosongkan riwayat log secara permanen di database.
