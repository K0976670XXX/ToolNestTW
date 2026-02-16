import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/text/slug_generator";
const SAMPLE_INPUT = "ToolNestTW 工具平台 第二階段上線";

function generateSlug(value, separator = "-", lower = true) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .trim();

  const collapsed = normalized.replace(/[\s_-]+/g, separator).replace(new RegExp(`${separator}+`, "g"), separator);
  const trimmed = collapsed.replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "");
  return lower ? trimmed.toLowerCase() : trimmed;
}

export default function initSlugGenerator() {
  const input = document.querySelector("#slug-input");
  const output = document.querySelector("#slug-output");
  const separatorInput = document.querySelector("#slug-separator");
  const lowercaseInput = document.querySelector("#slug-lowercase");
  const generateBtn = document.querySelector("#slug-generate-btn");
  const sampleBtn = document.querySelector("#slug-sample-btn");
  const clearBtn = document.querySelector("#slug-clear-btn");
  const copyBtn = document.querySelector("#slug-copy-btn");

  if (!input || !output || !separatorInput || !lowercaseInput) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW Slug 產生器",
      en: "ToolNestTW Slug Generator"
    },
    text: {
      ".hero h1": { zh: "Slug 產生器", en: "Slug Generator" },
      ".hero .lead": {
        zh: "將標題文字轉換成 SEO 友善網址片段。",
        en: "Convert title text into SEO-friendly URL slug."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="slug-input"]': { zh: "原始文字", en: "Source text" },
      'label[for="slug-separator"]': { zh: "分隔符號", en: "Separator" },
      "#slug-lowercase-text": { zh: "轉為小寫", en: "Lowercase output" },
      'label[for="slug-output"]': { zh: "Slug 結果", en: "Slug output" },
      "#slug-generate-btn": { zh: "產生 Slug", en: "Generate Slug" },
      "#slug-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#slug-clear-btn": { zh: "清除", en: "Clear" },
      "#slug-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入標題或文字。",
        en: "1. Enter title or text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 設定分隔符號與大小寫。",
        en: "2. Configure separator and casing."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 產生後複製網址片段。",
        en: "3. Generate and copy slug."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會移除特殊符號嗎？ 會，僅保留 URL 安全字元。",
        en: "Will special symbols be removed? Yes, only URL-safe characters are kept."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "是否會上傳資料？ 不會，轉換在本機執行。",
        en: "Is data uploaded? No, conversion runs locally."
      }
    },
    placeholder: {
      "#slug-input": {
        zh: "例如：ToolNestTW 工具平台 第二階段上線",
        en: "Example: ToolNestTW Tools Stage Two Launch"
      },
      "#slug-output": { zh: "Slug 會顯示在這裡", en: "Slug output appears here" }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  bindCopyButton(copyBtn, () => output.value);

  const run = () => {
    if (!input.value.trim()) {
      toast("Invalid input format");
      return;
    }
    output.value = generateSlug(input.value, separatorInput.value, lowercaseInput.checked);
    toast("Slug generated.", "success");
    saveRecentInput(TOOL_PATH, input.value);
  };

  generateBtn?.addEventListener("click", run);
  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_INPUT;
    output.value = "";
    saveRecentInput(TOOL_PATH, input.value);
  });
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    clearRecentInput(TOOL_PATH);
  });
  input.addEventListener("input", () => saveRecentInput(TOOL_PATH, input.value));
}





