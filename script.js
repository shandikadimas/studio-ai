const CAMERA_MOTIONS = [
  { label: "Slow Push-In", motion: "slow camera push-in toward the main subject and key props" },
  { label: "Pan Right", motion: "smooth horizontal camera pan right revealing environmental storytelling details" },
  { label: "Orbit Arc", motion: "gentle orbit arc shot around the foreground props and character" },
  { label: "Pull Back Reveal", motion: "gradual camera pull-back revealing wider surroundings and atmosphere" }
];

const PROP_RULES = [
  {
    keywords: ["uang", "rupiah", "seratus", "belanja", "harga", "mahal", "murah", "inflasi", "koin", "dompet"],
    propsId: "Lembaran uang kertas & koin kembalian di atas meja kayu, keranjang belanja, struk/label harga, dan wadah penyimpanan kecil",
    propsEn: "crisp banknotes and scattered coins on a wooden table, small shopping basket, price tags, and a ceramic jar"
  },
  {
    keywords: ["warung", "jajan", "makan", "minum", "kopi", "makanan", "snack", "gelas", "piring"],
    propsId: "Etalase kaca warung, aneka bungkus jajanan & camilan, gelas kaca berisi minuman hangat, serta piring kecil",
    propsEn: "glass snack display cabinet, colorful snack packages, glass cup with warm drink, and small plates"
  },
  {
    keywords: ["rumah", "keluarga", "teras", "kursi", "meja", "lampu", "pot", "tanaman"],
    propsId: "Meja kayu teras, kursi rotan/kayu, pot tanaman hijau dengan dedaunan, serta lampu hangat di latar belakang",
    propsEn: "wooden porch table, woven chairs, potted green plants with leaves, and warm ambient lamps in the background"
  },
  {
    keywords: ["kerja", "belajar", "buku", "laptop", "catatan", "meja kerja", "hp", "ponsel"],
    propsId: "Buku catatan terbuka, pena, cangkir minuman, ponsel/perangkat kerja, dan cahaya lampu meja yang fokus",
    propsEn: "open notebook, pen, drink mug, smartphone or workspace tools, and focused desk lamp lighting"
  }
];

function detectProps(text) {
  const lower = text.toLowerCase();
  const matchedId = [];
  const matchedEn = [];

  for (const rule of PROP_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      matchedId.push(rule.propsId);
      matchedEn.push(rule.propsEn);
    }
  }

  if (matchedId.length === 0) {
    matchedId.push("Meja kayu dengan properti pendukung cerita, benda simbolis utama di tengah frame, dan latar lingkungan yang bernuansa");
    matchedEn.push("wooden table with story-relevant props, symbolic focal object in center frame, and rich atmospheric background");
  }

  return {
    id: matchedId.join("; "),
    en: matchedEn.join(", ")
  };
}

function splitIntoScenes(rawText) {
  const cleaned = rawText
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (cleaned.length > 0) return cleaned;
  return ["Cerita singkat tentang perubahan suasana sehari-hari dan makna di balik setiap momen."];
}

function buildScenes() {
  const rawText = document.getElementById("scriptInput").value.trim();
  const visualStyle = document.getElementById("visualStyle").value;
  const aspectRatio = document.getElementById("aspectRatio").value;

  const lines = splitIntoScenes(rawText);
  return lines.map((narasi, idx) => {
    const cam = CAMERA_MOTIONS[idx % CAMERA_MOTIONS.length];
    const props = detectProps(narasi);

    const imagePrompt = `${visualStyle}, storytelling scene depicting "${narasi}", featuring ${props.en}, expressive character gesture, warm natural lighting, rich depth of field, high detail, no text, no watermark ${aspectRatio}`;
    const motionPrompt = `Character shows subtle expressive movement and natural breathing, ${props.en} have gentle secondary motion, ambient floating particles and soft light shifts, ${cam.motion}, smooth frame rate, coherent physics`;

    return {
      sceneNumber: idx + 1,
      title: `Adegan ${idx + 1}`,
      narasi,
      propsId: props.id,
      cameraLabel: cam.label,
      imagePrompt,
      motionPrompt,
      sfx: "Suara ambien ruang yang lembut, efek gerakan objek halus, dan musik latar bernuansa cerita"
    };
  });
}

let currentScenes = [];

function renderScenes(scenes) {
  currentScenes = scenes;
  const container = document.getElementById("scenesContainer");
  const countBadge = document.getElementById("sceneCount");
  countBadge.textContent = `${scenes.length} Adegan`;

  container.innerHTML = scenes
    .map(
      (sc) => `
      <article class="scene-card">
        <div class="scene-top">
          <h3 class="scene-title">${sc.title}</h3>
          <span class="camera-tag">Kamera: ${sc.cameraLabel}</span>
        </div>

        <div class="field-block">
          <div class="field-label">Narasi / Voiceover</div>
          <div>${escapeHtml(sc.narasi)}</div>
        </div>

        <div class="field-block">
          <div class="field-label">Objek &amp; Properti di Frame</div>
          <div>${escapeHtml(sc.propsId)}</div>
        </div>

        <div class="field-block">
          <div class="field-label">Image Prompt (English)</div>
          <div class="prompt-box">
            <span>${escapeHtml(sc.imagePrompt)}</span>
            <button class="copy-btn" type="button" data-copy="${escapeAttr(sc.imagePrompt)}">Salin</button>
          </div>
        </div>

        <div class="field-block">
          <div class="field-label">Motion Prompt (English)</div>
          <div class="prompt-box">
            <span>${escapeHtml(sc.motionPrompt)}</span>
            <button class="copy-btn" type="button" data-copy="${escapeAttr(sc.motionPrompt)}">Salin</button>
          </div>
        </div>

        <div class="field-block">
          <div class="field-label">Saran SFX &amp; Audio</div>
          <div>${escapeHtml(sc.sfx)}</div>
        </div>
      </article>
    `
    )
    .join("");

  container.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = "Tersalin";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      } catch {
        btn.textContent = "Gagal";
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("'", "&#39;");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("btnGenerate").addEventListener("click", () => {
  renderScenes(buildScenes());
});

document.getElementById("btnExportJson").addEventListener("click", () => {
  if (!currentScenes.length) renderScenes(buildScenes());
  downloadFile("rencana-adegan-ai-motion.json", JSON.stringify(currentScenes, null, 2), "application/json");
});

document.getElementById("btnExportMd").addEventListener("click", () => {
  if (!currentScenes.length) renderScenes(buildScenes());
  const md = currentScenes
    .map(
      (sc) =>
        `## ${sc.title} — ${sc.cameraLabel}\n\n` +
        `- **Narasi:** ${sc.narasi}\n` +
        `- **Objek & Properti:** ${sc.propsId}\n` +
        `- **Image Prompt:** \`${sc.imagePrompt}\`\n` +
        `- **Motion Prompt:** \`${sc.motionPrompt}\`\n` +
        `- **Saran SFX & Audio:** ${sc.sfx}\n`
    )
    .join("\n---\n\n");
  downloadFile("rencana-adegan-ai-motion.md", md, "text/markdown;charset=utf-8");
});

// Muat contoh awal saat halaman dibuka
document.getElementById("scriptInput").value =
  "Dulu uang seratus ribu bisa belanja banyak di warung dan jajan bersama di teras rumah, tapi sekarang cepat sekali habis karena harga kebutuhan naik.";
renderScenes(buildScenes());
