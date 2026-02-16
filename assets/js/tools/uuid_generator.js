import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";

function createFallbackUUID() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newUUID() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createFallbackUUID();
}

export default function initUuidGenerator() {
  const countInput = document.querySelector("#uuid-count");
  const output = document.querySelector("#uuid-output");
  const generateBtn = document.querySelector("#generate-btn");
  const sampleBtn = document.querySelector("#sample-btn");
  const clearBtn = document.querySelector("#clear-btn");
  const copyBtn = document.querySelector("#copy-btn");

  if (!countInput || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW UUID 產生器",
      en: "ToolNestTW UUID Generator"
    },
    text: {
      ".hero h1": { zh: "UUID 產生器", en: "UUID Generator" },
      ".hero .lead": {
        zh: "一鍵產生單筆或多筆 UUID v4。",
        en: "Generate one or many UUID v4 values instantly."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="uuid-count"]': { zh: "產生數量", en: "How many UUIDs" },
      'label[for="uuid-output"]': { zh: "UUID 清單", en: "UUID list" },
      "#generate-btn": { zh: "產生 UUID", en: "Generate UUID" },
      "#sample-btn": { zh: "載入範例", en: "Load Example" },
      "#clear-btn": { zh: "清除", en: "Clear" },
      "#copy-btn": { zh: "複製輸出", en: "Copy Output" },
      ".tool-page > .panel:nth-of-type(1) .hint": {
        zh: "範圍為 1 到 50，手機與桌機都能快速產生。",
        en: "Range: 1 to 50 for fast generation on desktop and mobile."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 設定要產生的 UUID 數量。",
        en: "1. Set how many UUIDs you need."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊產生 UUID。",
        en: "2. Click Generate UUID."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 複製後貼到你的專案。",
        en: "3. Copy and paste into your project."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "使用哪個版本？ 本工具產生 UUID v4。",
        en: "Which UUID version is used? This tool generates UUID v4."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "安全嗎？ 使用瀏覽器密碼學等級隨機來源。",
        en: "Is it secure? It uses browser cryptographic randomness."
      }
    },
    placeholder: {
      "#uuid-output": {
        zh: "UUID 會顯示在這裡",
        en: "UUID results will appear here"
      }
    }
  });

  bindCopyButton(copyBtn, () => output.value);

  const generate = () => {
    const count = Number(countInput.value);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      toast("Invalid input format");
      return;
    }

    const rows = [];
    for (let index = 0; index < count; index += 1) {
      rows.push(newUUID());
    }
    output.value = rows.join("\n");
    toast("UUID generated.", "success");
  };

  generateBtn?.addEventListener("click", generate);
  sampleBtn?.addEventListener("click", () => {
    countInput.value = "5";
    generate();
  });
  clearBtn?.addEventListener("click", () => {
    output.value = "";
  });
}









