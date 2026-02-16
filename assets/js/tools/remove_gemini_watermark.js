import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { bindDragDrop } from "/assets/components/drag.js?v=1.6.26";
import { createImageLightbox, renderThumbnailGrid } from "/assets/components/image_gallery.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { createZipBlob, formatBytes } from "/assets/js/utils.js?v=1.6.26";

const GEMINI_RULES = {
  large: {
    logoSize: 96,
    marginRight: 64,
    marginBottom: 64,
    alphaFile: "bg_96.png"
  },
  small: {
    logoSize: 48,
    marginRight: 32,
    marginBottom: 32,
    alphaFile: "bg_48.png"
  }
};

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    loaded: "已載入 {count} 張圖片。",
    removed: "已完成 {count} 張圖片浮水印移除。",
    inputCount: "輸入數量",
    outputCount: "輸出數量",
    inputSize: "輸入總大小",
    outputSize: "輸出總大小",
    dimensions: "尺寸",
    block: "浮水印區塊",
    noInput: "尚未載入輸入圖片",
    noOutput: "尚未產生輸出圖片",
    closePreview: "關閉",
    processFail: "處理失敗：{reason}"
  },
  en: {
    invalid: "Invalid input format",
    loaded: "Loaded {count} image(s).",
    removed: "Watermark removed for {count} image(s).",
    inputCount: "Input files",
    outputCount: "Output files",
    inputSize: "Input total",
    outputSize: "Output total",
    dimensions: "Dimensions",
    block: "Watermark block",
    noInput: "No input images yet",
    noOutput: "No output images yet",
    closePreview: "Close",
    processFail: "Process failed: {reason}"
  }
};

const alphaCache = new Map();

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

function revokeSourceUrls(items) {
  items.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

function revokeOutputUrls(items) {
  items.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

function clamp255(value) {
  return Math.max(0, Math.min(255, value));
}

async function imageFromURL(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot load image"));
    image.src = url;
  });
}

function getToolBaseUrl() {
  const href = String(window.location.href).split("#")[0].split("?")[0];
  return href.endsWith("/") ? href : `${href}/`;
}

function buildToolAssetUrl(filename, version = "1.6.22") {
  const url = new URL(filename, getToolBaseUrl());
  url.searchParams.set("v", version);
  return url.toString();
}

async function getAlphaData(path) {
  if (alphaCache.has(path)) {
    return alphaCache.get(path);
  }

  let alphaImage;
  try {
    alphaImage = await imageFromURL(path);
  } catch {
    const fallbackPath = String(path).split("?")[0];
    alphaImage = await imageFromURL(fallbackPath);
  }
  const canvas = document.createElement("canvas");
  canvas.width = alphaImage.naturalWidth;
  canvas.height = alphaImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  ctx.drawImage(alphaImage, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const result = { width: canvas.width, height: canvas.height, data };
  alphaCache.set(path, result);
  return result;
}

function selectRule(width, height) {
  return width > 1024 && height > 1024 ? GEMINI_RULES.large : GEMINI_RULES.small;
}

async function removeWatermarkFromCanvas(canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const rule = selectRule(width, height);
  const { logoSize, marginRight, marginBottom, alphaFile } = rule;
  const alphaPath = buildToolAssetUrl(alphaFile);
  const x = width - marginRight - logoSize;
  const y = height - marginBottom - logoSize;

  if (x < 0 || y < 0) {
    throw new Error("Image too small");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  const alphaInfo = await getAlphaData(alphaPath);
  if (alphaInfo.width !== logoSize || alphaInfo.height !== logoSize) {
    throw new Error("Alpha pattern mismatch");
  }

  const patch = ctx.getImageData(x, y, logoSize, logoSize);
  const patchData = patch.data;
  const alphaData = alphaInfo.data;

  for (let index = 0; index < patchData.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const wmValue = patchData[index + channel];
      const alphaValue = alphaData[index + channel];
      const denominator = 1 - alphaValue / 255;
      const recovered = denominator <= 0.001 ? wmValue : (wmValue - alphaValue) / denominator;
      patchData[index + channel] = clamp255(Math.round(recovered));
    }
  }

  ctx.putImageData(patch, x, y);
  return { x, y, size: logoSize };
}

async function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Cannot export image"));
        return;
      }
      resolve(blob);
    }, type);
  });
}

export default function initRemoveGeminiWatermark() {
  const dropZone = document.querySelector("#gemini-drop-zone");
  const fileInput = document.querySelector("#gemini-file");
  const removeBtn = document.querySelector("#gemini-remove-btn");
  const sampleBtn = document.querySelector("#gemini-sample-btn");
  const clearBtn = document.querySelector("#gemini-clear-btn");
  const downloadBtn = document.querySelector("#gemini-download-btn");
  const inputGallery = document.querySelector("#gemini-input-gallery");
  const outputGallery = document.querySelector("#gemini-output-gallery");
  const meta = document.querySelector("#gemini-meta");

  if (
    !dropZone ||
    !fileInput ||
    !removeBtn ||
    !sampleBtn ||
    !clearBtn ||
    !downloadBtn ||
    !inputGallery ||
    !outputGallery ||
    !meta
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW Gemini 浮水印移除",
      en: "ToolNestTW Gemini Watermark Remover"
    },
    text: {
      ".hero h1": { zh: "Gemini 浮水印移除", en: "Gemini Watermark Remover" },
      ".hero .lead": {
        zh: "使用已知樣板在本機端修復右下角 Gemini 浮水印區塊。",
        en: "Repair Gemini watermark area locally using known overlay patterns."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#gemini-drop-zone strong": {
        zh: "拖曳圖片到這裡（支援單檔/批量）",
        en: "Drop image(s) here (single or batch)"
      },
      "#gemini-drop-zone .hint": {
        zh: "或手動選擇一張或多張圖片",
        en: "or choose one or multiple files"
      },
      "#gemini-remove-btn": { zh: "移除浮水印", en: "Remove Watermark" },
      "#gemini-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#gemini-clear-btn": { zh: "清除", en: "Clear" },
      "#gemini-download-btn": { zh: "下載 PNG / ZIP", en: "Download PNG / ZIP" },
      "#gemini-input-gallery-title": { zh: "輸入縮圖", en: "Input thumbnails" },
      "#gemini-output-gallery-title": { zh: "輸出縮圖", en: "Output thumbnails" },
      "#gemini-gallery-hint": {
        zh: "點擊縮圖可放大檢視。",
        en: "Click a thumbnail to open full-size preview."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 上傳含 Gemini 浮水印的圖片，可單檔或批量。",
        en: "1. Upload Gemini-watermarked image(s), single or batch."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊移除浮水印。",
        en: "2. Click Remove Watermark."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 單檔下載為 PNG，批量下載為 ZIP。",
        en: "3. Single download is PNG, batch download is ZIP."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會上傳圖片嗎？ 不會，所有處理都在瀏覽器本機執行。",
        en: "Is upload private? Yes, everything runs locally in browser."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "適用哪些圖？ 依 Gemini 既定浮水印位置與樣式設計。",
        en: "Which images are supported? Based on Gemini watermark position/style."
      }
    }
  });

  let sourceItems = [];
  let outputItems = [];
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
      getSrc: (item) => item.previewUrl,
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

    const firstSource = sourceItems[0];
    const rows = [
      `${t("inputCount")}: ${sourceItems.length}`,
      `${t("inputSize")}: ${formatBytes(sumSize(sourceItems))}`,
      `${t("dimensions")}: ${firstSource.image.naturalWidth} x ${firstSource.image.naturalHeight}`
    ];

    if (outputItems.length) {
      const firstOutput = outputItems[0];
      rows.push(`${t("outputCount")}: ${outputItems.length}`);
      rows.push(`${t("outputSize")}: ${formatBytes(sumSize(outputItems))}`);
      rows.push(
        `${t("block")}: (${firstOutput.details.x}, ${firstOutput.details.y}) ${firstOutput.details.size}x${firstOutput.details.size}`
      );
    }

    updateMeta(rows);
  };

  const clearOutputState = () => {
    revokeOutputUrls(outputItems);
    outputItems = [];
    downloadBtn.disabled = true;
  };

  const applySourceItems = (items) => {
    revokeSourceUrls(sourceItems);
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
        const previewUrl = URL.createObjectURL(file);
        const image = await imageFromURL(previewUrl);
        loaded.push({ file, previewUrl, image });
      }
      applySourceItems(loaded);
      toast(t("loaded", { count: loaded.length }), "success");
    } catch (error) {
      toast(t("processFail", { reason: error?.message || t("invalid") }));
    }
  };

  bindDragDrop({
    dropZone,
    fileInput,
    onFiles: readFiles
  });

  removeBtn.addEventListener("click", async () => {
    if (!sourceItems.length) {
      toast(t("invalid"));
      return;
    }

    try {
      const outputs = [];
      for (const item of sourceItems) {
        const canvas = document.createElement("canvas");
        canvas.width = item.image.naturalWidth;
        canvas.height = item.image.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas unavailable");
        }
        ctx.drawImage(item.image, 0, 0);
        const details = await removeWatermarkFromCanvas(canvas);
        const blob = await canvasToBlob(canvas, "image/png");
        outputs.push({
          name: `${getFileStem(item.file.name)}-gemini-clean.png`,
          blob,
          details,
          previewUrl: URL.createObjectURL(blob)
        });
      }

      clearOutputState();
      outputItems = outputs;
      downloadBtn.disabled = false;
      renderMeta();
      renderGalleries();
      toast(t("removed", { count: outputs.length }), "success");
    } catch (error) {
      toast(t("processFail", { reason: error?.message || t("invalid") }));
    }
  });

  sampleBtn.addEventListener("click", async () => {
    try {
      const response = await fetch(buildToolAssetUrl("ex.png"));
      if (!response.ok) {
        throw new Error(`Sample fetch failed (${response.status})`);
      }
      const sampleBlob = await response.blob();
      const file = new File([sampleBlob], "sample.png", { type: sampleBlob.type || "image/png" });
      await readFiles([file]);
    } catch (error) {
      toast(t("processFail", { reason: error?.message || t("invalid") }));
    }
  });

  clearBtn.addEventListener("click", () => {
    revokeSourceUrls(sourceItems);
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
      downloadBlob(zipBlob, "ToolNestTW-gemini-clean-images.zip");
    } catch (error) {
      toast(t("processFail", { reason: error?.message || t("invalid") }));
    }
  });

  onLanguageChange(() => {
    renderMeta();
    renderGalleries();
  });

  window.addEventListener("pagehide", () => {
    revokeSourceUrls(sourceItems);
    revokeOutputUrls(outputItems);
    lightbox.destroy();
  });

  renderGalleries();
}





