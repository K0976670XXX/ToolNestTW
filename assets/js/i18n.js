const STORAGE_KEY = "ToolNestTW:lang";
const SUPPORTED_LANGUAGES = ["en", "zh"];
const LANGUAGE_EVENT = "ToolNestTW:language-change";

const dictionary = {
  en: {
    brand: "ToolNestTW Tools",
    nav_text: "Text",
    nav_dev: "Dev",
    nav_image: "Image",
    nav_data: "Data",
    nav_convert: "Convert",
    nav_utility: "Helper",
    nav_calc: "Calculate",
    footer: "ToolNestTW Web Tools",
    footer_tail: "Frontend only",
    lang_label: "Language",
    lang_en: "English",
    lang_zh: "Chinese",
    theme_dark: "Dark",
    theme_light: "Light",
    home_title: "ToolNestTW Web Tools",
    home_subtitle: "Fast single-page utilities optimized for desktop and mobile use.",
    home_find: "Find Tools",
    home_search_label: "Search by name, category, or keyword",
    home_search_placeholder: "Try: json, hash, qr, image...",
    home_search_clear: "Clear",
    home_search_result: "{count} tool(s)",
    home_recent: "Recently Used",
    home_recent_empty: "No recent tools yet",
    home_favorites: "Saved Tools",
    home_no_favorites: "No favorite tools yet",
    home_filter_all: "All",
    favorite_add: "Add to favorites",
    favorite_remove: "Remove from favorites",
    home_no_match: "No matched tools",
    category_filter: "Filter Tools",
    category_search_label: "Search by name or keyword",
    category_no_match: "No matched tools",
    category_text_heading: "# text:",
    category_dev_heading: "# dev:",
    category_image_heading: "# image:",
    category_data_heading: "# data:",
    category_convert_heading: "# convert:",
    category_utility_heading: "# utility:",
    category_calc_heading: "# calculate:",
    category_text_title: "Text Tools",
    category_text_desc: "Text processing tools",
    category_dev_title: "Dev Tools",
    category_dev_desc: "Developer utilities",
    category_image_title: "Image Tools",
    category_image_desc: "Image processing tools",
    category_data_title: "Data Tools",
    category_data_desc: "Data utilities",
    category_convert_title: "Convert Tools",
    category_convert_desc: "Format conversion tools",
    category_utility_title: "Helper Tools",
    category_utility_desc: "Auxiliary helper tools",
    category_calc_title: "Calculation Tools",
    category_calc_desc: "Calculation-related tools"
  },
  zh: {
    brand: "ToolNestTW 工具平台",
    nav_text: "文字",
    nav_dev: "開發",
    nav_image: "圖片",
    nav_data: "資料",
    nav_convert: "轉換",
    nav_utility: "輔助工具",
    nav_calc: "計算工具",
    footer: "ToolNestTW 網頁工具",
    footer_tail: "純前端",
    lang_label: "語言",
    lang_en: "英文",
    lang_zh: "中文",
    theme_dark: "深色",
    theme_light: "淺色",
    home_title: "ToolNestTW 工具平台",
    home_subtitle: "快速、直覺，並為手機與桌機最佳化。",
    home_find: "搜尋工具",
    home_search_label: "依名稱、分類或關鍵字搜尋",
    home_search_placeholder: "例如：JSON、雜湊、QR",
    home_search_clear: "清除",
    home_search_result: "共 {count} 個工具",
    home_recent: "最近使用",
    home_recent_empty: "尚無最近使用工具",
    home_favorites: "已收藏工具",
    home_no_favorites: "尚未收藏任何工具",
    home_filter_all: "全部",
    favorite_add: "加入收藏",
    favorite_remove: "取消收藏",
    home_no_match: "查無符合工具",
    category_filter: "篩選工具",
    category_search_label: "依名稱或關鍵字搜尋",
    category_no_match: "查無符合工具",
    category_text_heading: "# 文字工具：",
    category_dev_heading: "# 開發工具：",
    category_image_heading: "# 圖片工具：",
    category_data_heading: "# 資料工具：",
    category_convert_heading: "# 轉換工具：",
    category_utility_heading: "# 輔助工具：",
    category_calc_heading: "# 計算工具：",
    category_text_title: "文字工具",
    category_text_desc: "文字處理工具",
    category_dev_title: "開發工具",
    category_dev_desc: "開發常用工具",
    category_image_title: "圖片工具",
    category_image_desc: "圖片處理工具",
    category_data_title: "資料工具",
    category_data_desc: "資料處理工具",
    category_convert_title: "轉換工具",
    category_convert_desc: "格式與時間轉換工具",
    category_utility_title: "輔助工具",
    category_utility_desc: "一般輔助用途工具",
    category_calc_title: "計算工具",
    category_calc_desc: "計算與估算相關工具"
  }
};

const listeners = new Set();

function detectDefaultLanguage() {
  const browserLanguage = navigator.language.toLowerCase();
  return browserLanguage.startsWith("zh") ? "zh" : "en";
}

function readStoredLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

let currentLanguage = readStoredLanguage() || detectDefaultLanguage();

function applyDocumentLanguage(lang) {
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
}

function syncLanguage(lang, options = {}) {
  const { persist = true, broadcast = false } = options;

  if (!SUPPORTED_LANGUAGES.includes(lang) || lang === currentLanguage) {
    return false;
  }

  currentLanguage = lang;
  applyDocumentLanguage(lang);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }

  listeners.forEach((listener) => listener(lang));

  if (broadcast && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: { lang } }));
  }

  return true;
}

applyDocumentLanguage(currentLanguage);

if (typeof window !== "undefined") {
  window.addEventListener(LANGUAGE_EVENT, (event) => {
    const lang = event?.detail?.lang;
    syncLanguage(lang, { persist: false, broadcast: false });
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    syncLanguage(event.newValue, { persist: false, broadcast: false });
  });
}

export function getLanguage() {
  return currentLanguage;
}

export function t(key) {
  return dictionary[currentLanguage]?.[key] || dictionary.en[key] || key;
}

export function setLanguage(lang) {
  syncLanguage(lang, { persist: true, broadcast: true });
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initLanguageToggle(buttonElement) {
  if (!buttonElement) {
    return;
  }

  const render = () => {
    buttonElement.textContent = currentLanguage === "zh" ? "CN" : "EN";
    buttonElement.setAttribute("aria-label", t("lang_label"));
  };

  buttonElement.addEventListener("click", () => {
    setLanguage(currentLanguage === "zh" ? "en" : "zh");
  });

  render();
  onLanguageChange(render);
}





