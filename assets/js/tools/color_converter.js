import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/dev/color_converter";
const SAMPLE_COLOR = "#1a73e8";

function componentToHex(value) {
  return value.toString(16).padStart(2, "0");
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) {
    h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function parseColor(value) {
  if (!value || !window.CSS?.supports?.("color", value)) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const [r, g, b] = data;
  const hex = `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
  const hsl = rgbToHsl(r, g, b);

  return {
    hex,
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  };
}

export default function initColorConverter() {
  const input = document.querySelector("#color-input");
  const picker = document.querySelector("#color-picker");
  const output = document.querySelector("#color-output");
  const preview = document.querySelector("#color-preview-block");
  const sampleBtn = document.querySelector("#color-sample-btn");
  const clearBtn = document.querySelector("#color-clear-btn");
  const copyBtn = document.querySelector("#color-copy-btn");

  if (!input || !picker || !output || !preview) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 色彩轉換器",
      en: "ToolNestTW Color Converter"
    },
    text: {
      ".hero h1": { zh: "色彩轉換器", en: "Color Converter" },
      ".hero .lead": {
        zh: "在 HEX、RGB、HSL 之間快速轉換色彩格式。",
        en: "Convert color values between HEX, RGB, and HSL."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="color-input"]': { zh: "顏色值", en: "Color value" },
      'label[for="color-picker"]': { zh: "顏色挑選器", en: "Color picker" },
      'label[for="color-output"]': { zh: "轉換結果", en: "Converted value" },
      "#color-preview-title": { zh: "預覽色塊", en: "Preview" },
      "#color-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#color-clear-btn": { zh: "清除", en: "Clear" },
      "#color-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入顏色值或使用顏色挑選器。",
        en: "1. Enter color value or use color picker."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 輸入有變化時會即時轉換。",
        en: "2. Conversion updates automatically when input changes."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 取得 HEX、RGB、HSL 並複製。",
        en: "3. Get HEX, RGB, HSL and copy output."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "支援哪些格式？ 支援瀏覽器可辨識的常見色彩格式。",
        en: "Supported formats? Most browser-recognized color formats."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會離開瀏覽器嗎？ 不會，全部在本機處理。",
        en: "Does data leave browser? No, all conversion runs locally."
      }
    },
    placeholder: {
      "#color-input": {
        zh: "例如：#1a73e8 或 rgb(26,115,232)",
        en: "Example: #1a73e8 or rgb(26,115,232)"
      },
      "#color-output": { zh: "轉換結果會顯示在這裡", en: "Converted values appear here" }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const clearResult = () => {
    output.value = "";
    preview.style.background = SAMPLE_COLOR;
  };

  const render = (value) => {
    const parsed = parseColor(value);
    if (!parsed) {
      clearResult();
      return false;
    }
    picker.value = parsed.hex;
    preview.style.background = parsed.hex;
    output.value = [`HEX: ${parsed.hex}`, `RGB: ${parsed.rgb}`, `HSL: ${parsed.hsl}`].join("\n");
    return true;
  };

  const runFromInput = () => {
    const raw = input.value;
    saveRecentInput(TOOL_PATH, raw);
    const trimmed = raw.trim();
    if (!trimmed) {
      clearResult();
      return;
    }
    render(trimmed);
  };

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_COLOR;
    render(SAMPLE_COLOR);
    saveRecentInput(TOOL_PATH, input.value);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    picker.value = SAMPLE_COLOR;
    preview.style.background = SAMPLE_COLOR;
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", runFromInput);
  picker.addEventListener("input", () => {
    input.value = picker.value;
    render(picker.value);
    saveRecentInput(TOOL_PATH, input.value);
  });

  if (!render(input.value.trim())) {
    picker.value = SAMPLE_COLOR;
    preview.style.background = SAMPLE_COLOR;
  }
}




