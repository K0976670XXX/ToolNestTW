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
    resized: "已完成 {count} 張圖片尺寸調整。",
    inputCount: "輸入數量",
    outputCount: "輸出數量",
    inputSize: "輸入總大小",
    outputSize: "輸出總大小",
    originalSize: "原始尺寸",
    targetSize: "目標尺寸",
    noInput: "尚未載入輸入圖片",
    noOutput: "尚未產生輸出圖片",
    closePreview: "關閉"
  },
  en: {
    invalid: "Invalid input format",
    loaded: "Loaded {count} image(s).",
    resized: "Resized {count} image(s).",
    inputCount: "Input files",
    outputCount: "Output files",
    inputSize: "Input total",
    outputSize: "Output total",
    originalSize: "Original size",
    targetSize: "Target size",
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

export default function initImageResize() {
  const dropZone = document.querySelector("#resize-drop-zone");
  const fileInput = document.querySelector("#resize-file");
  const widthInput = document.querySelector("#resize-width");
  const heightInput = document.querySelector("#resize-height");
  const keepRatioInput = document.querySelector("#resize-keep-ratio");
  const resizeBtn = document.querySelector("#resize-btn");
  const sampleBtn = document.querySelector("#resize-sample-btn");
  const clearBtn = document.querySelector("#resize-clear-btn");
  const downloadBtn = document.querySelector("#resize-download-btn");
  const inputGallery = document.querySelector("#resize-input-gallery");
  const outputGallery = document.querySelector("#resize-output-gallery");
  const meta = document.querySelector("#resize-meta");

  if (
    !dropZone ||
    !fileInput ||
    !widthInput ||
    !heightInput ||
    !resizeBtn ||
    !downloadBtn ||
    !inputGallery ||
    !outputGallery ||
    !meta
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 圖片尺寸調整",
      en: "ToolNestTW Image Resize"
    },
    text: {
      ".hero h1": { zh: "圖片尺寸調整", en: "Image Resize" },
      ".hero .lead": {
        zh: "上傳圖片後設定尺寸並下載調整結果。",
        en: "Upload image(s), set dimensions, and download resized output."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#resize-drop-zone strong": {
        zh: "拖曳圖片到這裡（支援單檔/批量）",
        en: "Drop image(s) here (single or batch)"
      },
      "#resize-drop-zone .hint": {
        zh: "或手動選擇一張或多張圖片",
        en: "or choose one or multiple files"
      },
      'label[for="resize-width"]': { zh: "寬度 (px)", en: "Width (px)" },
      'label[for="resize-height"]': { zh: "高度 (px)", en: "Height (px)" },
      "#resize-keep-ratio-text": { zh: "固定比例", en: "Keep aspect ratio" },
      "#resize-btn": { zh: "調整尺寸", en: "Resize Image(s)" },
      "#resize-sample-btn": { zh: "載入範例圖片", en: "Load Sample Image" },
      "#resize-clear-btn": { zh: "清除", en: "Clear" },
      "#resize-download-btn": { zh: "下載 PNG / ZIP", en: "Download PNG / ZIP" },
      "#resize-input-gallery-title": { zh: "輸入縮圖", en: "Input thumbnails" },
      "#resize-output-gallery-title": { zh: "輸出縮圖", en: "Output thumbnails" },
      "#resize-gallery-hint": {
        zh: "點擊縮圖可放大檢視。",
        en: "Click a thumbnail to open full-size preview."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 上傳圖片或直接拖曳，可單檔或批量。",
        en: "1. Upload or drop image(s), single or batch."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 設定寬高後點擊調整尺寸。",
        en: "2. Set width and height, then click Resize Image(s)."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 單檔下載為 PNG，批量下載為 ZIP。",
        en: "3. Single download is PNG, batch download is ZIP."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "上傳安全嗎？ 安全，檔案不會離開你的瀏覽器。",
        en: "Is upload private? Yes, files never leave your browser."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "可以固定比例嗎？ 調整寬高前先勾選固定比例。",
        en: "Can I keep ratio? Enable Keep aspect ratio first."
      }
    }
  });

  let sourceItems = [];
  let outputItems = [];
  let sourceRatio = 1;
  let lastTargetWidth = 0;
  let lastTargetHeight = 0;
  const lightbox = createImageLightbox();

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
    const rows = [
      `${t("inputCount")}: ${sourceItems.length}`,
      `${t("inputSize")}: ${formatBytes(sumSize(sourceItems))}`,
      `${t("originalSize")}: ${first.image.width} x ${first.image.height}`
    ];

    if (outputItems.length) {
      rows.push(`${t("outputCount")}: ${outputItems.length}`);
      rows.push(`${t("outputSize")}: ${formatBytes(sumSize(outputItems))}`);
      rows.push(`${t("targetSize")}: ${lastTargetWidth} x ${lastTargetHeight}`);
    }

    updateMeta(rows);
  };

  const clearOutputState = () => {
    revokeOutputUrls(outputItems);
    outputItems = [];
    downloadBtn.disabled = true;
    lastTargetWidth = 0;
    lastTargetHeight = 0;
  };

  const applySourceItems = (items) => {
    sourceItems = items;
    clearOutputState();
    sourceRatio = items[0].image.width / items[0].image.height;
    widthInput.value = String(items[0].image.width);
    heightInput.value = String(items[0].image.height);
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

  widthInput.addEventListener("input", () => {
    if (!keepRatioInput.checked || !sourceItems.length) {
      return;
    }
    const width = Number(widthInput.value);
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    heightInput.value = String(Math.round(width / sourceRatio));
  });

  heightInput.addEventListener("input", () => {
    if (!keepRatioInput.checked || !sourceItems.length) {
      return;
    }
    const height = Number(heightInput.value);
    if (!Number.isFinite(height) || height <= 0) {
      return;
    }
    widthInput.value = String(Math.round(height * sourceRatio));
  });

  resizeBtn.addEventListener("click", async () => {
    if (!sourceItems.length) {
      toast(t("invalid"));
      return;
    }

    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      toast(t("invalid"));
      return;
    }

    try {
      const outputs = [];
      for (const item of sourceItems) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas unavailable");
        }
        ctx.drawImage(item.image, 0, 0, width, height);
        const pngBlob = await canvasToBlob(canvas, "image/png", 0.92);
        outputs.push({
          name: `${getFileStem(item.file.name)}-resized.png`,
          blob: pngBlob,
          previewUrl: URL.createObjectURL(pngBlob)
        });
      }

      clearOutputState();
      outputItems = outputs;
      lastTargetWidth = width;
      lastTargetHeight = height;
      downloadBtn.disabled = false;
      renderMeta();
      renderGalleries();
      toast(t("resized", { count: outputs.length }), "success");
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
    widthInput.value = "800";
    heightInput.value = "600";
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
      downloadBlob(zipBlob, "ToolNestTW-resized-images.zip");
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





