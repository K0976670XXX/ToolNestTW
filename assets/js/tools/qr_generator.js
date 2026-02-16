import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/data/qr_generator";
const SAMPLE_INPUT = "https://example.com/ToolNestTW";

function drawQrToCanvas(canvas, text, size, level) {
  const generator = window.qrcode;
  if (typeof generator !== "function") {
    throw new Error("QR library missing");
  }

  const qr = generator(0, level);
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const cellSize = Math.max(1, Math.floor(size / moduleCount));
  const qrSize = cellSize * moduleCount;
  const offset = Math.floor((size - qrSize) / 2);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  }
}

function buildQuickChartUrl(value, size) {
  const text = String(value || "").trim();
  const parsedSize = Number.parseInt(String(size || ""), 10);
  const normalizedSize =
    Number.isInteger(parsedSize) && parsedSize >= 128 && parsedSize <= 1024
      ? parsedSize
      : 256;
  return `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${normalizedSize}`;
}

export default function initQrGenerator() {
  const input = document.querySelector("#qr-input");
  const sizeInput = document.querySelector("#qr-size");
  const levelInput = document.querySelector("#qr-level");
  const canvas = document.querySelector("#qr-canvas");
  const generateBtn = document.querySelector("#qr-generate-btn");
  const sampleBtn = document.querySelector("#qr-sample-btn");
  const clearBtn = document.querySelector("#qr-clear-btn");
  const copyBtn = document.querySelector("#qr-copy-btn");
  const downloadBtn = document.querySelector("#qr-download-btn");

  if (!input || !sizeInput || !levelInput || !canvas || !copyBtn || !downloadBtn) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW QR Code 產生器",
      en: "ToolNestTW QR Code Generator"
    },
    text: {
      ".hero h1": { zh: "QR Code 產生器", en: "QR Code Generator" },
      ".hero .lead": {
        zh: "將文字、連結或代碼轉成可下載的 QR 圖片。",
        en: "Turn text, links, or IDs into a downloadable QR image."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="qr-input"]': { zh: "文字或網址", en: "Text or URL" },
      'label[for="qr-size"]': { zh: "圖片尺寸 (px)", en: "Image size (px)" },
      'label[for="qr-level"]': { zh: "容錯等級", en: "Error correction" },
      "#qr-generate-btn": { zh: "產生 QR", en: "Generate QR" },
      "#qr-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#qr-clear-btn": { zh: "清除", en: "Clear" },
      "#qr-copy-btn": { zh: "複製資料網址", en: "Copy Data URL" },
      "#qr-download-btn": { zh: "下載 PNG", en: "Download PNG" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入文字或 URL。",
        en: "1. Enter text or URL."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 選擇尺寸與容錯等級。",
        en: "2. Choose size and error correction level."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 產生並下載 QR 圖片。",
        en: "3. Generate and download the QR image."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "可以產生長文字嗎？ 可以，但受 QR 容量限制。",
        en: "Can I generate long text? Yes, within QR capacity limits."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "離線可用嗎？ 可以，QR 產生在瀏覽器本機執行。",
        en: "Does this work offline? Yes, rendering is local in browser."
      }
    },
    placeholder: {
      "#qr-input": {
        zh: "例如：https://example.com/ToolNestTW-tool",
        en: "Example: https://example.com/ToolNestTW-tool"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  input.addEventListener("input", () => saveRecentInput(TOOL_PATH, input.value));

  const clearCanvas = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  clearCanvas();
  bindCopyButton(copyBtn, () => buildQuickChartUrl(input.value, sizeInput.value));

  generateBtn?.addEventListener("click", () => {
    const text = input.value.trim();
    const size = Number(sizeInput.value);
    if (!text || !Number.isInteger(size) || size < 128 || size > 1024) {
      toast("Invalid input format");
      return;
    }

    try {
      drawQrToCanvas(canvas, text, size, levelInput.value);
      downloadBtn.disabled = false;
      toast("QR generated.", "success");
    } catch {
      toast("Invalid input format");
    }
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_INPUT;
    saveRecentInput(TOOL_PATH, SAMPLE_INPUT);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearRecentInput(TOOL_PATH);
    clearCanvas();
    downloadBtn.disabled = true;
  });

  downloadBtn.addEventListener("click", () => {
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("Invalid input format");
        return;
      }
      downloadBlob(blob, "ToolNestTW-qr.png");
    }, "image/png");
  });
}










