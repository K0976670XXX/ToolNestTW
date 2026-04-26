import {
  getRelatedTools,
  getToolByPath,
  getToolDisplayName,
  toolRegistry
} from "/assets/js/tools.registry.js?v=1.6.33";
import { getRecentTools, rememberRecentTool } from "/assets/js/utils.js?v=1.6.26";
import { initTheme } from "/assets/components/theme.js?v=1.6.26";
import { getLanguage, initLanguageToggle, onLanguageChange, t } from "/assets/js/i18n.js?v=1.6.26";

function createLink(href, text) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = text;
  return anchor;
}

function mountHeader(host) {
  if (!host) {
    return null;
  }

  const header = document.createElement("header");
  header.className = "site-header";

  const topbar = document.createElement("div");
  topbar.className = "topbar";

  const brand = createLink("/", "");
  brand.className = "brand";
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.setAttribute("aria-hidden", "true");
  const brandText = document.createElement("span");
  brandText.className = "brand-text";
  brand.append(mark, brandText);

  const nav = document.createElement("nav");
  nav.className = "top-nav";

  const textLink = createLink("/text", "");
  const devLink = createLink("/dev", "");
  const imageLink = createLink("/image", "");
  const dataLink = createLink("/data", "");
  const utilityLink = createLink("/utility", "");
  const convertLink = createLink("/convert", "");
  nav.append(textLink, imageLink, dataLink, devLink, utilityLink, convertLink);

  const languageToggle = document.createElement("button");
  languageToggle.type = "button";
  languageToggle.className = "btn lang-toggle";
  languageToggle.setAttribute("aria-label", t("lang_label"));
  nav.append(languageToggle);

  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "btn btn-theme";
  nav.append(themeButton);

  const applyHeaderLanguage = () => {
    brandText.textContent = t("brand");
    textLink.textContent = t("nav_text");
    devLink.textContent = t("nav_dev");
    imageLink.textContent = t("nav_image");
    dataLink.textContent = t("nav_data");
    utilityLink.textContent = t("nav_utility");
    convertLink.textContent = t("nav_convert");
    languageToggle.setAttribute("aria-label", t("lang_label"));
  };

  applyHeaderLanguage();
  onLanguageChange(applyHeaderLanguage);

  topbar.append(brand, nav);
  header.append(topbar);
  host.replaceChildren(header);
  return { themeButton, languageToggle };
}

function mountFooter(host) {
  if (!host) {
    return;
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";

  const inner = document.createElement("div");
  inner.className = "footer-inner";
  const year = new Date().getFullYear();
  inner.textContent = `${t("footer")} • ${year} • ${t("footer_tail")}`;

  footer.append(inner);
  host.replaceChildren(footer);

  onLanguageChange(() => {
    inner.textContent = `${t("footer")} • ${year} • ${t("footer_tail")}`;
  });
}

function renderLinks(host, links) {
  if (!host) {
    return;
  }

  host.replaceChildren();
  const lang = getLanguage();
  links.forEach((tool) => {
    const li = document.createElement("li");
    li.append(createLink(tool.path, getToolDisplayName(tool, lang)));
    host.append(li);
  });
}

export default function initLayout() {
  const headerState = mountHeader(document.querySelector('[data-layout="header"]'));
  mountFooter(document.querySelector('[data-layout="footer"]'));
  if (!headerState) {
    return;
  }
  initLanguageToggle(headerState.languageToggle);
  initTheme(headerState.themeButton);

  const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
  rememberRecentTool(currentPath);

  const renderDynamicToolLists = () => {
    document.querySelectorAll('[data-layout="recommended"]').forEach((host) => {
      renderLinks(host, getRelatedTools(currentPath, 3));
    });

    const recentHost = document.querySelector('[data-layout="recent-tools"]');
    if (recentHost) {
      const recentPaths = getRecentTools();
      const recentTools = recentPaths
        .map((path) => getToolByPath(path))
        .filter((tool) => Boolean(tool));
      renderLinks(recentHost, recentTools.length ? recentTools : toolRegistry.slice(0, 4));
    }
  };

  renderDynamicToolLists();
  onLanguageChange(renderDynamicToolLists);
}









