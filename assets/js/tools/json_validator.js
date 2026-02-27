import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/data/json_validator";
const SAMPLE_JSON = `{
  "name": "ToolNestTW",
  "enabled": true,
  "tags": ["json", "validator", "tool"]
}`;

const copy = {
  zh: {
    invalidInput: "輸入格式錯誤",
    validToast: "JSON 驗證通過。",
    validTitle: "JSON 格式正確",
    invalidTitle: "JSON 格式錯誤",
    invalidHint: "請檢查 JSON 語法（逗號、引號、括號是否正確）。",
    invalidAt: "錯誤位置：第 {line} 行，第 {column} 列（位置 {position}）",
    invalidAtNoPos: "錯誤位置：第 {line} 行，第 {column} 列"
  },
  en: {
    invalidInput: "Invalid input format",
    validToast: "JSON is valid.",
    validTitle: "Valid JSON",
    invalidTitle: "Invalid JSON",
    invalidHint: "Please check JSON syntax.",
    invalidAt: "Error location: line {line}, column {column} (position {position})",
    invalidAtNoPos: "Error location: line {line}, column {column}"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const template = copy[lang()]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function getErrorLocation(text, errorMessage) {
  const source = String(text || "");
  const message = String(errorMessage || "");

  const positionMatch = message.match(/\bposition\s+(\d+)\b/i);
  const explicitLineColumnMatch = message.match(/\bline\s+(\d+)\s+column\s+(\d+)\b/i);

  const parsedPosition = positionMatch ? Number(positionMatch[1]) : null;
  const position = Number.isFinite(parsedPosition) ? parsedPosition : null;

  if (explicitLineColumnMatch) {
    const line = Number(explicitLineColumnMatch[1]);
    const column = Number(explicitLineColumnMatch[2]);
    return {
      line: Number.isFinite(line) ? line : null,
      column: Number.isFinite(column) ? column : null,
      position
    };
  }

  if (!Number.isFinite(position) || position < 0) {
    return null;
  }

  const safePosition = Math.min(position, source.length);
  const before = source.slice(0, safePosition);
  const lines = before.split(/\r?\n/u);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
    position
  };
}

function getLocationText(location) {
  if (!location || !location.line || !location.column) {
    return "";
  }
  if (Number.isFinite(location.position)) {
    return t("invalidAt", location);
  }
  return t("invalidAtNoPos", location);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function initJsonValidator() {
  const input = document.querySelector("#jsonv-input");
  const output = document.querySelector("#jsonv-output");
  const errorWrap = document.querySelector("#jsonv-error-wrap");
  const errorPreview = document.querySelector("#jsonv-error-preview");
  const validateBtn = document.querySelector("#jsonv-validate-btn");
  const sampleBtn = document.querySelector("#jsonv-sample-btn");
  const clearBtn = document.querySelector("#jsonv-clear-btn");
  const copyBtn = document.querySelector("#jsonv-copy-btn");

  if (!input || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW JSON 驗證器",
      en: "ToolNestTW JSON Validator"
    },
    text: {
      ".hero h1": { zh: "JSON 驗證器", en: "JSON Validator" },
      ".hero .lead": {
        zh: "檢查 JSON 是否合法，並顯示格式化結果或錯誤資訊。",
        en: "Validate JSON syntax and show formatted output or parse errors."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="jsonv-input"]': { zh: "JSON 內容", en: "JSON input" },
      'label[for="jsonv-output"]': { zh: "驗證結果", en: "Validation result" },
      "#jsonv-error-line-title": { zh: "錯誤行預覽", en: "Error line preview" },
      "#jsonv-validate-btn": { zh: "驗證 JSON", en: "Validate JSON" },
      "#jsonv-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#jsonv-clear-btn": { zh: "清除", en: "Clear" },
      "#jsonv-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": { zh: "1. 貼上 JSON 內容。", en: "1. Paste JSON input." },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": { zh: "2. 點擊驗證 JSON。", en: "2. Click Validate JSON." },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看成功或錯誤訊息並複製結果。",
        en: "3. Review success/error message and copy result."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會自動修正 JSON 嗎？ 不會，只做驗證與格式化。",
        en: "Will JSON be auto-fixed? No, only validation and formatting."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "是否上傳內容？ 不會，全部在本機處理。",
        en: "Is input uploaded? No, everything is local."
      }
    },
    placeholder: {
      "#jsonv-input": {
        zh: '例如：{"name":"ToolNestTW","ok":true}',
        en: 'Example: {"name":"ToolNestTW","ok":true}'
      },
      "#jsonv-output": { zh: "驗證結果會顯示在這裡", en: "Validation result appears here" }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  let lastResult = null;

  const clearErrorPreview = () => {
    if (errorWrap) {
      errorWrap.hidden = true;
    }
    if (errorPreview) {
      errorPreview.innerHTML = "";
    }
  };

  const renderErrorPreview = (text, location) => {
    if (!errorWrap || !errorPreview || !location?.line) {
      clearErrorPreview();
      return;
    }

    const rawLines = String(text || "").replace(/\r/g, "").split("\n");
    const lines = rawLines.length ? rawLines : [""];
    const targetLine = Math.max(1, Math.min(Number(location.line) || 1, lines.length));

    errorPreview.innerHTML = lines
      .map((lineText, index) => {
        const lineNumber = index + 1;
        const isErrorLine = lineNumber === targetLine;
        const safeText = lineText.length ? escapeHtml(lineText) : "&nbsp;";
        return [
          `<div class="json-error-row${isErrorLine ? " is-error" : ""}" data-line="${lineNumber}">`,
          `<span class="json-error-ln">${lineNumber}</span>`,
          `<code class="json-error-code">${safeText}</code>`,
          "</div>"
        ].join("");
      })
      .join("");

    errorWrap.hidden = false;
    const activeLine = errorPreview.querySelector(`.json-error-row[data-line="${targetLine}"]`);
    activeLine?.scrollIntoView({ block: "center" });
  };

  const renderFromState = () => {
    if (!lastResult) {
      clearErrorPreview();
      return;
    }
    if (lastResult.type === "valid") {
      output.value = [t("validTitle"), "", JSON.stringify(lastResult.parsed, null, 2)].join("\n");
      clearErrorPreview();
      return;
    }
    const locationText = getLocationText(lastResult.location);
    if (lang() === "zh") {
      output.value = [t("invalidTitle"), "", t("invalidHint"), locationText].filter(Boolean).join("\n");
      renderErrorPreview(lastResult.inputSnapshot, lastResult.location);
      return;
    }
    const detail = lastResult.errorMessage || t("invalidHint");
    output.value = [t("invalidTitle"), "", locationText || detail, locationText ? detail : ""].filter(Boolean).join("\n");
    renderErrorPreview(lastResult.inputSnapshot, lastResult.location);
  };

  validateBtn?.addEventListener("click", () => {
    if (!input.value.trim()) {
      toast(t("invalidInput"));
      return;
    }

    try {
      const parsed = JSON.parse(input.value);
      lastResult = { type: "valid", parsed, inputSnapshot: input.value };
      renderFromState();
      toast(t("validToast"), "success");
      saveRecentInput(TOOL_PATH, input.value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      lastResult = {
        type: "invalid",
        errorMessage,
        location: getErrorLocation(input.value, errorMessage),
        inputSnapshot: input.value
      };
      renderFromState();
      toast(t("invalidInput"));
    }
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_JSON;
    output.value = "";
    lastResult = null;
    clearErrorPreview();
    saveRecentInput(TOOL_PATH, input.value);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    lastResult = null;
    clearErrorPreview();
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", () => saveRecentInput(TOOL_PATH, input.value));
  onLanguageChange(renderFromState);
}




