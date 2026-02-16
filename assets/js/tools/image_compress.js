import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { bindDragDrop } from "/assets/components/drag.js?v=1.6.26";
import { createImageLightbox, renderThumbnailGrid } from "/assets/components/image_gallery.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import {
  canvasToBlob,
  createSampleImageBlob,
  createZipBlob,
  dataURLToImage,
  fileToDataURL,
  formatBytes
} from "/assets/js/utils.js?v=1.6.26";

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    loaded: "已載入 {count} 張圖片。",
    compressed: "已完成 {count} 張圖片壓縮。",
    inputCount: "輸入數量",
    outputCount: "輸出數量",
    inputSize: "輸入總大小",
    outputSize: "輸出總大小",
    sourceSize: "原始尺寸",
    change: "大小變化",
    largerCount: "仍較大檔案",
    someLarger: "{count} 張圖片因 PNG 特性仍可能比原檔大。",
    noInput: "尚未載入輸入圖片",
    noOutput: "尚未產生輸出圖片",
    closePreview: "關閉"
  },
  en: {
    invalid: "Invalid input format",
    loaded: "Loaded {count} image(s).",
    compressed: "Compressed {count} image(s).",
    inputCount: "Input files",
    outputCount: "Output files",
    inputSize: "Input total",
    outputSize: "Output total",
    sourceSize: "Original size",
    change: "Size change",
    largerCount: "Still larger",
    someLarger: "{count} image(s) may still be larger due to PNG limitations.",
    noInput: "No input images yet",
    noOutput: "No output images yet",
    closePreview: "Close"
  }
};

function t(key, params = {}) {
  const lang = getLanguage();
  const template = copy[lang]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function getFileStem(name) {
  const safeName = String(name || "image");
  const dot = safeName.lastIndexOf(".");
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  return stem || "image";
}

function sumSize(items) {
  return items.reduce((sum, item) => sum + (item.blob?.size || item.file?.size || 0), 0);
}

function revokeOutputUrls(items) {
  items.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

async function blobToImage(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Cannot load image"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getTargetFactor(quality) {
  return clamp(0.2 + quality * 0.8, 0.2, 1);
}

async function buildAdaptivePng(image, sourceSize, quality) {
  const targetBytes = Math.max(1024, Math.floor(sourceSize * getTargetFactor(quality)));
  let width = image.width;
  let height = image.height;
  let best = null;

  for (let step = 0; step < 10; step += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas unavailable");
    }
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/png", 0.92);

    if (!best || blob.size < best.blob.size) {
      best = { blob, width, height };
    }

    if (blob.size <= targetBytes) {
      return { blob, width, height };
    }

    if (width <= 64 || height <= 64) {
      break;
    }

    const ratio = Math.sqrt(targetBytes / Math.max(blob.size, 1));
    const scale = clamp(ratio * 0.98, 0.55, 0.92);
    const nextWidth = Math.max(64, Math.floor(width * scale));
    const nextHeight = Math.max(64, Math.floor(height * scale));
    if (nextWidth === width && nextHeight === height) {
      break;
    }
    width = nextWidth;
    height = nextHeight;
  }

  if (!best) {
    throw new Error("Cannot encode png");
  }
  return best;
}

export default function initImageCompress() {
  const dropZone = document.querySelector("#compress-drop-zone");
  const fileInput = document.querySelector("#compress-file");
  const qualityInput = document.querySelector("#compress-quality");
  const qualityText = document.querySelector("#compress-quality-text");
  const formatInput = document.querySelector("#compress-format");
  const compressBtn = document.querySelector("#compress-btn");
  const sampleBtn = document.querySelector("#compress-sample-btn");
  const clearBtn = document.querySelector("#compress-clear-btn");
  const downloadBtn = document.querySelector("#compress-download-btn");
  const inputGallery = document.querySelector("#compress-input-gallery");
  const outputGallery = document.querySelector("#compress-output-gallery");
  const meta = document.querySelector("#compress-meta");

  if (
    !dropZone ||
    !fileInput ||
    !qualityInput ||
    !qualityText ||
    !formatInput ||
    !compressBtn ||
    !downloadBtn ||
    !inputGallery ||
    !outputGallery ||
    !meta
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 圖片壓縮",
      en: "ToolNestTW Image Compress"
    },
    text: {
      ".hero h1": { zh: "圖片壓縮", en: "Image Compress" },
      ".hero .lead": {
        zh: "透過品質與格式設定壓縮圖片大小。",
        en: "Reduce image size with quality and format options."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#compress-drop-zone strong": {
        zh: "拖曳圖片到這裡（支援單檔/批量）",
        en: "Drop image(s) here (single or batch)"
      },
      "#compress-drop-zone .hint": {
        zh: "或手動選擇一張或多張圖片",
        en: "or choose one or multiple files"
      },
      'label[for="compress-quality"]': { zh: "品質 (10 - 100)", en: "Quality (10 - 100)" },
      'label[for="compress-format"]': { zh: "壓縮格式", en: "Compression format" },
      "#compress-btn": { zh: "壓縮圖片", en: "Compress Image(s)" },
      "#compress-sample-btn": { zh: "載入範例圖片", en: "Load Sample Image" },
      "#compress-clear-btn": { zh: "清除", en: "Clear" },
      "#compress-download-btn": { zh: "下載 PNG / ZIP", en: "Download PNG / ZIP" },
      "#compress-input-gallery-title": { zh: "輸入縮圖", en: "Input thumbnails" },
      "#compress-output-gallery-title": { zh: "輸出縮圖", en: "Output thumbnails" },
      "#compress-gallery-hint": {
        zh: "點擊縮圖可放大檢視。",
        en: "Click a thumbnail to open full-size preview."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 上傳圖片，可單檔或批量。",
        en: "1. Upload image(s), single or batch."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 調整品質與壓縮格式。",
        en: "2. Adjust quality and compression format."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 單檔下載為 PNG，批量下載為 ZIP。",
        en: "3. Single download is PNG, batch download is ZIP."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會改變尺寸嗎？ 可能，為了讓 PNG 更小會自動縮放。",
        en: "Will dimensions change? Possibly, it may auto-resize to reduce PNG size."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "上傳安全嗎？ 所有處理都在瀏覽器本機執行。",
        en: "Is upload private? Everything runs locally in browser."
      }
    }
  });

  let sourceItems = [];
  let outputItems = [];
  let largerCount = 0;
  const lightbox = createImageLightbox();

  qualityText.textContent = `${qualityInput.value}%`;
  qualityInput.addEventListener("input", () => {
    qualityText.textContent = `${qualityInput.value}%`;
  });

  const updateMeta = (rows) => {
    meta.replaceChildren(
      ...rows.map((text) => {
        const item = document.createElement("span");
        item.textContent = text;
        return item;
      })
    );
  };

  const renderGalleries = () => {
    renderThumbnailGrid({
      container: inputGallery,
      items: sourceItems,
      getSrc: (item) => item.dataURL,
      getName: (item) => item.file.name,
      emptyText: t("noInput"),
      onOpen: (payload) => lightbox.open(payload)
    });

    renderThumbnailGrid({
      container: outputGallery,
      items: outputItems,
      getSrc: (item) => item.previewUrl,
      getName: (item) => item.name,
      emptyText: t("noOutput"),
      onOpen: (payload) => lightbox.open(payload)
    });

    lightbox.setCloseLabel(t("closePreview"));
  };

  const renderMeta = () => {
    if (!sourceItems.length) {
      meta.textContent = "";
      return;
    }

    const first = sourceItems[0];
    const inputTotal = sumSize(sourceItems);
    const rows = [
      `${t("inputCount")}: ${sourceItems.length}`,
      `${t("inputSize")}: ${formatBytes(inputTotal)}`,
      `${t("sourceSize")}: ${first.image.width} x ${first.image.height}`
    ];

    if (outputItems.length) {
      const outputTotal = sumSize(outputItems);
      const change = inputTotal > 0 ? (((outputTotal - inputTotal) / inputTotal) * 100).toFixed(1) : "0.0";
      rows.push(`${t("outputCount")}: ${outputItems.length}`);
      rows.push(`${t("outputSize")}: ${formatBytes(outputTotal)}`);
      rows.push(`${t("change")}: ${change}%`);
      if (largerCount > 0) {
        rows.push(`${t("largerCount")}: ${largerCount}`);
      }
    }

    updateMeta(rows);
  };

  const clearOutputState = () => {
    revokeOutputUrls(outputItems);
    outputItems = [];
    largerCount = 0;
    downloadBtn.disabled = true;
  };

  const applySourceItems = (items) => {
    sourceItems = items;
    clearOutputState();
    renderMeta();
    renderGalleries();
  };

  const readFiles = async (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      toast(t("invalid"));
      return;
    }

    try {
      const loaded = [];
      for (const file of imageFiles) {
        const dataURL = await fileToDataURL(file);
        const image = await dataURLToImage(dataURL);
        loaded.push({ file, dataURL, image });
      }
      applySourceItems(loaded);
      toast(t("loaded", { count: loaded.length }), "success");
    } catch {
      toast(t("invalid"));
    }
  };

  bindDragDrop({
    dropZone,
    fileInput,
    onFiles: readFiles
  });

  compressBtn.addEventListener("click", async () => {
    if (!sourceItems.length) {
      toast(t("invalid"));
      return;
    }

    const quality = Number(qualityInput.value) / 100;
    const outputType = formatInput.value;

    try {
      const outputs = [];
      let localLargerCount = 0;
      for (const item of sourceItems) {
        const canvas = document.createElement("canvas");
        canvas.width = item.image.width;
        canvas.height = item.image.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas unavailable");
        }
        ctx.drawImage(item.image, 0, 0);
        const qualityFactor = outputType === "image/png" ? undefined : quality;
        const compressedBlob = await canvasToBlob(canvas, outputType, qualityFactor);
        const compressedImage = await blobToImage(compressedBlob);
        const adaptive = await buildAdaptivePng(
          compressedImage,
          Math.max(item.file.size || 0, compressedBlob.size || 0, 1),
          quality
        );
        const pngBlob = adaptive.blob;
        if (item.file.size && pngBlob.size > item.file.size) {
          localLargerCount += 1;
        }

        outputs.push({
          name: `${getFileStem(item.file.name)}-compressed.png`,
          blob: pngBlob,
          previewUrl: URL.createObjectURL(pngBlob)
        });
      }

      clearOutputState();
      outputItems = outputs;
      largerCount = localLargerCount;
      downloadBtn.disabled = false;
      renderMeta();
      renderGalleries();
      toast(t("compressed", { count: outputs.length }), "success");
      if (localLargerCount > 0) {
        toast(t("someLarger", { count: localLargerCount }));
      }
    } catch {
      toast(t("invalid"));
    }
  });

  sampleBtn?.addEventListener("click", async () => {
    try {
      const sample = await createSampleImageBlob();
      const sampleFile = new File([sample], "sample.png", { type: "image/png" });
      await readFiles([sampleFile]);
    } catch {
      toast(t("invalid"));
    }
  });

  clearBtn?.addEventListener("click", () => {
    sourceItems = [];
    clearOutputState();
    fileInput.value = "";
    meta.textContent = "";
    renderGalleries();
  });

  downloadBtn.addEventListener("click", async () => {
    if (!outputItems.length) {
      toast(t("invalid"));
      return;
    }

    if (outputItems.length === 1) {
      downloadBlob(outputItems[0].blob, outputItems[0].name);
      return;
    }

    try {
      const zipBlob = await createZipBlob(outputItems.map((item) => ({ name: item.name, blob: item.blob })));
      downloadBlob(zipBlob, "ToolNestTW-compressed-images.zip");
    } catch {
      toast(t("invalid"));
    }
  });

  onLanguageChange(() => {
    renderMeta();
    renderGalleries();
  });

  window.addEventListener("pagehide", () => {
    revokeOutputUrls(outputItems);
    lightbox.destroy();
  });

  renderGalleries();
}





