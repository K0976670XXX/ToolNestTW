import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/json_formatter";
const SAMPLE_JSON = `{
  "project": "ToolNestTW",
  "phase": 1,
  "tools": [
    "json_formatter",
    "url_encode_decode",
    "base64_encode_decode"
  ],
  "active": true
}`;

function tryParseJSON(source) {
  try {
    return JSON.parse(source);
  } catch {
    toast("Invalid input format");
    return null;
  }
}

export default function initJsonFormatter() {
  const input = document.querySelector("#json-input");
  const output = document.querySelector("#json-output");
  const formatBtn = document.querySelector("#format-btn");
  const minifyBtn = document.querySelector("#minify-btn");
  const sampleBtn = document.querySelector("#sample-btn");
  const clearBtn = document.querySelector("#clear-btn");
  const copyBtn = document.querySelector("#copy-btn");

  if (!input || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW JSON 格式化",
      en: "ToolNestTW JSON Formatter"
    },
    text: {
      ".hero h1": { zh: "JSON 格式化", en: "JSON Formatter" },
      ".hero .lead": {
        zh: "貼上 JSON 後可快速格式化並複製結果。",
        en: "Paste JSON, format it, and copy the result quickly."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="json-input"]': { zh: "JSON 字串", en: "JSON string" },
      'label[for="json-output"]': { zh: "格式化結果", en: "Formatted JSON" },
      "#format-btn": { zh: "格式化 JSON", en: "Format JSON" },
      "#minify-btn": { zh: "壓縮 JSON", en: "Minify JSON" },
      "#sample-btn": { zh: "載入範例", en: "Load Example" },
      "#clear-btn": { zh: "清除", en: "Clear" },
      "#copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 在輸入區貼上 JSON。",
        en: "1. Paste JSON in the input area."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 選擇格式化 JSON 或壓縮 JSON。",
        en: "2. Choose format or minify."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 確認結果後按複製。",
        en: "3. Copy the output."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "為什麼格式化失敗？ 輸入內容不是有效的 JSON。",
        en: "Why does formatting fail? The input is not valid JSON."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會上傳嗎？ 不會，所有處理都在瀏覽器本機完成。",
        en: "Is my data uploaded? No, everything runs locally in browser."
      }
    },
    placeholder: {
      "#json-input": {
        zh: '例如：{"name":"ToolNestTW","features":["json","format"]}',
        en: 'Example: {"name":"ToolNestTW","features":["json","format"]}'
      },
      "#json-output": {
        zh: "結果會顯示在這裡",
        en: "Your result appears here"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const saveInput = () => saveRecentInput(TOOL_PATH, input.value);

  formatBtn?.addEventListener("click", () => {
    const parsed = tryParseJSON(input.value.trim());
    if (!parsed) {
      return;
    }
    output.value = JSON.stringify(parsed, null, 2);
    toast("JSON formatted.", "success");
  });

  minifyBtn?.addEventListener("click", () => {
    const parsed = tryParseJSON(input.value.trim());
    if (!parsed) {
      return;
    }
    output.value = JSON.stringify(parsed);
    toast("JSON minified.", "success");
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_JSON;
    output.value = "";
    saveInput();
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", saveInput);
}










