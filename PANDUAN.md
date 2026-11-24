# Studio Video AI v3 — Stickman 3D berdialog (gratis)

Ganti kelima file lama dengan file baru ini. Urutan pasang sama seperti sebelumnya.

## 1. Worker (otak)
1. Cloudflare Dashboard → Workers & Pages → buka Worker Anda → **Edit code** → ganti isinya dengan `worker.js` → **Deploy**.
2. Binding **Workers AI** bernama `AI` tetap wajib (LLM Llama + gambar FLUX).
3. Opsional: `APP_TOKEN` (kata sandi). Isi juga di kolom Token aplikasi.
4. Tidak perlu variabel baru. Jika suara Edge mulai gagal suatu hari, tambahkan variabel `EDGE_CHROMIUM_VERSION` dengan nomor versi Chrome/Edge terbaru, misalnya `145.0.0.0`.

## 2. Frontend
Unggah `index.html`, `style.css`, `script.js` ke hosting statis (Cloudflare Pages / GitHub Pages) menimpa yang lama. Buka di **Chrome**, isi URL Worker, tekan **Tes koneksi**.

Baris **Suara Edge** di hasil tes harus ✓. Kalau ✕, aplikasi tetap jalan memakai suara Google dengan nada digeser per tokoh.

## 3. Cara memakai
Tulis naskah dengan format:

```
Narator: Pagi itu di pantai, Raka pulang.
Raka: Ibu! Aku pulang!
Ibu: Raka? Anakku sudah pulang!
```

Cerita biasa tanpa label juga boleh, AI akan membuatkan dialognya.

Alur: naskah → tokoh & adegan → **casting suara** → latar gambar → suara → rekam video.

### Suara beda tiap tokoh
- Tiap tokoh (dan Narator) punya kartu: jenis (pria/wanita/anak/kakek/nenek), suara dasar, nada, kecepatan.
- Tekan **▶ Tes suara** untuk mendengar.
- Tekan **🔒 Kunci suara**: suara itu disimpan di HP per nama tokoh. Video berikutnya yang memakai nama sama otomatis memakai suara itu dan kartunya tidak muncul lagi (kalau semua tokoh terkunci).
- Tombol "Hapus semua kunci suara tokoh" ada di Pengaturan koneksi.
- Suara Indonesia dari Edge hanya ada 2 (Ardi pria, Gadis wanita). Tokoh lain dibedakan lewat nada dan kecepatan. Bahasa Inggris punya 5 suara dasar.

## 4. Batasan jujur
- Stickman digambar di canvas dengan efek tabung bershading (3D semu), bukan Blender sungguhan. Blender tidak bisa jalan di browser HP.
- Maksimal 4 tokoh tampil per adegan, 6 tokoh per video.
- Video direkam **real-time**: video 45 detik = ±45 detik rekam. Biarkan layar menyala dan jangan pindah aplikasi.
- Edge TTS dan Google TTS adalah endpoint tidak resmi tanpa kunci; bisa berubah atau diblokir sewaktu-waktu.
- Kuota gratis Workers AI: 10.000 neuron/hari.
