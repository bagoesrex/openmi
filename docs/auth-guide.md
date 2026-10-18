# Panduan Ekstraksi Kredensial Xiaomi (Cookie Auth)

Dokumen ini menjelaskan cara mendapatkan `cUserId` dan `serviceToken` akun Xiaomi untuk didaftarkan ke dalam dashboard OpenMi.

---

## 1. Mengapa Perlu Input Cookie Manual?

Endpoint login resmi Xiaomi (`account.xiaomi.com`) menerapkan verifikasi captcha interaktif (Geetest) dan One-Time Password (OTP) via SMS. Menjalankan proses login otomatis dari server VPS tanpa interaksi manusia berisiko tinggi memicu pemblokiran IP atau penangguhan akun oleh sistem anti-fraud Xiaomi.

Menggunakan session cookie dari sesi login resmi yang sudah terverifikasi:
- Tidak memicu kecurigaan anti-fraud Xiaomi.
- Hanya perlu diinput **sekali** saat mendaftarkan akun di dashboard.
- Disimpan di database lokal VPS (`openmi.sqlite`) dan akan terus digunakan otomatis oleh scheduler setiap pukul 23:00 WIB hingga sesi tersebut kedaluwarsa.

---

## 2. Kredensial yang Dibutuhkan

Pada form **Add Account** di dashboard OpenMi, Anda hanya perlu mengisi dua parameter utama:

| Parameter | Contoh Nilai | Keterangan |
|---|---|---|
| `cUserId` | `6182930123` | ID Akun Xiaomi berupa deretan angka |
| `serviceToken` | `AQAA...` atau string alfanumerik panjang | Token otorisasi layanan Xiaomi Community |

---

## 3. Cara Mendapatkan Cookie

Pilih salah satu metode berikut:

### Metode A: Melalui Browser PC (Paling Mudah, Tanpa Tools Tambahan)

1. Buka browser (Google Chrome, Microsoft Edge, atau Firefox) di PC.
2. Login ke akun Xiaomi Anda di:  
   `https://account.xiaomi.com`
3. Setelah berhasil login, buka halaman permohonan unlock bootloader di tab yang sama:  
   - Akun Global: `https://new.c.mi.com/global/embedded/app/bl/lock`  
   - Akun Indonesia: `https://new.c.mi.com/id/embedded/app/bl/lock`
4. Buka **Developer Tools** dengan menekan tombol `F12` (atau klik kanan di halaman mana saja lalu pilih **Inspect**).
5. Masuk ke tab penyimpanan:
   - **Chrome / Edge**: Klik tab **Application** di bar atas DevTools -> di panel kiri buka menu **Storage** -> **Cookies** -> klik `https://new.c.mi.com`.
   - **Firefox**: Klik tab **Storage** -> **Cookies** -> `https://new.c.mi.com`.
6. Cari baris dengan nama cookie berikut:
   - Cari baris **`cUserId`** -> salin nilai pada kolom **Value** (contoh: `6182930123`).
   - Cari baris **`serviceToken`** -> salin nilai pada kolom **Value**.
7. Masukkan kedua nilai tersebut ke form **Add Account** di dashboard OpenMi.

---

### Metode B: Melalui Aplikasi Android (Reqable / HTTP Toolkit)

Jika Anda ingin mengambil cookie langsung dari aplikasi resmi **Xiaomi Community** di HP:

#### Menggunakan Reqable:
1. Install [Reqable](https://reqable.com/) di PC dan instal modul CA certificate di perangkat Android.
2. Aktifkan proxy capture di Reqable.
3. Buka aplikasi **Xiaomi Community** di HP -> navigasikan ke menu **Me** -> **Unlock Bootloader**.
4. Di jendela Reqable pada PC, filter request dengan domain `new.c.mi.com`.
5. Buka salah satu request (misalnya `GET /user/bl-switch/state`) -> buka tab **Request Headers**.
6. Periksa bagian header `Cookie`:
   - Ambil nilai setelah `cUserId=...;`
   - Ambil nilai setelah `serviceToken=...;`

---

## 4. Memverifikasi Masa Aktif Cookie

Setelah mendaftarkan akun di dashboard:
1. Klik tombol **Test Cookie** pada kartu akun di dashboard OpenMi.
2. Sistem akan memanggil endpoint `GET /user/bl-switch/state` ke server Xiaomi.
3. Jika status menampilkan **Valid (Hijau)**, sesi Anda aktif dan scheduler siap mengeksekusi apply pada pukul 23:00:00 WIB.

Jika status menampilkan **Expired (Merah)**:
- Sesi login telah kedaluwarsa, atau Anda telah logout dari browser/aplikasi resmi.
- Perbarui nilai `serviceToken` melalui tombol **Edit** (ikon pensil) pada kartu akun di dashboard.
