/* =====================================================================
 *  worker.js — Studio Video AI · Cloudflare Worker LENGKAP (v6.1)
 *  Satu file, tanpa import. Upload apa adanya.
 *
 *  Rute:
 *    GET  /api/health?probe=1   status AI + uji suara Edge
 *    POST /api/plan             storytelling: pecah naskah jadi adegan,
 *                               lokasi, waktu, emosi, catatan visual
 *                               (teks naskah TIDAK ditulis ulang oleh AI)
 *    GET  /api/image            gambar latar (Workers AI, rantai cadangan)
 *    GET  /api/tts              suara Edge (natural) → cadangan Google TTS
 *    GET  /api/fetch?url=       proxy musik latar (MP3/OGG)
 *
 *  Wajib: binding Workers AI bernama AI  ([ai] binding = "AI")
 *  Opsional (Settings → Variables): APP_TOKEN, LLM_MODEL
 * ===================================================================== */

const VERSION = "6.1";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-app-token",
  "access-control-expose-headers": "x-source,x-edge-error",
  "access-control-max-age": "86400",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });
const msgOf = (e) => String((e && e.message) || e);
const clampInt = (n, a, b, d) => { n = parseInt(n, 10); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") return json({ ok: true, name: "Studio Video AI Worker", version: VERSION });
    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ ok: false, error: "Token akses salah atau belum diisi di Pengaturan." }, 401);
    }
    try {
      switch (url.pathname) {
        case "/api/health": return await health(url, env);
        case "/api/plan": return await plan(request, env);
        case "/api/image": return await image(url, env);
        case "/api/tts": return await tts(url);
        case "/api/fetch": return await proxy(url);
      }
      return json({ ok: false, error: "Rute tidak dikenal." }, 404);
    } catch (e) {
      return json({ ok: false, error: msgOf(e).slice(0, 300) }, 500);
    }
  },
};

/* ============================ HEALTH ============================ */
async function health(url, env) {
  const out = { ok: true, version: VERSION, ai: !!(env && env.AI), edge: null, image_models: Object.keys(MODELS) };
  if (url.searchParams.get("probe")) {
    try { await edgeTts("tes", "id-ID-ArdiNeural", 0, 0); out.edge = true; }
    catch (e) { out.edge = false; out.edge_error = msgOf(e).slice(0, 160); }
  }
  return json(out);
}

/* ====================== GAMBAR LATAR (Workers AI) ====================== */
const MODELS = {
  flux: { id: "@cf/black-forest-labs/flux-1-schnell", build: (p) => ({ prompt: p.prompt.slice(0, 2000), steps: 4 }) },
  lucid: { id: "@cf/leonardo/lucid-origin", build: (p) => ({ prompt: p.prompt, width: p.w, height: p.h, steps: 12, seed: p.seed }) },
  phoenix: { id: "@cf/leonardo/phoenix-1.0", build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, width: p.w, height: p.h, steps: 25, seed: p.seed }) },
  sdxlbase: { id: "@cf/stabilityai/stable-diffusion-xl-base-1.0", build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, width: p.w, height: p.h, num_steps: 20, guidance: 7.5, seed: p.seed }) },
};
const IMG_ALIASES = { sdxl: "flux", dreamshaper: "flux" }; // dihapus Cloudflare 20 Nov 2026
const IMG_CHAIN = ["flux", "lucid", "phoenix", "sdxlbase"];
const STYLE_TEXT = {
  animasi3d: "feature-film 3D animation look, warm cinematic lighting, rich depth of field",
  soft: "gentle storybook watercolor illustration, soft pastel colors, depth",
  komik: "bold clean ink comic illustration, flat colors, strong outlines",
  clay: "handmade claymation clay diorama, soft studio light, shallow depth of field",
  penanimasi: "hand-drawn pen and ink doodle sketch on cream paper, simple clean lines, flat pastel marker colors",
};
const NEGATIVE = "people, person, human, child, face, hands, text, letters, watermark, logo, blurry, deformed";
const snap8 = (n) => Math.round(n / 8) * 8;

function imageParams(url) {
  const q = url.searchParams;
  const style = STYLE_TEXT[q.get("style")] || STYLE_TEXT.animasi3d;
  const base = String(q.get("prompt") || "").trim().slice(0, 900) || "peaceful village scene";
  return {
    prompt: `${base}, ${style}, environment and props only, no people, no characters, no text, no watermark`,
    negative: NEGATIVE,
    w: snap8(clampInt(q.get("w"), 256, 1536, 720)),
    h: snap8(clampInt(q.get("h"), 256, 1536, 1280)),
    seed: clampInt(q.get("seed"), 0, 2147483647, 1),
  };
}
function sniffType(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp";
  return "image/jpeg";
}
function b64ToBytes(s) {
  const bin = atob(String(s).replace(/^data:[^,]+,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function toBytes(out) {
  if (out && typeof out === "object" && typeof out.image === "string") return b64ToBytes(out.image);
  if (typeof out === "string") return b64ToBytes(out);
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (out && typeof out.getReader === "function") return new Uint8Array(await new Response(out).arrayBuffer());
  throw new Error("format keluaran model tidak dikenali");
}
async function runImageModel(env, key, p) {
  const m = MODELS[key];
  try {
    return await env.AI.run(m.id, m.build(p));
  } catch (e) {
    const msg = msgOf(e);
    if (/5028|deprecated/i.test(msg)) throw e; // model sudah dihapus: lewati
    if (/5006|additional or unevaluated|not allowed|invalid|schema/i.test(msg)) return await env.AI.run(m.id, { prompt: p.prompt }); // skema berubah
    throw e;
  }
}
async function image(url, env) {
  const p = imageParams(url);
  const asked = IMG_ALIASES[url.searchParams.get("model")] || url.searchParams.get("model");
  const order = [...new Set([MODELS[asked] ? asked : "flux", ...IMG_CHAIN])];
  const errors = [];
  if (env && env.AI) {
    for (const key of order) {
      try {
        const bytes = await toBytes(await runImageModel(env, key, p));
        if (bytes.length < 1000) throw new Error("gambar kosong");
        return new Response(bytes, { headers: { "content-type": sniffType(bytes), "x-source": key, "cache-control": "no-store", ...CORS } });
      } catch (e) { errors.push(`${key}: ${msgOf(e).slice(0, 160)}`); }
    }
  } else errors.push('binding AI belum aktif ([ai] binding = "AI")');
  try {
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(p.prompt)}?width=${p.w}&height=${p.h}&seed=${p.seed}&nologo=true&model=flux`);
    if (!r.ok) throw new Error(`pollinations ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 1000) throw new Error("pollinations: gambar kosong");
    return new Response(bytes, { headers: { "content-type": sniffType(bytes), "x-source": "pollinations", "x-edge-error": errors.join(" | ").slice(0, 400), "cache-control": "no-store", ...CORS } });
  } catch (e) { errors.push(`pollinations: ${msgOf(e).slice(0, 120)}`); }
  return json({ ok: false, error: `Gambar gagal dibuat — ${errors.join(" | ")}` }, 502);
}

/* ====================== STORYTELLING /api/plan ======================
 * AI hanya MENATA: batas adegan, lokasi, waktu, emosi per baris, catatan
 * visual & gaya kamera. Kalimat naskah dipakai persis seperti ditulis. */
const LLM_CHAIN = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast", "@cf/meta/llama-3.1-8b-instruct"];
const EMOTIONS = ["normal", "senang", "sedih", "marah", "kaget"];
const TIMES = ["pagi", "siang", "sore", "malam"];
const CAMERA_KEYS = ["orbit", "dolly_in", "pan", "crane", "pull_back", "handheld", "rack_focus", "drift"];
const MAX_LLM_LINES = 400;

function parseScriptLines(script) {
  return String(script || "").replace(/\r/g, "").split("\n").map((r) => r.trim()).filter(Boolean).map((r) => {
    const m = r.match(/^([^:：]{1,24}?)\s*[:：]\s*(.+)$/);
    return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: "Narator", text: r };
  }).filter((l) => l.text);
}
function evenRanges(n, scenes) {
  const per = Math.max(1, Math.ceil(n / scenes)), ends = [];
  for (let e = per; e < n; e += per) ends.push(e);
  ends.push(n); return ends;
}
function extractJson(s) {
  if (s && typeof s === "object") return s;
  const t = String(s || ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("balasan AI bukan JSON");
  return JSON.parse(t.slice(a, b + 1));
}
async function askLlm(env, system, user) {
  const models = env.LLM_MODEL ? [env.LLM_MODEL, ...LLM_CHAIN] : LLM_CHAIN, errors = [];
  for (const model of models) {
    for (const withFormat of [true, false]) {
      try {
        const args = { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 3500, temperature: 0.35 };
        if (withFormat) args.response_format = { type: "json_object" };
        const out = await env.AI.run(model, args);
        return extractJson(out && out.response !== undefined ? out.response : out);
      } catch (e) { errors.push(`${model.split("/").pop()}: ${msgOf(e).slice(0, 90)}`); }
    }
  }
  throw new Error("AI cerita gagal — " + errors.slice(-3).join(" | "));
}

function buildPlan(lines, raw, opts) {
  const n = lines.length, wanted = clampInt(opts.maxScenes, 2, 48, 8);
  let ends = [], metas = [];
  if (raw && Array.isArray(raw.scenes)) {
    let last = 0;
    raw.scenes.forEach((s) => {
      const e = clampInt(s && s.end, 1, n, 0);
      if (e > last) { ends.push(e); metas.push(s || {}); last = e; }
    });
    if (last < n) { if (ends.length) ends[ends.length - 1] = n; else { ends.push(n); metas.push({}); } }
  }
  if (!ends.length || ends.length > 48) { ends = evenRanges(n, Math.min(wanted, n)); metas = ends.map(() => ({})); }
  let start = 0;
  const scenes = ends.map((end, i) => {
    const m = metas[i] || {}, emo = m.emotions && typeof m.emotions === "object" ? m.emotions : {};
    const sceneLines = lines.slice(start, end).map((l, k) => {
      const e = String(emo[String(start + k + 1)] || "normal").toLowerCase();
      return { speaker: l.speaker, text: l.text, emotion: EMOTIONS.includes(e) ? e : "normal" };
    });
    start = end;
    const time = String(m.time || "").toLowerCase();
    const cam = String(m.camera || "").toLowerCase();
    return {
      id: i + 1,
      location: String(m.location || "").slice(0, 60),
      time: TIMES.includes(time) ? time : "",
      hint: String(m.hint || "").replace(/\s+/g, " ").slice(0, 200),
      camera_style: CAMERA_KEYS.includes(cam) ? cam : "",
      lines: sceneLines,
    };
  }).filter((s) => s.lines.length);
  const names = new Map();
  scenes.forEach((s) => s.lines.forEach((l) => { if (!/^narat(o|e)r$/i.test(l.speaker) && !names.has(l.speaker.toLowerCase())) names.set(l.speaker.toLowerCase(), l.speaker); }));
  return {
    title: String((raw && raw.title) || "").replace(/\s+/g, " ").slice(0, 80),
    moral: String((raw && raw.moral) || "").slice(0, 200),
    genre: opts.genre || "anak",
    characters: [...names.values()].map((name) => ({ name })),
    scenes,
  };
}

const PLAN_SYSTEM = `Kamu sutradara & penata cerita film animasi. Tugasmu HANYA menata naskah yang sudah ada, bukan menulis ulang.
Balas JSON valid saja (tanpa teks lain, tanpa markdown) dengan bentuk:
{"title":"judul pendek","moral":"pesan inti 1 kalimat","scenes":[{"end":<nomor baris terakhir adegan ini>,"location":"tempat singkat bahasa Indonesia, mis. warung kecil / dapur rumah / sawah","time":"pagi|siang|sore|malam","camera":"orbit|dolly_in|pan|crane|pull_back|handheld|rack_focus|drift","hint":"catatan visual sinematik 1 kalimat bahasa Inggris: benda, cahaya, suasana, tanpa orang","emotions":{"<nomor baris>":"senang|sedih|marah|kaget"}}]}
Aturan:
- Adegan berurutan dan menutup semua baris; "end" harus naik dan adegan terakhir berakhir di baris terakhir.
- Pecah adegan saat tempat, waktu, atau suasana berubah. Variasikan "camera" antar adegan, jangan sama berturut-turut: orbit/dolly_in untuk momen emosional, pan/drift untuk pengenalan tempat, crane/pull_back untuk pembuka atau penutup, handheld untuk ketegangan, rack_focus untuk benda penting.
- "emotions" hanya untuk baris yang emosinya jelas (selain normal).
- Jangan mengubah, menambah, atau menghapus kalimat naskah.`;

async function plan(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Gunakan POST." }, 405);
  let body; try { body = await request.json(); } catch (e) { return json({ ok: false, error: "Badan permintaan bukan JSON." }, 400); }
  const lines = parseScriptLines(body && body.script).slice(0, 1500);
  if (!lines.length) return json({ ok: false, error: "Naskah kosong." }, 400);
  const opts = (body && body.options) || {};
  if (!env || !env.AI) return json({ ok: false, error: 'binding AI belum aktif ([ai] binding = "AI")' });
  if (lines.length > MAX_LLM_LINES) return json({ ok: false, error: `Naskah ${lines.length} baris terlalu panjang untuk penataan AI (maks ${MAX_LLM_LINES}); memakai penataan lokal.` });

  const wanted = clampInt(opts.maxScenes, 2, 48, 8);
  const listing = lines.map((l, i) => `${i + 1}. ${l.speaker}: ${l.text.slice(0, 220)}`).join("\n");
  const user = `Jumlah adegan yang diinginkan: sekitar ${wanted} (boleh kurang jika cerita pendek).\nGenre: ${opts.genre || "anak"}. Gaya visual: ${opts.style || "animasi3d"}. Target durasi: ${opts.targetSec || 120} detik.\n\nNASKAH (${lines.length} baris):\n${listing}`;
  let raw = null, note = "";
  try { raw = await askLlm(env, PLAN_SYSTEM, user); } catch (e) { return json({ ok: false, error: msgOf(e) }); }
  const project = buildPlan(lines, raw, opts);
  if (!project.scenes.length) return json({ ok: false, error: "AI tidak menghasilkan adegan yang valid." });
  return json({ ok: true, version: VERSION, note, project });
}

/* ============================ SUARA /api/tts ============================ */
const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_CHROMIUM = "130.0.2849.68";
const xmlEsc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const signed = (n, unit) => `${n >= 0 ? "+" : ""}${n}${unit}`;

async function secMsGec() {
  const unix = Math.floor(Date.now() / 1000) + 11644473600;
  const ticks = BigInt(unix - (unix % 300)) * 10000000n;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ticks}${EDGE_TOKEN}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function edgeTts(text, voice, pitch, rate) {
  const conn = crypto.randomUUID().replace(/-/g, "");
  const gec = await secMsGec();
  const major = EDGE_CHROMIUM.split(".")[0];
  const resp = await fetch(
    `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TOKEN}&ConnectionId=${conn}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-${EDGE_CHROMIUM}`,
    {
      headers: {
        Upgrade: "websocket",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 Edg/${major}.0.0.0`,
        Pragma: "no-cache", "Cache-Control": "no-cache",
      },
    }
  );
  const ws = resp.webSocket;
  if (!ws) throw new Error(`Edge menolak koneksi (HTTP ${resp.status})`);
  ws.accept();
  const lang = voice.split("-").slice(0, 2).join("-");
  const stamp = () => new Date().toISOString();
  return await new Promise((resolve, reject) => {
    const chunks = [], dec = new TextDecoder();
    let done = false;
    const finish = (err) => {
      if (done) return; done = true; clearTimeout(timer);
      try { ws.close(1000, "ok"); } catch (e) { /* abaikan */ }
      if (err) return reject(err);
      const total = chunks.reduce((n, c) => n + c.length, 0);
      if (!total) return reject(new Error("Edge tidak mengirim audio"));
      const out = new Uint8Array(total); let o = 0; chunks.forEach((c) => { out.set(c, o); o += c.length; });
      resolve(out);
    };
    const timer = setTimeout(() => finish(new Error("Edge timeout")), 15000);
    ws.addEventListener("message", (ev) => {
      const d = ev.data;
      if (typeof d === "string") { if (d.includes("Path:turn.end")) finish(); return; }
      const buf = d instanceof ArrayBuffer ? d : d && d.buffer ? d.buffer : null;
      if (!buf || buf.byteLength < 2) return;
      const hl = new DataView(buf).getUint16(0);
      if (dec.decode(buf.slice(2, 2 + hl)).includes("Path:audio")) chunks.push(new Uint8Array(buf.slice(2 + hl)));
    });
    ws.addEventListener("error", () => finish(new Error("Edge: koneksi WebSocket error")));
    ws.addEventListener("close", () => finish());
    ws.send(`X-Timestamp:${stamp()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
    ws.send(`X-RequestId:${conn}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp()}Z\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='${signed(pitch, "Hz")}' rate='${signed(rate, "%")}' volume='+0%'>${xmlEsc(text)}</prosody></voice></speak>`);
  });
}

function splitForGoogle(text, max = 190) {
  const parts = []; let rest = text.trim();
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf(". ", max), rest.lastIndexOf(", ", max), rest.lastIndexOf(" ", max));
    if (cut < 40) cut = max;
    parts.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
async function googleTts(text, tl) {
  const bufs = [];
  for (const part of splitForGoogle(text)) {
    const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(part)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", Referer: "https://translate.google.com/" },
    });
    if (!r.ok) throw new Error(`Google TTS ${r.status}`);
    bufs.push(new Uint8Array(await r.arrayBuffer()));
  }
  const total = bufs.reduce((n, b) => n + b.length, 0);
  if (!total) throw new Error("Google TTS kosong");
  const out = new Uint8Array(total); let o = 0; bufs.forEach((b) => { out.set(b, o); o += b.length; });
  return out;
}
const audio = (bytes, source, edgeErr = "") =>
  new Response(bytes, { headers: { "content-type": "audio/mpeg", "x-source": source, ...(edgeErr ? { "x-edge-error": edgeErr.slice(0, 200) } : {}), "cache-control": "no-store", ...CORS } });

async function tts(url) {
  const q = url.searchParams;
  const text = String(q.get("text") || "").replace(/\s+/g, " ").trim().slice(0, 700);
  if (!text) return json({ ok: false, error: "Teks suara kosong." }, 400);
  const v = q.get("voice") || "";
  const voice = /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(v) ? v : "id-ID-ArdiNeural";
  const pitch = clampInt(q.get("pitch"), -100, 100, 0), rate = clampInt(q.get("rate"), -50, 50, 0);
  let edgeErr = "";
  if (q.get("engine") !== "google") {
    try { return audio(await edgeTts(text, voice, pitch, rate), "edge-tts"); }
    catch (e) { edgeErr = msgOf(e); }
  }
  try { return audio(await googleTts(text, voice.startsWith("en") ? "en" : "id"), "google-tts", edgeErr); }
  catch (e) { return json({ ok: false, error: `Suara gagal — edge: ${edgeErr || "-"} | google: ${msgOf(e)}` }, 502); }
}

/* ======================== PROXY MUSIK /api/fetch ======================== */
function privateHost(h) {
  h = h.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "[::1]" || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}
async function proxy(url) {
  let u; try { u = new URL(url.searchParams.get("url") || ""); } catch (e) { return json({ ok: false, error: "URL musik tidak valid." }, 400); }
  if (!/^https?:$/.test(u.protocol) || privateHost(u.hostname)) return json({ ok: false, error: "URL musik tidak diizinkan." }, 403);
  const r = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return json({ ok: false, error: `Sumber musik membalas ${r.status}.` }, 502);
  if (Number(r.headers.get("content-length") || 0) > 30e6) return json({ ok: false, error: "File musik terlalu besar (maks 30 MB)." }, 413);
  return new Response(r.body, { headers: { "content-type": r.headers.get("content-type") || "audio/mpeg", "x-source": "proxy", "cache-control": "public, max-age=3600", ...CORS } });
}
