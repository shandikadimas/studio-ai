# Checkpoint Studio Video AI — v7.0 (27 Nov 2026)

| Bagian | Versi / status |
|---|---|
| worker.js | **7.0** (`/api/health` menampilkan versi, otak, suara Gemini) |
| index.html | memuat `pen.js?v=70` & `script.js?v=70` |
| script.js | gaya Stickman, suara Gemini per tokoh, SRT/WAV, emosi & alur karakter, tunggu limit otomatis, AI Horde, prompt cadangan lokal |
| pen.js, style.css | tidak diubah |
| wrangler.toml | `keep_vars`, `[ai]`, `[vars]` BRAIN_BASE_URL & BRAIN_MODEL (`gemini-3.8-flash`); opsi GEMINI_TTS_MODEL |
| deploy-worker.yml | deploy dulu, lalu kirim `BRAIN_API_KEY` (opsional, tidak menggagalkan run) |
| opsional/bridge.py | tidak dipakai (agy tidak ada di Termux); kolom jembatan di situs biarkan kosong |

## Cara pasang
1. Salin semua file ke root repo (struktur folder sama, termasuk `.github/workflows/`). `opsional/` boleh diabaikan.
2. GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BRAIN_API_KEY` (kunci Gemini dari AI Studio, buat ulang bila pernah terkirim di chat).
3. Tunggu Actions hijau (Worker & Pages), buka situs dengan `?x=N`, tekan **Tes koneksi**: harus tampil Worker v7.0, otak `gemini-3.8-flash ✓`, Suara Gemini ✓.

## Urutan mesin
- Otak: Gemini → Workers AI → prompt cadangan lokal.
- Suara: Gemini (per tokoh) → Edge → Google.
- Gambar: Worker (FLUX → Lucid → Phoenix) → AI Horde → Pollinations → latar gradien. Stickman & Sketsa Pena tidak butuh gambar AI.

## Diuji (simulasi, belum di browser/Cloudflare asli)
- Muat skrip, sintaks JS/TOML/YAML, SRT, tata letak 1–8 tokoh, pemilihan suara unik per tokoh, tunggu kuota Gemini, emosi & alur dari sutradara, endpoint `/api/gtts` (WAV, fallback suara, kuota), `/api/health`.
- Gambar stickman dirender ke PNG untuk pemeriksaan visual.

## Belum teruji / catatan
- Nama 30 suara Gemini berasal dari dokumentasi Google (hanya "Kore" yang saya konfirmasi lewat pencarian); suara yang ditolak otomatis jadi Kore.
- Nama model TTS `gemini-3.1-flash-tts-preview` perlu cocok dengan akun Anda; ganti lewat `GEMINI_TTS_MODEL` bila perlu.
- Batas jatah gratis Gemini TTS belum diketahui; mode tunggu limit membantu untuk limit per menit, bukan limit harian yang panjang.
- Suara Edge ditolak Microsoft (403): otomatis memakai suara lain.
