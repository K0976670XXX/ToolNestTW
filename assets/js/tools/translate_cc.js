import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/translate_cc";
const SAMPLE_SIMPLIFIED = "软件工程需要可维护的架构设计。";
const SAMPLE_TRADITIONAL = "軟體工程需要可維護的架構設計。";
const converterCache = new Map();

async function getConverter(direction) {
  const converterFactory = window.OpenCC?.Converter;
  if (typeof converterFactory !== "function") {
    throw new Error("OpenCC missing");
  }

  const key = direction;
  if (!converterCache.has(key)) {
    if (direction === "t2s") {
      converterCache.set(key, await converterFactory({ from: "tw", to: "cn" }));
    } else {
      converterCache.set(key, await converterFactory({ from: "cn", to: "tw" }));
    }
  }

  return converterCache.get(key);
}

export default function initTranslateCc() {
  const input = document.querySelector("#cc-input");
  const output = document.querySelector("#cc-output");
  const direction = document.querySelector("#cc-direction");
  const convertBtn = document.querySelector("#cc-convert-btn");
  const sampleBtn = document.querySelector("#cc-sample-btn");
  const clearBtn = document.querySelector("#cc-clear-btn");
  const copyBtn = document.querySelector("#cc-copy-btn");

  if (!input || !output || !direction) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 繁簡轉換器",
      en: "ToolNestTW Traditional/Simplified Converter"
    },
    text: {
      ".hero h1": { zh: "繁簡轉換器", en: "Traditional/Simplified Converter" },
      ".hero .lead": {
        zh: "使用 OpenCC 在本機瀏覽器進行繁體與簡體文字轉換。",
        en: "Convert Traditional and Simplified Chinese locally with OpenCC."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="cc-input"]': { zh: "輸入文字", en: "Input text" },
      'label[for="cc-output"]': { zh: "轉換結果", en: "Converted output" },
      'label[for="cc-direction"]': { zh: "轉換方向", en: "Direction" },
      "#cc-convert-btn": { zh: "開始轉換", en: "Convert" },
      "#cc-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#cc-clear-btn": { zh: "清除", en: "Clear" },
      "#cc-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      "#cc-direction option[value='s2t']": { zh: "簡體 → 繁體", en: "Simplified -> Traditional" },
      "#cc-direction option[value='t2s']": { zh: "繁體 → 簡體", en: "Traditional -> Simplified" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上要轉換的中文文字。",
        en: "1. Paste Chinese text to convert."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 選擇轉換方向並點擊開始轉換。",
        en: "2. Choose direction and click Convert."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 複製結果使用。",
        en: "3. Copy the converted result."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "資料會上傳嗎？ 不會，所有轉換都在瀏覽器本機完成。",
        en: "Is my text uploaded? No, conversion runs locally in browser."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "轉換引擎是什麼？ 使用 OpenCC 字詞轉換引擎。",
        en: "Which engine is used? This tool uses OpenCC."
      }
    },
    placeholder: {
      "#cc-input": {
        zh: "請輸入要轉換的中文內容",
        en: "Paste Chinese text to convert"
      },
      "#cc-output": {
        zh: "結果會顯示在這裡",
        en: "The converted result will appear here"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const convert = async () => {
    const source = input.value;
    if (!source.trim()) {
      output.value = "";
      return;
    }

    try {
      const converter = await getConverter(direction.value);
      output.value = converter(source);
      toast("Converted.", "success");
    } catch {
      toast("Invalid input format");
    }
  };

  convertBtn?.addEventListener("click", convert);

  sampleBtn?.addEventListener("click", () => {
    input.value = direction.value === "s2t" ? SAMPLE_SIMPLIFIED : SAMPLE_TRADITIONAL;
    output.value = "";
    saveRecentInput(TOOL_PATH, input.value);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", () => saveRecentInput(TOOL_PATH, input.value));
  direction.addEventListener("change", convert);
}







