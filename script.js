/* =====================================================================
 *  script.js — Frontend Studio Video AI v4 (Cerita Anak Proper)
 * ===================================================================== */
"use strict";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const lerp = (a, b, p) => a + (b - a) * p;

const AGENTS = [
  { key: "script", name: "Agen 1 · Penulis Naskah & Sutradara" },
  { key: "cast", name: "Agen 2 · Casting & Busana Tokoh" },
  { key: "visual", name: "Agen 3 · Latar Gambar" },
  { key: "voice", name: "Agen 4 · Pengisi Suara" },
  { key: "music", name: "Agen 5 · Musik & Efek Suara (SFX)" },
  { key: "render", name: "Agen 6 · Editor Video (rekam)" },
];

const THEME_SCRIPTS = {
  sekolah: `Narator: Pagi itu di halaman sekolah yang cerah, Raka, Lala, dan Bimo berkumpul di dekat perpustakaan.
Raka: Teman-teman, lihat! Pojok baca kita belum punya papan nama yang cantik.
Lala: Wah, ide bagus Raka! Aku bawa kuas dan cat warna kesayanganku untuk melukisnya!
Bimo: Aku siap membantu memegang papannya dan menyiapkan peralatan dari tas petualangku!
Narator: Dengan bekerja sama penuh semangat, papan nama pojok baca pun selesai dan terlihat indah.
Bu Guru: Hebat sekali kalian bertiga! Kerja sama membuat pekerjaan sulit jadi mudah.`,

  pasar: `Narator: Siang itu di pasar tradisional yang ramai, Lala dan Bimo menemani Raka berbelanja buah.
Raka: Wah, ternyata suasana pasar tradisional seru sekali ya, banyak buah segar!
Bimo: Betul Raka! Ibuku sering berjualan sayur di sini, jadi aku hafal mana buah yang paling manis.
Lala: Lihat mangga harum manis itu! Warnanya kuning cerah seperti lukisanku!
Narator: Mereka belajar memilih buah dengan ramah dan sopan kepada pedagang pasar.
Raka: Terima kasih Bimo sudah mengajari aku cara menawar yang sopan!`,

  kompleks: `Narator: Sore hari di jalan kompleks perumahan yang asri, Raka sedang mencoba sepeda barunya.
Raka: Halo Lala! Halo Bimo! Ayo kita main bersama di lapangan dekat pos ronda!
Lala: Wah sepedamu bagus sekali Raka! Aku baru saja selesai menggambar pemandangan sore.
Bimo: Bagaimana kalau kita adakan lomba balap lari kecil sambil menjaga pos ronda Pak RT?
Narator: Meski berasal dari keluarga yang berbeda, persahabatan mereka selalu rukun dan saling menghargai.
Raka: Setuju! Yang kalah traktir es lilin ya!`,

  hutan: `Narator: Pagi yang sejuk di tepi hutan pinus, anak-anak sedang mengikuti kegiatan kemah pramuka.
Bimo: Teman-teman, dengarkan suara burung di atas pohon! Itu tanda arah mata air dekat sini.
Lala: Aku akan mencatat bentuk daun-daun unik ini di buku sketsaku!
Raka: Jangan lupa kita bawa kembali semua sampah plastik kita agar hutan tetap bersih.
Narator: Mereka menjaga kelestarian alam dengan gembira sepanjang hari.
Bimo: Alam yang bersih membuat semua makhluk hidup bahagia!`,

  rumah: `Narator: Pagi hari di dapur rumah yang hangat, Lala dan Raka ingin membuat kejutan sarapan.
Lala: Kita buat roti panggang bentuk wajah tersenyum untuk Ibu dan Ayah yuk!
Raka: Aku bagian mengoles selai stroberi dan menata potongan pisangnya ya!
Bimo: Dan aku yang bertugas membunyikan bel kejutan saat sarapannya siap!
Narator: Dapur dipenuhi tawa ceria dan aroma roti panggang yang lezat.
Ibu: Wah, terima kasih anak-anak pintar! Sarapan ini terasa sangat spesial!`
};

const PALETTE = ["#ff8a1f", "#38d39f", "#4da3ff", "#ff5d8f", "#b983ff", "#ffd23f"];

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
  anak: { label: "Anak-anak (Imut)", g: "f", pitch: 42, rate: 6, scale: 0.82 },
  pria: { label: "Pria / Ayah / Guru", g: "m", pitch: 0, rate: 0, scale: 1.02 },
  wanita: { label: "Wanita / Ibu / Guru", g: "f", pitch: 0, rate: 0, scale: 0.98 },
  kakek: { label: "Kakek / Pak RT", g: "m", pitch: -28, rate: -12, scale: 0.96 },
  nenek: { label: "Nenek", g: "f", pitch: -16, rate: -10, scale: 0.92 },
};

const OUTFITS = {
  rapih_elit: { label: "Kemeja Polo & Chino (Keluarga Mapan)", top: "#3b82f6", bottom: "#e5d3b3", accent: "#ffffff", hat: "none", prop: "watch" },
  seniman: { label: "Overall Denim & Baret (Keluarga Seniman)", top: "#f59e0b", bottom: "#2563eb", accent: "#ef4444", hat: "beret", prop: "brush" },
  petualang: { label: "Rompi Kargo & Topi Rimba (Petualang)", top: "#4d7c0f", bottom: "#78350f", accent: "#facc15", hat: "safari", prop: "bino" },
  sederhana: { label: "Kaos Hangat & Celana Santai (Sederhana)", top: "#10b981", bottom: "#374151", accent: "#fef08a", hat: "none", prop: "none" },
  seragam: { label: "Seragam Sekolah Rapi (Pelajar)", top: "#ffffff", bottom: "#dc2626", accent: "#991b1b", hat: "none", prop: "book" },
  kasual: { label: "Sweter Ceria & Jeans (Kasual)", top: "#ec4899", bottom: "#1d4ed8", accent: "#fbcfe8", hat: "cap", prop: "none" },
};

const VARIANTS = [[0, 0], [20, 4], [-18, -4], [34, 7], [-32, -8]];

function defaultVoice(kind, nth, lang) {
  const k = KINDS[kind] || KINDS.anak;
  const list = VOICES[lang].filter((v) => v.g === k.g);
  const v = list[nth % list.length];
  const off = VARIANTS[nth % VARIANTS.length];
  return {
    voiceId: v.id,
    pitch: clamp(k.pitch + off[0], -80, 80),
    rate: clamp(k.rate + off[1], -40, 40),
    kind: kind in KINDS ? kind : "anak",
  };
}

const state = {
  project: null,
  images: {},
  audio: {},
  music: null,
  cast: {},
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

function store(key, val) { try { localStorage.setItem("sva_" + key, val); } catch (e) {} }
function load(key, def) {
  try { const v = localStorage.getItem("sva_" + key); return v === null ? def : v; } catch (e) { return def; }
}
function loadVoices() { try { return JSON.parse(load("voices", "{}")) || {}; } catch (e) { return {}; } }
function saveVoices(v) { store("voices", JSON.stringify(v)); renderSavedVoicesManager(); }

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
        let data = null;
        try { data = await res.json(); } catch (e) {}
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
    throw new Error("Permintaan terlalu lama (timeout). Tekan Lanjutkan untuk mencoba lagi.");
  }
  if (lastErr && !lastErr.fromServer && (lastErr.name === "TypeError" || /fetch|network/i.test(lastErr.message))) {
    throw new Error("Tidak bisa terhubung ke Worker. Periksa URL Worker dan koneksi internet.");
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

function scheduleSceneSFX(ac, dest, t0, tl) {
  if ($("sfxToggle").value === "off") return;

  tl.forEach((x) => {
    const sceneStart = t0 + x.start;
    const loc = String(x.s.location || "").toLowerCase();

    if (/hutan|taman|kebun|sekolah|pagi/.test(loc)) {
      [0.4, 0.65, 2.2, 2.4].forEach((off, idx) => {
        if (off >= x.dur) return;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sine";
        const baseF = idx % 2 === 0 ? 2200 : 2600;
        osc.frequency.setValueAtTime(baseF, sceneStart + off);
        osc.frequency.exponentialRampToValueAtTime(baseF * 1.35, sceneStart + off + 0.08);
        osc.frequency.exponentialRampToValueAtTime(baseF * 0.9, sceneStart + off + 0.16);
        g.gain.setValueAtTime(0.0001, sceneStart + off);
        g.gain.linearRampToValueAtTime(0.035, sceneStart + off + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, sceneStart + off + 0.18);
        osc.connect(g); g.connect(dest);
        osc.start(sceneStart + off); osc.stop(sceneStart + off + 0.2);
      });
    } else if (/pantai|laut|sungai|hujan/.test(loc)) {
      const dur = Math.min(x.dur, 4.0);
      const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.sin((i / ch.length) * Math.PI);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const filter = ac.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 420;
      const g = ac.createGain();
      g.gain.value = 0.04;
      src.connect(filter); filter.connect(g); g.connect(dest);
      src.start(sceneStart);
    }

    x.lines.forEach((L) => {
      const lt = sceneStart + L.start;
      const emo = L.ln.emotion;
      if (emo === "senang" || emo === "lambai") {
        [1046.5, 1318.5, 1568].forEach((freq, k) => {
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, lt + k * 0.07);
          g.gain.setValueAtTime(0.0001, lt + k * 0.07);
          g.gain.linearRampToValueAtTime(0.06, lt + k * 0.07 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, lt + k * 0.07 + 0.28);
          osc.connect(g); g.connect(dest);
          osc.start(lt + k * 0.07); osc.stop(lt + k * 0.07 + 0.3);
        });
      } else if (emo === "kaget") {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, lt);
        osc.frequency.exponentialRampToValueAtTime(980, lt + 0.14);
        g.gain.setValueAtTime(0.08, lt);
        g.gain.exponentialRampToValueAtTime(0.0001, lt + 0.22);
        osc.connect(g); g.connect(dest);
        osc.start(lt); osc.stop(lt + 0.24);
      } else if (emo === "tanya") {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, lt);
        osc.frequency.exponentialRampToValueAtTime(660, lt + 0.18);
        g.gain.setValueAtTime(0.045, lt);
        g.gain.exponentialRampToValueAtTime(0.0001, lt + 0.22);
        osc.connect(g); g.connect(dest);
        osc.start(lt); osc.stop(lt + 0.24);
      } else if (emo === "sedih") {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, lt);
        osc.frequency.exponentialRampToValueAtTime(310, lt + 0.35);
        g.gain.setValueAtTime(0.04, lt);
        g.gain.exponentialRampToValueAtTime(0.0001, lt + 0.4);
        osc.connect(g); g.connect(dest);
        osc.start(lt); osc.stop(lt + 0.42);
      }
    });
  });
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

function fallbackDetune(p) {
  const base = { pria: -280, kakek: -420, anak: 360, wanita: 20, nenek: -110 }[p.kind] || 0;
  return clamp(base + p.pitch * 5, -700, 700);
}

async function ttsChunk(profile, text, engine) {
  const q = new URLSearchParams({ text, voice: profile.voiceId, pitch: String(profile.pitch), rate: String(profile.rate), engine });
  const r = await request(`/api/tts?${q}`, { binary: true, attempts: 3 }, 40000);
  let buf;
  try { buf = await ensureAC().decodeAudioData(r.buf.slice(0)); }
  catch (e) { throw new Error("Audio tidak bisa didecode oleh browser."); }
  return { buf, source: r.source, edgeError: r.edgeError };
}

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
        if (!state.edgeNoted) { state.edgeNoted = true; log(`Suara Edge gagal (${r.edgeError || "?"}). Memakai cadangan Google.`); }
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

const castKey = (name) => String(name).toLowerCase();

function renderSavedVoicesManager() {
  const list = $("savedVoicesList");
  if (!list) return;
  const saved = loadVoices();
  const keys = Object.keys(saved);
  list.innerHTML = "";
  if (!keys.length) {
    list.innerHTML = `<span class="small" style="opacity:.7">Belum ada suara tokoh yang dikunci.</span>`;
    return;
  }
  keys.forEach((k) => {
    const item = saved[k];
    const chip = el("div", "saved-chip");
    const info = el("div");
    const kindLabel = (KINDS[item.kind] && KINDS[item.kind].label) || item.kind;
    const outfitLabel = (OUTFITS[item.outfit] && OUTFITS[item.outfit].label.split("(")[0]) || "";
    info.innerHTML = `<strong>${item.displayName || k}</strong> · <span class="small">${kindLabel} (${item.pitch > 0 ? "+" : ""}${item.pitch}Hz)${outfitLabel ? " · " + outfitLabel : ""}</span>`;
    const acts = el("div", "actions");
    const btnEdit = el("button", "ghost", "✏️ Edit");
    btnEdit.type = "button";
    btnEdit.addEventListener("click", () => {
      delete saved[k];
      saveVoices(saved);
      if (state.cast[k]) { state.cast[k].locked = false; renderCast(); }
      $("castCard").hidden = false;
      $("castCard").scrollIntoView({ behavior: "smooth" });
    });
    const btnDel = el("button", "ghost", "✕");
    btnDel.type = "button";
    btnDel.addEventListener("click", () => {
      delete saved[k];
      saveVoices(saved);
    });
    acts.append(btnEdit, btnDel);
    chip.append(info, acts);
    list.append(chip);
  });
}

function initCast(p) {
  const lang = p.options.lang;
  const saved = loadVoices();
  state.cast = {};
  const counts = {};
  const entries = [];
  if (p.scenes.some((s) => s.lines.some((l) => isNarr(l.speaker)))) {
    entries.push({ name: "Narator", kind: "wanita", outfit: "kasual", narrator: true });
  }
  p.characters.forEach((c, i) => {
    if (!c.color) c.color = PALETTE[i % PALETTE.length];
    if (!c.outfit || !(c.outfit in OUTFITS)) c.outfit = Object.keys(OUTFITS)[i % Object.keys(OUTFITS).length];
    entries.push(c);
  });
  entries.forEach((c) => {
    const key = castKey(c.name);
    const sv = saved[key];
    if (sv && VOICES[lang].some((v) => v.id === sv.voiceId) && sv.kind in KINDS) {
      const outfit = sv.outfit && sv.outfit in OUTFITS ? sv.outfit : (c.outfit || "kasual");
      state.cast[key] = {
        name: c.name,
        voiceId: sv.voiceId,
        pitch: sv.pitch,
        rate: sv.rate,
        kind: sv.kind,
        outfit,
        narrator: !!c.narrator,
        locked: true,
      };
      c.kind = sv.kind;
      c.outfit = outfit;
      return;
    }
    const nth = counts[c.kind] || 0;
    counts[c.kind] = nth + 1;
    state.cast[key] = {
      name: c.name,
      ...defaultVoice(c.kind, nth, lang),
      outfit: c.outfit || "kasual",
      narrator: !!c.narrator,
      locked: false,
    };
  });
}

function persistCast(key) {
  const c = state.cast[key];
  const saved = loadVoices();
  if (c.locked) {
    saved[key] = {
      displayName: c.name,
      voiceId: c.voiceId,
      pitch: c.pitch,
      rate: c.rate,
      kind: c.kind,
      outfit: c.outfit,
    };
  } else {
    delete saved[key];
  }
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
    const lock = el("button", "ghost lockbtn", c.locked ? "🔒 Terkunci (Klik untuk Edit)" : "🔓 Kunci Profil & Suara");
    lock.type = "button";
    lock.addEventListener("click", () => {
      c.locked = !c.locked;
      persistCast(key);
      renderCast();
    });
    head.append(dot, nm, lock);

    const kindSel = el("select");
    kindSel.disabled = c.locked;
    Object.entries(KINDS).forEach(([k, v]) => {
      const o = el("option", "", v.label); o.value = k; if (k === c.kind) o.selected = true; kindSel.append(o);
    });
    kindSel.addEventListener("change", () => {
      Object.assign(c, defaultVoice(kindSel.value, 0, lang));
      if (ch) ch.kind = c.kind;
      renderCast();
    });

    const voiceSel = el("select");
    voiceSel.disabled = c.locked;
    VOICES[lang].forEach((v) => {
      const o = el("option", "", v.label); o.value = v.id; if (v.id === c.voiceId) o.selected = true; voiceSel.append(o);
    });
    voiceSel.addEventListener("change", () => { c.voiceId = voiceSel.value; });

    const grid = el("div", "grid");
    const l1 = el("div"); l1.append(el("label", "", "Peran / Usia tokoh"), kindSel);
    const l2 = el("div"); l2.append(el("label", "", "Suara dasar"), voiceSel);
    grid.append(l1, l2);

    let outfitWrap = null;
    if (!c.narrator) {
      const outfitSel = el("select");
      outfitSel.disabled = c.locked;
      Object.entries(OUTFITS).forEach(([ok, ov]) => {
        const o = el("option", "", ov.label); o.value = ok; if (ok === c.outfit) o.selected = true; outfitSel.append(o);
      });
      outfitSel.addEventListener("change", () => {
        c.outfit = outfitSel.value;
        if (ch) ch.outfit = c.outfit;
      });
      outfitWrap = el("div");
      outfitWrap.append(el("label", "", "Busana & Latar Keluarga"), outfitSel);
    }

    const slider = (label, prop, min, max, unit) => {
      const wrap = el("div");
      const lb = el("label", "", `${label}: ${c[prop]}${unit}`);
      const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = 1; r.value = c[prop];
      r.disabled = c.locked;
      r.addEventListener("input", () => { c[prop] = Number(r.value); lb.textContent = `${label}: ${c[prop]}${unit}`; });
      wrap.append(lb, r);
      return wrap;
    };
    const sl = el("div", "grid");
    sl.append(slider("Nada", "pitch", -80, 80, " Hz"), slider("Kecepatan", "rate", -40, 40, "%"));

    const test = el("button", "ghost", "▶ Tes suara");
    test.type = "button";
    test.addEventListener("click", () => previewVoice(c, test));

    card.append(head, grid);
    if (outfitWrap) card.append(outfitWrap);
    card.append(sl, el("div", "row"));
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
    const text = en ? `Hello, I am ${c.name}. Let's play together!` : `Halo teman-teman, aku ${c.name}! Ayo kita bermain bersama!`;
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
  setDetail("Periksa suara & busana tiap tokoh, lalu tekan Lanjutkan produksi.");
  return new Promise((res) => { state.castResolve = res; });
}

function finishCast() {
  if (!state.castResolve) return;
  $("castCard").hidden = true;
  const r = state.castResolve;
  state.castResolve = null;
  r();
}

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

  async () => {
    const p = state.project;
    if (!Object.keys(state.cast).length) initCast(p);
    const all = Object.values(state.cast);
    if (all.every((c) => c.locked)) {
      renderCast();
      $("castCard").hidden = false;
      log("Semua profil suara tokoh sudah terkunci (kartu tetap ditampilkan jika ingin diedit).");
      return "profil terkunci";
    }
    await showCastReview();
    setDetail("");
    return `${all.length} tokoh siap`;
  },

  async () => {
    const scenes = state.project.scenes;
    const n = scenes.length;
    let ok = 0;
    for (let i = 0; i < n; i++) {
      const s = scenes[i];
      if (state.images[s.id]) { ok++; continue; }
      setStep("visual", "run", `latar ${i + 1}/${n}`);
      setDetail(`Membuat latar gaya "${state.project.options.style}" untuk adegan ${i + 1}…`);
      let bmp = null;
      for (let a = 0; a < 2 && !bmp; a++) {
        try {
          const r = await fetchImage(s, a * 7919);
          bmp = r.bmp;
          if (i === 0 && a === 0) log("Sumber gambar latar: " + (r.source || "?"));
        } catch (e) {
          log(`Adegan ${s.id}: gambar gagal percobaan ${a + 1} (${e.message})`);
        }
      }
      state.images[s.id] = bmp;
      if (bmp) ok++;
    }
    if (ok === 0) log("Gambar AI sedang sibuk. Menggunakan latar ilustrasi vektor bawaan sesuai gaya & lokasi.");
    return `${ok}/${n} latar`;
  },

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
    log(`Suara dialog siap, total ±${Math.round(sec)} detik.`);
    return "suara siap";
  },

  async () => {
    const url = state.project.options.musicUrl;
    if (!url) {
      log("SFX otomatis aktif sesuai gambar & emosi" + ($("sfxToggle").value === "on" ? "." : " (nonaktif)."));
      return $("sfxToggle").value === "on" ? "SFX otomatis" : "tanpa musik";
    }
    if (state.music) return "musik + SFX";
    try {
      const ac = ensureAC();
      const r = await request(`/api/fetch?${new URLSearchParams({ url })}`, { binary: true, attempts: 2 }, 60000);
      state.music = await ac.decodeAudioData(r.buf.slice(0));
      log("Musik latar + SFX otomatis dimuat.");
      return "musik + SFX";
    } catch (e) {
      log("Musik gagal dimuat, memakai SFX otomatis: " + e.message);
      return "SFX otomatis";
    }
  },

  async () => {
    setStep("render", "run", "merekam…");
    setDetail("Video direkam langsung selama durasinya. Biarkan layar menyala.");
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
  try { ensureAC(); } catch (e) {}

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
  const name = `cerita-anak-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  $("player").src = url;
  $("btnDownload").href = url;
  $("btnDownload").setAttribute("download", name);
  state.fileName = name;
  $("resultCard").hidden = false;
  $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  log(`Video selesai: ${name} (${(blob.size / 1048576).toFixed(1)} MB).`);
}

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

function bgKind(loc) {
  const t = String(loc || "").toLowerCase();
  if (/sekolah|kelas|perpustakaan|school|class/.test(t)) return "school";
  if (/pasar|warung|toko|market|shop/.test(t)) return "market";
  if (/pantai|laut|dermaga|danau|sungai|beach|sea|lake|river|pier/.test(t)) return "beach";
  if (/hutan|kebun|sawah|gunung|desa|taman|kemah|forest|park/.test(t)) return "forest";
  if (/rumah|kamar|dapur|ruang|kitchen|house|room/.test(t)) return "indoor";
  return "complex";
}

const SKY = { pagi: ["#ffdfa8", "#9fd5ff"], siang: ["#6fc3ff", "#cfeeff"], sore: ["#6a5acd", "#ff9e6d"], malam: ["#0b102e", "#2b3875"] };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawProcBg(g, s, T) {
  const { ctx, W, H, groundY } = g;
  const hz = groundY - H * 0.09;
  const kind = bgKind(s.location);
  const night = s.time === "malam";
  const [c1, c2] = SKY[s.time] || SKY.pagi;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, c1); sky.addColorStop(1, c2);

  if (kind === "indoor") {
    ctx.fillStyle = night ? "#312942" : "#fde6c4";
    ctx.fillRect(0, 0, W, hz);
    const ww = W * 0.28, wh = H * (W > H ? 0.28 : 0.16), wx = W * 0.1, wy = H * 0.12;
    ctx.fillStyle = sky; rr(ctx, wx, wy, ww, wh, 12); ctx.fill();
    ctx.strokeStyle = "#7c5836"; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    ctx.fillStyle = "#d97706"; rr(ctx, W * 0.58, H * 0.14, W * 0.3, wh * 0.85, 12); ctx.fill();
    ctx.fillStyle = "#fef3c7"; rr(ctx, W * 0.60, H * 0.16, W * 0.26, wh * 0.35, 8); ctx.fill();
    const fl = ctx.createLinearGradient(0, hz, 0, H);
    fl.addColorStop(0, "#b48356"); fl.addColorStop(1, "#78512d");
    ctx.fillStyle = fl; ctx.fillRect(0, hz, W, H - hz);
    return;
  }

  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
  ctx.fillStyle = night ? "#fef9c3" : "#fde047";
  ctx.beginPath(); ctx.arc(W * 0.82, H * 0.15, H * (W > H ? 0.065 : 0.042), 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  for (let k = 0; k < 3; k++) {
    const cx = ((rnd(k + 5) + T * 0.005 * (k + 1)) % 1.3 - 0.15) * W, cy = H * (0.09 + 0.06 * k), r = H * 0.028;
    [[0, 0, 1], [r * 1.1, r * 0.2, 0.85], [-r * 1.1, r * 0.2, 0.8]].forEach(([dx, dy, m]) => {
      ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, r * 2 * m, r * m, 0, 0, Math.PI * 2); ctx.fill();
    });
  }

  let ground = ["#65b869", "#4a9c52"];
  if (kind === "school") {
    const bx = W * 0.18, bw = W * 0.64, bh = H * 0.25;
    ctx.fillStyle = "#fef3c7"; rr(ctx, bx, hz - bh, bw, bh + 4, 10); ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.moveTo(bx - 16, hz - bh); ctx.lineTo(bx + bw / 2, hz - bh - H * 0.09); ctx.lineTo(bx + bw + 16, hz - bh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#92400e"; rr(ctx, bx + bw * 0.44, hz - bh * 0.55, bw * 0.12, bh * 0.55, 6); ctx.fill();
    ctx.fillStyle = "#93c5fd";
    [0.14, 0.28, 0.64, 0.78].forEach((px) => { rr(ctx, bx + bw * px, hz - bh * 0.65, bw * 0.09, bh * 0.3, 6); ctx.fill(); });
    ground = ["#86efac", "#4ade80"];
  } else if (kind === "market") {
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6"];
    for (let k = 0; k < 4; k++) {
      const sx = W * (0.08 + k * 0.22), sw = W * 0.19, sh = H * 0.16;
      ctx.fillStyle = "#78350f"; ctx.fillRect(sx + 10, hz - sh, 8, sh); ctx.fillRect(sx + sw - 18, hz - sh, 8, sh);
      ctx.fillStyle = colors[k];
      ctx.beginPath(); ctx.moveTo(sx - 8, hz - sh * 0.65); ctx.lineTo(sx + sw / 2, hz - sh * 1.15); ctx.lineTo(sx + sw + 8, hz - sh * 0.65); ctx.closePath(); ctx.fill();
    }
    ground = ["#e7e5e4", "#d6d3d1"];
  } else if (kind === "beach") {
    const sea = ctx.createLinearGradient(0, hz - H * 0.07, 0, hz);
    sea.addColorStop(0, "#38bdf8"); sea.addColorStop(1, "#0284c7");
    ctx.fillStyle = sea; ctx.fillRect(0, hz - H * 0.07, W, H * 0.07 + 2);
    ground = ["#fde68a", "#fcd34d"];
  } else if (kind === "forest") {
    for (let k = 0; k < 8; k++) {
      const x = (k + 0.4) * (W / 8), th = H * (0.14 + 0.04 * rnd(k));
      ctx.fillStyle = "#78350f"; ctx.fillRect(x - 8, hz - th, 16, th);
      ctx.fillStyle = k % 2 ? "#22c55e" : "#16a34a";
      ctx.beginPath(); ctx.arc(x, hz - th, H * 0.065, 0, Math.PI * 2); ctx.fill();
    }
    ground = ["#4ade80", "#22c55e"];
  } else {
    const houses = [
      { x: 0.1, w: 0.24, h: 0.2, wall: "#e0f2fe", roof: "#3b82f6" },
      { x: 0.4, w: 0.22, h: 0.17, wall: "#fef3c7", roof: "#f97316" },
      { x: 0.68, w: 0.22, h: 0.18, wall: "#dcfce7", roof: "#16a34a" },
    ];
    houses.forEach((hs) => {
      const bx = W * hs.x, bw = W * hs.w, bh = H * hs.h;
      ctx.fillStyle = hs.wall; rr(ctx, bx, hz - bh, bw, bh + 2, 8); ctx.fill();
      ctx.fillStyle = hs.roof;
      ctx.beginPath(); ctx.moveTo(bx - 10, hz - bh); ctx.lineTo(bx + bw / 2, hz - bh - H * 0.06); ctx.lineTo(bx + bw + 10, hz - bh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#93c5fd"; rr(ctx, bx + bw * 0.2, hz - bh * 0.65, bw * 0.22, bh * 0.3, 4); ctx.fill();
      ctx.fillStyle = "#92400e"; rr(ctx, bx + bw * 0.58, hz - bh * 0.55, bw * 0.2, bh * 0.55, 4); ctx.fill();
    });
    ground = ["#9ca3af", "#6b7280"];
  }

  const gr = ctx.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, ground[0]); gr.addColorStop(1, ground[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
}

function applyStyleOverlay(ctx, W, H, style) {
  if (style === "comic") {
    ctx.save();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.fillStyle = "rgba(255, 220, 0, 0.06)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (style === "cat_air") {
    ctx.save();
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, "rgba(255,248,235,0)");
    grad.addColorStop(1, "rgba(235,215,185,0.28)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (style === "claymation") {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(255,245,220,0.08)");
    grad.addColorStop(1, "rgba(40,25,15,0.16)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawBackground(g, tl, t) {
  const { ctx, W, H } = g;
  const img = state.images[tl.s.id];
  if (img) {
    const p = clamp(t / tl.dur, 0, 1);
    let zoom = 1.03, ox = 0;
    switch (tl.s.camera) {
      case "zoom_in": zoom = 1.03 + 0.08 * p; break;
      case "zoom_out": zoom = 1.11 - 0.08 * p; break;
      case "pan_left": zoom = 1.11; ox = lerp(0.6, -0.6, p); break;
      case "pan_right": zoom = 1.11; ox = lerp(-0.6, 0.6, p); break;
      default: zoom = 1.03;
    }
    drawCover(ctx, img, W, H, zoom, ox, 0);
  } else {
    drawProcBg(g, tl.s, g.T);
  }
}

const HAIR_COLORS = ["#291d18", "#3b2314", "#1e1b2e", "#5c3a21", "#d4d4d8"];
const SKIN_TONES = ["#ffdbac", "#f1c27d", "#e0ac69", "#ffdfc4"];

function computePose(mode, emo, t) {
  const s = Math.sin;
  const P = { lean: 0, head: 0, aF: [0.15, 0.25], aB: [-0.1, 0.15], lF: [0.06, 0.06], lB: [-0.06, -0.06], bob: 0, jump: 0, emo: "normal" };
  if (mode === "walk") {
    const w = t * 10;
    P.lF = [s(w) * 0.45, s(w) * 0.45 - Math.max(0, -Math.cos(w)) * 0.4];
    P.lB = [-s(w) * 0.45, -s(w) * 0.45 - Math.max(0, Math.cos(w)) * 0.4];
    P.aF = [-s(w) * 0.4, -s(w) * 0.4 + 0.3];
    P.aB = [s(w) * 0.4, s(w) * 0.4 + 0.3];
    P.bob = -Math.abs(s(w)) * 1.4;
    P.lean = 0.05;
    return P;
  }
  if (mode === "idle") {
    P.bob = s(t * 2.2) * 1.1;
    P.aF = [0.1 + 0.04 * s(t * 1.8), 0.22];
    P.aB = [-0.08 + 0.03 * s(t * 1.4), 0.14];
    P.head = 0.04 * s(t * 1.3);
    return P;
  }
  P.emo = emo;
  switch (emo) {
    case "senang":
      P.jump = Math.abs(s(t * 5.5)) * 0.055;
      P.aF = [2.3 + 0.25 * s(t * 9), 2.5]; P.aB = [2.1 + 0.25 * s(t * 9 + 1), 2.4]; P.head = 0.08 * s(t * 5);
      break;
    case "sedih":
      P.lean = 0.16; P.head = 0.2; P.aF = [0.06, 0.14]; P.aB = [0, 0.08]; P.bob = s(t * 1.6) * 1.5;
      break;
    case "marah":
      P.lean = 0.08; P.head = 0.04 * s(t * 16); P.aF = [0.5, 1.8 + 0.1 * s(t * 14)]; P.aB = [-0.3, 1.5]; P.bob = s(t * 8) * 1.8;
      break;
    case "kaget":
      P.lean = -0.14; P.head = -0.07; P.aF = [2.0, 2.3]; P.aB = [1.7, 2.1]; P.bob = s(t * 18);
      break;
    case "tanya":
      P.head = 0.15; P.lean = 0.02; P.aF = [0.95, 2.6]; P.aB = [-0.05, 0.12]; P.bob = s(t * 2.2);
      break;
    case "lambai":
      P.aF = [2.4, 2.4 + 0.55 * s(t * 9)]; P.aB = [-0.05, 0.12]; P.head = 0.06 * s(t * 3.2); P.bob = s(t * 3);
      break;
    default:
      P.lean = 0.02; P.head = 0.06 * s(t * 3); P.bob = s(t * 5.5) * 1.4;
      P.aF = [0.65 + 0.35 * s(t * 4.5), 1.15 + 0.45 * s(t * 4.5 + 1)]; P.aB = [-0.1, 0.12 + 0.15 * s(t * 3)];
  }
  return P;
}

function tube(ctx, pts, w, c, outlineWidth) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = (dx, dy) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy))); ctx.stroke(); };
  ctx.strokeStyle = shade(c, -0.55); ctx.lineWidth = w + (outlineWidth || 4); path(0, 0);
  ctx.strokeStyle = c; ctx.lineWidth = w; path(0, 0);
  ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = shade(c, 0.45); ctx.lineWidth = w * 0.28; path(-w * 0.18, -w * 0.18); ctx.restore();
}

function disc(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function drawCharacter(ctx, o) {
  const H = o.H, P = o.P, k = o.kind, style = o.style || "cgi3d";
  const outfit = OUTFITS[o.outfit] || OUTFITS.kasual;
  const skin = SKIN_TONES[o.idx % SKIN_TONES.length];
  const hair = (k === "kakek" || k === "nenek") ? "#e5e7eb" : HAIR_COLORS[o.idx % 4];
  const comicOutline = style === "comic" ? 6 : 3.5;

  const hr = (k === "anak" ? 0.165 : 0.13) * H;
  const lw = 0.048 * H;
  const L1 = 0.16 * H, L2 = 0.16 * H, T = 0.26 * H, A1 = 0.14 * H, A2 = 0.13 * H;
  const jy = -P.jump * H;
  const hip = { x: 0, y: -(L1 + L2) + jy + P.bob * H * 0.01 };
  const sh = { x: hip.x + Math.sin(P.lean) * T, y: hip.y - Math.cos(P.lean) * T };
  const nk = hr + 0.025 * H;
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

  ctx.fillStyle = `rgba(0,0,0,${0.28 * (1 - clamp(P.jump * 8, 0, 0.6))})`;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.25 * H, 0.042 * H, 0, 0, Math.PI * 2); ctx.fill();

  const shoe = (p) => {
    ctx.fillStyle = outfit.accent;
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = comicOutline * 0.7;
    ctx.beginPath(); ctx.ellipse(p.x + 0.035 * H, p.y - 0.008 * H, 0.068 * H, 0.034 * H, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  };
  const hand = (p) => {
    disc(ctx, p.x, p.y, 0.038 * H, skin);
    ctx.strokeStyle = shade(skin, -0.45); ctx.lineWidth = 2; ctx.stroke();
  };

  tube(ctx, [sh, eB], lw * 1.05, shade(outfit.top, -0.25), comicOutline);
  tube(ctx, [eB, wB], lw * 0.9, shade(skin, -0.15), comicOutline * 0.8);
  hand(wB);
  tube(ctx, [hip, kB, fB], lw * 1.25, shade(outfit.bottom, -0.25), comicOutline);
  shoe(fB);

  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(P.lean);
  const bwTop = 0.085 * H, bwBot = 0.115 * H;
  ctx.fillStyle = outfit.top;
  ctx.strokeStyle = shade(outfit.top, -0.5);
  ctx.lineWidth = comicOutline;
  ctx.beginPath();
  ctx.moveTo(-bwTop, -T);
  ctx.lineTo(bwTop, -T);
  ctx.lineTo(bwBot, 0);
  ctx.lineTo(-bwBot, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  if (o.outfit === "rapih_elit" || o.outfit === "seragam") {
    ctx.fillStyle = outfit.accent;
    ctx.beginPath(); ctx.moveTo(-bwTop * 0.5, -T); ctx.lineTo(0, -T + 0.055 * H); ctx.lineTo(bwTop * 0.5, -T); ctx.closePath(); ctx.fill();
    disc(ctx, 0.02 * H, -T * 0.65, 0.012 * H, outfit.accent);
    disc(ctx, 0.02 * H, -T * 0.4, 0.012 * H, outfit.accent);
  } else if (o.outfit === "seniman") {
    ctx.fillStyle = outfit.bottom;
    ctx.fillRect(-bwBot * 0.85, -T * 0.42, bwBot * 1.7, T * 0.42);
    ctx.fillRect(-bwTop * 0.55, -T, 0.025 * H, T * 0.6);
    ctx.fillRect(bwTop * 0.25, -T, 0.025 * H, T * 0.6);
    disc(ctx, -0.02 * H, -T * 0.2, 0.016 * H, "#ef4444");
    disc(ctx, 0.04 * H, -T * 0.15, 0.014 * H, "#38bdf8");
  } else if (o.outfit === "petualang") {
    ctx.fillStyle = shade(outfit.top, -0.2);
    rr(ctx, -0.06 * H, -T * 0.55, 0.05 * H, 0.06 * H, 4); ctx.fill();
    rr(ctx, 0.01 * H, -T * 0.55, 0.05 * H, 0.06 * H, 4); ctx.fill();
  }
  ctx.restore();

  tube(ctx, [hip, kF, fF], lw * 1.25, outfit.bottom, comicOutline);
  shoe(fF);
  tube(ctx, [sh, eF], lw * 1.05, outfit.top, comicOutline);
  tube(ctx, [eF, wF], lw * 0.9, skin, comicOutline * 0.8);
  hand(wF);

  if (outfit.prop === "brush") {
    ctx.save();
    ctx.translate(wF.x, wF.y);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#92400e"; ctx.fillRect(0, -0.14 * H, 0.016 * H, 0.14 * H);
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.ellipse(0.008 * H, -0.16 * H, 0.022 * H, 0.035 * H, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(hd.x, hd.y);
  ctx.rotate(P.lean + P.head);

  if (k === "wanita" || (k === "anak" && o.idx % 2 === 1)) {
    disc(ctx, -hr * 0.92, hr * 0.15, hr * 0.36, hair);
  }
  if (k === "nenek") disc(ctx, -hr * 0.25, -hr * 1.02, hr * 0.35, hair);

  const g1 = ctx.createRadialGradient(-hr * 0.25, -hr * 0.35, hr * 0.1, 0, 0, hr * 1.05);
  g1.addColorStop(0, shade(skin, 0.25));
  g1.addColorStop(0.65, skin);
  g1.addColorStop(1, shade(skin, -0.25));
  ctx.fillStyle = g1;
  ctx.beginPath(); ctx.arc(0, 0, hr, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = comicOutline; ctx.strokeStyle = shade(skin, -0.5); ctx.stroke();

  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -hr * 0.05, hr * 1.04, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(hr * 0.4, -hr * 0.45, 0, -hr * 0.55);
  ctx.quadraticCurveTo(-hr * 0.4, -hr * 0.45, -hr * 1.04, -hr * 0.05);
  ctx.fill();

  if (outfit.hat === "beret") {
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.ellipse(-hr * 0.1, -hr * 0.92, hr * 0.85, hr * 0.32, -0.2, 0, Math.PI * 2); ctx.fill();
  } else if (outfit.hat === "safari") {
    ctx.fillStyle = "#65a30d";
    ctx.beginPath(); ctx.ellipse(0, -hr * 0.82, hr * 1.25, hr * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -hr * 0.82, hr * 0.72, Math.PI, 0); ctx.fill();
  } else if (outfit.hat === "cap") {
    ctx.fillStyle = "#ec4899";
    ctx.beginPath(); ctx.arc(0, -hr * 0.78, hr * 0.85, Math.PI, 0); ctx.fill();
    ctx.fillRect(0, -hr * 0.82, hr * 1.25, hr * 0.14);
  }

  if (k === "kakek") {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath(); ctx.ellipse(hr * 0.48, hr * 0.76, hr * 0.38, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 110, 130, 0.35)";
  ctx.beginPath(); ctx.ellipse(hr * 0.18, hr * 0.22, hr * 0.16, hr * 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hr * 0.78, hr * 0.22, hr * 0.14, hr * 0.09, 0, 0, Math.PI * 2); ctx.fill();

  const blink = ((o.t + o.phase) % 3.5) < 0.12 ? 0.12 : 1;
  const emo = P.emo;
  const er = hr * (emo === "kaget" ? 0.25 : 0.21);
  [hr * 0.26, hr * 0.68].forEach((ex) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.ellipse(ex, -hr * 0.06, er, er * blink, 0, 0, Math.PI * 2); ctx.fill();
    if (blink === 1) {
      disc(ctx, ex + er * 0.22, -hr * 0.06, er * 0.58, "#1e1b18");
      disc(ctx, ex + er * 0.36, -hr * 0.16, er * 0.22, "#ffffff");
    }
  });

  ctx.strokeStyle = "#1e1b18"; ctx.lineWidth = hr * 0.085; ctx.lineCap = "round";
  [[hr * 0.26, 1], [hr * 0.68, -1]].forEach(([ex, inner]) => {
    const by = -hr * (emo === "kaget" ? 0.48 : 0.36);
    let iy = by, oy = by;
    if (emo === "marah") { iy = by + hr * 0.14; oy = by - hr * 0.05; }
    else if (emo === "sedih") { iy = by - hr * 0.12; oy = by + hr * 0.04; }
    ctx.beginPath(); ctx.moveTo(ex - inner * hr * 0.16, oy); ctx.lineTo(ex + inner * hr * 0.16, iy); ctx.stroke();
  });

  const mx = hr * 0.48, my = hr * 0.44;
  if (o.mouth > 0.08) {
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath(); ctx.ellipse(mx, my, hr * 0.22, hr * (0.05 + 0.24 * o.mouth), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fca5a5";
    ctx.beginPath(); ctx.arc(mx, my + hr * 0.08, hr * 0.12, 0, Math.PI); ctx.fill();
  } else {
    ctx.strokeStyle = "#451a03"; ctx.lineWidth = hr * 0.08; ctx.beginPath();
    if (emo === "senang" || emo === "normal") ctx.arc(mx, my - hr * 0.06, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (emo === "sedih") ctx.arc(mx, my + hr * 0.18, hr * 0.18, 1.15 * Math.PI, 1.85 * Math.PI);
    else { ctx.moveTo(mx - hr * 0.15, my); ctx.lineTo(mx + hr * 0.15, my); }
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();

  return { x: o.x + o.face * hd.x, y: o.y + hd.y - hr - 0.09 * H };
}

function drawNameTag(ctx, tag, fs, on) {
  ctx.font = `700 ${fs}px ${FONT}`;
  const w = ctx.measureText(tag.name).width + fs * 0.9, h = fs * 1.45;
  ctx.fillStyle = on ? tag.color : "rgba(15, 23, 42, 0.65)";
  rr(ctx, tag.x - w / 2, tag.y - h, w, h, h / 2); ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#1a1208" : "#ffffff";
  ctx.fillText(tag.name, tag.x, tag.y - h / 2 + 1);
}

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
  const fs = portrait ? 38 : 30;
  ctx.font = `700 ${fs}px ${FONT}`;
  const gap = fs * 0.32;
  const boxW = W * 0.88, pad = fs * 0.55;
  const lines = layoutWords(ctx, pw, boxW - pad * 2, gap);
  const lh = fs * 1.32;
  const bh = lines.length * lh + pad * 1.15;
  const bx = W * 0.06, by = H * 0.975 - bh;
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  rr(ctx, bx, by, boxW, bh, fs * 0.55); ctx.fill();
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  lines.forEach((line, li) => {
    let x = bx + (boxW - line.width) / 2;
    const yc = by + pad * 0.58 + li * lh + lh / 2;
    line.items.forEach((it) => {
      const gi = page * per + it.idx;
      if (gi === cw) {
        const p2 = fs * 0.12;
        ctx.fillStyle = ACCENT; rr(ctx, x - p2, yc - fs * 0.6, it.w + p2 * 2, fs * 1.2, fs * 0.22); ctx.fill();
        ctx.fillStyle = "#1a1208";
      } else ctx.fillStyle = gi < cw ? "#ffffff" : "rgba(255,255,255,0.55)";
      ctx.fillText(it.word, x, yc);
      x += it.w + gap;
    });
  });

  const nar = isNarr(active.ln.speaker);
  const cs = g.charsByKey[castKey(active.ln.speaker)];
  const lab = nar ? "📖 Cerita" : active.ln.speaker;
  ctx.font = `800 ${fs * 0.6}px ${FONT}`;
  const lw = ctx.measureText(lab).width + fs * 0.85, lhh = fs * 0.96;
  ctx.fillStyle = nar ? "#94a3b8" : (cs ? cs.color : ACCENT);
  rr(ctx, bx + fs * 0.4, by - lhh / 2, lw, lhh, lhh / 2); ctx.fill();
  ctx.textAlign = "left"; ctx.fillStyle = "#1a1208";
  ctx.fillText(lab, bx + fs * 0.4 + fs * 0.42, by + 1);
}

function buildChars(project, s, prev, W, H) {
  const present = s.present || [];
  const n = Math.max(1, present.length);
  const base = {
    1: [0.5],
    2: [0.34, 0.66],
    3: [0.24, 0.5, 0.76],
    4: [0.18, 0.39, 0.61, 0.82],
  }[Math.min(4, n)];
  const landscape = W > H;
  const shrink = n >= 4 ? 0.84 : n === 3 ? 0.92 : 1;
  const prevKeys = new Set(prev ? (prev.s.present || []).map(castKey) : []);
  const sameLoc = prev && prev.s.location === s.location;

  return present.map((name, i) => {
    const cIdx = project.characters.findIndex((x) => castKey(x.name) === castKey(name));
    const c = project.characters[cIdx] || { name, kind: "anak", outfit: "kasual", color: PALETTE[i % PALETTE.length] };
    const sx = (landscape ? 0.5 + (base[i] - 0.5) * 0.82 : base[i]) * W;
    const kind = c.kind in KINDS ? c.kind : "anak";
    return {
      key: castKey(c.name),
      name: c.name,
      idx: cIdx >= 0 ? cIdx : i,
      kind,
      outfit: c.outfit || "kasual",
      color: c.color || PALETTE[i % PALETTE.length],
      slotX: sx,
      face: sx <= W / 2 ? 1 : -1,
      phase: i * 1.3,
      H: (landscape ? 0.48 : 0.29) * H * KINDS[kind].scale * shrink,
      enter: !(sameLoc && prevKeys.has(castKey(c.name))),
    };
  });
}

function drawFrame(g, T) {
  const { ctx, W, H, tl, total } = g;
  const style = state.project.options.style;
  g.T = T;
  let i = 0;
  for (let k = 0; k < tl.length; k++) if (T >= tl[k].start) i = k;
  const cur = tl[i];
  const t = T - cur.start;
  const active = cur.lines.find((L) => t >= L.start && t < L.start + L.dur + 0.04) || null;

  g.mouth += ((active ? g.rms : 0) - g.mouth) * 0.5;
  drawBackground(g, cur, t);

  const ENTER = 0.75;
  const tags = [];
  g.charsByKey = {};
  const speakerKey = active ? castKey(active.ln.speaker) : null;
  const speakerObj = speakerKey ? cur.chars.find((c) => c.key === speakerKey) : null;

  cur.chars.forEach((ch) => {
    g.charsByKey[ch.key] = ch;
    const speaking = speakerKey === ch.key;
    let face = ch.face;
    if (!speaking && speakerObj) {
      face = speakerObj.slotX >= ch.slotX ? 1 : -1;
    }

    let x = ch.slotX, P;
    if (ch.enter && t < ENTER) {
      const sx = ch.slotX <= W / 2 ? -W * 0.1 : W * 1.1;
      x = lerp(sx, ch.slotX, easeOutCubic(t / ENTER));
      P = computePose("walk", "normal", t);
    } else if (speaking) {
      P = computePose("talk", active.ln.emotion, t);
    } else {
      P = computePose("idle", "normal", T + ch.phase);
    }
    const pos = drawCharacter(ctx, {
      x,
      y: g.groundY,
      H: ch.H,
      face,
      idx: ch.idx,
      color: ch.color,
      kind: ch.kind,
      outfit: ch.outfit,
      style,
      P,
      mouth: speaking ? g.mouth : 0,
      t: T,
      phase: ch.phase,
    });
    tags.push({ name: ch.name, color: ch.color, x: pos.x, y: pos.y, on: !!speaking });
  });

  const tfs = Math.max(17, Math.round(H * (W > H ? 0.036 : 0.024)));
  tags.forEach((tg) => drawNameTag(ctx, tg, tfs, tg.on));

  applyStyleOverlay(ctx, W, H, style);
  drawSubtitle(g, active, t);

  const ts = W > H ? 21 : 23;
  ctx.font = `600 ${ts}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  let title = state.project.title;
  while (title.length > 4 && ctx.measureText(title).width > W * 0.62) title = title.slice(0, -2);
  if (title !== state.project.title) title += "…";
  ctx.textAlign = "left"; ctx.strokeText(title, W * 0.05, 38); ctx.fillText(title, W * 0.05, 38);
  const cnt = `${cur.s.emoji} ${i + 1}/${tl.length}`;
  ctx.textAlign = "right"; ctx.strokeText(cnt, W * 0.95, 38); ctx.fillText(cnt, W * 0.95, 38);

  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(0, 0, W, 7);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, 0, W * clamp(T / total, 0, 1), 7);

  if (t < 0.3) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.3})`; ctx.fillRect(0, 0, W, H); }
  if (T > total - 0.55) { ctx.fillStyle = `rgba(0,0,0,${clamp((T - (total - 0.55)) / 0.55, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
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

function buildTimeline(project) {
  const { w: W, h: H } = dims(project.options.ratio);
  const ENTER = 0.75, GAP = 0.28;
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
  if (typeof MediaRecorder === "undefined") throw new Error("Browser ini tidak bisa merekam video.");
  const project = state.project;
  const { tl, total, W, H } = buildTimeline(project);
  const canvas = $("stage");
  canvas.hidden = false;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const ac = ensureAC();
  await ac.resume().catch(() => {});

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

  scheduleSceneSFX(ac, dest, t0, tl);

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
  try { if (navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); } catch (e) {}

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
    if (rec.state !== "inactive") rec.stop();
    if (wake) wake.release().catch(() => {});
  }
  await stopped;
  const blob = new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] });
  if (blob.size < 1000) throw new Error("Video hasil rekaman kosong.");
  return blob;
}

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
      `Suara Edge              : ${e ? (e.ok ? "✓" : "✕ " + e.error) : "?"}\n` +
      `Browser rekam video     : ${typeof MediaRecorder !== "undefined" ? "✓" : "✕"}`;
  } catch (e) {
    out.textContent = "Gagal: " + e.message;
  }
}

async function shareVideo() {
  try {
    const file = new File([state.blob], state.fileName || "cerita-anak.webm", { type: state.blob.type });
    await navigator.share({ files: [file], title: state.project ? state.project.title : "Cerita Anak" });
  } catch (e) {}
}

function init() {
  $("workerUrl").value = load("worker", "");
  $("appToken").value = load("token", "");
  $("script").value = load("draft", "");
  ["style", "lang", "ratio", "targetSec", "maxScenes", "sfxToggle", "musicUrl"].forEach((id) => {
    const el_ = $(id);
    if (!el_) return;
    el_.value = load(id, el_.value);
    if (el_.value === "" && id !== "musicUrl") el_.selectedIndex = 0;
    el_.addEventListener("change", () => store(id, el_.value));
  });
  if ($("workerUrl").value) $("settings").open = false;

  renderSavedVoicesManager();

  const upd = () => { $("counter").textContent = `${$("script").value.length} / 6000`; };
  $("script").addEventListener("input", () => { upd(); store("draft", $("script").value); });
  upd();

  $("themePreset").addEventListener("change", () => {
    const val = $("themePreset").value;
    if (val && THEME_SCRIPTS[val]) {
      $("script").value = THEME_SCRIPTS[val];
      upd();
      store("draft", THEME_SCRIPTS[val]);
    }
  });

  $("btnSample").addEventListener("click", () => {
    const keys = Object.keys(THEME_SCRIPTS);
    const cur = $("themePreset").value;
    const next = keys[(keys.indexOf(cur) + 1) % keys.length];
    $("themePreset").value = next;
    $("script").value = THEME_SCRIPTS[next];
    upd();
    store("draft", THEME_SCRIPTS[next]);
  });

  renderSteps();
  $("btnSaveSettings").addEventListener("click", () => { saveSettings(); $("healthOut").hidden = false; $("healthOut").textContent = "Pengaturan tersimpan."; });
  $("btnTest").addEventListener("click", testConnection);
  $("btnClearVoices").addEventListener("click", () => { saveVoices({}); $("healthOut").hidden = false; $("healthOut").textContent = "Semua kunci suara dihapus."; });

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
  $("btnResume").addEventListener("click", () => { if (state.failedIndex !== null) run(state.failedIndex); });
  $("btnLockAll").addEventListener("click", () => {
    Object.keys(state.cast).forEach((k) => { state.cast[k].locked = true; persistCast(k); });
    renderCast();
  });
  $("btnCastDone").addEventListener("click", finishCast);
  if (navigator.canShare && navigator.share) $("btnShare").hidden = false;
  $("btnShare").addEventListener("click", shareVideo);
}

init();