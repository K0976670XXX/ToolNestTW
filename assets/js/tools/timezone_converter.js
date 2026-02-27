import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/utility/timezone_converter";
const SAMPLE_INPUT = "2026-01-15T09:30";
const ZONES = [
  "UTC",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney"
];

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    converted: "時區轉換完成。",
    outputSource: "來源時間",
    outputTarget: "目標時間",
    outputUtc: "UTC 時間",
    outputOffsetFrom: "來源偏移",
    outputOffsetTo: "目標偏移",
    outputUnixSec: "Unix 秒",
    outputUnixMs: "Unix 毫秒",
    outputEpoch: "時間戳",
    noDatetime: "請先輸入日期時間"
  },
  en: {
    invalid: "Invalid input format",
    converted: "Timezone converted.",
    outputSource: "Source time",
    outputTarget: "Target time",
    outputUtc: "UTC time",
    outputOffsetFrom: "Source offset",
    outputOffsetTo: "Target offset",
    outputUnixSec: "Unix seconds",
    outputUnixMs: "Unix milliseconds",
    outputEpoch: "Epoch",
    noDatetime: "Please enter datetime first"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key) {
  return copy[lang()]?.[key] || copy.en[key] || key;
}

function getOffsetMs(timeZone, epochMs) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const token = parts.find((item) => item.type === "timeZoneName")?.value || "GMT+00:00";
  const match = token.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/iu);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || "0");
  return sign * (hours * 60 + minutes) * 60000;
}

function formatOffset(ms) {
  const sign = ms >= 0 ? "+" : "-";
  const total = Math.abs(Math.round(ms / 60000));
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function getWallParts(timeZone, epochMs) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const map = {};
  formatter.formatToParts(new Date(epochMs)).forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function parseDatetimeInput(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u);
  if (!match) {
    return null;
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || "0")
  };
  const testDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (
    testDate.getUTCFullYear() !== parts.year ||
    testDate.getUTCMonth() + 1 !== parts.month ||
    testDate.getUTCDate() !== parts.day ||
    testDate.getUTCHours() !== parts.hour ||
    testDate.getUTCMinutes() !== parts.minute
  ) {
    return null;
  }
  return parts;
}

function wallEquals(a, b) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function toEpochFromWall(parts, timeZone) {
  const targetUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let epoch = targetUtc;

  for (let index = 0; index < 6; index += 1) {
    const offset = getOffsetMs(timeZone, epoch);
    const next = targetUtc - offset;
    if (next === epoch) {
      break;
    }
    epoch = next;
  }

  const candidates = [epoch, epoch + 3600000, epoch - 3600000];
  for (const candidate of candidates) {
    if (wallEquals(getWallParts(timeZone, candidate), parts)) {
      return candidate;
    }
  }
  return null;
}

function formatByZone(timeZone, epochMs) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short"
  }).format(new Date(epochMs));
}

function wallInputByZone(timeZone, epochMs) {
  const parts = getWallParts(timeZone, epochMs);
  const yyyy = String(parts.year).padStart(4, "0");
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  const hh = String(parts.hour).padStart(2, "0");
  const mi = String(parts.minute).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function initTimezoneConverter() {
  const datetimeInput = document.querySelector("#tz-datetime");
  const fromSelect = document.querySelector("#tz-from");
  const toSelect = document.querySelector("#tz-to");
  const output = document.querySelector("#tz-output");
  const convertBtn = document.querySelector("#tz-convert-btn");
  const swapBtn = document.querySelector("#tz-swap-btn");
  const nowBtn = document.querySelector("#tz-now-btn");
  const sampleBtn = document.querySelector("#tz-sample-btn");
  const clearBtn = document.querySelector("#tz-clear-btn");
  const copyBtn = document.querySelector("#tz-copy-btn");

  if (!datetimeInput || !fromSelect || !toSelect || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 時區轉換器",
      en: "ToolNestTW Timezone Converter"
    },
    text: {
      ".hero h1": { zh: "時區轉換器", en: "Timezone Converter" },
      ".hero .lead": {
        zh: "在不同時區之間轉換日期時間，並顯示 UTC 偏移資訊。",
        en: "Convert datetimes across time zones with UTC offset details."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="tz-datetime"]': { zh: "日期時間", en: "Datetime" },
      'label[for="tz-from"]': { zh: "來源時區", en: "From timezone" },
      'label[for="tz-to"]': { zh: "目標時區", en: "To timezone" },
      'label[for="tz-output"]': { zh: "轉換結果", en: "Converted result" },
      "#tz-convert-btn": { zh: "轉換時區", en: "Convert Timezone" },
      "#tz-swap-btn": { zh: "交換時區", en: "Swap Timezones" },
      "#tz-now-btn": { zh: "現在時間", en: "Now" },
      "#tz-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#tz-clear-btn": { zh: "清除", en: "Clear" },
      "#tz-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 選擇來源與目標時區並輸入日期時間。",
        en: "1. Select source/target timezone and input datetime."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊轉換時區。",
        en: "2. Click Convert Timezone."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看目標時間、UTC 偏移與 Unix 時間戳。",
        en: "3. Review converted time, offsets, and Unix values."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "支援夏令時間嗎？ 支援，依 IANA 時區資料自動套用。",
        en: "DST supported? Yes, based on IANA timezone data."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會上傳嗎？ 不會，全部在本機瀏覽器完成。",
        en: "Is data uploaded? No, everything runs locally."
      }
    },
    placeholder: {
      "#tz-output": { zh: "轉換結果會顯示在這裡", en: "Converted result appears here" }
    }
  });

  ZONES.forEach((zone) => {
    const fromOption = document.createElement("option");
    fromOption.value = zone;
    fromOption.textContent = zone;
    fromSelect.append(fromOption);

    const toOption = document.createElement("option");
    toOption.value = zone;
    toOption.textContent = zone;
    toSelect.append(toOption);
  });

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  fromSelect.value = ZONES.includes(localZone) ? localZone : "UTC";
  toSelect.value = fromSelect.value === "UTC" ? "Asia/Taipei" : "UTC";

  datetimeInput.value = loadRecentInput(`${TOOL_PATH}:datetime`);
  if (loadRecentInput(`${TOOL_PATH}:from`)) {
    fromSelect.value = loadRecentInput(`${TOOL_PATH}:from`);
  }
  if (loadRecentInput(`${TOOL_PATH}:to`)) {
    toSelect.value = loadRecentInput(`${TOOL_PATH}:to`);
  }

  bindCopyButton(copyBtn, () => output.value);

  let lastResult = null;

  const store = () => {
    saveRecentInput(`${TOOL_PATH}:datetime`, datetimeInput.value);
    saveRecentInput(`${TOOL_PATH}:from`, fromSelect.value);
    saveRecentInput(`${TOOL_PATH}:to`, toSelect.value);
  };

  const renderResult = (result) => {
    if (!result) {
      output.value = "";
      return;
    }
    output.value = [
      `${t("outputSource")}: ${formatByZone(result.fromZone, result.epochMs)}`,
      `${t("outputTarget")}: ${formatByZone(result.toZone, result.epochMs)}`,
      `${t("outputUtc")}: ${new Date(result.epochMs).toISOString()}`,
      `${t("outputOffsetFrom")}: ${formatOffset(getOffsetMs(result.fromZone, result.epochMs))}`,
      `${t("outputOffsetTo")}: ${formatOffset(getOffsetMs(result.toZone, result.epochMs))}`,
      `${t("outputUnixSec")}: ${Math.floor(result.epochMs / 1000)}`,
      `${t("outputUnixMs")}: ${result.epochMs}`,
      `${t("outputEpoch")}: ${result.epochMs}`
    ].join("\n");
  };

  const convert = (withToast = true) => {
    const parsed = parseDatetimeInput(datetimeInput.value);
    if (!parsed) {
      if (withToast) {
        toast(datetimeInput.value ? t("invalid") : t("noDatetime"));
      }
      return;
    }

    const epochMs = toEpochFromWall(parsed, fromSelect.value);
    if (!Number.isFinite(epochMs)) {
      if (withToast) {
        toast(t("invalid"));
      }
      return;
    }

    lastResult = {
      epochMs,
      fromZone: fromSelect.value,
      toZone: toSelect.value
    };
    renderResult(lastResult);
    store();
    if (withToast) {
      toast(t("converted"), "success");
    }
  };

  convertBtn?.addEventListener("click", () => convert(true));

  swapBtn?.addEventListener("click", () => {
    const from = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = from;
    if (datetimeInput.value) {
      convert(false);
    } else {
      store();
    }
  });

  nowBtn?.addEventListener("click", () => {
    datetimeInput.value = wallInputByZone(fromSelect.value, Date.now());
    convert(true);
  });

  sampleBtn?.addEventListener("click", () => {
    datetimeInput.value = SAMPLE_INPUT;
    fromSelect.value = "Asia/Taipei";
    toSelect.value = "America/New_York";
    convert(true);
  });

  clearBtn?.addEventListener("click", () => {
    datetimeInput.value = "";
    output.value = "";
    lastResult = null;
    clearRecentInput(`${TOOL_PATH}:datetime`);
    clearRecentInput(`${TOOL_PATH}:from`);
    clearRecentInput(`${TOOL_PATH}:to`);
  });

  [datetimeInput, fromSelect, toSelect].forEach((node) => {
    node.addEventListener("input", store);
    node.addEventListener("change", store);
  });

  onLanguageChange(() => {
    renderResult(lastResult);
  });
}


