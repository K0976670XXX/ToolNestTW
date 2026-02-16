import { onLanguageChange, t } from "/assets/js/i18n.js?v=1.6.26";
import {
  getToolDisplayName,
  getToolSummary,
  toolRegistry
} from "/assets/js/tools.registry.js?v=1.6.26";
import { isFavoriteTool, toggleFavoriteTool } from "/assets/js/utils.js?v=1.6.26";

const categoryMeta = {
  text: { titleKey: "category_text_title", descKey: "category_text_desc" },
  dev: { titleKey: "category_dev_title", descKey: "category_dev_desc" },
  image: { titleKey: "category_image_title", descKey: "category_image_desc" },
  data: { titleKey: "category_data_title", descKey: "category_data_desc" },
  calc: { titleKey: "category_calc_title", descKey: "category_calc_desc" },
  utility: { titleKey: "category_utility_title", descKey: "category_utility_desc" },
  convert: { titleKey: "category_convert_title", descKey: "category_convert_desc" }
};

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

function createToolCard(tool, lang, onFavoriteChange) {
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

  const description = document.createElement("p");
  description.textContent = getToolSummary(tool, lang) || (lang === "zh" ? "工具簡介" : "Tool overview");

  head.append(title, createFavoriteButton(tool, onFavoriteChange));
  article.append(head, description);
  return article;
}

export default function initCategoryPage() {
  const category = document.body.dataset.category;
  if (!category) {
    return;
  }

  const heading = document.querySelector("#category-title");
  const subtitle = document.querySelector("#category-description");
  const list = document.querySelector("#category-tool-list");
  const search = document.querySelector("#category-search");
  const filterTitle = document.querySelector("#category-filter-title");
  const filterLabel = document.querySelector("#category-search-label");

  if (!heading || !subtitle || !list || !search || !filterTitle || !filterLabel) {
    return;
  }

  const allTools = toolRegistry.filter((tool) => tool.category === category);
  const applyStaticText = () => {
    const meta = categoryMeta[category];
    if (meta) {
      heading.textContent = t(meta.titleKey);
      subtitle.textContent = t(meta.descKey);
    }
    filterTitle.textContent = t("category_filter");
    filterLabel.textContent = t("category_search_label");
    search.placeholder = t("home_search_placeholder");
  };

  const render = (query = "") => {
    const lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
    const normalized = query.trim().toLowerCase();
    const filtered = allTools.filter((tool) => {
      if (!normalized) {
        return true;
      }
      return (
        getToolDisplayName(tool, "en").toLowerCase().includes(normalized) ||
        getToolDisplayName(tool, "zh").toLowerCase().includes(normalized) ||
        tool.keywords.join(" ").toLowerCase().includes(normalized)
      );
    });

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = t("category_no_match");
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...filtered.map((tool) => createToolCard(tool, lang, () => render(search.value))));
  };

  applyStaticText();
  render();
  search.addEventListener("input", () => render(search.value));
  onLanguageChange(() => {
    applyStaticText();
    render(search.value);
  });
}





