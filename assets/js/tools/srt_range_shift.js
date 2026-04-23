import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/data/srt_range_shift";
const SRT_TIME_LINE_RE =
  /^(?<start>\d{2,}:\d{2}:\d{2},\d{3})\s+-->\s+(?<end>\d{2,}:\d{2}:\d{2},\d{3})(?<suffix>(?:\s+.*)?)$/u;
const SAMPLE_SETTINGS = {
  startRange: "00:03:10,000",
  endRange: "00:04:04,000"
};
const SAMPLE_NAME = "sample.srt";
const SAMPLE_SRT = `1
00:03:05,000 --> 00:03:07,500
這一段會被區間篩掉。

2
00:03:12,200 --> 00:03:15,600
這一段會被保留。

3
00:03:39,500 --> 00:03:42,000
工具會用起始範圍自動換算新的時間。

4
00:04:02,800 --> 00:04:04,000
這一段剛好落在區間尾端。

5
00:04:08,000 --> 00:04:10,500
這一段也會被略過。`;

const copy = {
  zh: {
    invalidInput: "請先提供 SRT 內容。",
    invalidTime: "時間格式錯誤，支援 3:10、1:3:10、00:03:10,000。",
    invalidRangeOrder: "結束範圍必須大於或等於起始範圍。",
    processed: "SRT 已處理完成。",
    fileLoaded: "SRT 檔案已載入。",
    fileReadError: "無法讀取檔案。",
    idleStatus: "尚未產生結果。",
    emptyResult: "指定區間內沒有符合的字幕區塊。",
    sourceName: "目前來源：{name}",
    sourceNameEmpty: "目前尚未選擇檔案，可直接貼上內容。",
    downloadName: "輸出檔名：{name}",
    downloadNameEmpty: "處理後可下載新的 SRT 檔案。",
    shiftHint: "支援 3:10、1:3:10、00:03:10,000，並依起始範圍自動換算平移量。",
    shiftAuto: "將自動提前 {timecode}，讓起始範圍對齊到 00:00:00,000。",
    statusReady: "已輸出 {kept} / {total} 個字幕區塊，區間外略過 {skipped} 個。",
    statusNoMatch: "共掃描 {total} 個字幕區塊，但指定區間內沒有符合內容。",
    statusInvalidSuffix: "另有 {invalid} 個區塊因時間格式異常被略過。"
  },
  en: {
    invalidInput: "Please provide SRT content first.",
    invalidTime: "Invalid time format. Supported: 3:10, 1:3:10, 00:03:10,000.",
    invalidRangeOrder: "End range must be greater than or equal to start range.",
    processed: "SRT processed.",
    fileLoaded: "SRT file loaded.",
    fileReadError: "Cannot read file.",
    idleStatus: "No result yet.",
    emptyResult: "No subtitle cues matched the selected range.",
    sourceName: "Current source: {name}",
    sourceNameEmpty: "No file selected yet. You can also paste SRT content directly.",
    downloadName: "Output filename: {name}",
    downloadNameEmpty: "Process the file to download a new SRT.",
    shiftHint: "Supports 3:10, 1:3:10, 00:03:10,000 and auto-calculates shift from the start range.",
    shiftAuto: "The tool will move cues earlier by {timecode} so the selected start becomes 00:00:00,000.",
    statusReady: "Exported {kept} of {total} cues. Skipped {skipped} outside the range.",
    statusNoMatch: "Scanned {total} cues, but none matched the selected range.",
    statusInvalidSuffix: "Skipped another {invalid} cues because of invalid time format."
  }
};

function lang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const template = copy[lang()]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function getDefaultSettings() {
  return { ...SAMPLE_SETTINGS };
}

function loadSettings() {
  try {
    const raw = loadRecentInput(TOOL_PATH);
    if (!raw) {
      return getDefaultSettings();
    }
    const parsed = JSON.parse(raw);
    return {
      startRange: parsed?.startRange || SAMPLE_SETTINGS.startRange,
      endRange: parsed?.endRange || SAMPLE_SETTINGS.endRange
    };
  } catch {
    return getDefaultSettings();
  }
}

function saveSettings(startRange, endRange) {
  saveRecentInput(
    TOOL_PATH,
    JSON.stringify({
      startRange: String(startRange || ""),
      endRange: String(endRange || "")
    })
  );
}

function parseTimecode(value) {
  const normalized = String(value || "")
    .trim()
    .replaceAll("：", ":")
    .replaceAll("，", ",");

  if (!normalized) {
    throw new Error("INVALID_TIMECODE");
  }

  const fractionMatch = normalized.match(/[,.](\d{1,3})$/u);
  const fractionDigits = fractionMatch ? fractionMatch[1] : "";
  const mainPart = fractionMatch ? normalized.slice(0, fractionMatch.index) : normalized;
  const segments = mainPart.split(":").map((item) => item.trim());

  if (
    segments.length < 2 ||
    segments.length > 3 ||
    segments.some((item) => !/^\d+$/u.test(item))
  ) {
    throw new Error("INVALID_TIMECODE");
  }

  const ms = fractionDigits ? Number(fractionDigits.padEnd(3, "0")) : 0;

  if (segments.length === 2) {
    const minutes = Number(segments[0]);
    const seconds = Number(segments[1]);

    if (seconds >= 60) {
      throw new Error("INVALID_TIMECODE");
    }

    return minutes * 60000 + seconds * 1000 + ms;
  }

  const hours = Number(segments[0]);
  const minutes = Number(segments[1]);
  const seconds = Number(segments[2]);

  if (minutes >= 60 || seconds >= 60) {
    throw new Error("INVALID_TIMECODE");
  }

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}

function formatTimecode(ms) {
  const safeMs = Math.max(0, Math.round(Number(ms) || 0));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const milliseconds = safeMs % 1000;
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":") + `,${String(milliseconds).padStart(3, "0")}`;
}

function describeAutoShift(startRangeValue) {
  const raw = String(startRangeValue || "").trim();
  if (!raw) {
    return t("shiftHint");
  }

  try {
    const startRangeMs = parseTimecode(raw);
    return t("shiftAuto", { timecode: formatTimecode(startRangeMs) });
  } catch {
    return t("invalidTime");
  }
}

function normalizeSrtSource(text) {
  return String(text || "").replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
}

function makeOutputFilename(sourceName) {
  const raw = String(sourceName || "").trim();
  const base = raw ? raw.replace(/\.[^.]+$/u, "") : "output";
  return `${base}_range_shifted.srt`;
}

function processSrt(source, startRangeMs, endRangeMs, shiftMs) {
  const normalized = normalizeSrtSource(source).trim();
  const blocks = normalized ? normalized.split(/\n{2,}/u) : [];
  const outputBlocks = [];
  let keptCount = 0;
  let skippedRangeCount = 0;
  let invalidCount = 0;

  blocks.forEach((block) => {
    const lines = block.split("\n");
    const timeLineIndex = lines.findIndex((line) => SRT_TIME_LINE_RE.test(line.trim()));

    if (timeLineIndex < 0) {
      invalidCount += 1;
      return;
    }

    const timeLine = lines[timeLineIndex].trim();
    const match = timeLine.match(SRT_TIME_LINE_RE);
    if (!match?.groups) {
      invalidCount += 1;
      return;
    }

    try {
      const startMs = parseTimecode(match.groups.start);
      const endMs = parseTimecode(match.groups.end);

      if (endMs < startRangeMs || startMs > endRangeMs) {
        skippedRangeCount += 1;
        return;
      }

      const shiftedStartMs = Math.max(0, startMs + shiftMs);
      const shiftedEndMs = Math.max(0, endMs + shiftMs);
      const suffix = match.groups.suffix || "";
      const contentLines = lines.slice(timeLineIndex + 1);

      keptCount += 1;
      outputBlocks.push(
        [
          String(keptCount),
          `${formatTimecode(shiftedStartMs)} --> ${formatTimecode(shiftedEndMs)}${suffix}`,
          ...contentLines
        ].join("\r\n")
      );
    } catch {
      invalidCount += 1;
      return;
    }
  });

  return {
    output: outputBlocks.join("\r\n\r\n"),
    totalCount: blocks.length,
    keptCount,
    skippedRangeCount,
    invalidCount
  };
}

export default function initSrtRangeShift() {
  const fileInput = document.querySelector("#srts-file");
  const source = document.querySelector("#srts-source");
  const sourceName = document.querySelector("#srts-source-name");
  const startRange = document.querySelector("#srts-start-range");
  const endRange = document.querySelector("#srts-end-range");
  const shiftPreview = document.querySelector("#srts-shift-preview");
  const processBtn = document.querySelector("#srts-process-btn");
  const sampleBtn = document.querySelector("#srts-sample-btn");
  const clearBtn = document.querySelector("#srts-clear-btn");
  const status = document.querySelector("#srts-status");
  const output = document.querySelector("#srts-output");
  const downloadName = document.querySelector("#srts-download-name");
  const copyBtn = document.querySelector("#srts-copy-btn");
  const downloadBtn = document.querySelector("#srts-download-btn");

  if (
    !fileInput ||
    !source ||
    !sourceName ||
    !startRange ||
    !endRange ||
    !shiftPreview ||
    !status ||
    !output ||
    !downloadName
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW SRT 區間平移器",
      en: "ToolNestTW SRT Range Shift"
    },
    text: {
      ".hero h1": { zh: "SRT 區間平移器", en: "SRT Range Shift" },
      ".hero .lead": {
        zh: "擷取指定時間區間內的字幕，並自動用起始範圍將時間軸對齊到 00:00:00,000。",
        en: "Keep subtitle cues inside a range and automatically shift them so the selected start becomes zero."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "區間設定", en: "Range Settings" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(7) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="srts-file"]': { zh: "上傳 SRT 檔案", en: "Upload SRT File" },
      'label[for="srts-source"]': { zh: "SRT 內容", en: "SRT Content" },
      'label[for="srts-start-range"]': { zh: "起始範圍", en: "Start Range" },
      'label[for="srts-end-range"]': { zh: "結束範圍", en: "End Range" },
      'label[for="srts-output"]': { zh: "處理後的 SRT", en: "Processed SRT" },
      "#srts-process-btn": { zh: "處理 SRT", en: "Process SRT" },
      "#srts-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#srts-clear-btn": { zh: "清除", en: "Clear" },
      "#srts-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      "#srts-download-btn": { zh: "下載 SRT", en: "Download SRT" },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "1. 上傳或貼上 SRT 內容。",
        en: "1. Upload or paste SRT content."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "2. 設定要保留的字幕起始與結束範圍。",
        en: "2. Set the subtitle start and end range to keep."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(3)": {
        zh: "3. 點擊處理 SRT，確認結果後再複製或下載。",
        en: "3. Process the file, then review, copy, or download the result."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(1)": {
        zh: "工具會怎麼自動換算？ 若起始範圍是 00:03:10,000，工具會自動提前 00:03:10,000，讓輸出從 00:00:00,000 開始。",
        en: "How is the shift calculated automatically? If the start range is 00:03:10,000, the tool moves cues earlier by 00:03:10,000 so output starts at 00:00:00,000."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(2)": {
        zh: "可以輸入簡寫時間嗎？ 可以，例如 3:10 會視為 00:03:10,000，1:3:10 會視為 01:03:10,000。",
        en: "Can I enter shorthand time? Yes. For example, 3:10 becomes 00:03:10,000 and 1:3:10 becomes 01:03:10,000."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(3)": {
        zh: "會上傳字幕內容嗎？ 不會，全部在瀏覽器本機處理。",
        en: "Is subtitle content uploaded? No, everything is processed locally in the browser."
      }
    },
    placeholder: {
      "#srts-source": {
        zh: "可直接貼上 .srt 內容，或先上傳檔案。",
        en: "Paste .srt content directly, or upload a file first."
      },
      "#srts-start-range": { zh: "3:10 或 00:03:10,000", en: "3:10 or 00:03:10,000" },
      "#srts-end-range": { zh: "4:04 或 00:04:04,000", en: "4:04 or 00:04:04,000" },
      "#srts-output": {
        zh: "處理後的字幕會顯示在這裡。",
        en: "Processed subtitle output appears here."
      }
    }
  });

  const settings = loadSettings();
  startRange.value = settings.startRange;
  endRange.value = settings.endRange;

  const state = {
    sourceName: "",
    result: null
  };

  bindCopyButton(copyBtn, () => output.value);

  const persistSettings = () => {
    saveSettings(startRange.value, endRange.value);
  };

  const renderSourceMeta = () => {
    sourceName.textContent = state.sourceName
      ? t("sourceName", { name: state.sourceName })
      : t("sourceNameEmpty");
  };

  const renderShiftPreview = () => {
    shiftPreview.textContent = describeAutoShift(startRange.value);
  };

  const renderResult = () => {
    const hasOutput = Boolean(state.result?.output);
    output.value = state.result?.output || "";
    downloadBtn.disabled = !hasOutput;
    downloadName.textContent = state.result?.filename
      ? t("downloadName", { name: state.result.filename })
      : t("downloadNameEmpty");

    status.classList.remove("is-success", "is-warning");
    if (!state.result) {
      status.textContent = t("idleStatus");
      return;
    }

    const summary =
      state.result.keptCount > 0
        ? t("statusReady", {
            kept: state.result.keptCount,
            total: state.result.totalCount,
            skipped: state.result.skippedRangeCount
          })
        : t("statusNoMatch", { total: state.result.totalCount });

    const invalidSuffix =
      state.result.invalidCount > 0
        ? ` ${t("statusInvalidSuffix", { invalid: state.result.invalidCount })}`
        : "";

    status.textContent = `${summary}${invalidSuffix}`.trim();
    status.classList.add(state.result.keptCount > 0 ? "is-success" : "is-warning");
  };

  const resetResult = () => {
    state.result = null;
    renderResult();
  };

  const loadSample = () => {
    source.value = SAMPLE_SRT;
    startRange.value = SAMPLE_SETTINGS.startRange;
    endRange.value = SAMPLE_SETTINGS.endRange;
    state.sourceName = SAMPLE_NAME;
    persistSettings();
    renderSourceMeta();
    renderShiftPreview();
    resetResult();
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      source.value = normalizeSrtSource(await file.text());
      state.sourceName = file.name;
      renderSourceMeta();
      resetResult();
      toast(t("fileLoaded"), "success");
    } catch {
      toast(t("fileReadError"));
    }
  });

  processBtn?.addEventListener("click", () => {
    if (!source.value.trim()) {
      toast(t("invalidInput"));
      return;
    }

    let startRangeMs;
    let endRangeMs;

    try {
      startRangeMs = parseTimecode(startRange.value);
      endRangeMs = parseTimecode(endRange.value);
    } catch {
      toast(t("invalidTime"));
      return;
    }

    if (endRangeMs < startRangeMs) {
      toast(t("invalidRangeOrder"));
      return;
    }

    const processed = processSrt(source.value, startRangeMs, endRangeMs, -startRangeMs);
    state.result = {
      ...processed,
      filename: makeOutputFilename(state.sourceName)
    };
    renderResult();
    persistSettings();
    toast(processed.keptCount > 0 ? t("processed") : t("emptyResult"), processed.keptCount > 0 ? "success" : "default");
  });

  sampleBtn?.addEventListener("click", loadSample);

  clearBtn?.addEventListener("click", () => {
    fileInput.value = "";
    source.value = "";
    startRange.value = "";
    endRange.value = "";
    state.sourceName = "";
    clearRecentInput(TOOL_PATH);
    renderSourceMeta();
    renderShiftPreview();
    resetResult();
  });

  downloadBtn?.addEventListener("click", () => {
    if (!state.result?.output) {
      return;
    }
    downloadBlob(
      new Blob(["\uFEFF", state.result.output], { type: "application/x-subrip;charset=utf-8" }),
      state.result.filename
    );
  });

  [startRange, endRange].forEach((node) => {
    node.addEventListener("input", () => {
      persistSettings();
      renderShiftPreview();
    });
  });

  source.addEventListener("input", resetResult);

  onLanguageChange(() => {
    renderSourceMeta();
    renderShiftPreview();
    renderResult();
  });

  renderSourceMeta();
  renderShiftPreview();
  renderResult();
}
