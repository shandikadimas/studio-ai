/* =====================================================================
 *  script.js — Studio Video AI v6 Pro · Story Motion Engine
 *  - Pembersih naskah anti-bocor (label JUDUL/SCENE/VISUAL tidak dibacakan)
 *  - Story Motion berlapis: kamera, parallax, objek naratif, karakter selektif
 *  - Subtitle sinkron durasi audio asli, musik adaptif + auto-ducking
 *  - Mendukung mode standalone (GitHub Pages) & Cloudflare Worker
 *  - Panel Storytelling & Prompt Director otomatis (Objek, Image & Motion Prompt)
 *  - Musik latar halus adaptif, suara alami TTS/browser/rekaman & SFX
 * ===================================================================== */
"use strict";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lerp = (a, b, p) => a + (b - a) * p;
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const AGENTS = [
  { key: "script", name: "Agen 1 · Sutradara, Storytelling & Penulis Cerita" },
  { key: "cast", name: "Agen 2 · Casting Usia, Rambut & Suara Alami" },
  { key: "visual", name: "Agen 3 · Latar & Ornamen Dunia Nyata" },
  { key: "voice", name: "Agen 4 · Pengisi Suara Alami & Rekaman" },
  { key: "music", name: "Agen 5 · Musik Adaptif Keadaan & SFX" },
  { key: "render", name: "Agen 6 · Render Video Sinematik Berkelanjutan" },
];

const SAMPLE = `Narator: Pagi itu, harga barang di warung dekat rumah terasa semakin mahal.
Ibu: Uang belanja bulan ini ternyata cepat sekali habis, ya.
Narator: Di atas meja kayu, koin dan lembaran uang dihitung satu per satu.
Bapak: Tenang, Bu. Kita atur lagi pengeluarannya, dan mulai menabung sedikit demi sedikit.
Narator: Sore harinya, sebuah ide muncul. Mereka menanam sayur dan bunga di pot depan teras.
Anak Perempuan: Lihat, Pak! Daun cabainya sudah tumbuh!
Narator: Perlahan, langkah kecil itu membawa rasa tenang. Malam pun datang, dan keluarga itu duduk bersama dengan hati yang hangat.
Bapak: Ingat ya, Nak, hemat itu bukan pelit, tapi cara menjaga mimpi.
Narator: Karena hidup yang baik dimulai dari keputusan kecil yang dijaga setiap hari.`;

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

const STORY_CAMERA_MOTIONS = [
  { label: "Slow Push-In", motion: "slow camera push-in toward the main subject and key props" },
  { label: "Pan Right", motion: "smooth horizontal camera pan right revealing environmental storytelling details" },
  { label: "Orbit Arc", motion: "gentle orbit arc shot around the foreground props and character" },
  { label: "Pull Back Reveal", motion: "gradual camera pull-back revealing wider surroundings and atmosphere" },
];

const STORY_PROP_RULES = [
  {
    keywords: ["uang", "rupiah", "seratus", "belanja", "harga", "mahal", "murah", "koin", "dompet", "inflasi"],
    propsId: "Lembaran uang & koin kembalian di atas meja kayu, keranjang belanja, label harga, dan wadah kecil",
    propsEn: "banknotes and scattered coins on a wooden table, shopping basket, price tags, and a small jar",
  },
  {
    keywords: ["warung", "jajan", "makan", "minum", "kopi", "makanan", "snack", "gelas", "piring", "sarapan"],
    propsId: "Etalase warung, aneka bungkus jajanan, gelas minuman hangat, dan piring kecil",
    propsEn: "snack display cabinet, snack packages, warm drink glass, and small plates",
  },
  {
    keywords: ["rumah", "keluarga", "teras", "kursi", "meja", "lampu", "pot", "tanaman", "halaman", "bunga"],
    propsId: "Meja & kursi teras, pot tanaman hijau dengan bunga, dedaunan, dan pencahayaan hangat",
    propsEn: "wooden porch table and chairs, potted green plants with flowers, leaves, and warm lighting",
  },
];

function detectStoryProps(text) {
  const lower = String(text || "").toLowerCase();
  const idList = [];
  const enList = [];
  for (const r of STORY_PROP_RULES) {
    if (r.keywords.some((k) => lower.includes(k))) {
      idList.push(r.propsId);
      enList.push(r.propsEn);
    }
  }
  if (!idList.length) {
    idList.push("Properti pendukung cerita di sekitar tokoh dan latar lingkungan");
    enList.push("story-relevant props around characters and atmospheric background");
  }
  return { id: idList.join("; "), en: enList.join(", ") };
}

function renderStoryDirector(project) {
  const box = $("storyScenes");
  const card = $("storyCard");
  if (!box || !card || !project || !Array.isArray(project.scenes)) return;

  const styleMap = {
    animasi3d: "3D animation render, warm lighting, rich tactile props",
    soft: "expressive storytelling 2D illustration, soft warm palette, detailed props",
    komik: "bold ink comic art style, expressive framing, clean linework",
    clay: "handcrafted claymation style, soft studio lighting, textured props",
  };
  const visStyle = styleMap[project.options.style] || styleMap.soft;
  const arTag = project.options.ratio === "16:9" ? "--ar 16:9" : "--ar 9:16";

  box.innerHTML = "";
  project.scenes.forEach((sc, idx) => {
    const narasi = (sc.lines || []).map((l) => `${l.speaker}: ${l.text}`).join(" ");
    const props = detectStoryProps(`${sc.location || ""} ${narasi}`);
    const cam = STORY_CAMERA_MOTIONS[idx % STORY_CAMERA_MOTIONS.length];

    const imgPrompt = `${visStyle}, scene at ${sc.location || "story setting"} (${sc.time || "pagi"}), depicting "${narasi}", featuring ${props.en}, no text, no watermark ${arTag}`;
    const motPrompt = `Characters show subtle breathing and expressive gestures, ${props.en} have gentle secondary motion, ${cam.motion}, smooth coherent motion`;

    const wrap = el("div", "cast-item");
    wrap.append(
      el("strong", "", `Adegan ${idx + 1} · ${sc.location || "Lokasi"} (${cam.label})`),
      el("div", "small", `Mode visual: ${({ object: "Fokus objek", mixed: "Objek + karakter saat bicara", char: "Fokus karakter" })[sc.mode] || "-"}${sc.hint ? " · Catatan visual: " + sc.hint : ""}`),
      el("div", "small", `Narasi: ${narasi}`),
      el("div", "small", `Objek & Properti: ${props.id}`),
      el("div", "prompt-line", `Image Prompt: ${imgPrompt}`),
      el("div", "prompt-line", `Motion Prompt: ${motPrompt}`)
    );

    const copyRow = el("div", "row");
    const b1 = el("button", "ghost", "Salin Image Prompt");
    b1.type = "button";
    b1.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(imgPrompt).catch(() => {});
    });

    const b2 = el("button", "ghost", "Salin Motion Prompt");
    b2.type = "button";
    b2.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(motPrompt).catch(() => {});
    });

    copyRow.append(b1, b2);
    wrap.append(copyRow);
    box.append(wrap);
  });

  card.hidden = false;
}

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
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) throw new Error("URL Worker harus diawali https://");
  try { u = new URL(u).origin; } catch (e) { throw new Error("URL Worker tidak valid."); }
  return u;
}

async function request(path, opts, timeoutMs) {
  const origin = baseUrl();
  if (!origin) throw new Error("URL Worker belum diisi.");
  opts = opts || {};
  const url = origin + path;
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
  const base = { anak_laki: 220, anak_perempuan: 260, dewasa_pria: -90, dewasa_wanita: 30, kakek: -210, nenek: -90 }[k] || 0;
  return clamp(base + p.pitch * 3, -400, 400);
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
  text = speakable(text); // lapis pertahanan terakhir: tak ada label/arahan yang boleh sampai ke TTS
  if (!text) return { buf: ac.createBuffer(1, Math.round(ac.sampleRate * 0.8), ac.sampleRate), detune: 0, silent: true };
  // Suara bawaan browser (Web Speech) TIDAK bisa direkam ke video, jadi hanya Worker yang menghasilkan suara.
  const silent = () => ({ buf: ac.createBuffer(1, Math.round(ac.sampleRate * clamp(text.length * 0.068, 1.4, 14)), ac.sampleRate), detune: 0, silent: true });
  if (!baseUrl()) return silent();
  try {
    const parts = chunkText(text), bufs = []; let fb = false;
    for (const part of parts) {
      const engine = state.edgeDown || fb ? "google" : "edge";
      const r = await ttsChunk(profile, part, engine);
      if (r.source === "edge-tts") state.edgeFails = 0;
      else {
        fb = true;
        if (engine === "edge") {
          state.edgeFails++; if (state.edgeFails >= 2) state.edgeDown = true;
          if (!state.edgeNoted) { state.edgeNoted = true; log("Suara Edge tidak tersedia" + (r.edgeError ? " (" + r.edgeError + ")" : "") + " — memakai suara Google dengan nada berbeda tiap tokoh."); }
        }
      }
      bufs.push(r.buf);
    }
    return { buf: concatBuffers(ac, bufs, 0.14), detune: fb ? fallbackDetune(profile) : 0 };
  } catch (e) {
    if ($("useBrowserSpeech") && $("useBrowserSpeech").checked) { log("Suara gagal (" + e.message + ") — baris ini dibuat tanpa suara."); return silent(); }
    throw e;
  }
}

function playLine(line) {
  const ac = ensureAC(), s = ac.createBufferSource();
  s.buffer = line.buf; s.detune.value = line.detune; s.connect(ac.destination); s.start();
}

/* =====================================================================
 *  MUSIK LATAR ADAPTIF + AUTO-DUCKING + SFX
 *  - Mood dipilih per adegan: waktu (pagi/siang/sore/malam), genre, emosi, ketegangan.
 *  - Ducking dijadwalkan dari timeline suara asli: musik mengecil saat narasi aktif.
 *  - Semua dijadwalkan relatif t0 (sinkron dengan suara & kanvas).
 * ===================================================================== */
const MOODS = {
  pagi:   { root: 60, ch: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 4]], sec: 3.2, step: 0.4, lp: 0.22, vol: 1 },
  siang:  { root: 62, ch: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], sec: 2.4, step: 0.3, lp: 0.28, vol: 1 },
  sore:   { root: 57, ch: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]], sec: 3.6, step: 0.6, lp: 0.18, vol: 1 },
  malam:  { root: 55, ch: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-2, 2, 5, 8]], sec: 4.2, step: 0.84, lp: 0.14, vol: 0.9 },
  tegang: { root: 50, ch: [[0, 3, 6, 9], [1, 4, 8, 11], [0, 3, 7, 10]], sec: 3.0, step: 0.55, lp: 0.1, vol: 1, beat: 1.1 },
  sedih:  { root: 57, ch: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-7, -4, 0, 3]], sec: 4.6, step: 1.0, lp: 0.13, vol: 0.9 },
};
function moodKey(scene, genre) {
  const emo = ((scene && scene.lines) || []).map((l) => l.emotion);
  if (scene && scene.tension) return "tegang";
  if (emo.includes("sedih")) return "sedih";
  if (genre === "komedi") return "siang";
  if (genre === "drama" && scene.time !== "pagi") return "sedih";
  return MOODS[scene && scene.time] ? scene.time : "pagi";
}
function renderMood(ac, key, sec) {
  const m = MOODS[key], sr = 22050, len = Math.round(sr * sec), buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const f = (n) => 440 * Math.pow(2, (n - 69) / 12), TAU = 6.2832, soft = key === "malam" || key === "sedih" ? 0.7 : 1;
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr, ch = m.ch[Math.floor(t / m.sec) % m.ch.length], lt = t % m.sec, env = Math.min(1, lt / 0.7, (m.sec - lt) / 0.9);
    let pad = 0;
    for (let k = 0; k < ch.length; k++) { const fr = f(m.root + ch[k]); pad += Math.sin(TAU * fr * t + k) * 0.5 + Math.sin(TAU * fr * 2.003 * t) * 0.12; }
    const bass = Math.sin(TAU * f(m.root + ch[0] - 24) * t) * 0.22 * env;
    const si = Math.floor(lt / m.step), sp = lt - si * m.step, an = f(m.root + 12 + ch[si % ch.length] + (si % 4 === 3 ? 12 : 0));
    const pluck = Math.sin(TAU * an * t) * Math.exp(-sp * 5) * 0.16 * soft;
    let beat = 0;
    if (m.beat) { const bt = (t * m.beat) % 1; beat = Math.sin(TAU * 52 * bt) * Math.exp(-bt * 9) * 0.35 + (bt >= 0.25 ? Math.sin(TAU * 52 * (bt - 0.25)) * Math.exp(-(bt - 0.25) * 9) * 0.2 : 0); }
    lp += m.lp * (pad * 0.11 * env + bass + beat - lp);
    d[i] = (lp + pluck) * Math.min(1, t / 0.5, (sec - t) / 0.5) * m.vol;
  }
  return buf;
}

function createSfxBuffer(ac, type, durationSec) {
  const sr = ac.sampleRate, len = Math.max(1, Math.round(sr * durationSec));
  const buf = ac.createBuffer(1, len, sr), data = buf.getChannelData(0);
  let lw = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr, p = i / len;
    if (type === "step") data[i] = (Math.sin(2 * Math.PI * (95 - t * 40) * t) * 0.65 + (Math.random() * 2 - 1) * 0.25) * Math.exp(-t * 28) * 0.45;
    else if (type === "whoosh") data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 0.14;
    else if (type === "chime") data[i] = (Math.sin(2 * Math.PI * 523.25 * t) * 0.35 + Math.sin(2 * Math.PI * 659.25 * t) * 0.22) * Math.exp(-t * 3.5) * 0.25;
    else if (type === "pop") data[i] = Math.sin(2 * Math.PI * (380 * t + 700 * t * t)) * Math.exp(-t * 16) * 0.4;
    else if (type === "wind") { lw += 0.03 * ((Math.random() * 2 - 1) - lw); data[i] = lw * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.35 * t)) * 1.6 * Math.min(1, t / 0.5, (durationSec - t) / 0.5); }
    else data[i] = 0;
  }
  return buf;
}

/* Berat (sintesis) — dijalankan SEBELUM t0 dihitung agar jadwal audio tidak tertinggal. */
function prepareAudioBank(ac, tl, genre) {
  const bank = { mood: {}, keys: tl.map((x) => moodKey(x.s, genre)), sfx: {} };
  bank.keys.forEach((k) => { if (!bank.mood[k]) bank.mood[k] = renderMood(ac, k, 24); });
  bank.sfx = { step: createSfxBuffer(ac, "step", 0.16), whoosh: createSfxBuffer(ac, "whoosh", 0.55), chime: createSfxBuffer(ac, "chime", 1.1), pop: createSfxBuffer(ac, "pop", 0.25), wind: createSfxBuffer(ac, "wind", 6) };
  return bank;
}

function scheduleAudio(ac, dest, tl, total, bank, t0) {
  const sfxOn = !$("sfxEnabled") || $("sfxEnabled").checked;
  const duck = ac.createGain(), bed = ac.createGain(), sfx = ac.createGain();
  bed.gain.value = 0.34; sfx.gain.value = 0.34; bed.connect(duck); duck.connect(dest); sfx.connect(dest);
  const play = (buf, node, when, rate) => { const s = ac.createBufferSource(); s.buffer = buf; if (rate) s.playbackRate.value = rate; s.connect(node); s.start(when); return s; };

  if (state.music) {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = state.music; s.loop = true; s.connect(g); g.connect(bed);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 1.2); g.gain.setValueAtTime(1, t0 + total - 1.5); g.gain.linearRampToValueAtTime(0, t0 + total);
    s.start(t0); s.stop(t0 + total + 0.1);
  } else {
    tl.forEach((x, i) => {
      const s = ac.createBufferSource(), g = ac.createGain(), a = t0 + x.start, b = a + x.dur, from = Math.max(0, a - 0.4);
      s.buffer = bank.mood[bank.keys[i]]; s.loop = true; s.connect(g); g.connect(bed);
      g.gain.setValueAtTime(0, from); g.gain.linearRampToValueAtTime(1, a + 0.7); g.gain.setValueAtTime(1, Math.max(a + 0.7, b - 0.5)); g.gain.linearRampToValueAtTime(0, b + 0.7);
      s.start(from); s.stop(b + 0.8);
    });
  }

  // Auto-ducking: musik mengecil selama suara narasi/dialog benar-benar terdengar.
  const iv = [];
  tl.forEach((x) => x.lines.forEach((L) => { if (L.a && !L.a.silent) iv.push([t0 + x.start + L.start + L.lead, t0 + x.start + L.start + L.dur - L.tail]); }));
  const merged = [];
  iv.forEach((v) => { const l = merged[merged.length - 1]; if (l && v[0] - l[1] < 0.7) l[1] = v[1]; else merged.push([v[0], v[1]]); });
  duck.gain.setValueAtTime(1, 0);
  merged.forEach(([a, b]) => { duck.gain.setTargetAtTime(0.3, Math.max(0, a - 0.15), 0.08); duck.gain.setTargetAtTime(1, b + 0.1, 0.35); });

  if (!sfxOn) return;
  play(bank.sfx.chime, sfx, t0 + 0.05);
  tl.forEach((x, i) => {
    const a = t0 + x.start;
    if (i > 0) play(bank.sfx.whoosh, sfx, Math.max(t0, a - 0.25));
    if (x.mode === "char") for (let k = 0; k < 3; k++) play(bank.sfx.step, sfx, a + 0.12 + k * 0.24, 0.94 + (k % 2) * 0.08);
    x.objs.forEach((o) => play(bank.sfx.pop, sfx, a + o.t0, 0.95 + (o.t0 % 0.1)));
    if (!/indoor|classroom|mansion/.test(bgKind(x.s.location))) {
      const w = ac.createBufferSource(), g = ac.createGain();
      w.buffer = bank.sfx.wind; w.loop = true; w.connect(g); g.connect(sfx);
      g.gain.setValueAtTime(0.3, a); g.gain.setValueAtTime(0.3, a + x.dur - 0.5); g.gain.linearRampToValueAtTime(0, a + x.dur);
      w.start(a); w.stop(a + x.dur + 0.05);
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
      statusLbl.textContent = getCustomAudioBuffer(castKey(c.name)) ? "🎙 Memakai rekaman suara sendiri" : "🔊 Memakai suara alami TTS / perangkat";
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
    if (!baseUrl()) {
      await synthBrowserSpeechBuffer(c, text, lang);
      return;
    }
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

/* =====================================================================
 *  PEMBERSIH NASKAH ANTI-BOCOR + PENYUSUN PROYEK
 *  Hanya teks narasi/dialog murni yang boleh sampai ke TTS & subtitle.
 *  Label teknis (JUDUL, FORMAT, GAYA BAHASA, SCENE n, VISUAL, ...) dibuang
 *  dari suara; catatan visual dipakai sebagai konteks adegan & prompt gambar.
 * ===================================================================== */
const LBL_TITLE = /^(judul|title|judul video|judul cerita)$/;
const LBL_HINT = /^(visual|visualisasi|camera|kamera|gerak kamera|lokasi|setting|latar|latar tempat|properti|objek|prompt|image prompt|motion prompt|lighting|pencahayaan|suasana|transisi|transition|efek|sfx|efek suara|musik|music|bgm|backsound|suara latar|ambience|shot|angle|animasi|gerakan|ekspresi|teks layar|teks|on screen|on-screen|text|overlay)$/;
const LBL_META = /^(format|gaya|gaya bahasa|gaya visual|gaya penulisan|gaya narasi|genre|tema|durasi|total durasi|rasio|platform|target|target penonton|catatan|note|notes|hashtag|caption|deskripsi|sumber|susunan cerita|struktur|struktur cerita|alur|alur cerita|konsep|tujuan|ringkasan|sinopsis|bahasa|nada|tone|warna|palet warna|font|resolusi|jumlah scene|jumlah adegan|tokoh|karakter|pemeran|cast|tips|petunjuk|arahan|arahan visual|keterangan|referensi|output|ide|ide cerita|outline|rangkuman|audience|penonton|kata kunci|keyword|seo)$/;
const LBL_SPOKEN = /^(narasi|narator|narrator|voice ?over|vo|suara|dialog|teks narasi|script|naskah|hook|pembuka|pembukaan|penutup|cta|moral|pesan|pesan moral|isi|kesimpulan|opening|closing|intro|outro)$/;
const REAL_SPEECH = /^(narasi|narator|narrator|voice ?over|vo|dialog|script|naskah|teks narasi)$/;
const SCENE_RE = /^(scene|adegan|babak|segmen|shot|bagian|part|slide)\s*#?\s*(\d+)\b(.*)$/i;
const INLINE_RE = /\s(?:VISUAL|KAMERA|CAMERA|SFX|MUSIK|MUSIC|BGM|TRANSISI|LIGHTING|CATATAN|NOTE)\s*[:：].*$/i;
const PROSE_LEAD = /^(intinya|ingat|ingatlah|penting|contohnya|misalnya|ternyata|akhirnya|namun|tapi|catat|fakta|faktanya|pertanyaannya|jawabannya|solusinya|hasilnya|kesimpulannya|bayangkan|perhatikan|tahukah|alasannya|caranya|tujuannya|manfaatnya|sebabnya|artinya|yaitu|yakni|contoh|langkah|tips)$/i;
const ROLE_WORD = /^(kakek|nenek|ibu|bapak|ayah|anak|adik|kakak|pak|bu|mas|mbak|om|tante|guru|dokter|penjual|pembeli|dewasa|narator)\b/i;

function speakable(s) {
  let t = String(s || "");
  t = t.replace(/[\[(\{<][^\])\}>]*[\])\}>]/g, " ").replace(/https?:\/\/\S+|www\.\S+/gi, " ").replace(/(^|\s)[#@][\p{L}\p{N}_]+/gu, " ");
  t = t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ").replace(/[*_`~^|\\"“”«»]/g, "");
  t = t.replace(/\s*&\s*/g, " dan ").replace(/(\d)\s*%/g, "$1 persen").replace(/\s*[—–]+\s*/g, ", ").replace(/\//g, " ").replace(/\.{4,}/g, "…").replace(/([!?,])\1+/g, "$1");
  t = t.replace(/\s+/g, " ").replace(/^[\s,.;:!?\-]+/, "").trim();
  if (!/[\p{L}\p{N}]/u.test(t)) return "";
  if (!/[.!?…]$/.test(t)) t = t.replace(/[,;:\-]+$/, "") + ".";
  return t;
}

function labelOf(s) {
  s = String(s || "").trim();
  const m = s.match(/^([^:：]{1,40}?)\s*[:：]\s*(.*)$/), whole = !m && s.length <= 40;
  if (!m && !whole) return null;
  const key = (m ? m[1] : s).replace(/\([^)]*\)|\[[^\]]*\]/g, " ").toLowerCase().replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const kind = LBL_TITLE.test(key) ? "title" : LBL_HINT.test(key) ? "hint" : LBL_META.test(key) ? "meta" : LBL_SPOKEN.test(key) ? "spoken" : null;
  return kind ? { kind, key, rest: m ? m[2].trim() : "", colon: !!m } : null;
}

function validSpeaker(n) {
  n = String(n || "").trim();
  if (n.length < 2 || n.length > 24 || !/^[\p{L}][\p{L}\p{N} .'’\-]*$/u.test(n)) return false;
  if (PROSE_LEAD.test(n) || /^(scene|adegan|babak|segmen)\b/i.test(n) || /\d{2}/.test(n) || /\d[.:]\d/.test(n)) return false;
  const w = n.split(/\s+/);
  return w.length <= 3 && (w.length === 1 || w.every((x) => /^\p{Lu}/u.test(x)) || (n === n.toLowerCase() && ROLE_WORD.test(n)));
}
const normSpeaker = (n) => (/^(narasi|narator|narrator|voice ?over|vo)$/i.test(String(n).trim()) ? "Narator" : String(n).trim());

function guessKind(speaker) {
  if (/nenek|eyang putri/i.test(speaker)) return "nenek";
  if (/kakek|eyang/i.test(speaker)) return "kakek";
  if (/anak (perempuan|cewek|wanita)|putri|adik perempuan|dina|siti|ani\b|nina|cucu (cewek|perempuan)/i.test(speaker)) return "anak_perempuan";
  if (/anak|bocah|beni|udi|budi|cucu|adik/i.test(speaker)) return "anak_laki";
  if (/ibu|mama|bunda|\bbu\b|kak |mbak|tante|wati|sari|dewi|wanita/i.test(speaker)) return "dewasa_wanita";
  return "dewasa_pria";
}
function makeChar(name, i) { const kind = guessKind(name); return { name, kind, gender: KINDS[kind].gender, role: "", status: "menengah", color: PALETTE[i % PALETTE.length] }; }

/* Parser utama: kembalikan adegan berisi baris suara bersih + catatan visual terpisah. */
function parseNaskah(raw) {
  const R = { title: "", titleExplicit: false, scenes: [], hints: [], lines: 0, dropped: 0, marked: false };
  let cur = { marked: false, lines: [] }, block = null;
  const pushScene = () => { if (cur.lines.length) R.scenes.push(cur); };
  const addHint = (txt) => { txt = String(txt || "").replace(/\s+/g, " ").trim(); if (txt) R.hints.push({ at: R.lines, scene: R.scenes.length, text: txt }); };
  const speak = (sp, text) => {
    const hs = [];
    text = text.replace(/[\[(]([^\])]{3,140})[\])]/g, (_, g) => { hs.push(g); return " "; });
    const im = text.match(INLINE_RE);
    if (im) { hs.push(im[0].replace(/^\s*[^:：]+[:：]/, "")); text = text.slice(0, im.index); }
    hs.forEach(addHint);
    const t = speakable(text);
    if (!t) { R.dropped++; return; }
    cur.lines.push({ speaker: sp, text: t }); R.lines++;
  };
  for (const row of String(raw || "").replace(/\r/g, "").split("\n")) {
    let s = row.replace(/\*\*|__|`/g, "").trim(), fromHeader = false;
    if (!s) { block = null; continue; }
    if (/^[-=_*~#\s]{3,}$/.test(s)) continue;
    const bullet = /^(?:#{1,6}|>+|[-*•–—·]|\d{1,2}[.)])\s+/.test(s);
    s = s.replace(/^(?:#{1,6}|>+|[-*•–—·]|\d{1,2}[.)])\s+/, "").trim();
    s = s.replace(/^[\[(]?\d{1,2}:\d{2}(?:\s*[-–—~]\s*\d{1,2}:\d{2})?[\])]?\s*[:：\-–—]?\s*/, "").trim();
    if (!s) continue;
    const sc = s.match(SCENE_RE);
    if (sc) {
      pushScene(); cur = { marked: true, lines: [] }; R.marked = true; block = null; R.dropped++;
      s = sc[3].replace(/^[\s:：.\-–—)\]]+/, "").replace(/^[\[(][^\])]*[\])]\s*/, "").replace(/^[\s:：.\-–—]+/, "").trim();
      if (!s) continue;
      fromHeader = true;
    }
    const lb = labelOf(s);
    if (lb) {
      if (lb.kind === "title") { if (lb.rest) { R.title = speakable(lb.rest).replace(/[.!?]+$/, ""); R.titleExplicit = !!R.title; } block = null; R.dropped++; continue; }
      if (lb.kind === "hint") { if (lb.rest) { addHint(lb.rest); block = null; } else block = "hint"; R.dropped++; continue; }
      if (lb.kind === "meta") { block = lb.rest ? null : "meta"; R.dropped++; continue; }
      if (block === "meta" && !REAL_SPEECH.test(lb.key)) { R.dropped++; continue; }
      block = null; if (lb.rest) speak("Narator", lb.rest); else R.dropped++;
      continue;
    }
    const m = s.match(/^([^:：]{1,24}?)\s*[:：]\s*(.+)$/);
    if (m && validSpeaker(m[1])) { block = null; speak(normSpeaker(m[1]), m[2]); continue; }
    if (block) { if (block === "hint") addHint(s); R.dropped++; continue; }
    if (fromHeader) { addHint(s); continue; }
    if (/^[\[(].*[\])]$/.test(s)) { addHint(s.slice(1, -1)); R.dropped++; continue; }
    if (bullet && (R.marked || /^(visual|kamera)/i.test(s))) { addHint(s); R.dropped++; continue; }
    speak("Narator", s);
  }
  pushScene();
  return R;
}

/* ---- Inferensi adegan dari catatan visual + narasi ---- */
const CAMS = ["zoom_in", "pan_right", "drift_up", "zoom_out", "pan_left"];
const TENSE_RE = /petir|bahaya|takut|ancam|mencekam|darurat|krisis|tiba-tiba|menegangkan|panik|gelap gulita|teriak/;
const TIME_EN = { pagi: "soft morning golden light", siang: "bright clear daylight", sore: "warm sunset glow", malam: "calm night with soft moonlight" };
const LOC_RULES = [[/warung|toko|kios|kedai/, "warung kecil di pinggir jalan"], [/pasar|dagang|pedagang/, "pasar tradisional"], [/sekolah|kelas|guru|murid/, "ruang kelas sekolah"], [/sawah|padi|ladang/, "hamparan sawah"], [/pantai|laut/, "pantai"], [/sungai|danau/, "tepi sungai"], [/hutan|gunung/, "hutan pegunungan"], [/kota|gedung|jalan raya|macet|kantor/, "jalan kota"], [/dapur|masak/, "dapur rumah"], [/ruang keluarga|ruang tamu|sofa/, "ruang keluarga hangat"], [/kamar|tidur/, "kamar tidur"], [/rumah|teras|halaman|keluarga/, "halaman rumah kayu"], [/taman|kebun/, "taman & kebun"]];
function inferLoc(txt) { for (const [re, v] of LOC_RULES) if (re.test(txt)) return v; return ""; }
function inferTime(txt) {
  if (/malam|gelap|bulan\b|bintang|lampu jalan/.test(txt)) return "malam";
  if (/sore|senja|petang|terbenam/.test(txt)) return "sore";
  if (/siang|terik|tengah hari/.test(txt)) return "siang";
  if (/pagi|subuh|fajar|sarapan|matahari terbit/.test(txt)) return "pagi";
  return "";
}
function inferEmotion(t) {
  t = String(t).toLowerCase();
  if (/tiba-tiba|astaga|kaget|terkejut|hah\b/.test(t)) return "kaget";
  if (/marah|kesal|jengkel|bentak|keterlaluan/.test(t)) return "marah";
  if (/sedih|menangis|kehilangan|rindu|kecewa|air mata/.test(t)) return "sedih";
  if (/senang|bahagia|hore|yeay|\bwah\b|asyik|gembira|bangga|tertawa|alhamdulillah|!\s*$/.test(t)) return "senang";
  return "normal";
}
function pickModes(p) {
  const pref = (p.options && p.options.visualMode) || "auto", out = [];
  p.scenes.forEach((sc, i) => {
    const tot = Math.max(1, sc.lines.length), spk = sc.lines.filter((l) => !isNarr(l.speaker)).length;
    let m;
    if (!sc.present.length || pref === "objek") m = "object";
    else if (pref === "karakter") m = "char";
    else if (pref === "campur") m = "mixed";
    else m = spk / tot >= 0.7 ? "char" : "mixed";
    if (pref === "auto" && m === "char" && out[i - 1] === "char" && out[i - 2] === "char") m = "mixed";
    out.push(m); sc.mode = m;
  });
}
function enrichProject(p, hintsFor) {
  let pt = "pagi", pl = "halaman rumah kayu";
  p.scenes.forEach((sc, i) => {
    const hint = String((hintsFor && hintsFor[i]) || sc.hint || ""), hl = hint.toLowerCase(), ll = sc.lines.map((l) => l.text).join(" ").toLowerCase();
    sc.hint = hint; sc.id = i + 1;
    sc.time = inferTime(hl) || inferTime(ll) || (SKY[sc.time] ? sc.time : pt);
    sc.location = inferLoc(hl) || sc.location || inferLoc(ll) || pl;
    pt = sc.time; pl = sc.location;
    sc.lines.forEach((l) => { if (!l.emotion || l.emotion === "normal") l.emotion = inferEmotion(l.text); });
    sc.tension = TENSE_RE.test(ll + " " + hl) || sc.lines.some((l) => l.emotion === "kaget" || l.emotion === "marah");
    sc.rain = /hujan|gerimis|badai/.test(ll + " " + hl);
    sc.camera = sc.tension ? "push" : CAMS[i % CAMS.length];
    sc.seed = sc.seed || 1000 + i * 137; sc.emoji = sc.emoji || ["🌅", "🚶", "🏡", "🌿"][i % 4];
    const names = []; sc.lines.forEach((l) => { if (!isNarr(l.speaker) && !names.some((n) => castKey(n) === castKey(l.speaker))) names.push(l.speaker); });
    sc.present = names.slice(0, 5);
    const pr = detectStoryProps(`${sc.location} ${hl} ${ll}`);
    sc.imagePrompt = `${sc.location}, ${TIME_EN[sc.time]}, ${pr.en}${hint ? ", " + hint.slice(0, 140) : ""}, wide establishing shot, environment and props only, no people, no text`;
  });
  pickModes(p);
  return p;
}

/* Bersihkan hasil /api/plan dari LLM agar label teknis tidak lolos ke suara/subtitle. */
function sanitizeProject(p) {
  p.scenes = (p.scenes || []).map((sc) => {
    const lines = [];
    (sc.lines || []).forEach((l) => {
      let sp = String(l.speaker || "Narator").replace(/\*\*/g, "").trim(), tx = String(l.text || "").replace(/\*\*/g, "").trim();
      if (SCENE_RE.test(tx) && tx.length < 60) return;
      if (SCENE_RE.test(sp)) return;
      const a = labelOf(tx);
      if (a && a.kind !== "spoken") return;
      if (a && a.kind === "spoken") tx = a.rest;
      const b = labelOf(sp + ":");
      if (b && b.kind !== "spoken") return;
      sp = b && b.kind === "spoken" ? "Narator" : normSpeaker(sp);
      if (!isNarr(sp) && !validSpeaker(sp)) sp = "Narator";
      tx = speakable(tx.replace(INLINE_RE, ""));
      if (tx) lines.push({ ...l, speaker: sp, text: tx });
    });
    return { ...sc, lines };
  }).filter((sc) => sc.lines.length);
  const names = new Map();
  p.scenes.forEach((sc) => sc.lines.forEach((l) => { if (!isNarr(l.speaker) && !names.has(castKey(l.speaker))) names.set(castKey(l.speaker), l.speaker); }));
  const old = new Map((p.characters || []).map((c) => [castKey(c.name), c]));
  p.characters = [...names].map(([k, n], i) => old.get(k) || makeChar(n, i));
  if (!p.options) p.options = {};
  return p;
}

const projectToScript = (p) => p.scenes.map((sc) => sc.lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")).join("\n");
const hintsJoin = (hs) => hs.map((h) => h.text).join(". ");

function parseScriptToProject(rawScript, opts) {
  const P = parseNaskah(rawScript), maxScenes = clamp(Number(opts.maxScenes) || 8, 2, 24);
  let groups = [];
  if (P.marked && P.scenes.length) {
    groups = P.scenes.map((sc, i) => ({ lines: sc.lines.slice(), hint: hintsJoin(P.hints.filter((h) => h.scene === i)) }));
    while (groups.length > 24) { const b = groups.pop(); groups[groups.length - 1].lines.push(...b.lines); }
  } else {
    const flat = P.scenes.flatMap((sc) => sc.lines), per = Math.max(1, Math.ceil(flat.length / maxScenes));
    for (let a = 0; a < flat.length; a += per) groups.push({ lines: flat.slice(a, a + per), hint: hintsJoin(P.hints.filter((h) => h.at >= a && h.at < a + per)) });
  }
  if (P.dropped) log(`Pembersih naskah: ${P.dropped} baris label/arahan teknis dibuang dari suara & subtitle.`);
  const project = {
    title: P.title || "Cerita Video", titleExplicit: P.titleExplicit, genre: opts.genre || "anak", moral: "",
    characters: [],
    scenes: groups.filter((g) => g.lines.length).map((g, i) => ({ id: i + 1, location: "", time: "", hint: g.hint, lines: g.lines.map((l) => ({ speaker: l.speaker, text: l.text, emotion: "normal" })) })),
    options: { ...opts, targetSec: Math.max(30, Number(opts.targetSec) || 120) },
  };
  sanitizeProject(project);
  return enrichProject(project);
}

function readOptions() {
  return {
    style: $("style").value, lang: $("lang").value, ratio: $("ratio").value,
    maxScenes: Number($("maxScenes").value), targetSec: Number($("targetSec").value),
    musicUrl: $("musicUrl").value.trim(), genre: $("genre").value,
    visualMode: ($("visualMode") && $("visualMode").value) || "auto",
    motion: ($("motion") && $("motion").value) || "sedang",
  };
}

async function fetchImage(scene, seedOffset) {
  if (!baseUrl()) throw new Error("Mode latar prosedural lokal aktif.");
  const { w, h } = dims(state.project.options.ratio);
  const q = new URLSearchParams({ prompt: scene.imagePrompt, seed: String(scene.seed + seedOffset), w: String(w), h: String(h), model: ($("imageModel") && $("imageModel").value) || "flux", style: (state.project.options && state.project.options.style) || $("style").value });
  const r = await request(`/api/image?${q}`, { binary: true, attempts: 1 }, 90000);
  return { bmp: await createImageBitmap(new Blob([r.buf], { type: r.type || "image/jpeg" })), source: r.source };
}

const STEPS = [
  async () => {
    const script = $("script").value.trim();
    if (script.length < 20) throw new Error("Naskah terlalu pendek. Tulis minimal 20 karakter.");
    const opts = { ...readOptions(), known: knownCharacters() };
    // Selalu bersihkan lokal dulu: hanya narasi/dialog murni yang boleh diproses & dibacakan.
    const parsed = parseScriptToProject(script, opts);
    const spokenChars = parsed.scenes.reduce((n, sc) => n + sc.lines.reduce((m, l) => m + l.text.length, 0), 0);
    if (spokenChars < 10) throw new Error("Tidak ada teks narasi/dialog yang bisa dibacakan. Pastikan naskah berisi kalimat narasi (mis. \"Narator: ...\"), bukan hanya label/arahan.");
    if (baseUrl()) {
      try {
        const d = await request("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: projectToScript(parsed), options: opts }), attempts: 2 }, 120000);
        const p = d.project; p.options = { ...(p.options || {}), ...opts };
        sanitizeProject(p);
        if (!p.scenes.length) throw new Error("rencana kosong setelah dibersihkan");
        state.project = enrichProject(p, parsed.scenes.length === p.scenes.length ? parsed.scenes.map((x) => x.hint) : null);
        state.project.title = state.project.title || parsed.title; state.project.titleExplicit = parsed.titleExplicit; if (parsed.titleExplicit) state.project.title = parsed.title;
      } catch (err) {
        log(`Menyusun cerita lokal otomatis (${err.message}).`);
        state.project = parsed;
      }
    } else {
      log("Menyusun naskah & storytelling secara lokal (tanpa Worker).");
      state.project = parsed;
    }
    renderStoryDirector(state.project);
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
    return ok ? `${ok} latar AI + ornamen dunia nyata` : "latar kanvas + ornamen dunia nyata";
  },
  async () => {
    const scenes = state.project.scenes, total = scenes.reduce((a, s) => a + s.lines.length, 0); let done = 0;
    const fallbackProfile = state.cast.narator || Object.values(state.cast)[0];
    for (const s of scenes) {
      for (let li = 0; li < s.lines.length; li++) {
        const key = `${s.id}:${li}`; done++; setStep("voice", "run", `suara ${done}/${total}`);
        if (state.audio[key]) continue;
        const ln = s.lines[li];
        state.audio[key] = await makeLine(state.cast[castKey(ln.speaker)] || fallbackProfile, ln.text);
      }
    }
    return "suara siap";
  },
  async () => {
    const url = state.project.options.musicUrl;
    if (!url || !baseUrl()) return "musik adaptif & SFX aktif";
    try {
      const r = await request(`/api/fetch?${new URLSearchParams({ url })}`, { binary: true, attempts: 2 }, 60000);
      state.music = await ensureAC().decodeAudioData(r.buf.slice(0));
      return "musik & SFX aktif";
    } catch (e) { return "musik adaptif & SFX aktif"; }
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


function pickMime() {
  const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return null;
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
}

/* =====================================================================
 *  MESIN STORY MOTION BERLAPIS
 *  Lapisan: latar (parallax 0.35) → midground (0.65) → cahaya/atmosfer →
 *  objek naratif + karakter (1.0) → partikel foreground (1.5) → vinyet →
 *  judul/transisi → subtitle. Kamera: zoom, pan, drift, push + micro-shake.
 * ===================================================================== */
const MOTION_K = { halus: 0.6, sedang: 1, dinamis: 1.5 };
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const frac1 = (v) => ((v % 1) + 1) % 1;

function cameraFor(g, cur, t, T) {
  const { W, H, k } = g, e = easeInOutCubic(clamp(t / cur.dur, 0, 1));
  let z = 1.02, x = 0, y = 0;
  switch (cur.s.camera) {
    case "zoom_in": z = 1.02 + 0.11 * k * e; break;
    case "zoom_out": z = 1.02 + 0.11 * k * (1 - e); break;
    case "pan_right": z = 1.07 + 0.02 * k; x = lerp(-1, 1, e) * W * 0.035 * k; break;
    case "pan_left": z = 1.07 + 0.02 * k; x = lerp(1, -1, e) * W * 0.035 * k; break;
    case "drift_up": z = 1.06 + 0.03 * k * e; y = lerp(0.02, -0.025, e) * H * k; break;
    default: z = 1.03 + 0.14 * k * e * e;
  }
  z *= 1 + 0.004 * Math.sin(T * 0.9);
  if (cur.tension) { const a = 0.0035 * W * k; x += (Math.sin(T * 37) + Math.sin(T * 23.3)) * 0.5 * a; y += (Math.sin(T * 29.1) + Math.sin(T * 41)) * 0.5 * a; z += 0.012 * Math.sin(T * 5.5); }
  return { z, x, y };
}
function layer(g, c, f, extra, fn) {
  const { ctx, W, H } = g, z = (1 + (c.z - 1) * (0.55 + 0.45 * f)) * extra;
  ctx.save(); ctx.translate(W / 2 + c.x * f, H / 2 + c.y * f); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); fn(); ctx.restore();
}

function drawMist(g, T) {
  const { ctx, W, H, groundY } = g, y = groundY - H * 0.12, gr = ctx.createLinearGradient(0, y - H * 0.08, 0, y + H * 0.1);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${0.1 + 0.04 * Math.sin(T * 0.5)})`); gr.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gr; ctx.fillRect(-W * 0.1, y - H * 0.08, W * 1.2, H * 0.18);
}
function drawMid(g, s, T) {
  const { ctx, W, H, groundY } = g, kind = bgKind(s.location), hz = groundY - H * 0.1, night = s.time === "malam";
  const tint = night ? "20,30,70" : s.time === "sore" ? "90,50,90" : "40,90,70";
  if (kind === "indoor" || kind === "classroom" || kind === "mansion") return;
  ctx.save();
  if (kind === "street" || kind === "market") {
    for (let i = 0; i < 9; i++) {
      const bw = W * (0.09 + rnd(i) * 0.08), bh = H * (0.1 + rnd(i + 20) * 0.14), bx = (frac1(i * 0.14 + T * 0.004 + 0.1) * 1.2 - 0.1) * W;
      ctx.fillStyle = `rgba(${tint},0.55)`; ctx.fillRect(bx, hz - bh, bw, bh);
      if (night) { ctx.fillStyle = "rgba(255,225,140,0.75)"; for (let k = 0; k < 3; k++) ctx.fillRect(bx + bw * 0.2, hz - bh + bh * (0.15 + k * 0.28), bw * 0.18, bh * 0.1); }
    }
  } else {
    for (let b = 0; b < 2; b++) {
      ctx.fillStyle = `rgba(${tint},${0.32 + b * 0.18})`; ctx.beginPath(); ctx.moveTo(0, hz);
      for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, hz - H * (0.025 + b * 0.02) * (1.2 + Math.sin((x / W) * 5 + b * 2 + T * 0.05)));
      ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    }
    for (let i = 0; i < 7; i++) {
      const tx = (frac1(i / 7 + rnd(i + 3) * 0.1 + T * 0.003 + 0.05) * 1.1 - 0.05) * W, th = H * (0.05 + rnd(i) * 0.05);
      ctx.fillStyle = `rgba(${tint},0.7)`; ctx.fillRect(tx - 2, hz - th * 0.4, 4, th * 0.5); ctx.beginPath(); ctx.arc(tx, hz - th * 0.55, th * 0.42, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawTint(g, s, T) {
  const { ctx, W, H } = g, tm = s.time;
  if (tm === "malam") { ctx.fillStyle = "rgba(12,20,70,0.30)"; ctx.fillRect(0, 0, W, H); }
  else if (tm === "sore") { const gr = ctx.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "rgba(255,140,70,0.26)"); gr.addColorStop(1, "rgba(110,60,150,0.22)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
  else if (tm === "pagi") { const gr = ctx.createLinearGradient(0, 0, W * 0.7, H * 0.8); gr.addColorStop(0, "rgba(255,214,150,0.24)"); gr.addColorStop(0.6, "rgba(255,214,150,0)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
  if (tm === "pagi" || tm === "sore") {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const a = 0.05 + 0.025 * Math.sin(T * 0.7 + i * 2), x0 = W * (0.1 + i * 0.28) + Math.sin(T * 0.2 + i) * W * 0.03;
      ctx.fillStyle = `rgba(255,220,160,${a})`; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + W * 0.1, 0); ctx.lineTo(x0 + W * 0.38, H); ctx.lineTo(x0 + W * 0.18, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
function drawVignette(g, s) {
  const { ctx, W, H } = g, v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${s.tension ? 0.55 : 0.4})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function drawParticles(g, s, T) {
  const { ctx, W, H } = g, n = s.rain ? 60 : 22;
  ctx.save();
  for (let i = 0; i < n; i++) {
    if (s.rain) {
      const x = frac1(rnd(i) + T * 0.04) * W, y = frac1(rnd(i + 3) + T * (0.9 + rnd(i + 5))) * H;
      ctx.strokeStyle = "rgba(200,220,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + H * 0.03); ctx.stroke(); continue;
    }
    const sp = 0.012 + rnd(i + 7) * 0.02, x = frac1(rnd(i) + Math.sin(T * 0.3 + i) * 0.03 + T * sp * 0.5) * W, y = (1 - frac1(rnd(i + 3) + T * sp)) * H, r = (1.5 + rnd(i + 9) * 3.5) * (W > H ? 1.2 : 1);
    if (s.time === "malam") { ctx.fillStyle = `rgba(255,240,140,${0.25 + 0.65 * Math.max(0, Math.sin(T * 1.6 + i * 2.1))})`; ctx.shadowColor = "#ffe98a"; ctx.shadowBlur = 12; }
    else ctx.fillStyle = s.time === "sore" ? "rgba(255,200,130,0.5)" : "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ---- Ikon objek naratif (kotak 100×100, pusat 0,0) ---- */
function drawIcon(ctx, type, T) {
  const ga = ctx.globalAlpha;
  const fill = (c) => { ctx.fillStyle = c; ctx.fill(); }, line = (c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); };
  const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
  const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (type === "coin") { ctx.save(); ctx.scale(0.55 + 0.45 * Math.abs(Math.cos(T * 1.8)), 1); circ(0, 0, 40); fill("#ffcf33"); line("#b5851a", 6); circ(0, 0, 27); line("#e8a91f", 4); ctx.fillStyle = "#a8760f"; ctx.font = `800 30px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Rp", 0, 2); ctx.restore(); }
  else if (type === "house") { ctx.fillStyle = "#f2d7a8"; ctx.fillRect(-32, -4, 64, 46); poly([[-44, -2], [0, -44], [44, -2]]); fill("#c4553f"); ctx.fillStyle = "#8c5d32"; ctx.fillRect(-8, 16, 16, 26); ctx.fillStyle = "#9fd3ff"; ctx.fillRect(14, 8, 12, 12); ctx.fillRect(-26, 8, 12, 12); ctx.fillStyle = "#a84a37"; ctx.fillRect(18, -36, 9, 18); }
  else if (type === "tree") { ctx.save(); ctx.rotate(Math.sin(T * 1.3) * 0.025); ctx.fillStyle = "#8c5d32"; ctx.fillRect(-6, 6, 12, 38); circ(0, -14, 30); fill("#3ca356"); circ(-20, 4, 20); fill("#2f9448"); circ(20, 4, 20); fill("#2f9448"); ctx.restore(); }
  else if (type === "flower") {
    ctx.save(); ctx.translate(0, 30); ctx.rotate(Math.sin(T * 1.6) * 0.04); ctx.translate(0, -30);
    ctx.strokeStyle = "#2f8545"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -8); ctx.stroke();
    for (let a = 0; a < 6; a++) { const q = (a * Math.PI * 2) / 6 + T * 0.3; circ(Math.cos(q) * 15, -22 + Math.sin(q) * 15, 11); fill("#ff7597"); }
    circ(0, -22, 9); fill("#ffd43b"); ctx.restore(); poly([[-20, 24], [20, 24], [15, 46], [-15, 46]]); fill("#c96a44");
  }
  else if (type === "cup") {
    poly([[-30, -8], [30, -8], [24, 38], [-24, 38]]); fill("#fff7ea"); line("#caa97b", 4); ctx.beginPath(); ctx.arc(32, 14, 14, -1.3, 1.3); line("#caa97b", 6);
    ctx.fillStyle = "#6b3f2a"; ctx.beginPath(); ctx.ellipse(0, -8, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 2; k++) { const ph = T * 2 + k * 2; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10 + k * 20, -18); ctx.bezierCurveTo(-18 + k * 20 + Math.sin(ph) * 6, -30, -2 + k * 20 + Math.sin(ph) * 6, -38, -10 + k * 20, -52); ctx.stroke(); }
  }
  else if (type === "book") { ctx.fillStyle = "#3c5a99"; ctx.fillRect(-50, -34, 100, 68); poly([[-46, -28], [-2, -24], [-2, 30], [-46, 32]]); fill("#fff7e0"); poly([[46, -28], [2, -24], [2, 30], [46, 32]]); fill("#fffaf0"); ctx.strokeStyle = "#c9b896"; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-38, -14 + k * 11); ctx.lineTo(-10, -12 + k * 11); ctx.moveTo(10, -12 + k * 11); ctx.lineTo(38, -14 + k * 11); ctx.stroke(); } }
  else if (type === "heart") { ctx.save(); const k = 1 + 0.07 * Math.sin(T * 5); ctx.scale(k, k); ctx.beginPath(); ctx.moveTo(0, 38); ctx.bezierCurveTo(-64, -4, -34, -52, 0, -20); ctx.bezierCurveTo(34, -52, 64, -4, 0, 38); fill("#ff5d7d"); line("#c63a5a", 5); ctx.restore(); }
  else if (type === "star") { ctx.save(); ctx.rotate(Math.sin(T * 0.8) * 0.15); const pts = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 18 : 44, a = -Math.PI / 2 + (k * Math.PI) / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } poly(pts); fill("#ffd23f"); line("#d9a300", 5); ctx.restore(); }
  else if (type === "sun") { ctx.save(); ctx.rotate(T * 0.25); ctx.strokeStyle = "#ffb703"; ctx.lineWidth = 7; for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48); ctx.stroke(); } ctx.restore(); circ(0, 0, 26); fill("#ffc933"); }
  else if (type === "moon") {
    ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, 120, 120); ctx.arc(18, -10, 32, 0, Math.PI * 2); ctx.clip("evenodd"); circ(0, 0, 38); fill("#fff3b0"); ctx.restore();
    [[30, -30, 4], [40, 10, 3], [24, 30, 3]].forEach(([x, y, r], k) => { ctx.globalAlpha = ga * (0.5 + 0.5 * Math.sin(T * 2 + k * 2)); circ(x, y, r); fill("#fff"); });
  }
  else if (type === "cloud") {
    ctx.save(); ctx.translate(Math.sin(T * 0.8) * 5, 0); circ(-20, 6, 20); fill("#eef4ff"); circ(6, -8, 28); fill("#f7faff"); circ(30, 8, 18); fill("#eef4ff"); ctx.fillStyle = "#eef4ff"; ctx.fillRect(-22, 6, 54, 20); ctx.restore();
    ctx.strokeStyle = "rgba(120,170,255,0.8)"; ctx.lineWidth = 4; for (let k = 0; k < 3; k++) { const y = 30 + ((T * 40 + k * 14) % 30); ctx.beginPath(); ctx.moveTo(-14 + k * 16, y); ctx.lineTo(-18 + k * 16, y + 10); ctx.stroke(); }
  }
  else if (type === "basket") { circ(-12, -18, 13); fill("#e63946"); circ(14, -20, 13); fill("#80c342"); ctx.beginPath(); ctx.arc(0, -6, 34, Math.PI, 0); line("#9a6a3a", 6); poly([[-42, -4], [42, -4], [32, 38], [-32, 38]]); fill("#c98a4b"); ctx.strokeStyle = "#9a6a3a"; ctx.lineWidth = 3; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 16, -4); ctx.lineTo(k * 12, 38); ctx.stroke(); } }
  else if (type === "bulb") { ctx.save(); ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 20 + 10 * Math.sin(T * 3); circ(0, -10, 28); fill("#ffe066"); ctx.restore(); ctx.fillStyle = "#9aa5b1"; ctx.fillRect(-12, 16, 24, 8); ctx.fillRect(-9, 26, 18, 8); ctx.strokeStyle = "#d9a300"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-4, -6); ctx.lineTo(4, 6); ctx.lineTo(8, -8); ctx.stroke(); }
  else if (type === "clock") {
    circ(0, 0, 42); fill("#fff"); line("#334155", 6); ctx.strokeStyle = "#334155"; ctx.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.lineTo(Math.cos(a) * 39, Math.sin(a) * 39); ctx.stroke(); }
    const m = T * 1.2, h = m / 12; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(h) * 18, -Math.cos(h) * 18); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = "#ff8c1a"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(m) * 30, -Math.cos(m) * 30); ctx.stroke();
  }
  else { ctx.save(); ctx.translate(0, -(Math.sin(T * 2) + 1) * 2); ctx.beginPath(); ctx.moveTo(-34, 26); ctx.lineTo(-10, 2); ctx.lineTo(4, 14); ctx.lineTo(32, -18); line("#36d399", 10); poly([[40, -30], [40, -2], [12, -30]]); fill("#36d399"); ctx.restore(); }
  ctx.globalAlpha = ga;
}

const OBJ_RULES = [
  ["coin", ["uang", "rupiah", "koin", "duit", "gaji", "harga", "mahal", "murah", "belanja", "tabung", "nabung", "hemat", "dompet", "inflasi", "bayar", "biaya", "untung"]],
  ["house", ["rumah", "keluarga", "pulang", "teras", "halaman"]],
  ["tree", ["pohon", "hutan", "kebun", "daun", "desa", "alam"]],
  ["flower", ["bunga", "melati", "mawar", "taman", "tanaman", "pot"]],
  ["cup", ["kopi", "teh", "susu", "minum", "sarapan", "warung", "makan", "roti"]],
  ["book", ["buku", "belajar", "sekolah", "baca", "ilmu", "pintar", "guru"]],
  ["heart", ["sayang", "cinta", "kasih", "peduli", "hangat", "kebersamaan", "rindu", "hati"]],
  ["star", ["mimpi", "cita", "bintang", "harapan", "sukses", "bangga", "juara", "hebat"]],
  ["sun", ["pagi", "matahari", "cerah", "semangat", "terang"]],
  ["moon", ["malam", "bulan", "tidur", "sunyi", "lelap"]],
  ["cloud", ["hujan", "awan", "mendung", "angin", "langit"]],
  ["basket", ["pasar", "keranjang", "dagang", "jual", "beli", "toko"]],
  ["bulb", ["ide", "gagasan", "pikir", "solusi", "rencana", "rahasia"]],
  ["clock", ["waktu", "jam", "menit", "detik", "terlambat", "buru"]],
  ["arrow", ["langkah", "maju", "naik", "tumbuh", "berkembang", "berubah", "bangkit", "usaha", "kerja", "perjalanan"]],
];
function matchObject(word) {
  const w = String(word).toLowerCase().replace(/[^\p{L}]/gu, "");
  if (w.length < 3) return null;
  for (const [type, stems] of OBJ_RULES) if (stems.some((s) => w === s || (s.length >= 4 && w.startsWith(s)) || (s.length >= 5 && w.includes(s)))) return type;
  return null;
}
/* Objek muncul tepat saat kata kuncinya diucapkan (waktu kata dari wordTimes). */
function computeObjs(s, lines, enter) {
  const objs = [], seen = new Set();
  lines.forEach((L) => L.words.forEach((w, wi) => {
    if (objs.length >= 6) return;
    const ty = matchObject(w); if (!ty || seen.has(ty)) return; seen.add(ty);
    const lb = w.replace(/[^\p{L}\p{N}-]/gu, "");
    objs.push({ type: ty, label: lb ? lb[0].toUpperCase() + lb.slice(1) : "", t0: Math.max(0.2, L.start + (L.times[wi] || 0) - 0.08) });
  }));
  if (!objs.length) {
    const ty = s.time === "malam" ? "moon" : s.time === "pagi" ? "sun" : ({ indoor: "house", classroom: "book", paddy: "tree", market: "basket", beach: "sun", forest: "tree", street: "clock", mansion: "house" }[bgKind(s.location)] || "sun");
    objs.push({ type: ty, label: "", t0: enter * 0.5 });
  }
  return objs;
}
function drawObjects(g, cur, t, T) {
  const { ctx, W, H } = g, vis = cur.objs.filter((o) => t >= o.t0).slice(-5);
  if (!vis.length) return;
  const cfg = { object: { y: 0.4, k: 1 }, mixed: { y: 0.27, k: 0.62 }, char: { y: 0.16, k: 0.34 } }[cur.mode] || { y: 0.4, k: 1 };
  const base = Math.min(W, H) * 0.0046 * cfg.k, small = Math.min(W, H) * 0.0021 * (cur.mode === "char" ? 1.3 : 1), hx = W / 2, hy = H * cfg.y, rowY = H * (cur.mode === "object" ? 0.12 : 0.08);
  vis.forEach((o, n) => {
    const age = t - o.t0, pop = easeOutBack(clamp(age / 0.55, 0, 1)), next = vis[n + 1], q = next ? easeInOutCubic(clamp((t - next.t0) / 0.6, 0, 1)) : 0;
    const x = lerp(hx, W * (0.14 + n * 0.15), q), y = lerp(hy, rowY, q) + Math.sin(T * 1.4 + n) * H * 0.006, sc = lerp(base, small, q) * pop;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.globalAlpha = q > 0 ? 0.88 : 1;
    if (!next) {
      const gr = ctx.createRadialGradient(0, 0, 6, 0, 0, 80); gr.addColorStop(0, "rgba(255,226,150,0.38)"); gr.addColorStop(1, "rgba(255,226,150,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
      if (age < 0.7) { ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - age / 0.7)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 46 + age * 120, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14;
    drawIcon(ctx, o.type, T + n);
    ctx.restore();
    if (!next && o.label && cur.mode !== "char") {
      const fs = Math.round(Math.min(W, H) * 0.05);
      ctx.save(); ctx.globalAlpha = clamp(age / 0.4, 0, 1); ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10; ctx.fillStyle = "#fff"; ctx.fillText(o.label, x, y + 66 * sc + fs * 0.4);
      ctx.shadowBlur = 0; ctx.fillStyle = ACCENT; const lw = ctx.measureText(o.label).width * clamp(age / 0.6, 0, 1); ctx.fillRect(x - lw / 2, y + 66 * sc + fs * 1.05, lw, 4);
      ctx.restore();
    }
  });
}

/* ---- Karakter: tampil selektif sesuai mode adegan ---- */
function charVis(ch, t) {
  let v = 0;
  for (const w of ch.wins || []) v = Math.max(v, clamp(Math.min((t - w[0]) / 0.45, (w[1] - t) / 0.45), 0, 1));
  return easeInOutCubic(v);
}
function drawCharacters(g, cur, t, T, active) {
  const { ctx, W, H } = g, mixed = cur.mode === "mixed", spKey = active ? castKey(active.ln.speaker) : null, WALK_IN = 1.1, items = [];
  cur.chars.forEach((ch) => {
    const speaking = ch.key === spKey; let x = ch.slotX, face = ch.face, P, vis = 1;
    if (mixed) {
      vis = charVis(ch, t); if (vis < 0.02) return;
      const side = ch.slotX <= W / 2 ? -1 : 1; x += side * (1 - vis) * W * 0.16;
      if (vis < 0.97) { P = computePose("walk", "normal", T); face = -side; }
      else P = speaking ? computePose("talk", active.ln.emotion, T) : computePose("idle", "normal", T + ch.phase);
    } else if (ch.enter && t < WALK_IN) {
      const sx = ch.slotX <= W / 2 ? -W * 0.14 : W * 1.14;
      x = lerp(sx, ch.slotX, easeInOutCubic(t / WALK_IN)); face = sx < ch.slotX ? 1 : -1; P = computePose("walk", "normal", T);
    } else if (speaking) { const m = locomotionOffset(ch, T, W); x += m.off * 0.35; P = computePose("talk", active.ln.emotion, T); }
    else { const m = locomotionOffset(ch, T, W); x += m.off; if (m.moving) face = m.off >= 0 ? 1 : -1; P = m.moving ? computePose("walk", "normal", T * 0.75 + ch.phase) : computePose("idle", "normal", T + ch.phase); }
    items.push({ ch, speaking, x, y: g.groundY + ch.depth * ch.H * 0.045, face, P, vis });
  });
  items.sort((a, b) => a.y - b.y);
  const tfs = Math.max(18, Math.round(H * (W > H ? 0.038 : 0.025)));
  items.forEach((it) => {
    const hh = it.ch.H * (mixed ? 0.88 : 1);
    ctx.save(); ctx.globalAlpha = it.vis;
    ctx.fillStyle = "rgba(0,0,0,0.24)"; ctx.beginPath(); ctx.ellipse(it.x, it.y + 4, hh * 0.2, hh * 0.032, 0, 0, Math.PI * 2); ctx.fill();
    const pos = drawPerson(ctx, { x: it.x, y: it.y, H: hh, face: it.face, look: it.ch.look, kind: it.ch.kind, P: it.P, mouth: it.speaking ? g.mouth : 0, t: T, phase: it.ch.phase, sty: g.sty });
    if (!mixed || it.speaking) drawNameTag(ctx, { name: it.ch.name, color: it.ch.color, x: pos.x, y: pos.y }, tfs, it.speaking);
    ctx.restore();
  });
}

function drawTitle(g, t) {
  if (!g.title || t > 2.6) return;
  const { ctx, W, H } = g, a = clamp(Math.min(t / 0.5, (2.6 - t) / 0.5), 0, 1), fs = Math.round(H * (W > H ? 0.06 : 0.036)), gap = fs * 0.3;
  ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const lines = layoutWords(ctx, g.title.split(/\s+/), W * 0.84, gap), lh = fs * 1.3, y0 = H * 0.13 + (1 - a) * 14;
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 14; ctx.fillStyle = "#fff";
  lines.forEach((ln, li) => { let x = (W - ln.width) / 2; ln.items.forEach((it) => { ctx.fillText(it.word, x, y0 + li * lh); x += it.w + gap; }); });
  ctx.shadowBlur = 0; ctx.fillStyle = ACCENT; ctx.fillRect(W / 2 - W * 0.12 * a, y0 + lines.length * lh - lh * 0.25, W * 0.24 * a, 5);
  ctx.restore();
}
function drawTransition(g, i, t) {
  const { ctx, W, H } = g, d = i === 0 ? 0.9 : 0.55; if (t >= d) return;
  const p = t / d;
  if (i === 0) { ctx.fillStyle = `rgba(0,0,0,${1 - easeInOutCubic(p)})`; ctx.fillRect(0, 0, W, H); return; }
  const k = i % 3;
  if (k === 0) { ctx.fillStyle = `rgba(8,6,14,${1 - easeInOutCubic(p)})`; ctx.fillRect(0, 0, W, H); }
  else if (k === 1) { const x = W * easeInOutCubic(p); ctx.fillStyle = "rgba(8,6,14,0.96)"; ctx.fillRect(x, 0, W - x, H); ctx.fillStyle = ACCENT; ctx.fillRect(x - 4, 0, 4, H); }
  else { ctx.fillStyle = `rgba(255,248,235,${(1 - p) * 0.8})`; ctx.fillRect(0, 0, W, H); }
}

/* ---- Sinkronisasi subtitle: batas bicara nyata dari buffer audio ---- */
function analyzeSpeech(a) {
  if (a.lead !== undefined) return;
  a.lead = 0; a.tail = 0; if (a.silent || !a.buf) return;
  const d = a.buf.getChannelData(0), sr = a.buf.sampleRate, th = 0.02; let f = 0, l = d.length - 1;
  while (f < d.length && Math.abs(d[f]) < th) f += 16;
  while (l > f && Math.abs(d[l]) < th) l -= 16;
  a.lead = clamp(f / sr - 0.03, 0, 1.2); a.tail = clamp((d.length - l) / sr - 0.05, 0, 1.2);
}
function wordTimes(words, end, lead) {
  const wt = words.map((x) => Math.max(1, (x.toLowerCase().match(/[aeiou]/g) || []).length) + (/[,;:]$/.test(x) ? 1.2 : /[.!?…]$/.test(x) ? 2.4 : 0));
  const sum = wt.reduce((a, b) => a + b, 0) || 1; let acc = 0;
  return wt.map((x) => { const st = lead + (acc / sum) * Math.max(0.25, end - lead); acc += x; return st; });
}

function buildTimeline(project) {
  const { w: W, h: H } = dims(project.options.ratio), BASEGAP = 0.28;
  const info = project.scenes.map((s) => s.lines.map((ln, li) => {
    const a = state.audio[`${s.id}:${li}`] || null, rate = a ? Math.pow(2, a.detune / 1200) : 1, words = ln.text.split(/\s+/).filter(Boolean);
    if (a) analyzeSpeech(a);
    const dur = a ? a.buf.duration / rate : Math.max(1.8, words.length / 2.3 + 0.5);
    return { a, rate, words, dur, lead: a ? (a.lead || 0) / rate : 0, tail: a ? (a.tail || 0) / rate : 0 };
  }));
  const nLines = info.reduce((n, arr) => n + arr.length, 0);
  const raw = info.reduce((sum, arr, i) => sum + Math.max(3.6, (i === 0 ? 2.2 : 0.95) + arr.reduce((a, x) => a + x.dur + BASEGAP, 0) + 0.35), 0);
  const extra = Math.max(0, Math.max(30, Number(project.options.targetSec) || 0) - raw);
  const gapX = clamp(extra / Math.max(1, nLines), 0, 0.55), tailX = clamp((extra - gapX * nLines) / Math.max(1, info.length), 0, 2.5);
  let acc = 0; const tl = [];
  project.scenes.forEach((s, i) => {
    const enter = i === 0 ? 2.2 : 0.95; let cur = enter;
    const lines = s.lines.map((ln, li) => {
      const x = info[i][li], L = { ln, li, a: x.a, rate: x.rate, start: cur, dur: x.dur, lead: x.lead, tail: x.tail, words: x.words };
      L.times = wordTimes(x.words, x.dur - x.tail, x.lead);
      cur += x.dur + BASEGAP + gapX; return L;
    });
    const dur = Math.max(3.6, cur + 0.35 + tailX), X = { s, i, start: acc, dur, enter, lines, mode: s.mode || "mixed", tension: !!s.tension };
    X.objs = computeObjs(s, lines, enter);
    X.chars = X.mode === "object" ? [] : buildChars(project, s, null, W, H);
    X.chars.forEach((ch) => { ch.wins = lines.filter((L) => castKey(L.ln.speaker) === ch.key).map((L) => [L.start - 0.6, L.start + L.dur + 1.2]); });
    acc += dur; tl.push(X);
  });
  return { tl, total: acc + 0.45, W, H };
}

function drawFrame(g, T) {
  const { ctx, W, H, tl, total } = g; g.T = T;
  let i = 0; for (let k = 0; k < tl.length; k++) if (T >= tl[k].start) i = k;
  const cur = tl[i], s = cur.s, t = T - cur.start;
  let active = null; for (const L of cur.lines) if (t >= L.start - 0.02 && t < L.start + L.dur + 0.22) active = L;
  g.mouth += ((active ? g.rms : 0) - g.mouth) * 0.5;
  const cam = cameraFor(g, cur, t, T), img = state.images[s.id];
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  layer(g, cam, 0.35, 1.08, () => { if (img) drawCover(ctx, img, W, H, 1, 0, 0); else drawProcBg(g, s, T); });
  layer(g, cam, 0.65, 1.06, () => { if (img) drawMist(g, T); else drawMid(g, s, T); drawRealWorldOrnaments(g, s, T); });
  drawTint(g, s, T);
  layer(g, cam, 1, 1, () => { drawObjects(g, cur, t, T); drawCharacters(g, cur, t, T, active); });
  layer(g, cam, 1.5, 1, () => drawParticles(g, s, T));
  drawVignette(g, s);
  if (i === 0) drawTitle(g, t);
  drawTransition(g, i, t);
  if (cur.mode === "object" && active && !isNarr(active.ln.speaker)) {
    const tfs = Math.max(18, Math.round(H * (W > H ? 0.038 : 0.025)));
    drawNameTag(ctx, { name: active.ln.speaker, color: ACCENT, x: W / 2, y: H * 0.855 }, tfs, true);
  }
  drawSubtitle(g, active, t);
  ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fillRect(0, H - 7, W, 7);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, H - 7, W * clamp(T / total, 0, 1), 7);
}

async function renderVideo(onProgress) {
  const project = state.project, { tl, total, W, H } = buildTimeline(project);
  const canvas = $("stage"); canvas.hidden = false; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"), ac = ensureAC(); await ac.resume().catch(() => {});
  setStep("render", "run", "menyiapkan musik adaptif…"); await sleep(30);
  const bank = prepareAudioBank(ac, tl, project.options.genre);
  const dest = ac.createMediaStreamDestination(), voiceBus = ac.createGain(), analyser = ac.createAnalyser();
  analyser.fftSize = 512; voiceBus.connect(dest); voiceBus.connect(analyser);
  const t0 = ac.currentTime + 0.5;
  tl.forEach((x) => x.lines.forEach((L) => {
    if (!L.a) return;
    const src = ac.createBufferSource(); src.buffer = L.a.buf; src.detune.value = L.a.detune; src.connect(voiceBus); src.start(t0 + x.start + L.start);
  }));
  scheduleAudio(ac, dest, tl, total, bank, t0);
  const g = { ctx, W, H, groundY: H * (W > H ? 0.8 : 0.74), tl, total, mouth: 0, rms: 0, T: 0, sty: charStyleOf(project.options.style), ac, k: MOTION_K[project.options.motion] || 1, title: project.titleExplicit ? project.title : "" };
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
  store("silentOk", $("useBrowserSpeech").checked ? "1" : "0");
  store("sfxEnabled", $("sfxEnabled").checked ? "1" : "0");
  store("realProps", $("realProps").checked ? "1" : "0");
  store("imageModel", $("imageModel").value);
}
async function testImage() {
  const btn = $("btnTestImage"), img = $("imgTest"), out = $("healthOut"); out.hidden = false;
  if (!baseUrl()) { out.textContent = "URL Worker kosong — uji gambar butuh Worker."; return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = "membuat…"; out.textContent = "Membuat gambar uji…";
  try {
    saveSettings();
    const q = new URLSearchParams({ prompt: "Wide establishing shot of a wooden village house yard in the morning, environment and props only", seed: String(Date.now() % 100000), w: "512", h: "512", model: $("imageModel").value, style: $("style").value });
    const t0 = Date.now(); const r = await request(`/api/image?${q}`, { binary: true, attempts: 1 }, 90000);
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    img.dataset.url = URL.createObjectURL(new Blob([r.buf], { type: r.type || "image/jpeg" }));
    img.src = img.dataset.url; img.hidden = false;
    out.textContent = `Gambar uji OK ✓ — sumber: ${r.source || "?"}, ${((Date.now() - t0) / 1000).toFixed(1)} dtk` + (r.source && r.source !== $("imageModel").value ? "\n(model pilihan gagal, memakai cadangan)" : "");
  } catch (e) { out.textContent = "Gambar uji gagal: " + e.message; }
  finally { btn.disabled = false; btn.textContent = old; }
}
async function testConnection() {
  const out = $("healthOut"); out.hidden = false;
  if (!baseUrl()) { out.textContent = "URL Worker kosong — mode lokal/browser aktif."; return; }
  out.textContent = "Menguji koneksi…";
  try {
    saveSettings(); const d = await request("/api/health?probe=1", { method: "GET", attempts: 1 }, 30000);
    const yn = (v) => (v ? "✓" : "✕");
    out.textContent = `Terhubung ✓ (Worker v${d.version || "5"})\n` +
      `Workers AI (cerita + gambar FLUX) : ${yn(d.ai)}\n` +
      `Suara Edge (beda tiap tokoh)       : ${d.edge === null ? "-" : yn(d.edge)}${d.edge === false ? "  → memakai suara Google dgn nada beda. " + (d.edge_error || "") : ""}` +
      (d.ai ? "" : "\n\nBinding AI belum aktif: tambahkan [ai] binding = \"AI\" di wrangler.toml lalu deploy ulang.");
  } catch (e) { out.textContent = "Gagal: " + e.message; }
}
function init() {
  $("workerUrl").value = load("worker", ""); $("appToken").value = load("token", ""); $("script").value = load("draft", "");
  $("useBrowserSpeech").checked = load("silentOk", "0") === "1";
  $("imageModel").value = load("imageModel", "flux") || "flux";
  $("sfxEnabled").checked = load("sfxEnabled", "1") === "1";
  $("realProps").checked = load("realProps", "1") === "1";
  ["style", "genre", "lang", "ratio", "targetSec", "maxScenes", "musicUrl", "visualMode", "motion"].forEach((id) => {
    const e = $(id); if (!e) return;
    e.value = load(id, e.value); e.addEventListener("change", () => store(id, e.value));
  });
  const upd = () => { $("counter").textContent = `${$("script").value.length} / 12000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); }); upd();
  renderSteps(); renderLibrary();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnTestImage").addEventListener("click", testImage);
  $("btnClearVoices").addEventListener("click", () => { saveVoices({}); renderLibrary(); });
  $("btnSample").addEventListener("click", () => { $("script").value = SAMPLE; upd(); store("draft", SAMPLE); });
  $("btnStart").addEventListener("click", () => {
    try { baseUrl(); } catch (e) { showError(e.message); return; }
    saveSettings(); renderSteps();
    if (!baseUrl()) { log("PERINGATAN: URL Worker kosong → video akan TANPA SUARA (suara browser tidak bisa direkam). Isi URL Worker di Pengaturan."); setDetail("Tanpa Worker: video dibuat tanpa suara."); }
    run(0);
  });
  $("btnResume").addEventListener("click", () => { if (state.failedIndex !== null) run(state.failedIndex); });
  $("btnLockAll").addEventListener("click", () => { Object.keys(state.cast).forEach((k) => { state.cast[k].locked = true; persistCast(k); }); renderCast(); });
  $("btnCastDone").addEventListener("click", finishCast);
}
init();
