# Studio Video AI — dialog antar tokoh, suara berbeda tiap tokoh (gratis)

Frontend statis (`index.html`, `script.js`, `style.css`) + Cloudflare Worker (`src/index.js`).
Video dirakit & direkam langsung di browser (canvas + MediaRecorder), tanpa server render.

## Pasang (sekali saja)

### 1. Worker (otomatis lewat GitHub Actions)
1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token** → template *Edit Cloudflare Workers*.
2. Di repo GitHub: **Settings → Secrets and variables → Actions** → tambahkan
   `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`.
3. Push ke `main` (atau **Actions → Deploy Cloudflare Worker → Run workflow**).
   Worker aktif di `https://ai-motion-director-worker.<subdomain-anda>.workers.dev`.
   Binding `[ai]` di `wrangler.toml` mengaktifkan LLM & gambar FLUX gratis (Workers AI).

### 2. Halaman web (GitHub Pages)
**Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`.**
Alamat: `https://<username>.github.io/studio-ai/`

### 3. Hubungkan
Buka halaman → **Pengaturan koneksi** → isi URL Worker → **Tes koneksi**. Hasil yang diharapkan:
```
Workers AI (cerita + gambar FLUX) : ✓
Suara Edge (beda tiap tokoh)       : ✓   (jika ✕ → otomatis memakai suara Google dengan nada beda)
```

## Endpoint Worker
| Endpoint | Fungsi |
|---|---|
| `GET /api/health[?probe=1]` | status; `probe=1` ikut menguji suara Edge |
| `GET /api/tts?text&voice&pitch&rate&engine` | suara per tokoh: Edge TTS (Ardi/Gadis/dst.) → cadangan Google |
| `GET /api/image?prompt&seed&w&h` | gambar latar: FLUX (Workers AI) → cadangan Pollinations |
| `GET /api/fetch?url=` | proxy musik latar (audio) |
| `POST /api/plan` | naskah/topik → tokoh + adegan + dialog (LLM); gagal → penyusun lokal di browser |

Variabel opsional: `APP_TOKEN` (kata sandi), `EDGE_CHROMIUM_VERSION` (jika Edge menolak koneksi),
`EDGE_TTS=off`, `POLLINATIONS_TOKEN`, `LLM_API_URL` + `LLM_API_KEY` + `LLM_MODEL`.

## Catatan penting
- **Suara hanya terekam lewat Worker.** Suara bawaan browser (Web Speech) tidak bisa masuk ke video,
  jadi tanpa URL Worker video dibuat tanpa suara.
- Tiap tokoh punya suara + pitch + kecepatan sendiri; tombol **Simpan** (🔒) mengunci suara tokoh itu
  untuk video berikutnya (disimpan di perangkat).
- Video direkam real-time: biarkan layar menyala dan jangan pindah aplikasi saat merekam.
