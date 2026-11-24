# AI Motion Director — Cloudflare Worker

Backend API ringan untuk **AI Motion & Storytelling Director** dengan *endpoint*:
- `GET /health` — Cek status Worker
- `POST /api/plan` — Meracik naskah/topik menjadi daftar adegan lengkap dengan objek/properti, `imagePrompt`, `motionPrompt`, dan gerakan kamera adaptif
- `POST /api/image` — Endpoint generasi gambar (mendukung binding Workers AI `env.AI` bila diaktifkan di `wrangler.toml`, atau mengembalikan prompt siap pakai)
- `POST /api/tts` — Endpoint narasi/voiceover siap dihubungkan ke layanan TTS
- `GET /api/fetch?url=...` — Proxy ambil konten/teks URL eksternal dengan header CORS

## Menjalankan & Deploy
1. Masuk ke folder proyek:
   ```bash
   cd ai-motion-director-worker
   npm install -g wrangler
   ```
2. Uji lokal:
   ```bash
   wrangler dev
   ```
3. Deploy ke Cloudflare:
   ```bash
   wrangler deploy
   ```
