import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/word_counter";
const SAMPLE_TEXT = "ToolNestTW tools are fast and simple.\n這是一段中文測試內容。";

const copy = {
  zh: {
    words: "單詞數",
    characters: "字元數",
    charactersNoSpace: "字元數（不含空白）",
    lines: "行數",
    bytes: "位元組（UTF-8）",
    sentences: "句數"
  },
  en: {
    words: "Words",
    characters: "Characters",
    charactersNoSpace: "Characters (no spaces)",
    lines: "Lines",
    bytes: "Bytes (UTF-8)",
    sentences: "Sentences"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function countText(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  const characters = text.length;
  const charactersNoSpace = text.replace(/\s/gu, "").length;
  const lines = text ? text.split(/\r?\n/u).length : 0;
  const bytes = new TextEncoder().encode(text).length;
  const sentences = text
    .split(/[.!?。！？]+/u)
    .map((item) => item.trim())
    .filter(Boolean).length;
  return { words, characters, charactersNoSpace, lines, bytes, sentences };
}

function formatOutput(stats) {
  const label = copy[lang()] || copy.en;
  return [
    `${label.words}: ${stats.words}`,
    `${label.characters}: ${stats.characters}`,
    `${label.charactersNoSpace}: ${stats.charactersNoSpace}`,
    `${label.lines}: ${stats.lines}`,
    `${label.bytes}: ${stats.bytes}`,
    `${label.sentences}: ${stats.sentences}`
  ].join("\n");
}

export default function initWordCounter() {
  const input = document.querySelector("#wc-input");
  const output = document.querySelector("#wc-output");
  const sampleBtn = document.querySelector("#wc-sample-btn");
  const clearBtn = document.querySelector("#wc-clear-btn");
  const copyBtn = document.querySelector("#wc-copy-btn");

  if (!input || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 字數統計",
      en: "ToolNestTW Word Counter"
    },
    text: {
      ".hero h1": { zh: "字數統計", en: "Word Counter" },
      ".hero .lead": {
        zh: "快速統計文字的字數、字元數、行數與位元組。",
        en: "Count words, characters, lines, and bytes instantly."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="wc-input"]': { zh: "待統計文字", en: "Input text" },
      'label[for="wc-output"]': { zh: "統計結果", en: "Count result" },
      "#wc-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#wc-clear-btn": { zh: "清除", en: "Clear" },
      "#wc-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上要統計的文字內容。",
        en: "1. Paste input text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 文字變更後會即時更新統計。",
        en: "2. Statistics refresh automatically as text changes."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看統計數據並複製結果。",
        en: "3. Check stats and copy result."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "中英文都支援嗎？ 支援，會依空白與字元規則計算。",
        en: "Supports English and Chinese? Yes, based on whitespace and characters."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會上傳嗎？ 不會，全部在本機完成。",
        en: "Is text uploaded? No, everything runs locally."
      }
    },
    placeholder: {
      "#wc-input": { zh: "貼上文章、描述或程式碼", en: "Paste article, description, or code" },
      "#wc-output": { zh: "統計結果會顯示在這裡", en: "Count result appears here" }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const render = () => {
    const text = input.value;
    if (!text) {
      output.value = "";
      return;
    }
    output.value = formatOutput(countText(text));
  };

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_TEXT;
    render();
    saveRecentInput(TOOL_PATH, input.value);
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", () => {
    saveRecentInput(TOOL_PATH, input.value);
    render();
  });

  onLanguageChange(render);
  render();
}




