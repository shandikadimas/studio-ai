/* =====================================================================
 *  script.js — Studio Video AI v5 Pro
 * ===================================================================== */
"use strict";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lerp = (a, b, p) => a + (b - a) * p;
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const AGENTS = [
  { key: "script", name: "Agen 1 · Sutradara & Penulis Cerita Panjang" },
  { key: "cast", name: "Agen 2 · Casting Usia, Rambut & Suara Alami" },
  { key: "visual", name: "Agen 3 · Latar & Ornamen Dunia Nyata" },
  { key: "voice", name: "Agen 4 · Pengisi Suara Alami & Rekaman" },
  { key: "music", name: "Agen 5 · Musik & Efek Suara (SFX)" },
  { key: "render", name: "Agen 6 · Render Video Sinematik Berkelanjutan" },
];

const SAMPLE = `Narator: Pagi yang cerah menyapa halaman rumah kayu di pinggir desa. Angin sepoi menggerakkan dedaunan dan pot bunga di teras.
Kakek: Pelan-pelan ya jalannya, cucuku. Udara pagi ini segar sekali.
Anak Laki: Iya, Kek! Aku mau bantu Nenek menyiram tanaman di depan.
Nenek: Hati-hati ya, Nak, jangan sampai terpeleset di batu pijakan.
Anak Perempuan: Lihat, Nek! Bunga melati di pot dekat pagar sudah mekar.
Dewasa Wanita: Selamat pagi semuanya. Sarapan roti hangat dan susu sudah siap di meja.
Dewasa Pria: Ayo kita kumpul dulu sebelum berangkat beraktivitas hari ini.
Narator: Langkah-langkah kecil menyatu dalam kehangatan keluarga. Setiap adegan mengalir penuh makna.
Kakek: Kebersamaan seperti inilah yang membuat rumah terasa selalu hidup.
Narator: Cerita panjang tentang kasih sayang, kepedulian, dan langkah bersama pun terus berlanjut.`;

const PALETTE = ["#ff8c1a", "#36d399", "#4da3ff", "#ff6b9d", "#b983ff", "#ffd23f"];

const VOICES = {
  id: [
    { id: "id-ID-ArdiNeural", label: "Ardi · Pria Natural (id-ID)", g: "m" },
    { id: "id-ID-GadisNeural", label: "Gadis · Wanita Natural (id-ID)", g: "f" },
  ],
  en: [
    { id: "en-US-GuyNeural", label: "Guy · Male Natural (US)", g: "m" },
    { id: "en-GB-RyanNeural", label: "Ryan · Male Natural (UK)", g: "m" },
    { id: "en-US-JennyNeural", label: "Jenny · Female Natural (US)", g: "f" },
    { id: "en-US-AriaNeural", label: "Aria · Female Natural (US)", g: "f" },
    { id: "en-GB-SoniaNeural", label: "Sonia · Female Natural (UK)", g: "f" },
  ],
};

const KINDS = {
  anak_laki: { label: "Anak laki-laki", g: "m", ageGroup: "anak", gender: "l", pitch: 44, rate: 8, scale: 0.72 },
  anak_perempuan: { label: "Anak perempuan", g: "f", ageGroup: "anak", gender: "p", pitch: 48, rate: 9, scale: 0.70 },
  dewasa_pria: { label: "Dewasa laki-laki", g: "m", ageGroup: "dewasa", gender: "l", pitch: -4, rate: 0, scale: 1.0 },
  dewasa_wanita: { label: "Dewasa perempuan", g: "f", ageGroup: "dewasa", gender: "p", pitch: 4, rate: 0, scale: 0.96 },
  kakek: { label: "Kakek", g: "m", ageGroup: "lansia", gender: "l", pitch: -28, rate: -12, scale: 0.94 },
  nenek: { label: "Nenek", g: "f", ageGroup: "lansia", gender: "p", pitch: -16, rate: -10, scale: 0.90 },
};

const VARIANTS = [[0, 0], [18, 4], [-18, -4], [32, 7], [-30, -8]];

function normalizeKind(kind, gender) {
  if (kind && KINDS[kind]) return kind;
  if (kind === "pria") return "dewasa_pria";
  if (kind === "wanita") return "dewasa_wanita";
  if (kind === "anak") return gender === "p" ? "anak_perempuan" : "anak_laki";
  return "dewasa_pria";
}

function defaultVoice(kind, nth, lang) {
  const kKey = normalizeKind(kind);
  const k = KINDS[kKey];
  const list = VOICES[lang].filter((v) => v.g === k.g);
  const v = list[nth % list.length];
  const off = VARIANTS[nth % VARIANTS.length];
  return {
    voiceId: v.id,
    pitch: clamp(k.pitch + off[0], -80, 80),
    rate: clamp(k.rate + off[1], -40, 40),
    kind: kKey,
  };
}

const SKINS = [
  ["#fffaf0", "Putih krem (cerita hangat)"],
  ["#ffdcb8", "Terang"],
  ["#f1c27d", "Sawo muda"],
  ["#d9a066", "Sawo"],
  ["#b9794a", "Sawo matang"],
  ["#8a5530", "Gelap"],
];
const HAIRCOL = ["#2a1b14", "#4a2d16", "#1f1420", "#6b4a2a", "#8a3b1c"];
const CASUAL = ["#4da3ff", "#e0577a", "#3fbf8f", "#f0a43a", "#8a6bd6", "#e8664a"];

const HAIR_STYLES = [
  ["pendek", "Rambut pendek"],
  ["panjang", "Rambut panjang"],
  ["botak", "Botak / gundul"],
  ["poni", "Berponi"],
  ["bob", "Potongan bob"],
  ["kuncir", "Kuncir"],
  ["sanggul", "Sanggul"],
  ["uban", "Uban / putih"],
];

const HEAD_COVERS = [
  ["none", "Tanpa penutup kepala"],
  ["hijab", "Hijab"],
  ["peci", "Peci"],
  ["caping", "Caping"],
  ["topi", "Topi"],
  ["koki", "Topi koki"],
  ["polisi", "Topi polisi"],
  ["bando", "Bando"],
];

const OUTFITS = {
  kemeja: { label: "Kemeja rapi", top: "#e9f0fb", bottom: "#2b3445", sleeve: "long", legs: "long", deco: "tie" },
  jas: { label: "Jas formal", top: "#2a3042", bottom: "#2a3042", sleeve: "long", legs: "long", deco: "suit" },
  batik: { label: "Batik nusantara", top: "#9a6232", bottom: "#2b2b3a", sleeve: "long", legs: "long", deco: "batik" },
  kaos: { label: "Kaos santai", top: "#4da3ff", bottom: "#3b5a8c", sleeve: "short", legs: "short", deco: "logo", vary: true },
  sd: { label: "Seragam sekolah", top: "#f6f6f6", bottom: "#d62f3a", sleeve: "short", legs: "short", deco: "scarf" },
  smp: { label: "Seragam remaja", top: "#f6f6f6", bottom: "#2a4f9e", sleeve: "short", legs: "long", deco: "badge" },
  gamis: { label: "Gamis + hijab", top: "#7b5fb5", bottom: "#7b5fb5", sleeve: "long", legs: "longdress", head: "hijab", vary: true },
  daster: { label: "Baju santai rumah", top: "#e08aa0", bottom: "#e08aa0", sleeve: "short", legs: "skirt", deco: "flower", vary: true },
  kebaya: { label: "Kebaya + kain", top: "#b8324a", bottom: "#7a4524", sleeve: "long", legs: "longdress", deco: "kebaya", hair: "sanggul" },
  gaun: { label: "Gaun ceria", top: "#ff8fc0", bottom: "#ff8fc0", sleeve: "short", legs: "skirt", deco: "gaun", vary: true },
  koko: { label: "Baju koko", top: "#f1efe6", bottom: "#3a4a3a", sleeve: "long", legs: "long", deco: "buttons" },
  petani: { label: "Baju kebun/tani", top: "#7a6a3a", bottom: "#5a4a2a", sleeve: "long", legs: "short", deco: "rope" },
  dokter: { label: "Jas medis", top: "#fafafa", bottom: "#3b5a7a", sleeve: "long", legs: "long", deco: "steto" },
  overall: { label: "Baju kerja", top: "#e9b21f", bottom: "#2f5aa0", sleeve: "short", legs: "long", deco: "overall" },
};

const OUTFIT_BY = {
  anak_laki: ["sd", "kaos", "smp", "koko"],
  anak_perempuan: ["gaun", "sd", "gamis", "kaos", "smp"],
  dewasa_pria: ["kemeja", "batik", "kaos", "jas", "koko", "overall"],
  dewasa_wanita: ["gamis", "daster", "kebaya", "kemeja", "gaun"],
  kakek: ["koko", "batik", "kemeja", "petani"],
  nenek: ["kebaya", "daster", "gamis"],
};

function hashStr(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function mixHex(a, b, p) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const m = (sft) => Math.round(((x >> sft) & 255) * (1 - p) + ((y >> sft) & 255) * p);
  return "#" + [16, 8, 0].map((sft) => m(sft).toString(16).padStart(2, "0")).join("");
}
function kindGender(kind, g) { return KINDS[normalizeKind(kind, g)].gender; }

function resolveLook(c, over) {
  const h = hashStr(c.name);
  const kind = normalizeKind(c.kind, c.gender);
  const meta = KINDS[kind];
  const gender = kindGender(kind, c.gender);
  const list = OUTFIT_BY[kind] || OUTFIT_BY.dewasa_pria;
  const outfit = OUTFITS[c.outfit] ? c.outfit : list[h % list.length];
  const OF = OUTFITS[outfit];
  const status = ["kaya", "menengah", "sederhana"].includes(c.status) ? c.status : "menengah";
  const tint = (x) => (status === "sederhana" ? mixHex(x, "#8d8a80", 0.25) : status === "kaya" ? mixHex(x, "#ffffff", 0.06) : x);
  const accent = CASUAL[h % CASUAL.length];

  let hair = gender === "p"
    ? (meta.ageGroup === "anak" ? (h % 2 ? "bob" : "kuncir") : meta.ageGroup === "lansia" ? "sanggul" : "panjang")
    : (meta.ageGroup === "lansia" ? "uban" : "pendek");
  if (OF.hair) hair = OF.hair;

  let head = OF.head || "none";
  if (head === "none" && meta.ageGroup === "anak" && gender === "p" && h % 3 === 0) head = "bando";

  let legs = OF.legs;
  if ((outfit === "sd" || outfit === "smp") && gender === "p") legs = "skirt";

  const top = OF.vary ? tint(accent) : tint(OF.top);
  const bottom = OF.vary && (OF.legs === "skirt" || OF.legs === "longdress") ? top : tint(OF.bottom);

  const L = {
    outfit, status, gender, legs, head, hair,
    skin: SKINS[0][0],
    hairColor: meta.ageGroup === "lansia" ? "#e4e6ed" : HAIRCOL[h % HAIRCOL.length],
    top, bottom, sleeve: OF.sleeve, deco: OF.deco || "",
    glasses: meta.ageGroup === "lansia" || /guru|dokter|pak|bu/i.test(c.role || "") || (status === "kaya" && h % 4 === 0),
    beard: meta.ageGroup === "lansia" && gender === "l" ? "jenggot" : (kind === "dewasa_pria" && h % 6 === 0 ? "kumis" : "none"),
    shoes: status === "kaya" ? "kulit" : status === "sederhana" ? "sandal" : "sneaker",
    bag: outfit === "sd" || outfit === "smp" || (meta.ageGroup === "anak" && h % 2 === 0),
    bagColor: CASUAL[(h >> 3) % CASUAL.length],
    gold: status === "kaya",
  };
  return Object.assign(L, over || {});
}

const state = {
  project: null, images: {}, audio: {}, customAudio: {}, activeRec: null,
  music: null, cast: {}, castResolve: null, failedIndex: null, running: false,
  blob: null, ac: null, edgeDown: false, edgeFails: 0, edgeNoted: false,
};

const dims = (ratio) => (ratio === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 });
const isNarr = (name) => /^narat(o|e)r$/i.test(String(name));

function store(key, val) { try { localStorage.setItem("sva5_" + key, val); } catch (e) {} }
function load(key, def) { try { const v = localStorage.getItem("sva5_" + key); return v === null ? def : v; } catch (e) { return def; } }
function loadVoices() { try { return JSON.parse(load("voices", "{}")) || {}; } catch (e) { return {}; } }
function saveVoices(v) { store("voices", JSON.stringify(v)); }

function log(msg) {
  const t = new Date().toLocaleTimeString("id-ID");
  $("log").textContent += `[${t}] ${msg}\n`;
  $("log").scrollTop = $("log").scrollHeight;
}
function renderSteps() {
  $("steps").innerHTML = "";
  AGENTS.forEach((a) => {
    const li = document.createElement("li"); li.dataset.key = a.key;
    const ico = document.createElement("span"); ico.className = "ico";
    const name = document.createElement("span"); name.className = "name"; name.textContent = a.name;
    const st = document.createElement("span"); st.className = "st"; st.textContent = "menunggu";
    li.append(ico, name, st); $("steps").append(li);
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
function showError(msg) { $("errorText").textContent = msg; $("errorBox").hidden = false; }
function setRunning(on) { state.running = on; $("btnStart").disabled = on; $("btnResume").disabled = on; }

function baseUrl() {
  let u = $("workerUrl").value.trim().replace(/\/+$/, "");
  if (!u) throw new Error("URL Worker belum diisi. Buka Pengaturan koneksi lalu isi alamat Worker Cloudflare Anda.");
  if (!/^https?:\/\//i.test(u)) throw new Error("URL Worker harus diawali https://");
  try { u = new URL(u).origin; } catch (e) { throw new Error("URL Worker tidak valid."); }
  return u;
}

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
        let data = null; try { data = await res.json(); } catch (e) {}
        const err = new Error((data && data.error) || `Server mengembalikan kesalahan (kode ${res.status}).`);
        err.noRetry = (res.status < 500 && res.status !== 429) || res.status === 500;
        err.fromServer = true; throw err;
      }
      if (opts.binary) {
        const buf = await res.arrayBuffer(); clearTimeout(timer);
        return { buf, type: res.headers.get("content-type") || "", source: res.headers.get("x-source") || "", edgeError: res.headers.get("x-edge-error") || "" };
      }
      const data = await res.json().catch(() => null); clearTimeout(timer);
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
  throw lastErr || new Error("Gagal menghubungi server.");
}

function ensureAC() {
  if (!state.ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Browser ini tidak mendukung Web Audio.");
    state.ac = new AC();
  }
  if (state.ac.state === "suspended") state.ac.resume().catch(() => {});
  return state.ac;
}
function getCustomAudioBuffer(key) { return (state.customAudio && state.customAudio[key]) || null; }
async function decodeCustomAudio(key) {
  const raw = getCustomAudioBuffer(key);
  if (!raw) return null;
  return await ensureAC().decodeAudioData(raw.slice(0));
}

function chunkText(text, max) {
  max = max || 180;
  const sentences = String(text).replace(/\s+/g, " ").trim().match(/[^.!?…;:]+[.!?…;:]*/g) || [String(text)];
  const out = []; let cur = "";
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (let s of sentences) {
    s = s.trim(); if (!s) continue;
    while (s.length > max) {
      let cut = s.lastIndexOf(",", max); if (cut < 40) cut = s.lastIndexOf(" ", max); if (cut < 20) cut = max;
      push(); out.push(s.slice(0, cut + 1).trim()); s = s.slice(cut + 1).trim();
    }
    if (!s) continue;
    if ((cur + " " + s).trim().length > max) push();
    cur = (cur + " " + s).trim();
  }
  push(); return out;
}

function concatBuffers(ac, bufs, gapSec) {
  if (bufs.length === 1) return bufs[0];
  const sr = ac.sampleRate, gap = Math.round((gapSec || 0.14) * sr);
  const total = bufs.reduce((a, b) => a + b.length, 0) + gap * (bufs.length - 1);
  const out = ac.createBuffer(1, total, sr), d = out.getChannelData(0);
  let o = 0; bufs.forEach((b) => { d.set(b.getChannelData(0), o); o += b.length + gap; });
  return out;
}

function fallbackDetune(p) {
  const k = normalizeKind(p.kind, p.gender);
  const base = { anak_laki: 340, anak_perempuan: 380, dewasa_pria: -180, dewasa_wanita: 40, kakek: -420, nenek: -160 }[k] || 0;
  return clamp(base + p.pitch * 5, -700, 700);
}

async function synthBrowserSpeechBuffer(profile, text, lang) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const localePrefix = lang === "en" ? "en" : "id";
  const matchedVoice = voices.find((v) => new RegExp("^" + localePrefix, "i").test(v.lang)) || voices[0] || null;
  if (!matchedVoice && !voices.length) return null;
  return new Promise((resolve) => {
    let settled = false; const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    try {
      const utter = new SpeechSynthesisUtterance(text);
      if (matchedVoice) utter.voice = matchedVoice;
      utter.lang = (matchedVoice && matchedVoice.lang) || (lang === "en" ? "en-US" : "id-ID");
      utter.pitch = clamp(1 + (profile.pitch || 0) / 140, 0.5, 1.8);
      utter.rate = clamp(1 + (profile.rate || 0) / 120, 0.65, 1.5);
      utter.onend = () => done(true); utter.onerror = () => done(false);
      window.speechSynthesis.speak(utter);
      setTimeout(() => done(false), Math.max(4000, text.length * 110));
    } catch (e) { done(false); }
  });
}

async function ttsChunk(profile, text, engine) {
  const q = new URLSearchParams({ text, voice: profile.voiceId, pitch: String(profile.pitch), rate: String(profile.rate), engine });
  const r = await request(`/api/tts?${q}`, { binary: true, attempts: 3 }, 40000);
  const buf = await ensureAC().decodeAudioData(r.buf.slice(0));
  return { buf, source: r.source, edgeError: r.edgeError };
}

async function makeLine(profile, text) {
  const ac = ensureAC();
  const key = castKey(profile && profile.name);
  if (key && getCustomAudioBuffer(key)) {
    return { buf: await decodeCustomAudio(key), detune: 0, custom: true };
  }
  if ($("useBrowserSpeech") && $("useBrowserSpeech").checked) {
    const ok = await synthBrowserSpeechBuffer(profile, text, profile.lang || $("lang").value);
    if (ok) {
      const estSec = clamp(text.length * 0.068, 1.4, 14);
      return { buf: ac.createBuffer(1, Math.round(ac.sampleRate * estSec), ac.sampleRate), detune: 0, browserSpeech: true };
    }
  }
  const parts = chunkText(text), bufs = []; let fb = false;
  for (const part of parts) {
    const engine = state.edgeDown || fb ? "google" : "edge";
    const r = await ttsChunk(profile, part, engine);
    if (r.source === "edge-tts") state.edgeFails = 0;
    else {
      fb = true;
      if (engine === "edge") { state.edgeFails++; if (state.edgeFails >= 2) state.edgeDown = true; }
    }
    bufs.push(r.buf);
  }
  return { buf: concatBuffers(ac, bufs, 0.14), detune: fb ? fallbackDetune(profile) : 0 };
}

function playLine(line) {
  const ac = ensureAC(), s = ac.createBufferSource();
  s.buffer = line.buf; s.detune.value = line.detune; s.connect(ac.destination); s.start();
}

function createSfxBuffer(ac, type, durationSec) {
  const sr = ac.sampleRate, len = Math.max(1, Math.round(sr * durationSec));
  const buf = ac.createBuffer(1, len, sr), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr, p = i / len;
    if (type === "step") {
      const env = Math.exp(-t * 28);
      data[i] = (Math.sin(2 * Math.PI * (95 - t * 40) * t) * 0.65 + (Math.random() * 2 - 1) * 0.25) * env * 0.45;
    } else if (type === "whoosh") {
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 0.14;
    } else if (type === "chime") {
      data[i] = (Math.sin(2 * Math.PI * 523.25 * t) * 0.35 + Math.sin(2 * Math.PI * 659.25 * t) * 0.22) * Math.exp(-t * 3.5) * 0.25;
    } else {
      data[i] = (Math.random() * 2 - 1) * 0.035;
    }
  }
  return buf;
}

function scheduleSfxForTimeline(ac, dest, tl, total) {
  if (!($("sfxEnabled") && $("sfxEnabled").checked)) return;
  const stepBuf = createSfxBuffer(ac, "step", 0.16);
  const whooshBuf = createSfxBuffer(ac, "whoosh", 0.55);
  const chimeBuf = createSfxBuffer(ac, "chime", 1.1);
  const ambBuf = createSfxBuffer(ac, "ambience", Math.min(8, Math.max(2, total)));
  const sfxGain = ac.createGain(); sfxGain.gain.value = 0.38; sfxGain.connect(dest);

  const ambSrc = ac.createBufferSource(); ambSrc.buffer = ambBuf; ambSrc.loop = true; ambSrc.connect(sfxGain);
  ambSrc.start(0.4); ambSrc.stop(0.4 + total + 0.2);

  const openChime = ac.createBufferSource(); openChime.buffer = chimeBuf; openChime.connect(sfxGain); openChime.start(0.45);

  tl.forEach((seg, idx) => {
    if (idx > 0) {
      const wSrc = ac.createBufferSource(); wSrc.buffer = whooshBuf; wSrc.connect(sfxGain);
      wSrc.start(Math.max(0.4, 0.4 + seg.start - 0.22));
    }
    const walkSteps = Math.min(3, Math.max(1, Math.floor(seg.enter / 0.32)));
    for (let k = 0; k < walkSteps; k++) {
      const stSrc = ac.createBufferSource(); stSrc.buffer = stepBuf;
      stSrc.playbackRate.value = 0.94 + (k % 2) * 0.08; stSrc.connect(sfxGain);
      stSrc.start(0.4 + seg.start + 0.12 + k * 0.24);
    }
    if (seg.moralAt !== undefined) {
      const mChime = ac.createBufferSource(); mChime.buffer = chimeBuf; mChime.connect(sfxGain);
      mChime.start(0.4 + seg.start + seg.moralAt);
    }
  });
}

const castKey = (name) => String(name).toLowerCase();
const LOOK_STATUS = [["kaya", "Kaya"], ["menengah", "Menengah"], ["sederhana", "Sederhana"]];
const LOOK_BEARD = [["none", "Tanpa"], ["jenggot", "Jenggot"], ["kumis", "Kumis"]];

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function field(label, node) { const w = el("div"); w.append(el("label", "", label), node); return w; }
function selectEl(opts, val, cb) {
  const s = el("select");
  opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; if (v === val) o.selected = true; s.append(o); });
  s.addEventListener("change", () => cb(s.value)); return s;
}
function colorEl(val, cb) {
  const i = el("input"); i.type = "color"; i.value = /^#[0-9a-f]{6}$/i.test(val) ? val : "#888888";
  i.addEventListener("input", () => cb(i.value)); return i;
}
const recordOf = (c) => ({ name: c.name, voiceId: c.voiceId, pitch: c.pitch, rate: c.rate, kind: c.kind, lang: c.lang, gender: c.gender, role: c.role, status: c.status, look: c.look });
const currentStyle = () => (state.project ? state.project.options.style : $("style").value);

function knownCharacters() {
  const saved = loadVoices();
  return Object.keys(saved).filter((k) => k !== "narator").slice(0, 10).map((k) => {
    const v = saved[k];
    return { name: v.name || k, kind: normalizeKind(v.kind, v.gender), gender: v.gender, role: v.role || "", status: v.status, outfit: v.look && v.look.outfit };
  });
}

function renameCharacter(oldName, rawNewName) {
  const oldKey = castKey(oldName);
  const newName = String(rawNewName || "").replace(/[*_#`~>\[\]{}|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 22);
  if (!newName || castKey(newName) === oldKey) return oldName;
  const newKey = castKey(newName);
  if (state.customAudio && state.customAudio[oldKey]) {
    state.customAudio[newKey] = state.customAudio[oldKey];
    if (newKey !== oldKey) delete state.customAudio[oldKey];
  }
  if (state.cast && state.cast[oldKey]) {
    const entry = { ...state.cast[oldKey], name: newName, narrator: /^narat(o|e)r$/i.test(newName) };
    delete state.cast[oldKey]; state.cast[newKey] = entry;
  }
  if (state.project) {
    state.project.characters.forEach((ch) => { if (castKey(ch.name) === oldKey) ch.name = newName; });
    state.project.scenes.forEach((s) => {
      if (Array.isArray(s.present)) s.present = s.present.map((n) => (castKey(n) === oldKey ? newName : n));
      s.lines.forEach((ln) => { if (castKey(ln.speaker) === oldKey) ln.speaker = newName; });
    });
  }
  const saved = loadVoices();
  if (saved[oldKey]) { const rec = { ...saved[oldKey], name: newName }; delete saved[oldKey]; saved[newKey] = rec; saveVoices(saved); }
  return newName;
}

function initCast(p) {
  const lang = p.options.lang, saved = loadVoices(); state.cast = {};
  const counts = {}, entries = [];
  if (p.scenes.some((s) => s.lines.some((l) => isNarr(l.speaker)))) entries.push({ name: "Narator", kind: "dewasa_wanita", narrator: true });
  p.characters.forEach((c, i) => { if (!c.color) c.color = PALETTE[i % PALETTE.length]; c.kind = normalizeKind(c.kind, c.gender); entries.push(c); });
  entries.forEach((c) => {
    const key = castKey(c.name), sv = saved[key];
    const kind = normalizeKind((sv && sv.kind) || c.kind, (sv && sv.gender) || c.gender);
    const nth = counts[kind] || 0; counts[kind] = nth + 1;
    const voiceOk = sv && VOICES[lang].some((v) => v.id === sv.voiceId);
    const entry = {
      name: c.name, narrator: !!c.narrator, lang, locked: !!sv,
      role: (sv && sv.role) || c.role || "", gender: (sv && sv.gender) || c.gender || KINDS[kind].gender,
      status: (sv && sv.status) || c.status, kind,
      ...(voiceOk ? { voiceId: sv.voiceId, pitch: sv.pitch, rate: sv.rate } : defaultVoice(kind, nth, lang)),
    };
    if (!c.narrator) { entry.look = resolveLook({ ...c, kind, gender: entry.gender, status: entry.status }, sv && sv.look); c.kind = kind; }
    state.cast[key] = entry;
  });
}

function persistCast(key) {
  const c = state.cast[key]; if (!c) return;
  const saved = loadVoices();
  if (c.locked) saved[key] = recordOf(c); else delete saved[key];
  saveVoices(saved); renderLibrary();
}

function drawPreview(cv, c) {
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, "#eef4ff"); g.addColorStop(1, "#d9e6cf");
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, cv.height * 0.93, cv.width, cv.height * 0.07);
  const k = normalizeKind(c.kind, c.gender);
  drawPerson(ctx, {
    x: cv.width / 2, y: cv.height * 0.93, H: cv.height * 0.88 * (KINDS[k] ? Math.max(0.72, KINDS[k].scale) : 1),
    face: 1, look: c.look, kind: k, P: computePose("idle", "normal", 1.3), mouth: 0, t: 1, phase: 0, sty: charStyleOf(currentStyle()),
  });
}

function buildCastCard(c, o) {
  const lang = c.lang || o.lang;
  c.kind = normalizeKind(c.kind, c.gender);
  const card = el("details", "cast-item" + (c.locked ? " locked" : ""));
  card.open = !!o.open || !c.locked;
  const head = el("summary", "cast-head");
  const dot = el("span", "dot"); dot.style.background = o.color || "#9fb3d9";
  const nm = el("strong", "", c.name), sub = el("span", "small", "");
  const lock = el("button", "ghost lockbtn", ""); lock.type = "button";
  const setLockUi = () => { lock.textContent = c.locked ? "🔒 Tersimpan" : "🔓 Simpan"; card.classList.toggle("locked", c.locked); };
  lock.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); c.locked = !c.locked; setLockUi(); o.persist(); });
  head.append(dot, nm);
  if (!o.library) { setLockUi(); head.append(lock); }
  if (o.onDelete) {
    const del = el("button", "ghost lockbtn", "🗑 Hapus"); del.type = "button";
    del.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Hapus karakter "${c.name}"?`)) o.onDelete(); });
    head.append(del);
  }
  head.append(sub); card.append(head);
  const body = el("div", "cast-body"); card.append(body);

  function renderBody() {
    body.innerHTML = "";
    const L = c.look, kindMeta = KINDS[c.kind] || KINDS.dewasa_pria;
    sub.textContent = c.narrator ? "suara pencerita" : `${kindMeta.label}${L && OUTFITS[L.outfit] ? " · " + OUTFITS[L.outfit].label : ""}`;
    const nameInp = el("input"); nameInp.type = "text"; nameInp.maxLength = 22; nameInp.value = c.name;
    nameInp.addEventListener("change", () => {
      const updated = renameCharacter(c.name, nameInp.value);
      c.name = updated; nameInp.value = updated; nm.textContent = updated; o.persist(); renderLibrary();
    });
    body.append(field("Nama tokoh", nameInp));

    if (!c.narrator) {
      const top = el("div", "look-row");
      const cv = el("canvas", "cast-prev"); cv.width = 200; cv.height = 300;
      const redraw = () => drawPreview(cv, c); redraw();
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
        field("Gaya rambut", selectEl(HAIR_STYLES, L.hair, (v) => set({ hair: v }))),
        field("Penutup kepala", selectEl(HEAD_COVERS, L.head, (v) => set({ head: v }))),
        field("Warna kulit", selectEl(SKINS, L.skin, (v) => set({ skin: v }))),
        field("Janggut / kumis", selectEl(LOOK_BEARD, L.beard, (v) => set({ beard: v }))),
        field("Warna baju", colorEl(L.top, (v) => set({ top: v }))),
        field("Warna bawahan", colorEl(L.bottom, (v) => set({ bottom: v }))),
      );
      const cb = el("input"); cb.type = "checkbox"; cb.checked = !!L.glasses;
      cb.addEventListener("change", () => set({ glasses: cb.checked }));
      const cbl = el("label", "check"); cbl.append(cb, document.createTextNode(" Kacamata"));
      const right = el("div", "look-fields"); right.append(g1, cbl);
      top.append(cv, right); body.append(top);
    }

    const statusLbl = el("div", "rec-status", "");
    const updateRecStatus = () => {
      statusLbl.classList.remove("recording");
      statusLbl.textContent = getCustomAudioBuffer(castKey(c.name)) ? "🎙 Memakai rekaman suara sendiri" : "🔊 Memakai suara alami TTS";
    };
    updateRecStatus();

    const fileInp = el("input"); fileInp.type = "file"; fileInp.accept = "audio/*";
    fileInp.addEventListener("change", async () => {
      const f = fileInp.files && fileInp.files[0]; if (!f) return;
      state.customAudio = state.customAudio || {}; state.customAudio[castKey(c.name)] = await f.arrayBuffer(); updateRecStatus();
    });

    const recBtn = el("button", "ghost", "🎙 Rekam suara"); recBtn.type = "button";
    recBtn.addEventListener("click", async () => {
      if (state.activeRec && state.activeRec.targetKey === castKey(c.name)) { state.activeRec.recorder.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream), chunks = [], targetKey = castKey(c.name);
        recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
        recorder.onstop = async () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          state.customAudio = state.customAudio || {}; state.customAudio[targetKey] = await blob.arrayBuffer();
          state.activeRec = null; recBtn.textContent = "🎙 Rekam suara"; updateRecStatus();
        };
        state.activeRec = { recorder, stream, chunks, targetKey }; recorder.start();
        recBtn.textContent = "⏹ Stop rekam"; statusLbl.classList.add("recording"); statusLbl.textContent = "🔴 Sedang merekam...";
      } catch (err) { showError("Gagal mengakses mikrofon:\n" + err.message); }
    });

    body.append(field("Unggah file rekaman suara", fileInp), (() => { const r = el("div", "row"); r.append(recBtn); return r; })(), statusLbl);

    const kindSel = selectEl(Object.entries(KINDS).map(([k, v]) => [k, v.label]), c.kind, (v) => {
      Object.assign(c, defaultVoice(v, 0, lang));
      if (!c.narrator) { c.gender = kindGender(v, c.gender); c.look = resolveLook({ name: c.name, kind: v, gender: c.gender, outfit: c.look.outfit, status: c.look.status }, { skin: c.look.skin }); }
      o.persist(); renderBody();
    });
    const voiceSel = selectEl(VOICES[lang].map((v) => [v.id, v.label]), c.voiceId, (v) => { c.voiceId = v; o.persist(); });
    const g2 = el("div", "grid"); g2.append(field("Kategori usia & peran", kindSel), field("Suara alami (TTS)", voiceSel));
    const slider = (label, prop, min, max, unit) => {
      const wrap = el("div"), lb = el("label", "", `${label}: ${c[prop]}${unit}`), r = el("input");
      r.type = "range"; r.min = min; r.max = max; r.step = 1; r.value = c[prop];
      r.addEventListener("input", () => { c[prop] = Number(r.value); lb.textContent = `${label}: ${c[prop]}${unit}`; });
      r.addEventListener("change", () => o.persist()); wrap.append(lb, r); return wrap;
    };
    const sl = el("div", "grid"); sl.append(slider("Nada", "pitch", -80, 80, " Hz"), slider("Kecepatan", "rate", -40, 40, "%"));
    const test = el("button", "ghost", "▶ Tes suara alami"); test.type = "button";
    test.addEventListener("click", () => previewVoice(c, lang, test));
    const row = el("div", "row"); row.append(test);
    body.append(g2, sl, row);
  }
  renderBody(); return card;
}

function renderCast() {
  const box = $("castList"); box.innerHTML = "";
  const lang = state.project.options.lang;
  Object.keys(state.cast).forEach((key) => {
    const c = state.cast[key], ch = state.project.characters.find((x) => castKey(x.name) === key);
    box.append(buildCastCard(c, { lang, color: ch ? ch.color : "#9fb3d9", persist: () => persistCast(castKey(c.name)) }));
  });
}

function renderLibrary() {
  const box = $("libList"); if (!box) return; box.innerHTML = "";
  const saved = loadVoices(), keys = Object.keys(saved);
  $("libEmpty").hidden = keys.length > 0;
  keys.forEach((key, i) => {
    const sv = saved[key], lang = sv.lang || $("lang").value, normalizedKind = normalizeKind(sv.kind, sv.gender);
    const c = { ...sv, kind: normalizedKind, name: sv.name || key, narrator: key === "narator", locked: true, lang };
    if (!c.narrator) c.look = resolveLook({ name: c.name, kind: c.kind, gender: c.gender, status: c.status }, sv.look);
    box.append(buildCastCard(c, {
      lang, library: true, color: PALETTE[i % PALETTE.length],
      persist: () => { const all = loadVoices(); all[castKey(c.name)] = recordOf(c); saveVoices(all); },
      onDelete: () => { const all = loadVoices(); delete all[castKey(c.name)]; saveVoices(all); renderLibrary(); },
    }));
  });
}

async function previewVoice(c, lang, btn) {
  btn.disabled = true; const old = btn.textContent; btn.textContent = "memuat…";
  try {
    const text = lang === "en" ? `Hello, I am ${c.name}.` : `Halo, aku ${c.name}. Begini suara alaminya.`;
    if ($("useBrowserSpeech") && $("useBrowserSpeech").checked) { await synthBrowserSpeechBuffer(c, text, lang); return; }
    const ac = ensureAC(), parts = chunkText(text), bufs = [];
    for (const part of parts) { const r = await ttsChunk(c, part, state.edgeDown ? "google" : "edge"); bufs.push(r.buf); }
    playLine({ buf: concatBuffers(ac, bufs, 0.12), detune: state.edgeDown ? fallbackDetune(c) : 0 });
  } catch (e) { showError("Tes suara gagal:\n" + e.message); }
  finally { btn.disabled = false; btn.textContent = old; }
}

function showCastReview() {
  renderCast(); $("castCard").hidden = false; $("castCard").scrollIntoView({ behavior: "smooth", block: "start" });
  setStep("cast", "run", "menunggu Anda");
  return new Promise((res) => { state.castResolve = res; });
}
function finishCast() { if (!state.castResolve) return; $("castCard").hidden = true; const r = state.castResolve; state.castResolve = null; r(); }

function parseScriptToProject(rawScript, opts) {
  const rawLines = String(rawScript).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsedLines = [], charMap = new Map();
  for (const line of rawLines) {
    const m = line.match(/^([^:]{1,24}):\s*(.+)$/);
    if (m) {
      const speaker = m[1].trim(), text = m[2].trim();
      parsedLines.push({ speaker, text });
      if (!isNarr(speaker) && !charMap.has(castKey(speaker))) {
        let kind = "dewasa_pria";
        if (/nenek|eyang putri/i.test(speaker)) kind = "nenek";
        else if (/kakek|eyang/i.test(speaker)) kind = "kakek";
        else if (/adik|anak cewek|putri|dina|siti|ani|nina|cucu cewek/i.test(speaker)) kind = "anak_perempuan";
        else if (/anak|bocah|beni|udi|budi|cucu/i.test(speaker)) kind = "anak_laki";
        else if (/ibu|mama|bunda|bu |kak |mbak|tante|wati|sari|dewi/i.test(speaker)) kind = "dewasa_wanita";
        charMap.set(castKey(speaker), { name: speaker, kind, gender: KINDS[kind].gender, role: "", status: "menengah", color: PALETTE[charMap.size % PALETTE.length] });
      }
    } else parsedLines.push({ speaker: "Narator", text: line });
  }
  if (!charMap.size) {
    [
      { name: "Anak Laki", kind: "anak_laki", gender: "l", color: PALETTE[0] },
      { name: "Anak Perempuan", kind: "anak_perempuan", gender: "p", color: PALETTE[1] },
      { name: "Dewasa Pria", kind: "dewasa_pria", gender: "l", color: PALETTE[2] },
      { name: "Dewasa Wanita", kind: "dewasa_wanita", gender: "p", color: PALETTE[3] },
      { name: "Kakek", kind: "kakek", gender: "l", color: PALETTE[4] },
      { name: "Nenek", kind: "nenek", gender: "p", color: PALETTE[5] },
    ].forEach((d) => charMap.set(castKey(d.name), d));
  }
  const maxScenes = clamp(Number(opts.maxScenes) || 8, 2, 24);
  const perScene = Math.max(1, Math.ceil(parsedLines.length / maxScenes));
  const locations = ["halaman rumah kayu pagi hari", "teras & jalan setapak desa", "ruang keluarga hangat", "taman & kebun sore hari"];
  const times = ["pagi", "pagi", "siang", "sore"], cameras = ["zoom_in", "pan_right", "zoom_out", "pan_left"], emojis = ["🌅", "🚶", "🏡", "🌿"];
  const scenes = [];
  for (let sIdx = 0; sIdx < maxScenes; sIdx++) {
    const chunk = parsedLines.slice(sIdx * perScene, (sIdx + 1) * perScene);
    if (!chunk.length) break;
    const speakers = Array.from(new Set(chunk.map((x) => x.speaker).filter((sp) => !isNarr(sp))));
    const present = speakers.length ? speakers : Array.from(charMap.values()).slice(0, 2).map((c) => c.name);
    const loc = locations[sIdx % locations.length];
    scenes.push({
      id: sIdx + 1, location: loc, time: times[sIdx % times.length], camera: cameras[sIdx % cameras.length], emoji: emojis[sIdx % emojis.length],
      imagePrompt: `Warm storytelling illustration of ${loc}, natural lighting, detailed environment, no text`,
      seed: 1000 + sIdx * 137, present,
      lines: chunk.map((item, lIdx) => ({ speaker: item.speaker, text: item.text, emotion: lIdx % 3 === 0 ? "senang" : "normal" })),
    });
  }
  return {
    title: "Cerita Kehidupan & Perjalanan Bersama", genre: opts.genre || "anak",
    moral: "Langkah kecil bersama orang-orang tercinta menghadirkan kehangatan yang bertahan lama.",
    characters: Array.from(charMap.values()), scenes,
    options: { ...opts, targetSec: Math.max(30, Number(opts.targetSec) || 120) },
  };
}

function readOptions() {
  return {
    style: $("style").value, lang: $("lang").value, ratio: $("ratio").value,
    maxScenes: Number($("maxScenes").value), targetSec: Number($("targetSec").value),
    musicUrl: $("musicUrl").value.trim(), genre: $("genre").value,
  };
}

async function fetchImage(scene, seedOffset) {
  const { w, h } = dims(state.project.options.ratio);
  const q = new URLSearchParams({ prompt: scene.imagePrompt, seed: String(scene.seed + seedOffset), w: String(w), h: String(h) });
  const r = await request(`/api/image?${q}`, { binary: true, attempts: 1 }, 90000);
  return { bmp: await createImageBitmap(new Blob([r.buf], { type: r.type || "image/jpeg" })), source: r.source };
}

const STEPS = [
  async () => {
    const script = $("script").value.trim();
    if (script.length < 20) throw new Error("Naskah terlalu pendek. Tulis minimal 20 karakter.");
    const opts = { ...readOptions(), known: knownCharacters() };
    try {
      const d = await request("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, options: opts }), attempts: 2 }, 120000);
      state.project = d.project; state.project.options.targetSec = opts.targetSec;
    } catch (err) {
      log(`Menyusun cerita panjang lokal otomatis (${err.message}).`);
      state.project = parseScriptToProject(script, opts);
    }
    state.images = {}; state.audio = {}; state.music = null; state.cast = {};
    return `${state.project.characters.length} tokoh · ${state.project.scenes.length} adegan`;
  },
  async () => {
    const p = state.project; if (!Object.keys(state.cast).length) initCast(p);
    if ($("skipCast").checked && Object.values(state.cast).every((c) => c.locked)) return "tokoh tersimpan";
    await showCastReview(); return `${Object.keys(state.cast).length} tokoh`;
  },
  async () => {
    const scenes = state.project.scenes, n = scenes.length; let ok = 0;
    for (let i = 0; i < n; i++) {
      const s = scenes[i]; setStep("visual", "run", `latar ${i + 1}/${n}`);
      try { state.images[s.id] = (await fetchImage(s, 0)).bmp; ok++; } catch (e) { state.images[s.id] = null; }
    }
    return `${ok} latar AI + ornamen dunia nyata`;
  },
  async () => {
    const scenes = state.project.scenes, total = scenes.reduce((a, s) => a + s.lines.length, 0); let done = 0;
    const fallbackProfile = state.cast.narator || Object.values(state.cast)[0];
    for (const s of scenes) {
      for (let li = 0; li < s.lines.length; li++) {
        const key = `${s.id}:${li}`; done++; setStep("voice", "run", `suara ${done}/${total}`);
        const ln = s.lines[li];
        state.audio[key] = await makeLine(state.cast[castKey(ln.speaker)] || fallbackProfile, ln.text);
      }
    }
    return "suara siap";
  },
  async () => {
    const url = state.project.options.musicUrl;
    if (!url) return "SFX aktif";
    try {
      const r = await request(`/api/fetch?${new URLSearchParams({ url })}`, { binary: true, attempts: 2 }, 60000);
      state.music = await ensureAC().decodeAudioData(r.buf.slice(0));
      return "musik & SFX aktif";
    } catch (e) { return "SFX aktif"; }
  },
  async () => {
    setStep("render", "run", "merekam video…");
    state.blob = await renderVideo((p) => setStep("render", "run", `merekam ${Math.round(p * 100)}%`));
    return "video selesai";
  },
];

async function run(from) {
  if (state.running) return;
  setRunning(true); $("errorBox").hidden = true; $("btnResume").hidden = true; $("resultCard").hidden = true; $("progressCard").hidden = false;
  state.failedIndex = null;
  if (from === 0) { state.edgeDown = false; state.edgeFails = 0; state.edgeNoted = false; }
  try { ensureAC(); } catch (e) {}
  for (let i = 0; i < STEPS.length; i++) {
    const key = AGENTS[i].key;
    if (i < from) { setStep(key, "done", "selesai"); continue; }
    setStep(key, "run", "bekerja…");
    try { setStep(key, "done", await STEPS[i]()); }
    catch (e) { setStep(key, "fail", "gagal"); state.failedIndex = i; showError(`${AGENTS[i].name} gagal:\n${e.message}`); $("btnResume").hidden = false; setRunning(false); return; }
  }
  showResult(state.blob); setRunning(false);
}

function showResult(blob) {
  const ext = /mp4/i.test(blob.type) ? "mp4" : "webm";
  const name = `cerita-video-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  $("player").src = url; $("btnDownload").href = url; $("btnDownload").setAttribute("download", name);
  state.fileName = name; $("resultCard").hidden = false; $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

const FONT = `"Poppins", system-ui, "Segoe UI", Roboto, sans-serif`;
const ACCENT = "#ff8c1a";
function rr(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function shade(hex, amt) { const n = parseInt(String(hex).slice(1), 16); const f = (c) => Math.round(clamp(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt, 0, 255)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function layoutWords(ctx, words, maxW, gap) {
  const lines = []; let line = { items: [], width: 0 };
  words.forEach((word, idx) => { const w = ctx.measureText(word).width, add = (line.items.length ? gap : 0) + w; if (line.items.length && line.width + add > maxW) { lines.push(line); line = { items: [], width: 0 }; } line.width += (line.items.length ? gap : 0) + w; line.items.push({ word, idx, w }); });
  if (line.items.length) lines.push(line); return lines;
}
function wordTimes(words, span, lead) {
  const wt = words.map((x) => x.length + (/[.,;:!?…]$/.test(x) ? 4 : 1)), sum = wt.reduce((a, b) => a + b, 0) || 1; let acc = 0;
  return wt.map((x) => { const st = lead + (acc / sum) * Math.max(0.25, span - lead); acc += x; return st; });
}
function drawCover(ctx, img, W, H, zoom, ox, oy) {
  const ir = img.width / img.height, rr_ = W / H; let sw, sh;
  if (ir > rr_) { sh = img.height; sw = sh * rr_; } else { sw = img.width; sh = sw / rr_; }
  sw /= zoom; sh /= zoom;
  ctx.drawImage(img, (img.width - sw) / 2 + (ox * (img.width - sw)) / 2, (img.height - sh) / 2 + (oy * (img.height - sh)) / 2, sw, sh, 0, 0, W, H);
}
function bgKind(loc) {
  const t = String(loc || "").toLowerCase();
  if (/mewah|mansion|villa|rumah besar/.test(t)) return "mansion";
  if (/kelas|sekolah|school|kantin/.test(t)) return "classroom";
  if (/sawah|padi|ladang|kebun/.test(t)) return "paddy";
  if (/pasar|market/.test(t)) return "market";
  if (/pantai|laut|sungai|danau/.test(t)) return "beach";
  if (/hutan|gunung|desa|taman|halaman/.test(t)) return "forest";
  if (/rumah|kamar|dapur|warung|kafe|ruang/.test(t)) return "indoor";
  if (/jalan|kota|gang|kampung/.test(t)) return "street";
  return "field";
}
const SKY = { pagi: ["#ffd2a6", "#9ad0ff"], siang: ["#6fc3ff", "#d9f2ff"], sore: ["#6a55a8", "#ffa463"], malam: ["#090e2b", "#2a3573"] };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawProcBg(g, s, T) {
  const { ctx, W, H, groundY } = g, hz = groundY - H * 0.1, kind = bgKind(s.location), night = s.time === "malam";
  const [c1, c2] = SKY[s.time] || SKY.siang, sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, c1); sky.addColorStop(1, c2);
  if (kind === "indoor" || kind === "classroom" || kind === "mansion") {
    ctx.fillStyle = night ? "#2b2438" : "#dec8a6"; ctx.fillRect(0, 0, W, hz);
    const ww = W * 0.28, wh = H * (W > H ? 0.28 : 0.15), wx = W * 0.12, wy = H * 0.1;
    ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh); ctx.strokeStyle = "#5a4630"; ctx.lineWidth = 7; ctx.strokeRect(wx, wy, ww, wh);
    const fl = ctx.createLinearGradient(0, hz, 0, H); fl.addColorStop(0, "#93714c"); fl.addColorStop(1, "#61462c");
    ctx.fillStyle = fl; ctx.fillRect(0, hz, W, H - hz); return;
  }
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  ctx.fillStyle = night ? "#f5f2d6" : "#fff1a8"; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.14, H * (W > H ? 0.065 : 0.042), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)";
  for (let k = 0; k < 4; k++) {
    const cx = ((rnd(k + 5) + T * 0.008 * (k + 1)) % 1.3 - 0.15) * W, cy = H * (0.07 + 0.06 * k), r = H * 0.028;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 2.2, r, 0, 0, Math.PI * 2); ctx.fill();
  }
  let ground = ["#5ab060", "#3e8d4b"];
  if (kind === "beach") ground = ["#f0deb0", "#d8c08b"];
  else if (kind === "street" || kind === "market") ground = ["#525866", "#3d424e"];
  const gr = ctx.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, ground[0]); gr.addColorStop(1, ground[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
}

function drawRealWorldOrnaments(g, s, T) {
  if (!($("realProps") && $("realProps").checked)) return;
  const { ctx, W, H, groundY } = g, kind = bgKind(s.location), sway = Math.sin(T * 2.2) * 3.5;
  const drawFlowerPot = (px, py, scale, potColor, flowerColor) => {
    ctx.save(); ctx.translate(px, py); ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0, 2, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = potColor; ctx.beginPath(); ctx.moveTo(-18, -26); ctx.lineTo(18, -26); ctx.lineTo(13, 0); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(-21, -30, 42, 6);
    ctx.strokeStyle = "#2f8545"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(sway * 0.6, -46, sway, -60); ctx.stroke();
    ctx.fillStyle = "#3ca356"; ctx.beginPath(); ctx.ellipse(-9 + sway * 0.4, -44, 10, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9 + sway * 0.6, -50, 10, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flowerColor;
    for (let a = 0; a < 5; a++) { const ang = (a * Math.PI * 2) / 5 + T * 0.3; ctx.beginPath(); ctx.arc(sway + Math.cos(ang) * 7, -62 + Math.sin(ang) * 7, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(sway, -62, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  if (kind !== "street") {
    drawFlowerPot(W * 0.08, groundY + H * 0.04, W > H ? 1.1 : 0.88, "#c96a44", "#ff7597");
    drawFlowerPot(W * 0.92, groundY + H * 0.04, W > H ? 1.1 : 0.88, "#c96a44", "#ffb703");
  }
  if (kind === "street" || kind === "market") {
    const lx = W * 0.14; ctx.save(); ctx.fillStyle = "#2c3545"; ctx.fillRect(lx - 4, groundY - H * 0.34, 8, H * 0.34);
    ctx.fillStyle = "#ffe58f"; ctx.beginPath(); ctx.arc(lx, groundY - H * 0.35, 13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (kind === "indoor" || kind === "classroom" || kind === "mansion") {
    const tx = W * 0.83, ty = groundY + H * 0.03; ctx.save(); ctx.fillStyle = "#8c5d32";
    rr(ctx, tx - 44, ty - 28, 88, 10, 4); ctx.fill(); ctx.fillRect(tx - 34, ty - 18, 8, 22); ctx.fillRect(tx + 26, ty - 18, 8, 22);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(tx - 10, ty - 38, 14, 10); ctx.restore();
  } else {
    ctx.save(); ctx.strokeStyle = "rgba(110, 76, 44, 0.75)"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, groundY - H * 0.04); ctx.lineTo(W, groundY - H * 0.04); ctx.stroke();
    for (let x = W * 0.05; x < W; x += W * 0.18) { ctx.fillStyle = "#9a683b"; ctx.fillRect(x - 4, groundY - H * 0.075, 8, H * 0.045); }
    ctx.restore();
  }
}

function drawBackground(g, tl, t) {
  const { ctx, W, H } = g, img = state.images[tl.s.id];
  if (img) {
    const p = clamp(t / tl.dur, 0, 1); let zoom = 1.04, ox = 0;
    if (tl.s.camera === "zoom_in") zoom = 1.04 + 0.08 * p;
    else if (tl.s.camera === "zoom_out") zoom = 1.12 - 0.08 * p;
    else if (tl.s.camera === "pan_left") { zoom = 1.12; ox = lerp(0.7, -0.7, p); }
    else if (tl.s.camera === "pan_right") { zoom = 1.12; ox = lerp(-0.7, 0.7, p); }
    drawCover(ctx, img, W, H, zoom, ox, 0);
  } else drawProcBg(g, tl.s, g.T);
  drawRealWorldOrnaments(g, tl.s, g.T);
}

function computePose(mode, emo, t) {
  const s = Math.sin;
  const P = { lean: 0, head: 0, aF: [0.1, 0.24], aB: [-0.08, 0.12], lF: [0.08, 0.08], lB: [-0.08, -0.08], bob: 0, jump: 0, emo: "normal" };
  if (mode === "walk") {
    const w = t * 9.5;
    P.lF = [s(w) * 0.52, s(w) * 0.52 - Math.max(0, -Math.cos(w)) * 0.45];
    P.lB = [-s(w) * 0.52, -s(w) * 0.52 - Math.max(0, Math.cos(w)) * 0.45];
    P.aF = [-s(w) * 0.48, -s(w) * 0.48 + 0.32];
    P.aB = [s(w) * 0.48, s(w) * 0.48 + 0.32];
    P.bob = -Math.abs(s(w)) * 1.4; P.lean = 0.05; return P;
  }
  if (mode === "idle") { P.bob = s(t * 2.1); P.aF = [0.08 + 0.04 * s(t * 1.7), 0.22]; P.aB = [-0.06 + 0.03 * s(t * 1.3), 0.12]; P.head = 0.03 * s(t * 1.2); return P; }
  P.emo = emo;
  if (emo === "senang") { P.jump = Math.abs(s(t * 4.8)) * 0.05; P.aF = [2.4 + 0.22 * s(t * 8), 2.6]; P.aB = [2.2 + 0.22 * s(t * 8 + 1), 2.5]; P.head = 0.07 * s(t * 4.5); }
  else if (emo === "sedih") { P.lean = 0.18; P.head = 0.2; P.aF = [0.04, 0.12]; P.aB = [0, 0.06]; P.bob = s(t * 1.5) * 1.4; }
  else if (emo === "marah") { P.lean = 0.09; P.head = 0.03 * s(t * 16); P.aF = [0.5, 1.85 + 0.08 * s(t * 14)]; P.aB = [-0.3, 1.55]; P.bob = s(t * 8) * 1.6; }
  else if (emo === "kaget") { P.lean = -0.15; P.head = -0.06; P.aF = [2.0, 2.3]; P.aB = [1.7, 2.1]; P.bob = s(t * 18); }
  else { P.lean = 0.03; P.head = 0.05 * s(t * 3); P.bob = s(t * 5.5) * 1.4; P.aF = [0.65 + 0.35 * s(t * 4.4), 1.15 + 0.45 * s(t * 4.4 + 1)]; P.aB = [-0.1, 0.1 + 0.15 * s(t * 3.1)]; }
  return P;
}

const CHAR_STYLES = {
  soft: { ow: 0.011, line: "#3a2a22", limb: 1, limbCol: "#16161a", shade: false },
  cgi3d: { ow: 0.008, line: "#2a2430", limb: 1.25, limbCol: "#2b2630", shade: true },
  clay: { ow: 0.012, line: "#5a3a2a", limb: 1.75, limbCol: "#5a463d", shade: true },
  comic: { ow: 0.022, line: "#101018", limb: 1.25, limbCol: "#101018", shade: false },
};
function charStyleOf(style) { return CHAR_STYLES[{ komik: "comic", clay: "clay", animasi3d: "cgi3d" }[style] || "soft"]; }
function tube(ctx, pts, w, c, sty, H, outline) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); };
  if (outline) { ctx.strokeStyle = sty.line; ctx.lineWidth = w + sty.ow * H * 2; path(); }
  ctx.strokeStyle = c; ctx.lineWidth = w; path();
}
function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function paint(ctx, color, sty, x0, x1) {
  if (!sty.shade) return color;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(color, 0.22)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.22)); return g;
}
function outlineFill(ctx, color, sty, H, x0, x1) {
  ctx.fillStyle = paint(ctx, color, sty, x0, x1); ctx.fill();
  ctx.lineWidth = Math.max(1.5, sty.ow * H); ctx.strokeStyle = sty.line; ctx.lineJoin = "round"; ctx.stroke();
}
function drawShoe(ctx, p, H, L, back, sty) {
  const x = p.x + 0.03 * H, y = p.y; ctx.beginPath();
  if (L.shoes === "sandal") { ctx.ellipse(x, y - 0.004 * H, 0.052 * H, 0.014 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#8a6a3a" : "#c79a58"; ctx.fill(); }
  else if (L.shoes === "kulit") { ctx.ellipse(x, y - 0.012 * H, 0.056 * H, 0.026 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#141214" : "#201a1c"; ctx.fill(); }
  else { ctx.ellipse(x, y - 0.012 * H, 0.056 * H, 0.026 * H, 0, 0, Math.PI * 2); ctx.fillStyle = back ? "#d8d8d8" : "#ffffff"; ctx.fill(); ctx.lineWidth = Math.max(1.2, sty.ow * H * 0.8); ctx.strokeStyle = sty.line; ctx.stroke(); }
}

function drawPerson(ctx, o) {
  const H = o.H, P = o.P, L = o.look || resolveLook({ name: "Tokoh", kind: o.kind }), k = normalizeKind(o.kind, L.gender);
  const sty = o.sty || CHAR_STYLES.soft, meta = KINDS[k] || KINDS.dewasa_pria, kid = meta.ageGroup === "anak";
  const hr = (kid ? 0.17 : 0.145) * H, legLen = (kid ? 0.30 : 0.36) * H, L1 = legLen / 2, L2 = legLen / 2;
  const T = (kid ? 0.21 : 0.24) * H, A1 = 0.12 * H, A2 = 0.115 * H, lw = 0.026 * H * sty.limb, wt = 0.085 * H, wb = 0.078 * H, limb = sty.limbCol;
  const jy = -P.jump * H, hip = { x: 0, y: -legLen + jy + P.bob * H * 0.01 };
  const ux = Math.sin(P.lean), uy = -Math.cos(P.lean), px = Math.cos(P.lean), py = Math.sin(P.lean);
  const sh = { x: hip.x + ux * T, y: hip.y + uy * T }, shL = { x: sh.x - px * wt * 0.85, y: sh.y - py * wt * 0.85 }, shR = { x: sh.x + px * wt * 0.85, y: sh.y + py * wt * 0.85 };
  const hd = { x: sh.x + Math.sin(P.lean + P.head) * (hr + 0.01 * H), y: sh.y - Math.cos(P.lean + P.head) * (hr + 0.01 * H) };
  const chain = (p, a1, l1, a2, l2, sgn) => { const kn = { x: p.x + sgn * Math.sin(a1) * l1, y: p.y + Math.cos(a1) * l1 }; return [kn, { x: kn.x + sgn * Math.sin(a2) * l2, y: kn.y + Math.cos(a2) * l2 }]; };
  const [kB, fB] = chain({ x: hip.x - 0.04 * H, y: hip.y }, P.lB[0], L1, P.lB[1], L2, 1);
  const [kF, fF] = chain({ x: hip.x + 0.04 * H, y: hip.y }, P.lF[0], L1, P.lF[1], L2, 1);
  const [eB, wB] = chain(shL, P.aB[0], A1, P.aB[1], A2, -1);
  const [eF, wF] = chain(shR, P.aF[0], A1, P.aF[1], A2, 1);
  const skin = L.skin, dress = L.legs === "dress" || L.legs === "longdress" || L.legs === "skirt", pantsLong = L.legs === "long";

  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.face, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.22 * (1 - clamp(P.jump * 8, 0, 0.6))})`; ctx.beginPath(); ctx.ellipse(0, 0, 0.24 * H, 0.04 * H, 0, 0, Math.PI * 2); ctx.fill();
  const hc = L.hair === "uban" ? "#e5e7ef" : L.hairColor, hline = sty.line, hijab = L.head === "hijab", hijabCol = L.hijabColor || mixHex(L.top, "#ffffff", 0.12);
  const hairPath = () => { ctx.lineWidth = Math.max(1.2, sty.ow * H * 0.8); ctx.strokeStyle = hline; ctx.stroke(); };

  if (!hijab && L.hair !== "botak") {
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(P.lean + P.head); ctx.fillStyle = hc;
    if (L.hair === "panjang") { ctx.beginPath(); ctx.ellipse(0, hr * 0.55, hr * 1.12, hr * 1.25, 0, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    if (L.hair === "bob") { ctx.beginPath(); ctx.ellipse(0, hr * 0.25, hr * 1.14, hr * 1.12, 0, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    if (L.hair === "kuncir") { ctx.beginPath(); ctx.ellipse(-hr * 1.15, hr * 0.15, hr * 0.38, hr * 0.62, 0.5, 0, Math.PI * 2); ctx.fill(); hairPath(); disc(ctx, -hr * 0.98, -hr * 0.2, hr * 0.14, "#ff5d8f"); }
    if (L.hair === "sanggul") { ctx.beginPath(); ctx.arc(-hr * 0.1, -hr * 1.18, hr * 0.42, 0, Math.PI * 2); ctx.fill(); hairPath(); }
    ctx.restore();
  }

  const armDraw = (p0, e, w, back) => {
    const sleeveCol = back ? shade(L.top, -0.2) : L.top;
    tube(ctx, [p0, e, w], lw, limb, sty, H, false);
    if (L.sleeve === "long") tube(ctx, [p0, e, w], lw * 1.9, sleeveCol, sty, H, true);
    else tube(ctx, [p0, { x: lerp(p0.x, e.x, 0.6), y: lerp(p0.y, e.y, 0.6) }], lw * 2.0, sleeveCol, sty, H, true);
    disc(ctx, w.x, w.y, 0.034 * H * Math.max(1, sty.limb * 0.85), limb);
  };
  armDraw(shL, eB, wB, true);

  const legDraw = (p0, kn, ft, back) => {
    const pc = back ? shade(L.bottom, -0.22) : L.bottom;
    tube(ctx, [p0, kn, ft], lw, limb, sty, H, false);
    if (pantsLong) tube(ctx, [p0, kn, ft], lw * 1.9, pc, sty, H, true);
    else if (L.legs === "short") tube(ctx, [p0, { x: lerp(p0.x, kn.x, 0.8), y: lerp(p0.y, kn.y, 0.8) }], lw * 2.2, pc, sty, H, true);
    drawShoe(ctx, ft, H, L, back, sty);
  };
  legDraw({ x: hip.x - 0.04 * H, y: hip.y }, kB, fB, true);
  legDraw({ x: hip.x + 0.04 * H, y: hip.y }, kF, fF, false);

  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(P.lean * 0.6);
  if (dress) {
    const hem = L.legs === "longdress" ? 0.27 * H : 0.14 * H, spread = 0.13 * H;
    ctx.beginPath(); ctx.moveTo(-wb, -0.02 * H); ctx.lineTo(wb, -0.02 * H); ctx.lineTo(spread, hem); ctx.lineTo(-spread, hem); ctx.closePath();
    outlineFill(ctx, L.bottom, sty, H, -spread, spread);
  } else {
    ctx.beginPath(); rr(ctx, -wb * 1.02, -0.02 * H, wb * 2.04, 0.09 * H, 0.015 * H);
    outlineFill(ctx, L.bottom, sty, H, -wb, wb);
  }
  ctx.restore();

  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(P.lean);
  ctx.beginPath(); ctx.moveTo(-wb, 0.01 * H); ctx.lineTo(wb, 0.01 * H); ctx.lineTo(wt, -T + 0.02 * H); ctx.lineTo(-wt, -T + 0.02 * H); ctx.closePath();
  outlineFill(ctx, L.top, sty, H, -wt, wt); ctx.restore();

  armDraw(shR, eF, wF, false);

  ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(P.lean + P.head);
  const fx = hr * 0.12;
  ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fillStyle = paint(ctx, skin, sty, -hr, hr); ctx.fill();
  ctx.lineWidth = Math.max(1.5, sty.ow * H); ctx.strokeStyle = sty.line; ctx.stroke();

  if (!hijab && L.hair !== "botak") {
    ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, 0, hr * 1.04, Math.PI * 1.08, Math.PI * 3); ctx.closePath(); ctx.fill(); hairPath();
  }
  const er = hr * 0.125;
  [fx - hr * 0.36, fx + hr * 0.36].forEach((ex) => { ctx.fillStyle = "#1c1210"; ctx.beginPath(); ctx.ellipse(ex, -hr * 0.02, er, er * 1.3, 0, 0, Math.PI * 2); ctx.fill(); });
  if (L.beard === "jenggot") { ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(fx, hr * 0.88, hr * 0.5, hr * 0.34, 0, 0, Math.PI); ctx.fill(); }
  if (L.beard === "kumis") { ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(fx, hr * 0.27, hr * 0.3, hr * 0.065, 0, 0, Math.PI * 2); ctx.fill(); }
  const mx = fx, my = hr * 0.5;
  if (o.mouth > 0.08) { ctx.fillStyle = "#5a1d26"; ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.2, hr * (0.05 + 0.2 * o.mouth), 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.strokeStyle = "#5a1d26"; ctx.lineWidth = Math.max(1.4, hr * 0.06); ctx.beginPath(); ctx.arc(mx, my - hr * 0.1, hr * 0.15, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  if (L.glasses) {
    ctx.strokeStyle = "#2a2a30"; ctx.lineWidth = Math.max(1.5, hr * 0.06);
    [fx - hr * 0.36, fx + hr * 0.36].forEach((ex) => { ctx.beginPath(); ctx.arc(ex, -hr * 0.02, hr * 0.24, 0, Math.PI * 2); ctx.stroke(); });
  }
  if (hijab) {
    ctx.beginPath(); ctx.arc(0, hr * 0.05, hr * 1.32, 0, Math.PI * 2); ctx.ellipse(fx, hr * 0.12, hr * 0.78, hr * 0.86, 0, 0, Math.PI * 2, true);
    ctx.fillStyle = hijabCol; ctx.fill("evenodd"); hairPath();
  }
  ctx.restore(); ctx.restore();
  return { x: o.x + o.face * hd.x, y: o.y + hd.y - hr * 1.25 - 0.03 * H };
}

function drawNameTag(ctx, tag, fs, on) {
  ctx.font = `700 ${fs}px ${FONT}`; const w = ctx.measureText(tag.name).width + fs * 0.9, h = fs * 1.5;
  ctx.fillStyle = on ? tag.color : "rgba(0,0,0,0.55)"; rr(ctx, tag.x - w / 2, tag.y - h, w, h, h / 2); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = on ? "#191006" : "#fff"; ctx.fillText(tag.name, tag.x, tag.y - h / 2 + 1);
}

function drawSubtitle(g, active, t) {
  if (!active) return;
  const { ctx, W, H } = g, el_ = t - active.start; if (el_ < -0.05) return;
  let cw = -1; for (let i = 0; i < active.times.length; i++) if (active.times[i] <= el_) cw = i;
  const per = 7, page = Math.floor(Math.max(cw, 0) / per), pw = active.words.slice(page * per, page * per + per);
  const fs = H > W ? 38 : 30; ctx.font = `700 ${fs}px ${FONT}`;
  const gap = fs * 0.32, boxW = W * 0.9, pad = fs * 0.58, lines = layoutWords(ctx, pw, boxW - pad * 2, gap);
  const lh = fs * 1.35, bh = lines.length * lh + pad * 1.2, bx = W * 0.05, by = H * 0.975 - bh;
  ctx.fillStyle = "rgba(0,0,0,0.65)"; rr(ctx, bx, by, boxW, bh, fs * 0.6); ctx.fill();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  lines.forEach((line, li) => {
    let x = bx + (boxW - line.width) / 2; const yc = by + pad * 0.6 + li * lh + lh / 2;
    line.items.forEach((it) => {
      const gi = page * per + it.idx;
      if (gi === cw) { ctx.fillStyle = ACCENT; rr(ctx, x - 4, yc - fs * 0.62, it.w + 8, fs * 1.24, fs * 0.22); ctx.fill(); ctx.fillStyle = "#191006"; }
      else ctx.fillStyle = gi < cw ? "#ffffff" : "rgba(255,255,255,0.52)";
      ctx.fillText(it.word, x, yc); x += it.w + gap;
    });
  });
}

const BASES = { 1: [0.5], 2: [0.32, 0.68], 3: [0.2, 0.5, 0.8], 4: [0.14, 0.38, 0.62, 0.86], 5: [0.1, 0.3, 0.5, 0.7, 0.9] };
function buildChars(project, s, prev, W, H) {
  const present = s.present || [], n = Math.max(1, present.length), base = BASES[Math.min(5, n)], landscape = W > H;
  const shrink = n >= 5 ? 0.8 : n === 4 ? 0.88 : n === 3 ? 0.97 : n === 2 ? 1.08 : 1.18;
  return present.map((name, i) => {
    const key = castKey(name), c = project.characters.find((x) => castKey(x.name) === key) || { name, kind: "dewasa_pria" };
    const cast = state.cast[key], kind = normalizeKind((cast && cast.kind) || c.kind, (cast && cast.gender) || c.gender);
    const sx = (landscape ? 0.5 + (base[i] - 0.5) * 0.8 : base[i]) * W;
    return { key, name: c.name, kind, look: (cast && cast.look) || resolveLook({ ...c, kind }), color: c.color || PALETTE[i % PALETTE.length], slotX: sx, face: sx <= W / 2 ? 1 : -1, phase: i * 1.3, seed: hashStr(c.name), depth: i % 2, H: (landscape ? 0.52 : 0.31) * H * KINDS[kind].scale * shrink, enter: true };
  });
}

function locomotionOffset(ch, T, W) {
  const cycle = 5.2, ph = T + ch.phase * 1.9, k = Math.floor(ph / cycle), frac = ph / cycle - k;
  const target = (n) => (rnd(n * 11 + ch.seed % 89) - 0.5) * 2 * W * 0.045, moveWindow = 1.25 / cycle;
  if (frac < moveWindow) {
    const e = easeInOutCubic(frac / moveWindow), fromX = target(k - 1), toX = target(k);
    return { off: lerp(fromX, toX, e), moving: Math.abs(toX - fromX) > W * 0.004 };
  }
  return { off: target(k), moving: false };
}

function drawFrame(g, T) {
  const { ctx, W, H, tl, total } = g; g.T = T;
  let i = 0; for (let k = 0; k < tl.length; k++) if (T >= tl[k].start) i = k;
  const cur = tl[i], t = T - cur.start;
  const active = cur.lines.find((L) => t >= L.start && t < L.start + L.dur + 0.04) || null;
  g.mouth += ((active ? g.rms : 0) - g.mouth) * 0.5;
  drawBackground(g, cur, t);

  const WALK_IN = 1.1, spKey = active ? castKey(active.ln.speaker) : null;
  const items = cur.chars.map((ch) => {
    const speaking = ch.key === spKey; let x = ch.slotX, face = ch.face, P;
    if (ch.enter && t < WALK_IN) {
      const sx = ch.slotX <= W / 2 ? -W * 0.14 : W * 1.14;
      x = lerp(sx, ch.slotX, easeInOutCubic(t / WALK_IN)); face = sx < ch.slotX ? 1 : -1; P = computePose("walk", "normal", T);
    } else if (speaking) { const m = locomotionOffset(ch, T, W); x += m.off * 0.35; P = computePose("talk", active.ln.emotion, T); }
    else { const m = locomotionOffset(ch, T, W); x += m.off; if (m.moving) face = m.off >= 0 ? 1 : -1; P = m.moving ? computePose("walk", "normal", T * 0.75 + ch.phase) : computePose("idle", "normal", T + ch.phase); }
    return { ch, speaking, x, y: g.groundY + ch.depth * ch.H * 0.045, face, P };
  });
  items.sort((a, b) => a.y - b.y);
  const tfs = Math.max(18, Math.round(H * (W > H ? 0.038 : 0.025)));
  items.forEach((it) => {
    const pos = drawPerson(ctx, { x: it.x, y: it.y, H: it.ch.H, face: it.face, look: it.ch.look, kind: it.ch.kind, P: it.P, mouth: it.speaking ? g.mouth : 0, t: T, phase: it.ch.phase, sty: g.sty });
    drawNameTag(ctx, { name: it.ch.name, color: it.ch.color, x: pos.x, y: pos.y }, tfs, it.speaking);
  });
  drawSubtitle(g, active, t);
  ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fillRect(0, H - 7, W, 7);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, H - 7, W * clamp(T / total, 0, 1), 7);
  if (i > 0 && t < 0.45) { ctx.fillStyle = `rgba(255,248,235,${(1 - t / 0.45) * 0.25})`; ctx.fillRect(0, 0, W, H); }
}

function pickMime() {
  const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
}

function buildTimeline(project) {
  const { w: W, h: H } = dims(project.options.ratio), GAP = 0.28; let acc = 0; const tl = [];
  const baseLineDurs = project.scenes.map((s) => s.lines.map((ln, li) => {
    const a = state.audio[`${s.id}:${li}`] || null, rate = a ? Math.pow(2, a.detune / 1200) : 1;
    const words = ln.text.split(/\s+/).filter(Boolean);
    return a ? a.buf.duration / rate : Math.max(1.8, words.length / 2.3 + 0.5);
  }));
  const rawTotal = baseLineDurs.reduce((sum, arr, i) => sum + Math.max(3.5, (i === 0 ? 2.2 : 0.95) + arr.reduce((a, b) => a + b + GAP, 0) + 0.35), 0);
  const targetSec = Math.max(30, Number(project.options.targetSec) || 0);
  const stretch = targetSec > rawTotal ? clamp(targetSec / Math.max(1, rawTotal), 1, 2.2) : 1;

  project.scenes.forEach((s, i) => {
    const enter = (i === 0 ? 2.2 : 0.95) * stretch; let cur = enter;
    const lines = s.lines.map((ln, li) => {
      const a = state.audio[`${s.id}:${li}`] || null, rate = a ? Math.pow(2, a.detune / 1200) : 1;
      const words = ln.text.split(/\s+/).filter(Boolean), dur = baseLineDurs[i][li] * stretch;
      const L = { ln, li, a, rate, start: cur, dur, words, times: wordTimes(words, dur, 0.1) };
      cur += dur + GAP; return L;
    });
    const dur = Math.max(3.6, cur + 0.35);
    const x = { s, i, start: acc, dur, enter, lines };
    x.chars = buildChars(project, s, tl[i - 1] || null, W, H);
    acc += x.dur; tl.push(x);
  });
  return { tl, total: acc + 0.45, W, H };
}

async function renderVideo(onProgress) {
  const project = state.project, { tl, total, W, H } = buildTimeline(project);
  const canvas = $("stage"); canvas.hidden = false; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"), ac = ensureAC(); await ac.resume().catch(() => {});
  const dest = ac.createMediaStreamDestination(), voiceBus = ac.createGain(), analyser = ac.createAnalyser();
  analyser.fftSize = 512; voiceBus.connect(dest); voiceBus.connect(analyser);
  const t0 = ac.currentTime + 0.4;
  tl.forEach((x) => x.lines.forEach((L) => {
    if (!L.a) return;
    const src = ac.createBufferSource(); src.buffer = L.a.buf; src.detune.value = L.a.detune; src.connect(voiceBus); src.start(t0 + x.start + L.start);
  }));
  scheduleSfxForTimeline(ac, dest, tl, total);
  const g = { ctx, W, H, groundY: H * (W > H ? 0.8 : 0.74), tl, total, mouth: 0, rms: 0, T: 0, sty: charStyleOf(project.options.style) };
  const level = new Uint8Array(analyser.fftSize), stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = pickMime(), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5000000 } : {});
  const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error("Gagal merekam")); });
  drawFrame(g, 0); rec.start(1000);
  await new Promise((resolve) => {
    const tick = () => {
      const T = Math.max(0, ac.currentTime - t0);
      analyser.getByteTimeDomainData(level);
      let sum = 0; for (let k = 0; k < level.length; k++) { const d = (level[k] - 128) / 128; sum += d * d; }
      g.rms = clamp(Math.sqrt(sum / level.length) * 5, 0, 1);
      drawFrame(g, Math.min(T, total)); onProgress(clamp(T / total, 0, 1));
      if (T >= total) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await sleep(300); if (rec.state !== "inactive") rec.stop(); await stopped;
  return new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] });
}

function saveSettings() {
  store("worker", $("workerUrl").value.trim()); store("token", $("appToken").value.trim());
  store("useBrowserSpeech", $("useBrowserSpeech").checked ? "1" : "0");
  store("sfxEnabled", $("sfxEnabled").checked ? "1" : "0");
  store("realProps", $("realProps").checked ? "1" : "0");
}
async function testConnection() {
  const out = $("healthOut"); out.hidden = false; out.textContent = "Menguji koneksi…";
  try {
    saveSettings(); const d = await request("/api/health?probe=1", { method: "GET", attempts: 1 }, 30000);
    out.textContent = `Terhubung ✓ (Worker v${d.version || "5"})`;
  } catch (e) { out.textContent = "Gagal: " + e.message; }
}
function init() {
  $("workerUrl").value = load("worker", ""); $("appToken").value = load("token", ""); $("script").value = load("draft", "");
  $("useBrowserSpeech").checked = load("useBrowserSpeech", "0") === "1";
  $("sfxEnabled").checked = load("sfxEnabled", "1") === "1";
  $("realProps").checked = load("realProps", "1") === "1";
  ["style", "genre", "lang", "ratio", "targetSec", "maxScenes", "musicUrl"].forEach((id) => {
    $(id).value = load(id, $(id).value); $(id).addEventListener("change", () => store(id, $(id).value));
  });
  const upd = () => { $("counter").textContent = `${$("script").value.length} / 12000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); }); upd();
  renderSteps(); renderLibrary();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnClearVoices").addEventListener("click", () => { saveVoices({}); renderLibrary(); });
  $("btnSample").addEventListener("click", () => { $("script").value = SAMPLE; upd(); store("draft", SAMPLE); });
  $("btnStart").addEventListener("click", () => { try { baseUrl(); } catch (e) { showError(e.message); return; } saveSettings(); renderSteps(); run(0); });
  $("btnResume").addEventListener("click", () => { if (state.failedIndex !== null) run(state.failedIndex); });
  $("btnLockAll").addEventListener("click", () => { Object.keys(state.cast).forEach((k) => { state.cast[k].locked = true; persistCast(k); }); renderCast(); });
  $("btnCastDone").addEventListener("click", finishCast);
}
init();
