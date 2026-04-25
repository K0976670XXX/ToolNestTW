import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { bindDragDrop } from "/assets/components/drag.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { canvasToBlob, formatBytes } from "/assets/js/utils.js?v=1.6.26";

const MAX_PREVIEW_WIDTH = 760;
const MAX_DECODE_FRAMES = 600;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[index] = current >>> 0;
  }
  return table;
})();

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    unsupported: "目前瀏覽器不支援動畫逐幀解碼。",
    noFile: "請先載入動畫。",
    loaded: "動畫已載入。",
    decoding: "正在解碼動畫影格...",
    rendering: "正在移除背景並產生預覽...",
    rendered: "去背預覽已完成。",
    cleared: "已清除動畫與預覽。",
    samplingOn: "滴管已啟用，請點擊原始畫面取色。",
    sampled: "已套用取樣顏色。",
    noPreview: "尚未產生預覽。",
    fileEmpty: "尚未載入動畫。",
    fileName: "目前動畫：{name}",
    outputFormat: "輸出格式",
    outputSize: "輸出尺寸",
    outputFrames: "輸出幀數",
    outputDuration: "動畫長度",
    outputFileSize: "檔案大小",
    color: "移除顏色",
    tolerance: "色彩容忍度",
    edgeCleanup: "邊緣清理",
    edgeFeather: "邊緣柔化",
    previewAlt: "去背動畫預覽",
    outputName: "{name}_transparent.{ext}"
  },
  en: {
    invalid: "Invalid input format",
    unsupported: "This browser does not support frame-by-frame animation decoding.",
    noFile: "Please load an animation first.",
    loaded: "Animation loaded.",
    decoding: "Decoding animation frames...",
    rendering: "Removing background and generating preview...",
    rendered: "Background-removed preview generated.",
    cleared: "Animation and preview cleared.",
    samplingOn: "Eyedropper is active. Click the source preview to sample a color.",
    sampled: "Sampled color applied.",
    noPreview: "No preview yet.",
    fileEmpty: "No animation loaded yet.",
    fileName: "Current animation: {name}",
    outputFormat: "Output format",
    outputSize: "Output size",
    outputFrames: "Output frames",
    outputDuration: "Animation duration",
    outputFileSize: "File size",
    color: "Removed color",
    tolerance: "Color tolerance",
    edgeCleanup: "Edge cleanup",
    edgeFeather: "Edge feather",
    previewAlt: "Transparent animation preview",
    outputName: "{name}_transparent.{ext}"
  }
};

function t(key, params = {}) {
  const lang = getLanguage();
  const template = copy[lang]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  const totalMs = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const hh = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
  return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function getFileStem(name) {
  const safeName = String(name || "animation");
  const dot = safeName.lastIndexOf(".");
  return (dot > 0 ? safeName.slice(0, dot) : safeName) || "animation";
}

function getMimeType(file) {
  const name = file.name.toLowerCase();
  if (file.type === "image/gif" || name.endsWith(".gif")) {
    return "image/gif";
  }
  if (file.type === "image/webp" || name.endsWith(".webp")) {
    return "image/webp";
  }
  if (file.type === "image/png" || name.endsWith(".png") || name.endsWith(".apng")) {
    return "image/png";
  }
  return "";
}

function hexToRgb(hex) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    return null;
  }
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function createUint16LE(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function createUint16BE(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, false);
  return bytes;
}

function createUint24LE(value) {
  const safe = value >>> 0;
  return new Uint8Array([safe & 0xff, (safe >>> 8) & 0xff, (safe >>> 16) & 0xff]);
}

function createUint32LE(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function createUint32BE(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, false);
  return bytes;
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  return concatUint8Arrays([
    createUint32BE(data.length),
    typeBytes,
    data,
    createUint32BE(crc32(concatUint8Arrays([typeBytes, data])))
  ]);
}

function makeRiffChunk(type, payload) {
  const typeBytes = new TextEncoder().encode(type);
  const pad = payload.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array();
  return concatUint8Arrays([typeBytes, createUint32LE(payload.length), payload, pad]);
}

function parsePngIdatData(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error("png");
  }

  const decoder = new TextDecoder("latin1");
  const payloads = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IDAT") {
      payloads.push(bytes.slice(dataStart, dataEnd));
    }
    offset = dataEnd + 4;
    if (type === "IEND") {
      break;
    }
  }
  return concatUint8Arrays(payloads);
}

function parseWebPFrameChunks(bytes) {
  const decoder = new TextDecoder("latin1");
  if (decoder.decode(bytes.slice(0, 4)) !== "RIFF" || decoder.decode(bytes.slice(8, 12)) !== "WEBP") {
    throw new Error("webp");
  }

  const chunks = [];
  let hasAlpha = false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourCC = decoder.decode(bytes.slice(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const chunkEnd = offset + 8 + size + (size % 2);
    if (fourCC === "ALPH" || fourCC === "VP8 " || fourCC === "VP8L") {
      chunks.push(bytes.slice(offset, chunkEnd));
      hasAlpha ||= fourCC === "ALPH" || fourCC === "VP8L";
    }
    offset = chunkEnd;
  }
  return { data: concatUint8Arrays(chunks), hasAlpha };
}

function buildTransparentGifPalette() {
  const palette = new Uint8Array(256 * 3);
  palette[0] = 0;
  palette[1] = 0;
  palette[2] = 0;

  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        const index = 1 + r * 36 + g * 6 + b;
        palette[index * 3] = Math.round((r / 5) * 255);
        palette[index * 3 + 1] = Math.round((g / 5) * 255);
        palette[index * 3 + 2] = Math.round((b / 5) * 255);
      }
    }
  }

  for (let index = 217; index < 256; index += 1) {
    const gray = Math.round(((index - 217) / 38) * 255);
    palette[index * 3] = gray;
    palette[index * 3 + 1] = gray;
    palette[index * 3 + 2] = gray;
  }
  return palette;
}

function quantizeTransparentGifIndex(r, g, b, alpha) {
  if (alpha < 128) {
    return 0;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min <= 18) {
    const gray = Math.round((r * 0.299 + g * 0.587 + b * 0.114) / 255 * 38);
    return 217 + gray;
  }
  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 5);
  const bi = Math.round((b / 255) * 5);
  return 1 + ri * 36 + gi * 6 + bi;
}

function packGifCodes(codes, minCodeSize) {
  const bytes = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const codeSize = minCodeSize + 1;
  const pushCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  for (let index = 0; index < codes.length; index += 128) {
    pushCode(clearCode);
    const limit = Math.min(index + 128, codes.length);
    for (let cursor = index; cursor < limit; cursor += 1) {
      pushCode(codes[cursor]);
    }
  }
  pushCode(endCode);
  if (bitCount > 0) {
    bytes.push(bitBuffer & 0xff);
  }
  return new Uint8Array(bytes);
}

function gifSubBlocks(bytes) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 255) {
    const block = bytes.slice(offset, offset + 255);
    blocks.push(new Uint8Array([block.length]), block);
  }
  blocks.push(new Uint8Array([0]));
  return concatUint8Arrays(blocks);
}

function encodeGif(frames, width, height) {
  const parts = [];
  const screenDescriptor = concatUint8Arrays([
    createUint16LE(width),
    createUint16LE(height),
    new Uint8Array([0xf7, 0x00, 0x00])
  ]);
  const loopExtension = new Uint8Array([
    0x21, 0xff, 0x0b,
    0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
    0x03, 0x01, 0x00, 0x00, 0x00
  ]);
  parts.push(new TextEncoder().encode("GIF89a"), screenDescriptor, buildTransparentGifPalette(), loopExtension);

  frames.forEach((frame) => {
    const indexed = new Uint8Array(width * height);
    const pixels = frame.imageData.data;
    for (let offset = 0, index = 0; offset < pixels.length; offset += 4, index += 1) {
      indexed[index] = quantizeTransparentGifIndex(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]);
    }
    const delayCs = Math.max(2, Math.round(frame.delayMs / 10));
    const gce = new Uint8Array([0x21, 0xf9, 0x04, 0x09, delayCs & 0xff, (delayCs >>> 8) & 0xff, 0x00, 0x00]);
    const descriptor = concatUint8Arrays([
      new Uint8Array([0x2c]),
      createUint16LE(0),
      createUint16LE(0),
      createUint16LE(width),
      createUint16LE(height),
      new Uint8Array([0x00])
    ]);
    parts.push(gce, descriptor, new Uint8Array([0x08]), gifSubBlocks(packGifCodes(indexed, 8)));
  });

  parts.push(new Uint8Array([0x3b]));
  return new Blob(parts, { type: "image/gif" });
}

async function encodeApng(frames, width, height) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempContext = tempCanvas.getContext("2d");
  if (!tempContext) {
    throw new Error("canvas");
  }

  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    makePngChunk("IHDR", concatUint8Arrays([createUint32BE(width), createUint32BE(height), new Uint8Array([8, 6, 0, 0, 0])])),
    makePngChunk("acTL", concatUint8Arrays([createUint32BE(frames.length), createUint32BE(0)]))
  ];
  let sequence = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    tempContext.putImageData(frame.imageData, 0, 0);
    const pngBlob = await canvasToBlob(tempCanvas, "image/png");
    const idatData = parsePngIdatData(new Uint8Array(await pngBlob.arrayBuffer()));
    chunks.push(makePngChunk("fcTL", concatUint8Arrays([
      createUint32BE(sequence++),
      createUint32BE(width),
      createUint32BE(height),
      createUint32BE(0),
      createUint32BE(0),
      createUint16BE(Math.max(1, Math.min(65535, Math.round(frame.delayMs)))),
      createUint16BE(1000),
      new Uint8Array([0x00, 0x00])
    ])));
    if (index === 0) {
      chunks.push(makePngChunk("IDAT", idatData));
    } else {
      chunks.push(makePngChunk("fdAT", concatUint8Arrays([createUint32BE(sequence++), idatData])));
    }
  }
  chunks.push(makePngChunk("IEND", new Uint8Array()));
  return new Blob(chunks, { type: "image/png" });
}

async function encodeAnimatedWebP(frames, width, height) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempContext = tempCanvas.getContext("2d");
  if (!tempContext) {
    throw new Error("canvas");
  }

  const frameChunks = [];
  let hasAlpha = true;
  for (const frame of frames) {
    tempContext.putImageData(frame.imageData, 0, 0);
    const webpBlob = await canvasToBlob(tempCanvas, "image/webp", 0.9);
    const parsed = parseWebPFrameChunks(new Uint8Array(await webpBlob.arrayBuffer()));
    frameChunks.push({ delayMs: frame.delayMs, chunkData: parsed.data });
    hasAlpha ||= parsed.hasAlpha;
  }

  const chunks = [
    makeRiffChunk("VP8X", concatUint8Arrays([
      new Uint8Array([(hasAlpha ? 0x10 : 0x00) | 0x02, 0x00, 0x00, 0x00]),
      createUint24LE(width - 1),
      createUint24LE(height - 1)
    ])),
    makeRiffChunk("ANIM", concatUint8Arrays([new Uint8Array([255, 255, 255, 0]), createUint16LE(0)]))
  ];
  frameChunks.forEach((frame) => {
    chunks.push(makeRiffChunk("ANMF", concatUint8Arrays([
      createUint24LE(0),
      createUint24LE(0),
      createUint24LE(width - 1),
      createUint24LE(height - 1),
      createUint24LE(Math.max(10, Math.min(16777215, Math.round(frame.delayMs)))),
      new Uint8Array([0x02]),
      frame.chunkData
    ])));
  });
  const body = concatUint8Arrays(chunks);
  return new Blob([
    concatUint8Arrays([new TextEncoder().encode("RIFF"), createUint32LE(4 + body.length), new TextEncoder().encode("WEBP")]),
    body
  ], { type: "image/webp" });
}

function applyAlphaOpening(imageData, iterations) {
  const count = Math.max(0, Math.min(3, Math.round(Number(iterations) || 0)));
  if (count === 0) {
    return imageData;
  }

  const { width, height } = imageData;
  const data = imageData.data;
  let mask = new Uint8Array(width * height);
  for (let index = 0, offset = 3; index < mask.length; index += 1, offset += 4) {
    mask[index] = data[offset] > 0 ? 1 : 0;
  }

  const erode = (source) => {
    const next = new Uint8Array(source.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let keep = 1;
        for (let oy = -1; oy <= 1 && keep; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height || source[ny * width + nx] === 0) {
              keep = 0;
              break;
            }
          }
        }
        next[y * width + x] = keep;
      }
    }
    return next;
  };

  const dilate = (source) => {
    const next = new Uint8Array(source.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let keep = 0;
        for (let oy = -1; oy <= 1 && !keep; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height && source[ny * width + nx] === 1) {
              keep = 1;
              break;
            }
          }
        }
        next[y * width + x] = keep;
      }
    }
    return next;
  };

  for (let index = 0; index < count; index += 1) {
    mask = erode(mask);
  }
  for (let index = 0; index < count; index += 1) {
    mask = dilate(mask);
  }

  for (let index = 0, offset = 3; index < mask.length; index += 1, offset += 4) {
    if (mask[index] === 0) {
      data[offset] = 0;
    }
  }

  return imageData;
}

function removeColorFromFrame(imageData, target, tolerance, edgeCleanup, edgeFeather) {
  const output = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const data = output.data;
  const limit = Number(tolerance) || 0;
  const feather = Math.max(0, Math.min(64, Number(edgeFeather) || 0));
  const softLimit = Math.min(441.68, limit + feather);
  for (let offset = 0; offset < data.length; offset += 4) {
    const dr = data[offset] - target.r;
    const dg = data[offset + 1] - target.g;
    const db = data[offset + 2] - target.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance <= limit) {
      data[offset + 3] = 0;
    } else if (feather > 0 && distance <= softLimit) {
      const alphaRatio = (distance - limit) / Math.max(1, softLimit - limit);
      data[offset] = clamp(Math.round((data[offset] - target.r * (1 - alphaRatio)) / alphaRatio), 0, 255);
      data[offset + 1] = clamp(Math.round((data[offset + 1] - target.g * (1 - alphaRatio)) / alphaRatio), 0, 255);
      data[offset + 2] = clamp(Math.round((data[offset + 2] - target.b * (1 - alphaRatio)) / alphaRatio), 0, 255);
      data[offset + 3] = Math.round(data[offset + 3] * alphaRatio);
    }
  }
  return applyAlphaOpening(output, edgeCleanup);
}

async function decodeAnimation(file) {
  if (typeof ImageDecoder !== "function") {
    throw new Error("unsupported");
  }
  const type = getMimeType(file);
  if (!type) {
    throw new Error("invalid");
  }

  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type });
  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack;
  const frameCount = Number.isFinite(track?.frameCount) && track.frameCount > 0 ? Math.min(track.frameCount, MAX_DECODE_FRAMES) : MAX_DECODE_FRAMES;
  const frames = [];
  let width = 0;
  let height = 0;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("canvas");
  }

  for (let index = 0; index < frameCount; index += 1) {
    let result;
    try {
      result = await decoder.decode({ frameIndex: index });
    } catch (error) {
      if (frames.length > 0) {
        break;
      }
      throw error;
    }
    const frame = result.image;
    width ||= frame.displayWidth || frame.codedWidth;
    height ||= frame.displayHeight || frame.codedHeight;
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(frame, 0, 0, width, height);
    frames.push({
      imageData: context.getImageData(0, 0, width, height),
      delayMs: Math.max(20, Math.round((frame.duration || 100000) / 1000))
    });
    frame.close?.();
  }

  if (!frames.length) {
    throw new Error("invalid");
  }
  decoder.close?.();
  return { frames, width, height };
}

export default function initAnimationBgRemove() {
  const dropZone = document.querySelector("#abr-drop-zone");
  const fileInput = document.querySelector("#abr-file");
  const fileName = document.querySelector("#abr-file-name");
  const colorInput = document.querySelector("#abr-color");
  const colorText = document.querySelector("#abr-color-text");
  const toleranceInput = document.querySelector("#abr-tolerance");
  const toleranceValue = document.querySelector("#abr-tolerance-value");
  const edgeCleanupInput = document.querySelector("#abr-edge-cleanup");
  const edgeCleanupValue = document.querySelector("#abr-edge-cleanup-value");
  const edgeFeatherInput = document.querySelector("#abr-edge-feather");
  const edgeFeatherValue = document.querySelector("#abr-edge-feather-value");
  const formatSelect = document.querySelector("#abr-output-format");
  const previewBgSelect = document.querySelector("#abr-preview-bg");
  const sampleBtn = document.querySelector("#abr-sample-btn");
  const renderBtn = document.querySelector("#abr-render-btn");
  const clearBtn = document.querySelector("#abr-clear-btn");
  const status = document.querySelector("#abr-status");
  const sourceEmpty = document.querySelector("#abr-source-empty");
  const sourceWrap = document.querySelector("#abr-source-wrap");
  const sourceCanvas = document.querySelector("#abr-source-canvas");
  const previewEmpty = document.querySelector("#abr-preview-empty");
  const previewFrame = document.querySelector("#abr-preview-frame");
  const previewImage = document.querySelector("#abr-preview-image");
  const outputMeta = document.querySelector("#abr-output-meta");
  const downloadBtn = document.querySelector("#abr-download-btn");

  if (
    !dropZone ||
    !fileInput ||
    !fileName ||
    !colorInput ||
    !colorText ||
    !toleranceInput ||
    !toleranceValue ||
    !edgeCleanupInput ||
    !edgeCleanupValue ||
    !edgeFeatherInput ||
    !edgeFeatherValue ||
    !formatSelect ||
    !previewBgSelect ||
    !sampleBtn ||
    !renderBtn ||
    !clearBtn ||
    !status ||
    !sourceEmpty ||
    !sourceWrap ||
    !sourceCanvas ||
    !previewEmpty ||
    !previewFrame ||
    !previewImage ||
    !outputMeta ||
    !downloadBtn
  ) {
    return;
  }

  bindPageI18n({
    title: { zh: "ToolNestTW 動畫 GIF 去背", en: "ToolNestTW Animated Background Remover" },
    text: {
      ".hero h1": { zh: "動畫 GIF 去背", en: "Animated Background Remover" },
      ".hero .lead": {
        zh: "上傳 GIF、WebP 或 APNG，選取背景色後批量移除所有相近像素。",
        en: "Upload GIF, WebP, or APNG, sample a background color, and remove all matching pixels."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "去背設定", en: "Background Removal" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "取色與預覽", en: "Sample & Preview" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "輸出資訊", en: "Output Details" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(7) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#abr-drop-zone strong": { zh: "拖曳動畫圖片到這裡", en: "Drop an animated image here" },
      "#abr-drop-zone .hint": {
        zh: "支援 GIF、Animated WebP、APNG，全部在瀏覽器本機處理",
        en: "Supports GIF, Animated WebP, and APNG. Everything runs locally in your browser."
      },
      'label[for="abr-color"]': { zh: "移除顏色", en: "Removed Color" },
      'label[for="abr-tolerance"]': { zh: "色彩容忍度", en: "Color Tolerance" },
      'label[for="abr-edge-cleanup"]': { zh: "邊緣清理", en: "Edge Cleanup" },
      'label[for="abr-edge-feather"]': { zh: "邊緣柔化", en: "Edge Feather" },
      'label[for="abr-output-format"]': { zh: "輸出格式", en: "Output Format" },
      'label[for="abr-preview-bg"]': { zh: "預覽背景", en: "Preview Background" },
      "#abr-preview-bg option[value='checkerboard']": { zh: "白灰方塊", en: "Checkerboard" },
      "#abr-preview-bg option[value='black']": { zh: "純黑背景", en: "Black" },
      "#abr-preview-bg option[value='white']": { zh: "純白背景", en: "White" },
      "#abr-color-hint": { zh: "可直接輸入色碼，或在下方預覽圖點一下取色。", en: "Enter a color, or click the source preview to sample it." },
      "#abr-tolerance-hint": { zh: "數值越大，會移除越多相近顏色。", en: "Higher values remove more nearby colors." },
      "#abr-edge-cleanup-hint": { zh: "先侵蝕再膨脹，去除細小毛邊。", en: "Erode then dilate to remove small edge noise." },
      "#abr-edge-feather-hint": { zh: "增加透明邊界過渡，降低硬邊。", en: "Adds alpha transition around the edge." },
      "#abr-format-hint": { zh: "預設 GIF。", en: "GIF is the default." },
      "#abr-preview-bg-hint": { zh: "只影響預覽，不會改變輸出透明度。", en: "Only affects preview, not exported transparency." },
      "#abr-sample-btn": { zh: "啟用滴管", en: "Enable Eyedropper" },
      "#abr-render-btn": { zh: "產生預覽", en: "Render Preview" },
      "#abr-clear-btn": { zh: "清除", en: "Clear" },
      "#abr-source-title": { zh: "原始畫面", en: "Source Frame" },
      "#abr-preview-title": { zh: "去背預覽", en: "Transparent Preview" },
      "#abr-source-empty": { zh: "載入動畫後，可點擊畫面選取背景色。", en: "Load an animation, then click the frame to sample a background color." },
      "#abr-preview-empty": { zh: "產生預覽後會顯示透明背景動畫。", en: "The transparent animation appears after rendering." },
      "#abr-source-hint": { zh: "滴管啟用後，點擊預覽畫面會套用該像素顏色。", en: "When eyedropper is enabled, click the preview to apply that pixel color." },
      "#abr-preview-hint": { zh: "調整顏色或容忍度後會自動重新產生預覽。", en: "Changing color or tolerance automatically refreshes the preview." },
      "#abr-download-btn": { zh: "下載檔案", en: "Download File" },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "1. 上傳 GIF、Animated WebP 或 APNG。",
        en: "1. Upload a GIF, Animated WebP, or APNG."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "2. 啟用滴管並點擊背景色，或直接輸入要移除的色碼。",
        en: "2. Enable the eyedropper and click the background color, or enter a color directly."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(3)": {
        zh: "3. 調整容忍度，確認預覽後下載 GIF、WEBP 或 APNG。",
        en: "3. Adjust tolerance, verify the preview, then download GIF, WEBP, or APNG."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(1)": {
        zh: "會上傳圖片嗎？ 不會，解碼、去背與輸出都在瀏覽器本機完成。",
        en: "Is the image uploaded? No, decoding, background removal, and export all run locally."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(2)": {
        zh: "為什麼某些瀏覽器不能用？ 動畫逐幀解碼需要瀏覽器支援 ImageDecoder。",
        en: "Why do some browsers fail? Frame-by-frame animation decoding requires ImageDecoder support."
      }
    }
  });

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    return;
  }

  const state = {
    file: null,
    frames: [],
    width: 0,
    height: 0,
    output: null,
    outputUrl: "",
    displayScale: 1,
    sampling: false,
    busy: false,
    renderTimer: 0
  };

  function setStatus(message, type = "idle") {
    status.textContent = message;
    status.classList.remove("is-success", "is-warning", "is-working");
    if (type === "success") {
      status.classList.add("is-success");
    } else if (type === "warning") {
      status.classList.add("is-warning");
    } else if (type === "working") {
      status.classList.add("is-working");
    }
  }

  function setBusy(value) {
    state.busy = value;
    fileInput.disabled = value;
    edgeCleanupInput.disabled = value;
    edgeFeatherInput.disabled = value;
    sampleBtn.disabled = value;
    renderBtn.disabled = value;
    clearBtn.disabled = value;
  }

  function revokeOutputUrl() {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = "";
    }
  }

  function clearPreview() {
    revokeOutputUrl();
    state.output = null;
    previewFrame.hidden = true;
    previewImage.removeAttribute("src");
    previewImage.alt = "";
    previewEmpty.hidden = false;
    outputMeta.textContent = "";
    downloadBtn.disabled = true;
  }

  function renderFileName() {
    fileName.textContent = state.file ? t("fileName", { name: state.file.name }) : t("fileEmpty");
  }

  function renderSourceFrame() {
    if (!state.frames.length) {
      sourceEmpty.hidden = false;
      sourceWrap.hidden = true;
      return;
    }
    const maxWidth = sourceWrap.parentElement?.clientWidth || MAX_PREVIEW_WIDTH;
    state.displayScale = Math.min(MAX_PREVIEW_WIDTH / state.width, maxWidth / state.width, 1);
    const displayWidth = Math.max(1, Math.round(state.width * state.displayScale));
    const displayHeight = Math.max(1, Math.round(state.height * state.displayScale));
    const dpr = window.devicePixelRatio || 1;
    sourceCanvas.width = Math.round(displayWidth * dpr);
    sourceCanvas.height = Math.round(displayHeight * dpr);
    sourceCanvas.style.width = `${displayWidth}px`;
    sourceCanvas.style.height = `${displayHeight}px`;
    sourceContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    sourceContext.clearRect(0, 0, displayWidth, displayHeight);
    sourceContext.imageSmoothingEnabled = false;
    sourceContext.drawImage(imageDataToCanvas(state.frames[0].imageData), 0, 0, displayWidth, displayHeight);
    sourceEmpty.hidden = true;
    sourceWrap.hidden = false;
  }

  function imageDataToCanvas(imageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = canvas.getContext("2d");
    context?.putImageData(imageData, 0, 0);
    return canvas;
  }

  function renderOutputMeta() {
    if (!state.output) {
      outputMeta.textContent = "";
      return;
    }
    const rows = [
      `${t("outputFormat")}: ${state.output.format.toUpperCase()}`,
      `${t("outputSize")}: ${state.width} x ${state.height}`,
      `${t("outputFrames")}: ${state.frames.length}`,
      `${t("outputDuration")}: ${formatTime(state.output.durationMs / 1000)}`,
      `${t("outputFileSize")}: ${formatBytes(state.output.blob.size)}`,
      `${t("color")}: ${colorInput.value}`,
      `${t("tolerance")}: ${toleranceInput.value}`,
      `${t("edgeCleanup")}: ${edgeCleanupInput.value}`,
      `${t("edgeFeather")}: ${edgeFeatherInput.value}`
    ];
    outputMeta.replaceChildren(...rows.map((text) => {
      const node = document.createElement("span");
      node.textContent = text;
      return node;
    }));
  }

  function syncToleranceLabel() {
    toleranceValue.textContent = toleranceInput.value;
  }

  function syncEdgeLabels() {
    edgeCleanupValue.textContent = edgeCleanupInput.value;
    edgeFeatherValue.textContent = edgeFeatherInput.value;
  }

  function syncPreviewBackground() {
    previewFrame.classList.remove("preview-bg-checkerboard", "preview-bg-black", "preview-bg-white");
    previewFrame.classList.add(`preview-bg-${previewBgSelect.value}`);
    if (previewBgSelect.value === "black") {
      previewFrame.style.backgroundColor = "#000";
      previewFrame.style.backgroundImage = "none";
    } else if (previewBgSelect.value === "white") {
      previewFrame.style.backgroundColor = "#fff";
      previewFrame.style.backgroundImage = "none";
    } else {
      previewFrame.style.backgroundColor = "#fff";
      previewFrame.style.backgroundImage = [
        "linear-gradient(45deg, #dce3f4 25%, transparent 25%)",
        "linear-gradient(-45deg, #dce3f4 25%, transparent 25%)",
        "linear-gradient(45deg, transparent 75%, #dce3f4 75%)",
        "linear-gradient(-45deg, transparent 75%, #dce3f4 75%)"
      ].join(", ");
      previewFrame.style.backgroundSize = "18px 18px";
      previewFrame.style.backgroundPosition = "0 0, 0 9px, 9px -9px, -9px 0";
    }
  }

  function setColor(hex, shouldRender = true) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return false;
    }
    const normalized = rgbToHex(rgb);
    colorInput.value = normalized;
    colorText.value = normalized;
    if (shouldRender) {
      scheduleRender();
    }
    return true;
  }

  async function renderPreview() {
    if (!state.frames.length) {
      toast(t("noFile"));
      return;
    }
    const target = hexToRgb(colorInput.value);
    if (!target) {
      toast(t("invalid"));
      return;
    }
    if (state.busy) {
      return;
    }

    setBusy(true);
    clearPreview();
    setStatus(t("rendering"), "working");
    try {
      const tolerance = Number(toleranceInput.value) || 0;
      const edgeCleanup = Number(edgeCleanupInput.value) || 0;
      const edgeFeather = Number(edgeFeatherInput.value) || 0;
      const frames = state.frames.map((frame) => ({
        delayMs: frame.delayMs,
        imageData: removeColorFromFrame(frame.imageData, target, tolerance, edgeCleanup, edgeFeather)
      }));

      let blob;
      if (formatSelect.value === "gif") {
        blob = encodeGif(frames, state.width, state.height);
      } else if (formatSelect.value === "apng") {
        blob = await encodeApng(frames, state.width, state.height);
      } else {
        blob = await encodeAnimatedWebP(frames, state.width, state.height);
      }

      revokeOutputUrl();
      state.outputUrl = URL.createObjectURL(blob);
      state.output = {
        blob,
        format: formatSelect.value,
        durationMs: frames.reduce((sum, frame) => sum + frame.delayMs, 0)
      };
      previewImage.src = state.outputUrl;
      previewImage.alt = t("previewAlt");
      previewFrame.hidden = false;
      previewEmpty.hidden = true;
      downloadBtn.disabled = false;
      renderOutputMeta();
      setStatus(t("rendered"), "success");
    } catch (error) {
      console.error(error);
      clearPreview();
      setStatus(t("invalid"), "warning");
      toast(t("invalid"));
    } finally {
      setBusy(false);
    }
  }

  function scheduleRender() {
    window.clearTimeout(state.renderTimer);
    if (!state.frames.length) {
      return;
    }
    state.renderTimer = window.setTimeout(() => {
      void renderPreview();
    }, 350);
  }

  async function applyFile(file) {
    setBusy(true);
    clearPreview();
    setStatus(t("decoding"), "working");
    try {
      const decoded = await decodeAnimation(file);
      state.file = file;
      state.frames = decoded.frames;
      state.width = decoded.width;
      state.height = decoded.height;
      state.sampling = false;
      renderFileName();
      renderSourceFrame();
      setStatus(t("loaded"), "success");
      toast(t("loaded"), "success");
      scheduleRender();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error && error.message === "unsupported" ? t("unsupported") : t("invalid");
      setStatus(message, "warning");
      toast(message);
    } finally {
      setBusy(false);
    }
  }

  async function readFiles(files) {
    const file = Array.from(files || []).find((item) => Boolean(getMimeType(item)));
    if (!file) {
      toast(t("invalid"));
      return;
    }
    await applyFile(file);
  }

  bindDragDrop({ dropZone, fileInput, onFiles: readFiles });

  sampleBtn.addEventListener("click", () => {
    if (!state.frames.length) {
      toast(t("noFile"));
      return;
    }
    state.sampling = true;
    sourceCanvas.classList.add("is-sampling");
    setStatus(t("samplingOn"), "working");
  });

  sourceCanvas.addEventListener("click", (event) => {
    if (!state.sampling || !state.frames.length) {
      return;
    }
    const rect = sourceCanvas.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / state.displayScale), 0, state.width - 1);
    const y = clamp(Math.floor((event.clientY - rect.top) / state.displayScale), 0, state.height - 1);
    const data = state.frames[0].imageData.data;
    const offset = (y * state.width + x) * 4;
    setColor(rgbToHex({ r: data[offset], g: data[offset + 1], b: data[offset + 2] }));
    state.sampling = false;
    sourceCanvas.classList.remove("is-sampling");
    setStatus(t("sampled"), "success");
  });

  colorInput.addEventListener("input", () => {
    setColor(colorInput.value);
  });

  colorText.addEventListener("input", () => {
    setColor(colorText.value);
  });

  toleranceInput.addEventListener("input", () => {
    syncToleranceLabel();
    scheduleRender();
  });

  edgeCleanupInput.addEventListener("input", () => {
    edgeCleanupInput.value = String(Math.max(0, Math.min(3, Math.round(Number(edgeCleanupInput.value) || 0))));
    syncEdgeLabels();
    scheduleRender();
  });

  edgeFeatherInput.addEventListener("input", () => {
    edgeFeatherInput.value = String(Math.max(0, Math.min(64, Math.round(Number(edgeFeatherInput.value) || 0))));
    syncEdgeLabels();
    scheduleRender();
  });

  formatSelect.addEventListener("change", scheduleRender);

  previewBgSelect.addEventListener("change", syncPreviewBackground);

  renderBtn.addEventListener("click", () => {
    void renderPreview();
  });

  clearBtn.addEventListener("click", () => {
    window.clearTimeout(state.renderTimer);
    state.file = null;
    state.frames = [];
    state.width = 0;
    state.height = 0;
    state.output = null;
    state.sampling = false;
    fileInput.value = "";
    formatSelect.value = "gif";
    previewBgSelect.value = "checkerboard";
    toleranceInput.value = "24";
    edgeCleanupInput.value = "1";
    edgeFeatherInput.value = "18";
    setColor("#ffffff", false);
    syncToleranceLabel();
    syncEdgeLabels();
    syncPreviewBackground();
    clearPreview();
    renderFileName();
    renderSourceFrame();
    setStatus(t("noFile"), "idle");
    toast(t("cleared"), "success");
  });

  downloadBtn.addEventListener("click", () => {
    if (!state.output || !state.file) {
      toast(t("noPreview"));
      return;
    }
    const ext = state.output.format === "apng" ? "png" : state.output.format;
    downloadBlob(state.output.blob, t("outputName", { name: getFileStem(state.file.name), ext }));
  });

  const resizeObserver = new ResizeObserver(renderSourceFrame);
  resizeObserver.observe(sourceWrap.parentElement || sourceWrap);

  onLanguageChange(() => {
    renderFileName();
    renderOutputMeta();
    if (state.outputUrl) {
      previewImage.alt = t("previewAlt");
    }
    if (!state.frames.length) {
      setStatus(t("noFile"), "idle");
    } else if (state.output) {
      setStatus(t("rendered"), "success");
    }
  });

  window.addEventListener("pagehide", () => {
    resizeObserver.disconnect();
    revokeOutputUrl();
  });

  renderFileName();
  renderSourceFrame();
  syncToleranceLabel();
  syncEdgeLabels();
  syncPreviewBackground();
  setStatus(t("noFile"), "idle");
}
