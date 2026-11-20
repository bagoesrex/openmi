# OpenMi — Frontend Web Dashboard

Antarmuka web SPA (Single Page Application) modern untuk OpenMi yang dibangun menggunakan **React 19**, **Vite**, dan **Tailwind CSS**, berjalan sepenuhnya di atas ekosistem **Bun**.

Dashboard ini dirancang untuk di-deploy ke **Vercel** dan berkomunikasi secara aman dengan daemon backend OpenMi di VPS.

---

## Fitur UI Utama

1. **Master Password Auth Screen**: Layar login terproteksi yang memverifikasi password master ke backend VPS dan menyimpan sesi JWT di `localStorage`.
2. **Live 23:00 WIB Countdown Header**: Menghitung mundur detik demi detik menuju waktu reset kuota resmi Xiaomi (00:00:00 GMT+8 Beijing Time = 23:00:00 WIB).
3. **Multi-Account Card Manager**:
   * Menampilkan daftar akun aktif beserta Region (`global` / `id`), status validitas cookie, dan badge profil *Timing Mode* (*Asia*, *Global*, atau *Custom*).
   * **Test Cookie**: Validasi sesi akun secara live ke server Xiaomi API.
   * **Test Burst**: Uji coba simulasi 3 gelombang tembakan (*dry-run*) untuk mengukur latensi respons.
   * Tombol Edit & Hapus akun dengan konfirmasi.
4. **Interactive Account Modal**:
   * **Tab 1 — Scan QR Login**: Memuat kode QR SSO resmi Xiaomi secara instan. Menampilkan status *Waiting*, *Scanned*, atau *Error* (dengan tombol *Try Again*), dan otomatis mengisi field akun begitu otorisasi disetujui di ponsel.
   * **Tab 2 — Manual Input**: Pengisian manual `label`, `region`, `cUserId`, `serviceToken`, `proxyUrl`, dan konfigurasi *Timing Mode*.
5. **Real-time Live Stream Log Terminal**:
   * Menampilkan streaming log aktivitas backend secara langsung detik demi detik via Server-Sent Events (SSE).
   * Tombol **Clear Logs** yang menghapus riwayat secara permanen dari database SQLite backend.
   * Indikator status koneksi SSE (*Live Sync*).

---

## Variabel Lingkungan (.env)

Buat file `.env` di folder `frontend/`:

```env
# URL API Backend OpenMi (VPS)
# Kosongkan atau gunakan http://localhost:3001 saat pengembangan lokal
VITE_API_BASE_URL=http://localhost:3001
```

Saat di-deploy ke Vercel, atur environment variable `VITE_API_BASE_URL` ke domain atau IP server VPS backend Anda.

---

## Perintah Pengembangan

```bash
# Instalasi dependensi
bun install

# Menjalankan Vite development server (port 3000)
bun run dev

# Memeriksa tipe TypeScript dan membangun bundle produksi
bun run build

# Meninjau hasil build lokal
bun run preview
```
