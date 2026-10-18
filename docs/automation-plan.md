# OpenMi — Development Plan

## Motivasi

Proses apply unlock bootloader melalui UI Xiaomi Community app sering gagal karena tingginya traffic pada waktu tertentu, menyebabkan app tidak responsif. OpenMi mengakses API yang sama secara langsung untuk pengalaman yang lebih reliable.

---

## Roadmap

### Phase 1: Setup Autentikasi
- Capture session cookie melalui HTTP Toolkit / mitmproxy
- Extract cookie: `cUserId` + `serviceToken`
- Simpan di `config.json`
- Lihat detail: `docs/auth-guide.md`

### Phase 2: API Monitoring
- Script monitoring `GET user/bl-switch/state` secara periodik
- Log perubahan `buttonState`
- Identifikasi window waktu saat API available
- Jalankan beberapa kali untuk verifikasi konsistensi

### Phase 3: CLI Tool & Backend
- CLI tool untuk apply via command line
- Backend API server untuk manage session & scheduling
- Fitur:
  - **Time sync** — sinkronisasi waktu dengan server NTP
  - **Connection pooling** — reuse koneksi TCP+TLS
  - **Concurrent requests** — kirim beberapa request paralel
  - **Response handling** — logic berdasarkan `applyResult` code
  - **Logging** — semua response di-log ke file
  - **Notification** — desktop notification saat berhasil

### Phase 4: Frontend Dashboard & Reliability
- Web dashboard untuk monitoring status & trigger apply
- HTTP/2 support
- Minimal request overhead
- Configurable retry strategy
- Optional remote deployment

---

## Arsitektur

```
openmi/
├── scripts/
│   ├── config.json              # Session config
│   ├── monitor.py               # API state monitoring
│   └── apply.py                 # CLI apply tool
├── backend/
│   ├── api/                     # REST API endpoints
│   ├── services/                # Business logic
│   └── scheduler/               # Timed job runner
├── frontend/
│   ├── src/
│   │   ├── pages/               # Dashboard pages
│   │   └── components/          # UI components
│   └── ...
└── shared/
    ├── api.py                   # HTTP client wrapper
    ├── timing.py                # NTP sync & precision timing
    └── notify.py                # Notification handler
```

---

## Request Flow

```
[T-10s]  Setup: buka koneksi ke new.c.mi.com
[T-5s]   Check: GET user/bl-switch/state → verifikasi status
[T-0s]   Apply: POST apply/bl-auth (concurrent)
         │
         ├─ applyResult=1 → ✅ Berhasil — notifikasi & selesai
         ├─ applyResult=3 → Limit tercapai — selesai
         ├─ applyResult=5 → Gagal — retry (is_retry=true)
         ├─ applyResult=6 → Rate limited — tunggu 60s, retry
         ├─ applyResult=7 → Sementara gagal — retry
         └─ applyResult=2,4 → Cooldown — selesai
         │
[T+1-3s] Retry jika diperlukan
[T+10s]  Timeout → log hasil
```

---

## Considerations

| Area | Approach |
|------|----------|
| Session expiry | Verify cookie sebelum setiap run |
| API availability window | Konfirmasi via monitoring |
| Request rate | Batasi concurrent requests |
| Timeout | 5s per-request |
| Connection failure | Retry dengan backoff |

---

## Checklist

- [ ] Setup autentikasi (Phase 1)
- [ ] Jalankan monitoring (Phase 2)
- [ ] Build & test CLI tool (Phase 3)
- [ ] Dry-run
- [ ] Production run
- [ ] Optimasi jika diperlukan (Phase 4)
