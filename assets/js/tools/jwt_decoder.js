import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkhlbGxvV29ybGQiLCJhZG1pbiI6dHJ1ZSwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MjQ5OTIwMDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const copy = {
  zh: {
    invalidInput: "輸入格式錯誤",
    invalidToken: "JWT 格式錯誤，需為 header.payload.signature。",
    decoded: "JWT 解析完成。",
    headerLabel: "Header",
    payloadLabel: "Payload",
    signatureLabel: "Signature",
    notesLabel: "狀態",
    timeIat: "簽發時間 iat",
    timeNbf: "生效時間 nbf",
    timeExp: "到期時間 exp",
    expired: "已過期",
    notYet: "尚未生效",
    valid: "有效",
    none: "無"
  },
  en: {
    invalidInput: "Invalid input format",
    invalidToken: "Invalid JWT format, expected header.payload.signature.",
    decoded: "JWT decoded.",
    headerLabel: "Header",
    payloadLabel: "Payload",
    signatureLabel: "Signature",
    notesLabel: "Status",
    timeIat: "Issued at iat",
    timeNbf: "Not before nbf",
    timeExp: "Expires at exp",
    expired: "Expired",
    notYet: "Not active yet",
    valid: "Valid",
    none: "None"
  }
};

function getLang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key) {
  return copy[getLang()]?.[key] || copy.en[key] || key;
}

function decodeBase64Url(part) {
  const normalized = String(part || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseJwtPart(part) {
  const decoded = decodeBase64Url(part);
  try {
    return { raw: decoded, json: JSON.parse(decoded) };
  } catch {
    return { raw: decoded, json: null };
  }
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatUnix(seconds) {
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function buildTimeNotes(payload) {
  if (!payload || typeof payload !== "object") {
    return [t("none")];
  }

  const now = Math.floor(Date.now() / 1000);
  const notes = [];
  const iat = Number(payload.iat);
  const nbf = Number(payload.nbf);
  const exp = Number(payload.exp);

  if (Number.isFinite(iat)) {
    notes.push(`${t("timeIat")}: ${formatUnix(iat)}`);
  }
  if (Number.isFinite(nbf)) {
    const nbfState = now < nbf ? t("notYet") : t("valid");
    notes.push(`${t("timeNbf")}: ${formatUnix(nbf)} (${nbfState})`);
  }
  if (Number.isFinite(exp)) {
    const expState = now >= exp ? t("expired") : t("valid");
    notes.push(`${t("timeExp")}: ${formatUnix(exp)} (${expState})`);
  }

  return notes.length ? notes : [t("none")];
}

function buildOutput(result) {
  return [
    `${t("headerLabel")}:`,
    result.header.json ? safeJson(result.header.json) : result.header.raw,
    "",
    `${t("payloadLabel")}:`,
    result.payload.json ? safeJson(result.payload.json) : result.payload.raw,
    "",
    `${t("signatureLabel")}:`,
    result.signature || t("none"),
    "",
    `${t("notesLabel")}:`,
    ...buildTimeNotes(result.payload.json)
  ].join("\n");
}

export default function initJwtDecoder() {
  const input = document.querySelector("#jwt-input");
  const output = document.querySelector("#jwt-output");
  const decodeBtn = document.querySelector("#jwt-decode-btn");
  const sampleBtn = document.querySelector("#jwt-sample-btn");
  const clearBtn = document.querySelector("#jwt-clear-btn");
  const copyBtn = document.querySelector("#jwt-copy-btn");

  if (!input || !output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW JWT Decoder",
      en: "ToolNestTW JWT Decoder"
    },
    text: {
      ".hero h1": { zh: "JWT Decoder", en: "JWT Decoder" },
      ".hero .lead": {
        zh: "解析 JWT 的 Header 與 Payload，並顯示常見時間欄位狀態。",
        en: "Decode JWT header and payload with common time-claim status."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="jwt-input"]': { zh: "JWT Token", en: "JWT Token" },
      '.tool-page > .panel:nth-of-type(1) .hint': {
        zh: "安全提醒：本工具不會儲存或傳送您的 Token。",
        en: "Security note: this tool does not store or send your token."
      },
      "#jwt-decode-btn": { zh: "解析 JWT", en: "Decode JWT" },
      "#jwt-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#jwt-clear-btn": { zh: "清除", en: "Clear" },
      "#jwt-copy-btn": { zh: "複製輸出", en: "Copy Output" },
      'label[for="jwt-output"]': { zh: "解析結果", en: "Decoded result" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上 JWT Token。",
        en: "1. Paste a JWT token."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊解析 JWT。",
        en: "2. Click Decode JWT."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 檢視 Header、Payload 與時間欄位資訊。",
        en: "3. Review header, payload, and time-claim information."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會驗證簽章嗎？ 不會，本工具只負責解碼顯示。",
        en: "Does it verify signature? No, it only decodes and displays content."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "資料會外傳嗎？ 不會，所有運算都在瀏覽器本機完成。",
        en: "Is data sent out? No, all processing runs locally in browser."
      }
    },
    placeholder: {
      "#jwt-input": {
        zh: "貼上 JWT（header.payload.signature）",
        en: "Paste JWT token (header.payload.signature)"
      },
      "#jwt-output": {
        zh: "解析結果會顯示在這裡",
        en: "Decoded result appears here"
      }
    }
  });

  let lastResult = null;
  bindCopyButton(copyBtn, () => output.value);

  const render = () => {
    output.value = lastResult ? buildOutput(lastResult) : "";
  };

  decodeBtn?.addEventListener("click", () => {
    const token = input.value.trim();
    if (!token) {
      toast(t("invalidInput"));
      return;
    }

    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1]) {
      toast(t("invalidToken"));
      return;
    }

    try {
      const header = parseJwtPart(parts[0]);
      const payload = parseJwtPart(parts[1]);
      lastResult = {
        header,
        payload,
        signature: parts[2] || ""
      };
      render();
      toast(t("decoded"), "success");
    } catch {
      toast(t("invalidInput"));
    }
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_JWT;
    output.value = "";
    lastResult = null;
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    output.value = "";
    lastResult = null;
  });

  onLanguageChange(() => {
    render();
  });
}
