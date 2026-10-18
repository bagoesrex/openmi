# OpenMi — Authentication Guide

OpenMi membutuhkan session cookie dari akun Xiaomi Anda. Berikut cara mendapatkannya.

---

## Cookie yang Dibutuhkan

Minimal:
```
cUserId=XXXXXXXXXX; serviceToken=YYYYYYYYYYYY
```

Opsional (mungkin diperlukan):
```
{sid}_slh=ZZZZ; {sid}_ph=WWWW
```

---

## Metode 1: HTTP Toolkit (Direkomendasikan)

**Kelebihan:** Paling mudah, auto-decrypt HTTPS.

1. Download & install [HTTP Toolkit](https://httptoolkit.com/) di PC
2. Buka HTTP Toolkit → pilih "Android Device via ADB"
3. HP terhubung via USB dengan USB Debugging aktif
4. Buka Xiaomi Community app di HP
5. Navigate ke halaman Bootloader Unlock
6. Di HTTP Toolkit, filter request ke `new.c.mi.com`
7. Klik salah satu request → tab "Headers"
8. Copy value dari header `Cookie`
9. Simpan ke `config.json` (lihat format di bawah)

## Metode 2: mitmproxy

1. Install mitmproxy: `pip install mitmproxy`
2. Jalankan: `mitmweb --listen-port 8080`
3. Set proxy di HP: IP komputer, port 8080
4. Install CA cert mitmproxy di HP (buka `mitm.it` dari browser HP)
5. Buka Xiaomi Community app → halaman Bootloader
6. Di mitmweb, cari request ke `new.c.mi.com`
7. Copy Cookie header

## Metode 3: Browser DevTools

1. Buka Chrome/Edge di PC
2. Login ke akun Xiaomi di `https://account.xiaomi.com`
3. Buka `https://new.c.mi.com/global/embedded/app/bl/lock`
4. Tekan F12 → tab Network
5. Refresh halaman
6. Klik request pertama → Headers → Cookie
7. Copy seluruh cookie string

---

## Format Config

Simpan cookie di `config.json` (di root project):

```json
{
  "cookie": "cUserId=XXXXXXXXXX; serviceToken=YYYYYYYYYYYY",
  "region": "global",
  "target_hour": 23,
  "target_minute": 0,
  "target_second": 0,
  "concurrent_requests": 5,
  "pre_connect_seconds": 10
}
```

| Field | Keterangan |
|-------|------------|
| `cookie` | Cookie string dari akun Xiaomi |
| `region` | Region app: `global`, `id`, dll |
| `target_hour` | Jam target (WIB) — default 23 |
| `target_minute` | Menit target — perlu diverifikasi via polling |
| `target_second` | Detik target — perlu diverifikasi via polling |
| `concurrent_requests` | Jumlah request paralel |
| `pre_connect_seconds` | Detik sebelum target untuk pre-connect |

---

## Verifikasi Cookie

Test apakah cookie valid:

```bash
curl -s "https://new.c.mi.com/global/user/bl-switch/state" \
  -H "Cookie: cUserId=XXX; serviceToken=YYY" \
  -H "User-Agent: Mozilla/5.0 XiaoMi/MiuiBrowser/4.3"
```

Response `"code": 0` = cookie valid. Error code = expired/invalid.

---

## Catatan

- Cookie akan expire — refresh sebelum setiap penggunaan
- `serviceToken` adalah credential utama
- Jangan share cookie — setara dengan password
- Login ulang di app bisa membuat cookie sebelumnya invalid
