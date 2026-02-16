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
    noInput: "請先上傳圖片",
    emptyText: "請輸入浮水印文字",
    loaded: "已載入 {count} 張圖片。",
    converted: "已完成 {count} 張圖片浮水印轉換。",
    inputCount: "輸入數量",
    outputCount: "輸出數量",
    inputSize: "輸入總大小",
    outputSize: "輸出總大小",
    sourceSize: "原始尺寸",
    watermarkText: "浮水印文字",
    watermarkColor: "浮水印顏色",
    fontSize: "字體大小",
    opacity: "透明度",
    angle: "旋轉角度",
    spacing: "文字間距",
    outputFormat: "輸出格式",
    mode: "模式",
    singleMode: "單張即時預覽",
    batchMode: "批量待轉換",
    noInputThumb: "尚未載入輸入圖片",
    noOutputThumb: "尚未產生輸出圖片",
    closePreview: "關閉"
  },
  en: {
    invalid: "Invalid input format",
    noInput: "Please upload image(s) first",
    emptyText: "Please enter watermark text",
    loaded: "Loaded {count} image(s).",
    converted: "Converted {count} image(s).",
    inputCount: "Input files",
    outputCount: "Output files",
    inputSize: "Input total",
    outputSize: "Output total",
    sourceSize: "Original size",
    watermarkText: "Watermark text",
    watermarkColor: "Watermark color",
    fontSize: "Font size",
    opacity: "Opacity",
    angle: "Rotation angle",
    spacing: "Text spacing",
    outputFormat: "Output format",
    mode: "Mode",
    singleMode: "Single real-time preview",
    batchMode: "Batch pending conversion",
    noInputThumb: "No input images yet",
    noOutputThumb: "No output images yet",
    closePreview: "Close"
  }
};

const OUTPUT_FORMATS = {
  jpg: { mime: "image/jpeg", ext: "jpg", quality: 0.9 },
  png: { mime: "image/png", ext: "png", quality: 0.92 },
  webp: { mime: "image/webp", ext: "webp", quality: 0.9 }
};

function t(key, params = {}) {
  const lang = getLanguage();
  const template = copy[lang]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

async function renderWatermarkBlob(image, settings) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  ctx.drawImage(image, 0, 0);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((settings.angle * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = settings.opacity;
  ctx.font = `700 ${settings.fontSize}px Manrope, "Noto Sans TC", sans-serif`;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillStyle = settings.color;
  ctx.lineWidth = Math.max(1, settings.fontSize * 0.07);

  const metrics = ctx.measureText(settings.text);
  const textWidth = Math.max(metrics.width, settings.fontSize);
  const baseStepX = Math.max(textWidth * 1.7, settings.fontSize * 2.8);
  const baseStepY = Math.max(settings.fontSize * 2.1, 48);
  const stepX = baseStepX * settings.spacing;
  const stepY = baseStepY * settings.spacing;
  const range = Math.ceil(Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height));

  for (let y = -range; y <= range; y += stepY) {
    const rowOffset = Math.round(y / stepY) % 2 === 0 ? 0 : stepX / 2;
    for (let x = -range; x <= range; x += stepX) {
      const drawX = x + rowOffset;
      ctx.strokeText(settings.text, drawX, y);
      ctx.fillText(settings.text, drawX, y);
    }
  }
  ctx.restore();

  const outputConfig = OUTPUT_FORMATS[settings.format] || OUTPUT_FORMATS.jpg;
  return canvasToBlob(canvas, outputConfig.mime, outputConfig.quality);
}

export default function initImageTextWatermark() {
  const dropZone = document.querySelector("#watermark-drop-zone");
  const fileInput = document.querySelector("#watermark-file");
  const textInput = document.querySelector("#watermark-text");
  const colorInput = document.querySelector("#watermark-color");
  const fontSizeInput = document.querySelector("#watermark-font-size");
  const opacityInput = document.querySelector("#watermark-opacity");
  const angleInput = document.querySelector("#watermark-angle");
  const spacingInput = document.querySelector("#watermark-spacing");
  const formatInput = document.querySelector("#watermark-format");
  const fontSizeText = document.querySelector("#watermark-font-size-text");
  const opacityText = document.querySelector("#watermark-opacity-text");
  const angleText = document.querySelector("#watermark-angle-text");
  const spacingText = document.querySelector("#watermark-spacing-text");
  const batchBtn = document.querySelector("#watermark-batch-btn");
  const sampleBtn = document.querySelector("#watermark-sample-btn");
  const clearBtn = document.querySelector("#watermark-clear-btn");
  const downloadBtn = document.querySelector("#watermark-download-btn");
  const inputGallery = document.querySelector("#watermark-input-gallery");
  const outputGallery = document.querySelector("#watermark-output-gallery");
  const meta = document.querySelector("#watermark-meta");

  if (
    !dropZone ||
    !fileInput ||
    !textInput ||
    !colorInput ||
    !fontSizeInput ||
    !opacityInput ||
    !angleInput ||
    !spacingInput ||
    !formatInput ||
    !fontSizeText ||
    !opacityText ||
    !angleText ||
    !spacingText ||
    !batchBtn ||
    !downloadBtn ||
    !inputGallery ||
    !outputGallery ||
    !meta
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 圖片文字浮水印",
      en: "ToolNestTW Image Text Watermark"
    },
    text: {
      ".hero h1": { zh: "圖片文字浮水印", en: "Image Text Watermark" },
      ".hero .lead": {
        zh: "上傳圖片後加入文字浮水印，支援單張即時預覽與批量轉換。",
        en: "Add text watermark to images with single real-time preview and batch conversion."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#watermark-drop-zone strong": {
        zh: "拖曳圖片到這裡（支援單檔/批量）",
        en: "Drop image(s) here (single or batch)"
      },
      "#watermark-drop-zone .hint": {
        zh: "或手動選擇一張或多張圖片",
        en: "or choose one or multiple files"
      },
      'label[for="watermark-text"]': { zh: "浮水印文字", en: "Watermark text" },
      'label[for="watermark-color"]': { zh: "浮水印顏色", en: "Watermark color" },
      'label[for="watermark-font-size"]': { zh: "字體大小", en: "Font size" },
      'label[for="watermark-opacity"]': { zh: "透明度", en: "Opacity" },
      'label[for="watermark-angle"]': { zh: "文字旋轉角度", en: "Text rotation angle" },
      'label[for="watermark-spacing"]': { zh: "文字間距", en: "Text spacing" },
      'label[for="watermark-format"]': { zh: "輸出圖片格式", en: "Output format" },
      "#watermark-batch-btn": { zh: "一鍵批量轉換", en: "Batch Convert" },
      "#watermark-sample-btn": { zh: "載入範例圖片", en: "Load Sample Image" },
      "#watermark-clear-btn": { zh: "清除", en: "Clear" },
      "#watermark-download-btn": { zh: "下載圖片 / ZIP", en: "Download Image / ZIP" },
      "#watermark-input-gallery-title": { zh: "輸入縮圖", en: "Input thumbnails" },
      "#watermark-output-gallery-title": { zh: "輸出縮圖", en: "Output thumbnails" },
      "#watermark-gallery-hint": {
        zh: "單張時會隨參數變更即時更新，點擊縮圖可放大檢視。",
        en: "Single mode updates instantly on changes. Click a thumbnail to zoom."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 上傳圖片，單檔或批量皆可。",
        en: "1. Upload image(s), single or batch."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 設定浮水印文字、顏色、字體大小、透明度、旋轉角度與文字間距。",
        en: "2. Set text, color, font size, opacity, rotation, and text spacing."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 選擇輸出格式（JPG/PNG/WEBP）；單張會即時預覽，批量請點一鍵批量轉換，單張下載圖片、批量下載 ZIP。",
        en: "3. Choose output format (JPG/PNG/WEBP). Single mode updates instantly; use Batch Convert for multiple files."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會上傳圖片嗎？ 不會，全部在瀏覽器本地運算。",
        en: "Is image uploaded? No, all processing is local in browser."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "浮水印位置固定嗎？ 預設置中，可透過旋轉角度調整視覺效果。",
        en: "Is position fixed? It is centered by default; adjust visual angle with rotation."
      }
    },
    placeholder: {
      "#watermark-text": { zh: "輸入浮水印文字", en: "Enter watermark text" }
    }
  });

  let sourceItems = [];
  let outputItems = [];
  let previewToken = 0;
  let previewTimer = 0;
  const lightbox = createImageLightbox();

  const renderSliderText = () => {
    fontSizeText.textContent = `${fontSizeInput.value} px`;
    opacityText.textContent = `${opacityInput.value}%`;
    angleText.textContent = `${angleInput.value}°`;
    spacingText.textContent = `${spacingInput.value}%`;
  };

  const clearOutputState = () => {
    revokeOutputUrls(outputItems);
    outputItems = [];
    downloadBtn.disabled = true;
  };

  const renderGalleries = () => {
    renderThumbnailGrid({
      container: inputGallery,
      items: sourceItems,
      getSrc: (item) => item.dataURL,
      getName: (item) => item.file.name,
      emptyText: t("noInputThumb"),
      onOpen: (payload) => lightbox.open(payload)
    });

    renderThumbnailGrid({
      container: outputGallery,
      items: outputItems,
      getSrc: (item) => item.previewUrl,
      getName: (item) => item.name,
      emptyText: t("noOutputThumb"),
      onOpen: (payload) => lightbox.open(payload)
    });

    const singleMode = sourceItems.length === 1;
    inputGallery.classList.toggle("thumb-grid-single-large", singleMode);
    outputGallery.classList.toggle("thumb-grid-single-large", singleMode);

    lightbox.setCloseLabel(t("closePreview"));
  };

  const renderMeta = () => {
    if (!sourceItems.length) {
      meta.textContent = "";
      return;
    }

    const rows = [
      `${t("inputCount")}: ${sourceItems.length}`,
      `${t("inputSize")}: ${formatBytes(sumSize(sourceItems))}`,
      `${t("watermarkText")}: ${textInput.value.trim() || "-"}`,
      `${t("watermarkColor")}: ${String(colorInput.value || "").toUpperCase() || "-"}`,
      `${t("fontSize")}: ${fontSizeInput.value}px`,
      `${t("opacity")}: ${opacityInput.value}%`,
      `${t("angle")}: ${angleInput.value}°`,
      `${t("spacing")}: ${spacingInput.value}%`,
      `${t("outputFormat")}: ${(formatInput.value || "jpg").toUpperCase()}`,
      `${t("mode")}: ${sourceItems.length === 1 ? t("singleMode") : t("batchMode")}`
    ];

    if (sourceItems[0]?.image) {
      rows.splice(2, 0, `${t("sourceSize")}: ${sourceItems[0].image.width} x ${sourceItems[0].image.height}`);
    }

    if (outputItems.length) {
      rows.push(`${t("outputCount")}: ${outputItems.length}`);
      rows.push(`${t("outputSize")}: ${formatBytes(sumSize(outputItems))}`);
    }

    meta.replaceChildren(
      ...rows.map((text) => {
        const item = document.createElement("span");
        item.textContent = text;
        return item;
      })
    );
  };

  const getSettings = ({ toastOnError = false } = {}) => {
    const watermarkText = textInput.value.trim();
    if (!watermarkText) {
      if (toastOnError) {
        toast(t("emptyText"));
      }
      return null;
    }

    const fontSize = clamp(Number(fontSizeInput.value), 16, 200);
    const opacity = clamp(Number(opacityInput.value) / 100, 0.05, 1);
    const angle = clamp(Number(angleInput.value), -180, 180);
    const spacing = clamp(Number(spacingInput.value) / 100, 0.8, 3.6);
    const format = OUTPUT_FORMATS[formatInput.value] ? formatInput.value : "jpg";
    const color = String(colorInput.value || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/u.test(color)) {
      if (toastOnError) {
        toast(t("invalid"));
      }
      return null;
    }

    if (!Number.isFinite(fontSize) || !Number.isFinite(opacity) || !Number.isFinite(angle) || !Number.isFinite(spacing)) {
      if (toastOnError) {
        toast(t("invalid"));
      }
      return null;
    }

    return { text: watermarkText, fontSize, opacity, angle, spacing, format, color };
  };

  const buildOutputItem = async (source, settings) => {
    const blob = await renderWatermarkBlob(source.image, settings);
    const outputConfig = OUTPUT_FORMATS[settings.format] || OUTPUT_FORMATS.jpg;
    return {
      name: `${getFileStem(source.file.name)}-watermarked.${outputConfig.ext}`,
      blob,
      previewUrl: URL.createObjectURL(blob)
    };
  };

  const renderSinglePreview = async (showToast = false) => {
    if (sourceItems.length !== 1) {
      return;
    }
    const settings = getSettings({ toastOnError: showToast });
    if (!settings) {
      clearOutputState();
      renderGalleries();
      renderMeta();
      return;
    }

    const token = ++previewToken;
    try {
      const item = await buildOutputItem(sourceItems[0], settings);
      if (token !== previewToken) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        return;
      }

      clearOutputState();
      outputItems = [item];
      downloadBtn.disabled = false;
      renderGalleries();
      renderMeta();
      if (showToast) {
        toast(t("converted", { count: 1 }), "success");
      }
    } catch {
      if (showToast) {
        toast(t("invalid"));
      }
    }
  };

  const scheduleSinglePreview = () => {
    if (previewTimer) {
      window.clearTimeout(previewTimer);
    }
    previewTimer = window.setTimeout(() => {
      renderSinglePreview(false);
    }, 70);
  };

  const applySourceItems = (items) => {
    sourceItems = items;
    clearOutputState();
    renderGalleries();
    renderMeta();
    if (sourceItems.length === 1) {
      scheduleSinglePreview();
    }
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

  const handleReactiveInput = () => {
    renderSliderText();
    if (!sourceItems.length) {
      return;
    }
    if (sourceItems.length === 1) {
      scheduleSinglePreview();
      return;
    }
    clearOutputState();
    renderGalleries();
    renderMeta();
  };

  [textInput, colorInput, fontSizeInput, opacityInput, angleInput, spacingInput, formatInput].forEach((input) => {
    input.addEventListener("input", handleReactiveInput);
  });
  formatInput.addEventListener("change", handleReactiveInput);

  batchBtn.addEventListener("click", async () => {
    if (!sourceItems.length) {
      toast(t("noInput"));
      return;
    }

    const settings = getSettings({ toastOnError: true });
    if (!settings) {
      return;
    }

    if (sourceItems.length === 1) {
      await renderSinglePreview(true);
      return;
    }

    try {
      const outputs = [];
      for (const item of sourceItems) {
        outputs.push(await buildOutputItem(item, settings));
      }

      clearOutputState();
      outputItems = outputs;
      downloadBtn.disabled = false;
      renderGalleries();
      renderMeta();
      toast(t("converted", { count: outputs.length }), "success");
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
    previewToken += 1;
    if (previewTimer) {
      window.clearTimeout(previewTimer);
      previewTimer = 0;
    }
    clearOutputState();
    fileInput.value = "";
    textInput.value = "ToolNestTW";
    colorInput.value = "#ffffff";
    fontSizeInput.value = "64";
    opacityInput.value = "30";
    angleInput.value = "-30";
    spacingInput.value = "180";
    formatInput.value = "jpg";
    renderSliderText();
    renderGalleries();
    renderMeta();
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
      downloadBlob(zipBlob, "ToolNestTW-watermarked-images.zip");
    } catch {
      toast(t("invalid"));
    }
  });

  onLanguageChange(() => {
    renderSliderText();
    renderGalleries();
    renderMeta();
  });

  window.addEventListener("pagehide", () => {
    if (previewTimer) {
      window.clearTimeout(previewTimer);
    }
    revokeOutputUrls(outputItems);
    lightbox.destroy();
  });

  renderSliderText();
  renderGalleries();
}
