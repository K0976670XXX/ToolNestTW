import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatUtc(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

function parseTimestamp(value) {
  const raw = value.trim();
  if (!/^-?\d+$/.test(raw)) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const ms = raw.length <= 10 ? numeric * 1000 : numeric;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export default function initTimestampConverter() {
  const tsInput = document.querySelector("#ts-input");
  const dtInput = document.querySelector("#dt-input");
  const output = document.querySelector("#ts-output");
  const fromUnixBtn = document.querySelector("#ts-from-unix-btn");
  const fromDateBtn = document.querySelector("#ts-from-date-btn");
  const nowBtn = document.querySelector("#ts-now-btn");
  const sampleBtn = document.querySelector("#ts-sample-btn");
  const clearBtn = document.querySelector("#ts-clear-btn");
  const copyBtn = document.querySelector("#ts-copy-btn");

  if (!tsInput || !dtInput || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 時間戳轉換",
      en: "ToolNestTW Timestamp Converter"
    },
    text: {
      ".hero h1": { zh: "時間戳轉換", en: "Timestamp Converter" },
      ".hero .lead": { zh: "Unix 秒/毫秒與日期時間雙向轉換。", en: "Convert between Unix timestamp and datetime." },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="ts-input"]': { zh: "Unix 時間戳", en: "Unix timestamp" },
      'label[for="dt-input"]': { zh: "日期時間 (本地)", en: "Datetime (local)" },
      'label[for="ts-output"]': { zh: "轉換結果", en: "Converted result" },
      "#ts-from-unix-btn": { zh: "Unix 轉日期", en: "Unix to Date" },
      "#ts-from-date-btn": { zh: "日期轉 Unix", en: "Date to Unix" },
      "#ts-now-btn": { zh: "現在時間", en: "Now" },
      "#ts-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#ts-clear-btn": { zh: "清除", en: "Clear" },
      "#ts-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入 Unix 時間戳或選擇日期時間。",
        en: "1. Enter Unix timestamp or choose datetime."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊對應轉換按鈕。",
        en: "2. Click the relevant convert button."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 取得本地時間、UTC 與秒/毫秒結果。",
        en: "3. Read local time, UTC, and second/millisecond values."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "10 位與 13 位差別？ 10 位為秒，13 位為毫秒。",
        en: "10 digits vs 13 digits? 10 is seconds, 13 is milliseconds."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "轉換時區是什麼？ 同時提供本地時間與 UTC。",
        en: "Which timezone is used? Both local time and UTC are shown."
      }
    },
    placeholder: {
      "#ts-input": {
        zh: "例如：1735689600 或 1735689600000",
        en: "Example: 1735689600 or 1735689600000"
      },
      "#ts-output": { zh: "轉換結果會顯示在這裡", en: "Converted result appears here" }
    }
  });

  bindCopyButton(copyBtn, () => output.value);

  const writeFromDate = (date) => {
    const ms = date.getTime();
    const sec = Math.floor(ms / 1000);
    dtInput.value = toLocalInputValue(date);
    tsInput.value = String(ms);
    output.value = [
      `Local: ${date.toLocaleString()}`,
      `UTC: ${formatUtc(date)}`,
      `Unix seconds: ${sec}`,
      `Unix milliseconds: ${ms}`
    ].join("\n");
  };

  fromUnixBtn?.addEventListener("click", () => {
    const date = parseTimestamp(tsInput.value);
    if (!date) {
      toast("Invalid input format");
      return;
    }
    writeFromDate(date);
    toast("Converted.", "success");
  });

  fromDateBtn?.addEventListener("click", () => {
    if (!dtInput.value) {
      toast("Invalid input format");
      return;
    }
    const date = new Date(dtInput.value);
    if (Number.isNaN(date.getTime())) {
      toast("Invalid input format");
      return;
    }
    writeFromDate(date);
    toast("Converted.", "success");
  });

  nowBtn?.addEventListener("click", () => {
    writeFromDate(new Date());
    toast("Now set.", "success");
  });

  sampleBtn?.addEventListener("click", () => {
    tsInput.value = "1735689600";
    output.value = "";
  });

  clearBtn?.addEventListener("click", () => {
    tsInput.value = "";
    dtInput.value = "";
    output.value = "";
  });
}





