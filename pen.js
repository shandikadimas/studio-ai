/* =====================================================================
 *  pen.js — Animator Pena Otomatis (gaya "Sketsa Pena")
 *  Tangan + pena menggambar ilustrasi doodle langsung di kertas, mengikuti
 *  kata kunci tiap kalimat narasi: masalah, uang, rumah, sedih, solusi, dst.
 *  Tokoh digambar saat pertama kali bicara, lalu bergerak (mulut & lengan).
 *  Tanpa gambar AI: semua digambar sebagai goresan vektor di kanvas.
 *  Memakai helper dari script.js: clamp, lerp, easeInOutCubic, castKey,
 *  isNarr, matchObject, drawSubtitle.
 * ===================================================================== */
"use strict";

const PEN_INK = "#1f2433", PEN_PAPER = "#fbf6e8", PEN_DESK = "#b9ad92";
const PEN_FONT = `"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Marker Felt",cursive`;

/* ---------- pembangun bentuk (kotak 100×100, pusat 0,0) ---------- */
const PP = {
  arc(cx, cy, rx, ry, a0, a1) { const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 3)), o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; },
  circ(cx, cy, r) { return PP.arc(cx, cy, r, r, -Math.PI / 2, Math.PI * 1.5); },
  ell(cx, cy, rx, ry) { return PP.arc(cx, cy, rx, ry, -Math.PI / 2, Math.PI * 1.5); },
  poly(pts) { return pts.concat([pts[0]]); },
  rect(x, y, w, h) { return PP.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); },
  bez(a, b, c, d) { const o = []; for (let i = 0; i <= 18; i++) { const u = i / 18, v = 1 - u; o.push([v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]); } return o; },
  join(...ps) { return [].concat(...ps); },
};
const PS = (p, f, w, c) => ({ p, f: f || null, w: w || 1, c: c || null });
const PL = (...pts) => pts; // garis/polyline terbuka

const PEN_DEF = {
  coin: () => [PS(PP.circ(0, 0, 38), "#ffd34d"), PS(PP.circ(0, 0, 28)), PS(PP.bez([9, -15], [-16, -20], [16, 10], [-9, 15])), PS(PL([0, -22], [0, 22])), PS(PL([28, -42], [34, -50])), PS(PL([40, -30], [48, -34]))],
  house: () => [PS(PP.rect(-34, -6, 68, 48), "#f6dcae"), PS(PP.poly([[-44, -4], [0, -44], [44, -4]]), "#e0654a"), PS(PP.rect(-8, 18, 16, 24), "#a4693a"), PS(PP.rect(12, 6, 14, 14), "#bfe3ff"), PS(PP.rect(-26, 6, 14, 14), "#bfe3ff"), PS(PP.rect(18, -38, 9, 18), "#c9573f")],
  tree: () => [PS(PP.rect(-6, 8, 12, 36), "#9a6a3a"), PS(PP.circ(0, -14, 28), "#5cc47a"), PS(PP.circ(-20, 6, 18), "#4fb86d"), PS(PP.circ(20, 6, 18), "#4fb86d")],
  flower: () => [PS(PL([0, 34], [0, -6])), PS(PP.bez([0, 18], [-14, 8], [-22, 14], [-24, 4]), "#6bcf8b"), PS(PP.poly([[-18, 30], [18, 30], [14, 48], [-14, 48]]), "#d57a4f")]
    .concat([0, 1, 2, 3, 4].map((k) => PS(PP.circ(Math.cos(k * 1.2566 - 1.5) * 13, -20 + Math.sin(k * 1.2566 - 1.5) * 13, 8), "#ff7fa5"))).concat([PS(PP.circ(0, -20, 7), "#ffd43b")]),
  cup: () => [PS(PP.poly([[-28, -8], [28, -8], [22, 36], [-22, 36]]), "#fff3dc"), PS(PP.arc(30, 14, 12, 12, -1.4, 1.4)), PS(PP.ell(0, -8, 28, 6), "#8b5a3c"), PS(PP.bez([-10, -18], [-18, -28], [-2, -34], [-10, -48])), PS(PP.bez([10, -18], [2, -28], [18, -34], [10, -48]))],
  book: () => [PS(PP.poly([[-46, -28], [-2, -22], [-2, 32], [-46, 36]]), "#fff8e6"), PS(PP.poly([[46, -28], [2, -22], [2, 32], [46, 36]]), "#fffdf2"), PS(PL([-50, -30], [-50, 40], [0, 36], [50, 40], [50, -30])), PS(PL([-38, -12], [-12, -9])), PS(PL([-38, 2], [-12, 5])), PS(PL([12, -9], [38, -12])), PS(PL([12, 5], [38, 2]))],
  heart: () => [PS(PP.join(PP.bez([0, 36], [-64, -4], [-34, -52], [0, -18]), PP.bez([0, -18], [34, -52], [64, -4], [0, 36])), "#ff6f8f")],
  star: () => { const p = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 18 : 44, a = -Math.PI / 2 + k * Math.PI / 5; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [PS(PP.poly(p), "#ffd23f")]; },
  bird: () => [PS(PP.ell(0, 6, 34, 21), "#d29a5e"), PS(PP.circ(28, -14, 14), "#dca56b"), PS(PP.poly([[39, -16], [56, -10], [39, -5]]), "#f0b43a"), PS(PP.circ(32, -18, 2.4), PEN_INK), PS(PP.poly([[-32, 2], [-60, -14], [-52, 12]]), "#b8803f"), PS(PP.ell(-4, 4, 19, 10), "#c18a50"), PS(PL([-4, 26], [-6, 40])), PS(PL([8, 26], [10, 40]))],
  sun: () => [PS(PP.circ(0, 0, 22), "#ffc933")].concat(Array.from({ length: 10 }, (_, k) => { const a = k * Math.PI / 5; return PS(PL([Math.cos(a) * 31, Math.sin(a) * 31], [Math.cos(a) * 47, Math.sin(a) * 47])); })),
  moon: () => [PS(PP.join(PP.arc(0, 0, 34, 34, 0.85, 5.4), PP.bez([21, -27], [-8, -14], [-8, 16], [22, 26])), "#fff0a8"), PS(PL([34, -26], [34, -14])), PS(PL([28, -20], [40, -20])), PS(PL([40, 16], [40, 24])), PS(PL([36, 20], [44, 20]))],
  cloud: () => [PS(PP.join(PP.bez([-34, 22], [-52, 22], [-50, -2], [-30, -2]), PP.bez([-30, -2], [-30, -24], [0, -30], [6, -12]), PP.bez([6, -12], [20, -26], [44, -16], [38, 2]), PP.bez([38, 2], [56, 4], [54, 24], [36, 22]), [[-34, 22]]), "#eaf3ff"), PS(PL([-18, 32], [-22, 44])), PS(PL([0, 32], [-4, 44])), PS(PL([18, 32], [14, 44]))],
  basket: () => [PS(PP.arc(0, -6, 34, 34, Math.PI, 2 * Math.PI)), PS(PP.circ(-12, -18, 11), "#e63946"), PS(PP.circ(14, -20, 11), "#80c342"), PS(PP.poly([[-42, -4], [42, -4], [32, 38], [-32, 38]]), "#d39a55"), PS(PL([-16, -4], [-12, 38])), PS(PL([0, -4], [0, 38])), PS(PL([16, -4], [12, 38]))],
  bulb: () => [PS(PP.circ(0, -10, 26), "#ffe27a"), PS(PP.rect(-11, 16, 22, 8), "#c3ccd6"), PS(PP.rect(-8, 26, 16, 7), "#c3ccd6"), PS(PL([-8, 14], [-4, -6], [4, 6], [8, -8])), PS(PL([0, -48], [0, -57])), PS(PL([-30, -34], [-37, -41])), PS(PL([30, -34], [37, -41])), PS(PL([-40, -10], [-49, -10])), PS(PL([40, -10], [49, -10]))],
  clock: () => [PS(PP.circ(0, 0, 38), "#ffffff"), PS(PL([0, -34], [0, -29])), PS(PL([34, 0], [29, 0])), PS(PL([0, 34], [0, 29])), PS(PL([-34, 0], [-29, 0])), PS(PL([0, 0], [0, -20]), null, 1.3), PS(PL([0, 0], [16, 6]), null, 1.3)],
  arrow: () => [PS(PL([-40, 26], [-14, 2], [0, 14], [30, -16]), null, 1.3), PS(PP.poly([[40, -28], [40, -2], [14, -28]]), "#36d399")],
  question: () => [PS(PP.join(PP.arc(0, -18, 17, 17, Math.PI * 1.1, Math.PI * 2.25), PP.bez([12, -6], [2, 2], [0, 8], [0, 16])), null, 1.4), PS(PP.circ(0, 32, 4), PEN_INK), PS(PL([-34, -46], [-41, -54])), PS(PL([34, -46], [41, -54]))],
  knot: () => { const p = []; for (let i = 0; i < 72; i++) { const a = i * 0.62, r = 8 + i * 0.5; p.push([Math.cos(a) * r * 1.15, Math.sin(a * 0.93) * r * 0.85]); } return [PS(p, null, 1.1, "#e4572e")]; },
  mountain: () => [PS(PP.poly([[-48, 34], [-14, -26], [4, 0], [18, -14], [48, 34]]), "#b9c6d8"), PS(PL([-14, -26], [-14, -46])), PS(PP.poly([[-14, -46], [4, -41], [-14, -35]]), "#e4572e")],
  chartUp: () => [PS(PL([-40, -38], [-40, 34], [42, 34])), PS(PP.rect(-30, 14, 14, 20), "#9ad0ff"), PS(PP.rect(-9, 0, 14, 34), "#9ad0ff"), PS(PP.rect(12, -18, 14, 52), "#9ad0ff"), PS(PL([-34, 4], [-12, -12], [8, -24], [28, -40]), null, 1.3, "#e4572e"), PS(PP.poly([[42, -48], [38, -30], [22, -42]]), "#e4572e", 1, "#e4572e")],
  chartDown: () => [PS(PL([-40, -38], [-40, 34], [42, 34])), PS(PP.rect(-30, -18, 14, 52), "#9ad0ff"), PS(PP.rect(-9, 0, 14, 34), "#9ad0ff"), PS(PP.rect(12, 14, 14, 20), "#9ad0ff"), PS(PL([-34, -34], [-12, -20], [8, -6], [28, 8]), null, 1.3, "#e4572e"), PS(PP.poly([[42, 16], [22, 12], [36, -2]]), "#e4572e", 1, "#e4572e")],
  wallet: () => [PS(PP.rect(-38, -18, 70, 50), "#b9794a"), PS(PP.poly([[-38, -18], [-30, -30], [24, -30], [32, -18]]), "#cf9060"), PS(PP.rect(12, -4, 28, 20), "#e2b184"), PS(PP.circ(26, 6, 3.5), "#ffd34d"), PS(PP.circ(-16, 46, 6), "#ffd34d")],
  warn: () => [PS(PP.poly([[0, -42], [44, 34], [-44, 34]]), "#ffd23f"), PS(PL([0, -16], [0, 10]), null, 1.6), PS(PP.circ(0, 22, 2.5), PEN_INK)],
  faceSad: () => [PS(PP.circ(0, 0, 36), "#ffe08a"), PS(PP.circ(-12, -8, 3), PEN_INK), PS(PP.circ(12, -8, 3), PEN_INK), PS(PL([-19, -19], [-8, -15])), PS(PL([19, -19], [8, -15])), PS(PP.arc(0, 28, 14, 10, Math.PI * 1.15, Math.PI * 1.85)), PS(PP.join(PP.bez([-14, 0], [-21, 12], [-7, 12], [-14, 0])), "#8ecbff")],
  faceHappy: () => [PS(PP.circ(0, 0, 36), "#ffe08a"), PS(PP.arc(-12, -6, 4, 4, Math.PI, 2 * Math.PI)), PS(PP.arc(12, -6, 4, 4, Math.PI, 2 * Math.PI)), PS(PP.arc(0, 6, 18, 16, 0.15, Math.PI - 0.15)), PS(PP.circ(-23, 8, 4), "#ffb3b3"), PS(PP.circ(23, 8, 4), "#ffb3b3")],
  phone: () => [PS(PP.rect(-20, -40, 40, 80), "#dfe6f2"), PS(PP.rect(-15, -32, 30, 56), "#8fb8e8"), PS(PP.circ(0, 32, 3.5)), PS(PL([-9, -20], [9, -20])), PS(PL([-9, -10], [4, -10]))],
  laptop: () => [PS(PP.rect(-34, -32, 68, 44), "#dfe6f2"), PS(PP.rect(-28, -26, 56, 32), "#8fb8e8"), PS(PP.poly([[-44, 12], [44, 12], [50, 26], [-50, 26]]), "#c3ccd6"), PS(PL([-12, -14], [8, -14])), PS(PL([-12, -6], [0, -6]))],
  gear: () => { const p = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; [[-0.2, 30], [-0.12, 41], [0.12, 41], [0.2, 30]].forEach(([d, r]) => p.push([Math.cos(a + d) * r, Math.sin(a + d) * r])); } return [PS(PP.poly(p), "#c9d1dc"), PS(PP.circ(0, 0, 12), PEN_PAPER)]; },
  check: () => [PS(PP.circ(0, 0, 36), "#c9f5dc"), PS(PL([-16, 2], [-4, 14], [18, -12]), null, 1.8, "#1f9d63")],
  car: () => [PS(PP.poly([[-46, 16], [-46, -2], [-30, -4], [-20, -22], [16, -22], [30, -4], [46, 0], [46, 16]]), "#ff8a5c"), PS(PP.poly([[-18, -4], [-14, -17], [2, -17], [2, -4]]), "#bfe3ff"), PS(PP.poly([[8, -4], [8, -17], [16, -17], [24, -4]]), "#bfe3ff"), PS(PP.circ(-26, 18, 9), "#3b3f4a"), PS(PP.circ(26, 18, 9), "#3b3f4a")],
  lock: () => [PS(PP.join([[-16, -4]], PP.arc(0, -4, 16, 20, Math.PI, 2 * Math.PI), [[16, -4]])), PS(PP.rect(-24, -4, 48, 40), "#ffd23f"), PS(PP.circ(0, 14, 5), PEN_INK), PS(PL([0, 19], [0, 27]))],
  sprout: () => [PS(PL([0, 40], [0, -6])), PS(PP.bez([0, 10], [-30, 12], [-34, -14], [-6, -14]), "#6bcf8b"), PS(PP.bez([0, 0], [26, 2], [32, -24], [6, -24]), "#6bcf8b"), PS(PP.poly([[-30, 42], [30, 42], [22, 28], [-22, 28]]), "#9a6a3a")],
  plate: () => [PS(PP.circ(0, 0, 34), "#ffffff"), PS(PP.circ(0, 0, 23)), PS(PP.arc(0, 5, 14, 10, Math.PI, 2 * Math.PI), "#ffb454"), PS(PL([-52, -6], [-52, 32])), PS(PL([-58, -30], [-58, -6])), PS(PL([-52, -30], [-52, -6])), PS(PL([-46, -30], [-46, -6])), PS(PP.ell(52, -18, 5, 9)), PS(PL([52, -9], [52, 32]))],
  medic: () => [PS(PP.circ(0, 0, 36), "#ffd6d6"), PS(PP.poly([[-8, -24], [8, -24], [8, -8], [24, -8], [24, 8], [8, 8], [8, 24], [-8, 24], [-8, 8], [-24, 8], [-24, -8], [-8, -8]]), "#e4572e")],
};

/* Kata → ilustrasi. Aturan pena didahulukan (masalah, emosi, angka), lalu aturan objek bawaan. */
const PEN_RULES = [
  ["knot", /^(masalah|pusing|bingung|ruwet|kusut|rumit|pening|stres|stress|kacau|problem)/],
  ["mountain", /^(sulit|susah|berat|tantangan|rintangan|hambatan|kendala|kesulitan|mendaki|puncak|gunung)/],
  ["question", /^(kenapa|mengapa|bagaimana|apakah|pertanyaan|penasaran|tanya|why|how)$/],
  ["chartUp", /^(naik|melonjak|meningkat|melambung|inflasi|mahal|tagihan|lonjakan)/],
  ["chartDown", /^(turun|anjlok|merosot|menurun|rugi|kerugian|susut|berkurang)/],
  ["wallet", /^(dompet|bokek|kosong|habis|kehabisan|boros|utang|hutang|cicilan)/],
  ["warn", /^(bahaya|awas|waspada|risiko|ancaman|peringatan|darurat|kaget|terkejut)/],
  ["faceSad", /^(sedih|menangis|nangis|kecewa|cemas|khawatir|takut|lelah|capek|letih|gelisah|murung|sepi|rindu)/],
  ["faceHappy", /^(senang|bahagia|tersenyum|senyum|tertawa|tawa|lega|syukur|gembira|ceria|bangga)/],
  ["phone", /^(hp|ponsel|telepon|telpon|handphone|gawai|chat|sosmed|medsos)/],
  ["laptop", /^(laptop|komputer|internet|digital|online|aplikasi|website|kantor)/],
  ["gear", /^(mesin|sistem|proses|teknologi|otomatis|mekanis|pabrik)/],
  ["check", /^(berhasil|selesai|beres|sukses|benar|tepat|jawaban|lunas)/],
  ["car", /^(mobil|motor|kendaraan|macet|bensin|sepeda|bus|kereta|truk)/],
  ["lock", /^(kunci|aman|keamanan|dilindungi|sandi|password|gembok)/],
  ["sprout", /^(tumbuh|benih|bibit|menanam|tanam|panen|tunas|semai|bertani|petani)/],
  ["plate", /^(nasi|makan|lapar|masak|dapur|lauk|piring|sayur|lezat|kenyang)/],
  ["medic", /^(sakit|demam|obat|dokter|puskesmas|sehat|kesehatan|batuk|flu)/],
];
function penMatch(word) {
  const w = String(word).toLowerCase().replace(/[^\p{L}]/gu, "");
  if (w.length < 2) return null;
  for (const [ty, re] of PEN_RULES) if (re.test(w)) return ty;
  return matchObject(word);
}
function penFallback(L) {
  const txt = String(L.ln.text || ""), emo = String(L.ln.emotion || "");
  if (/\?/.test(txt)) return "question";
  if (/sedih/.test(emo)) return "faceSad";
  if (/senang/.test(emo)) return "faceHappy";
  if (/kaget|marah/.test(emo)) return "warn";
  return null;
}

/* ---------- kompilasi goresan: resample, getar tangan, panjang, jeda angkat pena ---------- */
function penCompile(raw) {
  let cur = 0, prev = null; const out = [];
  raw.forEach((s, si) => {
    const src = s.p, pts = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[i + 1];
      if (!b) { pts.push([a[0], a[1]]); break; }
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
      for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    pts.forEach((p, i) => { p[0] += Math.sin(i * 1.7 + si * 2.3) * 0.55; p[1] += Math.cos(i * 1.3 + si * 1.9) * 0.55; });
    let len = 0; const cum = [0];
    for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(len); }
    const tr = prev ? Math.hypot(pts[0][0] - prev[0], pts[0][1] - prev[1]) * 0.25 : 0;
    const o = Object.assign({}, s, { pts, cum, len, tr0: cur, from: prev });
    cur += tr; o.start = cur; cur += len; o.end = cur; prev = pts[pts.length - 1]; out.push(o);
  });
  return { strokes: out, total: Math.max(1, cur) };
}
const PEN_CACHE = {};
function penDef(type) { return PEN_CACHE[type] || (PEN_CACHE[type] = penCompile((PEN_DEF[type] || PEN_DEF.star)())); }

function penAt(s, d) {
  let i = 1; while (i < s.cum.length - 1 && s.cum[i] < d) i++;
  const a = s.pts[i - 1], b = s.pts[i], span = (s.cum[i] - s.cum[i - 1]) || 1, f = clamp((d - s.cum[i - 1]) / span, 0, 1);
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), i, f];
}

/* Gambar bentuk bertahap. o: { ink, lw, el (detik sejak mulai), D (durasi), swing }. Mengembalikan posisi ujung pena (unit) atau null. */
function penShape(ctx, def, p, o) {
  const u = clamp(p, 0, 1) * def.total; let tip = null;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const withSwing = (s, fn) => { if (s.sw && o.swing) { ctx.save(); ctx.translate(s.sw[0], s.sw[1]); ctx.rotate(o.swing); ctx.translate(-s.sw[0], -s.sw[1]); fn(); ctx.restore(); } else fn(); };
  for (const s of def.strokes) {
    if (!s.f || u < s.end - 0.001) continue;
    const a = clamp((o.el - (s.end / def.total) * o.D) / 0.45, 0, 1); if (a <= 0) continue;
    withSwing(s, () => { ctx.globalAlpha = a * 0.9; ctx.fillStyle = s.f; ctx.beginPath(); s.pts.forEach((q, i) => (i ? ctx.lineTo(q[0] + 1.2, q[1] + 1.2) : ctx.moveTo(q[0] + 1.2, q[1] + 1.2))); ctx.closePath(); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  for (const s of def.strokes) {
    if (u < s.tr0) break;
    if (u < s.start) { const f = (u - s.tr0) / Math.max(0.001, s.start - s.tr0); if (s.from) tip = [lerp(s.from[0], s.pts[0][0], f), lerp(s.from[1], s.pts[0][1], f)]; continue; }
    const d = clamp(u - s.start, 0, s.len); if (d <= 0) continue;
    withSwing(s, () => {
      ctx.strokeStyle = s.c || o.ink; ctx.lineWidth = o.lw * s.w;
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalAlpha = pass ? 0.28 : 1; const dx = pass ? 0.8 : 0, dy = pass ? -0.7 : 0;
        ctx.beginPath(); ctx.moveTo(s.pts[0][0] + dx, s.pts[0][1] + dy);
        if (d >= s.len) { for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] + dx, s.pts[i][1] + dy); }
        else { const e = penAt(s, d); for (let i = 1; i < e[2]; i++) ctx.lineTo(s.pts[i][0] + dx, s.pts[i][1] + dy); ctx.lineTo(e[0] + dx, e[1] + dy); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    if (u < s.end) { const e = penAt(s, d); tip = [e[0], e[1]]; }
  }
  ctx.globalAlpha = 1;
  return p >= 1 ? null : tip;
}

/* ---------- tokoh doodle (kotak 100×170, pusat 0,0) ---------- */
function penPersonDef(ch) {
  const L = ch.look || {}, kind = ch.kind || "dewasa_pria", kid = /^anak/.test(kind), old = /^(kakek|nenek)$/.test(kind);
  const skin = L.skin || "#f2c9a5", hc = L.hairColor || "#3a2a22", top = L.top || "#4da3ff", bot = L.bottom || "#3b4a6b", hair = L.hair || "pendek", legs = L.legs || "pants";
  const key = [kind, skin, hc, top, bot, hair, legs, L.glasses ? 1 : 0, L.beard || ""].join("|");
  if (PEN_CACHE[key]) return PEN_CACHE[key];
  const r = kid ? 20 : 17, hy = kid ? -54 : -60, S_ = [];
  const flow = hair === "panjang" || hair === "bob" || hair === "kuncir";
  if (flow) { S_.push(PS(PP.poly([[-r - 1, hy - 2], [-r - 4, hy + 24], [-r + 5, hy + 24], [-r + 2, hy + 2]]), hc)); S_.push(PS(PP.poly([[r + 1, hy - 2], [r + 4, hy + 24], [r - 5, hy + 24], [r - 2, hy + 2]]), hc)); }
  const dress = legs === "skirt" || legs === "longdress";
  if (dress) {
    S_.push(PS(PP.rect(-13, -40, 26, 28), top));
    const hem = legs === "longdress" ? 58 : 30; S_.push(PS(PP.poly([[-13, -12], [13, -12], [27, hem], [-27, hem]]), legs === "longdress" ? top : bot));
    if (legs === "skirt") { S_.push(PS(PL([-7, 30], [-7, 60]))); S_.push(PS(PL([7, 30], [7, 60]))); }
  } else {
    S_.push(PS(PP.rect(-13, -40, 26, 50), top)); S_.push(PS(PP.rect(-12, 10, 10, 50), bot)); S_.push(PS(PP.rect(2, 10, 10, 50), bot));
  }
  S_.push(PS(PP.ell(-8, 64, 10, 4), "#4a3b32")); S_.push(PS(PP.ell(8, 64, 10, 4), "#4a3b32"));
  S_.push(PS(PP.join(PL([-13, -36], [-25, -8], [-23, 14]), PP.circ(-23, 18, 4)), null, 1.4));
  const arm = PS(PP.join(PL([13, -36], [25, -8], [23, 14]), PP.circ(23, 18, 4)), null, 1.4); arm.sw = [13, -36]; S_.push(arm);
  if (/kakek/.test(kind)) S_.push(PS(PL([-30, 4], [-30, 66]), null, 1.5, "#8a5a2b"));
  S_.push(PS(PP.circ(0, hy, r), skin));
  if (hair !== "botak") S_.push(PS(PP.poly(PP.arc(0, hy, r + 1.5, r + 1.5, Math.PI * 1.04, Math.PI * 1.96)), hc));
  if (hair === "sanggul") S_.push(PS(PP.circ(0, hy - r - 5, 8), hc));
  if (hair === "kuncir") S_.push(PS(PP.poly([[r - 2, hy - 8], [r + 15, hy - 2], [r + 12, hy + 16], [r + 4, hy + 4]]), hc));
  S_.push(PS(PP.circ(-6, hy + 1, 1.8), PEN_INK)); S_.push(PS(PP.circ(6, hy + 1, 1.8), PEN_INK));
  if (L.glasses) { S_.push(PS(PP.circ(-6.5, hy + 1, 5.5), null, 0.7)); S_.push(PS(PP.circ(6.5, hy + 1, 5.5), null, 0.7)); S_.push(PS(PL([-1, hy + 1], [1, hy + 1]), null, 0.7)); }
  if (L.beard === "jenggot") S_.push(PS(PP.poly([[-11, hy + 8], [11, hy + 8], [8, hy + 24], [0, hy + 28], [-8, hy + 24]]), "#e8e8ee"));
  if (L.beard === "kumis") S_.push(PS(PL([-7, hy + 8], [0, hy + 6], [7, hy + 8]), null, 0.9));
  const def = penCompile(S_); def.mouthY = hy + r * 0.52; return (PEN_CACHE[key] = def);
}

/* ---------- tulisan tangan & tangan memegang pena ---------- */
function penWrite(g, text, cx, y, fs, p, color, opts) {
  const { ctx } = g; if (p <= 0 || !text) return;
  ctx.save(); ctx.font = `700 ${fs}px ${PEN_FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const w = ctx.measureText(text).width, x0 = cx - w / 2;
  if (opts && opts.mark) { ctx.globalAlpha = 0.55; ctx.fillStyle = opts.mark; ctx.fillRect(x0 - 4, y - fs * 0.25, (w + 8) * p, fs * 0.38); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.rect(x0 - 6, y - fs * 1.1, w * p + 8, fs * 1.6); ctx.clip();
  ctx.fillStyle = color || PEN_INK; ctx.fillText(text, x0, y); ctx.restore();
  if (p < 1) g.tip = { x: x0 + w * p, y: y - fs * 0.25 };
}
function penHand(g, x, y, a, T) {
  const { ctx, W, H } = g, k = Math.min(W, H) / 720;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x + Math.sin(T * 38) * 0.8, y + Math.cos(T * 33) * 0.8); ctx.rotate(-0.85); ctx.scale(k, k);
  ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(120, 26, 150, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5b6ee1"; ctx.strokeStyle = "#3a4aa8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.rect(190, -38, 190, 76); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PEN_INK; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, -6); ctx.lineTo(30, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ff7a2f"; ctx.strokeStyle = "#b8501a"; ctx.beginPath(); ctx.rect(30, -7, 128, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffc9a3"; ctx.fillRect(138, -7, 20, 14);
  ctx.fillStyle = "#f2c9a5"; ctx.strokeStyle = "#c99872"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(150, 6, 48, 31, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(104, -13, 26, 11, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  [0, 1, 2].forEach((n) => { ctx.beginPath(); ctx.ellipse(112 + n * 3, 14 + n * 10, 28, 9, 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  ctx.restore();
}

/* ---------- tata letak & jadwal gambar tiap adegan ---------- */
function penLayout(W, H, no, np) {
  const land = W > H * 1.05; let ob, pb;
  if (land) { if (np) { ob = { x: W * 0.04, y: H * 0.1, w: W * 0.54, h: H * 0.66 }; pb = { x: W * 0.6, y: H * 0.12, w: W * 0.36, h: H * 0.66 }; } else ob = { x: W * 0.05, y: H * 0.1, w: W * 0.9, h: H * 0.66 }; }
  else if (np) { ob = { x: W * 0.04, y: H * 0.09, w: W * 0.92, h: H * 0.37 }; pb = { x: W * 0.04, y: H * 0.47, w: W * 0.92, h: H * 0.35 }; }
  else ob = { x: W * 0.05, y: H * 0.1, w: W * 0.9, h: H * 0.7 };
  const objs = [], pers = [];
  if (no) {
    let cols = clamp(Math.round(Math.sqrt(no * ob.w / ob.h)), 1, no); const rows = Math.ceil(no / cols); cols = Math.ceil(no / rows);
    const cw = ob.w / cols, ch = ob.h / rows, size = Math.min(cw, ch * 0.8, Math.min(W, H) * 0.44) * 0.8;
    for (let n = 0; n < no; n++) {
      const r = Math.floor(n / cols), c = n % cols, cnt = Math.min(cols, no - r * cols);
      objs.push({ cx: ob.x + (ob.w - cnt * cw) / 2 + (c + 0.5) * cw, cy: ob.y + (r + 0.5) * ch - ch * 0.06, size, row: r, fs: clamp(size * 0.2, 20, Math.min(W, H) * 0.062) });
    }
  }
  if (np) {
    const cw = pb.w / np, fs = clamp(Math.min(W, H) * 0.04, 20, 40), hp = Math.min(pb.h - fs * 1.8, cw * 1.75, H * 0.5);
    for (let n = 0; n < np; n++) pers.push({ cx: pb.x + (n + 0.5) * cw, cy: pb.y + hp / 2, h: hp, fs });
  }
  return { objs, pers };
}

function penPlan(g, cur) {
  if (cur.penPlan) return cur.penPlan;
  const { W, H } = g, wants = [], seen = new Set();
  cur.lines.forEach((L) => {
    let got = false;
    L.words.forEach((w, wi) => {
      if (wants.length >= 5) return; const ty = penMatch(w); if (!ty || seen.has(ty)) return;
      seen.add(ty); got = true; const lb = w.replace(/[^\p{L}\p{N}-]/gu, "");
      wants.push({ kind: "doodle", type: ty, label: lb ? lb[0].toUpperCase() + lb.slice(1) : "", t: L.start + (L.times[wi] || 0) - 0.1 });
    });
    if (!got && wants.length < 5) { const ty = penFallback(L); if (ty && !seen.has(ty)) { seen.add(ty); wants.push({ kind: "doodle", type: ty, label: "", t: L.start + 0.25 }); } }
  });
  if (!wants.length) wants.push({ kind: "doodle", type: (cur.objs[0] && cur.objs[0].type) || "star", label: "", t: cur.enter * 0.6 });
  const chars = (cur.chars || []).filter((ch) => ch.wins && ch.wins.length).slice(0, 3);
  chars.forEach((ch) => wants.push({ kind: "person", ch, label: ch.name, t: ch.wins[0][0] + 0.6 - 0.5 }));
  wants.sort((a, b) => a.t - b.t);
  // muat dalam durasi adegan: buang ilustrasi terakhir bila terlalu padat, lalu padatkan waktu gambar
  const t00 = cur.i === 0 && g.title ? 2.1 : 0.35, budget = Math.max(1.2, cur.dur - 0.5 - t00);
  const minNeed = () => wants.reduce((a, w) => a + (w.kind === "person" ? 1.4 : 1.2), 0);
  while (minNeed() > budget) { let k = -1; wants.forEach((w, n) => { if (w.kind === "doodle") k = n; }); if (k < 0 || wants.filter((w) => w.kind === "doodle").length <= 1) break; wants.splice(k, 1); }
  const baseNeed = wants.reduce((a, w, n) => a + (w.kind === "person" ? 2 : 1.5) + (w.label ? 0.7 : 0) + 0.05 + (w.kind === "doodle" && n ? 0.5 : 0), 0), fk = clamp(budget / Math.max(0.1, baseNeed), 0.5, 1);
  const lay = penLayout(W, H, wants.filter((x) => x.kind === "doodle").length, chars.length);
  let cursor = t00, oi = 0, pi = 0, prevObj = null; const items = [], arrows = [];
  wants.forEach((w) => {
    const isP = w.kind === "person", slot = isP ? lay.pers[pi++] : lay.objs[oi++];
    const arrowIn = !isP && prevObj && prevObj.slot.row === slot.row && Math.abs(slot.cx - prevObj.slot.cx) > slot.size * 0.9;
    const lead = arrowIn ? 0.5 * fk : 0, ld0 = w.label ? 0.7 * fk : 0, end = cur.dur - 0.15;
    let t0 = Math.max(w.t, cursor + lead), D = (isP ? 2 : 1.5) * fk, ld = ld0;
    if (t0 + D + ld > end) { t0 = Math.max(cursor + lead, end - D - ld); if (t0 + D + ld > end) { const k2 = Math.max(0, (end - t0) / (D + ld)); D *= k2; ld *= k2; } }
    if (D < 0.35) return;
    const it = Object.assign({}, w, { slot, t0, D, lt0: t0 + D, ld, idx: items.length });
    if (arrowIn) { const sz = slot.size * 0.5, gap = slot.size * 0.12; arrows.push({ x1: prevObj.slot.cx + sz + gap, x2: slot.cx - sz - gap, y: slot.cy, t0: t0 - 0.5 * fk, t1: t0 - 0.05 }); }
    cursor = t0 + D + ld + 0.05; items.push(it); if (!isP) prevObj = it;
  });
  return (cur.penPlan = { items, arrows });
}

/* ---------- frame ---------- */
function penPaper(g, T) {
  const { ctx, W, H } = g;
  ctx.fillStyle = PEN_PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(80,120,170,0.10)"; ctx.lineWidth = 1.5; const st = Math.round(H / 26);
  ctx.beginPath(); for (let y = st; y < H; y += st) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
  ctx.strokeStyle = "rgba(220,80,80,0.18)"; ctx.beginPath(); ctx.moveTo(W * 0.07, 0); ctx.lineTo(W * 0.07, H); ctx.stroke();
}
function penDrawArrow(g, ar, t) {
  const p = clamp((t - ar.t0) / (ar.t1 - ar.t0), 0, 1); if (p <= 0 || ar.x2 - ar.x1 < 16) return;
  const { ctx } = g, x = lerp(ar.x1, ar.x2, p), hd = Math.min(18, (ar.x2 - ar.x1) * 0.4);
  ctx.save(); ctx.strokeStyle = "#e4572e"; ctx.lineWidth = g.lw * 1.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(ar.x1, ar.y); ctx.quadraticCurveTo((ar.x1 + x) / 2, ar.y - 8 * p, x, ar.y); ctx.stroke();
  if (p > 0.85) { ctx.beginPath(); ctx.moveTo(x - hd, ar.y - hd * 0.7); ctx.lineTo(x, ar.y); ctx.lineTo(x - hd, ar.y + hd * 0.7); ctx.stroke(); }
  ctx.restore(); if (p < 1) g.tip = { x, y: ar.y };
}
function penDrawItem(g, it, t, T, active) {
  const { ctx } = g, el = t - it.t0; if (el < 0) return;
  const isP = it.kind === "person", p = clamp(el / it.D, 0, 1), sl = it.slot, done = p >= 1;
  const sc = isP ? sl.h / 170 : sl.size / 100, def = isP ? penPersonDef(it.ch) : penDef(it.type);
  const speaking = isP && active && castKey(active.ln.speaker) === it.ch.key;
  const bob = done ? Math.sin(T * 2 + it.idx) * (isP ? 1.6 : 2.2) : 0, sway = done && !isP ? Math.sin(T * 1.3 + it.idx) * 0.025 : 0, pop = done && el < it.D + 0.35 ? 1 + 0.07 * Math.sin(((el - it.D) / 0.35) * Math.PI) : 1;
  ctx.save(); ctx.translate(sl.cx, sl.cy + bob); ctx.rotate(sway); ctx.scale(sc * pop, sc * pop);
  const tip = penShape(ctx, def, p, { ink: PEN_INK, lw: g.lw / sc, el, D: it.D, swing: speaking ? Math.sin(T * 7) * 0.45 : 0 });
  if (isP && done) {
    const my = def.mouthY; ctx.lineWidth = g.lw / sc * 0.8; ctx.strokeStyle = PEN_INK; ctx.lineCap = "round";
    if (speaking) { ctx.fillStyle = "#8a2b2b"; ctx.beginPath(); ctx.ellipse(0, my, 4.2, 1.2 + g.mouth * 4.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, my - 2, 4.6, 0.25, Math.PI - 0.25); ctx.stroke(); }
  }
  if (tip) g.tip = { x: sl.cx + (tip[0] * sc * pop) , y: sl.cy + bob + tip[1] * sc * pop };
  ctx.restore();
  if (it.label) {
    const lp = clamp((t - it.lt0) / it.ld, 0, 1), fs = isP ? sl.fs : sl.fs, ly = isP ? sl.cy + sl.h / 2 + fs * 1.15 : sl.cy + sl.size * 0.5 + fs * 1.0;
    penWrite(g, it.label, sl.cx, ly, fs, lp, PEN_INK, { mark: isP ? it.ch.color : "#ffd23f" });
  }
}

function drawPenFrame(g, cur, t, T, active, i) {
  const { ctx, W, H } = g, plan = penPlan(g, cur); g.tip = null; g.lw = Math.max(2.6, Math.min(W, H) * 0.0048);
  ctx.fillStyle = PEN_DESK; ctx.fillRect(0, 0, W, H);
  const slide = i > 0 && t < 0.55 ? easeInOutCubic(t / 0.55) : 1;
  ctx.save(); ctx.translate((1 - slide) * W, 0);
  if (slide < 1) { const gr = ctx.createLinearGradient(-26, 0, 0, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.35)"); ctx.fillStyle = gr; ctx.fillRect(-26, 0, 26, H); }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  penPaper(g, T);
  const pr = clamp(t / cur.dur, 0, 1), z = 1 + 0.035 * g.k * (i % 2 ? 1 - pr : pr);
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  if (i === 0 && g.title) { const fs = Math.round(Math.min(W, H) * 0.062); penWrite(g, String(g.title).slice(0, 48), W / 2, H * 0.075 + fs * 0.4, fs, clamp((t - 0.5) / 1.4, 0, 1), PEN_INK, { mark: "#ffd23f" }); }
  plan.arrows.forEach((ar) => penDrawArrow(g, ar, t));
  plan.items.forEach((it) => penDrawItem(g, it, t, T, active));
  // tangan: mengikuti ujung pena dengan halus, keluar layar saat tidak menggambar
  const hd = g.hand || (g.hand = { x: W * 1.1, y: H * 1.1, a: 0 });
  if (g.tip) { const f = hd.a < 0.05 ? 1 : 0.6; hd.x = lerp(hd.x, g.tip.x, f); hd.y = lerp(hd.y, g.tip.y, f); hd.a += (1 - hd.a) * 0.25; }
  else { hd.x = lerp(hd.x, W * 0.98, 0.06); hd.y = lerp(hd.y, H * 1.1, 0.06); hd.a += (0 - hd.a) * 0.15; }
  if (hd.a > 0.03) penHand(g, hd.x, hd.y, hd.a, T);
  ctx.restore(); ctx.restore();
  drawSubtitle(g, active, t);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, H - 6, W, 6); ctx.fillStyle = "#e4572e"; ctx.fillRect(0, H - 6, W * clamp(T / g.total, 0, 1), 6);
}
