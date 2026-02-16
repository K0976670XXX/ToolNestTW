import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { unitCategories } from "/assets/js/tools/unit_converter_catalog.js?v=1.6.26";

function isZh() {
  return document.documentElement.lang.startsWith("zh");
}

function text(zh, en) {
  return isZh() ? zh : en;
}

function makeCardClickable(card, href) {
  if (!card || !href) {
    return;
  }

  card.classList.add("is-clickable");
  card.setAttribute("role", "link");
  card.tabIndex = 0;

  const navigate = () => {
    window.location.href = href;
  };

  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, select, textarea, label")) {
      return;
    }
    navigate();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate();
    }
  });
}

function renderCategoryCards(host) {
  host.replaceChildren();
  unitCategories.forEach((category) => {
    const section = document.createElement("article");
    section.className = "tool-card";
    makeCardClickable(section, `/utility/unit_converter/${category.key}/`);

    const h3 = document.createElement("h3");
    const link = document.createElement("a");
    link.href = `/utility/unit_converter/${category.key}/`;
    link.textContent = category.name[isZh() ? "zh" : "en"] || category.name.en;
    h3.append(link);

    const p = document.createElement("p");
    p.textContent = category.summary[isZh() ? "zh" : "en"] || category.summary.en;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = text(`${category.tools.length} 個工具`, `${category.tools.length} tools`);

    section.append(h3, p, tag);
    host.append(section);
  });
}

export default function initUnitConverterIndexPage() {
  const title = document.querySelector("#uci-title");
  const lead = document.querySelector("#uci-lead");
  const categoryTitle = document.querySelector("#uci-category-title");
  const categoryDesc = document.querySelector("#uci-category-desc");
  const categoryList = document.querySelector("#uci-category-list");
  const faqTitle = document.querySelector("#uci-faq-title");
  const faq1 = document.querySelector("#uci-faq-1");
  const faq2 = document.querySelector("#uci-faq-2");

  if (!title || !lead || !categoryTitle || !categoryDesc || !categoryList || !faqTitle || !faq1 || !faq2) {
    return;
  }

  const apply = () => {
    document.title = text("ToolNestTW 單位換算系統", "ToolNestTW Unit Converter");
    title.textContent = text("單位換算系統", "Unit Converter");
    lead.textContent = text(
      "專業級實用工具集合。每個工具皆為獨立應用、即時輸出、可離線使用。",
      "A professional utility collection. Every tool is standalone, instant, and offline-ready."
    );
    categoryTitle.textContent = text("工具分類", "Categories");
    categoryDesc.textContent = text("依領域挑選工具，不需切換到其他系統。", "Choose tools by domain without switching systems.");
    faqTitle.textContent = text("常見問題", "FAQ");
    faq1.textContent = text("需要後端或 API 嗎？不需要，全部在瀏覽器本地運算。", "Need backend or API? No, everything runs in-browser locally.");
    faq2.textContent = text("會儲存敏感資料嗎？不會，工具不保存任何機密內容。", "Does it store sensitive data? No, tools do not persist secret data.");
    renderCategoryCards(categoryList);
  };

  apply();
  onLanguageChange(apply);
}

