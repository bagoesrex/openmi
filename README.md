# OpenMi — Xiaomi Bootloader Unlock Tool

Proyek ini adalah developer tool untuk mempermudah proses apply unlock bootloader melalui API Xiaomi Community, sebagai alternatif dari UI app yang sering tidak responsif saat high traffic.

## Latar Belakang

Xiaomi menyediakan fitur unlock bootloader melalui Xiaomi Community app. Proses apply melalui UI app seringkali gagal karena tingginya jumlah request pada waktu bersamaan, sehingga app menjadi tidak responsif. OpenMi mengakses API yang sama secara langsung untuk pengalaman yang lebih reliable.

## Struktur Project

```
openmi/
├── Xiaomi-Community.apk              # Referensi APK
├── docs/
│   ├── README.md                     # File ini
│   ├── api-spec.md                   # Dokumentasi API endpoint
│   ├── auth-guide.md                 # Panduan autentikasi
│   └── automation-plan.md            # Rencana pengembangan
├── reverse-engineering/
│   ├── decompile-summary.md          # Ringkasan hasil analisis APK
│   ├── api-endpoints-raw.md          # Detail endpoint dari source
│   ├── auth-mechanism.md             # Mekanisme autentikasi
│   └── apply-result-codes.md         # Kode respons API
├── backend/                          # (akan dibuat) API server
├── frontend/                         # (akan dibuat) Web dashboard
└── scripts/                          # (akan dibuat) CLI tool
```

## Quick Start

1. Baca `docs/api-spec.md` — dokumentasi API yang digunakan
2. Ikuti `docs/auth-guide.md` — setup autentikasi
3. Lihat `docs/automation-plan.md` — roadmap pengembangan
4. Detail teknis ada di `reverse-engineering/`

## Catatan

- Informasi API diperoleh dari analisis Xiaomi Community APK
- OpenMi menggunakan akun milik pengguna sendiri
- Session cookie perlu di-refresh secara berkala
