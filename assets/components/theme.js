import { onLanguageChange, t } from "/assets/js/i18n.js?v=1.6.26";

const STORAGE_KEY = "ToolNestTW:theme";

function getInitialTheme() {
  const persisted = localStorage.getItem(STORAGE_KEY);
  if (persisted === "dark" || persisted === "light") {
    return persisted;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateButtonText(button, theme) {
  if (!button) {
    return;
  }
  button.textContent = theme === "dark" ? t("theme_light") : t("theme_dark");
  button.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
}

export function initTheme(button) {
  const applyTheme = (theme) => {
    document.body.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    updateButtonText(button, theme);
  };

  applyTheme(getInitialTheme());

  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  onLanguageChange(() => {
    updateButtonText(button, document.body.dataset.theme || "light");
  });
}









