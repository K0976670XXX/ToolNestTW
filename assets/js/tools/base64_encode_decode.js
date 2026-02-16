import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/base64_encode_decode";
const SAMPLE_INPUT = "Hello World!";

function encodeUtf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((item) => {
    binary += String.fromCharCode(item);
  });
  return btoa(binary);
}

function decodeBase64ToUtf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function initBase64Tool() {
  const input = document.querySelector("#base64-input");
  const output = document.querySelector("#base64-output");
  const encodeBtn = document.querySelector("#encode-btn");
  const decodeBtn = document.querySelector("#decode-btn");
  const sampleBtn = document.querySelector("#sample-btn");
  const clearBtn = document.querySelector("#clear-btn");
  const copyBtn = document.querySelector("#copy-btn");

  if (!input || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW Base64 編碼解碼",
      en: "ToolNestTW Base64 Encoder / Decoder"
    },
    text: {
      ".hero h1": { zh: "Base64 編碼解碼", en: "Base64 Encoder / Decoder" },
      ".hero .lead": {
        zh: "將 UTF-8 文字轉為 Base64，或將 Base64 還原成文字。",
        en: "Encode UTF-8 text into Base64 or decode Base64 back to text."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="base64-input"]': { zh: "文字或 Base64", en: "Text or Base64 content" },
      'label[for="base64-output"]': { zh: "轉換結果", en: "Converted text" },
      "#encode-btn": { zh: "編碼", en: "Encode" },
      "#decode-btn": { zh: "解碼", en: "Decode" },
      "#sample-btn": { zh: "載入範例", en: "Load Example" },
      "#clear-btn": { zh: "清除", en: "Clear" },
      "#copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入一般文字或 Base64 內容。",
        en: "1. Enter plain text or Base64 content."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 選擇編碼或解碼。",
        en: "2. Choose encode or decode."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 複製結果並貼到目標位置。",
        en: "3. Copy and use the result."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "支援 UTF-8 嗎？ 支援，Unicode 文字可正常處理。",
        en: "Does UTF-8 work? Yes, Unicode text is supported."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "解碼失敗？ 可能不是有效的 Base64。",
        en: "Decode fails? Input is not valid Base64."
      }
    },
    placeholder: {
      "#base64-input": {
        zh: "例如：Hello World",
        en: "Example: Hello World"
      },
      "#base64-output": {
        zh: "結果會顯示在這裡",
        en: "Your result appears here"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);
  const store = () => saveRecentInput(TOOL_PATH, input.value);

  encodeBtn?.addEventListener("click", () => {
    try {
      output.value = encodeUtf8ToBase64(input.value);
      toast("Encoded.", "success");
    } catch {
      toast("Invalid input format");
    }
  });

  decodeBtn?.addEventListener("click", () => {
    try {
      const source = input.value.replace(/\s+/g, "");
      output.value = decodeBase64ToUtf8(source);
      toast("Decoded.", "success");
    } catch {
      toast("Invalid input format");
    }
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_INPUT;
    output.value = "";
    store();
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", store);
}










