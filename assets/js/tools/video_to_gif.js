import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { bindDragDrop } from "/assets/components/drag.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { canvasToBlob, formatBytes } from "/assets/js/utils.js?v=1.6.26";

const MAX_STAGE_WIDTH = 960;
const MAX_STAGE_HEIGHT = 680;
const MIN_CROP_SIZE = 24;

const GIF_CRC_TABLE = (() => {
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
    noVideo: "請先載入影片。",
    badRange: "結束時間必須大於起始時間。",
    badNumber: "請輸入有效數值。",
    loaded: "已載入影片。",
    loadingFrame: "正在同步裁切預覽畫面...",
    readyCrop: "可開始調整裁切範圍，或直接產生預覽。",
    rendering: "正在擷取影格並產生動畫預覽，時間會依片段長度而定。",
    rendered: "動畫預覽已完成。",
    cleared: "已清除影片與預覽。",
    cropReset: "已重設裁切範圍。",
    frameSynced: "已同步目前畫面到裁切區。",
    cropEmpty: "載入影片後，可同步目前畫面並拖曳裁切框。",
    previewEmpty: "產生預覽後會顯示動畫效果。",
    previewHint: "會直接預覽轉換後的 GIF / WEBP / APNG。",
    noPreview: "尚未產生預覽。",
    fileEmpty: "尚未載入影片。",
    fileName: "目前影片：{name}",
    sourceName: "檔名",
    sourceSize: "影片尺寸",
    sourceDuration: "影片長度",
    cropSize: "裁切尺寸",
    cropOrigin: "裁切起點",
    outputSize: "輸出尺寸",
    outputFrames: "輸出幀數",
    outputDuration: "輸出長度",
    outputFileSize: "檔案大小",
    outputFormat: "輸出格式",
    speedHint: "{speed} 倍，維持輸出幀數總數。",
    frameStepHint: "每 {step} 幀抓取一次，維持播放速度。",
    closePreview: "關閉",
    previewAlt: "動畫預覽",
    unsupported: "目前瀏覽器不支援這個影片處理流程。",
    outputName: "{name}.{ext}"
  },
  en: {
    invalid: "Invalid input format",
    noVideo: "Please load a video first.",
    badRange: "End time must be greater than start time.",
    badNumber: "Please enter valid values.",
    loaded: "Video loaded.",
    loadingFrame: "Syncing the current frame to the crop stage...",
    readyCrop: "You can now adjust the crop area or render the preview.",
    rendering: "Capturing frames and generating the animated preview. Processing time depends on clip length.",
    rendered: "Animated preview generated.",
    cleared: "Video and preview cleared.",
    cropReset: "Crop area reset.",
    frameSynced: "Current frame synced to the crop stage.",
    cropEmpty: "Load a video, sync a frame, then drag the crop box.",
    previewEmpty: "The animated preview appears after rendering.",
    previewHint: "The converted GIF / WEBP / APNG will be previewed here.",
    noPreview: "No preview yet.",
    fileEmpty: "No video loaded yet.",
    fileName: "Current video: {name}",
    sourceName: "Filename",
    sourceSize: "Video size",
    sourceDuration: "Video duration",
    cropSize: "Crop size",
    cropOrigin: "Crop origin",
    outputSize: "Output size",
    outputFrames: "Output frames",
    outputDuration: "Output duration",
    outputFileSize: "File size",
    outputFormat: "Output format",
    speedHint: "{speed}x, keeping the total output frame count.",
    frameStepHint: "Capture every {step} frame(s), keeping playback speed.",
    closePreview: "Close",
    previewAlt: "Animated preview",
    unsupported: "This browser does not support the required video processing flow.",
    outputName: "{name}.{ext}"
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
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  return stem || "animation";
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(eventName));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function ensureVideoMetadata(video) {
  if (Number.isFinite(video.duration) && video.videoWidth > 0 && video.videoHeight > 0) {
    return;
  }
  await waitForEvent(video, "loadedmetadata");
}

async function seekVideo(video, time) {
  const safeTime = clamp(time, 0, Number.isFinite(video.duration) ? video.duration : time);
  if (Math.abs(video.currentTime - safeTime) < 0.002) {
    return;
  }
  await new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("seek"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = safeTime;
  });
}

function getDisplayMetrics(width, height, stageWidth) {
  const safeStageWidth = Math.max(240, stageWidth || 240);
  const scale = Math.min(MAX_STAGE_WIDTH / width, MAX_STAGE_HEIGHT / height, safeStageWidth / width, 1);
  return {
    scale,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function getCropAspect(rect) {
  return rect.width / rect.height;
}

function createUint16LE(value) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function createUint16BE(value) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, false);
  return bytes;
}

function createUint32BE(value) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, false);
  return bytes;
}

function createUint32LE(value) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function createUint24LE(value) {
  const safe = value >>> 0;
  return new Uint8Array([safe & 0xff, (safe >>> 8) & 0xff, (safe >>> 16) & 0xff]);
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
    crc = GIF_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const content = concatUint8Arrays([typeBytes, data]);
  return concatUint8Arrays([
    createUint32BE(data.length),
    typeBytes,
    data,
    createUint32BE(crc32(content))
  ]);
}

function makeRiffChunk(type, payload) {
  const typeBytes = new TextEncoder().encode(type);
  const pad = payload.length % 2 === 1 ? new Uint8Array([0]) : new Uint8Array();
  return concatUint8Arrays([typeBytes, createUint32LE(payload.length), payload, pad]);
}

function parsePngIdatData(bytes) {
  const decoder = new TextDecoder("latin1");
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const hasValidSignature = signature.every((value, index) => bytes[index] === value);
  if (!hasValidSignature) {
    throw new Error("png");
  }

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
  let offset = 12;
  let hasAlpha = false;
  while (offset + 8 <= bytes.length) {
    const fourCC = decoder.decode(bytes.slice(offset, offset + 4));
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const chunkEnd = offset + 8 + size + (size % 2);
    if (fourCC === "ALPH" || fourCC === "VP8 " || fourCC === "VP8L") {
      chunks.push(bytes.slice(offset, chunkEnd));
      if (fourCC === "ALPH" || fourCC === "VP8L") {
        hasAlpha = true;
      }
    }
    offset = chunkEnd;
  }

  return {
    data: concatUint8Arrays(chunks),
    hasAlpha
  };
}

function quantizeRgb332(r, g, b) {
  return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
}

function buildGifPalette() {
  const palette = new Uint8Array(256 * 3);
  for (let index = 0; index < 256; index += 1) {
    const r = (index >> 5) & 0x07;
    const g = (index >> 2) & 0x07;
    const b = index & 0x03;
    palette[index * 3] = Math.round((r / 7) * 255);
    palette[index * 3 + 1] = Math.round((g / 7) * 255);
    palette[index * 3 + 2] = Math.round((b / 3) * 255);
  }
  return palette;
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
  const clearInterval = 128;

  for (let index = 0; index < codes.length; index += clearInterval) {
    pushCode(clearCode);
    const limit = Math.min(index + clearInterval, codes.length);
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
    blocks.push(new Uint8Array([block.length]));
    blocks.push(block);
  }
  blocks.push(new Uint8Array([0]));
  return concatUint8Arrays(blocks);
}

function encodeGif(frames, width, height) {
  const palette = buildGifPalette();
  const parts = [];
  const header = new TextEncoder().encode("GIF89a");
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
  parts.push(header, screenDescriptor, palette, loopExtension);

  frames.forEach((frame) => {
    const indexed = new Uint8Array(width * height);
    const pixels = frame.imageData.data;
    for (let offset = 0, index = 0; offset < pixels.length; offset += 4, index += 1) {
      indexed[index] = quantizeRgb332(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    }

    const delayCs = Math.max(2, Math.round(frame.delayMs / 10));
    const gce = new Uint8Array([0x21, 0xf9, 0x04, 0x00, delayCs & 0xff, (delayCs >>> 8) & 0xff, 0x00, 0x00]);
    const imageDescriptor = concatUint8Arrays([
      new Uint8Array([0x2c]),
      createUint16LE(0),
      createUint16LE(0),
      createUint16LE(width),
      createUint16LE(height),
      new Uint8Array([0x00])
    ]);
    const compressed = packGifCodes(indexed, 8);
    parts.push(gce, imageDescriptor, new Uint8Array([0x08]), gifSubBlocks(compressed));
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

  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = concatUint8Arrays([
    createUint32BE(width),
    createUint32BE(height),
    new Uint8Array([8, 6, 0, 0, 0])
  ]);
  const chunks = [pngSignature, makePngChunk("IHDR", ihdrData)];
  chunks.push(makePngChunk("acTL", concatUint8Arrays([createUint32BE(frames.length), createUint32BE(0)])));

  let sequence = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    tempContext.putImageData(frame.imageData, 0, 0);
    const pngBlob = await canvasToBlob(tempCanvas, "image/png");
    const idatData = parsePngIdatData(new Uint8Array(await pngBlob.arrayBuffer()));
    const delayNum = Math.max(1, Math.min(65535, Math.round(frame.delayMs)));
    const fcTL = concatUint8Arrays([
      createUint32BE(sequence++),
      createUint32BE(width),
      createUint32BE(height),
      createUint32BE(0),
      createUint32BE(0),
      createUint16BE(delayNum),
      createUint16BE(1000),
      new Uint8Array([0x00, 0x00])
    ]);
    chunks.push(makePngChunk("fcTL", fcTL));

    if (index === 0) {
      chunks.push(makePngChunk("IDAT", idatData));
      continue;
    }

    const fdAT = concatUint8Arrays([createUint32BE(sequence++), idatData]);
    chunks.push(makePngChunk("fdAT", fdAT));
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
  let hasAlpha = false;
  for (const frame of frames) {
    tempContext.putImageData(frame.imageData, 0, 0);
    const webpBlob = await canvasToBlob(tempCanvas, "image/webp", 0.9);
    const parsed = parseWebPFrameChunks(new Uint8Array(await webpBlob.arrayBuffer()));
    frameChunks.push({ delayMs: frame.delayMs, chunkData: parsed.data });
    hasAlpha ||= parsed.hasAlpha;
  }

  const vp8xFlags = (hasAlpha ? 0x10 : 0x00) | 0x02;
  const vp8xPayload = concatUint8Arrays([
    new Uint8Array([vp8xFlags, 0x00, 0x00, 0x00]),
    createUint24LE(width - 1),
    createUint24LE(height - 1)
  ]);
  const animPayload = concatUint8Arrays([
    new Uint8Array([255, 255, 255, 255]),
    createUint16LE(0)
  ]);

  const riffChunks = [makeRiffChunk("VP8X", vp8xPayload), makeRiffChunk("ANIM", animPayload)];
  frameChunks.forEach((frame) => {
    const anmfHeader = concatUint8Arrays([
      createUint24LE(0),
      createUint24LE(0),
      createUint24LE(width - 1),
      createUint24LE(height - 1),
      createUint24LE(Math.max(10, Math.min(16777215, Math.round(frame.delayMs)))),
      new Uint8Array([0x00])
    ]);
    riffChunks.push(makeRiffChunk("ANMF", concatUint8Arrays([anmfHeader, frame.chunkData])));
  });

  const body = concatUint8Arrays(riffChunks);
  const header = concatUint8Arrays([
    new TextEncoder().encode("RIFF"),
    createUint32LE(4 + body.length),
    new TextEncoder().encode("WEBP")
  ]);
  return new Blob([header, body], { type: "image/webp" });
}

async function captureFrames({
  src,
  startTime,
  endTime,
  cropRect,
  outputWidth,
  outputHeight,
  frameStep,
  speed,
  onProgress
}) {
  const video = document.createElement("video");
  video.src = src;
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  await ensureVideoMetadata(video);
  await seekVideo(video, startTime);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("canvas");
  }

  const keptFrames = [];
  let rawFrameIndex = 0;
  let finished = false;

  const pushFrame = (time) => {
    context.clearRect(0, 0, outputWidth, outputHeight);
    context.drawImage(
      video,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      outputWidth,
      outputHeight
    );
    keptFrames.push({
      time,
      imageData: context.getImageData(0, 0, outputWidth, outputHeight)
    });
  };

  pushFrame(startTime);

  const finish = () => {
    finished = true;
    video.pause();
  };

  await new Promise((resolve, reject) => {
    const onEnded = () => {
      finish();
      cleanup();
      resolve();
    };
    const cleanup = () => {
      video.removeEventListener("ended", onEnded);
    };
    video.addEventListener("ended", onEnded, { once: true });

    if (typeof video.requestVideoFrameCallback !== "function") {
      cleanup();
      reject(new Error("unsupported"));
      return;
    }

    const stepFrames = Math.max(1, Math.round(frameStep));
    const epsilon = 0.0005;

    const handleFrame = (_now, metadata) => {
      if (finished) {
        cleanup();
        resolve();
        return;
      }

      const mediaTime = metadata.mediaTime ?? video.currentTime;
      if (mediaTime <= startTime + epsilon) {
        video.requestVideoFrameCallback(handleFrame);
        return;
      }

      if (mediaTime >= endTime - epsilon) {
        finish();
        cleanup();
        resolve();
        return;
      }

      rawFrameIndex += 1;
      if (rawFrameIndex % stepFrames === 0) {
        pushFrame(mediaTime);
        onProgress?.(mediaTime);
      }

      video.requestVideoFrameCallback(handleFrame);
    };

    video.requestVideoFrameCallback(handleFrame);
    video.play().catch((error) => {
      finish();
      cleanup();
      reject(error);
    });
  });

  if (!keptFrames.length) {
    throw new Error("frames");
  }

  const frames = keptFrames.map((frame, index) => {
    const nextTime = index < keptFrames.length - 1 ? keptFrames[index + 1].time : endTime;
    const rawDelayMs = Math.max(10, Math.round((nextTime - frame.time) * 1000));
    return {
      imageData: frame.imageData,
      delayMs: Math.max(10, Math.round(rawDelayMs / speed))
    };
  });

  const durationMs = frames.reduce((sum, frame) => sum + frame.delayMs, 0);
  return {
    frames,
    durationMs
  };
}

export default function initVideoToGif() {
  const dropZone = document.querySelector("#vtg-drop-zone");
  const fileInput = document.querySelector("#vtg-file");
  const fileName = document.querySelector("#vtg-file-name");
  const sourceVideo = document.querySelector("#vtg-source-video");
  const startInput = document.querySelector("#vtg-start-time");
  const endInput = document.querySelector("#vtg-end-time");
  const startLabel = document.querySelector("#vtg-start-label");
  const endLabel = document.querySelector("#vtg-end-label");
  const speedInput = document.querySelector("#vtg-speed");
  const frameStepInput = document.querySelector("#vtg-frame-step");
  const speedHint = document.querySelector("#vtg-speed-hint");
  const frameStepHint = document.querySelector("#vtg-frame-step-hint");
  const formatSelect = document.querySelector("#vtg-output-format");
  const widthInput = document.querySelector("#vtg-width");
  const heightInput = document.querySelector("#vtg-height");
  const previewTimeInput = document.querySelector("#vtg-preview-time");
  const previewLabel = document.querySelector("#vtg-preview-label");
  const setStartBtn = document.querySelector("#vtg-set-start-btn");
  const setEndBtn = document.querySelector("#vtg-set-end-btn");
  const syncFrameBtn = document.querySelector("#vtg-sync-frame-btn");
  const resetCropBtn = document.querySelector("#vtg-reset-crop-btn");
  const renderBtn = document.querySelector("#vtg-render-btn");
  const clearBtn = document.querySelector("#vtg-clear-btn");
  const status = document.querySelector("#vtg-status");
  const cropEmpty = document.querySelector("#vtg-crop-empty");
  const cropWrap = document.querySelector("#vtg-crop-wrap");
  const cropCanvas = document.querySelector("#vtg-crop-canvas");
  const sourceMeta = document.querySelector("#vtg-source-meta");
  const cropMeta = document.querySelector("#vtg-crop-meta");
  const previewEmpty = document.querySelector("#vtg-preview-empty");
  const previewImage = document.querySelector("#vtg-preview-image");
  const previewHint = document.querySelector("#vtg-preview-hint");
  const outputMeta = document.querySelector("#vtg-output-meta");
  const downloadBtn = document.querySelector("#vtg-download-btn");

  if (
    !dropZone ||
    !fileInput ||
    !fileName ||
    !sourceVideo ||
    !startInput ||
    !endInput ||
    !startLabel ||
    !endLabel ||
    !speedInput ||
    !frameStepInput ||
    !speedHint ||
    !frameStepHint ||
    !formatSelect ||
    !widthInput ||
    !heightInput ||
    !previewTimeInput ||
    !previewLabel ||
    !setStartBtn ||
    !setEndBtn ||
    !syncFrameBtn ||
    !resetCropBtn ||
    !renderBtn ||
    !clearBtn ||
    !status ||
    !cropEmpty ||
    !cropWrap ||
    !cropCanvas ||
    !sourceMeta ||
    !cropMeta ||
    !previewEmpty ||
    !previewImage ||
    !previewHint ||
    !outputMeta ||
    !downloadBtn
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 影片轉 GIF / WebP / APNG",
      en: "ToolNestTW Video to GIF / WebP / APNG"
    },
    text: {
      ".hero h1": { zh: "影片轉 GIF / WebP / APNG", en: "Video to GIF / WebP / APNG" },
      ".hero .lead": {
        zh: "上傳影片後可設定倍速、抽幀、裁切範圍與尺寸，並即時預覽輸出效果。",
        en: "Upload a video, set speed, frame step, crop area, and size, then preview the animated output instantly."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "設定", en: "Settings" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "裁切範圍", en: "Crop Area" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "預覽與下載", en: "Preview & Download" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(7) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#vtg-drop-zone strong": { zh: "拖曳單支影片到這裡", en: "Drop one video here" },
      "#vtg-drop-zone .hint": {
        zh: "或手動選擇影片，全部在瀏覽器本機處理",
        en: "or choose a video manually. Everything runs locally in your browser."
      },
      'label[for="vtg-start-time"]': { zh: "起始時間 (秒)", en: "Start Time (sec)" },
      'label[for="vtg-end-time"]': { zh: "結束時間 (秒)", en: "End Time (sec)" },
      'label[for="vtg-speed"]': { zh: "輸出倍速", en: "Output Speed" },
      'label[for="vtg-frame-step"]': { zh: "每幾幀抓取一次", en: "Capture Every N Frames" },
      'label[for="vtg-output-format"]': { zh: "輸出格式", en: "Output Format" },
      'label[for="vtg-width"]': { zh: "輸出寬度", en: "Output Width" },
      'label[for="vtg-height"]': { zh: "輸出高度", en: "Output Height" },
      'label[for="vtg-preview-time"]': { zh: "裁切預覽時間 (秒)", en: "Crop Preview Time (sec)" },
      "#vtg-format-hint": { zh: "預設 GIF。", en: "GIF is the default." },
      "#vtg-width-hint": { zh: "輸入寬度會自動換算高度。", en: "Height updates automatically." },
      "#vtg-height-hint": { zh: "輸入高度會自動換算寬度。", en: "Width updates automatically." },
      "#vtg-set-start-btn": { zh: "設為目前起點", en: "Set as Start" },
      "#vtg-set-end-btn": { zh: "設為目前終點", en: "Set as End" },
      "#vtg-sync-frame-btn": { zh: "同步目前畫面到裁切區", en: "Sync Current Frame to Crop Stage" },
      "#vtg-reset-crop-btn": { zh: "重設裁切", en: "Reset Crop" },
      "#vtg-render-btn": { zh: "產生預覽", en: "Render Preview" },
      "#vtg-clear-btn": { zh: "清除", en: "Clear" },
      "#vtg-crop-hint": {
        zh: "可拖曳框內移動，或拉四個角調整範圍。",
        en: "Drag inside the box to move it, or drag the four corners to resize."
      },
      "#vtg-source-meta-title": { zh: "來源資訊", en: "Source Details" },
      "#vtg-crop-meta-title": { zh: "裁切資訊", en: "Crop Details" },
      "#vtg-preview-title": { zh: "輸出預覽", en: "Output Preview" },
      "#vtg-output-meta-title": { zh: "輸出資訊", en: "Output Details" },
      "#vtg-download-btn": { zh: "下載檔案", en: "Download File" },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "1. 上傳影片後，設定起訖時間、倍速、抽幀與輸出格式。",
        en: "1. Upload a video, then set the time range, speed, frame step, and output format."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "2. 在播放器停在想看的畫面，再同步到裁切區調整輸出範圍。",
        en: "2. Pause the player on the frame you want, then sync it to the crop stage and adjust the output area."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(3)": {
        zh: "3. 產生預覽確認效果後，再下載 GIF、WEBP 或 APNG。",
        en: "3. Render the preview, verify the result, then download GIF, WEBP, or APNG."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(1)": {
        zh: "影片會上傳嗎？ 不會，全部在瀏覽器本機處理。",
        en: "Is the video uploaded? No, everything is processed locally in your browser."
      },
      ".tool-page > .panel:nth-of-type(6) p:nth-of-type(2)": {
        zh: "倍速與抽幀差別是什麼？ 倍速會改變每幀延遲、維持輸出幀數；抽幀會減少抓取的畫格，但維持播放速度。",
        en: "What is the difference between speed and frame step? Speed changes frame delay while keeping frame count, and frame step reduces captured frames while keeping playback speed."
      }
    }
  });

  const cropContext = cropCanvas.getContext("2d");
  if (!cropContext) {
    return;
  }

  const state = {
    file: null,
    objectUrl: "",
    duration: 0,
    videoWidth: 0,
    videoHeight: 0,
    cropRect: null,
    display: { scale: 1, width: 0, height: 0 },
    frameCanvas: null,
    frameContext: null,
    output: null,
    outputUrl: "",
    drag: null,
    dimensionMode: "auto",
    busy: false
  };

  function setBusy(value) {
    state.busy = value;
    renderBtn.disabled = value;
    resetCropBtn.disabled = value;
    syncFrameBtn.disabled = value;
    setStartBtn.disabled = value;
    setEndBtn.disabled = value;
    clearBtn.disabled = value;
    fileInput.disabled = value;
  }

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

  function revokeOutputUrl() {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = "";
    }
  }

  function clearPreview() {
    revokeOutputUrl();
    state.output = null;
    previewImage.hidden = true;
    previewImage.removeAttribute("src");
    previewImage.alt = "";
    previewEmpty.hidden = false;
    previewEmpty.textContent = t("previewEmpty");
    outputMeta.textContent = "";
    previewHint.textContent = t("previewHint");
    downloadBtn.disabled = true;
  }

  function renderFileMeta() {
    fileName.textContent = state.file ? t("fileName", { name: state.file.name }) : t("fileEmpty");
  }

  function renderSourceMeta() {
    if (!state.file) {
      sourceMeta.textContent = "";
      return;
    }
    const rows = [
      `${t("sourceName")}: ${state.file.name}`,
      `${t("sourceSize")}: ${state.videoWidth} x ${state.videoHeight}`,
      `${t("sourceDuration")}: ${formatTime(state.duration)}`
    ];
    sourceMeta.replaceChildren(
      ...rows.map((text) => {
        const node = document.createElement("span");
        node.textContent = text;
        return node;
      })
    );
  }

  function renderCropMeta() {
    if (!state.cropRect) {
      cropMeta.textContent = "";
      return;
    }
    const rows = [
      `${t("cropOrigin")}: ${Math.round(state.cropRect.x)}, ${Math.round(state.cropRect.y)}`,
      `${t("cropSize")}: ${Math.round(state.cropRect.width)} x ${Math.round(state.cropRect.height)}`
    ];
    cropMeta.replaceChildren(
      ...rows.map((text) => {
        const node = document.createElement("span");
        node.textContent = text;
        return node;
      })
    );
  }

  function renderOutputMeta() {
    if (!state.output) {
      outputMeta.textContent = "";
      return;
    }
    const rows = [
      `${t("outputFormat")}: ${state.output.format.toUpperCase()}`,
      `${t("outputSize")}: ${state.output.width} x ${state.output.height}`,
      `${t("outputFrames")}: ${state.output.frameCount}`,
      `${t("outputDuration")}: ${formatTime(state.output.durationMs / 1000)}`,
      `${t("outputFileSize")}: ${formatBytes(state.output.blob.size)}`
    ];
    outputMeta.replaceChildren(
      ...rows.map((text) => {
        const node = document.createElement("span");
        node.textContent = text;
        return node;
      })
    );
  }

  function updateTimeLabels() {
    startLabel.textContent = formatTime(Number(startInput.value));
    endLabel.textContent = formatTime(Number(endInput.value));
    previewLabel.textContent = formatTime(Number(previewTimeInput.value));
    speedHint.textContent = t("speedHint", { speed: Number(speedInput.value || 1) });
    frameStepHint.textContent = t("frameStepHint", { step: Math.max(1, Math.round(Number(frameStepInput.value || 1))) });
  }

  function getCropAspectSafe() {
    return state.cropRect ? getCropAspect(state.cropRect) : 1;
  }

  function syncDimensionInputs(reason = "auto") {
    if (!state.cropRect) {
      return;
    }
    const aspect = getCropAspectSafe();
    if (reason === "auto" || state.dimensionMode === "auto") {
      widthInput.value = String(Math.round(state.cropRect.width));
      heightInput.value = String(Math.round(state.cropRect.height));
      state.dimensionMode = "auto";
      return;
    }
    if (state.dimensionMode === "width") {
      const width = Math.max(1, Math.round(Number(widthInput.value) || state.cropRect.width));
      widthInput.value = String(width);
      heightInput.value = String(Math.max(1, Math.round(width / aspect)));
      return;
    }
    const height = Math.max(1, Math.round(Number(heightInput.value) || state.cropRect.height));
    heightInput.value = String(height);
    widthInput.value = String(Math.max(1, Math.round(height * aspect)));
  }

  function drawCropStage() {
    if (!state.frameCanvas || !state.cropRect) {
      cropEmpty.hidden = false;
      cropWrap.hidden = true;
      cropEmpty.textContent = t("cropEmpty");
      return;
    }

    cropEmpty.hidden = true;
    cropWrap.hidden = false;

    const metrics = getDisplayMetrics(state.frameCanvas.width, state.frameCanvas.height, cropWrap.parentElement?.clientWidth || cropWrap.clientWidth || 480);
    state.display = metrics;
    const dpr = window.devicePixelRatio || 1;
    cropCanvas.width = Math.round(metrics.width * dpr);
    cropCanvas.height = Math.round(metrics.height * dpr);
    cropCanvas.style.width = `${metrics.width}px`;
    cropCanvas.style.height = `${metrics.height}px`;
    cropContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    cropContext.clearRect(0, 0, metrics.width, metrics.height);
    cropContext.drawImage(state.frameCanvas, 0, 0, metrics.width, metrics.height);

    const rect = {
      x: state.cropRect.x * metrics.scale,
      y: state.cropRect.y * metrics.scale,
      width: state.cropRect.width * metrics.scale,
      height: state.cropRect.height * metrics.scale
    };

    cropContext.fillStyle = "rgba(0, 0, 0, 0.45)";
    cropContext.fillRect(0, 0, metrics.width, rect.y);
    cropContext.fillRect(0, rect.y, rect.x, rect.height);
    cropContext.fillRect(rect.x + rect.width, rect.y, metrics.width - rect.x - rect.width, rect.height);
    cropContext.fillRect(0, rect.y + rect.height, metrics.width, metrics.height - rect.y - rect.height);

    cropContext.strokeStyle = "#1659d6";
    cropContext.lineWidth = 2;
    cropContext.strokeRect(rect.x, rect.y, rect.width, rect.height);

    cropContext.setLineDash([6, 4]);
    cropContext.strokeStyle = "rgba(22, 89, 214, 0.7)";
    cropContext.beginPath();
    cropContext.moveTo(rect.x + rect.width / 3, rect.y);
    cropContext.lineTo(rect.x + rect.width / 3, rect.y + rect.height);
    cropContext.moveTo(rect.x + (rect.width * 2) / 3, rect.y);
    cropContext.lineTo(rect.x + (rect.width * 2) / 3, rect.y + rect.height);
    cropContext.moveTo(rect.x, rect.y + rect.height / 3);
    cropContext.lineTo(rect.x + rect.width, rect.y + rect.height / 3);
    cropContext.moveTo(rect.x, rect.y + (rect.height * 2) / 3);
    cropContext.lineTo(rect.x + rect.width, rect.y + (rect.height * 2) / 3);
    cropContext.stroke();
    cropContext.setLineDash([]);

    const handles = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ];
    cropContext.fillStyle = "#ffffff";
    cropContext.strokeStyle = "#bf2445";
    handles.forEach((handle) => {
      cropContext.beginPath();
      cropContext.rect(handle.x - 5, handle.y - 5, 10, 10);
      cropContext.fill();
      cropContext.stroke();
    });
  }

  function getPointFromEvent(event) {
    if (!state.cropRect) {
      return null;
    }
    const rect = cropCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return null;
    }
    return {
      displayX: x,
      displayY: y,
      sourceX: x / state.display.scale,
      sourceY: y / state.display.scale
    };
  }

  function getCropHit(point) {
    const rect = state.cropRect;
    if (!rect) {
      return null;
    }
    const threshold = 10 / state.display.scale;
    const corners = {
      nw: { x: rect.x, y: rect.y },
      ne: { x: rect.x + rect.width, y: rect.y },
      se: { x: rect.x + rect.width, y: rect.y + rect.height },
      sw: { x: rect.x, y: rect.y + rect.height }
    };
    const hitCorner = Object.entries(corners).find(([, corner]) => {
      return Math.abs(point.sourceX - corner.x) <= threshold && Math.abs(point.sourceY - corner.y) <= threshold;
    });
    if (hitCorner) {
      return hitCorner[0];
    }
    if (
      point.sourceX >= rect.x &&
      point.sourceX <= rect.x + rect.width &&
      point.sourceY >= rect.y &&
      point.sourceY <= rect.y + rect.height
    ) {
      return "move";
    }
    return null;
  }

  function applyDrag(point) {
    if (!state.drag || !state.cropRect) {
      return;
    }

    const start = state.drag.startRect;
    const dx = point.sourceX - state.drag.startPoint.x;
    const dy = point.sourceY - state.drag.startPoint.y;
    let next = { ...start };

    if (state.drag.mode === "move") {
      next.x = clamp(start.x + dx, 0, state.videoWidth - start.width);
      next.y = clamp(start.y + dy, 0, state.videoHeight - start.height);
    } else if (state.drag.mode === "nw") {
      const right = start.x + start.width;
      const bottom = start.y + start.height;
      next.x = clamp(start.x + dx, 0, right - MIN_CROP_SIZE);
      next.y = clamp(start.y + dy, 0, bottom - MIN_CROP_SIZE);
      next.width = right - next.x;
      next.height = bottom - next.y;
    } else if (state.drag.mode === "ne") {
      const left = start.x;
      const bottom = start.y + start.height;
      const right = clamp(start.x + start.width + dx, left + MIN_CROP_SIZE, state.videoWidth);
      next.y = clamp(start.y + dy, 0, bottom - MIN_CROP_SIZE);
      next.x = left;
      next.width = right - left;
      next.height = bottom - next.y;
    } else if (state.drag.mode === "se") {
      next.width = clamp(start.width + dx, MIN_CROP_SIZE, state.videoWidth - start.x);
      next.height = clamp(start.height + dy, MIN_CROP_SIZE, state.videoHeight - start.y);
    } else if (state.drag.mode === "sw") {
      const right = start.x + start.width;
      const top = start.y;
      next.x = clamp(start.x + dx, 0, right - MIN_CROP_SIZE);
      next.width = right - next.x;
      next.height = clamp(start.height + dy, MIN_CROP_SIZE, state.videoHeight - top);
      next.y = top;
    }

    state.cropRect = next;
    renderCropMeta();
    syncDimensionInputs("crop");
    clearPreview();
    drawCropStage();
  }

  async function syncFrameFromVideo(time = Number(previewTimeInput.value) || 0, fromCurrent = false) {
    if (!state.file) {
      toast(t("noVideo"));
      return;
    }

    setStatus(t("loadingFrame"), "working");
    try {
      const targetTime = fromCurrent ? sourceVideo.currentTime : time;
      await seekVideo(sourceVideo, targetTime);
      previewTimeInput.value = String(targetTime);
      updateTimeLabels();

      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = state.videoWidth;
      frameCanvas.height = state.videoHeight;
      const frameContext = frameCanvas.getContext("2d");
      if (!frameContext) {
        throw new Error("canvas");
      }
      frameContext.drawImage(sourceVideo, 0, 0, state.videoWidth, state.videoHeight);
      state.frameCanvas = frameCanvas;
      state.frameContext = frameContext;
      drawCropStage();
      setStatus(t("frameSynced"), "success");
    } catch {
      setStatus(t("invalid"), "warning");
      toast(t("invalid"));
    }
  }

  function resetCropRect() {
    if (!state.file) {
      return;
    }
    state.cropRect = {
      x: 0,
      y: 0,
      width: state.videoWidth,
      height: state.videoHeight
    };
    renderCropMeta();
    syncDimensionInputs("auto");
    clearPreview();
    drawCropStage();
  }

  async function applyVideoFile(file) {
    try {
      if (state.objectUrl) {
        URL.revokeObjectURL(state.objectUrl);
      }
      state.file = file;
      state.objectUrl = URL.createObjectURL(file);
      sourceVideo.src = state.objectUrl;
      sourceVideo.hidden = false;
      sourceVideo.currentTime = 0;
      await ensureVideoMetadata(sourceVideo);

      state.duration = sourceVideo.duration;
      state.videoWidth = sourceVideo.videoWidth;
      state.videoHeight = sourceVideo.videoHeight;
      startInput.value = "0";
      endInput.value = String(state.duration.toFixed(3));
      previewTimeInput.value = "0";
      resetCropRect();
      renderFileMeta();
      renderSourceMeta();
      updateTimeLabels();
      await syncFrameFromVideo(0);
      setStatus(t("loaded"), "success");
      toast(t("loaded"), "success");
    } catch {
      toast(t("invalid"));
    }
  }

  async function readFiles(files) {
    const videoFile = Array.from(files || []).find((file) => file.type.startsWith("video/"));
    if (!videoFile) {
      toast(t("invalid"));
      return;
    }
    await applyVideoFile(videoFile);
  }

  function validateSettings() {
    if (!state.file || !state.cropRect) {
      throw new Error("noVideo");
    }

    const start = Number(startInput.value);
    const end = Number(endInput.value);
    const speed = Number(speedInput.value);
    const frameStep = Math.max(1, Math.round(Number(frameStepInput.value)));
    const width = Math.round(Number(widthInput.value));
    const height = Math.round(Number(heightInput.value));

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(speed) ||
      !Number.isFinite(frameStep) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      throw new Error("badNumber");
    }

    if (end <= start) {
      throw new Error("badRange");
    }

    if (speed <= 0 || frameStep < 1 || width < 1 || height < 1) {
      throw new Error("badNumber");
    }

    return {
      start,
      end: Math.min(end, state.duration),
      speed,
      frameStep,
      width,
      height,
      format: formatSelect.value
    };
  }

  async function renderPreview() {
    let config;
    try {
      config = validateSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid";
      if (message === "badRange") {
        toast(t("badRange"));
        return;
      }
      if (message === "badNumber") {
        toast(t("badNumber"));
        return;
      }
      toast(t("noVideo"));
      return;
    }

    if (typeof HTMLVideoElement.prototype.requestVideoFrameCallback !== "function") {
      toast(t("unsupported"));
      return;
    }

    setBusy(true);
    clearPreview();
    setStatus(t("rendering"), "working");

    try {
      const capture = await captureFrames({
        src: state.objectUrl,
        startTime: config.start,
        endTime: config.end,
        cropRect: state.cropRect,
        outputWidth: config.width,
        outputHeight: config.height,
        frameStep: config.frameStep,
        speed: config.speed,
        onProgress: (mediaTime) => {
          setStatus(`${t("rendering")} ${formatTime(mediaTime)} / ${formatTime(config.end)}`, "working");
        }
      });

      let blob;
      if (config.format === "gif") {
        blob = encodeGif(capture.frames, config.width, config.height);
      } else if (config.format === "apng") {
        blob = await encodeApng(capture.frames, config.width, config.height);
      } else {
        blob = await encodeAnimatedWebP(capture.frames, config.width, config.height);
      }

      revokeOutputUrl();
      state.outputUrl = URL.createObjectURL(blob);
      state.output = {
        blob,
        format: config.format,
        frameCount: capture.frames.length,
        durationMs: capture.durationMs,
        width: config.width,
        height: config.height
      };

      previewEmpty.hidden = true;
      previewImage.hidden = false;
      previewImage.src = state.outputUrl;
      previewImage.alt = t("previewAlt");
      downloadBtn.disabled = false;
      renderOutputMeta();
      setStatus(t("rendered"), "success");
      toast(t("rendered"), "success");
    } catch (error) {
      console.error(error);
      clearPreview();
      setStatus(t("invalid"), "warning");
      toast(t("invalid"));
    } finally {
      setBusy(false);
    }
  }

  bindDragDrop({
    dropZone,
    fileInput,
    onFiles: readFiles
  });

  sourceVideo.addEventListener("loadedmetadata", () => {
    if (!state.file) {
      return;
    }
    state.duration = sourceVideo.duration;
    state.videoWidth = sourceVideo.videoWidth;
    state.videoHeight = sourceVideo.videoHeight;
    endInput.value = String(state.duration.toFixed(3));
    previewTimeInput.max = String(state.duration);
    startInput.max = String(state.duration);
    endInput.max = String(state.duration);
    renderSourceMeta();
    updateTimeLabels();
  });

  startInput.addEventListener("input", () => {
    if (!state.file) {
      return;
    }
    startInput.value = String(clamp(Number(startInput.value || 0), 0, state.duration));
    updateTimeLabels();
    clearPreview();
  });

  endInput.addEventListener("input", () => {
    if (!state.file) {
      return;
    }
    endInput.value = String(clamp(Number(endInput.value || 0), 0, state.duration));
    updateTimeLabels();
    clearPreview();
  });

  previewTimeInput.addEventListener("input", async () => {
    if (!state.file) {
      return;
    }
    previewTimeInput.value = String(clamp(Number(previewTimeInput.value || 0), 0, state.duration));
    updateTimeLabels();
    await syncFrameFromVideo(Number(previewTimeInput.value));
    clearPreview();
  });

  speedInput.addEventListener("input", () => {
    speedInput.value = String(Math.max(0.1, Number(speedInput.value || 1)));
    updateTimeLabels();
    clearPreview();
  });

  frameStepInput.addEventListener("input", () => {
    frameStepInput.value = String(Math.max(1, Math.round(Number(frameStepInput.value || 1))));
    updateTimeLabels();
    clearPreview();
  });

  formatSelect.addEventListener("change", clearPreview);

  widthInput.addEventListener("input", () => {
    if (!state.cropRect) {
      return;
    }
    const width = Math.max(1, Math.round(Number(widthInput.value || 1)));
    widthInput.value = String(width);
    heightInput.value = String(Math.max(1, Math.round(width / getCropAspectSafe())));
    state.dimensionMode = "width";
    clearPreview();
  });

  heightInput.addEventListener("input", () => {
    if (!state.cropRect) {
      return;
    }
    const height = Math.max(1, Math.round(Number(heightInput.value || 1)));
    heightInput.value = String(height);
    widthInput.value = String(Math.max(1, Math.round(height * getCropAspectSafe())));
    state.dimensionMode = "height";
    clearPreview();
  });

  setStartBtn.addEventListener("click", () => {
    if (!state.file) {
      toast(t("noVideo"));
      return;
    }
    startInput.value = String(sourceVideo.currentTime.toFixed(3));
    updateTimeLabels();
    clearPreview();
  });

  setEndBtn.addEventListener("click", () => {
    if (!state.file) {
      toast(t("noVideo"));
      return;
    }
    endInput.value = String(sourceVideo.currentTime.toFixed(3));
    updateTimeLabels();
    clearPreview();
  });

  syncFrameBtn.addEventListener("click", async () => {
    if (!state.file) {
      toast(t("noVideo"));
      return;
    }
    await syncFrameFromVideo(sourceVideo.currentTime, true);
    clearPreview();
  });

  resetCropBtn.addEventListener("click", () => {
    if (!state.file) {
      return;
    }
    resetCropRect();
    drawCropStage();
    toast(t("cropReset"), "success");
  });

  renderBtn.addEventListener("click", () => {
    void renderPreview();
  });

  clearBtn.addEventListener("click", () => {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = "";
    }
    state.file = null;
    state.duration = 0;
    state.videoWidth = 0;
    state.videoHeight = 0;
    state.cropRect = null;
    state.frameCanvas = null;
    state.frameContext = null;
    state.drag = null;
    sourceVideo.pause();
    sourceVideo.hidden = true;
    sourceVideo.removeAttribute("src");
    sourceVideo.load();
    fileInput.value = "";
    startInput.value = "0";
    endInput.value = "0";
    previewTimeInput.value = "0";
    speedInput.value = "1";
    frameStepInput.value = "1";
    formatSelect.value = "gif";
    state.dimensionMode = "auto";
    renderFileMeta();
    renderSourceMeta();
    renderCropMeta();
    drawCropStage();
    clearPreview();
    updateTimeLabels();
    setStatus(t("noVideo"), "idle");
    toast(t("cleared"), "success");
  });

  cropCanvas.addEventListener("pointerdown", (event) => {
    const point = getPointFromEvent(event);
    if (!point || !state.cropRect) {
      return;
    }
    const mode = getCropHit(point);
    if (!mode) {
      return;
    }
    state.drag = {
      mode,
      startPoint: { x: point.sourceX, y: point.sourceY },
      startRect: { ...state.cropRect }
    };
    cropCanvas.setPointerCapture(event.pointerId);
  });

  cropCanvas.addEventListener("pointermove", (event) => {
    const point = getPointFromEvent(event);
    if (!point || !state.cropRect) {
      cropCanvas.style.cursor = "default";
      return;
    }

    if (state.drag) {
      applyDrag(point);
      return;
    }

    const hit = getCropHit(point);
    cropCanvas.style.cursor =
      hit === "move" ? "move" : hit === "nw" || hit === "se" ? "nwse-resize" : hit === "ne" || hit === "sw" ? "nesw-resize" : "default";
  });

  const stopDrag = (event) => {
    if (!state.drag) {
      return;
    }
    state.drag = null;
    cropCanvas.releasePointerCapture?.(event.pointerId);
    renderCropMeta();
    syncDimensionInputs("crop");
    clearPreview();
    drawCropStage();
  };

  cropCanvas.addEventListener("pointerup", stopDrag);
  cropCanvas.addEventListener("pointercancel", stopDrag);
  cropCanvas.addEventListener("pointerleave", () => {
    if (!state.drag) {
      cropCanvas.style.cursor = "default";
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (!state.output || !state.file) {
      toast(t("noPreview"));
      return;
    }
    const ext = state.output.format === "apng" ? "png" : state.output.format;
    const filename = t("outputName", { name: getFileStem(state.file.name), ext });
    downloadBlob(state.output.blob, filename);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (state.frameCanvas) {
      drawCropStage();
    }
  });
  resizeObserver.observe(cropWrap.parentElement || cropWrap);

  onLanguageChange(() => {
    renderFileMeta();
    renderSourceMeta();
    renderCropMeta();
    renderOutputMeta();
    updateTimeLabels();
    if (state.outputUrl) {
      previewImage.alt = t("previewAlt");
    }
    if (!state.frameCanvas || !state.cropRect) {
      cropEmpty.textContent = t("cropEmpty");
    }
    previewHint.textContent = t("previewHint");
    if (!state.file) {
      setStatus(t("noVideo"), "idle");
      return;
    }
    if (state.busy) {
      setStatus(t("rendering"), "working");
      return;
    }
    setStatus(state.output ? t("rendered") : t("readyCrop"), state.output ? "success" : "idle");
  });

  window.addEventListener("pagehide", () => {
    resizeObserver.disconnect();
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }
    revokeOutputUrl();
  });

  renderFileMeta();
  renderSourceMeta();
  renderCropMeta();
  clearPreview();
  updateTimeLabels();
  setStatus(t("noVideo"), "idle");
}
