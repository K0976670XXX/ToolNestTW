import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, escapeHTML, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/data/sql_formatter";
const SAMPLE_SQL =
  "select u.id,u.name,r.role_name from users u left join user_roles ur on ur.user_id=u.id left join roles r on r.id=ur.role_id where u.active=1 and (u.country='TW' or u.country='US') order by u.created_at desc";

const copy = {
  zh: {
    invalidInput: "輸入格式錯誤",
    formatted: "SQL 已格式化。",
    emptyOutput: "尚未產生格式化結果。"
  },
  en: {
    invalidInput: "Invalid input format",
    formatted: "SQL formatted.",
    emptyOutput: "No formatted SQL yet."
  }
};

const KEYWORD_RULES = [
  "LEFT OUTER JOIN",
  "RIGHT OUTER JOIN",
  "FULL OUTER JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "INSERT INTO",
  "DELETE FROM",
  "UNION ALL",
  "GROUP BY",
  "ORDER BY",
  "SELECT",
  "FROM",
  "WHERE",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "VALUES",
  "UPDATE",
  "SET",
  "JOIN",
  "ON",
  "UNION"
];

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key) {
  return copy[lang()]?.[key] || copy.en[key] || key;
}

function protectSegments(text) {
  const segments = [];
  const safeText = String(text || "").replace(
    /('(?:''|[^'])*'|"(?:[^"\\]|\\.)*"|`(?:``|[^`])*`|--[^\n]*|\/\*[\s\S]*?\*\/)/g,
    (match) => {
      const token = `__SQL_SEG_${segments.length}__`;
      const isComment = match.startsWith("--") || match.startsWith("/*");
      segments.push({
        type: isComment ? "comment" : "string",
        text: match
      });
      return token;
    }
  );
  return { safeText, segments };
}

function restoreSegments(text, segments) {
  return String(text || "").replace(/__SQL_SEG_(\d+)__/g, (full, indexText) => {
    const index = Number(indexText);
    return Number.isInteger(index) ? segments[index]?.text || full : full;
  });
}

function highlightChunk(chunk) {
  if (!chunk) {
    return "";
  }

  const keywordPattern = KEYWORD_RULES
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((keyword) => keyword.replace(/\s+/g, "\\s+"))
    .join("|");

  return chunk
    .replace(/(^|[^\w.])(-?\d+(?:\.\d+)?)(?=$|[^\w.])/g, '$1<span class="sql-token sql-number">$2</span>')
    .replace(new RegExp(`\\b(${keywordPattern})\\b`, "gi"), (match) => {
      return `<span class="sql-token sql-keyword">${match.toUpperCase()}</span>`;
    })
    .replace(/([(),;])/g, '<span class="sql-token sql-punc">$1</span>');
}

function highlightSql(text) {
  const { safeText, segments } = protectSegments(text);
  const tokenRegex = /__SQL_SEG_(\d+)__/g;
  let result = "";
  let lastIndex = 0;
  let match = tokenRegex.exec(safeText);

  while (match) {
    const index = Number(match[1]);
    const rawChunk = safeText.slice(lastIndex, match.index);
    result += highlightChunk(escapeHTML(rawChunk));

    const segment = segments[index];
    if (segment) {
      const className = segment.type === "comment" ? "sql-comment" : "sql-string";
      result += `<span class="sql-token ${className}">${escapeHTML(segment.text)}</span>`;
    }

    lastIndex = match.index + match[0].length;
    match = tokenRegex.exec(safeText);
  }

  result += highlightChunk(escapeHTML(safeText.slice(lastIndex)));
  return result;
}

function breakBeforeKeyword(text, keyword) {
  const pattern = keyword.split(" ").join("\\s+");
  const regex = new RegExp(`\\b${pattern}\\b`, "gi");
  return text.replace(regex, (match, offset, full) => {
    const prefix = offset > 0 && full[offset - 1] !== "\n" ? "\n" : "";
    return `${prefix}${keyword}`;
  });
}

function countChars(text, char) {
  const matched = String(text || "").match(new RegExp(`\\${char}`, "g"));
  return matched ? matched.length : 0;
}

function formatSql(input) {
  const source = String(input || "").replace(/\r/g, "\n").trim();
  if (!source) {
    return "";
  }

  const { safeText, segments } = protectSegments(source);
  let formatted = safeText.replace(/\s+/g, " ").trim();

  KEYWORD_RULES.forEach((keyword) => {
    formatted = breakBeforeKeyword(formatted, keyword);
  });

  formatted = formatted
    .replace(/\s+\b(AND|OR)\b\s+/gi, "\n  $1 ")
    .replace(/\s+\b(WHEN|ELSE)\b\s+/gi, "\n  $1 ")
    .replace(/\s+,\s*/g, ",\n  ");

  const lines = formatted
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const output = [];
  let indent = 0;

  lines.forEach((line) => {
    const upper = line.toUpperCase();
    const startsWithCloseParen = /^\)/.test(line);
    if (startsWithCloseParen) {
      indent = Math.max(0, indent - 1);
    }

    const softIndent =
      /^(AND|OR|ON|WHEN|ELSE)\b/.test(upper) && indent > 0 ? indent + 1 : indent;
    output.push(`${"  ".repeat(softIndent)}${line}`);

    if (/^END\b/.test(upper)) {
      indent = Math.max(0, indent - 1);
    }
    if (/^CASE\b/.test(upper)) {
      indent += 1;
    }

    const openCount = countChars(line, "(");
    const closeCount = countChars(line, ")");
    if (openCount > closeCount) {
      indent += openCount - closeCount;
    } else if (closeCount > openCount && !startsWithCloseParen) {
      indent = Math.max(0, indent - (closeCount - openCount));
    }
  });

  return restoreSegments(output.join("\n"), segments);
}

export default function initSqlFormatter() {
  const input = document.querySelector("#sqlf-input");
  const output = document.querySelector("#sqlf-output");
  const highlight = document.querySelector("#sqlf-highlight");
  const formatBtn = document.querySelector("#sqlf-format-btn");
  const sampleBtn = document.querySelector("#sqlf-sample-btn");
  const clearBtn = document.querySelector("#sqlf-clear-btn");
  const copyBtn = document.querySelector("#sqlf-copy-btn");

  if (!input || !output || !highlight) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW SQL Formatter",
      en: "ToolNestTW SQL Formatter"
    },
    text: {
      ".hero h1": { zh: "SQL Formatter", en: "SQL Formatter" },
      ".hero .lead": {
        zh: "將 SQL 指令整理成較易閱讀的排版，方便檢查與分享。",
        en: "Format SQL into a cleaner and more readable layout."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="sqlf-input"]': { zh: "SQL 內容", en: "SQL input" },
      'label[for="sqlf-highlight"]': { zh: "格式化結果（高亮）", en: "Highlighted SQL output" },
      "#sqlf-format-btn": { zh: "格式化 SQL", en: "Format SQL" },
      "#sqlf-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#sqlf-clear-btn": { zh: "清除", en: "Clear" },
      "#sqlf-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上 SQL 內容。",
        en: "1. Paste SQL input."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊格式化 SQL。",
        en: "2. Click Format SQL."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 檢查結果後複製輸出。",
        en: "3. Review the output and copy it."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會改變 SQL 語意嗎？ 不會，僅調整排版與關鍵字外觀。",
        en: "Will SQL meaning change? No, only formatting style is adjusted."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "會上傳資料嗎？ 不會，全部在瀏覽器本機處理。",
        en: "Is input uploaded? No, all processing is local in browser."
      }
    },
    placeholder: {
      "#sqlf-input": {
        zh: "例如：select id,name from users where active=1",
        en: "Example: select id,name from users where active=1"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const saveInput = () => {
    saveRecentInput(TOOL_PATH, input.value);
  };

  const renderOutput = (formattedSql) => {
    output.value = formattedSql || "";
    if (!formattedSql) {
      highlight.textContent = t("emptyOutput");
      return;
    }
    highlight.innerHTML = highlightSql(formattedSql);
  };

  formatBtn?.addEventListener("click", () => {
    if (!input.value.trim()) {
      toast(t("invalidInput"));
      return;
    }
    renderOutput(formatSql(input.value));
    toast(t("formatted"), "success");
    saveInput();
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_SQL;
    renderOutput("");
    saveInput();
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    renderOutput("");
    clearRecentInput(TOOL_PATH);
  });

  input.addEventListener("input", saveInput);
  onLanguageChange(() => {
    renderOutput(output.value);
  });

  renderOutput("");
}
