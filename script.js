/* =====================================================================
 *  script.js — Frontend Studio Video AI v4 (tokoh berpakaian gaya buku cerita)
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
  { key: "cast", name: "Agen 2 · Casting (tampilan & suara tokoh)" },
  { key: "visual", name: "Agen 3 · Latar Gambar (FLUX)" },
  { key: "voice", name: "Agen 4 · Pengisi Suara" },
  { key: "music", name: "Agen 5 · Musik & Suara" },
  { key: "render", name: "Agen 6 · Editor Video (rekam)" },
];

const SAMPLE = `Narator: Pagi itu di kelas, ada murid baru bernama Dina. Ia anak pengusaha yang tinggal di rumah besar.
Dina: Halo, namaku Dina. Maukah kamu jadi temanku?
Beni: Tentu! Aku Beni. Ayahku petani di desa sebelah.
Bu Guru: Anak-anak, hari ini kita belajar berbagi.
Narator: Saat istirahat, bekal Dina hilang tertinggal di mobil. Ia hanya diam di kantin.
Beni: Dina, ayo makan bekalku. Ada nasi dan telur dadar.
Dina: Terima kasih, Beni. Besok aku bawa kue untuk kita semua!
Narator: Sepulang sekolah, Dina mengajak Beni ke rumahnya, dan mereka bermain bersama.
Narator: Ternyata, teman sejati tidak melihat siapa kita, tetapi bagaimana kita saling menolong.`;

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

/* ------------------------------ Katalog tampilan tokoh ------------------------------ */
// Gaya "buku cerita": kepala bulat, tangan & kaki hitam tipis, baju yang membedakan tiap tokoh
const SKINS = [
  ["#fffaf0", "Putih krem (gaya buku cerita)"],
  ["#ffdcb8", "Terang"],
  ["#f1c27d", "Sawo muda"],
  ["#d9a066", "Sawo"],
  ["#b9794a", "Sawo matang"],
  ["#8a5530", "Gelap"],
];
const HAIRCOL = ["#2a1b14", "#4a2d16", "#1f1420", "#6b4a2a", "#8a3b1c"];
const CASUAL = ["#4da3ff", "#e0577a", "#3fbf8f", "#f0a43a", "#8a6bd6", "#e8664a"];

// legs: short (celana pendek) | long (celana panjang) | skirt (rok pendek) | longdress (gamis/kain panjang)
const OUTFITS = {
  kemeja:  { label: "Kemeja kantor",   top: "#e9f0fb", bottom: "#2b3445", sleeve: "long",  legs: "long",  deco: "tie" },
  jas:     { label: "Jas formal",      top: "#2a3042", bottom: "#2a3042", sleeve: "long",  legs: "long",  deco: "suit" },
  batik:   { label: "Batik",           top: "#9a6232", bottom: "#2b2b3a", sleeve: "long",  legs: "long",  deco: "batik" },
  kaos:    { label: "Kaos santai",     top: "#4da3ff", bottom: "#3b5a8c", sleeve: "short", legs: "short", deco: "logo", vary: true },
  sd:      { label: "Seragam SD",      top: "#f6f6f6", bottom: "#d62f3a", sleeve: "short", legs: "short", deco: "scarf" },
  smp:     { label: "Seragam SMP",     top: "#f6f6f6", bottom: "#2a4f9e", sleeve: "short", legs: "long",  deco: "badge" },
  gamis:   { label: "Gamis + hijab",   top: "#7b5fb5", bottom: "#7b5fb5", sleeve: "long",  legs: "longdress", head: "hijab", vary: true },
  daster:  { label: "Daster rumah",    top: "#e08aa0", bottom: "#e08aa0", sleeve: "short", legs: "skirt", deco: "flower", vary: true },
  kebaya:  { label: "Kebaya + kain",   top: "#b8324a", bottom: "#7a4524", sleeve: "long",  legs: "longdress", deco: "kebaya", hair: "sanggul" },
  gaun:    { label: "Gaun pesta",      top: "#ff8fc0", bottom: "#ff8fc0", sleeve: "short", legs: "skirt", deco: "gaun", vary: true },
  koko:    { label: "Baju koko + peci", top: "#f1efe6", bottom: "#3a4a3a", sleeve: "long", legs: "long",  deco: "buttons", head: "peci" },
  petani:  { label: "Petani + caping", top: "#7a6a3a", bottom: "#5a4a2a", sleeve: "long",  legs: "short", deco: "rope", head: "caping" },
  nelayan: { label: "Nelayan",         top: "#2e6c8c", bottom: "#37424d", sleeve: "short", legs: "short", deco: "stripe", head: "topi" },
  chef:    { label: "Koki",            top: "#fafafa", bottom: "#2f3640", sleeve: "long",  legs: "long",  deco: "buttons", head: "koki" },
  dokter:  { label: "Dokter",          top: "#fafafa", bottom: "#3b5a7a", sleeve: "long",  legs: "long",  deco: "steto" },
  polisi:  { label: "Polisi",          top: "#8a6a3f", bottom: "#4a3a2a", sleeve: "short", legs: "long",  deco: "belt", head: "polisi" },
  overall: { label: "Baju kerja (overall)", top: "#e9b21f", bottom: "#2f5aa0", sleeve: "short", legs: "long", deco: "overall" },
};
const OUTFIT_BY = {
  pria: ["kemeja", "batik", "kaos", "jas", "koko", "overall"],
  wanita: ["gamis", "daster", "kebaya", "kemeja", "gaun"],
  anak_l: ["sd", "kaos", "smp", "koko"],
  anak_p: ["gaun", "sd", "gamis", "kaos", "smp"],
  kakek: ["koko", "batik", "kemeja", "petani"],
  nenek: ["kebaya", "daster", "gamis"],
};

function hashStr(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function mixHex(a, b, p) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const m = (sft) => Math.round(((x >> sft) & 255) * (1 - p) + ((y >> sft) & 255) * p);
  return "#" + [16, 8, 0].map((sft) => m(sft).toString(16).padStart(2, "0")).join("");
}
function kindGender(kind, g) {
  if (kind === "pria" || kind === "kakek") return "l";
  if (kind === "wanita" || kind === "nenek") return "p";
  return g === "p" ? "p" : "l";
}

/* Membuat tampilan lengkap tokoh. `over` = tampilan tersimpan/kustom yang menimpa bawaan. */
function resolveLook(c, over) {
  const h = hashStr(c.name);
  const kind = c.kind in KINDS ? c.kind : "pria";
  const gender = kindGender(kind, c.gender || (h % 2 ? "p" : "l"));
  const list = OUTFIT_BY[kind === "anak" ? "anak_" + gender : kind] || OUTFIT_BY.pria;
  const outfit = OUTFITS[c.outfit] ? c.outfit : list[h % list.length];
  const OF = OUTFITS[outfit];
  const status = ["kaya", "menengah", "sederhana"].includes(c.status) ? c.status : "menengah";
  const tint = (x) => (status === "sederhana" ? mixHex(x, "#8d8a80", 0.25) : status === "kaya" ? mixHex(x, "#ffffff", 0.06) : x);
  const accent = CASUAL[h % CASUAL.length];
  let hair = gender === "p" ? (kind === "anak" ? (h % 2 ? "bob" : "kuncir") : kind === "nenek" ? "sanggul" : "panjang") : kind === "kakek" ? "uban" : "pendek";
  if (OF.hair) hair = OF.hair;
  let head = OF.head || "none";
  if (head === "none" && kind === "anak" && gender === "p" && !OF.head && h % 3 === 0) head = "bando";
  let legs = OF.legs;
  if ((outfit === "sd" || outfit === "smp") && gender === "p") legs = "skirt";
  const top = OF.vary ? tint(accent) : tint(OF.top);
  const bottom = OF.vary && (OF.legs === "skirt" || OF.legs === "longdress") ? top : tint(OF.bottom);
  const L = {
    outfit, status, gender, legs, head, hair,
    skin: SKINS[0][0],
    hairColor: kind === "kakek" ? "#ececf2" : kind === "nenek" ? "#d6d6de" : HAIRCOL[h % HAIRCOL.length],
    top, bottom, sleeve: OF.sleeve, deco: OF.deco || "",
    glasses: kind === "kakek" || /guru|dokter/i.test(c.role || "") || (status === "kaya" && h % 3 === 0),
    beard: kind === "kakek" ? "jenggot" : kind === "pria" && h % 5 === 0 ? "kumis" : "none",
    shoes: status === "kaya" ? "kulit" : status === "sederhana" ? "sandal" : "sneaker",
    bag: outfit === "sd" || outfit === "smp" || (outfit === "kaos" && h % 2 === 0),
    bagColor: CASUAL[(h >> 3) % CASUAL.length],
    gold: status === "kaya",
  };
  return Object.assign(L, over || {});
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

/* ------------------------------ Casting, tampilan & simpan tokoh ------------------------------ */
const castKey = (name) => String(name).toLowerCase();
const LOOK_HAIR = [["pendek", "Pendek"], ["poni", "Poni"], ["bob", "Bob"], ["panjang", "Panjang"], ["kuncir", "Kuncir"], ["sanggul", "Sanggul"], ["uban", "Uban"], ["botak", "Botak"]];
const LOOK_HEAD = [["none", "Tanpa penutup"], ["hijab", "Hijab"], ["peci", "Peci"], ["caping", "Caping"], ["topi", "Topi"], ["koki", "Topi koki"], ["polisi", "Topi polisi"], ["bando", "Bando"]];
const LOOK_STATUS = [["kaya", "Kaya"], ["menengah", "Menengah"], ["sederhana", "Sederhana"]];
const LOOK_BEARD = [["none", "Tanpa"], ["jenggot", "Jenggot"], ["kumis", "Kumis"]];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function field(label, node) { const w = el("div"); w.append(el("label", "", label), node); return w; }
function selectEl(opts, val, cb) {
  const s = el("select");
  opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; if (v === val) o.selected = true; s.append(o); });
  s.addEventListener("change", () => cb(s.value));
  return s;
}
function colorEl(val, cb) {
  const i = el("input"); i.type = "color"; i.value = /^#[0-9a-f]{6}$/i.test(val) ? val : "#888888";
  i.addEventListener("input", () => cb(i.value));
  return i;
}

const recordOf = (c) => ({ name: c.name, voiceId: c.voiceId, pitch: c.pitch, rate: c.rate, kind: c.kind, lang: c.lang, gender: c.gender, role: c.role, status: c.status, look: c.look });
const currentStyle = () => (state.project ? state.project.options.style : $("style").value);

function knownCharacters() {
  const saved = loadVoices();
  return Object.keys(saved).filter((k) => k !== "narator").slice(0, 8).map((k) => {
    const v = saved[k];
    return { name: v.name || k, kind: v.kind, gender: v.gender, role: v.role || "", status: v.status, outfit: v.look && v.look.outfit };
  });
}

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
    const kind = sv && sv.kind in KINDS ? sv.kind : c.kind;
    const nth = counts[kind] || 0;
    counts[kind] = nth + 1;
    const voiceOk = sv && VOICES[lang].some((v) => v.id === sv.voiceId);
    const entry = {
      name: c.name, narrator: !!c.narrator, lang, locked: !!sv,
      role: (sv && sv.role) || c.role || "", gender: (sv && sv.gender) || c.gender,
      status: (sv && sv.status) || c.status, kind,
      ...(voiceOk ? { voiceId: sv.voiceId, pitch: sv.pitch, rate: sv.rate } : defaultVoice(kind, nth, lang)),
    };
    if (!c.narrator) {
      entry.look = resolveLook({ ...c, kind, gender: entry.gender, status: entry.status }, sv && sv.look);
      c.kind = kind;
    }
    state.cast[key] = entry;
  });
}

function persistCast(key) {
  const c = state.cast[key];
  const saved = loadVoices();
  if (c.locked) saved[key] = recordOf(c);
  else delete saved[key];
  saveVoices(saved);
  renderLibrary();
}

function drawPreview(cv, c) {
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, "#eef4ff"); g.addColorStop(1, "#d9e6cf");
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, cv.height * 0.93, cv.width, cv.height * 0.07);
  const sty = charStyleOf(currentStyle());
  drawPerson(ctx, { x: cv.width / 2, y: cv.height * 0.93, H: cv.height * 0.9 * (KINDS[c.kind] ? Math.max(0.78, KINDS[c.kind].scale) : 1), face: 1, look: c.look, kind: c.kind, P: computePose("idle", "normal", 1.3), mouth: 0, t: 1, phase: 0, sty });
}

/* Kartu tokoh: dipakai di layar casting dan di Perpustakaan karakter. Selalu bisa diedit. */
function buildCastCard(c, o) {
  const lang = c.lang || o.lang;
  const card = el("details", "cast-item" + (c.locked ? " locked" : ""));
  card.open = !!o.open || !c.locked;

  const head = el("summary", "cast-head");
  const dot = el("span", "dot"); dot.style.background = o.color || "#9fb3d9";
  const nm = el("strong", "", c.name);
  const sub = el("span", "small", "");
  const lock = el("button", "ghost lockbtn", "");
  lock.type = "button";
  const setLockUi = () => { lock.textContent = c.locked ? "🔒 Tersimpan" : "🔓 Simpan"; card.classList.toggle("locked", c.locked); };
  lock.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); c.locked = !c.locked; setLockUi(); o.persist(); });
  head.append(dot, nm);
  if (!o.library) { setLockUi(); head.append(lock); }
  if (o.onDelete) {
    const del = el("button", "ghost lockbtn", "🗑 Hapus"); del.type = "button";
    del.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Hapus karakter & suara "${c.name}" dari perangkat ini?`)) o.onDelete(); });
    head.append(del);
  }
  head.append(sub);
  card.append(head);

  const body = el("div", "cast-body");
  card.append(body);

  function renderBody() {
    body.innerHTML = "";
    const L = c.look;
    sub.textContent = c.narrator ? "suara pencerita" : `${c.role ? c.role + " · " : ""}${OUTFITS[L.outfit] ? OUTFITS[L.outfit].label : ""}`;

    if (!c.narrator) {
      const top = el("div", "look-row");
      const cv = el("canvas", "cast-prev"); cv.width = 200; cv.height = 300;
      const redraw = () => drawPreview(cv, c);
      redraw();
      const set = (patch) => { Object.assign(c.look, patch); redraw(); o.persist(); };
      const relook = (patch) => {
        const keep = { skin: L.skin, hair: L.hair, hairColor: L.hairColor, glasses: L.glasses, beard: L.beard };
        c.look = resolveLook({ name: c.name, kind: c.kind, gender: c.gender, outfit: patch.outfit || L.outfit, status: patch.status || L.status }, keep);
        o.persist(); renderBody();
      };
      const g1 = el("div", "grid");
      g1.append(
        field("Pakaian", selectEl(Object.entries(OUTFITS).map(([k, v]) => [k, v.label]), L.outfit, (v) => relook({ outfit: v }))),
        field("Status keluarga", selectEl(LOOK_STATUS, L.status, (v) => relook({ status: v }))),
        field("Rambut", selectEl(LOOK_HAIR, L.hair, (v) => set({ hair: v }))),
        field("Penutup kepala", selectEl(LOOK_HEAD, L.head, (v) => set({ head: v }))),
        field("Warna kulit", selectEl(SKINS, L.skin, (v) => set({ skin: v }))),
        field("Janggut", selectEl(LOOK_BEARD, L.beard, (v) => set({ beard: v }))),
        field("Warna baju", colorEl(L.top, (v) => set({ top: v }))),
        field("Warna bawahan", colorEl(L.bottom, (v) => set({ bottom: v }))),
      );
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!L.glasses;
      cb.addEventListener("change", () => set({ glasses: cb.checked }));
      const cbl = el("label", "check"); cbl.append(cb, document.createTextNode(" Kacamata"));
      const cb2 = el("input"); cb2.type = "checkbox"; cb2.checked = !!L.bag;
      cb2.addEventListener("change", () => set({ bag: cb2.checked }));
      const cbl2 = el("label", "check"); cbl2.append(cb2, document.createTextNode(" Tas selempang"));
      const right = el("div", "look-fields"); right.append(g1, cbl, cbl2);
      top.append(cv, right);
      body.append(top);
    }

    const kindSel = selectEl(Object.entries(KINDS).map(([k, v]) => [k, v.label]), c.kind, (v) => {
      Object.assign(c, defaultVoice(v, 0, lang));
      if (!c.narrator) {
        c.gender = kindGender(v, c.gender);
        c.look = resolveLook({ name: c.name, kind: v, gender: c.gender, outfit: c.look.outfit, status: c.look.status }, { skin: c.look.skin });
      }
      o.persist(); renderBody();
    });
    const voiceSel = selectEl(VOICES[lang].map((v) => [v.id, v.label]), c.voiceId, (v) => { c.voiceId = v; o.persist(); });
    const g2 = el("div", "grid");
    g2.append(field("Jenis suara", kindSel), field("Suara dasar", voiceSel));
    const slider = (label, prop, min, max, unit) => {
      const wrap = el("div");
      const lb = el("label", "", `${label}: ${c[prop]}${unit}`);
      const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = 1; r.value = c[prop];
      r.addEventListener("input", () => { c[prop] = Number(r.value); lb.textContent = `${label}: ${c[prop]}${unit}`; });
      r.addEventListener("change", () => o.persist());
      wrap.append(lb, r);
      return wrap;
    };
    const sl = el("div", "grid");
    sl.append(slider("Nada", "pitch", -80, 80, " Hz"), slider("Kecepatan", "rate", -40, 40, "%"));
    const test = el("button", "ghost", "▶ Tes suara");
    test.type = "button";
    test.addEventListener("click", () => previewVoice(c, lang, test));
    const row = el("div", "row"); row.append(test);
    body.append(g2, sl, row);
  }
  renderBody();
  return card;
}

function renderCast() {
  const box = $("castList");
  box.innerHTML = "";
  const lang = state.project.options.lang;
  Object.keys(state.cast).forEach((key) => {
    const c = state.cast[key];
    const ch = state.project.characters.find((x) => castKey(x.name) === key);
    box.append(buildCastCard(c, { lang, color: ch ? ch.color : "#9fb3d9", persist: () => persistCast(key) }));
  });
}

/* Perpustakaan karakter & suara yang tersimpan di HP ini: bisa diedit kapan saja, tanpa memulai produksi */
function renderLibrary() {
  const box = $("libList");
  if (!box) return;
  box.innerHTML = "";
  const saved = loadVoices();
  const keys = Object.keys(saved);
  $("libEmpty").hidden = keys.length > 0;
  keys.forEach((key, i) => {
    const sv = saved[key];
    const lang = sv.lang || $("lang").value;
    const c = { ...sv, name: sv.name || key, narrator: key === "narator", locked: true, lang };
    if (!c.narrator) c.look = resolveLook({ name: c.name, kind: c.kind, gender: c.gender, status: c.status }, sv.look);
    box.append(buildCastCard(c, {
      lang, library: true, color: PALETTE[i % PALETTE.length],
      persist: () => { const all = loadVoices(); all[key] = recordOf(c); saveVoices(all); },
      onDelete: () => { const all = loadVoices(); delete all[key]; saveVoices(all); renderLibrary(); },
    }));
  });
}

async function previewVoice(c, lang, btn) {
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = "memuat…";
  try {
    const en = lang === "en";
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
  setDetail("Cek pakaian & suara tiap tokoh (ketuk kartu untuk mengubah), tes suara, lalu Simpan. Setelah itu tekan Lanjutkan produksi.");
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
    genre: $("genre").value,
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
      body: JSON.stringify({ script, options: { ...readOptions(), known: knownCharacters() } }),
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

  /* Agen 2 — casting: pakaian & suara tiap tokoh; yang tersimpan dipakai ulang (tetap bisa diedit) */
  async () => {
    const p = state.project;
    if (!Object.keys(state.cast).length) initCast(p);
    const all = Object.values(state.cast);
    if ($("skipCast").checked && all.every((c) => c.locked)) { log("Semua tokoh sudah tersimpan, layar casting dilewati (sesuai pilihan Anda)."); return "tokoh tersimpan"; }
    if (all.some((c) => c.locked)) log("Ada tokoh yang sudah tersimpan: kartunya tetap tampil agar bisa diedit.");
    await showCastReview();
    setDetail("");
    return `${all.length} tokoh`;
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
  if (/mewah|mansion|villa|istana|rumah besar|gedong/.test(t)) return "mansion";
  if (/kelas|sekolah|school|kantin|classroom/.test(t)) return "classroom";
  if (/sawah|padi|ladang|paddy/.test(t)) return "paddy";
  if (/pasar|market/.test(t)) return "market";
  if (/pantai|laut|dermaga|pelabuhan|danau|sungai|beach|sea|lake|river|pier/.test(t)) return "beach";
  if (/hutan|kebun|gunung|desa|taman|forest|garden|mountain|park/.test(t)) return "forest";
  if (/rumah|kamar|dapur|warung|kafe|cafe|kantor|toko|restoran|ruang|masjid|bengkel|house|room|kitchen|office|shop/.test(t)) return "indoor";
  if (/jalan|kota|terminal|stasiun|bandara|gang|kampung|street|city|station/.test(t)) return "street";
  return "field";
}

function drawRoomExtras(g, kind, hz) {
  const { ctx, W, H } = g;
  if (kind === "classroom") {
    ctx.fillStyle = "#2f6b4f"; rr(ctx, W * 0.3, H * 0.07, W * 0.4, H * 0.12, 8); ctx.fill();
    ctx.strokeStyle = "#8a6a47"; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
    [0, 1, 2].forEach((i) => { ctx.beginPath(); ctx.moveTo(W * 0.34, H * (0.1 + 0.025 * i)); ctx.lineTo(W * (0.54 - i * 0.04), H * (0.1 + 0.025 * i)); ctx.stroke(); });
    for (let k = 0; k < 4; k++) {
      const x = W * (0.06 + k * 0.24);
      ctx.fillStyle = "#a9794a"; rr(ctx, x, hz + H * 0.012, W * 0.16, H * 0.03, 6); ctx.fill();
      ctx.fillStyle = "#7a5430"; ctx.fillRect(x + 8, hz + H * 0.04, 6, H * 0.03); ctx.fillRect(x + W * 0.16 - 14, hz + H * 0.04, 6, H * 0.03);
    }
  } else if (kind === "mansion") {
    ctx.fillStyle = "#a3262f"; ctx.fillRect(W * 0.07, 0, W * 0.05, H * 0.3); ctx.fillRect(W * 0.42, 0, W * 0.05, H * 0.3);
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.lineTo(W * 0.5, H * 0.05); ctx.stroke();
    ctx.fillStyle = "#d4af37"; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.07, W * 0.07, H * 0.018, 0, 0, Math.PI * 2); ctx.fill();
    [-0.06, -0.03, 0, 0.03, 0.06].forEach((d) => { ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(W * (0.5 + d), H * 0.095, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "#8c1d2c"; ctx.beginPath(); ctx.moveTo(W * 0.1, H); ctx.lineTo(W * 0.9, H); ctx.lineTo(W * 0.72, hz + H * 0.02); ctx.lineTo(W * 0.28, hz + H * 0.02); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 4; ctx.stroke();
  }
}

function drawAwnings(g, hz) {
  const { ctx, W, H } = g;
  const cols = ["#d9363e", "#2f8fd8", "#f0a43a", "#3fae6b"];
  for (let k = 0; k < 4; k++) {
    const x = k * (W / 3.8) + 6, w = W / 4.2, y = hz - H * 0.13;
    for (let q = 0; q < 6; q++) { ctx.fillStyle = q % 2 ? "#ffffff" : cols[k]; ctx.beginPath(); ctx.moveTo(x + (q * w) / 6, y); ctx.lineTo(x + ((q + 1) * w) / 6, y); ctx.lineTo(x + ((q + 1) * w) / 6 + 4, y + H * 0.04); ctx.lineTo(x + (q * w) / 6 - 4, y + H * 0.04); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = "#7a5430"; ctx.fillRect(x + 4, y + H * 0.04, 6, H * 0.09); ctx.fillRect(x + w - 10, y + H * 0.04, 6, H * 0.09);
    ctx.fillStyle = "#a9794a"; ctx.fillRect(x, hz - H * 0.035, w, H * 0.035);
    ["#e8504a", "#f4c542", "#6cc04a"].forEach((c, q) => { disc(ctx, x + w * (0.2 + q * 0.3), hz - H * 0.048, 9, c); });
  }
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

  if (kind === "indoor" || kind === "classroom" || kind === "mansion") {
    ctx.fillStyle = kind === "mansion" ? (night ? "#3a2f3f" : "#efe3c9") : night ? "#2b2438" : "#d9c3a0";
    ctx.fillRect(0, 0, W, hz);
    const ww = W * 0.3, wh = H * (W > H ? 0.3 : 0.16), wx = W * 0.12, wy = H * 0.1;
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = "#5a4630"; ctx.lineWidth = 8; ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    ctx.fillStyle = night ? "#463a5c" : "#b99a6d"; rr(ctx, W * 0.62, H * 0.1, W * 0.22, wh * 0.9, 10); ctx.fill();
    ctx.fillStyle = night ? "#6b5d86" : "#e8d3a8"; rr(ctx, W * 0.64, H * 0.1 + 14, W * 0.18, wh * 0.9 - 28, 6); ctx.fill();
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    if (kind === "mansion") { fl.addColorStop(0, "#e6dfd0"); fl.addColorStop(1, "#bfb6a3"); } else { fl.addColorStop(0, "#8a6a47"); fl.addColorStop(1, "#5a4129"); }
    ctx.fillStyle = fl; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 3;
    for (let k = 1; k < 7; k++) { const y = hz + ((H - hz) * k * k) / 49; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    drawRoomExtras(g, kind, hz);
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
  } else if (kind === "paddy") {
    ctx.fillStyle = "#7fb0c4";
    [[0.15, 0.12], [0.5, 0.17], [0.88, 0.11]].forEach(([fx, fh]) => { ctx.beginPath(); ctx.moveTo(W * (fx - 0.32), hz); ctx.lineTo(W * fx, hz - H * fh); ctx.lineTo(W * (fx + 0.32), hz); ctx.closePath(); ctx.fill(); });
    [0.1, 0.86].forEach((fx) => { ctx.strokeStyle = "#5a3f26"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(W * fx, hz); ctx.lineTo(W * fx + 6, hz - H * 0.15); ctx.stroke(); ctx.strokeStyle = "#2f7a3e"; ctx.lineWidth = 6; for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(W * fx + 6, hz - H * 0.15); ctx.quadraticCurveTo(W * fx + 6 + q * 28, hz - H * 0.19, W * fx + 6 + q * 48, hz - H * 0.13); ctx.stroke(); } });
    ground = ["#b8dc5a", "#7fb53a"];
  } else if (kind === "street" || kind === "market") {
    for (let k = 0; k < 8; k++) {
      const bw = W * (0.1 + 0.07 * rnd(k)), bx = k * (W / 7.2) - 10, bh = H * (0.12 + 0.14 * rnd(k + 3));
      ctx.fillStyle = k % 2 ? "#3a4252" : "#4b5567"; ctx.fillRect(bx, hz - bh, bw, bh + 2);
      for (let wy = hz - bh + 14; wy < hz - 14; wy += 26) for (let wx = bx + 10; wx < bx + bw - 14; wx += 24) {
        ctx.fillStyle = night && rnd(wx + wy) > 0.4 ? "#ffd66b" : "rgba(180,210,240,0.45)"; ctx.fillRect(wx, wy, 12, 14);
      }
    }
    ground = kind === "market" ? ["#cdb88e", "#a99468"] : ["#4b5059", "#3a3f48"];
    if (kind === "market") drawAwnings(g, hz);
  } else {
    ctx.fillStyle = "#4f9a58"; ctx.beginPath(); ctx.ellipse(W * 0.25, hz + 10, W * 0.5, H * 0.06, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#3f8a4c"; ctx.beginPath(); ctx.ellipse(W * 0.8, hz + 10, W * 0.55, H * 0.045, 0, Math.PI, 0); ctx.fill();
  }
  const gr = ctx.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, ground[0]); gr.addColorStop(1, ground[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
  if (kind === "paddy") { ctx.strokeStyle = "rgba(40,110,30,0.35)"; ctx.lineWidth = 3; for (let k = 1; k < 7; k++) { const y = hz + ((H - hz) * k * k) / 49; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
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

/* Gaya gambar tokoh mengikuti gaya latar: lembut (buku cerita), 3D CGI, clay/stop-motion, komik */
const CHAR_STYLES = {
  soft:  { ow: 0.011, line: "#3a2a22", limb: 1,    limbCol: "#16161a", shade: false, gloss: 0 },
  cgi3d: { ow: 0.008, line: "#2a2430", limb: 1.25, limbCol: "#2b2630", shade: true,  gloss: 0.55 },
  clay:  { ow: 0.012, line: "#5a3a2a", limb: 1.8,  limbCol: "#5a463d", shade: true,  gloss: 0.3, step: true },
  comic: { ow: 0.022, line: "#101018", limb: 1.25, limbCol: "#101018", shade: false, gloss: 0 },
};
function charStyleOf(style) {
  return CHAR_STYLES[{ komik: "comic", clay: "clay", cgi3d: "cgi3d", animasi3d: "cgi3d" }[style] || "soft"];
}

function tube(ctx, pts, w, c, sty, H, outline) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
  if (outline) { ctx.strokeStyle = sty.line; ctx.lineWidth = w + sty.ow * H * 2; path(); }
  ctx.strokeStyle = c; ctx.lineWidth = w; path();
  if (sty.gloss && outline) {
    ctx.save(); ctx.globalAlpha = sty.gloss * 0.6; ctx.strokeStyle = shade(c, 0.5); ctx.lineWidth = w * 0.22;
    ctx.translate(-w * 0.2, -w * 0.1); path(); ctx.restore();
  }
}

function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function paint(ctx, color, sty, x0, x1) {
  if (!sty.shade) return color;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(color, 0.22)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.22));
  return g;
}

function outlineFill(ctx, color, sty, H, x0, x1) {
  ctx.fillStyle = paint(ctx, color, sty, x0, x1); ctx.fill();
  ctx.lineWidth = Math.max(1.5, sty.ow * H); ctx.strokeStyle = sty.line; ctx.lineJoin = "round"; ctx.stroke();
}

function rrPath(ctx, x, y, w, h, r) { rr(ctx, x, y, w, h, r); }

/* Hiasan baju, digambar di bidang badan (titik asal = pinggul, sumbu atas = -y) */
function drawDeco(ctx, L, s, T, wt, sty) {
  const u = (f) => -T * f;
  const poly = (pts, col, stroke) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); if (stroke) { ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke(); } };
  switch (L.deco) {
    case "tie":
      poly([[-3 * s, u(1)], [0, u(0.86)], [3 * s, u(1)]], "#ffffff");
      poly([[-1.3 * s, u(0.93)], [1.3 * s, u(0.93)], [1.9 * s, u(0.5)], [0, u(0.38)], [-1.9 * s, u(0.5)]], "#b3262e");
      break;
    case "suit":
      poly([[-2.6 * s, u(1)], [2.6 * s, u(1)], [0, u(0.5)]], "#f4f4f4");
      poly([[-wt, u(1)], [-2.6 * s, u(1)], [-0.4 * s, u(0.45)], [-wt * 0.6, u(0.4)]], shade(L.top, 0.18), sty.line);
      poly([[wt, u(1)], [2.6 * s, u(1)], [0.4 * s, u(0.45)], [wt * 0.6, u(0.4)]], shade(L.top, 0.18), sty.line);
      poly([[-1 * s, u(0.9)], [1 * s, u(0.9)], [1.4 * s, u(0.52)], [0, u(0.42)], [-1.4 * s, u(0.52)]], "#c0392b");
      break;
    case "batik":
      ctx.fillStyle = shade(L.top, 0.38);
      for (let r = 0; r < 4; r++) for (let q = -1; q <= 1; q++) { const x = q * 4.2 * s + (r % 2 ? 2.1 * s : 0); if (Math.abs(x) < wt - 1.5 * s) { ctx.beginPath(); ctx.moveTo(x, u(0.18 + r * 0.22) - 1.3 * s); ctx.lineTo(x + 1.1 * s, u(0.18 + r * 0.22)); ctx.lineTo(x, u(0.18 + r * 0.22) + 1.3 * s); ctx.lineTo(x - 1.1 * s, u(0.18 + r * 0.22)); ctx.closePath(); ctx.fill(); } }
      break;
    case "logo":
      ctx.globalAlpha = 0.55; disc(ctx, -2.4 * s, u(0.68), 1.9 * s, "#ffffff"); ctx.globalAlpha = 1;
      break;
    case "scarf":
      poly([[-3.6 * s, u(1)], [3.6 * s, u(1)], [0, u(0.7)]], "#d62f3a");
      break;
    case "badge":
      disc(ctx, 3.4 * s, u(0.7), 1.5 * s, "#e9b21f");
      break;
    case "flower":
      [[-3, 0.7], [2, 0.55], [-1, 0.3], [3.5, 0.28], [-3.5, 0.15]].forEach(([x, f]) => disc(ctx, x * s, u(f), 1.15 * s, "rgba(255,255,255,0.75)"));
      break;
    case "kebaya":
      ctx.strokeStyle = shade(L.top, 0.55); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, u(1)); ctx.lineTo(0, u(0)); ctx.stroke();
      for (let k = 0; k < 5; k++) disc(ctx, (k % 2 ? 1.4 : -1.4) * s, u(0.9 - k * 0.18), 0.8 * s, "#ffe9a8");
      break;
    case "gaun":
      poly([[-2.4 * s, u(0.1)], [0, u(0.2)], [-2.4 * s, u(0.3)]], shade(L.top, -0.25));
      poly([[2.4 * s, u(0.1)], [0, u(0.2)], [2.4 * s, u(0.3)]], shade(L.top, -0.25));
      disc(ctx, 0, u(0.2), 1 * s, shade(L.top, -0.35));
      break;
    case "buttons":
      [0.75, 0.52, 0.29].forEach((f) => disc(ctx, 0, u(f), 0.85 * s, shade(L.top, -0.45)));
      break;
    case "rope":
      ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(-wt, u(0.1)); ctx.lineTo(wt, u(0.1)); ctx.stroke();
      break;
    case "stripe":
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.3 * s;
      [0.3, 0.55, 0.8].forEach((f) => { ctx.beginPath(); ctx.moveTo(-wt + 1, u(f)); ctx.lineTo(wt - 1, u(f)); ctx.stroke(); });
      break;
    case "steto":
      poly([[-2.6 * s, u(1)], [2.6 * s, u(1)], [0, u(0.55)]], "#7fb4e0");
      ctx.strokeStyle = "#222"; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(-3 * s, u(1)); ctx.quadraticCurveTo(-3.5 * s, u(0.5), 0, u(0.45)); ctx.quadraticCurveTo(3.5 * s, u(0.5), 3 * s, u(1)); ctx.stroke();
      disc(ctx, 0, u(0.45), 1.3 * s, "#555");
      break;
    case "belt":
      ctx.fillStyle = "#2a2018"; ctx.fillRect(-wt, u(0.12) - 1.2 * s, wt * 2, 2.4 * s);
      disc(ctx, 0, u(0.12), 1.4 * s, "#e9b21f"); disc(ctx, 3.4 * s, u(0.72), 1.3 * s, "#e9b21f");
      break;
    case "overall":
      ctx.fillStyle = L.bottom; ctx.fillRect(-wt * 0.62, u(0.62), wt * 1.24, T * 0.64 + 2);
      ctx.strokeStyle = L.bottom; ctx.lineWidth = 1.7 * s; ctx.beginPath(); ctx.moveTo(-wt * 0.62, u(0.62)); ctx.lineTo(-wt * 0.5, u(1)); ctx.moveTo(wt * 0.62, u(0.62)); ctx.lineTo(wt * 0.5, u(1)); ctx.stroke();
      ctx.fillStyle = shade(L.bottom, -0.25); ctx.fillRect(-2 * s, u(0.45), 4 * s, 3 * s);
      break;
    default: break;
  }
}

function drawShoe(ctx, p, H, L, back, sty) {
  const x = p.x + 0.03 * H, y = p.y;
  ctx.beginPath();
  if (L.shoes === "sandal") { ctx.ellipse(x, y - 0.004 * H, 0.052 * H, 0.014 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#8a6a3a" : "#c79a58"; ctx.fill(); ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 1.2; ctx.stroke(); }
  else if (L.shoes === "kulit") { ctx.ellipse(x, y - 0.012 * H, 0.056 * H, 0.026 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#141214" : "#201a1c"; ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(x - 0.01 * H, y - 0.02 * H, 0.02 * H, 0.006 * H, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.ellipse(x, y - 0.012 * H, 0.056 * H, 0.026 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#d8d8d8" : "#ffffff"; ctx.fill(); ctx.lineWidth = Math.max(1.2, sty.ow * H * 0.8); ctx.strokeStyle = sty.line; ctx.stroke(); ctx.fillStyle = "#222"; ctx.fillRect(x - 0.054 * H, y - 0.006 * H, 0.108 * H, 0.008 * H); }
}

/* o: {x, y(kaki), H, face, look, kind, P, mouth, t, phase, sty} → posisi label nama */
function drawPerson(ctx, o) {
  const H = o.H, P = o.P, L = o.look, k = o.kind, sty = o.sty || CHAR_STYLES.soft;
  const kid = k === "anak";
  const s = H / 100;
  const hr = (kid ? 0.17 : 0.145) * H;
  const legLen = (kid ? 0.3 : 0.36) * H, L1 = legLen / 2, L2 = legLen / 2;
  const T = (kid ? 0.21 : 0.24) * H;
  const A1 = 0.12 * H, A2 = 0.115 * H;
  const lw = 0.026 * H * sty.limb;
  const wt = 0.085 * H, wb = 0.078 * H;
  const limb = sty.limbCol;
  const jy = -P.jump * H;
  const hip = { x: 0, y: -legLen + jy + P.bob * H * 0.01 };
  const ux = Math.sin(P.lean), uy = -Math.cos(P.lean), px = Math.cos(P.lean), py = Math.sin(P.lean);
  const sh = { x: hip.x + ux * T, y: hip.y + uy * T };
  const shL = { x: sh.x - px * wt * 0.85, y: sh.y - py * wt * 0.85 };
  const shR = { x: sh.x + px * wt * 0.85, y: sh.y + py * wt * 0.85 };
  const hd = { x: sh.x + Math.sin(P.lean + P.head) * (hr + 0.01 * H), y: sh.y - Math.cos(P.lean + P.head) * (hr + 0.01 * H) };
  const chain = (p, a1, l1, a2, l2, sgn) => {
    const kn = { x: p.x + sgn * Math.sin(a1) * l1, y: p.y + Math.cos(a1) * l1 };
    return [kn, { x: kn.x + sgn * Math.sin(a2) * l2, y: kn.y + Math.cos(a2) * l2 }];
  };
  const hipB = { x: hip.x - 0.04 * H, y: hip.y }, hipF = { x: hip.x + 0.04 * H, y: hip.y };
  const [kB, fB] = chain(hipB, P.lB[0], L1, P.lB[1], L2, 1);
  const [kF, fF] = chain(hipF, P.lF[0], L1, P.lF[1], L2, 1);
  const [eB, wB] = chain(shL, P.aB[0], A1, P.aB[1], A2, -1);
  const [eF, wF] = chain(shR, P.aF[0], A1, P.aF[1], A2, 1);
  const skin = L.skin, dress = L.legs === "dress" || L.legs === "longdress" || L.legs === "skirt";
  const pantsLong = L.legs === "long";

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.face, 1);

  // bayangan di tanah
  ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - clamp(P.jump * 8, 0, 0.6))})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.24 * H, 0.04 * H, 0, 0, Math.PI * 2); ctx.fill();

  // rambut belakang digambar di belakang badan (bukan di depan bahu)
  const hc = L.hairColor, hline = sty.line;
  const hijab = L.head === "hijab";
  const hijabCol = L.hijabColor || mixHex(L.top, "#ffffff", 0.12);
  const hairPath = () => { ctx.lineWidth = Math.max(1.2, sty.ow * H * 0.8); ctx.strokeStyle = hline; ctx.stroke(); };
  const backHair = () => {
    if (hijab) return;
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(P.lean + P.head);
    ctx.fillStyle = hc;
    if (L.hair === "panjang") { ctx.beginPath(); ctx.ellipse(0, hr * 0.5, hr * 1.1, hr * 1.2, 0, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    if (L.hair === "bob") { ctx.beginPath(); ctx.ellipse(0, hr * 0.25, hr * 1.14, hr * 1.12, 0, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    if (L.hair === "kuncir") { ctx.beginPath(); ctx.ellipse(-hr * 1.15, hr * 0.15, hr * 0.38, hr * 0.62, 0.5, 0, Math.PI * 2); ctx.fill(); hairPath(); disc(ctx, -hr * 0.98, -hr * 0.2, hr * 0.14, "#ff5d8f"); }
    if (L.hair === "sanggul") { ctx.beginPath(); ctx.arc(-hr * 0.1, -hr * 1.18, hr * 0.42, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    ctx.restore();
  };

  // ---- lengan belakang
  const armDraw = (p0, e, w, back) => {
    const sleeveCol = back ? shade(L.top, -0.2) : L.top;
    tube(ctx, [p0, e, w], lw, limb, sty, H, false);
    if (L.sleeve === "long") tube(ctx, [p0, e, w], lw * 1.9, sleeveCol, sty, H, true);
    else tube(ctx, [p0, { x: lerp(p0.x, e.x, 0.6), y: lerp(p0.y, e.y, 0.6) }], lw * 2.0, sleeveCol, sty, H, true);
    disc(ctx, w.x, w.y, 0.034 * H * Math.max(1, sty.limb * 0.85), limb);
  };
  armDraw(shL, eB, wB, true);

  // ---- kaki
  const legDraw = (p0, kn, ft, back) => {
    const pc = back ? shade(L.bottom, -0.22) : L.bottom;
    tube(ctx, [p0, kn, ft], lw, limb, sty, H, false);
    if (pantsLong) tube(ctx, [p0, kn, ft], lw * 1.9, pc, sty, H, true);
    else if (L.legs === "short") tube(ctx, [p0, { x: lerp(p0.x, kn.x, 0.8), y: lerp(p0.y, kn.y, 0.8) }], lw * 2.2, pc, sty, H, true);
    if (L.legs === "longdress") tube(ctx, [kn, ft], lw * 1.0, limb, sty, H, false);
    drawShoe(ctx, ft, H, L, back, sty);
  };
  legDraw(hipB, kB, fB, true);
  legDraw(hipF, kF, fF, false);

  backHair();

  // ---- bawahan: rok / gaun / kain
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(P.lean * 0.6);
  if (dress) {
    const hem = L.legs === "longdress" ? 0.27 * H : L.legs === "skirt" && (L.outfit === "gaun") ? 0.17 * H : 0.13 * H;
    const spread = L.legs === "longdress" ? 0.115 * H : L.outfit === "gaun" ? 0.16 * H : 0.12 * H;
    ctx.beginPath();
    ctx.moveTo(-wb, -0.02 * H); ctx.lineTo(wb, -0.02 * H);
    ctx.quadraticCurveTo(spread * 0.9, hem * 0.5, spread, hem);
    ctx.quadraticCurveTo(0, hem + 0.02 * H, -spread, hem);
    ctx.quadraticCurveTo(-spread * 0.9, hem * 0.5, -wb, -0.02 * H);
    ctx.closePath();
    outlineFill(ctx, L.bottom, sty, H, -spread, spread);
    if (L.outfit === "kebaya") { ctx.strokeStyle = shade(L.bottom, 0.3); ctx.lineWidth = 1.4; for (let q = -2; q <= 2; q++) { ctx.beginPath(); ctx.moveTo(q * 0.03 * H, 0); ctx.lineTo(q * 0.045 * H, hem); ctx.stroke(); } }
    if (L.outfit === "gaun") { ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-spread * 0.92, hem - 0.012 * H); ctx.quadraticCurveTo(0, hem + 0.012 * H, spread * 0.92, hem - 0.012 * H); ctx.stroke(); }
  } else if (L.legs === "short") {
    ctx.beginPath(); rrPath(ctx, -wb * 1.05, -0.02 * H, wb * 2.1, 0.115 * H, 0.02 * H);
    outlineFill(ctx, L.bottom, sty, H, -wb, wb);
    ctx.strokeStyle = sty.line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0.02 * H); ctx.lineTo(0, 0.095 * H); ctx.stroke();
  } else {
    ctx.beginPath(); rrPath(ctx, -wb * 1.02, -0.02 * H, wb * 2.04, 0.06 * H, 0.015 * H);
    outlineFill(ctx, L.bottom, sty, H, -wb, wb);
  }
  ctx.restore();

  // ---- badan (baju)
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(P.lean);
  ctx.beginPath();
  ctx.moveTo(-wb, 0.01 * H);
  ctx.lineTo(wb, 0.01 * H);
  ctx.quadraticCurveTo(wt * 1.08, -T * 0.5, wt, -T + 0.02 * H);
  ctx.quadraticCurveTo(0, -T - 0.03 * H, -wt, -T + 0.02 * H);
  ctx.quadraticCurveTo(-wt * 1.08, -T * 0.5, -wb, 0.01 * H);
  ctx.closePath();
  outlineFill(ctx, L.top, sty, H, -wt, wt);
  drawDeco(ctx, L, s, T, wt, sty);
  // tas selempang
  if (L.bag) {
    ctx.strokeStyle = shade(L.bagColor, -0.25); ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(-wt * 0.7, -T + 0.02 * H); ctx.lineTo(wb * 1.0, 0.0); ctx.stroke();
    ctx.beginPath(); rrPath(ctx, wb * 0.55, -0.045 * H, 0.075 * H, 0.062 * H, 0.012 * H);
    outlineFill(ctx, L.bagColor, sty, H, wb * 0.55, wb * 0.55 + 0.075 * H);
  }
  // kalung (status kaya)
  if (L.gold && L.deco !== "suit" && L.deco !== "tie") {
    ctx.strokeStyle = k === "wanita" || L.gender === "p" ? "#fff6d8" : "#e9b21f"; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.arc(0, -T + 0.015 * H, 2.6 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }
  ctx.restore();

  // ---- lengan depan
  armDraw(shR, eF, wF, false);
  if (L.gold) { ctx.strokeStyle = "#e9b21f"; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.arc(lerp(eF.x, wF.x, 0.85), lerp(eF.y, wF.y, 0.85), 1.7 * s, 0, Math.PI * 2); ctx.stroke(); }

  // ---- kepala
  ctx.save();
  ctx.translate(hd.x, hd.y);
  ctx.rotate(P.lean + P.head);
  const fx = hr * 0.12;

  // lapisan belakang (hijab)
  if (hijab) {
    ctx.beginPath(); ctx.arc(0, hr * 0.05, hr * 1.3, 0, Math.PI * 2); ctx.fillStyle = hijabCol; ctx.fill(); hairPath();
    ctx.beginPath(); ctx.ellipse(0, hr * 1.0, hr * 1.05, hr * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = shade(hijabCol, -0.08); ctx.fill(); hairPath();
  }

  // wajah
  ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2);
  if (sty.shade) {
    const g1 = ctx.createRadialGradient(-hr * 0.3, -hr * 0.4, hr * 0.1, 0, 0, hr * 1.05);
    g1.addColorStop(0, shade(skin, 0.35)); g1.addColorStop(0.6, skin); g1.addColorStop(1, shade(skin, -0.22));
    ctx.fillStyle = g1;
  } else ctx.fillStyle = skin;
  ctx.fill(); ctx.lineWidth = Math.max(1.5, sty.ow * H); ctx.strokeStyle = sty.line; ctx.stroke();
  if (sty.gloss) { ctx.fillStyle = `rgba(255,255,255,${sty.gloss * 0.5})`; ctx.beginPath(); ctx.ellipse(-hr * 0.42, -hr * 0.55, hr * 0.28, hr * 0.14, -0.6, 0, Math.PI * 2); ctx.fill(); }
  // pipi merona
  ctx.fillStyle = "rgba(255,120,130,0.5)";
  [-0.62, 0.62].forEach((m) => { ctx.beginPath(); ctx.ellipse(fx + m * hr, hr * 0.3, hr * 0.17, hr * 0.1, 0, 0, Math.PI * 2); ctx.fill(); });

  // rambut depan
  if (!hijab && L.hair !== "botak") {
    ctx.fillStyle = hc;
    ctx.beginPath();
    const cut = L.hair === "poni" || L.hair === "bob" ? 1.06 : 1.1;
    ctx.arc(0, 0, hr * 1.04, Math.PI * cut, Math.PI * (3 - cut + 0.0));
    ctx.closePath(); ctx.fill(); hairPath();
    if (L.hair === "poni" || L.hair === "bob") { ctx.beginPath(); ctx.ellipse(fx * 0.5, -hr * 0.5, hr * 0.92, hr * 0.26, 0, 0, Math.PI * 2); ctx.fill(); }
    if (L.hair === "pendek" || L.hair === "uban") { ctx.beginPath(); ctx.ellipse(-hr * 0.85, -hr * 0.1, hr * 0.22, hr * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  // mata
  const emo = P.emo;
  const blink = ((o.t + o.phase) % 3.7) < 0.12 ? 0.12 : 1;
  const er = hr * (emo === "kaget" ? 0.17 : 0.125);
  [fx - hr * 0.36, fx + hr * 0.36].forEach((ex, i) => {
    const ey = -hr * 0.02;
    if (emo === "kaget") { disc(ctx, ex, ey, er * 1.35, "#ffffff"); ctx.lineWidth = 1.2; ctx.strokeStyle = sty.line; ctx.beginPath(); ctx.arc(ex, ey, er * 1.35, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#1c1210"; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.3 * blink, 0, 0, Math.PI * 2); ctx.fill();
    if (blink === 1) disc(ctx, ex - er * 0.3, ey - er * 0.45, er * 0.38, "#ffffff");
  });
  // alis
  ctx.strokeStyle = "#2a1b14"; ctx.lineWidth = Math.max(1.5, hr * 0.07); ctx.lineCap = "round";
  [[fx - hr * 0.36, -1], [fx + hr * 0.36, 1]].forEach(([ex, side]) => {
    const by = -hr * (emo === "kaget" ? 0.42 : 0.3);
    let iy = by, oy = by;
    if (emo === "marah") { iy = by + hr * 0.12; oy = by - hr * 0.04; }
    else if (emo === "sedih" || emo === "tanya") { iy = by - hr * 0.1; oy = by + hr * 0.03; }
    ctx.beginPath(); ctx.moveTo(ex - side * hr * 0.17, oy); ctx.lineTo(ex + side * hr * 0.17, iy); ctx.stroke();
  });

  // janggut / kumis
  if (L.beard === "jenggot") { ctx.fillStyle = L.hairColor; ctx.beginPath(); ctx.ellipse(fx, hr * 0.88, hr * 0.5, hr * 0.34, 0, 0, Math.PI); ctx.fill(); hairPath(); }
  if (L.beard === "kumis") { ctx.fillStyle = L.hairColor; ctx.beginPath(); ctx.ellipse(fx, hr * 0.27, hr * 0.3, hr * 0.065, 0, 0, Math.PI * 2); ctx.fill(); }

  // mulut
  const mx = fx, my = hr * 0.5;
  if (o.mouth > 0.08) {
    ctx.fillStyle = "#5a1d26"; ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.2, hr * (0.05 + 0.2 * o.mouth), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff8a8a"; ctx.beginPath(); ctx.ellipse(mx, my + hr * 0.07 * o.mouth, hr * 0.12, hr * 0.06 * o.mouth, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = "#5a1d26"; ctx.lineWidth = Math.max(1.4, hr * 0.06); ctx.beginPath();
    if (emo === "senang") ctx.arc(mx, my - hr * 0.1, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (emo === "sedih") ctx.arc(mx, my + hr * 0.2, hr * 0.17, 1.15 * Math.PI, 1.85 * Math.PI);
    else if (emo === "kaget") ctx.arc(mx, my, hr * 0.07, 0, Math.PI * 2);
    else ctx.arc(mx, my - hr * 0.1, hr * 0.15, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // kacamata
  if (L.glasses) {
    ctx.strokeStyle = "#2a2a30"; ctx.lineWidth = Math.max(1.5, hr * 0.06);
    [fx - hr * 0.36, fx + hr * 0.36].forEach((ex) => { ctx.beginPath(); ctx.arc(ex, -hr * 0.02, hr * 0.24, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(fx - hr * 0.12, -hr * 0.04); ctx.lineTo(fx + hr * 0.12, -hr * 0.04); ctx.stroke();
  }

  // penutup kepala
  let hwExtra = L.hair === "sanggul" ? 0.45 : 0.1;
  const hw = L.head;
  if (hijab) {
    ctx.beginPath(); ctx.arc(0, hr * 0.05, hr * 1.32, 0, Math.PI * 2);
    ctx.ellipse(fx, hr * 0.12, hr * 0.78, hr * 0.86, 0, 0, Math.PI * 2, true);
    ctx.fillStyle = hijabCol; ctx.fill("evenodd"); hairPath(); hwExtra = 0.3;
  } else if (hw === "peci") {
    ctx.beginPath(); ctx.moveTo(-hr * 0.96, -hr * 0.4); ctx.quadraticCurveTo(-hr * 0.92, -hr * 1.42, 0, -hr * 1.42); ctx.quadraticCurveTo(hr * 0.92, -hr * 1.42, hr * 0.96, -hr * 0.4); ctx.closePath();
    ctx.fillStyle = "#16161c"; ctx.fill(); hairPath(); hwExtra = 0.45;
  } else if (hw === "caping") {
    ctx.beginPath(); ctx.moveTo(-hr * 1.9, -hr * 0.42); ctx.lineTo(0, -hr * 1.8); ctx.lineTo(hr * 1.9, -hr * 0.42); ctx.quadraticCurveTo(0, -hr * 0.12, -hr * 1.9, -hr * 0.42); ctx.closePath();
    ctx.fillStyle = "#d9b45a"; ctx.fill(); hairPath();
    ctx.strokeStyle = "rgba(120,80,20,0.5)"; ctx.lineWidth = 1.2; [-0.7, -0.25, 0.25, 0.7].forEach((q) => { ctx.beginPath(); ctx.moveTo(q * hr * 1.5, -hr * 0.38); ctx.lineTo(q * hr * 0.2, -hr * 1.6); ctx.stroke(); });
    hwExtra = 0.8;
  } else if (hw === "topi") {
    const cc = shade(L.top, 0.15);
    ctx.beginPath(); ctx.arc(0, -hr * 0.1, hr * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fillStyle = cc; ctx.fill(); hairPath();
    ctx.beginPath(); ctx.ellipse(hr * 0.85, -hr * 0.4, hr * 0.65, hr * 0.15, 0, 0, Math.PI * 2); ctx.fillStyle = shade(cc, -0.2); ctx.fill(); hairPath(); hwExtra = 0.3;
  } else if (hw === "koki") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); rrPath(ctx, -hr * 0.75, -hr * 1.35, hr * 1.5, hr * 0.95, hr * 0.2); ctx.fill(); hairPath();
    [-0.5, 0, 0.5].forEach((q) => { ctx.beginPath(); ctx.arc(q * hr, -hr * 1.55, hr * 0.42, 0, Math.PI * 2); ctx.fill(); hairPath(); });
    hwExtra = 1.0;
  } else if (hw === "polisi") {
    ctx.beginPath(); ctx.arc(0, -hr * 0.1, hr * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fillStyle = "#6b5030"; ctx.fill(); hairPath();
    ctx.beginPath(); ctx.ellipse(hr * 0.8, -hr * 0.36, hr * 0.62, hr * 0.12, 0, 0, Math.PI * 2); ctx.fillStyle = "#2a2018"; ctx.fill();
    disc(ctx, 0, -hr * 0.68, hr * 0.12, "#e9b21f"); hwExtra = 0.3;
  } else if (hw === "bando") {
    ctx.strokeStyle = "#e0394f"; ctx.lineWidth = hr * 0.16; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, hr * 1.0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  return { x: o.x + o.face * hd.x, y: o.y + hd.y - hr * (1.05 + hwExtra) - 0.03 * H };
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
  const lab = nar ? "🎙 Narator" : active.ln.speaker + (cs && cs.role ? " · " + cs.role : "");
  ctx.font = `800 ${fs * 0.62}px ${FONT}`;
  const lw = ctx.measureText(lab).width + fs * 0.9, lhh = fs * 1.0;
  ctx.fillStyle = nar ? "#8d9bb8" : (cs ? cs.color : ACCENT);
  rr(ctx, bx + fs * 0.4, by - lhh / 2, lw, lhh, lhh / 2); ctx.fill();
  ctx.textAlign = "left"; ctx.fillStyle = "#1a1208";
  ctx.fillText(lab, bx + fs * 0.4 + fs * 0.45, by + 1);
}

/* ---------- Susunan adegan ---------- */
const BASES = { 1: [0.5], 2: [0.32, 0.68], 3: [0.2, 0.5, 0.8], 4: [0.13, 0.38, 0.62, 0.87], 5: [0.1, 0.3, 0.5, 0.7, 0.9] };

function buildChars(project, s, prev, W, H) {
  const order = project.characters.map((c) => castKey(c.name));
  // urutan tetap menurut daftar tokoh: posisi tokoh konsisten dari adegan ke adegan
  const present = (s.present || []).slice().sort((a, b) => order.indexOf(castKey(a)) - order.indexOf(castKey(b)));
  const n = Math.max(1, present.length);
  const base = BASES[Math.min(5, n)];
  const landscape = W > H;
  const shrink = n >= 5 ? 0.8 : n === 4 ? 0.88 : n === 3 ? 0.97 : n === 2 ? 1.1 : 1.2;
  const prevKeys = new Set(prev ? (prev.s.present || []).map(castKey) : []);
  const sameLoc = prev && String(prev.s.location).toLowerCase() === String(s.location).toLowerCase();
  return present.map((name, i) => {
    const key = castKey(name);
    const c = project.characters.find((x) => castKey(x.name) === key) || { name, kind: "pria" };
    const cast = state.cast[key];
    const kind = c.kind in KINDS ? c.kind : "pria";
    const sx = (landscape ? 0.5 + (base[i] - 0.5) * 0.8 : base[i]) * W;
    return {
      key, name: c.name, role: (cast && cast.role) || c.role || "", kind,
      look: (cast && cast.look) || resolveLook(c),
      color: c.color || PALETTE[i % PALETTE.length],
      slotX: sx, face: sx <= W / 2 ? 1 : -1, phase: i * 1.3, seed: hashStr(c.name), depth: i % 2,
      H: (landscape ? 0.52 : 0.31) * H * KINDS[kind].scale * shrink,
      enter: !(sameLoc && prevKeys.has(key)),
    };
  });
}

/* Gerak ala NPC: tokoh yang diam sesekali melangkah kecil ke kiri/kanan */
function npcOffset(ch, T, W) {
  const cycle = 5.5, ph = T + ch.phase * 2.1;
  const k = Math.floor(ph / cycle), frac = ph / cycle - k;
  const off = (n) => (rnd(n * 7 + ch.seed % 97) - 0.5) * 2 * W * 0.03;
  const moveDur = 0.9 / cycle;
  if (frac < moveDur) {
    const e = easeOutCubic(frac / moveDur);
    return { off: lerp(off(k - 1), off(k), e), moving: Math.abs(off(k) - off(k - 1)) > W * 0.008 };
  }
  return { off: off(k), moving: false };
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  return layoutWords(ctx, words, maxW, ctx.measureText(" ").width).map((l) => l.items.map((i) => i.word).join(" "));
}

function banner(g, alpha, head, text, y) {
  const { ctx, W, H } = g;
  const portrait = H > W;
  const fs = portrait ? 46 : 38;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, text, W * 0.78);
  const lh = fs * 1.3;
  const bw = W * 0.86, bh = lines.length * lh + fs * 2.1;
  const bx = (W - bw) / 2, by = y;
  ctx.fillStyle = "rgba(255,250,238,0.94)";
  rr(ctx, bx, by, bw, bh, fs * 0.7); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = ACCENT; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `800 ${fs * 0.55}px ${FONT}`;
  ctx.fillStyle = "#c8650a";
  ctx.fillText(head, W / 2, by + fs * 0.85);
  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.fillStyle = "#3a2a22";
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, by + fs * 1.55 + i * lh + lh / 2 - fs * 0.35));
  ctx.restore();
}

function styleBgOverlay(g) {
  const { ctx, W, H, sty } = g;
  if (sty === CHAR_STYLES.comic && g.halftone) { ctx.save(); ctx.globalAlpha = 0.17; ctx.fillStyle = g.halftone; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (sty === CHAR_STYLES.clay) { ctx.fillStyle = "rgba(255,190,120,0.07)"; ctx.fillRect(0, 0, W, H); }
}

function makeHalftone(ctx) {
  const c = document.createElement("canvas");
  c.width = 18; c.height = 18;
  const x = c.getContext("2d");
  x.fillStyle = "#000"; x.beginPath(); x.arc(9, 9, 3.2, 0, Math.PI * 2); x.fill();
  return ctx.createPattern(c, "repeat");
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
  styleBgOverlay(g);

  const TA = g.sty.step ? Math.floor(T * 8) / 8 : T; // clay: gerak patah-patah ala stop motion
  const WALK = 0.85;
  const spKey = active ? castKey(active.ln.speaker) : null;
  const spCh = spKey ? cur.chars.find((c) => c.key === spKey) : null;
  g.charsByKey = {};

  const items = cur.chars.map((ch) => {
    g.charsByKey[ch.key] = ch;
    const speaking = ch.key === spKey;
    let x = ch.slotX, face = ch.face, P;
    if (ch.enter && t < WALK) {
      const sx = ch.slotX <= W / 2 ? -W * 0.12 : W * 1.12;
      x = lerp(sx, ch.slotX, easeOutCubic(t / WALK));
      P = computePose("walk", "normal", TA);
    } else if (speaking) {
      P = computePose("talk", active.ln.emotion, TA);
    } else {
      const n = npcOffset(ch, TA, W);
      x += n.off;
      P = n.moving ? computePose("walk", "normal", TA * 0.6 + ch.phase) : computePose("idle", "normal", TA + ch.phase);
    }
    // saling menghadap: pembicara menatap lawan bicara terdekat, yang lain menatap pembicara
    if (!(ch.enter && t < WALK) && spCh) {
      if (speaking) {
        const others = cur.chars.filter((c) => c !== ch).sort((a, b) => Math.abs(a.slotX - x) - Math.abs(b.slotX - x));
        if (others[0]) face = others[0].slotX >= x ? 1 : -1;
      } else face = spCh.slotX >= x ? 1 : -1;
    }
    const jit = g.sty.step ? (rnd(Math.floor(T * 8) + ch.seed) - 0.5) * 2.5 : 0; // getar halus tanah liat
    return { ch, speaking, x: x + jit, y: g.groundY + ch.depth * ch.H * 0.045, face, P };
  });
  items.sort((a, b) => a.y - b.y);

  const tags = [];
  items.forEach((it) => {
    const { ch } = it;
    const pos = drawPerson(ctx, { x: it.x, y: it.y, H: ch.H * (1 + ch.depth * 0.03), face: it.face, look: ch.look, kind: ch.kind, P: it.P, mouth: it.speaking ? g.mouth : 0, t: TA, phase: ch.phase, sty: g.sty });
    tags.push({ name: ch.name, color: ch.color, x: pos.x, y: pos.y, on: it.speaking });
  });
  const tfs = Math.max(18, Math.round(H * (W > H ? 0.04 : 0.026)));
  // geser label yang bertabrakan agar semua nama tetap terbaca
  ctx.font = `700 ${tfs}px ${FONT}`;
  tags.sort((a, b) => a.x - b.x);
  tags.forEach((tg, k) => {
    tg.w = ctx.measureText(tg.name).width + tfs * 0.9;
    for (let q = 0; q < k; q++) {
      const o = tags[q];
      if (Math.abs(tg.x - o.x) < (tg.w + o.w) / 2 && Math.abs(tg.y - o.y) < tfs * 1.6) tg.y = o.y - tfs * 1.7;
    }
  });
  tags.forEach((tg) => drawNameTag(ctx, tg, tfs, tg.on));

  // vinyet halus supaya terasa sinematik
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.45, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  drawSubtitle(g, active, t);

  const intro = i === 0 && t < cur.enter - 0.05;
  if (!intro) {
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
  } else {
    const a = clamp(t / 0.3, 0, 1) * clamp((cur.enter - 0.05 - t) / 0.4, 0, 1);
    banner(g, a, state.project.genre === "anak" ? "🌟 CERITA ANAK" : "🎬 VIDEO", state.project.title, H * 0.1);
  }
  if (cur.moralAt !== undefined && t >= cur.moralAt) {
    banner(g, clamp((t - cur.moralAt) / 0.4, 0, 1), "💡 PESAN CERITA", state.project.moral, H * 0.1);
  }

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

/* Linimasa: adegan pertama punya kartu judul; tiap adegan = masuk + ucapan berurutan + jeda; adegan terakhir ditutup pesan moral */
function buildTimeline(project) {
  const { w: W, h: H } = dims(project.options.ratio);
  const GAP = 0.3;
  let acc = 0;
  const tl = [];
  project.scenes.forEach((s, i) => {
    const enter = i === 0 ? 2.4 : 0.85;
    let cur = enter;
    const lines = s.lines.map((ln, li) => {
      const a = state.audio[`${s.id}:${li}`] || null;
      const rate = a ? Math.pow(2, a.detune / 1200) : 1;
      const words = ln.text.split(/\s+/).filter(Boolean);
      const dur = a ? a.buf.duration / rate : words.length / 2.4 + 0.5;
      const L = { ln, li, a, rate, start: cur, dur, words, times: wordTimes(words, dur, 0.1) };
      cur += dur + GAP;
      return L;
    });
    let dur = Math.max(3, cur + 0.3);
    let moralAt;
    if (i === project.scenes.length - 1 && project.moral) { moralAt = cur + 0.2; dur = Math.max(dur, moralAt + 3.8); }
    const x = { s, i, start: acc, dur, enter, moralAt, lines };
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

  const g = { ctx, W, H, groundY: H * (W > H ? 0.8 : 0.74), tl, total, mouth: 0, rms: 0, T: 0, charsByKey: {}, sty: charStyleOf(project.options.style), halftone: makeHalftone(ctx) };
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
  ["style", "genre", "lang", "ratio", "targetSec", "maxScenes", "musicUrl"].forEach((id) => {
    $(id).value = load(id, $(id).value);
    if ($(id).value === "" && id !== "musicUrl") $(id).selectedIndex = 0;
    $(id).addEventListener("change", () => store(id, $(id).value));
  });
  if ($("workerUrl").value) $("settings").open = false;

  const upd = () => { $("counter").textContent = `${$("script").value.length} / 6000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); });
  upd();

  renderSteps();
  $("skipCast").checked = load("skipCast", "0") === "1";
  $("skipCast").addEventListener("change", () => store("skipCast", $("skipCast").checked ? "1" : "0"));
  renderLibrary();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Pengaturan tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnClearVoices").addEventListener("click", () => { if (!confirm("Hapus SEMUA karakter & suara tersimpan di perangkat ini?")) return; saveVoices({}); renderLibrary(); $("healthOut").hidden = false; $("healthOut").textContent = "Semua karakter & suara tersimpan dihapus."; });
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
