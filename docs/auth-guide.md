# Panduan Ekstraksi Kredensial Xiaomi (Cookie Auth)

Dokumen ini menjelaskan cara mendapatkan kredensial otorisasi sesi Xiaomi (`cUserId` dan `serviceToken`) untuk didaftarkan ke dalam dashboard OpenMi.

---

## 1. Mengapa Perlu Input Cookie Manual?

Endpoint login akun Xiaomi (`account.xiaomi.com`) menerapkan perlindungan anti-fraud tingkat lanjut:
* **Interactive Captcha** (Geetest sliding puzzle / icon matching).
* **One-Time Password (OTP)** via SMS ke nomor ponsel terdaftar.

Menjalankan proses login otomatis (scraping tanpa kepala) langsung dari IP server VPS sangat berisiko memicu pemblokiran IP, penolakan permintaan, atau pembekuan akun oleh sistem keamanan Xiaomi.

Dengan menggunakan session cookie dari sesi resmi yang sudah terotentikasi:
* Aman dari deteksi anti-fraud.
* Hanya perlu diekstrak dan diinput **satu kali** saat pendaftaran akun di dashboard.
* Disimpan secara aman di database lokal VPS (`openmi.sqlite`) dan akan terus digunakan otomatis oleh scheduler setiap pukul 23:00 WIB hingga masa berlaku sesi habis.

---

## 2. Kredensial yang Dibutuhkan

Pada form **Add Account** di dashboard OpenMi, terdapat dua parameter utama:

| Parameter | Contoh Nilai | Keterangan & Karakteristik |
|---|---|---|
| `cUserId` | `9DYH5LTHd5K6lwpI6a8n-kf0AiE` | ID unik akun terproteksi (hash) dari cookie Xiaomi. Sistem juga menerima ID numerik murni (`6793992260`). |
| `serviceToken` | `gY+CvEcFpgvEuQ4Hm...` (180+ karakter) | Token otorisasi layanan Xiaomi Community. |

### Catatan Penting Arsitektur Backend OpenMi:
* **Dual-Token Auto Delivery**: Server backend Xiaomi (`sgp-api.buy.mi.com`) memeriksa cookie `serviceToken` dan `new_bbs_serviceToken`. Sistem OpenMi secara otomatis menyertakan kedua token tersebut dengan nilai yang sama.
* **Auto URL-Encoding**: Nilai `serviceToken` sering mengandung karakter `+` (format Base64). OpenMi memiliki mekanisme normalisasi bawaan (`normalizeServiceToken`) yang otomatis mengubah `+` menjadi `%2B` pada HTTP header agar tidak tertukar menjadi karakter spasi oleh server Xiaomi.

---

## 3. Cara Mendapatkan Cookie

### Metode 1: Otomatis via Interactive Browser Capture (Rekomendasi Utama)

OpenMi menyediakan skrip automasi interaktif berbasis Playwright yang memanfaatkan browser Google Chrome asli di PC Anda:

1. Buka terminal di folder backend dan jalankan:
   ```bash
   cd backend
   bun run capture
   ```
2. Jendela browser Google Chrome akan terbuka secara otomatis dengan sesi persisten (`.chrome-session/`).
3. Silakan login ke akun Xiaomi Anda di jendela browser tersebut.
4. Begitu Anda selesai login:
   * Skrip secara otomatis mendeteksi sesi aktif.
   * Skrip mengarahkan browser ke halaman bootloader unlock (`https://new.c.mi.com/global/embedded/app/bl/lock`) untuk memicu pertukaran token SSO dan penerbitan `serviceToken`.
   * Skrip mengekstrak `cUserId` dan `serviceToken` non-kosong, lalu menyimpannya ke file `backend/captured-cookies.json`.
   * Skrip langsung menguji kredensial tersebut ke server resmi Xiaomi dan menampilkan hasil kelayakannya (*eligible/pass*).
5. Salin nilai `cUserId` dan `serviceToken` yang muncul di terminal ke dashboard OpenMi.

---

### Metode 2: Melalui Developer Tools Browser PC (Manual)

1. Buka browser (Chrome, Edge, atau Firefox) di PC.
2. Login ke akun Xiaomi Anda di:  
   `https://account.xiaomi.com`
3. Setelah login berhasil, buka tautan permohonan bootloader unlock berikut di tab yang sama:  
   * **Akun Global**: `https://new.c.mi.com/global/embedded/app/bl/lock`  
   * **Akun Indonesia**: `https://new.c.mi.com/id/embedded/app/bl/lock`
4. Buka **Developer Tools** dengan menekan tombol `F12` (atau klik kanan -> **Inspect**).
5. Buka tab penyimpanan cookies:
   * **Chrome / Edge**: Tab **Application** -> buka panel **Storage** -> **Cookies** -> klik domain `.mi.com` atau `sgp-api.buy.mi.com`.
   * **Firefox**: Tab **Storage** -> **Cookies** -> domain `.mi.com`.
6. Salin nilai cookie berikut:
   * **`cUserId`**: Salin nilai pada kolom Value.
   * **`serviceToken`** atau **`new_bbs_serviceToken`**: Salin string token panjang pada kolom Value.
7. Masukkan kedua nilai tersebut ke form pendaftaran akun di dashboard OpenMi.

---

### Metode 3: Melalui Aplikasi Android (Reqable / Network Sniffer)

Jika Anda ingin mengekstrak cookie langsung dari aplikasi resmi **Xiaomi Community** di HP Android:

1. Install [Reqable](https://reqable.com/) di PC dan pasang sertifikat CA di HP.
2. Aktifkan penangkapan lalu lintas (proxy capture).
3. Buka aplikasi **Xiaomi Community** di HP -> masuk ke tab **Me** -> **Unlock Bootloader**.
4. Di Reqable PC, filter request ke host **`sgp-api.buy.mi.com`** atau **`new.c.mi.com`**.
5. Buka request `GET /bbs/api/global/user/bl-switch/state` -> lihat tab **Request Headers**.
6. Ambil nilai `cUserId` dan `serviceToken` dari header `Cookie: ...`.

---

## 4. Memverifikasi Masa Aktif Cookie

Setelah mendaftarkan akun di dashboard OpenMi:
1. Klik tombol **Test Cookie** pada kartu akun yang bersangkutan.
2. OpenMi akan menghubungi server REST API Xiaomi (`https://sgp-api.buy.mi.com/bbs/api/{region}/user/bl-switch/state`).
3. Evaluasi hasil:
   * **Valid (Hijau)**: Kredensial aktif, sesi valid, dan status kesiapan tombol (`button_state: 1`) terkonfirmasi. Scheduler siap mengeksekusi apply pada pukul 23:00:00 WIB.
   * **Expired (Merah)**: Sesi login sudah kedaluwarsa atau server menolak kredensial (`code: 100004 need login`). Anda dapat memperbarui token melalui tombol **Edit** (ikon pensil).
