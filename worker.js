/* =====================================================================
 *  worker.js — "OTAK UTAMA" Sistem Produksi Video Otomatis Multi-Agent
 *  Platform : Cloudflare Workers (ES Module)
 * =====================================================================
 *
 *  ENVIRONMENT VARIABLES / SECRETS (Settings → Variables and Secrets)
 *  ---------------------------------------------------------------------
 *  SECRET  JSON2VIDEO_API_KEY   WAJIB  — perakit video (Agen 5)
 *  SECRET  APP_TOKEN            sangat disarankan — kata sandi akses dari frontend
 *  SECRET  ELEVENLABS_API_KEY   opsional — suara ElevenLabs langsung (Agen 3)
 *  SECRET  PEXELS_API_KEY       opsional — gambar cadangan (Agen 2)
 *  SECRET  LLM_API_KEY          opsional — LLM OpenAI-compatible (Groq, Gemini, OpenRouter, dll)
 *  SECRET  POLLINATIONS_TOKEN   opsional — jika Pollinations meminta token
 *
 *  VAR     LLM_API_URL          mis. https://api.groq.com/openai/v1/chat/completions
 *  VAR     LLM_MODEL            mis. llama-3.3-70b-versatile
 *  VAR     TTS_PROVIDER         "azure" (default, lewat JSON2Video) | "elevenlabs"
 *  VAR     ELEVEN_VOICE_FEMALE  voice_id ElevenLabs (default: Rachel)
 *  VAR     ELEVEN_VOICE_MALE    voice_id ElevenLabs (default: Adam)
 *  VAR     ELEVEN_MODEL         default eleven_multilingual_v2
 *  VAR     IMAGE_URL_TEMPLATE   ganti generator gambar; pakai {prompt} {w} {h} {seed}
 *  VAR     POLLINATIONS_MODEL   default "flux"
 *  VAR     MUSIC_LIBRARY        JSON: {"tenang":"https://..mp3","dramatis":"https://..mp3","default":"https://..mp3"}
 *  VAR     MUSIC_URL            satu URL musik untuk semua mood
 *  VAR     MUSIC_VOLUME         0.05–0.4 (default 0.12)
 *  VAR     MAX_SCENES           batas adegan (default 12)
 *  VAR     ALLOWED_ORIGIN       default "*"
 *
 *  BINDINGS (opsional)
 *  AI  → Workers AI   (LLM gratis bawaan Cloudflare)
 *  KV  → KV Namespace (menyimpan MP3 ElevenLabs sementara agar bisa diambil JSON2Video)
 * ===================================================================== */

const VERSION = "1.0.0";

/* ------------------------------ KONSTANTA ------------------------------ */
const STYLE_PRESETS = {
  cinematic: "cinematic film still, dramatic volumetric lighting, shallow depth of field, anamorphic lens, rich color grading, ultra detailed",
  anime: "high quality anime movie frame, soft cel shading, vibrant colors, detailed painted background, studio-grade animation look",
  animasi3d: "3D animated feature film render, stylized characters, soft global illumination, expressive faces, polished studio animation look",
  cat_air: "delicate watercolor storybook illustration, soft washes, paper texture, gentle gradients",
  realistis: "photorealistic documentary photograph, natural light, sharp focus, true-to-life colors, high detail",
};
const CAMERAS = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "pan_down", "static"];
const TRANSITIONS = ["fade", "fadeblack", "dissolve", "slideleft", "slideright", "wipeleft", "wiperight"];
const SPEAKERS = ["narrator", "character_a", "character_b"];
const MOOD_KEYWORDS = {
  sedih: ["sedih", "menangis", "kehilangan", "duka", "air mata", "sepi", "rindu"],
  ceria: ["senang", "bahagia", "tertawa", "ceria", "gembira", "riang", "main"],
  dramatis: ["tegang", "marah", "bahaya", "takut", "konflik", "kejar", "ledak"],
  epik: ["perang", "pahlawan", "petualangan", "kerajaan", "pertempuran", "legenda"],
  misteri: ["misteri", "gelap", "rahasia", "bayangan", "hilang", "aneh", "malam"],
  inspiratif: ["bangkit", "berjuang", "mimpi", "harapan", "sukses", "semangat", "belajar"],
  tenang: ["tenang", "damai", "pagi", "sunyi", "alam", "pantai", "hujan", "embun"],
};
const MAX_RAW = 6000;

class HttpError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/* ------------------------------ UTILITAS ------------------------------ */
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const wordCount = (t) => (String(t).trim().match(/\S+/g) || []).length;
const estimateDuration = (t) => Math.round(clamp(wordCount(t) / 2.5 + 0.8, 3, 25) * 10) / 10;
const dims = (ratio) => (ratio === "9:16" ? { w: 720, h: 1280 } : { w: 1280, h: 720 });

function hashInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % 900000 + 1000;
}

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-app-token",
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
  let best = "tenang";
  let bestScore = 0;
  for (const [mood, words] of Object.entries(MOOD_KEYWORDS)) {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  return bestScore ? best : "inspiratif";
}

function cleanForTTS(t) {
  return String(t).replace(/[*_#`~>\[\]{}|]/g, " ").replace(/\s+/g, " ").trim();
}

/* ------------------------------ LLM (dengan fallback berlapis) ------------------------------ */
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
    try {
      return await openAiChat(env.LLM_API_URL, env.LLM_API_KEY, env.LLM_MODEL || "llama-3.3-70b-versatile", messages);
    } catch (e) { errors.push("LLM kustom: " + e.message); }
  }
  if (env.AI) {
    try {
      const r = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", { messages, max_tokens: 2500 });
      if (r && r.response) return r.response;
      throw new Error("respons kosong");
    } catch (e) { errors.push("Workers AI: " + e.message); }
  }
  try {
    return await openAiChat("https://text.pollinations.ai/openai", null, "openai", messages);
  } catch (e) { errors.push("Pollinations: " + e.message); }
  throw new Error(errors.join(" | "));
}

/* ------------------------------ OPSI ------------------------------ */
function normalizeOptions(o, env) {
  o = o || {};
  const maxCap = parseInt(env.MAX_SCENES) || 12;
  return {
    style: STYLE_PRESETS[o.style] ? o.style : "cinematic",
    voice: ["id_female", "id_male", "en_female", "en_male"].includes(o.voice) ? o.voice : "id_female",
    ratio: o.ratio === "9:16" ? "9:16" : "16:9",
    maxScenes: clamp(parseInt(o.maxScenes) || 6, 1, maxCap),
    musicUrl: /^https:\/\/\S+$/.test(String(o.musicUrl || "").trim()) ? String(o.musicUrl).trim() : "",
  };
}

/* =====================================================================
 *  AGEN 1 — SCRIPT & SCENE DIRECTOR
 * ===================================================================== */
function systemScript(o) {
  return `Kamu adalah Script & Scene Director untuk produksi video. Pecah naskah mentah menjadi maksimal ${o.maxScenes} adegan.
Aturan:
- Pertahankan bahasa dan isi naskah asli; jangan menambah fakta baru. Kamu boleh merapikan kalimat agar enak dibaca keras.
- Tiap adegan 15–45 kata narasi (kecuali naskah sangat pendek).
- speaker: "narrator", "character_a", atau "character_b" (pakai karakter hanya jika naskah berisi dialog).
- mood adegan salah satu dari: tenang, ceria, dramatis, epik, sedih, misteri, inspiratif.
- camera salah satu dari: ${CAMERAS.join(", ")}.
- transition salah satu dari: ${TRANSITIONS.join(", ")}.
- Variasikan camera dan transition antar adegan supaya gerakan terasa halus dan tidak monoton.
Balas HANYA JSON valid tanpa teks lain, dengan format:
{"title":"...","mood":"mood keseluruhan","scenes":[{"narration":"...","speaker":"narrator","mood":"...","durationSec":6,"camera":"zoom_in","transition":"fade"}]}`;
}

function normalizePlan(obj, raw, o) {
  const list = Array.isArray(obj && obj.scenes) ? obj.scenes : [];
  const scenes = [];
  list.forEach((s, i) => {
    const narration = String((s && s.narration) || "").trim();
    if (!narration) return;
    if (scenes.length >= o.maxScenes) {
      scenes[scenes.length - 1].narration += " " + narration; // jangan buang isi naskah
      return;
    }
    scenes.push({
      narration,
      speaker: SPEAKERS.includes(s.speaker) ? s.speaker : "narrator",
      mood: MOOD_KEYWORDS[s.mood] ? s.mood : guessMood(narration),
      durationSec: clamp(Number(s.durationSec) || estimateDuration(narration), 3, 25),
      camera: CAMERAS.includes(s.camera) ? s.camera : CAMERAS[i % 6],
      transition: TRANSITIONS.includes(s.transition) ? s.transition : "fade",
    });
  });
  return { title: String((obj && obj.title) || "Video Tanpa Judul").slice(0, 80), mood: MOOD_KEYWORDS[obj && obj.mood] ? obj.mood : guessMood(raw), scenes };
}

function ruleBasedPlan(raw, o) {
  const sentences = raw.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]*/g) || [raw];
  const target = Math.max(12, Math.ceil(wordCount(raw) / o.maxScenes));
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    cur = (cur + " " + s).trim();
    if (wordCount(cur) >= target && chunks.length < o.maxScenes - 1) {
      chunks.push(cur);
      cur = "";
    }
  }
  if (cur) chunks.push(cur);
  const scenes = chunks.map((narration, i) => ({
    narration,
    speaker: "narrator",
    mood: guessMood(narration),
    durationSec: estimateDuration(narration),
    camera: CAMERAS[i % 6],
    transition: ["fade", "dissolve", "slideleft", "fade"][i % 4],
  }));
  return { title: sentences[0].trim().slice(0, 60), mood: guessMood(raw), scenes };
}

async function agentScript(body, ctx) {
  const raw = String(body.script || "").trim();
  if (raw.length < 20) throw new HttpError(400, "Naskah terlalu pendek (minimal 20 karakter).");
  if (raw.length > MAX_RAW) throw new HttpError(400, `Naskah terlalu panjang (maksimal ${MAX_RAW} karakter). Pecah menjadi beberapa video.`);
  const o = normalizeOptions(body.options, ctx.env);
  const notes = [];
  let plan = null;
  try {
    const txt = await callLLM(ctx.env, systemScript(o), `Naskah mentah:\n"""\n${raw}\n"""`);
    plan = normalizePlan(parseJSON(txt), raw, o);
  } catch (e) {
    notes.push("LLM gagal (" + e.message + "). Memakai pemecah naskah otomatis.");
  }
  if (!plan || !plan.scenes.length) {
    if (!notes.length) notes.push("LLM tidak menghasilkan adegan valid. Memakai pemecah naskah otomatis.");
    plan = ruleBasedPlan(raw, o);
  }
  const project = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    options: o,
    title: plan.title,
    mood: plan.mood,
    scenes: plan.scenes.map((s, i) => ({ id: i + 1, ...s })),
  };
  const total = project.scenes.reduce((a, s) => a + s.durationSec, 0);
  notes.push(`${project.scenes.length} adegan, estimasi durasi ${Math.round(total)} detik, mood "${project.mood}".`);
  return { project, notes };
}

/* =====================================================================
 *  AGEN 2 — VISUAL ART DIRECTOR (+ pemeriksa gambar)
 * ===================================================================== */
function buildImageUrl(env, prompt, seed, w, h) {
  const p = String(prompt).slice(0, 700);
  if (env.IMAGE_URL_TEMPLATE) {
    return env.IMAGE_URL_TEMPLATE.replace("{prompt}", encodeURIComponent(p)).replace("{w}", w).replace("{h}", h).replace("{seed}", seed);
  }
  let u = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=${encodeURIComponent(env.POLLINATIONS_MODEL || "flux")}`;
  if (env.POLLINATIONS_TOKEN) u += "&token=" + encodeURIComponent(env.POLLINATIONS_TOKEN);
  return u;
}

function systemVisual(o) {
  return `Kamu adalah Visual Art Director. Tulis prompt pembuat gambar dalam BAHASA INGGRIS untuk setiap adegan.
Aturan:
- Gaya WAJIB konsisten di seluruh adegan: ${STYLE_PRESETS[o.style]}.
- Buat "characterBible": satu deskripsi tetap (usia, rambut, pakaian, warna) untuk tokoh/objek utama, lalu ulangi ciri itu di setiap prompt agar tokoh terlihat sama.
- Setiap prompt 35–70 kata: subjek, aksi, lokasi, pencahayaan, sudut kamera, suasana sesuai mood. Jangan sertakan teks/tulisan di gambar, jangan sebut merek atau tokoh terkenal.
- "query": 2–4 kata Inggris untuk pencarian foto stok sebagai cadangan.
Balas HANYA JSON: {"characterBible":"...","prompts":[{"id":1,"prompt":"...","query":"..."}]}`;
}

async function agentVisual(body, ctx) {
  const project = requireProject(body);
  const o = project.options;
  const { w, h } = dims(o.ratio);
  const notes = [];
  let prompts = [];
  let bible = "";
  try {
    const list = project.scenes.map((s) => `Adegan ${s.id} (mood ${s.mood}, kamera ${s.camera}): ${s.narration}`).join("\n");
    const out = parseJSON(await callLLM(ctx.env, systemVisual(o), `Judul: ${project.title}\nMood: ${project.mood}\n\n${list}`));
    prompts = Array.isArray(out.prompts) ? out.prompts : [];
    bible = String(out.characterBible || "");
  } catch (e) {
    notes.push("LLM visual gagal (" + e.message + "). Memakai prompt dasar dari narasi.");
  }
  const base = hashInt(project.id);
  project.scenes.forEach((s, i) => {
    const p = prompts.find((x) => Number(x.id) === s.id) || prompts[i] || {};
    const core = String(p.prompt || "").trim() || `Scene illustrating: ${s.narration}`;
    s.visualPrompt = `${core}, ${STYLE_PRESETS[o.style]}`.slice(0, 700);
    s.query = String(p.query || "").trim() || core.split(/\s+/).slice(0, 4).join(" ");
    s.seed = base + i * 31;
    s.imageUrl = buildImageUrl(ctx.env, s.visualPrompt, s.seed, w, h);
    s.imageSource = ctx.env.IMAGE_URL_TEMPLATE ? "custom" : "pollinations";
    s.imageOk = null;
  });
  project.characterBible = bible;
  notes.push(`Prompt visual siap untuk ${project.scenes.length} adegan (gaya: ${o.style}).`);
  return { project, notes };
}

async function probeImage(url) {
  try {
    const res = await fetchT(url, { method: "GET" }, 50000);
    const ok = res.ok && /^image\//i.test(res.headers.get("content-type") || "");
    if (res.body) res.body.cancel().catch(() => {});
    return ok;
  } catch (e) {
    return false;
  }
}

async function pexelsSearch(env, query, ratio) {
  if (!env.PEXELS_API_KEY) return null;
  try {
    const orient = ratio === "9:16" ? "portrait" : "landscape";
    const res = await fetchT(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orient}&per_page=3`,
      { headers: { Authorization: env.PEXELS_API_KEY } },
      15000
    );
    if (!res.ok) return null;
    const d = await res.json();
    const ph = d.photos && d.photos[0];
    return ph ? ph.src.large2x || ph.src.large || ph.src.original : null;
  } catch (e) {
    return null;
  }
}

async function agentCheck(body, ctx) {
  const project = requireProject(body);
  const scene = project.scenes.find((s) => s.id === Number(body.sceneId));
  if (!scene) throw new HttpError(400, "Adegan tidak ditemukan untuk diperiksa.");
  const { w, h } = dims(project.options.ratio);
  const notes = [];
  let ok = await probeImage(scene.imageUrl);
  if (!ok) {
    scene.seed += 7919;
    scene.imageUrl = buildImageUrl(ctx.env, scene.visualPrompt, scene.seed, w, h);
    ok = await probeImage(scene.imageUrl);
    notes.push(`Adegan ${scene.id}: percobaan ulang dengan seed baru ${ok ? "berhasil" : "gagal"}.`);
  }
  if (!ok) {
    const alt = await pexelsSearch(ctx.env, scene.query, project.options.ratio);
    if (alt) {
      scene.imageUrl = alt;
      scene.imageSource = "pexels";
      ok = true;
      notes.push(`Adegan ${scene.id}: memakai foto cadangan Pexels.`);
    }
  }
  scene.imageOk = ok;
  if (!ok) notes.push(`Adegan ${scene.id}: gambar gagal dibuat. Adegan ini memakai latar polos supaya render tidak gagal (ulangi produksi nanti jika ingin gambarnya).`);
  else if (!notes.length) notes.push(`Adegan ${scene.id}: gambar siap.`);
  return { project, notes };
}

/* =====================================================================
 *  AGEN 3 — VOICE ACTOR (TTS)
 * ===================================================================== */
function voiceSpec(env, voiceKey, speaker) {
  const [lang, gender0] = voiceKey.split("_");
  let gender = gender0;
  if (speaker === "character_b") gender = gender === "female" ? "male" : "female";
  const azure = {
    id: { female: "id-ID-GadisNeural", male: "id-ID-ArdiNeural" },
    en: { female: "en-US-JennyNeural", male: "en-US-GuyNeural" },
  }[lang][gender];
  const eleven = gender === "female" ? env.ELEVEN_VOICE_FEMALE || "21m00Tcm4TlvDq8ikWAM" : env.ELEVEN_VOICE_MALE || "pNInz6obpgDQGcFmaJgB";
  return { azure, eleven };
}

async function elevenSynth(env, text, voiceId, origin) {
  const res = await fetchT(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: env.ELEVEN_MODEL || "eleven_multilingual_v2" }),
    },
    40000
  );
  if (!res.ok) {
    const msg = res.status === 401 ? "API key ElevenLabs ditolak" : res.status === 429 ? "kuota/limit ElevenLabs habis" : "HTTP " + res.status;
    throw new Error(msg);
  }
  const audio = await res.arrayBuffer();
  const id = crypto.randomUUID();
  await env.KV.put("audio:" + id, audio, { expirationTtl: 86400 });
  return `${origin}/audio/${id}.mp3`;
}

async function agentVoice(body, ctx) {
  const project = requireProject(body);
  const env = ctx.env;
  const notes = [];
  let provider = (env.TTS_PROVIDER || "azure").toLowerCase();
  if (provider === "elevenlabs" && (!env.ELEVENLABS_API_KEY || !env.KV)) {
    notes.push("ElevenLabs dipilih tetapi ELEVENLABS_API_KEY atau binding KV belum ada. Beralih ke suara bawaan JSON2Video.");
    provider = "azure";
  }
  let chars = 0;
  for (const s of project.scenes) {
    s.ttsText = cleanForTTS(s.narration);
    chars += s.ttsText.length;
    const spec = voiceSpec(env, project.options.voice, s.speaker);
    s.voice = { provider: "azure", voice: spec.azure };
    if (provider === "elevenlabs") {
      try {
        const url = await elevenSynth(env, s.ttsText, spec.eleven, ctx.origin);
        s.voice = { provider: "elevenlabs", voice: spec.eleven, audioUrl: url };
      } catch (e) {
        notes.push(`Adegan ${s.id}: ElevenLabs gagal (${e.message}). Memakai suara cadangan JSON2Video.`);
      }
    }
  }
  const used = project.scenes.filter((s) => s.voice.provider === "elevenlabs").length;
  notes.push(`Suara siap: ${used} adegan via ElevenLabs, ${project.scenes.length - used} adegan via JSON2Video. Total ${chars} karakter.`);
  return { project, notes };
}

/* =====================================================================
 *  AGEN 4 — MUSIC & SOUND DIRECTOR
 * ===================================================================== */
async function agentMusic(body, ctx) {
  const project = requireProject(body);
  const env = ctx.env;
  const notes = [];
  let url = project.options.musicUrl;
  let source = "input pengguna";
  if (!url && env.MUSIC_LIBRARY) {
    try {
      const lib = JSON.parse(env.MUSIC_LIBRARY);
      url = lib[project.mood] || lib.default || "";
      source = "MUSIC_LIBRARY (" + (lib[project.mood] ? project.mood : "default") + ")";
    } catch (e) {
      notes.push("MUSIC_LIBRARY bukan JSON valid, diabaikan.");
    }
  }
  if (!url && env.MUSIC_URL) {
    url = env.MUSIC_URL;
    source = "MUSIC_URL";
  }
  const volume = clamp(parseFloat(env.MUSIC_VOLUME) || 0.12, 0.03, 0.5);
  if (url) {
    project.music = { url, volume, source };
    notes.push(`Musik latar dipilih dari ${source}, volume ${volume} (rendah agar narasi tetap jelas).`);
  } else {
    project.music = null;
    notes.push("Tidak ada URL musik. Video dirender tanpa musik latar (isi kolom Musik atau MUSIC_URL untuk menambahkan).");
  }
  return { project, notes };
}

/* =====================================================================
 *  AGEN 5 — VIDEO ASSEMBLY & RENDER ENGINEER (JSON2Video)
 * ===================================================================== */
function cameraProps(cam) {
  switch (cam) {
    case "zoom_in": return { zoom: 2 };
    case "zoom_out": return { zoom: -2 };
    case "pan_left": return { pan: "left" };
    case "pan_right": return { pan: "right" };
    case "pan_up": return { pan: "top" };
    case "pan_down": return { pan: "bottom" };
    default: return {};
  }
}

function buildMovie(project) {
  const { w, h } = dims(project.options.ratio);
  const scenes = project.scenes.map((s, i) => {
    const elements = [];
    if (s.imageOk !== false) {
      elements.push({ type: "image", src: s.imageUrl, resize: "cover", duration: -2, ...cameraProps(s.camera) });
    }
    if (s.voice && s.voice.provider === "elevenlabs" && s.voice.audioUrl) {
      elements.push({ type: "audio", src: s.voice.audioUrl, volume: 1 });
    } else {
      elements.push({ type: "voice", text: s.ttsText || cleanForTTS(s.narration), voice: (s.voice && s.voice.voice) || "id-ID-GadisNeural", model: "azure" });
    }
    const scene = { comment: `Adegan ${s.id}`, "background-color": "#0b0f1a", duration: -1, elements };
    if (i > 0) scene.transition = { style: s.transition || "fade", duration: 0.5 };
    return scene;
  });
  const movie = { comment: project.title, resolution: "custom", width: w, height: h, quality: "high", scenes };
  if (project.music && project.music.url) {
    movie.elements = [{ type: "audio", src: project.music.url, volume: project.music.volume, loop: -1, duration: -2 }];
  }
  return movie;
}

async function agentAssemble(body, ctx) {
  const project = requireProject(body);
  const key = ctx.env.JSON2VIDEO_API_KEY;
  if (!key) throw new HttpError(500, "JSON2VIDEO_API_KEY belum diatur di Cloudflare Secrets.");
  if (project.scenes.some((s) => !s.imageUrl)) throw new HttpError(400, "Ada adegan tanpa gambar. Ulangi dari tahap Visual.");
  const movie = buildMovie(project);
  let res;
  try {
    res = await fetchT("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(movie),
    }, 30000);
  } catch (e) {
    throw new HttpError(502, "Tidak bisa menghubungi JSON2Video: " + e.message);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const why = data.message || data.error || "HTTP " + res.status;
    throw new HttpError(502, "JSON2Video menolak permintaan: " + why, { movie });
  }
  project.renderId = data.project;
  project.movie = movie;
  return { project, notes: [`Dikirim ke JSON2Video (id ${data.project}). Render berjalan di cloud.`] };
}

async function renderStatus(env, id) {
  if (!env.JSON2VIDEO_API_KEY) throw new HttpError(500, "JSON2VIDEO_API_KEY belum diatur.");
  if (!id || !/^[\w-]{4,64}$/.test(id)) throw new HttpError(400, "ID render tidak valid.");
  const res = await fetchT(`https://api.json2video.com/v2/movies?project=${encodeURIComponent(id)}`, { headers: { "x-api-key": env.JSON2VIDEO_API_KEY } }, 20000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, "Gagal membaca status render: " + (data.message || "HTTP " + res.status));
  const m = data.movie || {};
  return { status: m.status || "running", url: m.url || null, message: m.message || null, raw: m };
}

/* =====================================================================
 *  OTAK UTAMA (ORCHESTRATOR)
 *  Frontend memanggil tahap satu per satu; state proyek mengalir lewat JSON.
 *  Orchestrator mengatur retry, pencatatan waktu, dan pesan galat yang jelas.
 * ===================================================================== */
const STAGES = {
  script: ["Agen 1 · Script & Scene Director", agentScript],
  visual: ["Agen 2 · Visual Art Director", agentVisual],
  check: ["Agen 2 · Pemeriksa Gambar", agentCheck],
  voice: ["Agen 3 · Voice Actor", agentVoice],
  music: ["Agen 4 · Music & Sound Director", agentMusic],
  assemble: ["Agen 5 · Video Assembly", agentAssemble],
};

function requireProject(body) {
  const p = body && body.project;
  if (!p || !Array.isArray(p.scenes) || !p.scenes.length) throw new HttpError(400, "State proyek tidak ada atau rusak. Mulai ulang dari awal.");
  return p;
}

async function orchestrate(stage, body, ctx) {
  const entry = STAGES[stage];
  if (!entry) throw new HttpError(404, "Tahap tidak dikenal: " + stage);
  const [label, fn] = entry;
  const t0 = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await fn(body, ctx);
      out.agent = label;
      out.ms = Date.now() - t0;
      return out;
    } catch (e) {
      if (e instanceof HttpError) throw e; // galat yang sudah jelas, jangan diulang
      lastErr = e;
    }
  }
  throw new HttpError(500, `${label} gagal tak terduga: ${lastErr && lastErr.message}`);
}

/* ------------------------------ ROUTER ------------------------------ */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const ctx = { env, origin: url.origin };
    try {
      // Audio ElevenLabs yang disimpan sementara (publik, id acak, kedaluwarsa 24 jam)
      const am = url.pathname.match(/^\/audio\/([\w-]+)\.mp3$/);
      if (am && env.KV) {
        const buf = await env.KV.get("audio:" + am[1], "arrayBuffer");
        if (!buf) throw new HttpError(404, "Audio tidak ditemukan atau sudah kedaluwarsa.");
        return new Response(buf, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600", ...cors } });
      }
      if (!url.pathname.startsWith("/api/")) {
        return json({ ok: true, service: "Otak Utama Studio Video AI", version: VERSION }, 200, cors);
      }
      if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
        throw new HttpError(401, "Token akses salah atau belum diisi. Periksa kolom Token di Pengaturan.");
      }
      if (url.pathname === "/api/health") {
        return json({
          ok: true,
          version: VERSION,
          configured: {
            json2video: !!env.JSON2VIDEO_API_KEY,
            llm_kustom: !!(env.LLM_API_URL && env.LLM_API_KEY),
            workers_ai: !!env.AI,
            elevenlabs: !!env.ELEVENLABS_API_KEY && !!env.KV,
            pexels: !!env.PEXELS_API_KEY,
            musik: !!(env.MUSIC_URL || env.MUSIC_LIBRARY),
            tts_provider: env.TTS_PROVIDER || "azure",
          },
        }, 200, cors);
      }
      if (url.pathname === "/api/status" && request.method === "GET") {
        return json({ ok: true, ...(await renderStatus(env, url.searchParams.get("project"))) }, 200, cors);
      }
      const sm = url.pathname.match(/^\/api\/stage\/(\w+)$/);
      if (sm && request.method === "POST") {
        let body;
        try { body = await request.json(); } catch (e) { throw new HttpError(400, "Data yang dikirim bukan JSON valid."); }
        return json({ ok: true, ...(await orchestrate(sm[1], body, ctx)) }, 200, cors);
      }
      throw new HttpError(404, "Alamat API tidak ditemukan.");
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : "Kesalahan internal Worker: " + (e && e.message);
      return json({ ok: false, error: message, detail: e.detail || null }, status, cors);
    }
  },
};
