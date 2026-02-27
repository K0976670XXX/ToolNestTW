import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/url_encode_decode";
const SAMPLE_INPUT = "https://example.com/search?q=hello world&source=ToolNestTW";

export default function initUrlEncodeDecode() {
  const input = document.querySelector("#url-input");
  const output = document.querySelector("#url-output");
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
      zh: "ToolNestTW URL 編碼解碼",
      en: "ToolNestTW URL Encoder / Decoder"
    },
    text: {
      ".hero h1": { zh: "URL 編碼解碼", en: "URL Encoder / Decoder" },
      ".hero .lead": {
        zh: "在原文與百分比編碼格式間快速轉換 URL。",
        en: "Convert text safely between plain and percent-encoded URL formats."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="url-input"]': { zh: "URL 或查詢字串", en: "URL or query text" },
      'label[for="url-output"]': { zh: "轉換結果", en: "Converted text" },
      "#encode-btn": { zh: "編碼", en: "Encode" },
      "#decode-btn": { zh: "解碼", en: "Decode" },
      "#sample-btn": { zh: "載入範例", en: "Load Example" },
      "#clear-btn": { zh: "清除", en: "Clear" },
      "#copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上要轉換的 URL 或文字。",
        en: "1. Paste your source URL or text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 依需求選擇編碼或解碼。",
        en: "2. Choose encode or decode."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 複製結果用於程式或 API。",
        en: "3. Copy output for app or API."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "解碼失敗？ 可能不是有效的百分比編碼格式。",
        en: "Decode fails? Input is not valid percent-encoded text."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "手機可以用嗎？ 可以，運算都在本機瀏覽器進行。",
        en: "Can I use this on mobile? Yes, all processing runs locally."
      }
    },
    placeholder: {
      "#url-input": {
        zh: "例如：https://example.com/search?q=hello world",
        en: "Example: https://example.com/search?q=hello world"
      },
      "#url-output": {
        zh: "結果會顯示在這裡",
        en: "Your result appears here"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const store = () => saveRecentInput(TOOL_PATH, input.value);

  encodeBtn?.addEventListener("click", () => {
    output.value = encodeURIComponent(input.value);
    toast("Encoded.", "success");
  });

  decodeBtn?.addEventListener("click", () => {
    try {
      output.value = decodeURIComponent(input.value);
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










