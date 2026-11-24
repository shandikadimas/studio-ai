/* =====================================================================
 *  worker.js — "OTAK UTAMA" Studio Video AI v4 (tokoh berpakaian, cerita anak)
 *  Platform : Cloudflare Workers (ES Module)
 * =====================================================================
 *  Pembagian tugas:
 *   Worker  : menulis rencana adegan + dialog (LLM), latar gambar (FLUX),
 *             suara tiap tokoh (Microsoft Edge TTS → cadangan Google TTS)
 *   Browser : menggambar stickman 3D di canvas, merekam jadi video
 *
 *  WAJIB (gratis):
 *   Binding  AI  → Workers AI   (Settings → Bindings → Add → Workers AI, nama: AI)
 *
 *  OPSIONAL:
 *   SECRET  APP_TOKEN          kata sandi akses dari frontend
 *   SECRET  POLLINATIONS_TOKEN cadangan gambar
 *   SECRET  LLM_API_KEY + VAR LLM_API_URL + VAR LLM_MODEL   LLM OpenAI-compatible
 *   VAR     AI_MODEL           ganti model teks Workers AI
 *   VAR     MAX_SCENES         batas adegan (default 12)
 *   VAR     ALLOWED_ORIGIN     default "*"
 *   VAR     EDGE_CHROMIUM_VERSION  naikkan jika Edge TTS mulai menolak (default di bawah)
 * ===================================================================== */

const VERSION = "4.0.0";

/* ------------------------------ KONSTANTA ------------------------------ */
const STYLE_PRESETS = {
  cinematic: "cinematic film still, dramatic volumetric lighting, shallow depth of field, rich color grading, ultra detailed",
  anime: "high quality anime background art, soft cel shading, vibrant colors, detailed painted scenery",
  animasi3d: "3D animated feature film environment render, stylized, soft global illumination, polished studio look",
  cat_air: "delicate watercolor storybook illustration, soft washes, paper texture, gentle gradients",
  realistis: "photorealistic documentary photograph, natural light, sharp focus, true-to-life colors, high detail",
  flat: "flat vector illustration, bold simple shapes, clean modern motion-graphics style, soft gradients",
  cgi3d: "stylized 3D CGI animated movie environment, Pixar-like look, soft subsurface lighting, rounded friendly shapes, rich saturated colors, polished render",
  clay: "claymation stop-motion miniature set, handmade plasticine clay textures, visible fingerprints, tactile materials, tilt-shift macro photography, warm studio lighting",
  komik: "comic book pop art illustration, bold black ink outlines, halftone Ben-Day dots, flat vivid colors, retro comic panel background",
};
const CAMERAS = ["zoom_in", "zoom_out", "pan_left", "pan_right", "static"];
const EMOTIONS = ["normal", "senang", "sedih", "marah", "kaget", "tanya", "lambai"];
const KINDS = ["pria", "wanita", "anak", "kakek", "nenek"];
const TIMES = ["pagi", "siang", "sore", "malam"];
const MAX_CHARS = 8;
const MAX_PRESENT = 5;
const OUTFIT_LIST = ["kemeja", "jas", "batik", "kaos", "sd", "smp", "gamis", "daster", "kebaya", "gaun", "koko", "petani", "nelayan", "chef", "dokter", "polisi", "overall"];
const OUTFIT_BY = {
  pria: ["kemeja", "batik", "kaos", "jas", "koko", "overall"],
  wanita: ["gamis", "daster", "kebaya", "kemeja", "gaun"],
  anak_l: ["sd", "kaos", "smp", "koko"],
  anak_p: ["gaun", "sd", "gamis", "kaos", "smp"],
  kakek: ["koko", "batik", "kemeja", "petani"],
  nenek: ["kebaya", "daster", "gamis"],
};
const SHARED_OUTFITS = new Set(["sd", "smp", "polisi", "dokter", "chef"]);
const STATUS_LIST = ["kaya", "menengah", "sederhana"];
const GENDERS = ["l", "p"];
const KID_BAD = ["bunuh", "membunuh", "darah", "mati", "mayat", "senjata", "pistol", "pedang", "perang", "setan", "hantu", "bodoh", "tolol", "sialan", "anjing", "rokok", "mabuk", "narkoba"];
const MOOD_KEYWORDS = {
  sedih: ["sedih", "menangis", "kehilangan", "duka", "air mata", "sepi", "rindu"],
  ceria: ["senang", "bahagia", "tertawa", "ceria", "gembira", "riang", "main"],
  dramatis: ["tegang", "marah", "bahaya", "takut", "konflik", "kejar", "ledak"],
  epik: ["perang", "pahlawan", "petualangan", "kerajaan", "pertempuran", "legenda"],
  misteri: ["misteri", "gelap", "rahasia", "bayangan", "hilang", "aneh", "malam"],
  inspiratif: ["bangkit", "berjuang", "mimpi", "harapan", "sukses", "semangat", "belajar"],
  tenang: ["tenang", "damai", "pagi", "sunyi", "alam", "pantai", "hujan", "embun"],
};
const MOOD_EMOJI = { sedih: "😢", ceria: "😄", dramatis: "⚡", epik: "🏔️", misteri: "🌙", inspiratif: "🚀", tenang: "🌿" };
const MAX_RAW = 6000;
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

const EDGE_VOICES = new Set([
  "id-ID-ArdiNeural", "id-ID-GadisNeural",
  "en-US-GuyNeural", "en-US-JennyNeural", "en-US-AriaNeural",
  "en-GB-RyanNeural", "en-GB-SoniaNeural",
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------ UTILITAS ------------------------------ */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const wordCount = (t) => (String(t).trim().match(/\S+/g) || []).length;
const estimateDuration = (t) => Math.round(clamp(wordCount(t) / 2.4 + 0.5, 1.5, 30) * 10) / 10;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-app-token",
    "Access-Control-Expose-Headers": "X-Source,X-Edge-Error",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

async function fetchT(url, opts = {}, ms = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseJSON(text) {
  if (text && typeof text === "object") return text;
  const t = String(text || "").replace(/```json|```/gi, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("respons LLM bukan JSON");
  return JSON.parse(t.slice(a, b + 1));
}

function guessMood(text) {
  const t = String(text).toLowerCase();
  let best = "inspiratif";
  let bestScore = 0;
  for (const [mood, words] of Object.entries(MOOD_KEYWORDS)) {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = mood; bestScore = score; }
  }
  return best;
}

function cleanText(t) {
  return String(t || "").replace(/[*_#`~>\[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------ LLM (fallback berlapis) ------------------------------ */
async function openAiChat(url, key, model, messages) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = "Bearer " + key;
  const res = await fetchT(url, { method: "POST", headers, body: JSON.stringify({ model, messages, temperature: 0.7 }) }, 45000);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!out) throw new Error("respons kosong");
  return out;
}

async function callLLM(env, system, user) {
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  const errors = [];
  if (env.LLM_API_URL && env.LLM_API_KEY) {
    try { return await openAiChat(env.LLM_API_URL, env.LLM_API_KEY, env.LLM_MODEL || "llama-3.3-70b-versatile", messages); }
    catch (e) { errors.push("LLM kustom: " + e.message); }
  }
  if (env.AI) {
    try {
      const r = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", { messages, max_tokens: 4800 });
      if (r && r.response) return r.response;
      throw new Error("respons kosong");
    } catch (e) { errors.push("Workers AI: " + e.message); }
  }
  try { return await openAiChat("https://text.pollinations.ai/openai", null, "openai", messages); }
  catch (e) { errors.push("Pollinations: " + e.message); }
  throw new Error(errors.join(" | "));
}

/* ------------------------------ OPSI ------------------------------ */
function normalizeOptions(o, env) {
  o = o || {};
  const maxCap = parseInt(env.MAX_SCENES) || 12;
  return {
    style: STYLE_PRESETS[o.style] ? o.style : "flat",
    lang: o.lang === "en" ? "en" : "id",
    ratio: o.ratio === "16:9" ? "16:9" : "9:16",
    maxScenes: clamp(parseInt(o.maxScenes) || 6, 1, maxCap),
    targetSec: clamp(parseInt(o.targetSec) || 45, 15, 90),
    genre: o.genre === "umum" ? "umum" : "anak",
    known: (Array.isArray(o.known) ? o.known : []).slice(0, 8).map((k) => ({
      name: cleanText(k && k.name).slice(0, 20),
      kind: KINDS.includes(k && k.kind) ? k.kind : "pria",
      gender: GENDERS.includes(k && k.gender) ? k.gender : undefined,
      role: cleanText(k && k.role).slice(0, 40),
      status: STATUS_LIST.includes(k && k.status) ? k.status : undefined,
      outfit: OUTFIT_LIST.includes(k && k.outfit) ? k.outfit : undefined,
    })).filter((k) => k.name),
    musicUrl: /^https:\/\/\S+$/.test(String(o.musicUrl || "").trim()) ? String(o.musicUrl).trim() : "",
  };
}

/* Anggaran kata: suara TTS Indonesia sekitar 2,4 kata/detik (jeda antar kalimat sudah dihitung) */
const wordBudget = (o) => Math.max(20, Math.floor(o.targetSec * 2.2));

function trimToWords(text, n) {
  const words = String(text).trim().split(/\s+/);
  if (words.length <= n) return String(text).trim();
  let cut = words.slice(0, n).join(" ");
  const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  if (last > cut.length * 0.5) cut = cut.slice(0, last + 1);
  else cut = cut.replace(/[,;:\s]+$/, "") + ".";
  return cut;
}

function enforceBudget(plan, o) {
  const budget = wordBudget(o);
  const all = plan.scenes.flatMap((s) => s.lines);
  const total = all.reduce((a, l) => a + wordCount(l.text), 0);
  if (total <= budget) return false;
  all.forEach((l) => {
    const share = Math.max(3, Math.floor((budget * wordCount(l.text)) / total));
    l.text = trimToWords(l.text, share);
  });
  return true;
}

/* ------------------------------ Tebakan sederhana (cadangan bila LLM gagal / kosong) ------------------------------ */
function guessKind(name, idx) {
  const n = String(name).toLowerCase();
  if (/\b(nenek|oma|mbah putri|eyang putri)\b/.test(n)) return "nenek";
  if (/\b(kakek|opa|mbah|eyang|pak haji|haji)\b/.test(n)) return "kakek";
  if (/\b(adik|anak|dedek|bocah|si kecil|nak)\b/.test(n)) return "anak";
  if (/\b(ibu|bu|mama|bunda|mbak|kak ani|siti|ani|dewi|sari|putri|rina|dina|ayu|nur)\b/.test(n)) return "wanita";
  if (/\b(bapak|pak|ayah|papa|abang|mas|bang|raka|budi|joko|andi|dimas|rudi)\b/.test(n)) return "pria";
  return idx % 2 === 0 ? "pria" : "wanita";
}

function guessEmotion(text) {
  const t = String(text).toLowerCase();
  if (/\b(halo|hai|selamat (pagi|siang|sore|malam)|dadah|sampai jumpa)\b/.test(t)) return "lambai";
  if (/\b(maaf|sedih|menangis|kehilangan|rindu|sayang sekali)\b/.test(t)) return "sedih";
  if (/\b(marah|bodoh|jangan|pergi|diam|kurang ajar|sialan|benci)\b/.test(t)) return "marah";
  if (/\b(astaga|hah|kaget|apa\?!|tidak mungkin|ya ampun|ya tuhan)\b/.test(t)) return "kaget";
  if (/\?/.test(t)) return "tanya";
  if (/\b(wah|hore|asyik|yeay|senang|bahagia|terima kasih|hebat|berhasil|pulang)\b/.test(t) || /!/.test(t)) return "senang";
  return "normal";
}

const FEMALE_NAMES = /\b(dina|siti|ani|dewi|sari|putri|rina|ayu|nur|mawar|bunga|sinta|citra|nadia|salsa|kayla|lala|mira|tika|rara|vina)\b/i;
const MALE_NAMES = /\b(raka|budi|beni|andi|dimas|joko|rudi|bima|adit|doni|piko|bimo|rafa|fajar|iwan)\b/i;

function guessGender(name, kind, idx) {
  if (kind === "pria" || kind === "kakek") return "l";
  if (kind === "wanita" || kind === "nenek") return "p";
  if (FEMALE_NAMES.test(name)) return "p";
  if (MALE_NAMES.test(name)) return "l";
  return idx % 2 ? "p" : "l";
}

function guessOutfit(c) {
  const t = (c.name + " " + (c.role || "")).toLowerCase();
  if (/dokter|perawat/.test(t)) return "dokter";
  if (/polisi/.test(t)) return "polisi";
  if (/petani|sawah|kebun/.test(t)) return "petani";
  if (/nelayan/.test(t)) return "nelayan";
  if (/koki|chef|juru masak/.test(t)) return "chef";
  if (/guru|dosen|kepala sekolah|bu guru|pak guru/.test(t)) return "batik";
  if (/haji|ustaz|ustadz|imam|santri|kyai/.test(t)) return "koko";
  if (/pengusaha|direktur|bos|pejabat|ceo|juragan/.test(t)) return c.kind === "pria" ? "jas" : "kebaya";
  if (/tukang|montir|kuli|pekerja/.test(t)) return "overall";
  if (/raja|ratu|putri|princess/.test(t)) return "gaun";
  const key = c.kind === "anak" ? "anak_" + c.gender : c.kind;
  const list = OUTFIT_BY[key] || OUTFIT_BY.pria;
  let h = 0;
  for (const ch of c.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/* Tiap tokoh dipakaikan baju berbeda (kecuali seragam yang memang sama) */
function diversifyOutfits(chars) {
  const used = new Set();
  chars.forEach((c) => {
    if (used.has(c.outfit) && !SHARED_OUTFITS.has(c.outfit)) {
      const key = c.kind === "anak" ? "anak_" + c.gender : c.kind;
      const alt = (OUTFIT_BY[key] || OUTFIT_BY.pria).find((o) => !used.has(o));
      if (alt) c.outfit = alt;
    }
    used.add(c.outfit);
  });
}

function guessLocation(text) {
  const t = String(text).toLowerCase();
  const map = [
    [/kelas|guru|murid|sekolah/, "kelas"], [/kantin|jajan/, "kantin sekolah"], [/sawah|padi|petani/, "sawah"],
    [/pantai|laut|nelayan/, "pantai"], [/pasar|dagang|jual/, "pasar"], [/hutan|gunung|sungai/, "hutan"],
    [/mewah|istana|mansion|villa/, "rumah mewah"], [/dapur|masak/, "dapur"], [/kamar|tidur/, "kamar"],
    [/jalan|kota|bus|toko/, "jalan kota"], [/taman|bermain|ayunan/, "taman"],
  ];
  for (const [re, loc] of map) if (re.test(t)) return loc;
  return "rumah";
}

function kidNotes(plan) {
  const text = plan.scenes.flatMap((s) => s.lines.map((l) => l.text)).join(" ").toLowerCase();
  const hit = KID_BAD.filter((w) => new RegExp("\\b" + w + "\\b").test(text));
  return hit.length ? [`Mode anak: ada kata yang kurang cocok untuk tontonan anak (${hit.join(", ")}). Sebaiknya diganti di naskah.`] : [];
}

/* =====================================================================
 *  AGEN 1 — PENULIS NASKAH & SUTRADARA (dialog, tokoh, latar)
 * ===================================================================== */
function systemPlan(o) {
  const kid = o.genre === "anak";
  const known = o.known.length ? `\nTokoh yang SUDAH ADA di serial ini. Jika tokohnya sama, pakai persis nama, kind, gender, role, status, outfit berikut agar tampilannya konsisten: ${JSON.stringify(o.known)}` : "";
  const kidRules = kid ? `\nTONTONAN ANAK (wajib): bahasa sederhana dan hangat untuk usia 4–10 tahun; tanpa kekerasan, darah, senjata, hal menakutkan, kata kasar, atau isu dewasa; konflik ringan yang selesai dengan baik; tokoh sopan dan saling menolong; tutup cerita dengan pesan moral singkat di field moral (maks 14 kata, kalimat positif).\n` : "";
  return `Kamu adalah sutradara animasi 3D untuk video pendek (Reels/TikTok/YouTube) yang isinya DIALOG antar tokoh. Ubah naskah mentah menjadi maksimal ${o.maxScenes} adegan.${kidRules}${known}
Aturan:
- Naskah bisa berformat "Nama: ucapan" atau cerita biasa. Pertahankan bahasa dan alur aslinya, jangan menambah fakta besar. Jika cerita biasa, ubah menjadi dialog natural antar tokoh plus narasi singkat dengan speaker "Narator".
- characters (maksimal ${MAX_CHARS}, TANPA Narator): name 1–2 kata; kind salah satu ${KINDS.join(", ")}; gender "l" atau "p"; role = peran/profesi 1–4 kata (mis. "anak pengusaha", "petani", "guru SD"); status ekonomi keluarga salah satu ${STATUS_LIST.join(", ")} sesuai ceritanya; outfit salah satu ${OUTFIT_LIST.join(", ")} sesuai usia, peran, dan status; bio = 1 kalimat latar belakang maks 12 kata. Pakaian tiap tokoh HARUS berbeda kecuali seragam sekolah/kerja yang memang sama.
- SATU ADEGAN = SATU TEMPAT. Semua tokoh yang ikut bercakap di tempat itu masuk ke present dan tampil BERSAMA dalam satu layar. Jangan memecah adegan per pembicara.
- Tempat harus sesuai isi cerita dan status tokoh (rumah mewah vs rumah sederhana, kelas, kantin, sawah, pasar, jalan desa, pantai, dll). DILARANG memakai taman atau alam terbuka yang sama berulang; ganti tempat setiap cerita berpindah lokasi.
- Tiap adegan: location (kata kunci singkat bahasa Indonesia), time (${TIMES.join(", ")}), bgPrompt (BAHASA INGGRIS, 20–40 kata, deskripsi LATAR KOSONG tanpa orang yang spesifik pada tempat itu, termasuk suasana dan tingkat kemewahannya), present (nama tokoh yang tampil, maksimal ${MAX_PRESENT}), lines.
- Tiap line: speaker (persis nama dari characters, atau "Narator"), text, emotion salah satu: ${EMOTIONS.join(", ")}.
- text: kalimat pendek maksimal 25 kata, enak dibaca keras oleh mesin suara. Tulis angka dan singkatan sebagai kata.
- BATAS DURASI KERAS: total seluruh text MAKSIMAL ${wordBudget(o)} kata. Jika naskah lebih panjang, ringkas dengan mempertahankan inti.
- mood salah satu: ${Object.keys(MOOD_KEYWORDS).join(", ")}. camera salah satu: ${CAMERAS.join(", ")} (variasikan).
Balas HANYA JSON valid tanpa teks lain, bentuknya:
{"title":"...","mood":"ceria","moral":"...","characters":[{"name":"Dina","kind":"anak","gender":"p","role":"anak pengusaha","status":"kaya","outfit":"gaun","bio":"Tinggal di rumah besar, belum punya banyak teman."},{"name":"Beni","kind":"anak","gender":"l","role":"anak petani","status":"sederhana","outfit":"sd","bio":"Rajin membantu ayahnya di sawah."}],"scenes":[{"location":"kelas","time":"pagi","bgPrompt":"empty bright elementary school classroom with wooden desks, green chalkboard and sunlight through windows","mood":"ceria","camera":"zoom_in","emoji":"🏫","present":["Dina","Beni"],"lines":[{"speaker":"Narator","text":"Pagi itu di kelas, Dina dan Beni bertemu.","emotion":"normal"},{"speaker":"Dina","text":"Hai Beni, bekalmu apa?","emotion":"tanya"}]}]}`;
}

function normalizePlan(obj, raw) {
  const chars = [];
  const byName = new Map();
  const isNarr = (n) => /^narat(o|e)r$/i.test(String(n).trim());
  const addChar = (name, kind, x) => {
    x = x || {};
    name = cleanText(name).slice(0, 20);
    if (!name || isNarr(name)) return null;
    const key = name.toLowerCase();
    if (byName.has(key)) return byName.get(key);
    if (chars.length >= MAX_CHARS) return null;
    const k = KINDS.includes(kind) ? kind : guessKind(name, chars.length);
    const c = {
      name, kind: k,
      gender: GENDERS.includes(x.gender) ? x.gender : guessGender(name, k, chars.length),
      role: cleanText(x.role).slice(0, 40),
      status: STATUS_LIST.includes(x.status) ? x.status : "menengah",
      outfit: OUTFIT_LIST.includes(x.outfit) ? x.outfit : null,
      bio: cleanText(x.bio).slice(0, 90),
    };
    c.outfit = c.outfit || guessOutfit(c);
    chars.push(c);
    byName.set(key, c);
    return c;
  };
  (Array.isArray(obj && obj.characters) ? obj.characters : []).forEach((c) => addChar(c && c.name, c && c.kind, c));

  const scenes = [];
  (Array.isArray(obj && obj.scenes) ? obj.scenes : []).forEach((s) => {
    s = s || {};
    const lines = [];
    let src = Array.isArray(s.lines) ? s.lines : [];
    if (!src.length && s.narration) src = [{ speaker: "Narator", text: s.narration }];
    src.forEach((l) => {
      l = l || {};
      const text = cleanText(l.text);
      if (!text) return;
      const sp = cleanText(l.speaker);
      let speaker = "Narator";
      if (sp && !isNarr(sp)) { const c = addChar(sp, null); speaker = c ? c.name : "Narator"; }
      lines.push({ speaker, text, emotion: EMOTIONS.includes(l.emotion) ? l.emotion : guessEmotion(text) });
    });
    if (lines.length) scenes.push({ ...s, lines });
  });
  return {
    title: cleanText(obj && obj.title).slice(0, 80) || "Video Tanpa Judul",
    mood: MOOD_KEYWORDS[obj && obj.mood] ? obj.mood : guessMood(raw),
    moral: cleanText(obj && obj.moral).slice(0, 120),
    characters: chars,
    scenes,
  };
}

function ruleBasedPlan(raw, o) {
  const items = [];
  const chars = [];
  const seen = new Set();
  raw.split(/\n+/).map((x) => x.trim()).filter(Boolean).forEach((row) => {
    const m = row.match(/^([\p{L}][\p{L}\p{N} .'’-]{0,24}?)\s*[:：]\s*(.+)$/u);
    if (m && wordCount(m[1]) <= 3) {
      const nm = m[1].trim();
      const narr = /^narat(o|e)r$/i.test(nm);
      if (!narr && !seen.has(nm.toLowerCase())) { seen.add(nm.toLowerCase()); chars.push({ name: nm }); }
      items.push({ speaker: narr ? "Narator" : nm, text: m[2].trim() });
    } else {
      (row.match(/[^.!?…]+[.!?…]*/g) || [row]).forEach((s) => { if (s.trim()) items.push({ speaker: "Narator", text: s.trim() }); });
    }
  });
  const per = Math.max(1, Math.ceil(items.length / o.maxScenes));
  const scenes = [];
  for (let i = 0; i < items.length; i += per) scenes.push({ location: guessLocation(items.slice(i, i + per).map((x) => x.text).join(" ")), time: "siang", lines: items.slice(i, i + per) });
  return { title: (items[0] ? items[0].text : raw).slice(0, 60), mood: guessMood(raw), characters: chars, scenes };
}

function fillScene(s, i, cmap, fullText) {
  const location = cleanText(s.location).slice(0, 30) || "alam terbuka";
  const bg = cleanText(s.bgPrompt);
  let time = TIMES.includes(s.time) ? s.time : null;
  if (!time) {
    const h = (location + " " + bg).toLowerCase();
    time = /malam|night/.test(h) ? "malam" : /sore|sunset|dusk/.test(h) ? "sore" : /pagi|sunrise|morning|dawn/.test(h) ? "pagi" : "siang";
  }
  const text = s.lines.map((l) => l.text).join(" ");
  const mood = MOOD_KEYWORDS[s.mood] ? s.mood : guessMood(text || fullText);
  const present = [];
  const add = (n) => {
    const c = cmap.get(String(n).toLowerCase());
    if (c && !present.includes(c.name)) present.push(c.name);
  };
  s.lines.forEach((l) => add(l.speaker));
  (Array.isArray(s.present) ? s.present : []).forEach(add);
  return {
    location,
    time,
    bgPrompt: bg,
    mood,
    emoji: String(s.emoji || "").trim().slice(0, 8) || MOOD_EMOJI[mood],
    camera: CAMERAS.includes(s.camera) ? s.camera : CAMERAS[i % CAMERAS.length],
    present: present.slice(0, MAX_PRESENT),
    lines: s.lines,
  };
}

async function agentPlan(body, env) {
  const raw = String(body.script || "").trim();
  if (raw.length < 20) throw new HttpError(400, "Naskah terlalu pendek (minimal 20 karakter).");
  if (raw.length > MAX_RAW) throw new HttpError(400, `Naskah terlalu panjang (maksimal ${MAX_RAW} karakter). Pecah menjadi beberapa video.`);
  const o = normalizeOptions(body.options, env);
  const notes = [];
  let plan = null;
  try {
    const txt = await callLLM(env, systemPlan(o), `Naskah mentah:\n"""\n${raw}\n"""`);
    plan = normalizePlan(parseJSON(txt), raw);
  } catch (e) {
    notes.push("LLM gagal (" + e.message + "). Memakai pemecah naskah otomatis (format \"Nama: ucapan\" paling cocok).");
  }
  if (!plan || !plan.scenes.length) {
    if (!notes.length) notes.push("LLM tidak menghasilkan adegan valid. Memakai pemecah naskah otomatis.");
    plan = normalizePlan(ruleBasedPlan(raw, o), raw);
  }
  // gabungkan adegan berlebih agar isi naskah tidak hilang
  while (plan.scenes.length > o.maxScenes) {
    const last = plan.scenes.pop();
    plan.scenes[plan.scenes.length - 1].lines.push(...last.lines);
  }
  diversifyOutfits(plan.characters);
  const cmap = new Map(plan.characters.map((c) => [c.name.toLowerCase(), c]));
  plan.scenes = plan.scenes.map((s, i) => fillScene(s, i, cmap, raw));
  // percakapan di tempat yang sama: tokoh adegan sebelumnya tetap ada di layar (satu frame)
  for (let i = 1; i < plan.scenes.length; i++) {
    const a = plan.scenes[i - 1], b = plan.scenes[i];
    if (String(a.location).toLowerCase() === String(b.location).toLowerCase()) {
      const merged = b.present.slice();
      a.present.forEach((n) => { if (!merged.includes(n)) merged.push(n); });
      b.present = merged.slice(0, MAX_PRESENT);
    }
  }
  if (o.genre === "anak") kidNotes(plan).forEach((n) => notes.push(n));
  if (enforceBudget(plan, o)) {
    notes.push(`Dialog diringkas agar video ±${o.targetSec} detik. Untuk cerita panjang, bagi naskah menjadi beberapa video.`);
  }
  const seedBase = Math.floor(Math.random() * 900000) + 1000;
  plan.scenes.forEach((s, i) => {
    const core = s.bgPrompt || `${s.location}, ${s.time}`;
    const kidTag = o.genre === "anak" ? "child-friendly bright cheerful mood, safe for children, " : "";
    s.imagePrompt = `${core}, ${STYLE_PRESETS[o.style]}, ${kidTag}empty scene, no people, no characters, no text, no letters, wide shot, open flat ground in the foreground`.slice(0, 760);
    s.seed = seedBase + i * 31;
    s.id = i + 1;
    s.durationSec = Math.round(s.lines.reduce((a, l) => a + estimateDuration(l.text), 0) * 10) / 10;
  });
  const project = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), options: { ...o, known: undefined }, genre: o.genre, moral: plan.moral, title: plan.title, mood: plan.mood, characters: plan.characters, scenes: plan.scenes };
  const total = project.scenes.reduce((a, s) => a + s.durationSec, 0);
  notes.push(`${project.characters.length} tokoh, ${project.scenes.length} adegan, estimasi ±${Math.round(total)} detik, mood "${project.mood}".`);
  return { project, notes };
}

/* =====================================================================
 *  AGEN 3 — LATAR GAMBAR (FLUX di Workers AI → cadangan Pollinations)
 * ===================================================================== */
async function genImage(env, prompt, seed, w, h) {
  const errors = [];
  if (env.AI) {
    try {
      const r = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: prompt.slice(0, 1800), steps: 4 });
      if (r && r.image) return { bytes: b64ToBytes(r.image), type: "image/jpeg", source: "flux-workers-ai" };
      throw new Error("respons kosong");
    } catch (e) { errors.push("FLUX: " + e.message); }
  }
  try {
    let u = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 700))}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
    if (env.POLLINATIONS_TOKEN) u += "&token=" + encodeURIComponent(env.POLLINATIONS_TOKEN);
    const res = await fetchT(u, { headers: { "User-Agent": UA } }, 55000);
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/^image\//i.test(type)) throw new Error("HTTP " + res.status);
    return { bytes: new Uint8Array(await res.arrayBuffer()), type, source: "pollinations" };
  } catch (e) { errors.push("Pollinations: " + e.message); }
  if (!env.AI) errors.unshift("Binding Workers AI bernama AI belum terpasang di Worker ini (Settings → Bindings → Add → Workers AI)");
  throw new HttpError(502, "Gambar gagal dibuat — " + errors.join(" | "));
}

/* =====================================================================
 *  AGEN 4 — SUARA TOKOH
 *   1) Microsoft Edge TTS (neural; ada suara pria & wanita; pitch & kecepatan diatur)
 *   2) cadangan: Google TTS (satu suara; browser menggeser nadanya per tokoh)
 *  Keduanya endpoint tidak resmi, tanpa kunci API.
 * ===================================================================== */
const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_VER_DEFAULT = "143.0.3650.75";

async function edgeGec() {
  let s = Math.floor(Date.now() / 1000) + 11644473600;
  s -= s % 300;
  const ticks = BigInt(s) * 10000000n;
  const data = new TextEncoder().encode(ticks.toString() + EDGE_TOKEN);
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function xmlEsc(t) {
  return String(t).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
}

function edgeDate() {
  const d = new Date();
  const D = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n) => String(n).padStart(2, "0");
  return `${D[d.getUTCDay()]} ${M[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

async function edgeTTS(env, text, voice, pitchHz, ratePct) {
  const ver = env.EDGE_CHROMIUM_VERSION || EDGE_VER_DEFAULT;
  const major = ver.split(".")[0];
  const gec = await edgeGec();
  const conn = crypto.randomUUID().replace(/-/g, "");
  const url = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
    `?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${conn}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-${ver}`;
  const resp = await fetch(url, {
    headers: {
      Upgrade: "websocket",
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 Edg/${major}.0.0.0`,
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const ws = resp.webSocket;
  if (!ws) throw new Error("WebSocket ditolak (HTTP " + resp.status + ")");
  ws.accept();

  const sign = (n, u) => (n >= 0 ? "+" : "") + n + u;
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${sign(pitchHz, "Hz")}' rate='${sign(ratePct, "%")}' volume='+0%'>${xmlEsc(text)}</prosody></voice></speak>`;
  const dec = new TextDecoder();

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(1000, "ok"); } catch (e) { /* abaikan */ }
      if (err) return reject(err);
      const total = chunks.reduce((a, c) => a + c.length, 0);
      if (!total) return reject(new Error("tidak ada audio diterima"));
      const out = new Uint8Array(total);
      let o = 0;
      chunks.forEach((c) => { out.set(c, o); o += c.length; });
      resolve(out.buffer);
    };
    const timer = setTimeout(() => finish(new Error("timeout 15 dtk")), 15000);
    ws.addEventListener("message", (ev) => {
      const d = ev.data;
      if (typeof d === "string") {
        if (d.includes("Path:turn.end")) finish(null);
      } else if (d instanceof ArrayBuffer && d.byteLength > 2) {
        const hl = new DataView(d).getUint16(0, false);
        const head = dec.decode(d.slice(2, 2 + hl));
        if (head.includes("Path:audio")) chunks.push(new Uint8Array(d, 2 + hl));
      }
    });
    ws.addEventListener("error", () => finish(new Error("koneksi WebSocket error")));
    ws.addEventListener("close", () => finish(chunks.length ? null : new Error("koneksi ditutup sebelum audio")));
    ws.send(`X-Timestamp:${edgeDate()}Z\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`);
    ws.send(`X-RequestId:${conn}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${edgeDate()}Z\r\nPath:ssml\r\n\r\n${ssml}`);
  });
}

async function googleTTS(text, lang) {
  const q = encodeURIComponent(text);
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${q}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${q}`,
  ];
  const errors = [];
  for (const u of urls) {
    try {
      const res = await fetchT(u, { headers: { "User-Agent": UA, Referer: "https://translate.google.com/" }, cf: { cacheTtl: 86400, cacheEverything: true } }, 20000);
      const type = res.headers.get("content-type") || "";
      if (res.ok && /audio|octet/i.test(type)) return await res.arrayBuffer();
      errors.push("HTTP " + res.status);
    } catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join(", "));
}

async function genSpeech(env, p) {
  let edgeErr = "";
  if (p.engine !== "google") {
    try {
      return { buf: await edgeTTS(env, p.text, p.voice, p.pitch, p.rate), source: "edge-tts", edgeErr };
    } catch (e) { edgeErr = String(e && e.message || e); }
  }
  const lang = p.voice.startsWith("en") ? "en" : "id";
  const errors = [];
  try { return { buf: await googleTTS(p.text, lang), source: "google-tts", edgeErr }; }
  catch (e) { errors.push("Google: " + e.message); }
  if (lang === "en" && env.AI) {
    try {
      const r = await env.AI.run("@cf/myshell-ai/melotts", { prompt: p.text, lang: "en" });
      const b64 = typeof r === "string" ? r : r && r.audio;
      if (b64) return { buf: b64ToBytes(b64).buffer, source: "melotts", edgeErr };
    } catch (e) { errors.push("MeloTTS: " + e.message); }
  }
  throw new HttpError(502, "Suara gagal dibuat — " + (edgeErr ? "Edge: " + edgeErr + " | " : "") + errors.join(" | "));
}

/* ------------------------------ ROUTER ------------------------------ */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      if (!url.pathname.startsWith("/api/")) {
        return json({ ok: true, service: "Otak Utama Studio Video AI", version: VERSION }, 200, cors);
      }
      if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
        throw new HttpError(401, "Token akses salah atau belum diisi. Periksa kolom Token di Pengaturan.");
      }

      if (url.pathname === "/api/health") {
        const out = {
          ok: true,
          version: VERSION,
          configured: {
            workers_ai: !!env.AI,
            llm_kustom: !!(env.LLM_API_URL && env.LLM_API_KEY),
            pollinations_token: !!env.POLLINATIONS_TOKEN,
          },
        };
        if (url.searchParams.get("probe") === "1") {
          try { await edgeTTS(env, "Tes", "id-ID-ArdiNeural", 0, 0); out.edge_tts = { ok: true }; }
          catch (e) { out.edge_tts = { ok: false, error: String(e && e.message || e) }; }
        }
        return json(out, 200, cors);
      }

      if (url.pathname === "/api/plan" && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch (e) { throw new HttpError(400, "Data yang dikirim bukan JSON valid."); }
        const t0 = Date.now();
        const out = await agentPlan(body, env);
        return json({ ok: true, ...out, agent: "Agen 1 · Penulis Naskah & Sutradara", ms: Date.now() - t0 }, 200, cors);
      }

      if (url.pathname === "/api/image" && request.method === "GET") {
        const prompt = String(url.searchParams.get("prompt") || "").trim();
        if (prompt.length < 3) throw new HttpError(400, "Prompt gambar kosong.");
        const w = clamp(parseInt(url.searchParams.get("w")) || 720, 256, 1280);
        const h = clamp(parseInt(url.searchParams.get("h")) || 1280, 256, 1280);
        const seed = parseInt(url.searchParams.get("seed")) || 1234;
        const img = await genImage(env, prompt, seed, w, h);
        return new Response(img.bytes, { headers: { "Content-Type": img.type, "X-Source": img.source, "Cache-Control": "public, max-age=86400", ...cors } });
      }

      if (url.pathname === "/api/tts" && request.method === "GET") {
        const text = cleanText(url.searchParams.get("text"));
        let voice = url.searchParams.get("voice") || "id-ID-GadisNeural";
        if (!EDGE_VOICES.has(voice)) voice = "id-ID-GadisNeural";
        const pitch = clamp(parseInt(url.searchParams.get("pitch")) || 0, -80, 80);
        const rate = clamp(parseInt(url.searchParams.get("rate")) || 0, -40, 40);
        const engine = url.searchParams.get("engine") === "google" ? "google" : "edge";
        if (!text) throw new HttpError(400, "Teks suara kosong.");
        if (text.length > 220) throw new HttpError(400, "Potongan teks suara terlalu panjang (maks 220 karakter).");
        const out = await genSpeech(env, { text, voice, pitch, rate, engine });
        const headers = { "Content-Type": "audio/mpeg", "X-Source": out.source, "Cache-Control": "public, max-age=86400", ...cors };
        if (out.edgeErr) headers["X-Edge-Error"] = out.edgeErr.replace(/[^\x20-\x7e]/g, "?").slice(0, 120);
        return new Response(out.buf, { headers });
      }

      // Proxy musik latar (agar bisa dibaca browser walau server musik tanpa CORS)
      if (url.pathname === "/api/fetch" && request.method === "GET") {
        const target = String(url.searchParams.get("url") || "");
        let u;
        try { u = new URL(target); } catch (e) { throw new HttpError(400, "URL musik tidak valid."); }
        if (u.protocol !== "https:") throw new HttpError(400, "URL musik harus https.");
        const res = await fetchT(u.toString(), { headers: { "User-Agent": UA } }, 25000);
        const type = res.headers.get("content-type") || "";
        if (!res.ok) throw new HttpError(502, "Musik tidak bisa diambil (HTTP " + res.status + ").");
        if (!/audio|octet-stream/i.test(type)) throw new HttpError(400, "URL itu bukan file audio.");
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 15 * 1024 * 1024) throw new HttpError(400, "File musik terlalu besar (maks 15 MB).");
        return new Response(buf, { headers: { "Content-Type": "audio/mpeg", ...cors } });
      }

      throw new HttpError(404, "Alamat API tidak ditemukan.");
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : "Kesalahan internal Worker: " + (e && e.message);
      return json({ ok: false, error: message }, status, cors);
    }
  },
};
