import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { getCategoryByKey, getToolsByCategory } from "/assets/js/tools/unit_converter_catalog.js?v=1.6.26";

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

function renderToolList(host, tools, query = "") {
  const normalized = String(query || "").trim().toLowerCase();
  const filtered = tools.filter((tool) => {
    if (!normalized) {
      return true;
    }
    return (
      tool.title.en.toLowerCase().includes(normalized) ||
      tool.title.zh.toLowerCase().includes(normalized) ||
      tool.lead.en.toLowerCase().includes(normalized) ||
      tool.lead.zh.toLowerCase().includes(normalized)
    );
  });

  host.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = text("查無符合工具", "No matched tools");
    host.append(empty);
    return;
  }

  filtered.forEach((tool) => {
    const card = document.createElement("article");
    card.className = "tool-card";
    makeCardClickable(card, tool.path);
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = tool.path;
    link.textContent = tool.title[isZh() ? "zh" : "en"] || tool.title.en;
    title.append(link);
    const lead = document.createElement("p");
    lead.textContent = tool.lead[isZh() ? "zh" : "en"] || tool.lead.en;
    card.append(title, lead);
    host.append(card);
  });
}

export default function initUnitConverterCategoryPage() {
  const key = document.body.dataset.unitCategory;
  if (!key) {
    return;
  }

  const category = getCategoryByKey(key);
  if (!category) {
    return;
  }

  const title = document.querySelector("#ucc-title");
  const lead = document.querySelector("#ucc-lead");
  const filterTitle = document.querySelector("#ucc-filter-title");
  const filterLabel = document.querySelector("#ucc-filter-label");
  const search = document.querySelector("#ucc-search");
  const list = document.querySelector("#ucc-list");

  if (!title || !lead || !filterTitle || !filterLabel || !search || !list) {
    return;
  }

  const tools = getToolsByCategory(key);

  const apply = () => {
    const language = isZh() ? "zh" : "en";
    document.title = `ToolNestTW ${category.name[language] || category.name.en}`;
    title.textContent = category.name[language] || category.name.en;
    lead.textContent = category.summary[language] || category.summary.en;
    filterTitle.textContent = text("篩選工具", "Filter tools");
    filterLabel.textContent = text("依名稱或說明搜尋", "Search by name or summary");
    search.placeholder = text("輸入關鍵字", "Enter keyword");
    renderToolList(list, tools, search.value);
  };

  search.addEventListener("input", () => {
    renderToolList(list, tools, search.value);
  });

  apply();
  onLanguageChange(apply);
}

