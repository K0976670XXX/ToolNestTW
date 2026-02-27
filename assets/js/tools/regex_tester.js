import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/dev/regex_tester";
const SAMPLE_PATTERN = "\\b(hello)\\b";
const SAMPLE_TEXT = "hello world\nsay hello to regex tester";

function buildFlags(options) {
  return [
    options.g && "g",
    options.i && "i",
    options.m && "m",
    options.s && "s",
    options.u && "u",
    options.y && "y"
  ]
    .filter(Boolean)
    .join("");
}

function stringifyMatch(match, index) {
  const groups = match.groups ? JSON.stringify(match.groups) : "{}";
  return `#${index + 1} [${match.index}] ${match[0]}\nGroups: ${groups}`;
}

export default function initRegexTester() {
  const patternInput = document.querySelector("#regex-pattern");
  const textInput = document.querySelector("#regex-input");
  const output = document.querySelector("#regex-output");
  const testBtn = document.querySelector("#regex-test-btn");
  const sampleBtn = document.querySelector("#regex-sample-btn");
  const clearBtn = document.querySelector("#regex-clear-btn");
  const copyBtn = document.querySelector("#regex-copy-btn");
  const flagG = document.querySelector("#flag-g");
  const flagI = document.querySelector("#flag-i");
  const flagM = document.querySelector("#flag-m");
  const flagS = document.querySelector("#flag-s");
  const flagU = document.querySelector("#flag-u");
  const flagY = document.querySelector("#flag-y");

  if (!patternInput || !textInput || !output || !flagG || !flagI || !flagM || !flagS || !flagU || !flagY) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW Regex 測試器",
      en: "ToolNestTW Regex Tester"
    },
    text: {
      ".hero h1": { zh: "Regex 測試器", en: "Regex Tester" },
      ".hero .lead": {
        zh: "測試正則表達式並查看每筆匹配位置與群組。",
        en: "Test regular expressions and inspect match positions and groups."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="regex-pattern"]': { zh: "正則表達式", en: "Regex pattern" },
      '.tool-page > .panel:nth-of-type(1) .field:nth-of-type(2) > label': { zh: "旗標", en: "Flags" },
      'label[for="regex-input"]': { zh: "測試文字", en: "Test text" },
      'label[for="regex-output"]': { zh: "匹配結果", en: "Match result" },
      "#regex-test-btn": { zh: "開始測試", en: "Run Test" },
      "#regex-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#regex-clear-btn": { zh: "清除", en: "Clear" },
      "#regex-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入 Regex 與測試文字。",
        en: "1. Enter regex pattern and test text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 選擇需要的旗標後按開始測試。",
        en: "2. Select flags, then run test."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看匹配位置與群組後複製結果。",
        en: "3. Inspect matches and copy output."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "測試失敗？ Regex 可能語法錯誤或旗標衝突。",
        en: "Failed to test? Pattern syntax or flag settings may be invalid."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "會上傳資料嗎？ 不會，全部在瀏覽器本機執行。",
        en: "Is data uploaded? No, everything runs locally in browser."
      }
    },
    placeholder: {
      "#regex-pattern": { zh: "例如：\\b(hello)\\b", en: "Example: \\b(hello)\\b" },
      "#regex-input": { zh: "貼上要匹配的文字內容", en: "Paste text to test against regex" },
      "#regex-output": { zh: "測試結果會顯示在這裡", en: "Match result appears here" }
    }
  });

  patternInput.value = loadRecentInput(`${TOOL_PATH}:pattern`);
  textInput.value = loadRecentInput(`${TOOL_PATH}:text`);
  bindCopyButton(copyBtn, () => output.value);

  const store = () => {
    saveRecentInput(`${TOOL_PATH}:pattern`, patternInput.value);
    saveRecentInput(`${TOOL_PATH}:text`, textInput.value);
  };

  const run = () => {
    const pattern = patternInput.value;
    const text = textInput.value;
    if (!pattern || !text) {
      toast("Invalid input format");
      return;
    }

    const flags = buildFlags({
      g: flagG.checked,
      i: flagI.checked,
      m: flagM.checked,
      s: flagS.checked,
      u: flagU.checked,
      y: flagY.checked
    });

    try {
      const regex = new RegExp(pattern, flags);
      const lines = [];

      if (flags.includes("g")) {
        const matches = Array.from(text.matchAll(regex));
        if (!matches.length) {
          lines.push("No match");
        } else {
          matches.forEach((match, index) => {
            lines.push(stringifyMatch(match, index));
          });
        }
      } else {
        const match = regex.exec(text);
        if (!match) {
          lines.push("No match");
        } else {
          lines.push(stringifyMatch(match, 0));
        }
      }

      output.value = lines.join("\n\n");
      toast("Regex tested.", "success");
      store();
    } catch {
      toast("Invalid input format");
    }
  };

  testBtn?.addEventListener("click", run);
  sampleBtn?.addEventListener("click", () => {
    patternInput.value = SAMPLE_PATTERN;
    textInput.value = SAMPLE_TEXT;
    output.value = "";
    store();
  });
  clearBtn?.addEventListener("click", () => {
    patternInput.value = "";
    textInput.value = "";
    output.value = "";
    clearRecentInput(`${TOOL_PATH}:pattern`);
    clearRecentInput(`${TOOL_PATH}:text`);
  });
}





