# Studio Video AI v4 — Tokoh berpakaian, cerita anak, gaya baru

Ganti kelima file lama dengan file baru ini (urutan pasang sama seperti sebelumnya):
`worker.js` → Cloudflare Worker (Edit code → Deploy). `index.html`, `style.css`, `script.js` → hosting statis.

## Yang baru
- **Karakter gaya buku cerita**: kepala bulat, pipi merona, tangan & kaki hitam tipis, dengan baju sungguhan. Ada 17 pakaian (kemeja, jas, batik, kaos, seragam SD/SMP, gamis+hijab, daster, kebaya, gaun, baju koko+peci, petani+caping, nelayan, koki, dokter, polisi, overall).
- **Status keluarga** (kaya / menengah / sederhana) memengaruhi detail: sepatu kulit + jam/kalung, sepatu kets, atau sandal; warna baju lebih pudar untuk sederhana.
- **Semua tokoh satu frame**: tokoh yang bercakap di tempat yang sama tampil bersama, saling menghadap, dan bergerak kecil seperti NPC. Posisi tiap tokoh tetap sama antar adegan.
- **Latar mengikuti cerita**: AI diminta membuat latar spesifik (kelas, rumah mewah, sawah, pasar, dll). Latar cadangan buatan sendiri juga bervariasi (kelas, rumah mewah, sawah, pasar, pantai, hutan, jalan).
- **Mode Cerita anak** (bawaan): bahasa sederhana, tanpa kekerasan/hal menakutkan, ada kartu judul di awal dan **pesan moral** di akhir. Kata yang kurang cocok untuk anak akan diberi peringatan di log.
- **Gaya baru**: 3D CGI stylized, Claymation/stop motion (gerak patah-patah ala stop motion), Comic book/pop art (garis tebal + halftone). Karakter ikut berganti gaya gambar.
- **Pengaturan suara & tampilan tidak hilang lagi**: kartu tokoh selalu tampil saat casting (ketuk untuk membuka, perubahan otomatis tersimpan jika sudah ditekan Simpan). Ada juga kartu **Karakter & suara tersimpan** di halaman utama untuk mengubah/menghapus kapan saja. Centang “Lewati layar casting…” bila ingin langsung jalan.
- **Konsisten untuk serial**: nama tokoh yang sudah tersimpan dikirim ke AI agar peran, status, dan pakaiannya dipakai lagi.

## Latar AI gagal (log menunjukkan Pollinations HTTP 402)
Itu artinya gambar FLUX dari Workers AI tidak terpakai. Pastikan di Worker ada binding **Workers AI** bernama `AI` (Settings → Bindings → Add → Workers AI), lalu Deploy ulang. Tanpa itu aplikasi memakai latar buatan sendiri.

## Batasan jujur
- Karakter digambar di canvas (2D bergaya, bukan Blender). Gaya “3D CGI” dan “clay” hanya mengubah shading dan gerak, bukan model 3D sungguhan.
- Maksimal 5 tokoh tampil per adegan, 8 tokoh per video.
- Video direkam **real-time**: durasi 45 detik = ±45 detik rekam. Biarkan layar menyala.
- Edge TTS dan Google TTS adalah endpoint tidak resmi; bisa berubah sewaktu-waktu.
- Kuota gratis Workers AI: 10.000 neuron/hari.
