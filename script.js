function baseUrl() {
  let u = $("workerUrl").value.trim().replace(/\/+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) throw new Error("URL Worker harus diawali https://");
  try { u = new URL(u).origin; } catch (e) { throw new Error("URL Worker tidak valid."); }
  return u;
}
async function makeLine(profile, text) {
  const ac = ensureAC();
  const key = castKey(profile && profile.name);
  if (key && getCustomAudioBuffer(key)) {
    return { buf: await decodeCustomAudio(key), detune: 0, custom: true };
  }
  const hasWorker = !!baseUrl();
  if (!hasWorker || ($("useBrowserSpeech") && $("useBrowserSpeech").checked)) {
    const ok = await synthBrowserSpeechBuffer(profile, text, profile.lang || $("lang").value);
    const estSec = clamp(text.length * 0.068, 1.4, 14);
    if (ok || !hasWorker) {
      return { buf: ac.createBuffer(1, Math.round(ac.sampleRate * estSec), ac.sampleRate), detune: 0, browserSpeech: !!ok };
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
