import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/text_diff";
const SAMPLE_LEFT = "這是一段測試文字。\nHello, world!\n今天下雨了。";
const SAMPLE_RIGHT = "這是一段測試文字\nHello world!\n今天下雨了嗎？\n新增一行";
const MAX_DP_CELLS = 260000;
const EXTRA_PUNC = new Set(Array.from("！？｡。､、；：﹔﹕【】「」『』（）〔〕《》〈〉“”‘’—–…～〜·•"));

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    generated: "差異比對完成。",
    noDiff: "兩段內容一致（已依目前選項忽略標點/空白差異）。",
    diffTitle: "差異列表：",
    summary: "統計：修改 {change} 行／新增 {add} 行／缺少 {remove} 行",
    addLine: "+ 新 多出：新[第{line}行]\n  新: {text}",
    removeLine: "− 新 缺少：原[第{line}行]\n  原: {text}",
    changeLine: "↔ 內容不同：原[第{aLine}行] vs 新[第{bLine}行]\n  原: {aText}\n  新: {bText}",
    outputPlaceholder: "差異結果會顯示在這裡"
  },
  en: {
    invalid: "Invalid input format",
    generated: "Diff generated.",
    noDiff: "No differences (based on current ignore options).",
    diffTitle: "Differences:",
    summary: "Summary: changed {change} / added {add} / removed {remove}",
    addLine: "+ Added in new [line {line}]\n  New: {text}",
    removeLine: "− Missing in new [line {line}]\n  Old: {text}",
    changeLine: "↔ Changed: old [line {aLine}] vs new [line {bLine}]\n  Old: {aText}\n  New: {bText}",
    outputPlaceholder: "Diff result appears here"
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const template = copy[lang()][key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function isPunctuation(ch) {
  if (EXTRA_PUNC.has(ch)) {
    return true;
  }
  return /[\p{P}\p{S}]/u.test(ch);
}

function normalizeLine(value, options) {
  let text = String(value || "").replace(/\r/g, "");

  if (options.ignorePunc) {
    text = Array.from(text)
      .filter((ch) => !isPunctuation(ch))
      .join("");
  }

  if (options.ignoreSpace) {
    text = text.replace(/[\s\u3000]+/gu, "");
  }

  return text;
}

function normalizeWithMap(value, options) {
  const text = String(value || "").replace(/\r/g, "");
  const idxMap = [];
  const chars = [];
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (options.ignorePunc && isPunctuation(ch)) {
      continue;
    }
    if (options.ignoreSpace && /[\s\u3000]/u.test(ch)) {
      continue;
    }
    idxMap.push(index);
    chars.push(ch);
  }
  return { normalized: chars.join(""), idxMap };
}

function normSpanToOrigSpan(idxMap, sourceLength, i1, i2) {
  if (i1 === i2) {
    const at = i1 < idxMap.length ? idxMap[i1] : sourceLength;
    return [at, at];
  }
  const start = idxMap[i1];
  const end = idxMap[i2 - 1] + 1;
  return [start, end];
}

function mergeOpcodes(ops) {
  if (!ops.length) {
    return [];
  }
  const merged = [ops[0]];
  for (let index = 1; index < ops.length; index += 1) {
    const prev = merged[merged.length - 1];
    const curr = ops[index];
    if (prev.tag === curr.tag && prev.i2 === curr.i1 && prev.j2 === curr.j1) {
      prev.i2 = curr.i2;
      prev.j2 = curr.j2;
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

function coalesceReplace(ops) {
  const out = [];
  let index = 0;
  while (index < ops.length) {
    const current = ops[index];
    const next = ops[index + 1];
    if (current && next && current.tag === "delete" && next.tag === "insert" && current.i2 === next.i1 && current.j2 === next.j1) {
      out.push({
        tag: "replace",
        i1: current.i1,
        i2: current.i2,
        j1: next.j1,
        j2: next.j2
      });
      index += 2;
      continue;
    }
    if (current && next && current.tag === "insert" && next.tag === "delete" && current.i2 === next.i1 && current.j2 === next.j1) {
      out.push({
        tag: "replace",
        i1: next.i1,
        i2: next.i2,
        j1: current.j1,
        j2: current.j2
      });
      index += 2;
      continue;
    }
    out.push(current);
    index += 1;
  }
  return mergeOpcodes(out);
}

function fallbackOpcodes(a, b) {
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ops.push({ tag: "equal", i1: i, i2: i + 1, j1: j, j2: j + 1 });
      } else {
        ops.push({ tag: "replace", i1: i, i2: i + 1, j1: j, j2: j + 1 });
      }
      i += 1;
      j += 1;
      continue;
    }
    if (i < a.length) {
      ops.push({ tag: "delete", i1: i, i2: i + 1, j1: j, j2: j });
      i += 1;
      continue;
    }
    ops.push({ tag: "insert", i1: i, i2: i, j1: j, j2: j + 1 });
    j += 1;
  }
  return mergeOpcodes(ops);
}

function computeOpcodes(a, b) {
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_DP_CELLS) {
    return fallbackOpcodes(a, b);
  }

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ tag: "equal", i1: i, i2: i + 1, j1: j, j2: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ tag: "delete", i1: i, i2: i + 1, j1: j, j2: j });
      i += 1;
    } else {
      ops.push({ tag: "insert", i1: i, i2: i, j1: j, j2: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ tag: "delete", i1: i, i2: i + 1, j1: j, j2: j });
    i += 1;
  }
  while (j < m) {
    ops.push({ tag: "insert", i1: i, i2: i, j1: j, j2: j + 1 });
    j += 1;
  }

  return coalesceReplace(mergeOpcodes(ops));
}

function renderSide(source, idxMap, opcodes, which) {
  const text = String(source || "").replace(/\r/g, "");
  const output = [];
  let prevEnd = 0;

  opcodes.forEach((op) => {
    const isLeft = which === "a";
    const n1 = isLeft ? op.i1 : op.j1;
    const n2 = isLeft ? op.i2 : op.j2;
    const highlight = isLeft
      ? op.tag === "replace" || op.tag === "delete"
      : op.tag === "replace" || op.tag === "insert";

    const [segStart, segEnd] = normSpanToOrigSpan(idxMap, text.length, n1, n2);
    if (segStart > prevEnd) {
      output.push(text.slice(prevEnd, segStart));
    }

    const segment = text.slice(segStart, segEnd);
    if (highlight && segEnd > segStart) {
      output.push(`〔${segment}〕`);
    } else {
      output.push(segment);
    }
    prevEnd = segEnd;
  });

  if (prevEnd < text.length) {
    output.push(text.slice(prevEnd));
  }

  return output.join("");
}

function isSingleEnglishToken(raw) {
  const trimmed = String(raw || "").trim();
  const core = trimmed.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
  return /^[A-Za-z0-9_-]+$/u.test(core);
}

function shouldHighlightWholeWord(aText, bText, options) {
  const aNorm = normalizeLine(aText, options);
  const bNorm = normalizeLine(bText, options);
  if (!aNorm || !bNorm || aNorm === bNorm) {
    return false;
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(aNorm) || !/^[A-Za-z0-9_-]+$/u.test(bNorm)) {
    return false;
  }
  return isSingleEnglishToken(aText) && isSingleEnglishToken(bText);
}

function highlightDiffKeepPunc(aText, bText, options) {
  if (shouldHighlightWholeWord(aText, bText, options)) {
    return {
      a: `〔${String(aText || "").trim()}〕`,
      b: `〔${String(bText || "").trim()}〕`
    };
  }

  const aNorm = normalizeWithMap(aText, options);
  const bNorm = normalizeWithMap(bText, options);
  const opcodes = computeOpcodes(Array.from(aNorm.normalized), Array.from(bNorm.normalized));
  return {
    a: renderSide(aText, aNorm.idxMap, opcodes, "a"),
    b: renderSide(bText, bNorm.idxMap, opcodes, "b")
  };
}

function parseLines(text, options) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const result = [];
  lines.forEach((line, index) => {
    const display = line;
    const key = normalizeLine(line, options);
    const shouldSkip = options.ignoreEmpty && key === "";
    if (!shouldSkip) {
      result.push({ lineNumber: index + 1, display, key });
    }
  });
  return result;
}

function compareText(leftText, rightText, options) {
  const leftLines = parseLines(leftText, options);
  const rightLines = parseLines(rightText, options);
  const leftKeys = leftLines.map((item) => item.key);
  const rightKeys = rightLines.map((item) => item.key);
  const opcodes = computeOpcodes(leftKeys, rightKeys);

  const diffs = [];
  const stats = { add: 0, remove: 0, change: 0 };

  opcodes.forEach((op) => {
    if (op.tag === "equal") {
      return;
    }

    if (op.tag === "delete") {
      for (let i = op.i1; i < op.i2; i += 1) {
        const line = leftLines[i];
        stats.remove += 1;
        diffs.push(t("removeLine", { line: line.lineNumber, text: line.display }));
      }
      return;
    }

    if (op.tag === "insert") {
      for (let j = op.j1; j < op.j2; j += 1) {
        const line = rightLines[j];
        stats.add += 1;
        diffs.push(t("addLine", { line: line.lineNumber, text: line.display }));
      }
      return;
    }

    if (op.tag === "replace") {
      const leftCount = op.i2 - op.i1;
      const rightCount = op.j2 - op.j1;
      const pairCount = Math.max(leftCount, rightCount);

      for (let offset = 0; offset < pairCount; offset += 1) {
        const leftLine = leftLines[op.i1 + offset] || null;
        const rightLine = rightLines[op.j1 + offset] || null;
        const leftKey = leftLine?.key || "";
        const rightKey = rightLine?.key || "";

        if (leftKey === "" && rightKey !== "") {
          stats.add += 1;
          diffs.push(t("addLine", { line: rightLine.lineNumber, text: rightLine.display }));
          continue;
        }

        if (rightKey === "" && leftKey !== "") {
          stats.remove += 1;
          diffs.push(t("removeLine", { line: leftLine.lineNumber, text: leftLine.display }));
          continue;
        }

        if (leftKey === "" && rightKey === "") {
          continue;
        }

        stats.change += 1;
        const mark = highlightDiffKeepPunc(leftLine.display, rightLine.display, options);
        diffs.push(
          t("changeLine", {
            aLine: leftLine.lineNumber,
            bLine: rightLine.lineNumber,
            aText: mark.a,
            bText: mark.b
          })
        );
      }
    }
  });

  return { diffs, stats };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function highlightInline(text) {
  return escapeHtml(text).replace(/〔([^〕]+)〕/gu, '<span class="diff-inline">〔$1〕</span>');
}

function getLineClass(line) {
  if (/^\+\s/u.test(line)) {
    return "diff-line-add";
  }
  if (/^[−-]\s/u.test(line)) {
    return "diff-line-remove";
  }
  if (/^↔\s/u.test(line)) {
    return "diff-line-change";
  }
  if (/^(統計：|Summary:)/u.test(line)) {
    return "diff-line-summary";
  }
  if (/^(差異列表：|Differences:)/u.test(line)) {
    return "diff-line-title";
  }
  return "";
}

function renderResultHtml(host, plainText) {
  if (!plainText) {
    host.innerHTML = `<div class="diff-line diff-line-empty">${escapeHtml(t("outputPlaceholder"))}</div>`;
    return;
  }

  const lines = plainText.split("\n");
  host.innerHTML = lines
    .map((line) => {
      if (!line.trim()) {
        return '<div class="diff-gap" aria-hidden="true"></div>';
      }
      const className = getLineClass(line);
      return `<div class="diff-line ${className}">${highlightInline(line)}</div>`;
    })
    .join("");
}

export default function initTextDiff() {
  const leftInput = document.querySelector("#diff-left");
  const rightInput = document.querySelector("#diff-right");
  const output = document.querySelector("#diff-output");
  const compareBtn = document.querySelector("#diff-compare-btn");
  const swapBtn = document.querySelector("#diff-swap-btn");
  const sampleBtn = document.querySelector("#diff-sample-btn");
  const clearBtn = document.querySelector("#diff-clear-btn");
  const copyBtn = document.querySelector("#diff-copy-btn");
  const ignorePuncInput = document.querySelector("#diff-ignore-punc");
  const ignoreSpaceInput = document.querySelector("#diff-ignore-space");
  const ignoreEmptyInput = document.querySelector("#diff-ignore-empty");

  if (!leftInput || !rightInput || !output || !ignorePuncInput || !ignoreSpaceInput || !ignoreEmptyInput) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 文字差異比對",
      en: "ToolNestTW Text Diff Checker"
    },
    text: {
      ".hero h1": { zh: "文字差異比對", en: "Text Diff Checker" },
      ".hero .lead": {
        zh: "逐行比較兩段文字，支援忽略標點/空白並標示行內差異。",
        en: "Compare texts line-by-line with ignore rules and inline highlights."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="diff-left"]': { zh: "原始文字", en: "Original text" },
      'label[for="diff-right"]': { zh: "更新文字", en: "Updated text" },
      "#diff-option-label": { zh: "比對選項", en: "Comparison options" },
      "#diff-ignore-punc-text": { zh: "忽略標點", en: "Ignore punctuation" },
      "#diff-ignore-space-text": { zh: "忽略空白", en: "Ignore whitespace" },
      "#diff-ignore-empty-text": { zh: "忽略空行", en: "Ignore empty lines" },
      'label[for="diff-output"]': { zh: "差異結果", en: "Diff result" },
      "#diff-compare-btn": { zh: "開始比對", en: "Compare" },
      "#diff-swap-btn": { zh: "交換原 / 新", en: "Swap Old / New" },
      "#diff-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#diff-clear-btn": { zh: "清除", en: "Clear" },
      "#diff-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上原始與更新文字。",
        en: "1. Paste original and updated text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 設定是否忽略標點、空白、空行。",
        en: "2. Configure ignore punctuation/space/empty-lines options."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 點擊開始比對並查看 〔〕標記差異。",
        en: "3. Click Compare and inspect 〔〕 inline markers."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "結果看起來太多？ 可先勾選忽略標點與空白。",
        en: "Too many differences? Enable ignore punctuation and whitespace."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "是否上傳文字？ 不會，運算在本機瀏覽器完成。",
        en: "Is text uploaded? No, processing is local in browser."
      }
    },
    placeholder: {
      "#diff-left": { zh: "貼上原始版本文字", en: "Paste original version text" },
      "#diff-right": { zh: "貼上更新版本文字", en: "Paste updated version text" }
    }
  });

  leftInput.value = loadRecentInput(`${TOOL_PATH}:left`);
  rightInput.value = loadRecentInput(`${TOOL_PATH}:right`);

  let lastPlainOutput = "";

  bindCopyButton(copyBtn, () => lastPlainOutput);

  const store = () => {
    saveRecentInput(`${TOOL_PATH}:left`, leftInput.value);
    saveRecentInput(`${TOOL_PATH}:right`, rightInput.value);
  };

  const setOutput = (plainText) => {
    lastPlainOutput = plainText;
    renderResultHtml(output, plainText);
  };

  const compare = (withToast = true) => {
    const left = leftInput.value;
    const right = rightInput.value;
    if (!left && !right) {
      if (withToast) {
        toast(t("invalid"));
      }
      setOutput("");
      return;
    }

    const options = {
      ignorePunc: ignorePuncInput.checked,
      ignoreSpace: ignoreSpaceInput.checked,
      ignoreEmpty: ignoreEmptyInput.checked
    };

    const result = compareText(left, right, options);
    if (!result.diffs.length) {
      setOutput(t("noDiff"));
      if (withToast) {
        toast(t("generated"), "success");
      }
      store();
      return;
    }

    const plainResult = [t("diffTitle"), t("summary", result.stats), "", result.diffs.join("\n\n")].join("\n");
    setOutput(plainResult);
    if (withToast) {
      toast(t("generated"), "success");
    }
    store();
  };

  compareBtn?.addEventListener("click", () => compare(true));

  swapBtn?.addEventListener("click", () => {
    const left = leftInput.value;
    leftInput.value = rightInput.value;
    rightInput.value = left;
    setOutput("");
    store();
  });

  sampleBtn?.addEventListener("click", () => {
    leftInput.value = SAMPLE_LEFT;
    rightInput.value = SAMPLE_RIGHT;
    setOutput("");
    store();
  });

  clearBtn?.addEventListener("click", () => {
    leftInput.value = "";
    rightInput.value = "";
    setOutput("");
    clearRecentInput(`${TOOL_PATH}:left`);
    clearRecentInput(`${TOOL_PATH}:right`);
  });

  leftInput.addEventListener("input", store);
  rightInput.addEventListener("input", store);
  ignorePuncInput.addEventListener("change", () => compare(false));
  ignoreSpaceInput.addEventListener("change", () => compare(false));
  ignoreEmptyInput.addEventListener("change", () => compare(false));
  onLanguageChange(() => compare(false));

  setOutput("");
}




