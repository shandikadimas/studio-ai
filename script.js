/* =====================================================================
 *  script.js — Frontend Studio Video AI v3 (stickman 3D berdialog)
 *  Alur: Agen 1 naskah+dialog → Agen 2 casting suara (kunci per tokoh)
 *        → Agen 3 latar gambar → Agen 4 suara → Agen 5 musik
 *        → Agen 6 editor (menggambar stickman di canvas lalu merekamnya)
 *  State proyek + aset ada di memori, jadi tahap yang gagal bisa
 *  dilanjutkan tanpa mengulang dari awal. Suara terkunci disimpan
 *  di perangkat (localStorage) per nama tokoh.
 * ===================================================================== */
"use strict";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lerp = (a, b, p) => a + (b - a) * p;

const AGENTS = [
  { key: "script", name: "Agen 1 · Penulis Naskah & Sutradara" },
  { key: "cast", name: "Agen 2 · Casting (suara tokoh)" },
  { key: "visual", name: "Agen 3 · Latar Gambar (FLUX)" },
  { key: "voice", name: "Agen 4 · Pengisi Suara" },
  { key: "music", name: "Agen 5 · Musik & Suara" },
  { key: "render", name: "Agen 6 · Editor Video (rekam)" },
];

const SAMPLE = `Narator: Pagi itu di tepi pantai, Raka akhirnya pulang setelah tiga tahun merantau.
Raka: Ibu! Aku pulang!
Ibu: Raka? Ya Tuhan, anakku sudah pulang!
Narator: Mereka berpelukan lama sekali, sementara matahari terbit perlahan.
Raka: Maafkan aku baru pulang sekarang, Bu.
Ibu: Tidak apa-apa, Nak. Yang penting kamu selamat.
Pak Haji: Wah, Raka sudah pulang! Ayo kita makan ikan bakar malam ini.
Raka: Siap, Pak Haji!`;

const PALETTE = ["#ff8a1f", "#38d39f", "#4da3ff", "#ff5d8f", "#b983ff", "#ffd23f"];

/* ------------------------------ Katalog suara ------------------------------ */
const VOICES = {
  id: [
    { id: "id-ID-ArdiNeural", label: "Ardi · pria", g: "m" },
    { id: "id-ID-GadisNeural", label: "Gadis · wanita", g: "f" },
  ],
  en: [
    { id: "en-US-GuyNeural", label: "Guy · pria (US)", g: "m" },
    { id: "en-GB-RyanNeural", label: "Ryan · pria (UK)", g: "m" },
    { id: "en-US-JennyNeural", label: "Jenny · wanita (US)", g: "f" },
    { id: "en-US-AriaNeural", label: "Aria · wanita (US)", g: "f" },
    { id: "en-GB-SoniaNeural", label: "Sonia · wanita (UK)", g: "f" },
  ],
};
const KINDS = {
  pria: { label: "Pria", g: "m", pitch: 0, rate: 0, scale: 1 },
  wanita: { label: "Wanita", g: "f", pitch: 0, rate: 0, scale: 0.96 },
  anak: { label: "Anak", g: "f", pitch: 45, rate: 8, scale: 0.7 },
  kakek: { label: "Kakek", g: "m", pitch: -30, rate: -14, scale: 0.95 },
  nenek: { label: "Nenek", g: "f", pitch: -18, rate: -12, scale: 0.9 },
};
// Tokoh dengan jenis yang sama diberi selisih nada/kecepatan agar tetap terdengar beda
const VARIANTS = [[0, 0], [22, 5], [-22, -5], [38, 8], [-38, -9]];

function defaultVoice(kind, nth, lang) {
  const k = KINDS[kind] || KINDS.pria;
  const list = VOICES[lang].filter((v) => v.g === k.g);
  const v = list[nth % list.length];
  const off = VARIANTS[nth % VARIANTS.length];
  return { voiceId: v.id, pitch: clamp(k.pitch + off[0], -80, 80), rate: clamp(k.rate + off[1], -40, 40), kind: kind in KINDS ? kind : "pria" };
}

const state = {
  project: null,
  images: {},   // sceneId -> ImageBitmap | null
  audio: {},    // "sceneId:lineIndex" -> {buf, detune}
  music: null,
  cast: {},     // nama huruf kecil -> {name, voiceId, pitch, rate, kind, locked}
  castResolve: null,
  failedIndex: null,
  running: false,
  blob: null,
  ac: null,
  edgeDown: false,
  edgeFails: 0,
  edgeNoted: false,
};

const dims = (ratio) => (ratio === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 });
const isNarr = (name) => /^narat(o|e)r$/i.test(String(name));

/* ------------------------------ Penyimpanan lokal ------------------------------ */
function store(key, val) { try { localStorage.setItem("sva_" + key, val); } catch (e) { /* abaikan */ } }
function load(key, def) {
  try { const v = localStorage.getItem("sva_" + key); return v === null ? def : v; } catch (e) { return def; }
}
function loadVoices() { try { return JSON.parse(load("voices", "{}")) || {}; } catch (e) { return {}; } }
function saveVoices(v) { store("voices", JSON.stringify(v)); }

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
  try { u = new URL(u).origin; } catch (e) { throw new Error("URL Worker tidak valid."); }
  return u;
}

/* opts: method, headers, body, binary (balas ArrayBuffer), attempts */
async function request(path, opts, timeoutMs) {
  opts = opts || {};
  const url = baseUrl() + path;
  const headers = { ...(opts.headers || {}) };
  const token = $("appToken").value.trim();
  if (token) headers["x-app-token"] = token;
  const maxAttempts = opts.attempts || 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
    try {
      const res = await fetch(url, { method: opts.method || "GET", headers, body: opts.body, signal: ctrl.signal });
      if (!res.ok) {
        let data = null;
        try { data = await res.json(); } catch (e) { /* bukan JSON */ }
        const err = new Error((data && data.error) || `Server mengembalikan kesalahan (kode ${res.status}).`);
        err.noRetry = (res.status < 500 && res.status !== 429) || res.status === 500;
        err.fromServer = true;
        throw err;
      }
      if (opts.binary) {
        const buf = await res.arrayBuffer();
        clearTimeout(timer);
        return { buf, type: res.headers.get("content-type") || "", source: res.headers.get("x-source") || "", edgeError: res.headers.get("x-edge-error") || "" };
      }
      const data = await res.json().catch(() => null);
      clearTimeout(timer);
      if (!data) throw new Error("Respons server tidak bisa dibaca.");
      if (data.ok === false) { const err = new Error(data.error || "Kesalahan tak dikenal."); err.noRetry = true; throw err; }
      return data;
    } catch (e) {
      clearTimeout(timer);
      if (e.noRetry) throw e;
      lastErr = e;
      if (attempt < maxAttempts) await sleep(1500 * attempt);
    }
  }
  if (lastErr && lastErr.name === "AbortError") {
    throw new Error("Permintaan terlalu lama (timeout). Layanan gratis sedang lambat. Tekan Lanjutkan untuk mencoba lagi.");
  }
  if (lastErr && !lastErr.fromServer && (lastErr.name === "TypeError" || /fetch|network/i.test(lastErr.message))) {
    throw new Error("Tidak bisa terhubung ke Worker. Periksa: (1) URL Worker benar, (2) koneksi internet aktif, (3) Worker sudah di-Deploy.");
  }
  throw lastErr || new Error("Gagal menghubungi server.");
}

/* ------------------------------ Audio ------------------------------ */
function ensureAC() {
  if (!state.ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Browser ini tidak mendukung Web Audio. Pakai Chrome terbaru.");
    state.ac = new AC();
  }
  if (state.ac.state === "suspended") state.ac.resume().catch(() => {});
  return state.ac;
}

function chunkText(text, max) {
  max = max || 170;
  const sentences = String(text).replace(/\s+/g, " ").trim().match(/[^.!?…;:]+[.!?…;:]*/g) || [String(text)];
  const out = [];
  let cur = "";
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    while (s.length > max) {
      let cut = s.lastIndexOf(",", max);
      if (cut < 40) cut = s.lastIndexOf(" ", max);
      if (cut < 20) cut = max;
      push();
      out.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (!s) continue;
    if ((cur + " " + s).trim().length > max) push();
    cur = (cur + " " + s).trim();
  }
  push();
  return out;
}

function concatBuffers(ac, bufs, gapSec) {
  if (bufs.length === 1) return bufs[0];
  const sr = ac.sampleRate;
  const gap = Math.round((gapSec || 0.1) * sr);
  const total = bufs.reduce((a, b) => a + b.length, 0) + gap * (bufs.length - 1);
  const out = ac.createBuffer(1, total, sr);
  const d = out.getChannelData(0);
  let o = 0;
  bufs.forEach((b) => { d.set(b.getChannelData(0), o); o += b.length + gap; });
  return out;
}

/* Cadangan Google TTS hanya punya satu suara: geser nada per tokoh lewat detune */
function fallbackDetune(p) {
  const base = { pria: -300, kakek: -450, anak: 350, wanita: 0, nenek: -120 }[p.kind] || 0;
  return clamp(base + p.pitch * 6, -700, 700);
}

async function ttsChunk(profile, text, engine) {
  const q = new URLSearchParams({ text, voice: profile.voiceId, pitch: String(profile.pitch), rate: String(profile.rate), engine });
  const r = await request(`/api/tts?${q}`, { binary: true, attempts: 3 }, 40000);
  let buf;
  try { buf = await ensureAC().decodeAudioData(r.buf.slice(0)); }
  catch (e) { throw new Error("Audio tidak bisa didecode oleh browser."); }
  return { buf, source: r.source, edgeError: r.edgeError };
}

/* Satu ucapan = beberapa potongan kalimat dirangkai jadi satu AudioBuffer */
async function makeLine(profile, text) {
  const ac = ensureAC();
  const parts = chunkText(text);
  const bufs = [];
  let fb = false;
  for (const part of parts) {
    const engine = state.edgeDown || fb ? "google" : "edge";
    const r = await ttsChunk(profile, part, engine);
    if (r.source === "edge-tts") state.edgeFails = 0;
    else {
      fb = true;
      if (engine === "edge") {
        state.edgeFails++;
        if (!state.edgeNoted) { state.edgeNoted = true; log(`Suara Edge gagal (${r.edgeError || "?"}). Memakai cadangan Google dengan nada digeser per tokoh.`); }
        if (state.edgeFails >= 2) state.edgeDown = true;
      }
    }
    bufs.push(r.buf);
  }
  return { buf: concatBuffers(ac, bufs, 0.1), detune: fb ? fallbackDetune(profile) : 0 };
}

function playLine(line) {
  const ac = ensureAC();
  const s = ac.createBufferSource();
  s.buffer = line.buf;
  s.detune.value = line.detune;
  s.connect(ac.destination);
  s.start();
}

/* ------------------------------ Casting & kunci suara ------------------------------ */
const castKey = (name) => String(name).toLowerCase();

function initCast(p) {
  const lang = p.options.lang;
  const saved = loadVoices();
  state.cast = {};
  const counts = {};
  const entries = [];
  if (p.scenes.some((s) => s.lines.some((l) => isNarr(l.speaker)))) entries.push({ name: "Narator", kind: "wanita", narrator: true });
  p.characters.forEach((c, i) => { if (!c.color) c.color = PALETTE[i % PALETTE.length]; entries.push(c); });
  entries.forEach((c) => {
    const key = castKey(c.name);
    const sv = saved[key];
    if (sv && VOICES[lang].some((v) => v.id === sv.voiceId) && sv.kind in KINDS) {
      state.cast[key] = { name: c.name, voiceId: sv.voiceId, pitch: sv.pitch, rate: sv.rate, kind: sv.kind, locked: true };
      c.kind = sv.kind; // tampilan stickman ikut jenis suara yang dikunci
      return;
    }
    const nth = counts[c.kind] || 0;
    counts[c.kind] = nth + 1;
    state.cast[key] = { name: c.name, ...defaultVoice(c.kind, nth, lang), locked: false };
  });
}

function persistCast(key) {
  const c = state.cast[key];
  const saved = loadVoices();
  if (c.locked) saved[key] = { voiceId: c.voiceId, pitch: c.pitch, rate: c.rate, kind: c.kind };
  else delete saved[key];
  saveVoices(saved);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderCast() {
  const box = $("castList");
  box.innerHTML = "";
  const lang = state.project.options.lang;
  Object.keys(state.cast).forEach((key) => {
    const c = state.cast[key];
    const ch = state.project.characters.find((x) => castKey(x.name) === key);
    const card = el("div", "cast-item" + (c.locked ? " locked" : ""));

    const head = el("div", "cast-head");
    const dot = el("span", "dot"); dot.style.background = ch ? ch.color : "#9fb3d9";
    const nm = el("strong", "", c.name);
    const lock = el("button", "ghost lockbtn", c.locked ? "🔒 Terkunci" : "🔓 Kunci suara");
    lock.type = "button";
    lock.addEventListener("click", () => { c.locked = !c.locked; persistCast(key); renderCast(); });
    head.append(dot, nm, lock);

    const kindSel = el("select");
    Object.entries(KINDS).forEach(([k, v]) => { const o = el("option", "", v.label); o.value = k; if (k === c.kind) o.selected = true; kindSel.append(o); });
    kindSel.addEventListener("change", () => {
      Object.assign(c, defaultVoice(kindSel.value, 0, lang));
      if (ch) ch.kind = c.kind;
      if (c.locked) persistCast(key);
      renderCast();
    });

    const voiceSel = el("select");
    VOICES[lang].forEach((v) => { const o = el("option", "", v.label); o.value = v.id; if (v.id === c.voiceId) o.selected = true; voiceSel.append(o); });
    voiceSel.addEventListener("change", () => { c.voiceId = voiceSel.value; if (c.locked) persistCast(key); });

    const grid = el("div", "grid");
    const l1 = el("div"); l1.append(el("label", "", "Jenis tokoh"), kindSel);
    const l2 = el("div"); l2.append(el("label", "", "Suara dasar"), voiceSel);
    grid.append(l1, l2);

    const slider = (label, prop, min, max, unit) => {
      const wrap = el("div");
      const lb = el("label", "", `${label}: ${c[prop]}${unit}`);
      const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = 1; r.value = c[prop];
      r.addEventListener("input", () => { c[prop] = Number(r.value); lb.textContent = `${label}: ${c[prop]}${unit}`; });
      r.addEventListener("change", () => { if (c.locked) persistCast(key); });
      wrap.append(lb, r);
      return wrap;
    };
    const sl = el("div", "grid");
    sl.append(slider("Nada", "pitch", -80, 80, " Hz"), slider("Kecepatan", "rate", -40, 40, "%"));

    const test = el("button", "ghost", "▶ Tes suara");
    test.type = "button";
    test.addEventListener("click", () => previewVoice(c, test));

    card.append(head, grid, sl, el("div", "row")); 
    card.lastChild.append(test);
    box.append(card);
  });
}

async function previewVoice(c, btn) {
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "memuat…";
  try {
    const en = state.project.options.lang === "en";
    const text = en ? `Hello, I am ${c.name}. This is how I sound.` : `Halo, aku ${c.name}. Begini suaraku.`;
    playLine(await makeLine(c, text));
  } catch (e) {
    showError("Tes suara gagal:\n" + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function showCastReview() {
  renderCast();
  $("castCard").hidden = false;
  $("castCard").scrollIntoView({ behavior: "smooth", block: "start" });
  setStep("cast", "run", "menunggu Anda");
  setDetail("Atur suara tokoh, tekan Tes, lalu Kunci. Setelah itu tekan Lanjutkan produksi.");
  return new Promise((res) => { state.castResolve = res; });
}

function finishCast() {
  if (!state.castResolve) return;
  $("castCard").hidden = true;
  const r = state.castResolve;
  state.castResolve = null;
  r();
}

/* ------------------------------ Tahapan produksi ------------------------------ */
function readOptions() {
  return {
    style: $("style").value,
    lang: $("lang").value,
    ratio: $("ratio").value,
    maxScenes: Number($("maxScenes").value),
    targetSec: Number($("targetSec").value),
    musicUrl: $("musicUrl").value.trim(),
  };
}

async function fetchImage(scene, seedOffset) {
  const { w, h } = dims(state.project.options.ratio);
  const q = new URLSearchParams({ prompt: scene.imagePrompt, seed: String(scene.seed + seedOffset), w: String(w), h: String(h) });
  const r = await request(`/api/image?${q}`, { binary: true, attempts: 1 }, 90000);
  const bmp = await createImageBitmap(new Blob([r.buf], { type: r.type || "image/jpeg" }));
  return { bmp, source: r.source };
}

const STEPS = [
  /* Agen 1 — naskah → tokoh, adegan, dialog */
  async () => {
    const script = $("script").value.trim();
    if (script.length < 20) throw new Error("Naskah terlalu pendek. Tulis minimal 20 karakter.");
    const d = await request("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, options: readOptions() }),
      attempts: 2,
    }, 120000);
    (d.notes || []).forEach((n) => log(n));
    if (d.ms) log(`${d.agent} selesai dalam ${(d.ms / 1000).toFixed(1)} dtk.`);
    state.project = d.project;
    state.images = {};
    state.audio = {};
    state.music = null;
    state.cast = {};
    return `${d.project.characters.length} tokoh · ${d.project.scenes.length} adegan`;
  },

  /* Agen 2 — casting: tiap tokoh punya suara sendiri; yang terkunci dipakai ulang otomatis */
  async () => {
    const p = state.project;
    if (!Object.keys(state.cast).length) initCast(p);
    const all = Object.values(state.cast);
    if (all.every((c) => c.locked)) { log("Semua suara tokoh sudah terkunci, langsung lanjut."); return "suara terkunci"; }
    await showCastReview();
    setDetail("");
    return `${all.length} suara`;
  },

  /* Agen 3 — latar gambar FLUX (tanpa orang; stickman digambar di atasnya), satu per satu */
  async () => {
    const scenes = state.project.scenes;
    const n = scenes.length;
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const s = scenes[i];
      if (state.images[s.id]) { ok++; continue; }
      setStep("visual", "run", `latar ${i + 1}/${n}`);
      setDetail("Latar dibuat generator gratis, bisa memakan 5–40 detik per adegan.");
      let bmp = null;
      for (let a = 0; a < 2 && !bmp; a++) {
        try {
          const r = await fetchImage(s, a * 7919);
          bmp = r.bmp;
          if (i === 0 && a === 0) log("Sumber gambar: " + (r.source || "?"));
        } catch (e) {
          log(`Adegan ${s.id}: gambar gagal percobaan ${a + 1} (${e.message})`);
        }
      }
      state.images[s.id] = bmp;
      if (bmp) ok++;
    }
    if (ok === 0) log("Semua gambar gagal. Video tetap dibuat dengan latar buatan sendiri.");
    else if (ok < n) log(`${n - ok} adegan memakai latar buatan sendiri karena gambarnya gagal.`);
    return `${ok}/${n} latar`;
  },

  /* Agen 4 — suara: tiap ucapan memakai suara tokoh pembicaranya */
  async () => {
    const scenes = state.project.scenes;
    const total = scenes.reduce((a, s) => a + s.lines.length, 0);
    let done = 0;
    const fallbackProfile = state.cast.narator || Object.values(state.cast)[0];
    for (const s of scenes) {
      for (let li = 0; li < s.lines.length; li++) {
        const key = `${s.id}:${li}`;
        done++;
        if (state.audio[key]) continue;
        setStep("voice", "run", `suara ${done}/${total}`);
        setDetail("");
        const ln = s.lines[li];
        const profile = state.cast[castKey(ln.speaker)] || fallbackProfile;
        state.audio[key] = await makeLine(profile, ln.text);
      }
    }
    let sec = 0;
    scenes.forEach((s) => s.lines.forEach((l, li) => { const a = state.audio[`${s.id}:${li}`]; sec += a.buf.duration / Math.pow(2, a.detune / 1200); }));
    log(`Suara siap, total ±${Math.round(sec)} detik.${state.edgeDown ? " (memakai cadangan Google)" : ""}`);
    return state.edgeDown ? "suara cadangan" : "suara siap";
  },

  /* Agen 5 — musik latar (opsional) */
  async () => {
    const url = state.project.options.musicUrl;
    if (!url) { log("Tanpa musik latar (kolom musik kosong)."); return "tanpa musik"; }
    if (state.music) return "musik dipilih";
    try {
      const ac = ensureAC();
      const r = await request(`/api/fetch?${new URLSearchParams({ url })}`, { binary: true, attempts: 2 }, 60000);
      state.music = await ac.decodeAudioData(r.buf.slice(0));
      log("Musik latar dimuat.");
      return "musik dipilih";
    } catch (e) {
      log("Musik gagal dimuat, video dibuat tanpa musik: " + e.message);
      return "tanpa musik";
    }
  },

  /* Agen 6 — rangkai & rekam */
  async () => {
    setStep("render", "run", "merekam…");
    setDetail("Video direkam langsung selama durasinya. Biarkan layar menyala dan jangan pindah aplikasi/tab.");
    const blob = await renderVideo((p) => setStep("render", "run", `merekam ${Math.round(p * 100)}%`));
    state.blob = blob;
    return "video jadi";
  },
];

async function run(from) {
  if (state.running) return;
  setRunning(true);
  $("errorBox").hidden = true;
  $("btnResume").hidden = true;
  $("resultCard").hidden = true;
  $("progressCard").hidden = false;
  state.failedIndex = null;
  if (from === 0) { state.edgeDown = false; state.edgeFails = 0; state.edgeNoted = false; }
  try { ensureAC(); } catch (e) { /* ditangani di tahap suara */ }

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
  showResult(state.blob);
  setRunning(false);
}

function showResult(blob) {
  const ext = /mp4/i.test(blob.type) ? "mp4" : "webm";
  const name = `video-ai-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  $("player").src = url;
  $("btnDownload").href = url;
  $("btnDownload").setAttribute("download", name);
  state.fileName = name;
  $("resultCard").hidden = false;
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  log(`Video selesai: ${name} (${(blob.size / 1048576).toFixed(1)} MB, ${blob.type}).`);
}

/* =====================================================================
 *  MESIN RENDER — stickman 3D semu (tabung bershading) di atas latar
 * ===================================================================== */
const FONT = `"Poppins", system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif`;
const ACCENT = "#ff8a1f";
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(String(hex).slice(1), 16);
  const f = (c) => Math.round(clamp(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function layoutWords(ctx, words, maxW, gap) {
  const lines = [];
  let line = { items: [], width: 0 };
  words.forEach((word, idx) => {
    const w = ctx.measureText(word).width;
    const add = (line.items.length ? gap : 0) + w;
    if (line.items.length && line.width + add > maxW) { lines.push(line); line = { items: [], width: 0 }; }
    line.width += (line.items.length ? gap : 0) + w;
    line.items.push({ word, idx, w });
  });
  if (line.items.length) lines.push(line);
  return lines;
}

function wordTimes(words, span, lead) {
  const wt = words.map((x) => x.length + (/[.,;:!?…]$/.test(x) ? 4 : 1));
  const sum = wt.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return wt.map((x) => { const st = lead + (acc / sum) * Math.max(0.2, span - lead); acc += x; return st; });
}

function drawCover(ctx, img, W, H, zoom, ox, oy) {
  const ir = img.width / img.height, rr_ = W / H;
  let sw, sh;
  if (ir > rr_) { sh = img.height; sw = sh * rr_; } else { sw = img.width; sh = sw / rr_; }
  sw /= zoom; sh /= zoom;
  const sx = (img.width - sw) / 2 + (ox * (img.width - sw)) / 2;
  const sy = (img.height - sh) / 2 + (oy * (img.height - sh)) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
}

/* ---------- Latar buatan sendiri (bila gambar FLUX gagal) ---------- */
function bgKind(loc) {
  const t = String(loc || "").toLowerCase();
  if (/pantai|laut|dermaga|pelabuhan|danau|sungai|beach|sea|lake|river|pier/.test(t)) return "beach";
  if (/hutan|kebun|sawah|gunung|desa|ladang|taman|forest|garden|mountain|park/.test(t)) return "forest";
  if (/rumah|kamar|dapur|warung|kafe|cafe|kantor|sekolah|kelas|toko|restoran|ruang|masjid|bengkel|house|room|kitchen|school|office|shop/.test(t)) return "indoor";
  if (/jalan|kota|pasar|terminal|stasiun|bandara|gang|kampung|street|city|market|station/.test(t)) return "street";
  return "field";
}

const SKY = { pagi: ["#ffcf9e", "#8fc9ff"], siang: ["#6fc3ff", "#cfeeff"], sore: ["#5a4f9e", "#ff9b5e"], malam: ["#070b24", "#26306a"] };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawProcBg(g, s, T) {
  const { ctx, W, H, groundY } = g;
  const hz = groundY - H * 0.1;
  const kind = bgKind(s.location);
  const night = s.time === "malam";
  const [c1, c2] = SKY[s.time] || SKY.siang;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, c1);
  sky.addColorStop(1, c2);

  if (kind === "indoor") {
    ctx.fillStyle = night ? "#2b2438" : "#d9c3a0";
    ctx.fillRect(0, 0, W, hz);
    const ww = W * 0.3, wh = H * (W > H ? 0.3 : 0.16), wx = W * 0.12, wy = H * 0.1;
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = "#5a4630"; ctx.lineWidth = 8; ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    ctx.fillStyle = night ? "#463a5c" : "#b99a6d"; rr(ctx, W * 0.62, H * 0.1, W * 0.22, wh * 0.9, 10); ctx.fill();
    ctx.fillStyle = night ? "#6b5d86" : "#e8d3a8"; rr(ctx, W * 0.64, H * 0.1 + 14, W * 0.18, wh * 0.9 - 28, 6); ctx.fill();
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, "#8a6a47"); fl.addColorStop(1, "#5a4129");
    ctx.fillStyle = fl; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 3;
    for (let k = 1; k < 7; k++) { const y = hz + ((H - hz) * k * k) / 49; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    return;
  }

  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  if (night) {
    ctx.fillStyle = "#fff";
    for (let k = 0; k < 40; k++) { ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(T * 1.5 + k)); ctx.fillRect(rnd(k) * W, rnd(k + 90) * hz * 0.8, 3, 3); }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = night ? "#f3f1d8" : s.time === "sore" ? "#ffd08a" : "#fff2b0";
  ctx.beginPath(); ctx.arc(W * 0.78, H * 0.14, H * (W > H ? 0.07 : 0.045), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)";
  for (let k = 0; k < 3; k++) {
    const cx = ((rnd(k + 5) + T * 0.006 * (k + 1)) % 1.3 - 0.15) * W, cy = H * (0.08 + 0.07 * k), r = H * 0.03;
    [[0, 0, 1], [r * 1.2, r * 0.2, 0.8], [-r * 1.2, r * 0.25, 0.75]].forEach(([dx, dy, m]) => { ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, r * 2 * m, r * m, 0, 0, Math.PI * 2); ctx.fill(); });
  }

  let ground = ["#56a85c", "#3f8a4c"];
  if (kind === "beach") {
    const sea = ctx.createLinearGradient(0, hz - H * 0.07, 0, hz);
    sea.addColorStop(0, "#2a8fc4"); sea.addColorStop(1, "#1a6b9c");
    ctx.fillStyle = sea; ctx.fillRect(0, hz - H * 0.07, W, H * 0.07 + 2);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) { const y = hz - H * 0.06 + k * H * 0.012; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + T * 1.5 + k) * 3); ctx.stroke(); }
    ground = ["#ecd9a8", "#d5bd86"];
  } else if (kind === "forest") {
    for (let k = 0; k < 9; k++) {
      const x = (k + rnd(k)) * (W / 8.5), th = H * (0.12 + 0.05 * rnd(k + 7));
      ctx.fillStyle = "#4a3320"; ctx.fillRect(x - 10, hz - th, 20, th);
      ctx.fillStyle = k % 2 ? "#2f7a3e" : "#276a35";
      ctx.beginPath(); ctx.arc(x, hz - th, H * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - H * 0.04, hz - th + H * 0.03, H * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ground = ["#3c8a47", "#2a6b36"];
  } else if (kind === "street") {
    for (let k = 0; k < 8; k++) {
      const bw = W * (0.1 + 0.07 * rnd(k)), bx = k * (W / 7.2) - 10, bh = H * (0.12 + 0.14 * rnd(k + 3));
      ctx.fillStyle = k % 2 ? "#3a4252" : "#4b5567"; ctx.fillRect(bx, hz - bh, bw, bh + 2);
      for (let wy = hz - bh + 14; wy < hz - 14; wy += 26) for (let wx = bx + 10; wx < bx + bw - 14; wx += 24) {
        ctx.fillStyle = night && rnd(wx + wy) > 0.4 ? "#ffd66b" : "rgba(180,210,240,0.45)"; ctx.fillRect(wx, wy, 12, 14);
      }
    }
    ground = ["#4b5059", "#3a3f48"];
  } else {
    ctx.fillStyle = "#4f9a58"; ctx.beginPath(); ctx.ellipse(W * 0.25, hz + 10, W * 0.5, H * 0.06, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#3f8a4c"; ctx.beginPath(); ctx.ellipse(W * 0.8, hz + 10, W * 0.55, H * 0.045, 0, Math.PI, 0); ctx.fill();
  }
  const gr = ctx.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, ground[0]); gr.addColorStop(1, ground[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
  if (kind === "street") {
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 6; ctx.setLineDash([40, 30]);
    ctx.beginPath(); ctx.moveTo(0, groundY + H * 0.1); ctx.lineTo(W, groundY + H * 0.1); ctx.stroke(); ctx.setLineDash([]);
  }
  if (night) { ctx.fillStyle = "rgba(10,16,50,0.3)"; ctx.fillRect(0, hz, W, H - hz); }
}

function drawBackground(g, tl, t) {
  const { ctx, W, H } = g;
  const img = state.images[tl.s.id];
  if (img) {
    const p = clamp(t / tl.dur, 0, 1);
    let zoom = 1.04, ox = 0;
    switch (tl.s.camera) {
      case "zoom_in": zoom = 1.04 + 0.1 * p; break;
      case "zoom_out": zoom = 1.14 - 0.1 * p; break;
      case "pan_left": zoom = 1.14; ox = lerp(0.8, -0.8, p); break;
      case "pan_right": zoom = 1.14; ox = lerp(-0.8, 0.8, p); break;
      default: zoom = 1.04;
    }
    drawCover(ctx, img, W, H, zoom, ox, 0);
    const tint = { malam: "rgba(8,14,50,0.38)", sore: "rgba(255,120,40,0.14)", pagi: "rgba(255,200,150,0.08)" }[tl.s.time];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  } else {
    drawProcBg(g, tl.s, g.T);
  }
}

/* ---------- Stickman ---------- */
const HAIR = { pria: "#2a1b14", wanita: "#1f1420", anak: "#4a2d16", kakek: "#ececf2", nenek: "#d6d6de" };

function computePose(mode, emo, t) {
  const s = Math.sin;
  const P = { lean: 0, head: 0, aF: [0.1, 0.25], aB: [-0.08, 0.12], lF: [0.09, 0.09], lB: [-0.09, -0.09], bob: 0, jump: 0, emo: "normal" };
  if (mode === "walk") {
    const w = t * 10;
    P.lF = [s(w) * 0.55, s(w) * 0.55 - Math.max(0, -Math.cos(w)) * 0.5];
    P.lB = [-s(w) * 0.55, -s(w) * 0.55 - Math.max(0, Math.cos(w)) * 0.5];
    P.aF = [-s(w) * 0.5, -s(w) * 0.5 + 0.35];
    P.aB = [s(w) * 0.5, s(w) * 0.5 + 0.35];
    P.bob = -Math.abs(s(w)) * 1.2;
    P.lean = 0.06;
    return P;
  }
  if (mode === "idle") {
    P.bob = s(t * 2);
    P.aF = [0.08 + 0.04 * s(t * 1.7), 0.22];
    P.aB = [-0.06 + 0.03 * s(t * 1.3), 0.12];
    P.head = 0.03 * s(t * 1.2);
    return P;
  }
  P.emo = emo;
  switch (emo) {
    case "senang":
      P.jump = Math.abs(s(t * 5)) * 0.06;
      P.aF = [2.5 + 0.25 * s(t * 9), 2.7]; P.aB = [2.3 + 0.25 * s(t * 9 + 1), 2.6]; P.head = 0.08 * s(t * 5);
      break;
    case "sedih":
      P.lean = 0.2; P.head = 0.22; P.aF = [0.04, 0.12]; P.aB = [0, 0.06]; P.bob = s(t * 1.5) * 1.5;
      break;
    case "marah":
      P.lean = 0.1; P.head = 0.04 * s(t * 18); P.aF = [0.5, 1.9 + 0.1 * s(t * 16)]; P.aB = [-0.3, 1.6 + 0.1 * s(t * 16 + 1)]; P.bob = s(t * 8) * 2;
      break;
    case "kaget":
      P.lean = -0.18; P.head = -0.08; P.aF = [2.1, 2.4]; P.aB = [1.8, 2.2]; P.bob = s(t * 20);
      break;
    case "tanya":
      P.head = 0.14; P.lean = 0.02; P.aF = [0.9, 2.7]; P.aB = [-0.05, 0.1]; P.bob = s(t * 2);
      break;
    case "lambai":
      P.aF = [2.5, 2.5 + 0.6 * s(t * 9)]; P.aB = [-0.05, 0.1]; P.head = 0.05 * s(t * 3); P.bob = s(t * 3);
      break;
    default:
      P.lean = 0.03; P.head = 0.06 * s(t * 3); P.bob = s(t * 6) * 1.5;
      P.aF = [0.7 + 0.4 * s(t * 4.6), 1.2 + 0.5 * s(t * 4.6 + 1)]; P.aB = [-0.1, 0.1 + 0.15 * s(t * 3.1)];
  }
  return P;
}

function tube(ctx, pts, w, c) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = (dx, dy) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy))); ctx.stroke(); };
  ctx.strokeStyle = shade(c, -0.5); ctx.lineWidth = w + 4; path(0, 0);
  ctx.strokeStyle = c; ctx.lineWidth = w; path(0, 0);
  ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = w * 0.3; path(-w * 0.2, -w * 0.2); ctx.restore();
}

function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

/* o: {x,y(kaki),H(tinggi),face,color,kind,P,mouth,t,phase}  → mengembalikan posisi label nama */
function drawStick(ctx, o) {
  const H = o.H, P = o.P, k = o.kind;
  const hr = (k === "anak" ? 0.14 : 0.105) * H, lw = 0.044 * H, tw = 0.062 * H;
  const L1 = 0.19 * H, L2 = 0.19 * H, T = 0.30 * H, A1 = 0.16 * H, A2 = 0.15 * H;
  const col = o.color, back = shade(col, -0.32);
  const jy = -P.jump * H;
  const hip = { x: 0, y: -(L1 + L2) + jy + P.bob * H * 0.01 };
  const sh = { x: hip.x + Math.sin(P.lean) * T, y: hip.y - Math.cos(P.lean) * T };
  const nk = hr + 0.03 * H;
  const hd = { x: sh.x + Math.sin(P.lean + P.head) * nk, y: sh.y - Math.cos(P.lean + P.head) * nk };
  const chain = (p, a1, l1, a2, l2) => {
    const kn = { x: p.x + Math.sin(a1) * l1, y: p.y + Math.cos(a1) * l1 };
    return [kn, { x: kn.x + Math.sin(a2) * l2, y: kn.y + Math.cos(a2) * l2 }];
  };
  const [kB, fB] = chain(hip, P.lB[0], L1, P.lB[1], L2);
  const [kF, fF] = chain(hip, P.lF[0], L1, P.lF[1], L2);
  const [eB, wB] = chain(sh, P.aB[0], A1, P.aB[1], A2);
  const [eF, wF] = chain(sh, P.aF[0], A1, P.aF[1], A2);

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.face, 1);

  // bayangan di tanah
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - clamp(P.jump * 8, 0, 0.6))})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.26 * H, 0.045 * H, 0, 0, Math.PI * 2); ctx.fill();

  const foot = (p, c) => { ctx.fillStyle = shade(c, -0.55); ctx.beginPath(); ctx.ellipse(p.x + 0.04 * H, p.y - 0.005 * H, 0.065 * H, 0.03 * H, 0, 0, Math.PI * 2); ctx.fill(); };
  const hand = (p) => disc(ctx, p.x, p.y, 0.038 * H, shade(col, 0.2));

  // bagian belakang (lebih gelap)
  tube(ctx, [sh, eB, wB], lw, back); hand(wB);
  tube(ctx, [hip, kB, fB], lw * 1.15, back); foot(fB, col);
  // badan
  tube(ctx, [hip, sh], tw, col);
  // bagian depan
  tube(ctx, [hip, kF, fF], lw * 1.15, col); foot(fF, col);
  tube(ctx, [sh, eF, wF], lw, col); hand(wF);

  // kepala
  ctx.save();
  ctx.translate(hd.x, hd.y);
  ctx.rotate(P.lean + P.head);
  const hair = HAIR[k] || HAIR.pria;
  if (k === "wanita") disc(ctx, -hr * 0.95, hr * 0.15, hr * 0.33, hair);
  if (k === "nenek") disc(ctx, -hr * 0.2, -hr * 1.05, hr * 0.33, hair);
  const g1 = ctx.createRadialGradient(-hr * 0.3, -hr * 0.4, hr * 0.1, 0, 0, hr * 1.05);
  g1.addColorStop(0, shade(col, 0.55)); g1.addColorStop(0.55, col); g1.addColorStop(1, shade(col, -0.4));
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = shade(col, -0.55); ctx.stroke();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, 0, hr * 1.03, Math.PI * 1.12, Math.PI * 1.88); ctx.closePath(); ctx.fill();
  if (k === "anak") { ctx.strokeStyle = hair; ctx.lineWidth = hr * 0.14; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, -hr); ctx.quadraticCurveTo(hr * 0.1, -hr * 1.4, hr * 0.35, -hr * 1.3); ctx.stroke(); }
  if (k === "kakek") {
    ctx.fillStyle = "#f4f4f8";
    ctx.beginPath(); ctx.ellipse(hr * 0.5, hr * 0.78, hr * 0.38, hr * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hr * 0.55, hr * 0.34, hr * 0.3, hr * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  }
  // mata
  const blink = ((o.t + o.phase) % 3.7) < 0.12 ? 0.12 : 1;
  const emo = P.emo;
  const er = hr * (emo === "kaget" ? 0.22 : 0.17);
  [hr * 0.28, hr * 0.7].forEach((ex) => {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, -hr * 0.1, er, er * blink, 0, 0, Math.PI * 2); ctx.fill();
    if (blink === 1) disc(ctx, ex + er * 0.3, -hr * 0.1, er * 0.5, "#1c1210");
  });
  // alis
  ctx.strokeStyle = "#1c1210"; ctx.lineWidth = hr * 0.09; ctx.lineCap = "round";
  [[hr * 0.28, 1], [hr * 0.7, -1]].forEach(([ex, inner]) => {
    const by = -hr * (emo === "kaget" ? 0.46 : 0.36);
    let iy = by, oy = by;
    if (emo === "marah") { iy = by + hr * 0.14; oy = by - hr * 0.05; }
    else if (emo === "sedih") { iy = by - hr * 0.12; oy = by + hr * 0.04; }
    ctx.beginPath(); ctx.moveTo(ex - inner * hr * 0.16, oy); ctx.lineTo(ex + inner * hr * 0.16, iy); ctx.stroke();
  });
  // mulut
  const mx = hr * 0.5, my = hr * 0.45;
  if (o.mouth > 0.08) {
    ctx.fillStyle = "#4a1a22"; ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.2, hr * (0.04 + 0.22 * o.mouth), 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "#3a1218"; ctx.lineWidth = hr * 0.08; ctx.beginPath();
    if (emo === "senang") ctx.arc(mx, my - hr * 0.08, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (emo === "sedih") ctx.arc(mx, my + hr * 0.2, hr * 0.18, 1.15 * Math.PI, 1.85 * Math.PI);
    else { ctx.moveTo(mx - hr * 0.16, my); ctx.lineTo(mx + hr * 0.16, my); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  return { x: o.x + o.face * hd.x, y: o.y + hd.y - hr - 0.07 * H };
}

function drawNameTag(ctx, tag, fs, on) {
  ctx.font = `700 ${fs}px ${FONT}`;
  const w = ctx.measureText(tag.name).width + fs * 0.9, h = fs * 1.5;
  ctx.fillStyle = on ? tag.color : "rgba(0,0,0,0.55)";
  rr(ctx, tag.x - w / 2, tag.y - h, w, h, h / 2); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#1a1208" : "#fff";
  ctx.fillText(tag.name, tag.x, tag.y - h / 2 + 1);
}

/* ---------- Teks ---------- */
function drawSubtitle(g, active, t) {
  if (!active) return;
  const { ctx, W, H } = g;
  const el_ = t - active.start;
  if (el_ < -0.05) return;
  let cw = -1;
  for (let i = 0; i < active.times.length; i++) if (active.times[i] <= el_) cw = i;
  const per = 7;
  const page = Math.floor(Math.max(cw, 0) / per);
  const pw = active.words.slice(page * per, page * per + per);
  const portrait = H > W;
  const fs = portrait ? 40 : 32;
  ctx.font = `700 ${fs}px ${FONT}`;
  const gap = fs * 0.32;
  const boxW = W * 0.9, pad = fs * 0.6;
  const lines = layoutWords(ctx, pw, boxW - pad * 2, gap);
  const lh = fs * 1.35;
  const bh = lines.length * lh + pad * 1.2;
  const bx = W * 0.05, by = H * 0.975 - bh;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  rr(ctx, bx, by, boxW, bh, fs * 0.6); ctx.fill();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  lines.forEach((line, li) => {
    let x = bx + (boxW - line.width) / 2;
    const yc = by + pad * 0.6 + li * lh + lh / 2;
    line.items.forEach((it) => {
      const gi = page * per + it.idx;
      if (gi === cw) {
        const p2 = fs * 0.12;
        ctx.fillStyle = ACCENT; rr(ctx, x - p2, yc - fs * 0.62, it.w + p2 * 2, fs * 1.24, fs * 0.22); ctx.fill();
        ctx.fillStyle = "#1a1208";
      } else ctx.fillStyle = gi < cw ? "#ffffff" : "rgba(255,255,255,0.5)";
      ctx.fillText(it.word, x, yc);
      x += it.w + gap;
    });
  });
  // label pembicara
  const nar = isNarr(active.ln.speaker);
  const cs = g.charsByKey[castKey(active.ln.speaker)];
  const lab = nar ? "🎙 Narator" : active.ln.speaker;
  ctx.font = `800 ${fs * 0.62}px ${FONT}`;
  const lw = ctx.measureText(lab).width + fs * 0.9, lhh = fs * 1.0;
  ctx.fillStyle = nar ? "#8d9bb8" : (cs ? cs.color : ACCENT);
  rr(ctx, bx + fs * 0.4, by - lhh / 2, lw, lhh, lhh / 2); ctx.fill();
  ctx.textAlign = "left"; ctx.fillStyle = "#1a1208";
  ctx.fillText(lab, bx + fs * 0.4 + fs * 0.45, by + 1);
}

/* ---------- Susunan adegan ---------- */
function buildChars(project, s, prev, W, H) {
  const present = s.present || [];
  const n = Math.max(1, present.length);
  const base = { 1: [0.5], 2: [0.3, 0.7], 3: [0.2, 0.5, 0.8], 4: [0.14, 0.38, 0.62, 0.86] }[Math.min(4, n)];
  const landscape = W > H;
  const shrink = n >= 4 ? 0.82 : n === 3 ? 0.9 : 1;
  const prevKeys = new Set(prev ? (prev.s.present || []).map(castKey) : []);
  const sameLoc = prev && prev.s.location === s.location;
  return present.map((name, i) => {
    const c = project.characters.find((x) => castKey(x.name) === castKey(name)) || { name, kind: "pria", color: PALETTE[i % PALETTE.length] };
    const sx = (landscape ? 0.5 + (base[i] - 0.5) * 0.8 : base[i]) * W;
    const kind = c.kind in KINDS ? c.kind : "pria";
    return {
      key: castKey(c.name), name: c.name, kind, color: c.color || PALETTE[i % PALETTE.length],
      slotX: sx, face: sx <= W / 2 ? 1 : -1, phase: i * 1.3,
      H: (landscape ? 0.46 : 0.27) * H * KINDS[kind].scale * shrink,
      enter: !(sameLoc && prevKeys.has(castKey(c.name))),
    };
  });
}

function drawFrame(g, T) {
  const { ctx, W, H, tl, total } = g;
  g.T = T;
  let i = 0;
  for (let k = 0; k < tl.length; k++) if (T >= tl[k].start) i = k;
  const cur = tl[i];
  const t = T - cur.start;
  const active = cur.lines.find((L) => t >= L.start && t < L.start + L.dur + 0.04) || null;

  g.mouth += ((active ? g.rms : 0) - g.mouth) * 0.5;
  drawBackground(g, cur, t);

  const ENTER = 0.85;
  const tags = [];
  g.charsByKey = {};
  cur.chars.forEach((ch) => {
    g.charsByKey[ch.key] = ch;
    const speaking = active && castKey(active.ln.speaker) === ch.key;
    let x = ch.slotX, P;
    if (ch.enter && t < ENTER) {
      const sx = ch.slotX <= W / 2 ? -W * 0.12 : W * 1.12;
      x = lerp(sx, ch.slotX, easeOutCubic(t / ENTER));
      P = computePose("walk", "normal", t);
    } else if (speaking) {
      P = computePose("talk", active.ln.emotion, t);
    } else {
      P = computePose("idle", "normal", T + ch.phase);
    }
    const pos = drawStick(ctx, { x, y: g.groundY, H: ch.H, face: ch.face, color: ch.color, kind: ch.kind, P, mouth: speaking ? g.mouth : 0, t: T, phase: ch.phase });
    tags.push({ name: ch.name, color: ch.color, x: pos.x, y: pos.y, on: !!speaking });
  });
  const tfs = Math.max(18, Math.round(H * (W > H ? 0.04 : 0.026)));
  tags.forEach((tg) => drawNameTag(ctx, tg, tfs, tg.on));

  drawSubtitle(g, active, t);

  // judul kecil + penghitung adegan
  const ts = W > H ? 22 : 24;
  ctx.font = `600 ${ts}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  let title = state.project.title;
  while (title.length > 4 && ctx.measureText(title).width > W * 0.62) title = title.slice(0, -2);
  if (title !== state.project.title) title += "…";
  ctx.textAlign = "left"; ctx.strokeText(title, W * 0.05, 40); ctx.fillText(title, W * 0.05, 40);
  const cnt = `${cur.s.emoji} ${i + 1}/${tl.length}`;
  ctx.textAlign = "right"; ctx.strokeText(cnt, W * 0.95, 40); ctx.fillText(cnt, W * 0.95, 40);

  // bilah progres
  ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(0, 0, W, 8);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, 0, W * clamp(T / total, 0, 1), 8);

  // memudar masuk tiap adegan & di akhir
  if (t < 0.35) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.35})`; ctx.fillRect(0, 0, W, H); }
  if (T > total - 0.6) { ctx.fillStyle = `rgba(0,0,0,${clamp((T - (total - 0.6)) / 0.6, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
}

function pickMime() {
  const list = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
}

/* Linimasa: tiap adegan = masuk (0,85 dtk) + ucapan berurutan + jeda */
function buildTimeline(project) {
  const { w: W, h: H } = dims(project.options.ratio);
  const ENTER = 0.85, GAP = 0.3;
  let acc = 0;
  const tl = [];
  project.scenes.forEach((s, i) => {
    let cur = ENTER;
    const lines = s.lines.map((ln, li) => {
      const a = state.audio[`${s.id}:${li}`] || null;
      const rate = a ? Math.pow(2, a.detune / 1200) : 1;
      const words = ln.text.split(/\s+/).filter(Boolean);
      const dur = a ? a.buf.duration / rate : words.length / 2.4 + 0.5;
      const L = { ln, li, a, rate, start: cur, dur, words, times: wordTimes(words, dur, 0.1) };
      cur += dur + GAP;
      return L;
    });
    const x = { s, i, start: acc, dur: Math.max(3, cur + 0.3), lines };
    x.chars = buildChars(project, s, tl[i - 1] || null, W, H);
    acc += x.dur;
    tl.push(x);
  });
  return { tl, total: acc + 0.4, W, H };
}

async function renderVideo(onProgress) {
  if (typeof MediaRecorder === "undefined") throw new Error("Browser ini tidak bisa merekam video. Pakai Chrome terbaru di HP/PC.");
  const project = state.project;
  const { tl, total, W, H } = buildTimeline(project);
  const canvas = $("stage");
  canvas.hidden = false;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const ac = ensureAC();
  await ac.resume().catch(() => {});

  // graf audio
  const dest = ac.createMediaStreamDestination();
  const voiceBus = ac.createGain();
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  voiceBus.connect(dest);
  voiceBus.connect(analyser);
  const t0 = ac.currentTime + 0.4;
  tl.forEach((x) => x.lines.forEach((L) => {
    if (!L.a) return;
    const src = ac.createBufferSource();
    src.buffer = L.a.buf;
    src.detune.value = L.a.detune;
    src.connect(voiceBus);
    src.start(t0 + x.start + L.start);
  }));
  if (state.music) {
    const ms = ac.createBufferSource();
    ms.buffer = state.music;
    ms.loop = true;
    const mg = ac.createGain();
    const vol = 0.12;
    mg.gain.setValueAtTime(0.0001, t0);
    mg.gain.linearRampToValueAtTime(vol, t0 + 1);
    mg.gain.setValueAtTime(vol, Math.max(t0 + 1, t0 + total - 1.5));
    mg.gain.linearRampToValueAtTime(0.0001, t0 + total);
    ms.connect(mg);
    mg.connect(dest);
    ms.start(t0);
    ms.stop(t0 + total + 0.2);
  }

  const g = { ctx, W, H, groundY: H * (W > H ? 0.8 : 0.74), tl, total, mouth: 0, rms: 0, T: 0, charsByKey: {} };
  const level = new Uint8Array(analyser.fftSize);

  // perekam
  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = pickMime();
  let rec;
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 } : {});
  } catch (e) {
    rec = new MediaRecorder(stream);
  }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej((e && e.error) || new Error("Perekam video gagal.")); });

  let wake = null;
  try { if (navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); } catch (e) { /* abaikan */ }
  let hiddenWarned = false;
  const onVis = () => { if (document.hidden && !hiddenWarned) { hiddenWarned = true; log("PERINGATAN: halaman tersembunyi saat merekam, bagian video bisa membeku. Ulangi dan jangan pindah aplikasi."); } };
  document.addEventListener("visibilitychange", onVis);

  drawFrame(g, 0);
  rec.start(1000);

  try {
    await new Promise((resolve, reject) => {
      const tick = () => {
        try {
          const T = Math.max(0, ac.currentTime - t0);
          analyser.getByteTimeDomainData(level);
          let sum = 0;
          for (let k = 0; k < level.length; k++) { const d = (level[k] - 128) / 128; sum += d * d; }
          g.rms = clamp(Math.sqrt(sum / level.length) * 5, 0, 1);
          drawFrame(g, Math.min(T, total));
          onProgress(clamp(T / total, 0, 1));
          if (T >= total) { resolve(); return; }
          requestAnimationFrame(tick);
        } catch (e) { reject(e); }
      };
      requestAnimationFrame(tick);
    });
    await sleep(300);
  } finally {
    document.removeEventListener("visibilitychange", onVis);
    if (rec.state !== "inactive") rec.stop();
    if (wake) wake.release().catch(() => {});
  }
  await stopped;
  const blob = new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] });
  if (blob.size < 1000) throw new Error("Video hasil rekaman kosong. Coba lagi dengan Chrome terbaru.");
  return blob;
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
    const d = await request("/api/health?probe=1", { method: "GET", attempts: 1 }, 30000);
    const c = d.configured;
    const yn = (v) => (v ? "✓" : "✕");
    const e = d.edge_tts;
    out.textContent =
      `Terhubung ✓ (Worker v${d.version})\n` +
      `Workers AI (FLUX + LLM) : ${yn(c.workers_ai)}\n` +
      `LLM kustom (opsional)   : ${yn(c.llm_kustom)}\n` +
      `Suara Edge (beda tiap tokoh): ${e ? (e.ok ? "✓" : "✕ " + e.error) : "?"}\n` +
      `Browser rekam video     : ${typeof MediaRecorder !== "undefined" ? "✓ " + (pickMime() || "bawaan") : "✕ tidak didukung"}\n` +
      (e && !e.ok ? "\nSuara Edge tidak tersedia. Aplikasi otomatis memakai suara Google dengan nada digeser per tokoh (masih terdengar beda, tapi kurang natural).\n" : "") +
      (c.workers_ai ? "" : "\nBinding AI belum dipasang. Gambar & naskah memakai cadangan gratis yang kurang stabil. Pasang binding Workers AI bernama AI.");
  } catch (e) {
    out.textContent = "Gagal: " + e.message;
  }
}

async function shareVideo() {
  try {
    const file = new File([state.blob], state.fileName || "video.webm", { type: state.blob.type });
    await navigator.share({ files: [file], title: state.project ? state.project.title : "Video AI" });
  } catch (e) { /* dibatalkan */ }
}

function init() {
  $("workerUrl").value = load("worker", "");
  $("appToken").value = load("token", "");
  $("script").value = load("draft", "");
  ["style", "lang", "ratio", "targetSec", "maxScenes", "musicUrl"].forEach((id) => {
    $(id).value = load(id, $(id).value);
    if ($(id).value === "" && id !== "musicUrl") $(id).selectedIndex = 0;
    $(id).addEventListener("change", () => store(id, $(id).value));
  });
  if ($("workerUrl").value) $("settings").open = false;

  const upd = () => { $("counter").textContent = `${$("script").value.length} / 6000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); });
  upd();

  renderSteps();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Pengaturan tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnClearVoices").addEventListener("click", () => { saveVoices({}); $("healthOut").hidden = false; $("healthOut").textContent = "Semua kunci suara dihapus."; });
  $("btnSample").addEventListener("click", () => { $("script").value = SAMPLE; upd(); store("draft", SAMPLE); });
  $("btnStart").addEventListener("click", () => {
    try { baseUrl(); } catch (e) { showError(e.message); $("settings").open = true; return; }
    saveSettings();
    state.project = null;
    state.blob = null;
    state.cast = {};
    $("log").textContent = "";
    $("stage").hidden = true;
    $("castCard").hidden = true;
    renderSteps();
    run(0);
  });
  $("btnResume").addEventListener("click", () => {
    if (state.failedIndex === null) return;
    run(state.failedIndex);
  });
  $("btnLockAll").addEventListener("click", () => {
    Object.keys(state.cast).forEach((k) => { state.cast[k].locked = true; persistCast(k); });
    renderCast();
  });
  $("btnCastDone").addEventListener("click", finishCast);
  if (navigator.canShare && navigator.share) $("btnShare").hidden = false;
  $("btnShare").addEventListener("click", shareVideo);
}

init();
