/* =====================================================================
 *  worker.js — "OTAK UTAMA" Studio Video AI v4 (Cerita Anak & Multi-Gaya)
 *  Platform : Cloudflare Workers (ES Module)
 * ===================================================================== */

const VERSION = "4.0.0";

const STYLE_PRESETS = {
  cgi3d: "3D CGI stylized animation environment, Pixar and Dreamworks inspired children movie background, vibrant colors, soft global illumination, playful detailed scenery, clean depth of field",
  claymation: "handcrafted stop motion claymation diorama background, Aardman Shaun the Sheep style, tactile clay textures, miniature trees and props, warm studio lighting",
  comic: "colorful comic book pop art background illustration, bold ink outlines, halftone dots pattern, vibrant primary colors, dynamic children graphic novel scenery",
  cat_air: "delicate watercolor children storybook illustration, hand-painted soft washes, warm pastel colors, textured watercolor paper, charming fairytale scenery",
  anime: "bright cheerful Ghibli-inspired anime background art, lush scenery, soft cel shading, vibrant daylight, heartwarming children animation background",
  flat: "clean modern flat vector children educational illustration, rounded friendly shapes, bright pastel palette, playful layered scenery",
  cinematic: "warm cinematic family movie background, golden hour lighting, rich colors, shallow depth of field, ultra detailed",
  realistis: "bright documentary family photograph, natural daylight, sharp focus, true-to-life colors, clean background",
};

const CAMERAS = ["zoom_in", "zoom_out", "pan_left", "pan_right", "static"];
const EMOTIONS = ["normal", "senang", "sedih", "marah", "kaget", "tanya", "lambai"];
const KINDS = ["pria", "wanita", "anak", "kakek", "nenek"];
const OUTFITS = ["kasual", "rapih_elit", "sederhana", "petualang", "seniman", "seragam"];
const TIMES = ["pagi", "siang", "sore", "malam"];
const MAX_CHARS = 6;
const MAX_PRESENT = 4;

const MOOD_KEYWORDS = {
  sedih: ["sedih", "menangis", "kehilangan", "duka", "air mata", "sepi", "rindu", "maaf"],
  ceria: ["senang", "bahagia", "tertawa", "ceria", "gembira", "riang", "main", "hore", "asyik"],
  dramatis: ["tegang", "marah", "bahaya", "takut", "konflik", "kejar", "gawat"],
  epik: ["petualangan", "kerajaan", "pahlawan", "jelajah", "misi"],
  misteri: ["misteri", "rahasia", "hilang", "aneh", "cari", "jejak"],
  inspiratif: ["bangkit", "berjuang", "mimpi", "harapan", "semangat", "belajar", "tolong", "berbagi"],
  tenang: ["tenang", "damai", "pagi", "alam", "pantai", "hujan", "kebun", "desa"],
};
const MOOD_EMOJI = { sedih: "😢", ceria: "😄", dramatis: "⚡", epik: "🏔️", misteri: "🔍", inspiratif: "🌟", tenang: "🌿" };
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
  let best = "ceria";
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
      const r = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", { messages, max_tokens: 3500 });
      if (r && r.response) return r.response;
      throw new Error("respons kosong");
    } catch (e) { errors.push("Workers AI: " + e.message); }
  }
  try { return await openAiChat("https://text.pollinations.ai/openai", null, "openai", messages); }
  catch (e) { errors.push("Pollinations: " + e.message); }
  throw new Error(errors.join(" | "));
}

function normalizeOptions(o, env) {
  o = o || {};
  const maxCap = parseInt(env.MAX_SCENES) || 12;
  return {
    style: STYLE_PRESETS[o.style] ? o.style : "cgi3d",
    lang: o.lang === "en" ? "en" : "id",
    ratio: o.ratio === "16:9" ? "16:9" : "9:16",
    maxScenes: clamp(parseInt(o.maxScenes) || 6, 1, maxCap),
    targetSec: clamp(parseInt(o.targetSec) || 45, 15, 90),
    musicUrl: /^https:\/\/\S+$/.test(String(o.musicUrl || "").trim()) ? String(o.musicUrl).trim() : "",
  };
}

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

function guessKind(name, idx) {
  const n = String(name).toLowerCase();
  if (/\b(nenek|oma|mbah putri|eyang putri)\b/.test(n)) return "nenek";
  if (/\b(kakek|opa|mbah|eyang|pak haji|haji)\b/.test(n)) return "kakek";
  if (/\b(ibu|bu|mama|bunda|tante|guru|bu guru)\b/.test(n)) return "wanita";
  if (/\b(bapak|pak|ayah|papa|om|pak guru)\b/.test(n)) return "pria";
  return "anak";
}

function guessOutfit(name, idx) {
  const n = String(name).toLowerCase();
  if (/\b(raka|putra|doni|kevin|raya)\b/.test(n)) return "rapih_elit";
  if (/\b(lala|sari|ayu|dina|rina)\b/.test(n)) return "seniman";
  if (/\b(bimo|andi|joko|budi|dimas)\b/.test(n)) return "petualang";
  if (/\b(guru|sekolah|kelas|siswa)\b/.test(n)) return "seragam";
  return OUTFITS[idx % OUTFITS.length];
}

function guessEmotion(text) {
  const t = String(text).toLowerCase();
  if (/\b(halo|hai|selamat (pagi|siang|sore|malam)|dadah|sampai jumpa)\b/.test(t)) return "lambai";
  if (/\b(maaf|sedih|menangis|kehilangan|rindu|sayang sekali|kasihan)\b/.test(t)) return "sedih";
  if (/\b(marah|jangan|curang|nakal|tidak boleh|kesal)\b/.test(t)) return "marah";
  if (/\b(astaga|hah|kaget|apa\?!|wah lihat|ya ampun|gawat|hilang)\b/.test(t)) return "kaget";
  if (/\?/.test(t)) return "tanya";
  if (/\b(wah|hore|asyik|yeay|senang|bahagia|terima kasih|hebat|berhasil|setuju|ayo)\b/.test(t) || /!/.test(t)) return "senang";
  return "normal";
}

function systemPlan(o) {
  return `Kamu adalah sutradara serial animasi edukasi anak-anak yang ceria, hangat, dan mendidik. Ubah naskah menjadi maksimal ${o.maxScenes} adegan.
Aturan:
- Konten harus ramah anak, sopan, dan mengandung nilai persahabatan/kerja sama.
- characters: daftar tokoh (maksimal ${MAX_CHARS}, TANPA Narator). name = nama 1–2 kata. kind salah satu: ${KINDS.join(", ")}. outfit salah satu: ${OUTFITS.join(", ")} (bedakan outfit antar tokoh untuk menunjukkan keragaman latar keluarga, mis. rapih_elit, sederhana, petualang, seniman, seragam, kasual).
- Tiap adegan punya: location (lokasi bervariasi sesuai cerita, mis. sekolah, pasar, kompleks rumah, dapur, pantai, hutan, perpustakaan, taman bermain), time (${TIMES.join(", ")}), bgPrompt (BAHASA INGGRIS, 15–35 kata, mendeskripsikan LATAR KOSONG tanpa orang dengan detail ramah anak), present (SEMUA tokoh yang sedang mengobrol atau berada di adegan itu harus dimasukkan agar tampil bersamaan dalam satu frame / in-frame, maksimal ${MAX_PRESENT}), lines (daftar ucapan berurutan).
- Tiap line: speaker (persis nama dari characters, atau "Narator"), text, emotion salah satu: ${EMOTIONS.join(", ")}.
- BATAS DURASI KERAS: total seluruh text MAKSIMAL ${wordBudget(o)} kata.
- mood salah satu: ${Object.keys(MOOD_KEYWORDS).join(", ")}. camera salah satu: ${CAMERAS.join(", ")}.
Balas HANYA JSON valid:
{"title":"...","mood":"ceria","characters":[{"name":"Raka","kind":"anak","outfit":"rapih_elit"},{"name":"Lala","kind":"anak","outfit":"seniman"}],"scenes":[{"location":"halaman sekolah","time":"pagi","bgPrompt":"bright colorful elementary school courtyard with a big tree, wooden benches, and flower beds","mood":"ceria","camera":"zoom_in","emoji":"🏫","present":["Raka","Lala"],"lines":[{"speaker":"Narator","text":"Pagi itu di sekolah yang cerah.","emotion":"normal"},{"speaker":"Raka","text":"Halo Lala! Ayo kita mulai melukis!","emotion":"senang"}]}]}`;
}

function normalizePlan(obj, raw) {
  const chars = [];
  const byName = new Map();
  const isNarr = (n) => /^narat(o|e)r$/i.test(String(n).trim());
  const addChar = (name, kind, outfit) => {
    name = cleanText(name).slice(0, 20);
    if (!name || isNarr(name)) return null;
    const key = name.toLowerCase();
    if (byName.has(key)) return byName.get(key);
    if (chars.length >= MAX_CHARS) return null;
    const idx = chars.length;
    const c = {
      name,
      kind: KINDS.includes(kind) ? kind : guessKind(name, idx),
      outfit: OUTFITS.includes(outfit) ? outfit : guessOutfit(name, idx),
    };
    chars.push(c);
    byName.set(key, c);
    return c;
  };
  (Array.isArray(obj && obj.characters) ? obj.characters : []).forEach((c) => addChar(c && c.name, c && c.kind, c && c.outfit));

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
      if (sp && !isNarr(sp)) { const c = addChar(sp, null, null); speaker = c ? c.name : "Narator"; }
      lines.push({ speaker, text, emotion: EMOTIONS.includes(l.emotion) ? l.emotion : guessEmotion(text) });
    });
    if (lines.length) scenes.push({ ...s, lines });
  });
  return {
    title: cleanText(obj && obj.title).slice(0, 80) || "Cerita Anak Ceria",
    mood: MOOD_KEYWORDS[obj && obj.mood] ? obj.mood : guessMood(raw),
    characters: chars,
    scenes,
  };
}

function ruleBasedPlan(raw, o) {
  const items = [];
  const chars = [];
  const seen = new Set();
  let curLoc = "halaman sekolah";
  raw.split(/\n+/).map((x) => x.trim()).filter(Boolean).forEach((row) => {
    if (/^\[.*\]$/.test(row)) return;
    const vis = row.match(/^Visual\s*[:：]\s*(.+)$/i);
    if (vis) { curLoc = vis[1].slice(0, 35); return; }
    const m = row.match(/^([\p{L}][\p{L}\p{N} .'’-]{0,24}?)\s*[:：]\s*(.+)$/u);
    if (m && wordCount(m[1]) <= 3) {
      const nm = m[1].trim();
      const narr = /^narat(o|e)r$/i.test(nm);
      if (!narr && !seen.has(nm.toLowerCase())) {
        seen.add(nm.toLowerCase());
        chars.push({ name: nm, kind: guessKind(nm, chars.length), outfit: guessOutfit(nm, chars.length) });
      }
      items.push({ speaker: narr ? "Narator" : nm, text: m[2].trim(), loc: curLoc });
    } else {
      (row.match(/[^.!?…]+[.!?…]*/g) || [row]).forEach((s) => { if (s.trim()) items.push({ speaker: "Narator", text: s.trim(), loc: curLoc }); });
    }
  });
  const per = Math.max(1, Math.ceil(items.length / o.maxScenes));
  const scenes = [];
  for (let i = 0; i < items.length; i += per) {
    const slice = items.slice(i, i + per);
    scenes.push({
      location: slice[0].loc || "halaman sekolah",
      time: "pagi",
      present: chars.map((c) => c.name).slice(0, MAX_PRESENT),
      lines: slice.map(({ speaker, text }) => ({ speaker, text })),
    });
  }
  return { title: (items[0] ? items[0].text : raw).slice(0, 60), mood: guessMood(raw), characters: chars, scenes };
}

function fillScene(s, i, cmap, fullText) {
  const location = cleanText(s.location).slice(0, 35) || "halaman sekolah";
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
  if (present.length === 1 && cmap.size > 1) {
    for (const c of cmap.values()) {
      add(c.name);
      if (present.length >= Math.min(3, MAX_PRESENT)) break;
    }
  }
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
  if (raw.length > MAX_RAW) throw new HttpError(400, `Naskah terlalu panjang (maksimal ${MAX_RAW} karakter).`);
  const o = normalizeOptions(body.options, env);
  const notes = [];
  let plan = null;
  try {
    const txt = await callLLM(env, systemPlan(o), `Naskah cerita anak:\n"""\n${raw}\n"""`);
    plan = normalizePlan(parseJSON(txt), raw);
  } catch (e) {
    notes.push("LLM gagal (" + e.message + "). Memakai pemecah naskah otomatis.");
  }
  if (!plan || !plan.scenes.length) {
    if (!notes.length) notes.push("LLM tidak menghasilkan adegan valid. Memakai pemecah naskah otomatis.");
    plan = normalizePlan(ruleBasedPlan(raw, o), raw);
  }
  while (plan.scenes.length > o.maxScenes) {
    const last = plan.scenes.pop();
    plan.scenes[plan.scenes.length - 1].lines.push(...last.lines);
    last.present.forEach((p) => {
      if (!plan.scenes[plan.scenes.length - 1].present.includes(p) && plan.scenes[plan.scenes.length - 1].present.length < MAX_PRESENT) {
        plan.scenes[plan.scenes.length - 1].present.push(p);
      }
    });
  }
  const cmap = new Map(plan.characters.map((c) => [c.name.toLowerCase(), c]));
  plan.scenes = plan.scenes.map((s, i) => fillScene(s, i, cmap, raw));
  if (enforceBudget(plan, o)) {
    notes.push(`Dialog diringkas agar video ±${o.targetSec} detik.`);
  }
  const seedBase = Math.floor(Math.random() * 900000) + 1000;
  plan.scenes.forEach((s, i) => {
    const core = s.bgPrompt || `${s.location}, ${s.time} daylight`;
    s.imagePrompt = `${core}, ${STYLE_PRESETS[o.style]}, empty background stage, no people, no humans, no characters, no text, no watermark, wide establishing shot, clear flat floor in foreground`.slice(0, 750);
    s.seed = seedBase + i * 31;
    s.id = i + 1;
    s.durationSec = Math.round(s.lines.reduce((a, l) => a + estimateDuration(l.text), 0) * 10) / 10;
  });
  const project = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), options: o, title: plan.title, mood: plan.mood, characters: plan.characters, scenes: plan.scenes };
  const total = project.scenes.reduce((a, s) => a + s.durationSec, 0);
  notes.push(`${project.characters.length} tokoh, ${project.scenes.length} adegan (in-frame), estimasi ±${Math.round(total)} detik, gaya "${o.style}".`);
  return { project, notes };
}

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
  throw new HttpError(502, "Gambar gagal dibuat — " + errors.join(" | "));
}

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
      try { ws.close(1000, "ok"); } catch (e) {}
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
        throw new HttpError(401, "Token akses salah atau belum diisi.");
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
        try { body = await request.json(); } catch (e) { throw new HttpError(400, "Data JSON tidak valid."); }
        const t0 = Date.now();
        const out = await agentPlan(body, env);
        return json({ ok: true, ...out, agent: "Agen 1 · Penulis Naskah & Sutradara", ms: Date.now() - t0 }, 200, cors);
      }

      if (url.pathname === "/api/image" && request.method === "GET") {
        const prompt = String(url.searchParams.get("prompt") || "").trim();
        if (prompt.length < 3) throw new HttpError(400, "Prompt gambar kosong.");
        const w = clamp(parseInt(url.searchParams.get("w")) || 1280, 256, 1280);
        const h = clamp(parseInt(url.searchParams.get("h")) || 720, 256, 1280);
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
        if (text.length > 220) throw new HttpError(400, "Potongan teks terlalu panjang.");
        const out = await genSpeech(env, { text, voice, pitch, rate, engine });
        const headers = { "Content-Type": "audio/mpeg", "X-Source": out.source, "Cache-Control": "public, max-age=86400", ...cors };
        if (out.edgeErr) headers["X-Edge-Error"] = out.edgeErr.replace(/[^\x20-\x7e]/g, "?").slice(0, 120);
        return new Response(out.buf, { headers });
      }

      if (url.pathname === "/api/fetch" && request.method === "GET") {
        const target = String(url.searchParams.get("url") || "");
        let u;
        try { u = new URL(target); } catch (e) { throw new HttpError(400, "URL musik tidak valid."); }
        if (u.protocol !== "https:") throw new HttpError(400, "URL musik harus https.");
        const res = await fetchT(u.toString(), { headers: { "User-Agent": UA } }, 25000);
        const type = res.headers.get("content-type") || "";
        if (!res.ok) throw new HttpError(502, "Musik tidak bisa diambil (HTTP " + res.status + ").");
        if (!/audio|octet-stream/i.test(type)) throw new HttpError(400, "URL bukan file audio.");
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 15 * 1024 * 1024) throw new HttpError(400, "File musik terlalu besar.");
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