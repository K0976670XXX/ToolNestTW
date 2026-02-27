import { onLanguageChange, t } from "/assets/js/i18n.js?v=1.6.26";
import {
  getToolByPath,
  getToolDisplayName,
  getToolSummary,
  toolRegistry
} from "/assets/js/tools.registry.js?v=1.6.26";
import {
  getFavoriteTools,
  getRecentTools,
  isFavoriteTool,
  toggleFavoriteTool
} from "/assets/js/utils.js?v=1.6.26";

const categoryOrder = ["text", "image", "data", "dev", "calc", "convert"];
const categoryHeadingKey = {
  text: "category_text_heading",
  image: "category_image_heading",
  data: "category_data_heading",
  dev: "category_dev_heading",
  calc: "category_calc_heading",
  convert: "category_convert_heading"
};
const categoryLabelKey = {
  text: "nav_text",
  image: "nav_image",
  data: "nav_data",
  dev: "nav_dev",
  calc: "nav_calc",
  convert: "nav_convert"
};

function formatCopy(key, params = {}) {
  const template = t(key);
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function categoryTagText(category, lang) {
  if (lang === "zh") {
    if (category === "text") {
      return "文字";
    }
    if (category === "dev") {
      return "開發";
    }
    if (category === "image") {
      return "圖片";
    }
    if (category === "data") {
      return "資料";
    }
    if (category === "convert") {
      return "轉換";
    }
    if (category === "utility") {
      return "輔助";
    }
    if (category === "calc") {
      return "計算";
    }
  }
  if (category === "calc") {
    return "calculate";
  }
  return category;
}

function createFavoriteButton(tool, onChange) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fav-btn";

  const render = () => {
    const favored = isFavoriteTool(tool.path);
    button.textContent = favored ? "★" : "☆";
    button.setAttribute("aria-label", favored ? t("favorite_remove") : t("favorite_add"));
    button.title = favored ? t("favorite_remove") : t("favorite_add");
  };

  render();
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavoriteTool(tool.path);
    render();
    onChange();
  });
  return button;
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

function createToolCard(tool, lang, onFavoriteChange, showTag = true) {
  const article = document.createElement("article");
  article.className = "tool-card";
  makeCardClickable(article, tool.path);

  const head = document.createElement("div");
  head.className = "tool-card-head";

  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = tool.path;
  link.textContent = getToolDisplayName(tool, lang);
  title.append(link);

  head.append(title, createFavoriteButton(tool, onFavoriteChange));

  const description = document.createElement("p");
  description.textContent = getToolSummary(tool, lang) || (lang === "zh" ? "工具簡介" : "Tool overview");

  article.append(head, description);

  if (showTag) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = categoryTagText(tool.category, lang);
    article.append(tag);
  }

  return article;
}

function createCategoryRow(category, tools, lang, onFavoriteChange) {
  const section = document.createElement("section");
  section.className = "category-group";

  const heading = document.createElement("h3");
  heading.className = "category-heading";
  const text = document.createElement("span");
  text.textContent = t(categoryHeadingKey[category] || category);
  const count = document.createElement("span");
  count.className = "category-count";
  count.textContent = String(tools.length);
  heading.append(text, count);

  const grid = document.createElement("div");
  grid.className = "tool-grid";
  grid.append(...tools.map((tool) => createToolCard(tool, lang, onFavoriteChange)));

  section.append(heading, grid);
  return section;
}

function createHint(text) {
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = text;
  return hint;
}

export default function initHome() {
  const search = document.querySelector("#tool-search");
  const searchClear = document.querySelector("#tool-search-clear");
  const searchCount = document.querySelector("#tool-search-count");
  const chipHost = document.querySelector("#home-category-chips");
  const mount = document.querySelector("#tool-list");
  const favoriteList = document.querySelector("#favorite-tool-list");
  const recentList = document.querySelector("#recent-tool-list");
  const title = document.querySelector("#home-title");
  const subtitle = document.querySelector("#home-subtitle");
  const findTitle = document.querySelector("#home-find-title");
  const searchLabel = document.querySelector("#tool-search-label");
  const favoritesTitle = document.querySelector("#home-favorites-title");
  const recentTitle = document.querySelector("#home-recent-title");
  if (!search || !mount || !favoriteList || !recentList) {
    return;
  }

  let activeCategory = "all";

  const applyStaticText = () => {
    if (title) {
      title.textContent = t("home_title");
    }
    if (subtitle) {
      subtitle.textContent = t("home_subtitle");
    }
    if (findTitle) {
      findTitle.textContent = t("home_find");
    }
    if (searchLabel) {
      searchLabel.textContent = t("home_search_label");
    }
    search.placeholder = t("home_search_placeholder");
    if (searchClear) {
      searchClear.textContent = t("home_search_clear");
    }
    if (chipHost) {
      chipHost.setAttribute("aria-label", t("category_filter"));
    }
    if (favoritesTitle) {
      favoritesTitle.textContent = t("home_favorites");
    }
    if (recentTitle) {
      recentTitle.textContent = t("home_recent");
    }
  };

  const renderChips = () => {
    if (!chipHost) {
      return;
    }

    const chips = [
      { id: "all", label: t("home_filter_all") },
      ...categoryOrder.map((category) => ({ id: category, label: t(categoryLabelKey[category]) }))
    ];
    chipHost.replaceChildren(
      ...chips.map((chip) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = chip.id === activeCategory ? "chip is-active" : "chip";
        button.textContent = chip.label;
        button.addEventListener("click", () => {
          activeCategory = chip.id;
          renderAll();
        });
        return button;
      })
    );
  };

  const filterTools = () => {
    const normalized = search.value.trim().toLowerCase();
    return toolRegistry.filter((tool) => {
      if (activeCategory !== "all" && tool.category !== activeCategory) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        getToolDisplayName(tool, "en").toLowerCase().includes(normalized) ||
        getToolDisplayName(tool, "zh").toLowerCase().includes(normalized) ||
        tool.category.toLowerCase().includes(normalized) ||
        tool.keywords.join(" ").toLowerCase().includes(normalized)
      );
    });
  };

  const renderToolList = () => {
    const filtered = filterTools();
    if (searchCount) {
      searchCount.textContent = formatCopy("home_search_result", { count: filtered.length });
    }
    if (searchClear) {
      searchClear.style.visibility = search.value.trim() ? "visible" : "hidden";
    }

    if (!filtered.length) {
      mount.replaceChildren(createHint(t("home_no_match")));
      return;
    }

    const lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
    const grouped = filtered.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    }, {});

    const sections = [];
    categoryOrder.forEach((category) => {
      if (grouped[category]?.length) {
        sections.push(createCategoryRow(category, grouped[category], lang, renderAll));
      }
    });

    mount.replaceChildren(...sections);
  };

  const renderFavorites = () => {
    const paths = getFavoriteTools();
    const tools = paths.map((path) => getToolByPath(path)).filter((tool) => Boolean(tool));
    if (!tools.length) {
      favoriteList.replaceChildren(createHint(t("home_no_favorites")));
      return;
    }
    const lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
    favoriteList.replaceChildren(...tools.map((tool) => createToolCard(tool, lang, renderAll, true)));
  };

  const renderRecentCards = () => {
    const paths = getRecentTools();
    const tools = paths.map((path) => getToolByPath(path)).filter((tool) => Boolean(tool));
    if (!tools.length) {
      recentList.replaceChildren(createHint(t("home_recent_empty")));
      return;
    }
    const lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
    recentList.replaceChildren(...tools.map((tool) => createToolCard(tool, lang, renderAll, true)));
  };

  const renderAll = () => {
    renderChips();
    renderToolList();
    renderFavorites();
    renderRecentCards();
  };

  applyStaticText();
  renderAll();

  search.addEventListener("input", renderAll);
  searchClear?.addEventListener("click", () => {
    search.value = "";
    search.focus();
    renderAll();
  });
  onLanguageChange(() => {
    applyStaticText();
    renderAll();
  });
}





