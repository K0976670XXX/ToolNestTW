import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL = "/dev/cron_parser";
const FIXED_NEXT_RUNS = 5;
const DEFAULT_MODE = "linux";
const DEFAULT_EXPR = "0 9 * * *";
const DEFAULT_ACTIVE_PRESET = "";

const WEEKDAY_SHORT = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_TEXT = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  zh: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"]
};

const PRESET_DEFAULTS = {
  daily: { a: "09:00", b: "" },
  every30m: { a: "30", b: "" },
  every4h: { a: "4", b: "0" },
  weekdays: { a: "1-5", b: "07:00" },
  monthly: { a: "1", b: "08:00" }
};

const copy = {
  zh: {
    invalid: "Cron 格式錯誤",
    statusIdle: "驗證狀態：尚未解析",
    statusValid: "驗證狀態：有效",
    statusInvalid: "驗證狀態：無效（{error}）",
    invalidDesc: "請先輸入有效的 Cron 表達式。",
    noRuns: "目前無法計算執行時間。",
    fixedCountHint: "固定顯示最近 5 次執行時間",
    modeLinux: "Linux",
    modeQuartz: "Quartz",
    errLinuxFieldCount: "Linux 模式需 5 欄",
    errQuartzFieldCount: "Quartz 模式需 6 或 7 欄",
    errBothQuestion: "Quartz 的 day 與 weekday 不能同時為 ?",
    errEmpty: "{field} 欄位不可空白",
    errInvalidChar: "{field} 包含非法字元",
    errInvalidRange: "{field} 範圍格式錯誤",
    errInvalidStep: "{field} step 格式錯誤",
    errOutOfRange: "{field} 超出合法範圍",
    presetLocked: "已鎖定：{label}",
    presetUnlocked: "已解除鎖定：{label}",
    presetDailyTitle: "每天執行時間",
    presetDailyA: "時間（HH:MM）",
    presetDailyHint: "例如 09:30、21:23",
    preset30mTitle: "分鐘間隔",
    preset30mA: "每幾分鐘",
    preset30mHint: "輸入 1-59，例如 20、10",
    preset4hTitle: "小時間隔",
    preset4hA: "每幾小時",
    preset4hB: "在第幾分鐘執行",
    preset4hHint: "例如每 6 小時在第 15 分執行",
    presetWeekdaysTitle: "平日時間規則",
    presetWeekdaysA: "星期（1-5 或 1,3,5）",
    presetWeekdaysB: "時間（HH:MM）",
    presetWeekdaysHint: "1=週一 ... 5=週五，0/7=週日",
    presetMonthlyTitle: "每月固定日",
    presetMonthlyA: "每月第幾日（1-31）",
    presetMonthlyB: "時間（HH:MM）",
    presetMonthlyHint: "例如每月 15 日 08:30",
    descFallback: "排程規則（{mode}）：minute={minute} hour={hour} day={day} month={month} weekday={weekday}",
    nextPrefix: "第 {index} 次：",
    cleared: "已清除"
  },
  en: {
    invalid: "Invalid cron expression",
    statusIdle: "Validation status: not parsed",
    statusValid: "Validation status: valid",
    statusInvalid: "Validation status: invalid ({error})",
    invalidDesc: "Enter a valid cron expression first.",
    noRuns: "Unable to calculate next runs.",
    fixedCountHint: "Always showing the next 5 run times",
    modeLinux: "Linux",
    modeQuartz: "Quartz",
    errLinuxFieldCount: "Linux mode requires 5 fields",
    errQuartzFieldCount: "Quartz mode requires 6 or 7 fields",
    errBothQuestion: "Quartz day and weekday cannot both be ?",
    errEmpty: "{field} must not be empty",
    errInvalidChar: "{field} contains illegal characters",
    errInvalidRange: "{field} has an invalid range",
    errInvalidStep: "{field} has an invalid step",
    errOutOfRange: "{field} out of range",
    presetLocked: "Locked: {label}",
    presetUnlocked: "Unlocked: {label}",
    presetDailyTitle: "Daily run time",
    presetDailyA: "Time (HH:MM)",
    presetDailyHint: "For example 09:30 or 21:23",
    preset30mTitle: "Minute interval",
    preset30mA: "Every N minutes",
    preset30mHint: "Use 1-59, for example 20 or 10",
    preset4hTitle: "Hour interval",
    preset4hA: "Every N hours",
    preset4hB: "At minute",
    preset4hHint: "For example every 6 hours at minute 15",
    presetWeekdaysTitle: "Weekday schedule",
    presetWeekdaysA: "Weekday (1-5 or 1,3,5)",
    presetWeekdaysB: "Time (HH:MM)",
    presetWeekdaysHint: "1=Mon ... 5=Fri, 0/7=Sun",
    presetMonthlyTitle: "Monthly schedule",
    presetMonthlyA: "Day of month (1-31)",
    presetMonthlyB: "Time (HH:MM)",
    presetMonthlyHint: "For example day 15 at 08:30",
    descFallback: "Schedule ({mode}): minute={minute} hour={hour} day={day} month={month} weekday={weekday}",
    nextPrefix: "Run {index}:",
    cleared: "Cleared"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const template = copy[lang()]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((text, [name, value]) => {
    return text.replaceAll(`{${name}}`, String(value));
  }, template);
}

function asInt(value) {
  if (!/^-?\d+$/u.test(String(value))) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clamp(value, min, max, fallback) {
  const n = asInt(value);
  if (n === null) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

function parseTime(value, fallbackHour, fallbackMinute) {
  const match = /^(\d{1,2}):(\d{1,2})$/u.exec(String(value || "").trim());
  if (!match) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  const hour = clamp(match[1], 0, 23, fallbackHour);
  const minute = clamp(match[2], 0, 59, fallbackMinute);
  return { hour, minute };
}

function hhmm(hour, minute) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseField(raw, min, max, options = {}) {
  const field = options.field || "field";
  const allowQuestion = Boolean(options.allowQuestion);
  const mapValue = options.mapValue || ((value) => value);
  const source = String(raw || "").trim();

  if (!source) {
    return { ok: false, error: t("errEmpty", { field }) };
  }
  if (source.includes("?") && (!allowQuestion || source !== "?")) {
    return { ok: false, error: t("errInvalidChar", { field }) };
  }
  if (/[^0-9/*,\-?]/u.test(source)) {
    return { ok: false, error: t("errInvalidChar", { field }) };
  }

  const set = new Set();
  const isQuestion = source === "?";
  const isWildcard = source === "*" || isQuestion;

  const addValue = (value) => {
    if (value < min || value > max) {
      return t("errOutOfRange", { field });
    }
    set.add(mapValue(value));
    return "";
  };

  const addRange = (start, end, step) => {
    if (!Number.isFinite(step) || step <= 0) {
      return t("errInvalidStep", { field });
    }
    if (start > end) {
      return t("errInvalidRange", { field });
    }
    for (let value = start; value <= end; value += step) {
      const error = addValue(value);
      if (error) {
        return error;
      }
    }
    return "";
  };

  if (isWildcard) {
    const error = addRange(min, max, 1);
    if (error) {
      return { ok: false, error };
    }
    return { ok: true, raw: source, set, sorted: [...set].sort((a, b) => a - b), isWildcard, isQuestion };
  }

  for (const segmentRaw of source.split(",")) {
    const segment = segmentRaw.trim();
    if (!segment) {
      return { ok: false, error: t("errInvalidRange", { field }) };
    }

    if (segment === "*") {
      const error = addRange(min, max, 1);
      if (error) {
        return { ok: false, error };
      }
      continue;
    }

    if (segment.includes("/")) {
      const [base, stepRaw] = segment.split("/");
      const step = asInt(stepRaw);
      if (!step || step <= 0) {
        return { ok: false, error: t("errInvalidStep", { field }) };
      }
      if (base === "*") {
        const error = addRange(min, max, step);
        if (error) {
          return { ok: false, error };
        }
        continue;
      }
      if (base.includes("-")) {
        const [aRaw, bRaw] = base.split("-");
        const a = asInt(aRaw);
        const b = asInt(bRaw);
        if (a === null || b === null) {
          return { ok: false, error: t("errInvalidRange", { field }) };
        }
        const error = addRange(a, b, step);
        if (error) {
          return { ok: false, error };
        }
        continue;
      }
      const start = asInt(base);
      if (start === null) {
        return { ok: false, error: t("errInvalidRange", { field }) };
      }
      const error = addRange(start, max, step);
      if (error) {
        return { ok: false, error };
      }
      continue;
    }

    if (segment.includes("-")) {
      const [aRaw, bRaw] = segment.split("-");
      const a = asInt(aRaw);
      const b = asInt(bRaw);
      if (a === null || b === null) {
        return { ok: false, error: t("errInvalidRange", { field }) };
      }
      const error = addRange(a, b, 1);
      if (error) {
        return { ok: false, error };
      }
      continue;
    }

    const value = asInt(segment);
    if (value === null) {
      return { ok: false, error: t("errInvalidRange", { field }) };
    }
    const error = addValue(value);
    if (error) {
      return { ok: false, error };
    }
  }

  return { ok: true, raw: source, set, sorted: [...set].sort((a, b) => a - b), isWildcard, isQuestion: false };
}

function parseCron(expr, mode) {
  const tokens = String(expr || "").trim().split(/\s+/u).filter(Boolean);

  if (mode === "linux" && tokens.length !== 5) {
    return { valid: false, error: t("errLinuxFieldCount") };
  }
  if (mode === "quartz" && tokens.length !== 6 && tokens.length !== 7) {
    return { valid: false, error: t("errQuartzFieldCount") };
  }

  const parseByRaw = (raw) => {
    const mapWeekday = mode === "linux" ? (value) => (value === 7 ? 0 : value) : (value) => (value + 6) % 7;
    const weekdayMin = mode === "linux" ? 0 : 1;
    const weekdayMax = 7;

    const fields = {
      second: raw.second !== null ? parseField(raw.second, 0, 59, { field: "second" }) : null,
      minute: parseField(raw.minute, 0, 59, { field: "minute" }),
      hour: parseField(raw.hour, 0, 23, { field: "hour" }),
      day: parseField(raw.day, 1, 31, { field: "day", allowQuestion: mode === "quartz" }),
      month: parseField(raw.month, 1, 12, { field: "month" }),
      weekday: parseField(raw.weekday, weekdayMin, weekdayMax, {
        field: "weekday",
        allowQuestion: mode === "quartz",
        mapValue: mapWeekday
      }),
      year: raw.year !== null ? parseField(raw.year, 1970, 2099, { field: "year" }) : null
    };

    for (const name of ["second", "minute", "hour", "day", "month", "weekday", "year"]) {
      if (fields[name] && !fields[name].ok) {
        return { valid: false, error: fields[name].error };
      }
    }

    if (mode === "quartz" && fields.day.isQuestion && fields.weekday.isQuestion) {
      return { valid: false, error: t("errBothQuestion") };
    }

    return { valid: true, mode, expression: tokens.join(" "), raw, fields };
  };

  if (mode === "linux") {
    return parseByRaw({
      second: null,
      minute: tokens[0],
      hour: tokens[1],
      day: tokens[2],
      month: tokens[3],
      weekday: tokens[4],
      year: null
    });
  }

  if (tokens.length === 7) {
    return parseByRaw({
      second: tokens[0],
      minute: tokens[1],
      hour: tokens[2],
      day: tokens[3],
      month: tokens[4],
      weekday: tokens[5],
      year: tokens[6]
    });
  }

  const withSecond = parseByRaw({
    second: tokens[0],
    minute: tokens[1],
    hour: tokens[2],
    day: tokens[3],
    month: tokens[4],
    weekday: tokens[5],
    year: null
  });
  if (withSecond.valid) {
    return withSecond;
  }
  const noSecondWithYear = parseByRaw({
    second: null,
    minute: tokens[0],
    hour: tokens[1],
    day: tokens[2],
    month: tokens[3],
    weekday: tokens[4],
    year: tokens[5]
  });
  return noSecondWithYear.valid ? noSecondWithYear : withSecond;
}

function describeWithCronstrue(expression) {
  const runner = globalThis.cronstrue;
  if (!runner || typeof runner.toString !== "function") {
    return "";
  }
  try {
    return runner.toString(expression, {
      locale: lang() === "zh" ? "zh_TW" : "en",
      use24HourTimeFormat: true,
      throwExceptionOnParseError: true,
      verbose: false
    });
  } catch {
    return "";
  }
}

function describeFallback(parsed) {
  return t("descFallback", {
    mode: parsed.mode === "linux" ? t("modeLinux") : t("modeQuartz"),
    minute: parsed.raw.minute,
    hour: parsed.raw.hour,
    day: parsed.raw.day,
    month: parsed.raw.month,
    weekday: parsed.raw.weekday
  });
}

const formatterCache = new Map();
function zonedParts(date, timezone) {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(
      timezone,
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        hourCycle: "h23"
      })
    );
  }
  const map = {};
  formatterCache.get(timezone).formatToParts(date).forEach((part) => {
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
    second: Number(map.second),
    weekday: WEEKDAY_SHORT[map.weekday] ?? 0
  };
}

function matchDayWeek(parsed, parts) {
  const dayMatch = parsed.fields.day.set.has(parts.day);
  const weekMatch = parsed.fields.weekday.set.has(parts.weekday);

  if (parsed.mode === "linux") {
    if (parsed.fields.day.isWildcard && parsed.fields.weekday.isWildcard) {
      return true;
    }
    if (parsed.fields.day.isWildcard) {
      return weekMatch;
    }
    if (parsed.fields.weekday.isWildcard) {
      return dayMatch;
    }
    return dayMatch || weekMatch;
  }

  if (parsed.fields.day.isQuestion && !parsed.fields.weekday.isQuestion) {
    return weekMatch;
  }
  if (parsed.fields.weekday.isQuestion && !parsed.fields.day.isQuestion) {
    return dayMatch;
  }
  if (parsed.fields.day.isQuestion && parsed.fields.weekday.isQuestion) {
    return true;
  }
  if (parsed.fields.day.isWildcard && parsed.fields.weekday.isWildcard) {
    return true;
  }
  if (parsed.fields.day.isWildcard) {
    return weekMatch;
  }
  if (parsed.fields.weekday.isWildcard) {
    return dayMatch;
  }
  return dayMatch && weekMatch;
}

function matchCron(parsed, parts) {
  if (parsed.fields.second && !parsed.fields.second.set.has(parts.second)) {
    return false;
  }
  if (!parsed.fields.minute.set.has(parts.minute)) {
    return false;
  }
  if (!parsed.fields.hour.set.has(parts.hour)) {
    return false;
  }
  if (!parsed.fields.month.set.has(parts.month)) {
    return false;
  }
  if (parsed.fields.year && !parsed.fields.year.set.has(parts.year)) {
    return false;
  }
  return matchDayWeek(parsed, parts);
}

function nextRuns(parsed, timezone, count) {
  const now = Date.now();
  const cursor = new Date(now);
  cursor.setUTCSeconds(0, 0);

  const seconds = parsed.fields.second ? parsed.fields.second.sorted : [0];
  const runs = [];
  let guard = 0;
  const limit = 60 * 24 * 366 * 4;

  while (runs.length < count && guard < limit) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    guard += 1;
    for (const second of seconds) {
      const candidate = new Date(cursor.getTime() + second * 1000);
      if (candidate.getTime() <= now) {
        continue;
      }
      if (matchCron(parsed, zonedParts(candidate, timezone))) {
        runs.push(candidate);
        if (runs.length >= count) {
          break;
        }
      }
    }
  }
  return runs;
}

function formatRun(date, timezone) {
  const p = zonedParts(date, timezone);
  const weekdays = WEEKDAY_TEXT[lang()] || WEEKDAY_TEXT.en;
  const w = weekdays[p.weekday] || weekdays[0];
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")} (${w})`;
}

function normalizeWeekdayInput(raw) {
  const value = String(raw || "").trim().replace(/\s+/gu, "");
  if (!value) {
    return "1-5";
  }
  const parsed = parseField(value, 0, 7, { field: "weekday", mapValue: (v) => (v === 7 ? 0 : v) });
  return parsed.ok ? value : "1-5";
}

function validateWeekdayInput(raw) {
  const value = String(raw || "").trim().replace(/\s+/gu, "");
  if (!value) {
    return { ok: false, value: "" };
  }
  const parsed = parseField(value, 0, 7, {
    field: "weekday",
    mapValue: (v) => (v === 7 ? 0 : v)
  });
  return { ok: parsed.ok, value: parsed.ok ? value : "" };
}

export default function initCronParser() {
  const syntax = document.querySelector("#cron-syntax-mode");
  const expr = document.querySelector("#cron-expression");
  const status = document.querySelector("#cron-validation-status");
  const desc = document.querySelector("#cron-description-output");
  const next = document.querySelector("#cron-next-output");
  const copyBtn = document.querySelector("#cron-copy-btn");
  const clearBtn = document.querySelector("#cron-clear-btn");

  const presetDaily = document.querySelector("#cron-preset-daily");
  const preset30m = document.querySelector("#cron-preset-30m");
  const preset4h = document.querySelector("#cron-preset-4h");
  const presetWeekdays = document.querySelector("#cron-preset-weekdays");
  const presetMonthly = document.querySelector("#cron-preset-monthly");

  const configWrap = document.querySelector("#cron-preset-config");
  const configTitle = document.querySelector("#cron-preset-config-title");
  const configHint = document.querySelector("#cron-preset-config-hint");
  const configALabel = document.querySelector("#cron-preset-a-label");
  const configA = document.querySelector("#cron-preset-a");
  const configBField = document.querySelector("#cron-preset-b-field");
  const configBLabel = document.querySelector("#cron-preset-b-label");
  const configB = document.querySelector("#cron-preset-b");

  if (
    !syntax ||
    !expr ||
    !status ||
    !desc ||
    !next ||
    !copyBtn ||
    !clearBtn ||
    !presetDaily ||
    !preset30m ||
    !preset4h ||
    !presetWeekdays ||
    !presetMonthly ||
    !configWrap ||
    !configTitle ||
    !configHint ||
    !configALabel ||
    !configA ||
    !configBField ||
    !configBLabel ||
    !configB
  ) {
    return;
  }

  bindPageI18n({
    title: { zh: "ToolNestTW Cron Parser", en: "ToolNestTW Cron Parser" },
    text: {
      ".hero h1": { zh: "Cron Parser", en: "Cron Parser" },
      ".hero .lead": {
        zh: "將 Cron 轉為可讀語句，並用常見規則快速產生 Cron。",
        en: "Turn cron into clear language and generate cron from common presets."
      },
      "#cron-mode-title": { zh: "Cron 語法模式", en: "Cron Syntax Mode" },
      "#cron-syntax-label": { zh: "Cron 語法模式", en: "Cron syntax mode" },
      '#cron-syntax-mode option[value="linux"]': { zh: "Linux (5 欄)", en: "Linux (5 fields)" },
      '#cron-syntax-mode option[value="quartz"]': { zh: "Quartz (6/7 欄)", en: "Quartz (6/7 fields)" },
      "#cron-preset-title": { zh: "常見規則", en: "Common Presets" },
      "#cron-preset-hint": {
        zh: "點一下按鈕可鎖定規則，再點一次解除鎖定。",
        en: "Click a preset to lock it. Click again to unlock."
      },
      "#cron-preset-daily": { zh: "每天 09:00", en: "Daily 09:00" },
      "#cron-preset-30m": { zh: "每 30 分鐘", en: "Every 30 minutes" },
      "#cron-preset-4h": { zh: "每 4 小時", en: "Every 4 hours" },
      "#cron-preset-weekdays": { zh: "每週一到週五 07:00", en: "Mon-Fri 07:00" },
      "#cron-preset-monthly": { zh: "每月 1 日 08:00", en: "Monthly day 1 at 08:00" },
      "#cron-expression-title": { zh: "Cron 表達式", en: "Cron Expression" },
      "#cron-expression-label": { zh: "Cron 表達式", en: "Cron expression" },
      "#cron-output-title": { zh: "輸出", en: "Output" },
      "#cron-description-label": { zh: "可讀語句", en: "Human description" },
      "#cron-next-label": { zh: "下一次執行時間（固定 5 筆）", en: "Next runs (fixed 5)" },
      "#cron-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      "#cron-clear-btn": { zh: "清除", en: "Clear" },
      "#cron-how-title": { zh: "使用方式", en: "How to use" },
      "#cron-how-1": { zh: "1. 先選 Cron 語法模式。", en: "1. Select the cron syntax mode." },
      "#cron-how-2": { zh: "2. 可直接輸入 Cron，或使用常見規則。", en: "2. Enter cron directly, or use a common preset." },
      "#cron-how-3": { zh: "3. 系統會即時顯示語句與固定 5 筆執行時間。", en: "3. Description and next 5 runs update instantly." },
      "#cron-faq-title": { zh: "常見問題", en: "FAQ" },
      "#cron-faq-1": {
        zh: "支援哪些符號？ 支援 `*`、`,`、`-`、`/`，Quartz 額外支援 `?`。",
        en: "What syntax is supported? `*`, `,`, `-`, `/`, and `?` for Quartz."
      },
      "#cron-faq-2": {
        zh: "資料會外傳嗎？ 不會，全部在瀏覽器本地運算。",
        en: "Will data be sent out? No, everything runs locally in your browser."
      },
      "#cron-recommend-title": { zh: "推薦工具", en: "Recommended tools" }
    },
    placeholder: {
      "#cron-expression": { zh: "例如：0 9 * * *", en: "Example: 0 9 * * *" },
      "#cron-description-output": { zh: "解析後會顯示在這裡", en: "Description appears here after parsing" },
      "#cron-next-output": { zh: "下一次執行時間會顯示在這裡", en: "Next run times appear here after parsing" }
    }
  });

  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const presetButtons = {
    daily: presetDaily,
    every30m: preset30m,
    every4h: preset4h,
    weekdays: presetWeekdays,
    monthly: presetMonthly
  };

  const presetState = {
    daily: { ...PRESET_DEFAULTS.daily },
    every30m: { ...PRESET_DEFAULTS.every30m },
    every4h: { ...PRESET_DEFAULTS.every4h },
    weekdays: { ...PRESET_DEFAULTS.weekdays, lastValidA: PRESET_DEFAULTS.weekdays.a },
    monthly: { ...PRESET_DEFAULTS.monthly }
  };

  const state = {
    valid: null,
    error: "",
    parsed: null,
    description: "",
    runs: []
  };

  let activePreset = DEFAULT_ACTIVE_PRESET;
  let analyzeTimer = null;

  function save() {
    saveRecentInput(`${TOOL}:mode`, syntax.value);
    saveRecentInput(`${TOOL}:expr`, expr.value);
    saveRecentInput(`${TOOL}:preset_active`, activePreset || "");
    Object.keys(presetState).forEach((name) => {
      saveRecentInput(`${TOOL}:preset_${name}_a`, presetState[name].a);
      saveRecentInput(`${TOOL}:preset_${name}_b`, presetState[name].b);
    });
  }

  function renderStatus() {
    status.classList.remove("status-idle", "status-valid", "status-invalid");
    if (state.valid === null) {
      status.textContent = t("statusIdle");
      status.classList.add("status-idle");
    } else if (state.valid) {
      status.textContent = t("statusValid");
      status.classList.add("status-valid");
    } else {
      status.textContent = t("statusInvalid", { error: state.error });
      status.classList.add("status-invalid");
    }
  }

  function renderOutput() {
    renderStatus();
    desc.value = state.valid ? state.description : t("invalidDesc");
    if (state.valid && state.runs.length) {
      next.value = state.runs
        .map((date, index) => `${t("nextPrefix", { index: index + 1 })} ${formatRun(date, localTimezone)}`)
        .join("\n");
    } else {
      next.value = t("noRuns");
    }
  }

  function analyze(notifyInvalid = false) {
    const parsed = parseCron(expr.value, syntax.value);
    if (!parsed.valid) {
      state.valid = false;
      state.error = parsed.error;
      state.parsed = null;
      state.description = "";
      state.runs = [];
      renderOutput();
      if (notifyInvalid) {
        toast(t("invalid"));
      }
      return false;
    }

    const human = describeWithCronstrue(parsed.expression) || describeFallback(parsed);
    state.valid = true;
    state.error = "";
    state.parsed = parsed;
    state.description = human;
    state.runs = nextRuns(parsed, localTimezone, FIXED_NEXT_RUNS);
    renderOutput();
    return true;
  }

  function scheduleAnalyze() {
    if (analyzeTimer) {
      clearTimeout(analyzeTimer);
    }
    analyzeTimer = setTimeout(() => analyze(false), 140);
  }

  function updatePresetButtons() {
    Object.entries(presetButtons).forEach(([name, button]) => {
      button.classList.toggle("btn-primary", activePreset === name);
    });
  }

  function applyPresetToExpression(name) {
    const values = presetState[name];
    if (name === "daily") {
      const time = parseTime(values.a, 9, 0);
      values.a = hhmm(time.hour, time.minute);
      expr.value = `${time.minute} ${time.hour} * * *`;
      return;
    }
    if (name === "every30m") {
      const interval = clamp(values.a, 1, 59, 30);
      values.a = String(interval);
      expr.value = `*/${interval} * * * *`;
      return;
    }
    if (name === "every4h") {
      const hourStep = clamp(values.a, 1, 23, 4);
      const minute = clamp(values.b, 0, 59, 0);
      values.a = String(hourStep);
      values.b = String(minute);
      expr.value = `${minute} */${hourStep} * * *`;
      return;
    }
    if (name === "weekdays") {
      const checked = validateWeekdayInput(values.a);
      const range = checked.ok ? checked.value : values.lastValidA || normalizeWeekdayInput(values.a);
      const time = parseTime(values.b, 7, 0);
      if (checked.ok) {
        values.lastValidA = checked.value;
      }
      values.b = hhmm(time.hour, time.minute);
      expr.value = `${time.minute} ${time.hour} * * ${range}`;
      return;
    }
    if (name === "monthly") {
      const day = clamp(values.a, 1, 31, 1);
      const time = parseTime(values.b, 8, 0);
      values.a = String(day);
      values.b = hhmm(time.hour, time.minute);
      expr.value = `${time.minute} ${time.hour} ${day} * *`;
    }
  }

  function renderPresetConfig() {
    if (!activePreset) {
      configWrap.hidden = true;
      expr.readOnly = false;
      return;
    }

    expr.readOnly = true;
    configWrap.hidden = false;
    const values = presetState[activePreset];

    if (activePreset === "daily") {
      configTitle.textContent = t("presetDailyTitle");
      configALabel.textContent = t("presetDailyA");
      configHint.textContent = t("presetDailyHint");
      configA.type = "time";
      configA.step = "60";
      configA.min = "";
      configA.max = "";
      configA.value = values.a;
      configBField.hidden = true;
      return;
    }

    if (activePreset === "every30m") {
      configTitle.textContent = t("preset30mTitle");
      configALabel.textContent = t("preset30mA");
      configHint.textContent = t("preset30mHint");
      configA.type = "number";
      configA.step = "1";
      configA.min = "1";
      configA.max = "59";
      configA.value = values.a;
      configBField.hidden = true;
      return;
    }

    if (activePreset === "every4h") {
      configTitle.textContent = t("preset4hTitle");
      configALabel.textContent = t("preset4hA");
      configHint.textContent = t("preset4hHint");
      configA.type = "number";
      configA.step = "1";
      configA.min = "1";
      configA.max = "23";
      configA.value = values.a;
      configBField.hidden = false;
      configBLabel.textContent = t("preset4hB");
      configB.type = "number";
      configB.step = "1";
      configB.min = "0";
      configB.max = "59";
      configB.value = values.b;
      return;
    }

    if (activePreset === "weekdays") {
      configTitle.textContent = t("presetWeekdaysTitle");
      configALabel.textContent = t("presetWeekdaysA");
      configHint.textContent = t("presetWeekdaysHint");
      configA.type = "text";
      configA.step = "";
      configA.min = "";
      configA.max = "";
      configA.value = values.a;
      configBField.hidden = false;
      configBLabel.textContent = t("presetWeekdaysB");
      configB.type = "time";
      configB.step = "60";
      configB.min = "";
      configB.max = "";
      configB.value = values.b;
      return;
    }

    configTitle.textContent = t("presetMonthlyTitle");
    configALabel.textContent = t("presetMonthlyA");
    configHint.textContent = t("presetMonthlyHint");
    configA.type = "number";
    configA.step = "1";
    configA.min = "1";
    configA.max = "31";
    configA.value = values.a;
    configBField.hidden = false;
    configBLabel.textContent = t("presetMonthlyB");
    configB.type = "time";
    configB.step = "60";
    configB.min = "";
    configB.max = "";
    configB.value = values.b;
  }

  function lockPreset(name) {
    activePreset = name;
    syntax.value = "linux";
    applyPresetToExpression(name);
    updatePresetButtons();
    renderPresetConfig();
    save();
    analyze(false);
    toast(t("presetLocked", { label: presetButtons[name].textContent.trim() }), "success");
  }

  function unlockPreset(showToast = true) {
    if (!activePreset) {
      return;
    }
    const label = presetButtons[activePreset].textContent.trim();
    activePreset = "";
    updatePresetButtons();
    renderPresetConfig();
    save();
    analyze(false);
    if (showToast) {
      toast(t("presetUnlocked", { label }), "success");
    }
  }

  function onPresetToggle(name) {
    if (activePreset === name) {
      unlockPreset(true);
      return;
    }
    lockPreset(name);
  }

  function onPresetConfigInput() {
    if (!activePreset) {
      return;
    }
    presetState[activePreset].a = configA.value;
    presetState[activePreset].b = configB.value;
    applyPresetToExpression(activePreset);
    renderPresetConfig();
    save();
    scheduleAnalyze();
  }

  bindCopyButton(copyBtn, () => {
    return [expr.value, status.textContent, desc.value, next.value].filter(Boolean).join("\n\n");
  });

  presetDaily.addEventListener("click", () => onPresetToggle("daily"));
  preset30m.addEventListener("click", () => onPresetToggle("every30m"));
  preset4h.addEventListener("click", () => onPresetToggle("every4h"));
  presetWeekdays.addEventListener("click", () => onPresetToggle("weekdays"));
  presetMonthly.addEventListener("click", () => onPresetToggle("monthly"));

  configA.addEventListener("input", onPresetConfigInput);
  configB.addEventListener("input", onPresetConfigInput);
  configA.addEventListener("change", onPresetConfigInput);
  configB.addEventListener("change", onPresetConfigInput);

  syntax.addEventListener("change", () => {
    if (activePreset && syntax.value !== "linux") {
      unlockPreset(false);
    }
    save();
    analyze(false);
  });

  expr.addEventListener("input", () => {
    if (activePreset) {
      unlockPreset(false);
    }
    save();
    scheduleAnalyze();
  });
  expr.addEventListener("change", () => {
    save();
    analyze(false);
  });

  clearBtn.addEventListener("click", () => {
    syntax.value = DEFAULT_MODE;
    expr.value = DEFAULT_EXPR;
    activePreset = "";
    Object.keys(presetState).forEach((name) => {
      presetState[name].a = PRESET_DEFAULTS[name].a;
      presetState[name].b = PRESET_DEFAULTS[name].b;
      if (name === "weekdays") {
        presetState[name].lastValidA = PRESET_DEFAULTS.weekdays.a;
      }
    });
    updatePresetButtons();
    renderPresetConfig();
    [
      "mode",
      "expr",
      "preset_active",
      "preset_daily_a",
      "preset_daily_b",
      "preset_every30m_a",
      "preset_every30m_b",
      "preset_every4h_a",
      "preset_every4h_b",
      "preset_weekdays_a",
      "preset_weekdays_b",
      "preset_monthly_a",
      "preset_monthly_b"
    ].forEach((key) => clearRecentInput(`${TOOL}:${key}`));
    save();
    analyze(false);
    toast(t("cleared"), "success");
  });

  onLanguageChange(() => {
    if (activePreset) {
      renderPresetConfig();
    }
    analyze(false);
  });

  const storedMode = loadRecentInput(`${TOOL}:mode`);
  const storedExpr = loadRecentInput(`${TOOL}:expr`);
  const storedActivePreset = loadRecentInput(`${TOOL}:preset_active`);

  Object.keys(presetState).forEach((name) => {
    const savedA = loadRecentInput(`${TOOL}:preset_${name}_a`);
    const savedB = loadRecentInput(`${TOOL}:preset_${name}_b`);
    presetState[name].a = savedA || PRESET_DEFAULTS[name].a;
    presetState[name].b = savedB || PRESET_DEFAULTS[name].b;
    if (name === "weekdays") {
      const checked = validateWeekdayInput(presetState[name].a);
      presetState[name].lastValidA = checked.ok ? checked.value : PRESET_DEFAULTS.weekdays.a;
    }
  });

  syntax.value = storedMode === "linux" || storedMode === "quartz" ? storedMode : DEFAULT_MODE;
  expr.value = storedExpr || DEFAULT_EXPR;
  activePreset = Object.prototype.hasOwnProperty.call(presetButtons, storedActivePreset) ? storedActivePreset : "";

  updatePresetButtons();
  renderPresetConfig();
  if (activePreset) {
    syntax.value = "linux";
    applyPresetToExpression(activePreset);
  }
  analyze(false);
}
