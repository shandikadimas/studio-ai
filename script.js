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

const SAMPLE_MG = `JUDUL: Studio Animasi
Narator: Bikin video penjelasan sekarang tinggal tulis naskah.
Narator: Dulu, satu video bisa memakan waktu berjam-jam.
Narator: Sekarang naskah dan suara langsung diubah menjadi animasi.
Narator: Prosesnya sederhana: naskah, gaya, storyboard, preview, lalu render.
Narator: Pilih dari 60+ gaya visual sesuai topikmu.
Narator: Hasilnya pas untuk layar vertikal di ponsel.
Narator: Mau tahu cara pakainya? Tulis STUDIO di komentar.`;

const SAMPLE_CRAFT = `JUDUL: Burung Kayu Terakhir
Narator: Menjelang senja, cahaya keemasan masuk lewat jendela bengkel kayu yang penuh perkakas.
VISUAL: Orbital dolly pelan mengitari meja kerja, serutan kayu melayang di berkas cahaya matahari terbenam
Kakek: Sedikit lagi, Nak. Burung ini harus punya sayap yang berani.
Narator: Jemari tuanya menggenggam pisau kecil, mengiris kayu dengan sabar, setipis harapan.
Anak Perempuan: Kek, kenapa kakek selalu membuat burung?
Kakek: Karena burung tidak pernah lupa jalan pulang, Nak.
Narator: Di rak-rak tua, mainan kayu yang sudah jadi menunggu pemiliknya, menyimpan cerita yang belum selesai.
Anak Perempuan: Kalau sudah selesai, boleh aku yang menerbangkannya?
Kakek: Tentu. Tapi ingat, dia hanya terbang kalau kamu percaya.
Narator: Sore itu, burung kayu pertama selesai diukir, dan sebuah janji kecil dimulai.
VISUAL: Kamera mundur perlahan, siluet kakek dan cucu di depan jendela senja
Narator: Karena warisan terbaik bukan benda, melainkan kesabaran yang diwariskan dari tangan ke tangan.`;

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
  { label: "Orbit Arc", motion: "slow orbital dolly on a curved path around the subject, low three-quarter angle, gently pushing in, single continuous take, steadycam smoothness" },
  { label: "Pull Back Reveal", motion: "gradual camera pull-back revealing wider surroundings and atmosphere" },
  { label: "Crane Down", motion: "slow crane move descending into the scene, volumetric light shafts, drifting dust particles, anamorphic bokeh" },
  { label: "Rack Focus", motion: "shallow depth of field rack focus from foreground debris to the key prop, soft bokeh, fine film grain" },
];

const STORY_PROP_RULES = [
  {
    keywords: ["kayu", "ukir", "pahat", "pisau", "burung", "bengkel", "pengrajin", "mainan", "serutan"],
    propsId: "Meja kerja kayu, pisau ukir kecil, serutan kayu, rak perkakas dan mainan kayu, jendela berkaca banyak dengan cahaya senja",
    propsEn: "wooden workbench, tiny carving knife, drifting wood shavings and dust, shelves packed with tools and finished wooden toys, multi-pane window with volumetric sunset light",
  },
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
  const arTag = project.options.ratio === "21:9" ? "--ar 21:9" : project.options.ratio === "16:9" ? "--ar 16:9" : "--ar 9:16";

  box.innerHTML = "";
  project.scenes.forEach((sc, idx) => {
    const narasi = (sc.lines || []).map((l) => `${l.speaker}: ${l.text}`).join(" ");
    const props = detectStoryProps(`${sc.location || ""} ${narasi}`);
    const cam = STORY_CAMERA_MOTIONS[idx % STORY_CAMERA_MOTIONS.length];

    const imgPrompt = project.options.style === "komikpenuh" ? `${sc.imagePrompt} ${arTag}` : `${visStyle}, scene at ${sc.location || "story setting"} (${sc.time || "pagi"}), depicting "${narasi}", featuring ${props.en}, no text, no watermark ${arTag}`;
    const motPrompt = `Characters show subtle breathing and expressive gestures, ${props.en} have gentle secondary motion, ${cam.motion}, smooth coherent motion`;

    const wrap = el("div", "cast-item");
    wrap.append(
      el("strong", "", `Adegan ${idx + 1} · ${sc.location || "Lokasi"} (${cam.label})`),
      el("div", "small", `Mode visual: ${({ object: "Fokus objek", mixed: "Objek + karakter saat bicara", char: "Fokus karakter", comic: "Komik adegan penuh" })[sc.mode] || "-"}${sc.hint ? " · Catatan visual: " + sc.hint : ""}`),
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

const dims = (ratio) => (ratio === "21:9" ? { w: 1680, h: 720 } : ratio === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 });
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
      if (opts.
