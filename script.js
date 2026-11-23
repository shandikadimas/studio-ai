/* =====================================================================
 *  script.js — Frontend Studio Video AI
 *  Mengatur alur: Agen 1 → 2 → 3 → 4 → 5 (+ polling render) lewat Worker.
 *  State proyek (JSON) dibawa bolak-balik, sehingga tahap yang gagal bisa
 *  dilanjutkan tanpa mengulang dari awal.
 * ===================================================================== */
"use strict";

const $ = (id) => document.getElementById(id);

const AGENTS = [
  { key: "script", name: "Agen 1 · Script & Scene Director" },
  { key: "visual", name: "Agen 2 · Visual Art Director" },
  { key: "voice", name: "Agen 3 · Voice Actor" },
  { key: "music", name: "Agen 4 · Music & Sound Director" },
  { key: "assemble", name: "Agen 5 · Video Assembly & Render" },
];

const SAMPLE = `Pagi itu, Raka berdiri di tepi pantai sambil memandangi ombak yang datang dan pergi. Sudah tiga tahun ia merantau, dan hari ini ia akhirnya pulang ke kampung halaman.

Di ujung dermaga, ibunya menunggu sambil melambaikan tangan. Mata Raka berkaca-kaca. Semua lelah di perjalanan seakan hilang begitu saja.

Mereka berpelukan lama sekali. Matahari terbit perlahan, menyinari dua orang yang kini tak ingin terpisah lagi.`;

const state = {
  project: null,
  failedIndex: null,
  running: false,
  renderUrl: null,
};

/* ------------------------------ Penyimpanan lokal ------------------------------ */
function store(key, val) {
  try { localStorage.setItem("sva_" + key, val); } catch (e) { /* abaikan */ }
}
function load(key, def) {
  try { const v = localStorage.getItem("sva_" + key); return v === null ? def : v; } catch (e) { return def; }
}

/* ------------------------------ UI helper ------------------------------ */
function log(msg) {
  const t = new Date().toLocaleTimeString("id-ID");
  $("log").textContent += `[${t}] ${msg}\n`;
  $("log").scrollTop = $("log").scrollHeight;
}

function renderSteps() {
  $("steps").innerHTML = "";
  AGENTS.forEach((a) => {
    const li = document.createElement("li");
    li.dataset.key = a.key;
    const ico = document.createElement("span"); ico.className = "ico";
    const name = document.createElement("span"); name.className = "name"; name.textContent = a.name;
    const st = document.createElement("span"); st.className = "st"; st.textContent = "menunggu";
    li.append(ico, name, st);
    $("steps").append(li);
  });
}

function setStep(key, cls, text) {
  const li = $("steps").querySelector(`[data-key="${key}"]`);
  if (!li) return;
  li.className = cls;
  li.querySelector(".ico").textContent = cls === "done" ? "✓" : cls === "fail" ? "✕" : "";
  li.querySelector(".st").textContent = text;
}

function setDetail(t) { $("detail").textContent = t || ""; }

function showError(msg) {
  $("errorText").textContent = msg;
  $("errorBox").hidden = false;
}

function setRunning(on) {
  state.running = on;
  $("btnStart").disabled = on;
  $("btnResume").disabled = on;
}

/* ------------------------------ Komunikasi dengan Worker ------------------------------ */
function baseUrl() {
  let u = $("workerUrl").value.trim().replace(/\/+$/, "");
  if (!u) throw new Error("URL Worker belum diisi. Buka Pengaturan koneksi lalu isi alamat Worker Cloudflare Anda.");
  if (!/^https?:\/\//i.test(u)) throw new Error("URL Worker harus diawali https://");
  return u;
}

async function request(path, opts, timeoutMs) {
  const url = baseUrl() + path;
  const headers = { ...(opts && opts.headers) };
  const token = $("appToken").value.trim();
  if (token) headers["x-app-token"] = token;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
    try {
      const res = await fetch(url, { ...opts, headers, signal: ctrl.signal });
      clearTimeout(timer);
      let data = null;
      try { data = await res.json(); } catch (e) { /* bukan JSON */ }
      if (!res.ok || (data && data.ok === false)) {
        const msg = (data && data.error) || `Server mengembalikan kesalahan (kode ${res.status}).`;
        const err = new Error(msg);
        err.noRetry = res.status < 500 || res.status === 500;
        throw err;
      }
      if (!data) throw new Error("Respons server tidak bisa dibaca.");
      return data;
    } catch (e) {
      clearTimeout(timer);
      if (e.noRetry) throw e;
      lastErr = e;
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  if (lastErr && lastErr.name === "AbortError") {
    throw new Error("Permintaan terlalu lama (timeout). Server sibuk atau layanan gratis sedang lambat. Tekan Lanjutkan untuk mencoba lagi.");
  }
  if (lastErr && (lastErr.name === "TypeError" || /fetch|network/i.test(lastErr.message))) {
    throw new Error("Tidak bisa terhubung ke Worker. Periksa: (1) URL Worker benar, (2) koneksi internet HP aktif, (3) Worker sudah di-Deploy.");
  }
  throw lastErr || new Error("Gagal menghubungi server.");
}

async function stage(name, payload) {
  const data = await request(`/api/stage/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  (data.notes || []).forEach((n) => log(n));
  if (data.ms) log(`${data.agent || name} selesai dalam ${(data.ms / 1000).toFixed(1)} dtk.`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ Tahapan produksi ------------------------------ */
function readOptions() {
  return {
    style: $("style").value,
    voice: $("voice").value,
    ratio: $("ratio").value,
    maxScenes: Number($("maxScenes").value),
    musicUrl: $("musicUrl").value.trim(),
  };
}

const STEPS = [
  async () => {
    const script = $("script").value.trim();
    if (script.length < 20) throw new Error("Naskah terlalu pendek. Tulis minimal 20 karakter.");
    const d = await stage("script", { script, options: readOptions() });
    state.project = d.project;
    return `${d.project.scenes.length} adegan`;
  },
  async () => {
    let d;
    if (!state.project.scenes[0].imageUrl) {
      d = await stage("visual", { project: state.project });
      state.project = d.project;
    }
    const n = state.project.scenes.length;
    for (let i = 0; i < n; i++) {
      const s = state.project.scenes[i];
      if (s.imageOk === true) continue; // sudah diperiksa sebelumnya (saat lanjut)
      setStep("visual", "run", `memeriksa gambar ${i + 1}/${n}`);
      setDetail("Gambar dibuat oleh generator gratis, bisa memakan 10–40 detik per adegan.");
      d = await stage("check", { project: state.project, sceneId: s.id });
      state.project = d.project;
    }
    return `${n} gambar siap`;
  },
  async () => {
    const d = await stage("voice", { project: state.project });
    state.project = d.project;
    return "suara siap";
  },
  async () => {
    const d = await stage("music", { project: state.project });
    state.project = d.project;
    return state.project.music ? "musik dipilih" : "tanpa musik";
  },
  async () => {
    if (!state.project.renderId) {
      const d = await stage("assemble", { project: state.project });
      state.project = d.project;
    }
    setStep("assemble", "run", "merender video…");
    setDetail("Render di cloud biasanya 1–5 menit. Anda boleh mengunci layar, tetapi biarkan halaman ini tetap terbuka.");
    const url = await pollRender(state.project.renderId);
    state.renderUrl = url;
    return "video jadi";
  },
];

async function pollRender(id) {
  const started = Date.now();
  while (Date.now() - started < 20 * 60 * 1000) {
    await sleep(6000);
    let d;
    try {
      d = await request(`/api/status?project=${encodeURIComponent(id)}`, { method: "GET" }, 30000);
    } catch (e) {
      log("Gagal membaca status render (akan dicoba lagi): " + e.message);
      continue;
    }
    const secs = Math.round((Date.now() - started) / 1000);
    setStep("assemble", "run", `merender… ${secs} dtk`);
    if (d.status === "done" && d.url) return d.url;
    if (d.status === "error") {
      throw new Error("Render gagal di JSON2Video: " + (d.message || "alasan tidak diketahui") + "\nPeriksa kuota akun JSON2Video Anda, lalu mulai produksi ulang.");
    }
  }
  throw new Error("Render melewati batas waktu 20 menit. Cek dashboard JSON2Video untuk proyek " + id + ".");
}

async function run(from) {
  if (state.running) return;
  setRunning(true);
  $("errorBox").hidden = true;
  $("btnResume").hidden = true;
  $("resultCard").hidden = true;
  $("progressCard").hidden = false;
  state.failedIndex = null;

  for (let i = 0; i < STEPS.length; i++) {
    const key = AGENTS[i].key;
    if (i < from) { setStep(key, "done", "selesai"); continue; }
    setStep(key, "run", "bekerja…");
    setDetail("");
    try {
      const result = await STEPS[i]();
      setStep(key, "done", result);
    } catch (e) {
      setStep(key, "fail", "gagal");
      state.failedIndex = i;
      showError(`${AGENTS[i].name} gagal:\n${e.message}`);
      log("GAGAL " + AGENTS[i].name + ": " + e.message);
      $("btnResume").hidden = false;
      setRunning(false);
      return;
    }
  }
  setDetail("");
  showResult(state.renderUrl);
  setRunning(false);
}

function showResult(url) {
  $("player").src = url;
  $("btnDownload").href = url;
  $("resultCard").hidden = false;
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  log("Video selesai: " + url);
}

/* ------------------------------ Event ------------------------------ */
function saveSettings() {
  store("worker", $("workerUrl").value.trim());
  store("token", $("appToken").value.trim());
}

async function testConnection() {
  const out = $("healthOut");
  out.hidden = false;
  out.textContent = "Menguji koneksi…";
  try {
    saveSettings();
    const d = await request("/api/health", { method: "GET" }, 20000);
    const c = d.configured;
    const yn = (v) => (v ? "✓" : "✕");
    out.textContent =
      `Terhubung ✓ (Worker v${d.version})\n` +
      `JSON2Video (wajib)  : ${yn(c.json2video)}\n` +
      `LLM kustom          : ${yn(c.llm_kustom)}\n` +
      `Workers AI          : ${yn(c.workers_ai)}\n` +
      `ElevenLabs + KV     : ${yn(c.elevenlabs)}\n` +
      `Pexels (cadangan)   : ${yn(c.pexels)}\n` +
      `Musik default       : ${yn(c.musik)}\n` +
      `Mesin suara         : ${c.tts_provider}` +
      (c.json2video ? "" : "\n\nJSON2VIDEO_API_KEY belum diatur, render tidak akan berjalan.");
  } catch (e) {
    out.textContent = "Gagal: " + e.message;
  }
}

function init() {
  $("workerUrl").value = load("worker", "");
  $("appToken").value = load("token", "");
  $("script").value = load("draft", "");
  ["style", "voice", "ratio", "maxScenes", "musicUrl"].forEach((id) => {
    $(id).value = load(id, $(id).value);
    $(id).addEventListener("change", () => store(id, $(id).value));
  });
  if ($("workerUrl").value) $("settings").open = false;

  const upd = () => { $("counter").textContent = `${$("script").value.length} / 6000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); });
  upd();

  renderSteps();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Pengaturan tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnSample").addEventListener("click", () => { $("script").value = SAMPLE; upd(); store("draft", SAMPLE); });
  $("btnStart").addEventListener("click", () => {
    try { baseUrl(); } catch (e) { showError(e.message); $("errorBox").hidden = false; $("settings").open = true; return; }
    saveSettings();
    state.project = null;
    state.renderUrl = null;
    $("log").textContent = "";
    renderSteps();
    run(0);
  });
  $("btnResume").addEventListener("click", () => {
    if (state.failedIndex === null) return;
    run(state.failedIndex);
  });
  $("btnCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.renderUrl || "");
      $("btnCopy").textContent = "Tersalin ✓";
    } catch (e) {
      $("btnCopy").textContent = "Tekan lama tautan Unduh";
    }
    setTimeout(() => { $("btnCopy").textContent = "Salin tautan"; }, 2000);
  });
}

init();
