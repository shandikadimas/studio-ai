<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0f1a">
  <title>Studio Video AI</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<main class="app">
  <header>
    <h1>🎬 Studio Video AI</h1>
    <p>Tempel naskah, biarkan para karyawan AI di cloud membuat videonya.</p>
  </header>

  <details class="card" id="settings" open>
    <summary>⚙️ Pengaturan koneksi</summary>
    <label for="workerUrl">URL Worker Cloudflare</label>
    <input id="workerUrl" type="url" placeholder="https://nama.akun.workers.dev" autocomplete="off">
    <label for="appToken">Token akses (APP_TOKEN)</label>
    <input id="appToken" type="password" placeholder="Kosongkan jika belum dipakai" autocomplete="off">
    <div class="row">
      <button id="btnSaveSettings" class="ghost" type="button">Simpan</button>
      <button id="btnTest" class="ghost" type="button">Tes koneksi</button>
    </div>
    <pre id="healthOut" class="small" hidden></pre>
  </details>

  <section class="card">
    <label for="script">Naskah / narasi</label>
    <textarea id="script" rows="9" maxlength="6000" placeholder="Tempel naskah mentah di sini…"></textarea>
    <div class="row between">
      <span id="counter" class="small">0 / 6000</span>
      <button id="btnSample" class="link" type="button">Isi naskah contoh</button>
    </div>

    <div class="grid">
      <div>
        <label for="style">Gaya visual</label>
        <select id="style">
          <option value="cinematic">Sinematik</option>
          <option value="anime">Anime</option>
          <option value="animasi3d">Animasi 3D</option>
          <option value="cat_air">Cat air (buku cerita)</option>
          <option value="realistis">Realistis</option>
        </select>
      </div>
      <div>
        <label for="voice">Suara narator</label>
        <select id="voice">
          <option value="id_female">Indonesia · Wanita</option>
          <option value="id_male">Indonesia · Pria</option>
          <option value="en_female">Inggris · Wanita</option>
          <option value="en_male">Inggris · Pria</option>
        </select>
      </div>
      <div>
        <label for="ratio">Rasio</label>
        <select id="ratio">
          <option value="16:9">16:9 (YouTube)</option>
          <option value="9:16">9:16 (Reels/TikTok)</option>
        </select>
      </div>
      <div>
        <label for="maxScenes">Maks. adegan</label>
        <select id="maxScenes">
          <option>3</option><option>4</option><option selected>6</option><option>8</option><option>10</option><option>12</option>
        </select>
      </div>
    </div>

    <label for="musicUrl">URL musik latar MP3 (opsional)</label>
    <input id="musicUrl" type="url" placeholder="https://…/musik.mp3" autocomplete="off">

    <div class="row">
      <button id="btnStart" class="primary" type="button">▶ Mulai Produksi</button>
      <button id="btnResume" class="warn" type="button" hidden>↻ Lanjutkan dari tahap gagal</button>
    </div>
  </section>

  <section class="card" id="progressCard" hidden>
    <h2>Progres produksi</h2>
    <ol id="steps" class="steps"></ol>
    <p id="detail" class="small"></p>
  </section>

  <section class="card error" id="errorBox" hidden>
    <h2>⚠️ Terjadi masalah</h2>
    <p id="errorText"></p>
  </section>

  <section class="card" id="resultCard" hidden>
    <h2>✅ Video selesai</h2>
    <video id="player" controls playsinline preload="metadata"></video>
    <div class="row">
      <a id="btnDownload" class="btn primary" target="_blank" rel="noopener" download>⬇ Unduh / Buka</a>
      <button id="btnCopy" class="ghost" type="button">Salin tautan</button>
    </div>
  </section>

  <details class="card">
    <summary>📋 Log kerja para agen</summary>
    <pre id="log" class="small"></pre>
  </details>
</main>
<script src="script.js"></script>
</body>
</html>
