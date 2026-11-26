# Studio Video AI v6.2

Buat video dari naskah + suara, langsung di browser (canvas + MediaRecorder, tanpa server render).
Frontend statis (`index.html`, `script.js`, `pen.js`, `style.css`) di GitHub Pages + satu Cloudflare Worker (`worker.js`).

## Gaya yang tersedia

| Gaya | Cocok untuk |
|---|---|
| **Komik Adegan Penuh** | Sejarah, perjuangan, drama: tiap baris naskah jadi satu gambar komik utuh (tokoh, aksi, reaksi, latar), tanpa tempelan ikon atau pena. Maks 48 gambar. Butuh Worker v6.2 agar adegan akurat. |
| **Sketsa Pena Animator** | Cerita & penjelasan masalah: tangan memegang pena menggambar doodle berwarna di kertas, tiap kata kunci (masalah, uang, harga naik, sedih, solusi, rumah…) langsung digambar sinkron suara, panah sebab-akibat, tokoh digambar saat bicara. Tanpa gambar AI. |
| **Motion Graphic Blueprint** | Video penjelasan: teks diketik sinkron suara, kata kunci disorot, diagram garis tergambar sendiri, ajakan komentar di akhir. Tanpa gambar AI. |
| Animasi 3D Halus / Buku Cerita / Komik / Clay | Cerita bertokoh dengan latar AI, dialog, gerak kamera sinematik (orbit, dolly, crane, rack focus), bokeh, debu cahaya, grain. |

Rasio: 9:16, 16:9, 21:9. Cerita sampai 48 adegan dan 30 menit (direkam real-time, biarkan tab terbuka).

## Pasang (sekali saja)

### 1. Worker (otomatis lewat GitHub Actions)
1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token** → template *Edit Cloudflare Workers*.
2. Repo GitHub → **Settings → Secrets and variables → Actions** → tambahkan `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`.
3. Push ke `main` (atau **Actions → Deploy Cloudflare Worker → Run workflow**).
   Worker aktif di `https://ai-motion-director-worker.<subdomain-anda>.workers.dev`.
   Binding `[ai]` di `wrangler.toml` mengaktifkan LLM + gambar Workers AI gratis.
4. Opsional: variabel `APP_TOKEN` (Worker → Settings → Variables) lalu isi token yang sama di situs.

### 2. Halaman web (GitHub Pages)
**Settings → Pages → Deploy from a branch → `main` / (root)**. Alamat: `https://<username>.github.io/studio-ai/`.

### 3. Hubungkan
Buka halaman → **Pengaturan koneksi** → isi URL Worker → **Simpan** → **Tes koneksi** → **Uji gambar**.

## Cara pakai singkat
1. Pilih gaya, rasio, durasi. Tempel naskah (`Narator: ...`, `Kakek: ...`) atau pakai tombol contoh.
2. Atur suara tokoh di layar casting (suara alami, rekam, atau unggah audio sendiri). Karakter baru bisa dibuat di panel **Karakter & suara tersimpan**.
3. **Buat Video Lengkap** → unduh hasilnya.

Naskah contoh ada di folder `naskah-contoh/`.

## Mesin gambar latar
FLUX schnell, Lucid Origin, Phoenix 1.0, SDXL Base 1.0. Jika satu gagal, Worker mencoba yang lain lalu Pollinations;
jika Worker mati, browser memakai Pollinations langsung. (SDXL Lightning & DreamShaper 8 sudah dihapus Cloudflare pada 20 Nov 2026.)

## Endpoint Worker
| Endpoint | Fungsi |
|---|---|
| `GET /api/health[?probe=1]` | status; `probe=1` ikut menguji suara Edge |
| `POST /api/plan` | menata naskah jadi adegan, lokasi, waktu, emosi, gaya kamera (kalimat tidak diubah) |
| `POST /api/comic` | menulis adegan visual + ciri tokoh untuk gaya Komik Adegan Penuh |
| `GET /api/image` | gambar latar (rantai cadangan) |
| `GET /api/tts` | suara per tokoh: Edge TTS → cadangan Google TTS |
| `GET /api/fetch?url=` | proxy musik latar MP3/OGG |
