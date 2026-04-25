import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { bindDragDrop } from "/assets/components/drag.js?v=1.6.26";
import { createImageLightbox } from "/assets/components/image_gallery.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { canvasToBlob, dataURLToImage, fileToDataURL, formatBytes } from "/assets/js/utils.js?v=1.6.26";

const MAX_STAGE_WIDTH = 1000;
const MAX_STAGE_HEIGHT = 760;
const MAGNIFIER_SIZE = 150;
const MAGNIFIER_OFFSET = 18;
const MAGNIFIER_SAMPLE_HALF = 18;

const copy = {
  zh: {
    invalid: "輸入格式錯誤",
    noInput: "請先載入圖片。",
    loaded: "已載入圖片，請點四個角。",
    loadedSingle: "已載入 1 張圖片。",
    maxPoints: "已選滿 4 點，請重設或撤銷上一點。",
    noPoint: "目前沒有可撤銷的點。",
    pointsIdle: "尚未選點。",
    pointsProgress: "已選 {count} / 4 點。",
    pointsDone: "已選滿 4 點，正在或已完成透視校正。",
    selecting: "請在圖片上點四個角，順序不限。",
    processing: "正在進行透視校正...",
    corrected: "透視校正完成。",
    resetDone: "已清除目前選點。",
    cleared: "已清除圖片與結果。",
    noOutput: "尚未產生校正結果。",
    downloadReady: "點擊結果預覽可放大檢視。",
    stageEmpty: "載入圖片後即可開始點四個角。",
    fileEmpty: "尚未載入圖片。",
    fileName: "目前圖片：{name}",
    metaFile: "檔名",
    metaSize: "原始尺寸",
    metaOutput: "輸出尺寸",
    metaBytes: "輸出大小",
    pointLabel: "點 {index}",
    closePreview: "關閉",
    magnifier: "放大檢視",
    noResultYet: "選滿四個點後會自動產生結果。",
    loadFailed: "無法讀取圖片。",
    outputNameFallback: "perspective-corrected.png",
    outputReady: "已輸出 {width} x {height} 透視校正結果。"
  },
  en: {
    invalid: "Invalid input format",
    noInput: "Please load an image first.",
    loaded: "Image loaded. Click four corners.",
    loadedSingle: "Loaded 1 image.",
    maxPoints: "Four points already selected. Reset or undo the last point.",
    noPoint: "There is no point to undo.",
    pointsIdle: "No points selected yet.",
    pointsProgress: "Selected {count} / 4 points.",
    pointsDone: "All four points are selected. Perspective correction is ready or completed.",
    selecting: "Click four corners on the image. Order does not matter.",
    processing: "Applying perspective correction...",
    corrected: "Perspective correction completed.",
    resetDone: "Selection points cleared.",
    cleared: "Image and output cleared.",
    noOutput: "No corrected output yet.",
    downloadReady: "Click the result preview to open full-size view.",
    stageEmpty: "Load an image to start selecting four corners.",
    fileEmpty: "No image loaded yet.",
    fileName: "Current image: {name}",
    metaFile: "Filename",
    metaSize: "Source size",
    metaOutput: "Output size",
    metaBytes: "Output file size",
    pointLabel: "Point {index}",
    closePreview: "Close",
    magnifier: "Magnifier",
    noResultYet: "The result is generated automatically after four points are selected.",
    loadFailed: "Cannot read image.",
    outputNameFallback: "perspective-corrected.png",
    outputReady: "Generated perspective-corrected output at {width} x {height}."
  }
};

function t(key, params = {}) {
  const lang = getLanguage();
  const template = copy[lang]?.[key] || copy.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

function getFileStem(name) {
  const safeName = String(name || "image");
  const dot = safeName.lastIndexOf(".");
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  return stem || "image";
}

function distance(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function orderPoints(points) {
  const values = points.map((point) => ({ x: point.x, y: point.y }));
  const sums = values.map((point) => point.x + point.y);
  const diffs = values.map((point) => point.y - point.x);
  return [
    values[sums.indexOf(Math.min(...sums))],
    values[diffs.indexOf(Math.min(...diffs))],
    values[sums.indexOf(Math.max(...sums))],
    values[diffs.indexOf(Math.max(...diffs))]
  ];
}

function calculateTargetSize(points) {
  const [topLeft, topRight, bottomRight, bottomLeft] = points;
  const width = Math.max(distance(bottomRight, bottomLeft), distance(topRight, topLeft));
  const height = Math.max(distance(topRight, bottomRight), distance(topLeft, bottomLeft));
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][col]) < 1e-10) {
      return null;
    }

    if (pivotRow !== col) {
      [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];
    }

    const pivot = augmented[col][col];
    for (let index = col; index <= size; index += 1) {
      augmented[col][index] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === col) {
        continue;
      }
      const factor = augmented[row][col];
      if (factor === 0) {
        continue;
      }
      for (let index = col; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[col][index];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function computeHomography(fromPoints, toPoints) {
  const matrix = [];
  const values = [];

  for (let index = 0; index < 4; index += 1) {
    const src = fromPoints[index];
    const dst = toPoints[index];

    matrix.push([src.x, src.y, 1, 0, 0, 0, -dst.x * src.x, -dst.x * src.y]);
    values.push(dst.x);
    matrix.push([0, 0, 0, src.x, src.y, 1, -dst.y * src.x, -dst.y * src.y]);
    values.push(dst.y);
  }

  const solution = solveLinearSystem(matrix, values);
  if (!solution) {
    return null;
  }

  return [
    [solution[0], solution[1], solution[2]],
    [solution[3], solution[4], solution[5]],
    [solution[6], solution[7], 1]
  ];
}

function applyHomography(matrix, x, y) {
  const denominator = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }
  return {
    x: (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / denominator,
    y: (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / denominator
  };
}

function sampleBilinear(data, width, height, x, y, output, offset) {
  const safeX = Math.max(0, Math.min(width - 1, x));
  const safeY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(safeX);
  const y0 = Math.floor(safeY);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const dx = safeX - x0;
  const dy = safeY - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = data[i00 + channel] * (1 - dx) + data[i10 + channel] * dx;
    const bottom = data[i01 + channel] * (1 - dx) + data[i11 + channel] * dx;
    output[offset + channel] = Math.round(top * (1 - dy) + bottom * dy);
  }
}

function getDisplayMetrics(image, stageWidth) {
  const safeStageWidth = Math.max(220, stageWidth || 220);
  const scale = Math.min(MAX_STAGE_WIDTH / image.width, MAX_STAGE_HEIGHT / image.height, safeStageWidth / image.width, 1);
  return {
    scale,
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale))
  };
}

function drawStage(context, state) {
  const { source, selectedPoints, display, hoverPoint } = state;
  const width = display.width;
  const height = display.height;

  context.clearRect(0, 0, width, height);
  context.drawImage(source.image, 0, 0, width, height);

  const toDisplay = (point) => ({
    x: point.x * display.scale,
    y: point.y * display.scale
  });

  context.lineWidth = 2;
  context.strokeStyle = "#1659d6";
  context.fillStyle = "rgba(22, 89, 214, 0.16)";

  if (selectedPoints.length === 4) {
    const polygon = orderPoints(selectedPoints).map(toDisplay);
    context.beginPath();
    polygon.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
        return;
      }
      context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.fill();
    context.stroke();
  } else if (selectedPoints.length > 1) {
    context.beginPath();
    selectedPoints.map(toDisplay).forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
        return;
      }
      context.lineTo(point.x, point.y);
    });
    context.stroke();
  }

  selectedPoints.forEach((point, index) => {
    const displayPoint = toDisplay(point);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#bf2445";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(displayPoint.x, displayPoint.y, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "#bf2445";
    context.font = "700 13px Manrope, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(String(index + 1), displayPoint.x, displayPoint.y - 10);
  });

  if (hoverPoint && selectedPoints.length < 4) {
    const displayPoint = toDisplay(hoverPoint);
    context.strokeStyle = "rgba(0, 0, 0, 0.58)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(displayPoint.x - 10, displayPoint.y);
    context.lineTo(displayPoint.x + 10, displayPoint.y);
    context.moveTo(displayPoint.x, displayPoint.y - 10);
    context.lineTo(displayPoint.x, displayPoint.y + 10);
    context.stroke();
  }
}

async function createPerspectiveSampleFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 980;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#20314f");
  gradient.addColorStop(1, "#0d1629");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x < canvas.width; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const paper = [
    { x: 300, y: 150 },
    { x: 1080, y: 110 },
    { x: 1140, y: 790 },
    { x: 220, y: 850 }
  ];

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 16;
  ctx.shadowOffsetY = 22;
  ctx.beginPath();
  paper.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = "#f7f5ee";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  paper.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();

  const paperGradient = ctx.createLinearGradient(250, 120, 1120, 820);
  paperGradient.addColorStop(0, "#fbfaf4");
  paperGradient.addColorStop(1, "#efe9da");
  ctx.fillStyle = paperGradient;
  ctx.fillRect(180, 90, 1000, 820);

  ctx.fillStyle = "#21344f";
  ctx.font = "700 54px Manrope, 'Noto Sans TC', sans-serif";
  ctx.fillText("Perspective Sample", 360, 260);

  ctx.fillStyle = "#52627e";
  ctx.font = "600 24px Manrope, 'Noto Sans TC', sans-serif";
  for (let line = 0; line < 10; line += 1) {
    ctx.fillRect(360, 330 + line * 44, 500 + (line % 3) * 80, 10);
  }

  ctx.fillStyle = "#1659d6";
  ctx.fillRect(360, 790, 240, 54);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Manrope, 'Noto Sans TC', sans-serif";
  ctx.fillText("Click Four Corners", 395, 826);
  ctx.restore();

  ctx.strokeStyle = "rgba(191, 36, 69, 0.5)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  paper.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();

  const blob = await canvasToBlob(canvas, "image/png", 0.92);
  return new File([blob], "perspective-sample.png", { type: "image/png" });
}

async function warpPerspective(state, orderedPoints) {
  const { width, height } = calculateTargetSize(orderedPoints);
  const destinationPoints = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 }
  ];
  const matrix = computeHomography(destinationPoints, orderedPoints);
  if (!matrix) {
    throw new Error("Homography failed");
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext || !state.sourceImageData) {
    throw new Error("Canvas unavailable");
  }

  const sourceWidth = state.sourceCanvas.width;
  const sourceHeight = state.sourceCanvas.height;
  const sourceData = state.sourceImageData.data;
  const outputFrame = outputContext.createImageData(width, height);
  const destinationData = outputFrame.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = applyHomography(matrix, x, y);
      if (!point) {
        continue;
      }
      const offset = (y * width + x) * 4;
      sampleBilinear(sourceData, sourceWidth, sourceHeight, point.x, point.y, destinationData, offset);
    }

    if (y % 24 === 0) {
      // Keep the UI responsive when correcting larger images.
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
  }

  outputContext.putImageData(outputFrame, 0, 0);
  const blob = await canvasToBlob(outputCanvas, "image/png", 0.92);
  return { canvas: outputCanvas, blob, width, height };
}

export default function initImagePerspectiveCorrect() {
  const dropZone = document.querySelector("#pc-drop-zone");
  const fileInput = document.querySelector("#pc-file");
  const fileName = document.querySelector("#pc-file-name");
  const stageShell = document.querySelector("#pc-stage-shell");
  const emptyStage = document.querySelector("#pc-empty-stage");
  const canvasWrap = document.querySelector("#pc-canvas-wrap");
  const canvas = document.querySelector("#pc-canvas");
  const magnifier = document.querySelector("#pc-magnifier");
  const magnifierCanvas = document.querySelector("#pc-magnifier-canvas");
  const magnifierLabel = document.querySelector("#pc-magnifier-label");
  const status = document.querySelector("#pc-status");
  const pointSummary = document.querySelector("#pc-point-summary");
  const pointList = document.querySelector("#pc-point-list");
  const meta = document.querySelector("#pc-meta");
  const undoBtn = document.querySelector("#pc-undo-btn");
  const resetPointsBtn = document.querySelector("#pc-reset-points-btn");
  const sampleBtn = document.querySelector("#pc-sample-btn");
  const clearBtn = document.querySelector("#pc-clear-btn");
  const outputCanvas = document.querySelector("#pc-output-canvas");
  const outputEmpty = document.querySelector("#pc-output-empty");
  const outputMeta = document.querySelector("#pc-output-meta");
  const outputHint = document.querySelector("#pc-output-hint");
  const downloadBtn = document.querySelector("#pc-download-btn");

  if (
    !dropZone ||
    !fileInput ||
    !fileName ||
    !stageShell ||
    !emptyStage ||
    !canvasWrap ||
    !canvas ||
    !magnifier ||
    !magnifierCanvas ||
    !magnifierLabel ||
    !status ||
    !pointSummary ||
    !pointList ||
    !meta ||
    !undoBtn ||
    !resetPointsBtn ||
    !sampleBtn ||
    !clearBtn ||
    !outputCanvas ||
    !outputEmpty ||
    !outputMeta ||
    !outputHint ||
    !downloadBtn
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW 圖片透視校正",
      en: "ToolNestTW Image Perspective Corrector"
    },
    text: {
      ".hero h1": { zh: "圖片透視校正", en: "Image Perspective Corrector" },
      ".hero .lead": {
        zh: "上傳圖片後點四個角，工具會自動展平透視並輸出可下載的 PNG。",
        en: "Upload an image, click four corners, and export a flattened PNG directly in browser."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "選點區", en: "Point Selection" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      "#pc-drop-zone strong": { zh: "拖曳單張圖片到這裡", en: "Drop one image here" },
      "#pc-drop-zone .hint": {
        zh: "或手動選擇一張圖片後，在畫面中點四個角",
        en: "or choose one image manually, then click four corners on the preview"
      },
      "#pc-stage-hint": {
        zh: "四點可任意順序點選。游標在圖片上移動時，旁邊會顯示放大鏡。",
        en: "You can click the four corners in any order. A magnifier appears beside the cursor while moving on the image."
      },
      "#pc-point-title": { zh: "選點資訊", en: "Point Details" },
      "#pc-meta-title": { zh: "影像資訊", en: "Image Details" },
      "#pc-undo-btn": { zh: "撤銷上一點", en: "Undo Last Point" },
      "#pc-reset-points-btn": { zh: "重設選點", en: "Reset Points" },
      "#pc-sample-btn": { zh: "載入範例圖片", en: "Load Sample Image" },
      "#pc-clear-btn": { zh: "清除", en: "Clear" },
      "#pc-output-title": { zh: "透視校正結果", en: "Perspective Result" },
      "#pc-output-meta-title": { zh: "輸出資訊", en: "Output Details" },
      "#pc-download-btn": { zh: "下載 PNG", en: "Download PNG" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 上傳圖片後，在目標區域四個角各點一下。",
        en: "1. Upload an image and click the four corners of the target area."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 四點順序不限，工具會自動排序並執行透視校正。",
        en: "2. Point order does not matter. The tool sorts them automatically before correction."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 若點錯可撤銷上一點或重設選點，再重新輸出與下載。",
        en: "3. If you click the wrong spot, undo the last point or reset all points, then export again."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "會上傳圖片嗎？ 不會，全部在瀏覽器本機處理。",
        en: "Is the image uploaded? No, everything is processed locally in your browser."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "為什麼有放大鏡？ 選點時游標旁的小視窗會放大局部區域，方便更精準點角。",
        en: "Why is there a magnifier? The small window beside the cursor enlarges the local area for more accurate corner selection."
      }
    }
  });

  const lightbox = createImageLightbox();
  const drawingContext = canvas.getContext("2d");
  const magnifierContext = magnifierCanvas.getContext("2d");
  const visibleOutputContext = outputCanvas.getContext("2d");

  if (!drawingContext || !magnifierContext || !visibleOutputContext) {
    return;
  }

  const state = {
    source: null,
    sourceCanvas: null,
    sourceImageData: null,
    selectedPoints: [],
    hoverPoint: null,
    display: { scale: 1, width: 0, height: 0 },
    output: null,
    outputUrl: "",
    busy: false
  };

  const cleanupOutput = () => {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
      state.outputUrl = "";
    }
    state.output = null;
    outputEmpty.hidden = false;
    outputCanvas.hidden = true;
    outputMeta.textContent = "";
    downloadBtn.disabled = true;
    outputHint.textContent = t("noOutput");
    outputCanvas.style.removeProperty("cursor");
  };

  const setBusy = (value) => {
    state.busy = value;
    undoBtn.disabled = value;
    resetPointsBtn.disabled = value;
    sampleBtn.disabled = value;
    clearBtn.disabled = value;
    fileInput.disabled = value;
  };

  const setStatus = (message, type = "idle") => {
    status.textContent = message;
    status.classList.remove("is-success", "is-warning", "is-working");
    if (type === "success") {
      status.classList.add("is-success");
    } else if (type === "warning") {
      status.classList.add("is-warning");
    } else if (type === "working") {
      status.classList.add("is-working");
    }
  };

  const renderFileMeta = () => {
    fileName.textContent = state.source ? t("fileName", { name: state.source.file.name }) : t("fileEmpty");
  };

  const renderPointMeta = () => {
    if (!state.selectedPoints.length) {
      pointSummary.textContent = t("pointsIdle");
      pointList.replaceChildren();
      return;
    }

    pointSummary.textContent =
      state.selectedPoints.length < 4
        ? t("pointsProgress", { count: state.selectedPoints.length })
        : t("pointsDone");

    pointList.replaceChildren(
      ...state.selectedPoints.map((point, index) => {
        const item = document.createElement("li");
        item.textContent = `${t("pointLabel", { index: index + 1 })}: (${Math.round(point.x)}, ${Math.round(point.y)})`;
        return item;
      })
    );
  };

  const renderSourceMeta = () => {
    if (!state.source) {
      meta.textContent = "";
      return;
    }

    const rows = [
      `${t("metaFile")}: ${state.source.file.name}`,
      `${t("metaSize")}: ${state.source.image.width} x ${state.source.image.height}`
    ];

    meta.replaceChildren(
      ...rows.map((text) => {
        const item = document.createElement("span");
        item.textContent = text;
        return item;
      })
    );
  };

  const renderOutputMeta = () => {
    if (!state.output) {
      outputMeta.textContent = "";
      return;
    }

    const rows = [
      `${t("metaOutput")}: ${state.output.width} x ${state.output.height}`,
      `${t("metaBytes")}: ${formatBytes(state.output.blob.size)}`
    ];

    outputMeta.replaceChildren(
      ...rows.map((text) => {
        const item = document.createElement("span");
        item.textContent = text;
        return item;
      })
    );
  };

  const renderOutputCanvas = () => {
    if (!state.output) {
      cleanupOutput();
      return;
    }

    outputEmpty.hidden = true;
    outputCanvas.hidden = false;
    outputCanvas.width = state.output.width;
    outputCanvas.height = state.output.height;
    visibleOutputContext.clearRect(0, 0, state.output.width, state.output.height);
    visibleOutputContext.drawImage(state.output.canvas, 0, 0);
    downloadBtn.disabled = false;
    outputHint.textContent = t("downloadReady");
    outputCanvas.style.cursor = "zoom-in";
    renderOutputMeta();
  };

  const renderStage = () => {
    if (!state.source) {
      emptyStage.hidden = false;
      emptyStage.textContent = t("stageEmpty");
      canvasWrap.hidden = true;
      magnifier.hidden = true;
      return;
    }

    emptyStage.hidden = true;
    canvasWrap.hidden = false;

    const metrics = getDisplayMetrics(state.source.image, stageShell.clientWidth - 2);
    state.display = metrics;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(metrics.width * dpr);
    canvas.height = Math.round(metrics.height * dpr);
    canvas.style.width = `${metrics.width}px`;
    canvas.style.height = `${metrics.height}px`;
    drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStage(drawingContext, state);
  };

  const hideMagnifier = () => {
    magnifier.hidden = true;
    state.hoverPoint = null;
    if (state.source) {
      renderStage();
    }
  };

  const renderMagnifier = (originalPoint, displayX, displayY) => {
    if (!state.source || state.selectedPoints.length >= 4) {
      hideMagnifier();
      return;
    }

    state.hoverPoint = originalPoint;
    renderStage();

    const sourceCanvas = state.sourceCanvas;
    if (!sourceCanvas) {
      return;
    }

    const sampleHalf = MAGNIFIER_SAMPLE_HALF / state.display.scale;
    const sx = originalPoint.x - sampleHalf;
    const sy = originalPoint.y - sampleHalf;
    magnifierCanvas.width = MAGNIFIER_SIZE;
    magnifierCanvas.height = MAGNIFIER_SIZE;
    magnifierCanvas.style.width = `${MAGNIFIER_SIZE}px`;
    magnifierCanvas.style.height = `${MAGNIFIER_SIZE}px`;
    magnifierContext.imageSmoothingEnabled = false;
    magnifierContext.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    magnifierContext.drawImage(
      sourceCanvas,
      sx,
      sy,
      sampleHalf * 2,
      sampleHalf * 2,
      0,
      0,
      MAGNIFIER_SIZE,
      MAGNIFIER_SIZE
    );
    magnifierContext.strokeStyle = "rgba(255,255,255,0.92)";
    magnifierContext.lineWidth = 1;
    magnifierContext.beginPath();
    magnifierContext.moveTo(MAGNIFIER_SIZE / 2, 0);
    magnifierContext.lineTo(MAGNIFIER_SIZE / 2, MAGNIFIER_SIZE);
    magnifierContext.moveTo(0, MAGNIFIER_SIZE / 2);
    magnifierContext.lineTo(MAGNIFIER_SIZE, MAGNIFIER_SIZE / 2);
    magnifierContext.stroke();
    magnifierLabel.textContent = t("magnifier");

    const maxLeft = canvasWrap.clientWidth - MAGNIFIER_SIZE - 8;
    const maxTop = canvasWrap.clientHeight - MAGNIFIER_SIZE - 8;
    const nextLeft = Math.max(8, Math.min(maxLeft, displayX + MAGNIFIER_OFFSET));
    const nextTop = Math.max(8, Math.min(maxTop, displayY - MAGNIFIER_SIZE - 8 < 8 ? displayY + MAGNIFIER_OFFSET : displayY - MAGNIFIER_SIZE - 8));

    magnifier.style.left = `${nextLeft}px`;
    magnifier.style.top = `${nextTop}px`;
    magnifier.hidden = false;
  };

  const getOriginalPointFromEvent = (event) => {
    if (!state.source) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return null;
    }
    return {
      original: {
        x: x / state.display.scale,
        y: y / state.display.scale
      },
      display: { x, y }
    };
  };

  const applySourceItem = async (file) => {
    try {
      const dataURL = await fileToDataURL(file);
      const image = await dataURLToImage(dataURL);
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = image.width;
      sourceCanvas.height = image.height;
      const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!sourceContext) {
        throw new Error("Canvas unavailable");
      }
      sourceContext.drawImage(image, 0, 0);

      state.source = { file, image, dataURL };
      state.sourceCanvas = sourceCanvas;
      state.sourceImageData = sourceContext.getImageData(0, 0, image.width, image.height);
      state.selectedPoints = [];
      state.hoverPoint = null;
      cleanupOutput();
      renderFileMeta();
      renderPointMeta();
      renderSourceMeta();
      renderStage();
      setStatus(t("loaded"), "idle");
      toast(t("loadedSingle"), "success");
    } catch {
      toast(t("loadFailed"));
    }
  };

  const readFiles = async (files) => {
    const imageFile = Array.from(files || []).find((file) => file.type.startsWith("image/"));
    if (!imageFile) {
      toast(t("invalid"));
      return;
    }
    await applySourceItem(imageFile);
  };

  const processPoints = async () => {
    if (!state.source || state.selectedPoints.length !== 4) {
      return;
    }

    try {
      setBusy(true);
      hideMagnifier();
      setStatus(t("processing"), "working");
      const ordered = orderPoints(state.selectedPoints);
      const result = await warpPerspective(state, ordered);

      cleanupOutput();
      state.output = result;
      state.outputUrl = URL.createObjectURL(result.blob);
      renderOutputCanvas();
      setStatus(t("corrected"), "success");
      toast(t("outputReady", { width: result.width, height: result.height }), "success");
    } catch {
      cleanupOutput();
      setStatus(t("invalid"), "warning");
      toast(t("invalid"));
    } finally {
      setBusy(false);
      renderPointMeta();
      renderStage();
    }
  };

  bindDragDrop({
    dropZone,
    fileInput,
    onFiles: readFiles
  });

  canvas.addEventListener("pointermove", (event) => {
    const next = getOriginalPointFromEvent(event);
    if (!next) {
      hideMagnifier();
      return;
    }
    renderMagnifier(next.original, next.display.x, next.display.y);
  });

  canvas.addEventListener("pointerleave", () => {
    hideMagnifier();
  });

  canvas.addEventListener("click", (event) => {
    if (!state.source) {
      toast(t("noInput"));
      return;
    }
    if (state.busy) {
      return;
    }
    if (state.selectedPoints.length >= 4) {
      toast(t("maxPoints"));
      return;
    }

    const next = getOriginalPointFromEvent(event);
    if (!next) {
      return;
    }

    state.selectedPoints.push(next.original);
    cleanupOutput();
    renderPointMeta();
    renderStage();

    if (state.selectedPoints.length === 4) {
      void processPoints();
      return;
    }

    setStatus(t("pointsProgress", { count: state.selectedPoints.length }), "idle");
  });

  undoBtn.addEventListener("click", () => {
    if (state.busy) {
      return;
    }
    if (!state.selectedPoints.length) {
      toast(t("noPoint"));
      return;
    }
    state.selectedPoints.pop();
    cleanupOutput();
    renderPointMeta();
    renderStage();
    setStatus(t("selecting"), "idle");
  });

  resetPointsBtn.addEventListener("click", () => {
    if (!state.source || state.busy) {
      return;
    }
    state.selectedPoints = [];
    hideMagnifier();
    cleanupOutput();
    renderPointMeta();
    renderStage();
    setStatus(t("selecting"), "idle");
    toast(t("resetDone"), "success");
  });

  sampleBtn.addEventListener("click", async () => {
    if (state.busy) {
      return;
    }
    try {
      const sampleFile = await createPerspectiveSampleFile();
      await applySourceItem(sampleFile);
    } catch {
      toast(t("invalid"));
    }
  });

  clearBtn.addEventListener("click", () => {
    if (state.busy) {
      return;
    }
    state.source = null;
    state.sourceCanvas = null;
    state.sourceImageData = null;
    state.selectedPoints = [];
    state.hoverPoint = null;
    fileInput.value = "";
    cleanupOutput();
    renderFileMeta();
    renderPointMeta();
    renderSourceMeta();
    renderStage();
    setStatus(t("noInput"), "idle");
    toast(t("cleared"), "success");
  });

  outputCanvas.addEventListener("click", () => {
    if (!state.outputUrl) {
      return;
    }
    lightbox.open({
      src: state.outputUrl,
      captionText: state.source ? `${getFileStem(state.source.file.name)}-perspective.png` : t("outputNameFallback")
    });
  });

  downloadBtn.addEventListener("click", () => {
    if (!state.output) {
      toast(t("noOutput"));
      return;
    }
    const name = state.source
      ? `${getFileStem(state.source.file.name)}-perspective.png`
      : t("outputNameFallback");
    downloadBlob(state.output.blob, name);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (!state.source) {
      return;
    }
    renderStage();
  });
  resizeObserver.observe(stageShell);

  onLanguageChange(() => {
    renderFileMeta();
    renderPointMeta();
    renderSourceMeta();
    renderOutputMeta();
    renderOutputCanvas();
    renderStage();
    lightbox.setCloseLabel(t("closePreview"));
    if (!state.source) {
      setStatus(t("noInput"), "idle");
      return;
    }
    if (state.busy) {
      setStatus(t("processing"), "working");
      return;
    }
    if (state.output) {
      setStatus(t("corrected"), "success");
      return;
    }
    setStatus(state.selectedPoints.length ? t("pointsProgress", { count: state.selectedPoints.length }) : t("selecting"), "idle");
  });

  window.addEventListener("pagehide", () => {
    if (state.outputUrl) {
      URL.revokeObjectURL(state.outputUrl);
    }
    resizeObserver.disconnect();
    lightbox.destroy();
  });

  renderFileMeta();
  renderPointMeta();
  renderSourceMeta();
  cleanupOutput();
  renderStage();
  setStatus(t("noInput"), "idle");
  lightbox.setCloseLabel(t("closePreview"));
}
