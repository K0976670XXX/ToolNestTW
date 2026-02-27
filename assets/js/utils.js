const INPUT_KEY_PREFIX = "ToolNestTW:input:";
const RECENT_TOOLS_KEY = "ToolNestTW:recentTools";
const FAVORITE_TOOLS_KEY = "ToolNestTW:favoriteTools";
const ZIP_CRC_TABLE = (() => {
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

export function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function saveRecentInput(path, value) {
  try {
    localStorage.setItem(`${INPUT_KEY_PREFIX}${path}`, value);
  } catch {
    return;
  }
}

export function loadRecentInput(path) {
  try {
    return localStorage.getItem(`${INPUT_KEY_PREFIX}${path}`) || "";
  } catch {
    return "";
  }
}

export function clearRecentInput(path) {
  try {
    localStorage.removeItem(`${INPUT_KEY_PREFIX}${path}`);
  } catch {
    return;
  }
}

export function rememberRecentTool(path) {
  if (!path || path === "/") {
    return;
  }

  try {
    const previous = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || "[]");
    const deduped = [path, ...previous.filter((item) => item !== path)].slice(0, 6);
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(deduped));
  } catch {
    return;
  }
}

export function getRecentTools() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getFavoriteTools() {
  try {
    return JSON.parse(localStorage.getItem(FAVORITE_TOOLS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function isFavoriteTool(path) {
  return getFavoriteTools().includes(path);
}

export function toggleFavoriteTool(path) {
  if (!path) {
    return false;
  }

  try {
    const previous = getFavoriteTools();
    const next = previous.includes(path)
      ? previous.filter((item) => item !== path)
      : [path, ...previous].slice(0, 30);
    localStorage.setItem(FAVORITE_TOOLS_KEY, JSON.stringify(next));
    return next.includes(path);
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const value = Math.floor(Math.log(bytes) / Math.log(1024));
  const unitIndex = Math.min(value, units.length - 1);
  const converted = bytes / 1024 ** unitIndex;
  return `${converted.toFixed(converted < 10 && unitIndex > 0 ? 2 : 1)} ${units[unitIndex]}`;
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

export function dataURLToImage(dataURL) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot load image"));
    image.src = dataURL;
  });
}

export function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Cannot export image"));
    }, type, quality);
  });
}

export async function createSampleImageBlob(width = 1280, height = 720) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not available");
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1659d6");
  gradient.addColorStop(1, "#00a47a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `bold ${Math.floor(width * 0.085)}px Manrope, sans-serif`;
  ctx.fillText("ToolNestTW", width * 0.08, height * 0.52);
  ctx.font = `${Math.floor(width * 0.028)}px Manrope, sans-serif`;
  ctx.fillText("Sample image for resize/compress tests", width * 0.08, height * 0.62);

  return canvasToBlob(canvas, "image/png");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = ZIP_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

export async function createZipBlob(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("No files for zip");
  }

  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    if (!entry?.blob || !entry?.name) {
      throw new Error("Invalid zip entry");
    }

    const nameBytes = encoder.encode(String(entry.name));
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);
    const compressedSize = data.length;
    const uncompressedSize = data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, compressedSize);
    writeUint32(localView, 22, uncompressedSize);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, compressedSize);
    writeUint32(centralView, 24, uncompressedSize);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);

    localChunks.push(localHeader, data);
    centralChunks.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, centralChunks.length);
  writeUint16(endView, 10, centralChunks.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, centralOffset);
  writeUint16(endView, 20, 0);

  return new Blob([...localChunks, ...centralChunks, endRecord], { type: "application/zip" });
}





