/* =====================================================================
 *  Cloudflare Worker — Studio Video AI v5 Pro Backend
 *  Endpoint:
 *    - GET  /api/health
 *    - POST /api/plan
 *    - GET  /api/tts
 *    - GET  /api/image
 *    - GET  /api/fetch
 * ===================================================================== */

const VERSION = "5.1.0-pro";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-app-token",
  "Access-Control-Expose-Headers": "x-source, x-edge-error",
};

function jsonRes(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function checkAuth(request, env) {
  const requiredToken = env && env.APP_TOKEN ? String(env.APP_TOKEN).trim() : "";
  if (!requiredToken) return true;
  const sent = (request.headers.get("x-app-token") || "").trim();
  return sent === requiredToken;
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

async function edgeTts({ text, voice, pitch = 0, rate = 0 }) {
  const cleanText = String(text || "").trim().slice(0, 600);
  if (!cleanText) throw new Error("Teks TTS kosong.");

  const safeVoice = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/.test(voice || "")
    ? voice
    : "id-ID-ArdiNeural";

  const pInt = clampInt(pitch, -80, 80, 0);
  const rInt = clampInt(rate, -40, 40, 0);
  const pitchStr = `${pInt >= 0 ? "+" : ""}${pInt}Hz`;
  const rateStr = `${rInt >= 0 ? "+" : ""}${rInt}%`;

  const reqId = crypto.randomUUID().replace(/-/g, "");
  const endpoint = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${reqId}`;

  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='id-ID'>` +
    `<voice name='${escapeXml(safeVoice)}'>` +
    `<prosody pitch='${pitchStr}' rate='${rateStr}'>${escapeXml(cleanText)}</prosody>` +
    `</voice></speak>`;

  const configMsg =
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataOptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });

  const ssmlMsg =
    `X-RequestId:${reqId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${new Date().toISOString()}\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml;

  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(endpoint);
    } catch (err) {
      reject(err);
      return;
    }

    ws.binaryType = "arraybuffer";
    const audioChunks = [];
    let settled = false;

    const finish = (err, buf) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) {}
      if (err) reject(err);
      else resolve(buf);
    };

    const timer = setTimeout(() => {
      if (audioChunks.length > 0) finish(null, concatArrayBuffers(audioChunks));
      else finish(new Error("Edge TTS timeout."));
    }, 15000);

    ws.addEventListener("open", () => {
      ws.send(configMsg);
      ws.send(ssmlMsg);
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          if (audioChunks.length > 0) finish(null, concatArrayBuffers(audioChunks));
          else finish(new Error("Edge TTS mengakhiri turn tanpa audio."));
        }
        return;
      }

      const data = event.data;
      if (!(data instanceof ArrayBuffer) || data.byteLength < 2) return;
      const view = new DataView(data);
      const headerLen = view.getUint16(0, false);
      const bodyStart = 2 + headerLen;
      if (bodyStart >= data.byteLength) return;

      const headerStr = new TextDecoder().decode(data.slice(2, bodyStart));
      if (headerStr.includes("Path:audio")) {
        audioChunks.push(data.slice(bodyStart));
      }
    });

    ws.addEventListener("error", (ev) => {
      finish(new Error("Edge TTS socket error: " + (ev.message || "koneksi gagal")));
    });

    ws.addEventListener("close", () => {
      if (!settled) {
        if (audioChunks.length > 0) finish(null, concatArrayBuffers(audioChunks));
        else finish(new Error("Edge TTS koneksi ditutup sebelum audio selesai."));
      }
    });
  });
}

function concatArrayBuffers(list) {
  const total = list.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of list) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out.buffer;
}

async function googleTts({ text, lang = "id" }) {
  const cleanText = String(text || "").trim().slice(0, 200);
  const tl = lang === "en" ? "en" : "id";
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(cleanText)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://translate.google.com/",
    },
  });
  if (!res.ok) throw new Error(`Google TTS gagal (${res.status})`);
  return await res.arrayBuffer();
}

async function handleTts(urlObj) {
  const text = (urlObj.searchParams.get("text") || "").trim();
  if (!text) return jsonRes({ ok: false, error: "Parameter text wajib diisi." }, 400);

  const voice = urlObj.searchParams.get("voice") || "id-ID-ArdiNeural";
  const pitch = urlObj.searchParams.get("pitch") || "0";
  const rate = urlObj.searchParams.get("rate") || "0";
  const engine = (urlObj.searchParams.get("engine") || "edge").toLowerCase();
  const lang = voice.toLowerCase().startsWith("en") ? "en" : "id";

  if (engine !== "google") {
    try {
      const mp3Buf = await edgeTts({ text, voice, pitch, rate });
      return new Response(mp3Buf, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=3600",
          "x-source": "edge-tts",
          ...CORS_HEADERS,
        },
      });
    } catch (edgeErr) {
      const fbBuf = await googleTts({ text, lang });
      return new Response(fbBuf, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=1800",
          "x-source": "google-tts",
          "x-edge-error": String(edgeErr.message || "edge unavailable").slice(0, 140),
          ...CORS_HEADERS,
        },
      });
    }
  }

  const fbBuf = await googleTts({ text, lang });
  return new Response(fbBuf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=1800",
      "x-source": "google-tts",
      ...CORS_HEADERS,
    },
  });
}

async function handleImage(urlObj) {
  const prompt = (urlObj.searchParams.get("prompt") || "warm storytelling scene").trim().slice(0, 350);
  const seed = clampInt(urlObj.searchParams.get("seed"), 1, 999999999, 1001);
  const w = clampInt(urlObj.searchParams.get("w"), 320, 1280, 720);
  const h = clampInt(urlObj.searchParams.get("h"), 320, 1280, 1280);

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const res = await fetch(pollinationsUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Image upstream ${res.status}`);
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) throw new Error("Respons bukan gambar");
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1024) throw new Error("Gambar terlalu kecil");

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
        "x-source": "pollinations",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    clearTimeout(timer);
    return jsonRes({ ok: false, error: "Gagal mengambil gambar latar: " + err.message }, 502);
  }
}

async function handleFetch(urlObj) {
  const target = (urlObj.searchParams.get("url") || "").trim();
  let parsed;
  try {
    parsed = new URL(target);
  } catch (_) {
    return jsonRes({ ok: false, error: "URL musik tidak valid." }, 400);
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return jsonRes({ ok: false, error: "Hanya mendukung http/https." }, 400);
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return jsonRes({ ok: false, error: `Gagal mengunduh audio (${res.status})` }, 502);
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    },
  });
}

async function handlePlan(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonRes({ ok: false, error: "Format JSON tidak valid." }, 400);
  }

  const script = String(body.script || "").trim();
  const opts = body.options || {};
  if (script.length < 10) {
    return jsonRes({ ok: false, error: "Naskah cerita terlalu pendek." }, 400);
  }

  const lines = script.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsedLines = [];
  const chars = new Map();
  const palette = ["#ff8c1a", "#36d399", "#4da3ff", "#ff6b9d", "#b983ff", "#ffd23f"];

  const inferKind = (name) => {
    if (/nenek|eyang putri/i.test(name)) return { kind: "nenek", gender: "p" };
    if (/kakek|eyang/i.test(name)) return { kind: "kakek", gender: "l" };
    if (/adik|anak cewek|putri|dina|siti|ani|nina|cucu cewek/i.test(name)) return { kind: "anak_perempuan", gender: "p" };
    if (/anak|bocah|beni|udi|budi|cucu/i.test(name)) return { kind: "anak_laki", gender: "l" };
    if (/ibu|mama|bunda|bu |kak |mbak|tante|wati|sari|dewi/i.test(name)) return { kind: "dewasa_wanita", gender: "p" };
    return { kind: "dewasa_pria", gender: "l" };
  };

  for (const l of lines) {
    const m = l.match(/^([^:]{1,24}):\s*(.+)$/);
    if (m) {
      const speaker = m[1].trim();
      const text = m[2].trim();
      parsedLines.push({ speaker, text });
      if (!/^narat(o|e)r$/i.test(speaker)) {
        const key = speaker.toLowerCase();
        if (!chars.has(key)) {
          const inf = inferKind(speaker);
          chars.set(key, {
            name: speaker,
            kind: inf.kind,
            gender: inf.gender,
            role: "",
            status: "menengah",
            color: palette[chars.size % palette.length],
          });
        }
      }
    } else {
      parsedLines.push({ speaker: "Narator", text: l });
    }
  }

  if (chars.size === 0) {
    [
      { name: "Anak Laki", kind: "anak_laki", gender: "l", color: palette[0] },
      { name: "Anak Perempuan", kind: "anak_perempuan", gender: "p", color: palette[1] },
      { name: "Dewasa Pria", kind: "dewasa_pria", gender: "l", color: palette[2] },
      { name: "Dewasa Wanita", kind: "dewasa_wanita", gender: "p", color: palette[3] },
      { name: "Kakek", kind: "kakek", gender: "l", color: palette[4] },
      { name: "Nenek", kind: "nenek", gender: "p", color: palette[5] },
    ].forEach((d) => chars.set(d.name.toLowerCase(), d));
  }

  const maxScenes = clampInt(opts.maxScenes, 2, 24, 8);
  const perScene = Math.max(1, Math.ceil(parsedLines.length / maxScenes));
  const locations = [
    "halaman rumah kayu asri pagi hari",
    "jalan setapak desa dengan pepohonan rindang",
    "ruang keluarga hangat dengan cahaya alami",
    "taman dan kebun sore hari yang damai",
  ];
  const times = ["pagi", "pagi", "siang", "sore"];
  const cameras = ["zoom_in", "pan_right", "zoom_out", "pan_left"];
  const emojis = ["🌅", "🚶", "🏡", "🌿"];

  const scenes = [];
  for (let i = 0; i < maxScenes; i++) {
    const chunk = parsedLines.slice(i * perScene, (i + 1) * perScene);
    if (!chunk.length) break;
    const speakers = Array.from(new Set(chunk.map((x) => x.speaker).filter((sp) => !/^narat(o|e)r$/i.test(sp))));
    const present = speakers.length ? speakers : Array.from(chars.values()).slice(0, 2).map((c) => c.name);
    const loc = locations[i % locations.length];
    scenes.push({
      id: i + 1,
      location: loc,
      time: times[i % times.length],
      camera: cameras[i % cameras.length],
      emoji: emojis[i % emojis.length],
      imagePrompt: `Warm animated storytelling illustration of ${loc}, soft sunlight, natural details, no text`,
      seed: 2026 + i * 199,
      present,
      lines: chunk.map((item, idx) => ({
        speaker: item.speaker,
        text: item.text,
        emotion: idx % 3 === 0 ? "senang" : "normal",
      })),
    });
  }

  return jsonRes({
    ok: true,
    version: VERSION,
    project: {
      title: "Cerita Kehidupan & Perjalanan Bersama",
      genre: opts.genre || "anak",
      moral: "Setiap langkah kecil bersama orang tercinta membawa kehangatan dan makna.",
      characters: Array.from(chars.values()),
      scenes,
      options: {
        ...opts,
        targetSec: clampInt(opts.targetSec, 30, 600, 120),
      },
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (!checkAuth(request, env)) {
      return jsonRes({ ok: false, error: "Token akses Worker tidak valid." }, 401);
    }

    const urlObj = new URL(request.url);
    const path = urlObj.pathname;

    try {
      if (path === "/api/health" && request.method === "GET") {
        return jsonRes({
          ok: true,
          version: VERSION,
          service: "Studio Video AI v5 Pro Worker",
          endpoints: ["/api/health", "/api/plan", "/api/tts", "/api/image", "/api/fetch"],
        });
      }
      if (path === "/api/plan" && request.method === "POST") {
        return await handlePlan(request);
      }
      if (path === "/api/tts" && request.method === "GET") {
        return await handleTts(urlObj);
      }
      if (path === "/api/image" && request.method === "GET") {
        return await handleImage(urlObj);
      }
      if (path === "/api/fetch" && request.method === "GET") {
        return await handleFetch(urlObj);
      }

      return jsonRes({ ok: false, error: "Endpoint tidak ditemukan." }, 404);
    } catch (err) {
      return jsonRes({ ok: false, error: err.message || "Terjadi kesalahan pada Worker." }, 500);
    }
  },
};
