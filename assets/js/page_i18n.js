import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";

function pick(copy, lang) {
  if (!copy) {
    return "";
  }
  return copy[lang] || copy.en || "";
}

function applyMap(map, lang, setter) {
  if (!map) {
    return;
  }

  Object.entries(map).forEach(([selector, value]) => {
    resolveNodes(selector).forEach((node) => {
      setter(node, pick(value, lang));
    });
  });
}

function resolveNodes(selector) {
  const panelSelectorPattern =
    /^\.tool-page > \.panel:nth-of-type\((\d+)\)(?:\s+(.*))?$/;
  const match = selector.match(panelSelectorPattern);

  if (!match) {
    return Array.from(document.querySelectorAll(selector));
  }

  const panelIndex = Number(match[1]) - 1;
  const subSelector = (match[2] || "").trim();
  const panels = Array.from(document.querySelectorAll(".tool-page > .panel"));
  const panel = panels[panelIndex];

  if (!panel) {
    return [];
  }

  if (!subSelector) {
    return [panel];
  }

  return Array.from(panel.querySelectorAll(subSelector));
}

export function bindPageI18n(config) {
  const apply = () => {
    const lang = getLanguage();

    if (config.title) {
      document.title = pick(config.title, lang);
    }

    applyMap(config.text, lang, (node, value) => {
      node.textContent = value;
    });

    applyMap(config.placeholder, lang, (node, value) => {
      node.setAttribute("placeholder", value);
    });
  };

  apply();
  onLanguageChange(apply);
}







