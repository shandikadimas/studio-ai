# Panduan: Studio Video AI (Multi-Agent, Cloud, dari HP)

## 0. Cara kerja singkat

```
HP (SPCK/browser) ──► Worker Cloudflare = "Otak Utama"
   index.html            ├─ Agen 1 Script & Scene Director  (LLM → JSON adegan)
   style.css             ├─ Agen 2 Visual Art Director      (prompt + gambar Pollinations/Pexels)
   script.js             ├─ Agen 3 Voice Actor              (TTS JSON2Video / ElevenLabs)
                         ├─ Agen 4 Music & Sound Director   (URL MP3 + volume rendah)
                         └─ Agen 5 Video Assembly           (JSON2Video → .mp4)
```

HP hanya menampilkan antarmuka dan memanggil Worker tahap demi tahap. Semua kerja berat ada di cloud.
Status proyek (JSON) dibawa bolak-balik, jadi jika satu tahap gagal, tombol **Lanjutkan** meneruskan dari tahap itu.

---

## 1. Menyusun file di SPCK Editor

1. Buka SPCK Editor → **Open Folder / Create new project** → beri nama `studio-video-ai`.
2. Buat empat file: `index.html`, `style.css`, `script.js`, `worker.js`.
3. Salin isi masing-masing file dari hasil yang saya berikan, lalu simpan.
4. Untuk membuka antarmuka: tekan tombol **Run / Preview** di SPCK pada `index.html`.
   - `worker.js` **tidak** dijalankan di HP; file itu hanya ditempel ke Cloudflare (langkah 2).
   - Alternatif agar bisa dibuka dari mana saja: unggah `index.html`, `style.css`, `script.js` ke **Cloudflare Pages** (Direct Upload) atau GitHub Pages.

---

## 2. Deploy "Otak" ke Cloudflare Workers (lewat browser HP)

Tips: di Chrome HP, aktifkan **Situs desktop** agar dashboard Cloudflare tampil lengkap.

1. Daftar/masuk di `dash.cloudflare.com` (gratis).
2. **Workers & Pages → Create → Create Worker** → beri nama (mis. `studio-video`) → **Deploy**.
3. Tekan **Edit code**, hapus isi bawaan, tempel seluruh `worker.js`, lalu **Deploy**.
4. Catat URL Worker: `https://studio-video.<akun>.workers.dev`.
5. **Settings → Variables and Secrets**: tambahkan Secret/Variable sesuai bagian 3.
6. (Opsional) **Settings → Bindings**:
   - **Workers AI** → nama variabel `AI` (LLM gratis bawaan Cloudflare).
   - **KV namespace** → buat namespace dulu di *Storage & Databases → KV*, lalu bind dengan nama `KV` (hanya perlu jika memakai ElevenLabs langsung).
7. Buka antarmuka → **Pengaturan koneksi** → isi URL Worker dan token → **Tes koneksi**.
   Daftar ✓/✕ menunjukkan secret mana yang sudah terbaca.

---

## 3. Layanan pendukung gratis dan cara memasangnya

| Peran | Layanan | Cara dapat kunci | Dipasang sebagai |
|---|---|---|---|
| Render video (**wajib**) | JSON2Video (json2video.com) | Daftar → Dashboard → API Keys | Secret `JSON2VIDEO_API_KEY` |
| Naskah → adegan (LLM) | Pilih salah satu: Workers AI (binding `AI`), Pollinations Text (tanpa kunci), atau Groq/Gemini/OpenRouter | Workers AI: binding. Lainnya: daftar lalu buat API key | Binding `AI`, atau Secret `LLM_API_KEY` + Var `LLM_API_URL` + `LLM_MODEL` |
| Gambar | Pollinations.ai (URL langsung) | Tanpa kunci. Jika kelak meminta token, isi `POLLINATIONS_TOKEN` | Otomatis |
| Gambar cadangan | Pexels (pexels.com/api) | Daftar → Your API Key | Secret `PEXELS_API_KEY` |
| Suara | Default: suara Azure lewat JSON2Video. Opsi: ElevenLabs (elevenlabs.io → Profile → API Keys) | Untuk ElevenLabs langsung: bind KV | Secret `ELEVENLABS_API_KEY` + Var `TTS_PROVIDER=elevenlabs` |
| Musik | Pixabay Music / Freesound (unduh MP3 bebas royalti) | Unduh MP3, simpan di tempat yang punya URL publik tetap (mis. repo GitHub, lalu pakai tautan *raw*) | Var `MUSIC_URL`, atau `MUSIC_LIBRARY`, atau tempel di kolom Musik di antarmuka |
| Keamanan | Token buatan sendiri | Karang kata sandi panjang | Secret `APP_TOKEN` (isi sama di Pengaturan antarmuka) |

Contoh `MUSIC_LIBRARY` (mood yang dikenali: tenang, ceria, dramatis, epik, sedih, misteri, inspiratif, default):

```json
{"tenang":"https://raw.githubusercontent.com/AKUN/aset/main/tenang.mp3","dramatis":"https://raw.githubusercontent.com/AKUN/aset/main/dramatis.mp3","default":"https://raw.githubusercontent.com/AKUN/aset/main/tenang.mp3"}
```

Ganti generator gambar tanpa mengubah kode: isi Var `IMAGE_URL_TEMPLATE`, misalnya `https://layanan-anda/gen?p={prompt}&w={w}&h={h}&s={seed}`.

---

## 4. Uji coba pertama (naskah pendek 3 adegan)

Di antarmuka tekan **Isi naskah contoh**, pilih maks. adegan **3**, lalu **Mulai Produksi**.

Data yang mengalir antar-agen (dipersingkat):

**Agen 1 → state awal**
```json
{ "id":"uuid", "title":"Pagi itu, Raka berdiri di tepi pantai", "mood":"inspiratif",
  "options":{"style":"cinematic","voice":"id_female","ratio":"16:9","maxScenes":3,"musicUrl":""},
  "scenes":[{"id":1,"narration":"Pagi itu, Raka berdiri…","speaker":"narrator","mood":"tenang",
             "durationSec":9.5,"camera":"zoom_in","transition":"fade"}] }
```

**Agen 2 menambah ke tiap adegan**
```json
{ "visualPrompt":"A young man on a quiet beach at sunrise… cinematic film still…",
  "query":"man beach sunrise", "seed":123456,
  "imageUrl":"https://image.pollinations.ai/prompt/…?width=1280&height=720&seed=123456&nologo=true&model=flux",
  "imageSource":"pollinations", "imageOk":true }
```

**Agen 3 menambah**
```json
{ "ttsText":"Pagi itu, Raka berdiri…", "voice":{"provider":"azure","voice":"id-ID-GadisNeural"} }
```

**Agen 4 menambah**
```json
{ "music":{"url":"https://…/tenang.mp3","volume":0.12,"source":"MUSIC_LIBRARY (default)"} }
```

**Agen 5 mengirim ke JSON2Video**
```json
{ "resolution":"custom","width":1280,"height":720,"quality":"high",
  "scenes":[{"duration":-1,"elements":[
      {"type":"image","src":"…","resize":"cover","duration":-2,"zoom":2},
      {"type":"voice","text":"…","voice":"id-ID-GadisNeural","model":"azure"}]},
    {"transition":{"style":"fade","duration":1},"elements":[ … ]}],
  "elements":[{"type":"audio","src":"…mp3","volume":0.12,"loop":-1,"duration":-2}] }
```
Balasan: `{"success":true,"project":"ID_RENDER"}`. Frontend lalu mengecek status tiap 6 detik sampai `done` dan memunculkan pemutar + tombol unduh.

Jika ada masalah, buka **Log kerja para agen** di bagian bawah halaman. Jika JSON2Video menolak permintaan, pesan aslinya ditampilkan di kotak galat.

---

## 5. Transparansi teknis

**Yang berjalan otomatis penuh oleh kode**
- Pemecahan naskah ke adegan (LLM, dengan cadangan pemecah berbasis aturan jika semua LLM gagal).
- Prompt visual konsisten (gaya + deskripsi tokoh yang diulang), pembuatan URL gambar, pemeriksaan gambar, ulang dengan seed baru, lalu cadangan Pexels.
- Penentuan suara per pembicara, pemilihan musik berdasarkan mood, perakitan JSON video, pengiriman render, pemantauan status, retry, dan pesan galat berbahasa Indonesia.
- Gerak Ken Burns (zoom/pan) dan transisi antar adegan dibuat oleh JSON2Video.

**Batasan jujur**
- **Belum diuji pada layanan nyata.** Saya hanya bisa menguji logika kode secara offline (sintaks, pemecahan naskah, pembuatan prompt dan JSON). Panggilan ke JSON2Video, Pollinations, ElevenLabs, dan Pexels ditulis dari pengetahuan saya tentang API mereka per pertengahan 2026. Skema JSON2Video (`zoom`, `pan`, `duration: -1/-2`, `transition`, `loop: -1`) dan kebijakan Pollinations (apakah sudah wajib token) bisa berubah. Jika render ditolak, pesan galat dari JSON2Video akan menunjuk properti yang salah; cocokkan dengan dokumentasi resmi mereka.
- **Animasi bukan video generatif.** "Gerak" berasal dari zoom/pan pada gambar diam plus transisi, jadi halus tetapi bukan karakter yang bergerak.
- **Konsistensi tokoh terbatas.** Generator gambar gratis tidak menjamin wajah yang persis sama antar adegan; deskripsi tokoh yang diulang hanya membantu.
- **Musik tidak otomatis menurun saat bicara (ducking).** Solusinya volume musik dibuat rendah dan tetap (default 0.12; ubah lewat `MUSIC_VOLUME`).
- **Halaman harus tetap terbuka** selama produksi karena frontend yang mengatur urutan tahap. Jika tertutup, buka lagi dan lihat hasilnya di dashboard JSON2Video.
- **Kuota gratis (angka bisa berubah, cek halaman harga masing-masing):**
  - Cloudflare Workers gratis: sekitar 100 ribu permintaan/hari, batas CPU kecil, 50 subrequest per permintaan (aman untuk hingga 12 adegan). Workers AI punya jatah harian gratis. KV gratis punya batas tulis harian.
  - JSON2Video: paket gratis berbasis kredit menit render; bisa ada watermark atau batas resolusi/durasi. Cek dashboard Anda sebelum produksi panjang.
  - ElevenLabs gratis: kuota karakter bulanan kecil (sekitar belasan ribu karakter), cukup untuk beberapa video pendek. Suara bawaan JSON2Video adalah jalur default yang lebih hemat.
  - Pexels: sekitar 200 permintaan/jam dan puluhan ribu/bulan.
  - Pollinations: gratis tetapi bisa antre atau dibatasi saat ramai; karena itu gambar diperiksa satu per satu.
- **Keamanan:** Worker memakai CORS terbuka (`*`) agar bisa dipanggil dari SPCK Editor. Selalu isi `APP_TOKEN` supaya orang lain tidak menghabiskan kuota Anda, dan isi `ALLOWED_ORIGIN` jika frontend sudah punya domain tetap.
