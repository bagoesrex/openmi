# OpenMi — Xiaomi Community API Reference

Dokumen ini merupakan referensi spesifikasi teknis REST API resmi Xiaomi Community yang digunakan oleh OpenMi untuk pengecekan status dan pendaftaran kuota bootloader unlock.

*Basis Rekayasa Balik: Xiaomi Community v5.4.40 (Build 500440, com.mi.global.bbs)*

---

## 1. Arsitektur Domain & Base URL

Berdasarkan hasil dekompilasi aplikasi resmi Xiaomi Community (`vc/i.java` & `commonbiz/network/e.java`) dan pengujian langsung (*live test*):

| Kategori | Host URL | Peran & Perilaku |
|---|---|---|
| **REST API Server (Default / Asia / ID)** | `https://sgp-api.buy.mi.com/bbs/api/{region}/` | Server backend cluster Singapura. Mengembalikan payload JSON murni. |
| **REST API Server (Rusia)** | `https://ru-api.buy.mi.com/bbs/api/ru/` | Server backend cluster Rusia. |
| **REST API Server (Eropa)** | `https://ams-api.buy.mi.com/bbs/api/eu/` | Server backend cluster Eropa (Amsterdam). |
| **Web Frontend / CDN** | `https://new.c.mi.com/{region}/` | Halaman Single Page Application (HTML/JS/CSS). Bukan endpoint data JSON. |

*Region yang didukung*: `global` (default), `id` (Indonesia), `ru`, `eu`.

---

## 2. Format Header & Autentikasi Wajib

Setiap panggilan ke endpoint REST API Xiaomi wajib menyertakan header berikut:

```http
User-Agent: Mozilla/5.0 (Linux; Android 14; 23117PN0CG Build/UKQ1.230804.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.88 Mobile Safari/537.36 XiaoMi/MiuiBrowser/4.3
Accept: application/json, text/plain, */*
Content-Type: application/json
Cookie: cUserId=<cUserId>; serviceToken=<token>; new_bbs_serviceToken=<token>
```

### Aturan Header Cookie:
1. **Dual-Token**: Backend Xiaomi memeriksa keberadaan `serviceToken` dan `new_bbs_serviceToken`. Keduanya harus diisi dengan nilai token otorisasi yang sama.
2. **URL-Encoding**: Karakter `+` pada string token wajib di-encode menjadi `%2B` agar tidak diinterpretasikan sebagai spasi oleh server.

---

## 3. Daftar Endpoint

### 3.1. Cek Global Feature Switch
Memeriksa apakah fitur permohonan bootloader unlock sedang aktif secara global oleh Xiaomi.

* **Method**: `GET`
* **URL**: `{base}/bl-switch/value`
* **Contoh URL**: `https://sgp-api.buy.mi.com/bbs/api/global/bl-switch/value`

**Contoh Response Sukses:**
```json
{
  "code": 0,
  "data": 1,
  "msg": "success",
  "tc": "bc3d3c1709e8dc63e7b4452588b22ace",
  "ts": 1792325318
}
```

| Field | Type | Deskripsi |
|---|---|---|
| `code` | Integer | `0` = Sukses |
| `data` | Integer | `1` = Fitur aktif global, `0` = Fitur dimatikan oleh Xiaomi |
| `ts` | Long | Unix timestamp server Xiaomi |

---

### 3.2. Cek User State (Validasi Kredensial & Kelayakan)
Memeriksa status akun, validitas sesi cookie, dan kesiapan tombol permohonan user saat ini.

* **Method**: `GET`
* **URL**: `{base}/user/bl-switch/state`
* **Contoh URL**: `https://sgp-api.buy.mi.com/bbs/api/global/user/bl-switch/state`

**Contoh Response Sukses (Akun Memenuhi Syarat):**
```json
{
  "code": 0,
  "data": {
    "function_switch": 1,
    "button_state": 1,
    "is_pass": 4,
    "deadline": 0,
    "deadline_format": ""
  },
  "msg": "success",
  "tc": "e215c231c67625469ba188357c5ca098",
  "ts": 1792325337
}
```

| Field | Type | Deskripsi |
|---|---|---|
| `code` | Integer | `0` = Sukses, `100004` = Cookie tidak valid / perlu login ulang (`need login`) |
| `data.button_state` | Integer | `1` = Memenuhi syarat & tombol "Apply" aktif; `2` = Sedang cooldown / dilarang apply |
| `data.function_switch` | Integer | Status switch fitur untuk akun ini (`1` = aktif) |
| `data.is_pass` | Integer | `1` = Sudah memperoleh izin unlock; `4` = Belum unlock / siap mendaftar |
| `data.deadline` | Long | Timestamp masa berlaku / cooldown (jika `button_state` = 2) |
| `data.deadline_format` | String | Format tanggal readable cooldown (contoh: `"2026-11-17 23:00"`) |

---

### 3.3. Apply Unlock Bootloader (Eksekusi Kuota)
Endpoint utama yang dipanggil secara otomatis oleh scheduler OpenMi tepat pada pukul **23:00:00 WIB (00:00:00 GMT+8)**.

* **Method**: `POST`
* **URL**: `{base}/apply/bl-auth`
* **Contoh URL**: `https://sgp-api.buy.mi.com/bbs/api/global/apply/bl-auth`
* **Payload JSON**:
  * Request pertama (T-0s): `{"is_retry": false}`
  * Request retry (T+1s s.d. T+3s): `{"is_retry": true}`

**Contoh Response:**
```json
{
  "code": 0,
  "data": {
    "apply_result": 1,
    "deadline": 1794931200,
    "deadline_format": "2026-11-17 23:00"
  },
  "msg": "success"
}
```

---

## 4. Evaluasi Kode Hasil (`applyResult`)

State machine engine OpenMi memetakan seluruh 7 kode status hasil dekompilasi APK resmi:

| `applyResult` | Nama Status Resmi | Interpretasi Teknis | Aksi State Machine OpenMi |
|---|---|---|---|
| **`1`** | **Pass / Success** | Permohonan disetujui, akun berhasil mendapatkan kuota unlock. | **Selesai**. Simpan status sukses dan kirim notifikasi. |
| **`2`** | **Account / Device Limit** | Akun atau perangkat mencapai batas bulanan/tahunan atau dalam masa penalti. | **Selesai**. Catat tenggat waktu `deadline`. |
| **`3`** | **Daily Quota Exhausted** | Kuota harian untuk region ini telah habis direbut pengguna lain. | **Selesai**. Standby untuk jadwal reset berikutnya. |
| **`4`** | **Verification Cooldown** | Sedang dalam masa tunggu verifikasi reguler. | **Selesai**. Catat tenggat waktu `deadline`. |
| **`5`** | **Transient Failure** | Terjadi kegagalan jaringan internal di sisi Xiaomi. | **Immediate Retry** dengan payload `{"is_retry": true}`. |
| **`6`** | **Rate Limited** | Request terlalu cepat / terdeteksi spam. | **Cooldown 60 Detik**, kemudian lakukan 1x retry. |
| **`7`** | **Server Busy** | Server Xiaomi kelebihan beban saat puncak traffic reset kuota. | **Immediate Retry** dengan payload `{"is_retry": true}`. |

---

## 5. Alur Eksekusi Zero-Hour di OpenMi

```
[T-10s] 22:59:50 WIB ──> TLS Pre-warming: Buka socket keep-alive ke sgp-api.buy.mi.com
[T-5s]  22:59:55 WIB ──> Pre-check: GET user/bl-switch/state (validasi sesi akun)
[T-0s]  23:00:00.000 WIB ──> Zero-Hour Apply: POST apply/bl-auth {"is_retry": false}
                          │
                          ├─ Code 1 ────> ✅ SUKSES (Simpan & Notifikasi)
                          ├─ Code 3 ────> Kuota habis (Standby esok hari)
                          ├─ Code 5/7 ──> Auto-retry {"is_retry": true} dalam 300ms
                          ├─ Code 6 ────> Tunggu 60s, lalu retry 1x
                          └─ Code 2/4 ──> Cooldown perangkat (Selesai)
```
