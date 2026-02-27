import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/utility/age_calculator";
const SAMPLE_BIRTH = "1995-08-18";
const SAMPLE_TARGET = "2026-02-15";

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    missingBirth: "請輸入生日",
    missingTarget: "請輸入目標日期",
    rangeError: "目標日期不可早於生日",
    calculated: "年齡計算完成。",
    age: "年齡",
    totalMonths: "總月數",
    totalWeeks: "總週數",
    totalDays: "總天數",
    nextBirthday: "下次生日",
    daysUntil: "還有 {days} 天"
  },
  en: {
    invalid: "Invalid input format",
    missingBirth: "Please enter birth date",
    missingTarget: "Please enter target date",
    rangeError: "Target date cannot be earlier than birth date",
    calculated: "Age calculated.",
    age: "Age",
    totalMonths: "Total months",
    totalWeeks: "Total weeks",
    totalDays: "Total days",
    nextBirthday: "Next birthday",
    daysUntil: "in {days} day(s)"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const template = copy[lang()]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function parseDateInput(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const test = new Date(Date.UTC(year, month - 1, day));
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() + 1 !== month ||
    test.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, value: `${match[1]}-${match[2]}-${match[3]}`, ms: test.getTime() };
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeBirthday(year, month, day) {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }
  return { year, month, day };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function calculateAge(birth, target) {
  let years = target.year - birth.year;
  let months = target.month - birth.month;
  let days = target.day - birth.day;

  if (days < 0) {
    months -= 1;
    const prevMonth = target.month - 1 <= 0 ? 12 : target.month - 1;
    const prevYear = prevMonth === 12 ? target.year - 1 : target.year;
    days += daysInMonth(prevYear, prevMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor((target.ms - birth.ms) / 86400000);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalMonths = years * 12 + months;

  let nextYear = target.year;
  let nextBirthday = normalizeBirthday(nextYear, birth.month, birth.day);
  let nextMs = Date.UTC(nextBirthday.year, nextBirthday.month - 1, nextBirthday.day);
  if (nextMs < target.ms) {
    nextYear += 1;
    nextBirthday = normalizeBirthday(nextYear, birth.month, birth.day);
    nextMs = Date.UTC(nextBirthday.year, nextBirthday.month - 1, nextBirthday.day);
  }
  const daysUntil = Math.floor((nextMs - target.ms) / 86400000);

  return {
    years,
    months,
    days,
    totalMonths,
    totalWeeks,
    totalDays,
    nextBirthday: `${String(nextBirthday.year).padStart(4, "0")}-${String(nextBirthday.month).padStart(2, "0")}-${String(nextBirthday.day).padStart(2, "0")}`,
    daysUntil
  };
}

export default function initAgeCalculator() {
  const birthInput = document.querySelector("#age-birth");
  const targetInput = document.querySelector("#age-target");
  const output = document.querySelector("#age-output");
  const calcBtn = document.querySelector("#age-calc-btn");
  const todayBtn = document.querySelector("#age-today-btn");
  const sampleBtn = document.querySelector("#age-sample-btn");
  const clearBtn = document.querySelector("#age-clear-btn");
  const copyBtn = document.querySelector("#age-copy-btn");

  if (!birthInput || !targetInput || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 年齡計算器",
      en: "ToolNestTW Age Calculator"
    },
    text: {
      ".hero h1": { zh: "年齡計算器", en: "Age Calculator" },
      ".hero .lead": {
        zh: "輸入生日與目標日期，快速計算精確年齡。",
        en: "Calculate precise age from birth date and target date."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="age-birth"]': { zh: "生日", en: "Birth date" },
      'label[for="age-target"]': { zh: "目標日期", en: "Target date" },
      'label[for="age-output"]': { zh: "計算結果", en: "Calculation result" },
      "#age-calc-btn": { zh: "計算年齡", en: "Calculate Age" },
      "#age-today-btn": { zh: "設為今天", en: "Set Today" },
      "#age-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#age-clear-btn": { zh: "清除", en: "Clear" },
      "#age-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入生日與目標日期。",
        en: "1. Enter birth date and target date."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊計算年齡。",
        en: "2. Click Calculate Age."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 查看年/月/日與總天數資訊。",
        en: "3. Read years/months/days and total-day metrics."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "可算未來日期嗎？ 可以，目標日期可自訂。",
        en: "Can it calculate future dates? Yes, target date is customizable."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會上傳嗎？ 不會，全部在本機瀏覽器完成。",
        en: "Is data uploaded? No, everything runs locally."
      }
    },
    placeholder: {
      "#age-output": { zh: "計算結果會顯示在這裡", en: "Calculation result appears here" }
    }
  });

  bindCopyButton(copyBtn, () => output.value);

  birthInput.value = loadRecentInput(`${TOOL_PATH}:birth`);
  targetInput.value = loadRecentInput(`${TOOL_PATH}:target`);

  let lastResult = null;

  const store = () => {
    saveRecentInput(`${TOOL_PATH}:birth`, birthInput.value);
    saveRecentInput(`${TOOL_PATH}:target`, targetInput.value);
  };

  const render = (payload) => {
    if (!payload) {
      output.value = "";
      return;
    }
    output.value = [
      `${t("age")}: ${payload.years}y ${payload.months}m ${payload.days}d`,
      `${t("totalMonths")}: ${payload.totalMonths}`,
      `${t("totalWeeks")}: ${payload.totalWeeks}`,
      `${t("totalDays")}: ${payload.totalDays}`,
      `${t("nextBirthday")}: ${payload.nextBirthday} (${t("daysUntil", { days: payload.daysUntil })})`
    ].join("\n");
  };

  const calculate = (withToast = true) => {
    const birth = parseDateInput(birthInput.value);
    const target = parseDateInput(targetInput.value);

    if (!birthInput.value) {
      if (withToast) {
        toast(t("missingBirth"));
      }
      return;
    }
    if (!targetInput.value) {
      if (withToast) {
        toast(t("missingTarget"));
      }
      return;
    }
    if (!birth || !target) {
      if (withToast) {
        toast(t("invalid"));
      }
      return;
    }
    if (target.ms < birth.ms) {
      if (withToast) {
        toast(t("rangeError"));
      }
      return;
    }

    lastResult = calculateAge(birth, target);
    render(lastResult);
    store();
    if (withToast) {
      toast(t("calculated"), "success");
    }
  };

  calcBtn?.addEventListener("click", () => calculate(true));

  todayBtn?.addEventListener("click", () => {
    const now = new Date();
    const yyyy = String(now.getFullYear()).padStart(4, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    targetInput.value = `${yyyy}-${mm}-${dd}`;
    calculate(false);
  });

  sampleBtn?.addEventListener("click", () => {
    birthInput.value = SAMPLE_BIRTH;
    targetInput.value = SAMPLE_TARGET;
    calculate(true);
  });

  clearBtn?.addEventListener("click", () => {
    birthInput.value = "";
    targetInput.value = "";
    lastResult = null;
    output.value = "";
    clearRecentInput(`${TOOL_PATH}:birth`);
    clearRecentInput(`${TOOL_PATH}:target`);
  });

  [birthInput, targetInput].forEach((node) => {
    node.addEventListener("input", store);
    node.addEventListener("change", store);
  });

  onLanguageChange(() => render(lastResult));
}


