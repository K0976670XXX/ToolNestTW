import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/convert/base_converter";
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const COMMON_BASES = [2, 8, 10, 16, 36];

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    converted: "轉換完成。",
    swapped: "已交換來源與目標進制。",
    from: "來源進制",
    to: "目標進制",
    input: "輸入值",
    target: "目標結果",
    common: "常用進制"
  },
  en: {
    invalid: "Invalid input format",
    converted: "Converted.",
    swapped: "Swapped source and target base.",
    from: "From base",
    to: "To base",
    input: "Input",
    target: "Target result",
    common: "Common bases"
  }
};

function isZh() {
  return document.documentElement.lang.startsWith("zh");
}

function t(key) {
  const lang = isZh() ? "zh" : "en";
  return copy[lang]?.[key] || copy.en[key] || key;
}

function normalizeBase(raw) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 36) {
    return null;
  }
  return parsed;
}

function parseIntegerByBase(rawValue, base) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return null;
  }

  let sign = 1n;
  let source = raw;
  if (source.startsWith("-")) {
    sign = -1n;
    source = source.slice(1);
  } else if (source.startsWith("+")) {
    source = source.slice(1);
  }

  source = source.replaceAll("_", "").replaceAll(" ", "").toUpperCase();
  if (!source) {
    return null;
  }

  let result = 0n;
  const baseValue = BigInt(base);

  for (const char of source) {
    const digit = DIGITS.indexOf(char);
    if (digit < 0 || digit >= base) {
      return null;
    }
    result = result * baseValue + BigInt(digit);
  }

  return sign * result;
}

function formatBigIntByBase(value, base) {
  const baseValue = BigInt(base);
  if (value === 0n) {
    return "0";
  }

  let working = value < 0n ? -value : value;
  let output = "";
  while (working > 0n) {
    const remainder = Number(working % baseValue);
    output = DIGITS[remainder] + output;
    working /= baseValue;
  }

  return value < 0n ? `-${output}` : output;
}

function buildOutput(inputText, fromBase, toBase, parsedValue) {
  const lines = [
    `${t("from")}: ${fromBase}`,
    `${t("to")}: ${toBase}`,
    `${t("input")}: ${String(inputText).trim()}`,
    `${t("target")}: ${formatBigIntByBase(parsedValue, toBase)}`,
    "",
    `${t("common")}:`
  ];

  COMMON_BASES.forEach((base) => {
    lines.push(`Base ${base}: ${formatBigIntByBase(parsedValue, base)}`);
  });

  return lines.join("\n");
}

export default function initBaseConverter() {
  const input = document.querySelector("#base-input");
  const fromInput = document.querySelector("#base-from");
  const toInput = document.querySelector("#base-to");
  const output = document.querySelector("#base-output");
  const convertBtn = document.querySelector("#base-convert-btn");
  const swapBtn = document.querySelector("#base-swap-btn");
  const sampleBtn = document.querySelector("#base-sample-btn");
  const clearBtn = document.querySelector("#base-clear-btn");
  const copyBtn = document.querySelector("#base-copy-btn");

  if (!input || !fromInput || !toInput || !output || !copyBtn) {
    return;
  }

  bindPageI18n({
    title: { zh: "ToolNestTW 進制轉換", en: "ToolNestTW Base Converter" },
    text: {
      ".hero h1": { zh: "進制轉換", en: "Base Converter" },
      ".hero .lead": {
        zh: "支援 2 到 36 進制，快速互轉並提供常用進制結果。",
        en: "Convert values between base 2-36 and view common base outputs."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="base-input"]': { zh: "數值", en: "Value" },
      'label[for="base-from"]': { zh: "來源進制", en: "From base" },
      'label[for="base-to"]': { zh: "目標進制", en: "To base" },
      'label[for="base-output"]': { zh: "轉換結果", en: "Result" },
      "#base-convert-btn": { zh: "轉換", en: "Convert" },
      "#base-swap-btn": { zh: "交換進制", en: "Swap Bases" },
      "#base-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#base-clear-btn": { zh: "清除", en: "Clear" },
      "#base-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入數值並設定來源/目標進制。",
        en: "1. Enter a value and choose source/target base."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊轉換。",
        en: "2. Click convert."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看目標結果與常用進制換算值。",
        en: "3. Review target result and common base values."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "支援小數嗎？ 目前僅支援整數。",
        en: "Are fractions supported? Integers only for now."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "可用大數嗎？ 可以，使用 BigInt 計算。",
        en: "Can this handle very large numbers? Yes, with BigInt."
      }
    },
    placeholder: {
      "#base-input": {
        zh: "例如：101101、7f、123456789",
        en: "Example: 101101, 7f, 123456789"
      },
      "#base-output": {
        zh: "轉換結果會顯示在這裡",
        en: "Converted result appears here"
      }
    }
  });

  const convert = (withToast = true) => {
    const fromBase = normalizeBase(fromInput.value);
    const toBase = normalizeBase(toInput.value);

    if (!fromBase || !toBase) {
      toast(t("invalid"));
      return false;
    }

    const parsed = parseIntegerByBase(input.value, fromBase);
    if (parsed === null) {
      toast(t("invalid"));
      return false;
    }

    output.value = buildOutput(input.value, fromBase, toBase, parsed);
    if (withToast) {
      toast(t("converted"), "success");
    }
    return true;
  };

  bindCopyButton(copyBtn, () => output.value);

  input.value = loadRecentInput(`${TOOL_PATH}:value`);
  fromInput.value = loadRecentInput(`${TOOL_PATH}:from`) || "10";
  toInput.value = loadRecentInput(`${TOOL_PATH}:to`) || "16";

  const save = () => {
    saveRecentInput(`${TOOL_PATH}:value`, input.value);
    saveRecentInput(`${TOOL_PATH}:from`, fromInput.value);
    saveRecentInput(`${TOOL_PATH}:to`, toInput.value);
  };

  [input, fromInput, toInput].forEach((element) => {
    element.addEventListener("input", save);
    element.addEventListener("change", save);
  });

  convertBtn?.addEventListener("click", () => convert(true));
  sampleBtn?.addEventListener("click", () => {
    input.value = "7F";
    fromInput.value = "16";
    toInput.value = "10";
    save();
    convert(true);
  });
  swapBtn?.addEventListener("click", () => {
    const tmp = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = tmp;
    save();
    toast(t("swapped"), "success");
    convert(false);
  });
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    fromInput.value = "10";
    toInput.value = "16";
    output.value = "";
    ["value", "from", "to"].forEach((key) => clearRecentInput(`${TOOL_PATH}:${key}`));
  });
}
