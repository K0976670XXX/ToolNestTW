import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/dev/hash_generator";
const SAMPLE_INPUT = "ToolNestTW phase one";

function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function bitRotateLeft(value, amount) {
  return (value << amount) | (value >>> (32 - amount));
}

function md5Common(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5Ff(a, b, c, d, x, s, t) {
  return md5Common((b & c) | (~b & d), a, b, x, s, t);
}

function md5Gg(a, b, c, d, x, s, t) {
  return md5Common((b & d) | (c & ~d), a, b, x, s, t);
}

function md5Hh(a, b, c, d, x, s, t) {
  return md5Common(b ^ c ^ d, a, b, x, s, t);
}

function md5Ii(a, b, c, d, x, s, t) {
  return md5Common(c ^ (b | ~d), a, b, x, s, t);
}

function binlMd5(words, bitLength) {
  words[bitLength >> 5] |= 0x80 << bitLength % 32;
  words[(((bitLength + 64) >>> 9) << 4) + 14] = bitLength;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < words.length; i += 16) {
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;

    a = md5Ff(a, b, c, d, words[i], 7, -680876936);
    d = md5Ff(d, a, b, c, words[i + 1], 12, -389564586);
    c = md5Ff(c, d, a, b, words[i + 2], 17, 606105819);
    b = md5Ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = md5Ff(a, b, c, d, words[i + 4], 7, -176418897);
    d = md5Ff(d, a, b, c, words[i + 5], 12, 1200080426);
    c = md5Ff(c, d, a, b, words[i + 6], 17, -1473231341);
    b = md5Ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = md5Ff(a, b, c, d, words[i + 8], 7, 1770035416);
    d = md5Ff(d, a, b, c, words[i + 9], 12, -1958414417);
    c = md5Ff(c, d, a, b, words[i + 10], 17, -42063);
    b = md5Ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = md5Ff(a, b, c, d, words[i + 12], 7, 1804603682);
    d = md5Ff(d, a, b, c, words[i + 13], 12, -40341101);
    c = md5Ff(c, d, a, b, words[i + 14], 17, -1502002290);
    b = md5Ff(b, c, d, a, words[i + 15], 22, 1236535329);

    a = md5Gg(a, b, c, d, words[i + 1], 5, -165796510);
    d = md5Gg(d, a, b, c, words[i + 6], 9, -1069501632);
    c = md5Gg(c, d, a, b, words[i + 11], 14, 643717713);
    b = md5Gg(b, c, d, a, words[i], 20, -373897302);
    a = md5Gg(a, b, c, d, words[i + 5], 5, -701558691);
    d = md5Gg(d, a, b, c, words[i + 10], 9, 38016083);
    c = md5Gg(c, d, a, b, words[i + 15], 14, -660478335);
    b = md5Gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = md5Gg(a, b, c, d, words[i + 9], 5, 568446438);
    d = md5Gg(d, a, b, c, words[i + 14], 9, -1019803690);
    c = md5Gg(c, d, a, b, words[i + 3], 14, -187363961);
    b = md5Gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = md5Gg(a, b, c, d, words[i + 13], 5, -1444681467);
    d = md5Gg(d, a, b, c, words[i + 2], 9, -51403784);
    c = md5Gg(c, d, a, b, words[i + 7], 14, 1735328473);
    b = md5Gg(b, c, d, a, words[i + 12], 20, -1926607734);

    a = md5Hh(a, b, c, d, words[i + 5], 4, -378558);
    d = md5Hh(d, a, b, c, words[i + 8], 11, -2022574463);
    c = md5Hh(c, d, a, b, words[i + 11], 16, 1839030562);
    b = md5Hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = md5Hh(a, b, c, d, words[i + 1], 4, -1530992060);
    d = md5Hh(d, a, b, c, words[i + 4], 11, 1272893353);
    c = md5Hh(c, d, a, b, words[i + 7], 16, -155497632);
    b = md5Hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = md5Hh(a, b, c, d, words[i + 13], 4, 681279174);
    d = md5Hh(d, a, b, c, words[i], 11, -358537222);
    c = md5Hh(c, d, a, b, words[i + 3], 16, -722521979);
    b = md5Hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = md5Hh(a, b, c, d, words[i + 9], 4, -640364487);
    d = md5Hh(d, a, b, c, words[i + 12], 11, -421815835);
    c = md5Hh(c, d, a, b, words[i + 15], 16, 530742520);
    b = md5Hh(b, c, d, a, words[i + 2], 23, -995338651);

    a = md5Ii(a, b, c, d, words[i], 6, -198630844);
    d = md5Ii(d, a, b, c, words[i + 7], 10, 1126891415);
    c = md5Ii(c, d, a, b, words[i + 14], 15, -1416354905);
    b = md5Ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = md5Ii(a, b, c, d, words[i + 12], 6, 1700485571);
    d = md5Ii(d, a, b, c, words[i + 3], 10, -1894986606);
    c = md5Ii(c, d, a, b, words[i + 10], 15, -1051523);
    b = md5Ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = md5Ii(a, b, c, d, words[i + 8], 6, 1873313359);
    d = md5Ii(d, a, b, c, words[i + 15], 10, -30611744);
    c = md5Ii(c, d, a, b, words[i + 6], 15, -1560198380);
    b = md5Ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = md5Ii(a, b, c, d, words[i + 4], 6, -145523070);
    d = md5Ii(d, a, b, c, words[i + 11], 10, -1120210379);
    c = md5Ii(c, d, a, b, words[i + 2], 15, 718787259);
    b = md5Ii(b, c, d, a, words[i + 9], 21, -343485551);

    a = safeAdd(a, oldA);
    b = safeAdd(b, oldB);
    c = safeAdd(c, oldC);
    d = safeAdd(d, oldD);
  }

  return [a, b, c, d];
}

function wordsFromRawString(raw) {
  const words = [];
  const bitLength = raw.length * 8;
  for (let i = 0; i < bitLength; i += 8) {
    words[i >> 5] |= (raw.charCodeAt(i / 8) & 0xff) << i % 32;
  }
  return words;
}

function rawStringFromWords(words) {
  let output = "";
  const bitLength = words.length * 32;
  for (let i = 0; i < bitLength; i += 8) {
    output += String.fromCharCode((words[i >> 5] >>> i % 32) & 0xff);
  }
  return output;
}

function rawMd5(input) {
  return rawStringFromWords(binlMd5(wordsFromRawString(input), input.length * 8));
}

function utf8Raw(value) {
  return unescape(encodeURIComponent(value));
}

function rawToHex(raw) {
  const chars = "0123456789abcdef";
  let output = "";
  for (let index = 0; index < raw.length; index += 1) {
    const value = raw.charCodeAt(index);
    output += chars[(value >>> 4) & 0x0f] + chars[value & 0x0f];
  }
  return output;
}

function md5(value) {
  return rawToHex(rawMd5(utf8Raw(value)));
}

async function shaHex(algorithm, text) {
  const payload = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest(algorithm, payload);
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

export default function initHashGenerator() {
  const input = document.querySelector("#hash-input");
  const md5Output = document.querySelector("#md5-output");
  const sha1Output = document.querySelector("#sha1-output");
  const sha256Output = document.querySelector("#sha256-output");
  const generateBtn = document.querySelector("#generate-btn");
  const sampleBtn = document.querySelector("#sample-btn");
  const clearBtn = document.querySelector("#clear-btn");

  if (!input || !md5Output || !sha1Output || !sha256Output) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 雜湊產生器",
      en: "ToolNestTW Hash Generator"
    },
    text: {
      ".hero h1": { zh: "雜湊產生器", en: "Hash Generator" },
      ".hero .lead": {
        zh: "快速產生 MD5、SHA1、SHA256 雜湊結果。",
        en: "Generate MD5, SHA1, and SHA256 hashes instantly."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="hash-input"]': { zh: "原始文字", en: "Source text" },
      "#generate-btn": { zh: "產生雜湊", en: "Generate Hashes" },
      "#sample-btn": { zh: "載入範例", en: "Load Example" },
      "#clear-btn": { zh: "清除", en: "Clear" },
      "#copy-md5": { zh: "複製 MD5", en: "Copy MD5" },
      "#copy-sha1": { zh: "複製 SHA1", en: "Copy SHA1" },
      "#copy-sha256": { zh: "複製 SHA256", en: "Copy SHA256" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 輸入原始文字。",
        en: "1. Enter source text."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊產生雜湊。",
        en: "2. Click Generate Hashes."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 複製需要的雜湊值。",
        en: "3. Copy one or more hash values."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "資料會送到伺服器嗎？ 不會，所有雜湊都在瀏覽器本機完成。",
        en: "Does this send data to server? No, all hashes run locally."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "雜湊可以反推嗎？ 不行，雜湊設計上是單向運算。",
        en: "Can hashes be reversed? No, hashing is one-way."
      }
    },
    placeholder: {
      "#hash-input": {
        zh: "請輸入要雜湊的文字...",
        en: "Type the text to hash..."
      },
      "#md5-output": {
        zh: "MD5 雜湊值",
        en: "MD5 hash"
      },
      "#sha1-output": {
        zh: "SHA1 雜湊值",
        en: "SHA1 hash"
      },
      "#sha256-output": {
        zh: "SHA256 雜湊值",
        en: "SHA256 hash"
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  input.addEventListener("input", () => saveRecentInput(TOOL_PATH, input.value));

  bindCopyButton(document.querySelector("#copy-md5"), () => md5Output.value);
  bindCopyButton(document.querySelector("#copy-sha1"), () => sha1Output.value);
  bindCopyButton(document.querySelector("#copy-sha256"), () => sha256Output.value);

  const clearOutput = () => {
    md5Output.value = "";
    sha1Output.value = "";
    sha256Output.value = "";
  };

  generateBtn?.addEventListener("click", async () => {
    if (!input.value.trim()) {
      toast("Invalid input format");
      return;
    }

    try {
      md5Output.value = md5(input.value);
      const [sha1, sha256] = await Promise.all([
        shaHex("SHA-1", input.value),
        shaHex("SHA-256", input.value)
      ]);
      sha1Output.value = sha1;
      sha256Output.value = sha256;
      toast("Hashes generated.", "success");
    } catch {
      toast("Invalid input format");
    }
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_INPUT;
    saveRecentInput(TOOL_PATH, SAMPLE_INPUT);
    clearOutput();
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearOutput();
    clearRecentInput(TOOL_PATH);
  });
}










