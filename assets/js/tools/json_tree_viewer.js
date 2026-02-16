import { bindCopyButton } from "/assets/components/copy.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";
import { onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";
import { clearRecentInput, loadRecentInput, saveRecentInput } from "/assets/js/utils.js?v=1.6.26";

const TOOL_PATH = "/data/json_tree_viewer";
const SAMPLE_JSON = `{
  "project": "ToolNestTW",
  "phase": 3,
  "enabled": true,
  "users": [
    {
      "id": 1,
      "name": "Alex",
      "roles": ["admin", "editor"]
    },
    {
      "id": 2,
      "name": "Rina",
      "roles": ["viewer"]
    }
  ],
  "meta": {
    "region": "ap-east-1",
    "build": 1205
  }
}`;

const GRAPH_NODE_WIDTH = 268;
const GRAPH_HORIZONTAL_GAP = 94;
const GRAPH_VERTICAL_GAP = 24;
const GRAPH_PADDING_X = 16;
const GRAPH_PADDING_Y = 16;
const GRAPH_MAX_LINES = 9;
const GRAPH_MAX_BRANCHES = 12;

const textMap = {
  zh: {
    invalidInput: "輸入格式錯誤",
    parsed: "已完成 Tree 解析。",
    copiedPath: "已複製節點路徑。",
    typeObject: "物件",
    typeArray: "陣列",
    typeString: "字串",
    typeNumber: "數字",
    typeBoolean: "布林",
    typeNull: "空值",
    items: "{count} 個項目",
    emptyObject: "空物件",
    emptyArray: "空陣列",
    rootLabel: "根節點",
    noTree: "尚未解析 JSON。",
    statusTree: "節點數：{nodes}，最大深度：{depth}",
    branchMore: "... 另有 {count} 個子節點",
    lineMore: "... 另有 {count} 筆",
    graphLeaf: "值"
  },
  en: {
    invalidInput: "Invalid input format",
    parsed: "Tree parsed successfully.",
    copiedPath: "Node path copied.",
    typeObject: "Object",
    typeArray: "Array",
    typeString: "String",
    typeNumber: "Number",
    typeBoolean: "Boolean",
    typeNull: "Null",
    items: "{count} items",
    emptyObject: "Empty object",
    emptyArray: "Empty array",
    rootLabel: "Root",
    noTree: "No parsed JSON yet.",
    statusTree: "Nodes: {nodes}, max depth: {depth}",
    branchMore: "... and {count} more child nodes",
    lineMore: "... and {count} more lines",
    graphLeaf: "value"
  }
};

function getLang() {
  return document.documentElement.lang.startsWith("zh") ? "zh" : "en";
}

function t(key, params = {}) {
  const lang = getLang();
  const template = textMap[lang]?.[key] || textMap.en[key] || key;
  return Object.entries(params).reduce((result, [name, value]) => {
    return result.replaceAll(`{${name}}`, String(value));
  }, template);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const proxy = document.createElement("textarea");
  proxy.value = text;
  proxy.style.position = "fixed";
  proxy.style.opacity = "0";
  document.body.append(proxy);
  proxy.select();
  document.execCommand("copy");
  proxy.remove();
}

function getValueType(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function valueToText(value, type) {
  if (type === "string") {
    return `"${value}"`;
  }
  if (type === "null") {
    return "null";
  }
  return String(value);
}

function createKeyNode(key) {
  const node = document.createElement("span");
  node.className = "json-tree-key";
  node.textContent = key;
  return node;
}

function createTypeNode(type) {
  const node = document.createElement("span");
  node.className = `json-tree-type is-${type}`;
  node.textContent = t(`type${type[0].toUpperCase()}${type.slice(1)}`);
  return node;
}

function createTreeCopyButton(path, onCopyPath) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "json-tree-copy-path";
  button.textContent = "🔗";
  button.title = path;
  button.setAttribute("aria-label", path);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCopyPath(path);
  });
  return button;
}

function createLeafNode(key, value, path, onCopyPath) {
  const type = getValueType(value);
  const row = document.createElement("div");
  row.className = "json-tree-leaf";

  if (key !== null) {
    row.append(createKeyNode(String(key)));
    const sep = document.createElement("span");
    sep.className = "json-tree-sep";
    sep.textContent = ":";
    row.append(sep);
  }

  const valueNode = document.createElement("span");
  valueNode.className = `json-tree-value is-${type}`;
  valueNode.textContent = valueToText(value, type);
  row.append(valueNode, createTypeNode(type), createTreeCopyButton(path, onCopyPath));
  return { node: row, count: 1, depth: 1 };
}

function createBranchNode(value, key, path, depthLevel, onCopyPath) {
  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  const details = document.createElement("details");
  details.className = "json-tree-branch";
  details.open = depthLevel < 3;

  const summary = document.createElement("summary");
  summary.className = "json-tree-summary";

  if (key !== null) {
    summary.append(createKeyNode(String(key)));
    const sep = document.createElement("span");
    sep.className = "json-tree-sep";
    sep.textContent = ":";
    summary.append(sep);
  } else {
    const rootLabel = document.createElement("span");
    rootLabel.className = "json-tree-key";
    rootLabel.textContent = t("rootLabel");
    summary.append(rootLabel);
  }

  summary.append(createTypeNode(isArray ? "array" : "object"));
  const size = document.createElement("span");
  size.className = "json-tree-size";
  size.textContent = t("items", { count: entries.length });
  summary.append(size, createTreeCopyButton(path, onCopyPath));
  details.append(summary);

  const children = document.createElement("div");
  children.className = "json-tree-children";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "json-tree-empty";
    empty.textContent = isArray ? t("emptyArray") : t("emptyObject");
    children.append(empty);
    details.append(children);
    return { node: details, count: 1, depth: 1 };
  }

  let totalCount = 1;
  let maxDepth = 1;

  entries.forEach(([childKey, childValue]) => {
    const childPath = appendPath(path, childKey, isArray);
    const child = createTreeNode(childValue, childKey, childPath, depthLevel + 1, onCopyPath);
    totalCount += child.count;
    maxDepth = Math.max(maxDepth, child.depth + 1);
    children.append(child.node);
  });

  details.append(children);
  return { node: details, count: totalCount, depth: maxDepth };
}

function createTreeNode(value, key = null, path = "root", depthLevel = 1, onCopyPath = () => {}) {
  const type = getValueType(value);
  if (type === "object" || type === "array") {
    return createBranchNode(value, key, path, depthLevel, onCopyPath);
  }
  return createLeafNode(key, value, path, onCopyPath);
}

function setAllBranchesOpen(host, open) {
  host.querySelectorAll("details.json-tree-branch").forEach((node) => {
    node.open = open;
  });
}

function previewValue(value) {
  const type = getValueType(value);
  if (type === "string") {
    return value.length > 38 ? `"${value.slice(0, 35)}..."` : `"${value}"`;
  }
  if (type === "array") {
    return `[${value.length}]`;
  }
  if (type === "object") {
    return `{${Object.keys(value).length}}`;
  }
  return String(value);
}

function appendPath(path, key, isArrayParent) {
  if (isArrayParent) {
    return `${path}[${key}]`;
  }
  return `${path}[${JSON.stringify(String(key))}]`;
}

function makeGraphNodeTitle(key, value, isRoot) {
  if (isRoot) {
    return t("rootLabel");
  }

  const type = getValueType(value);
  if (type === "array") {
    return `${key} [${value.length}]`;
  }
  if (type === "object") {
    return `${key} {${Object.keys(value).length}}`;
  }
  return `${key}: ${t("graphLeaf")}`;
}

function buildGraphModel(value, key = null, path = "root", depth = 0) {
  const type = getValueType(value);
  const isRoot = key === null;
  const node = {
    id: path,
    path,
    depth,
    type,
    title: makeGraphNodeTitle(key, value, isRoot),
    lines: [],
    children: [],
    height: 0,
    subtreeHeight: 0,
    x: 0,
    y: 0
  };

  if (type !== "object" && type !== "array") {
    node.lines.push(valueToText(value, type));
    return node;
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  let skippedLineCount = 0;
  let skippedBranchCount = 0;

  entries.forEach(([entryKey, entryValue]) => {
    const entryType = getValueType(entryValue);
    const childPath = appendPath(path, entryKey, Array.isArray(value));

    if (entryType === "object" || entryType === "array") {
      if (node.children.length < GRAPH_MAX_BRANCHES) {
        node.children.push(buildGraphModel(entryValue, String(entryKey), childPath, depth + 1));
      } else {
        skippedBranchCount += 1;
      }
      return;
    }

    if (node.lines.length < GRAPH_MAX_LINES) {
      const prefix = Array.isArray(value) ? `[${entryKey}]` : `${entryKey}`;
      node.lines.push(`${prefix}: ${previewValue(entryValue)}`);
      return;
    }
    skippedLineCount += 1;
  });

  if (!node.lines.length && !node.children.length) {
    node.lines.push(type === "array" ? t("emptyArray") : t("emptyObject"));
  }
  if (skippedLineCount > 0) {
    node.lines.push(t("lineMore", { count: skippedLineCount }));
  }
  if (skippedBranchCount > 0) {
    node.lines.push(t("branchMore", { count: skippedBranchCount }));
  }

  return node;
}

function collectBranchPaths(node, bucket) {
  if (!node) {
    return;
  }
  if (node.children?.length) {
    bucket.add(node.id);
    node.children.forEach((child) => collectBranchPaths(child, bucket));
  }
}

function estimateNodeHeight(linesCount) {
  return Math.max(54, 46 + linesCount * 18);
}

function measureGraphTree(node, collapsedPaths) {
  node.height = estimateNodeHeight(node.lines.length);
  if (!node.children.length || collapsedPaths.has(node.id)) {
    node.subtreeHeight = node.height;
    return;
  }

  node.children.forEach((child) => {
    measureGraphTree(child, collapsedPaths);
  });

  const childrenHeight = node.children.reduce((sum, child) => sum + child.subtreeHeight, 0);
  const childrenGap = GRAPH_VERTICAL_GAP * Math.max(0, node.children.length - 1);
  node.subtreeHeight = Math.max(node.height, childrenHeight + childrenGap);
}

function placeGraphTree(node, top, collapsedPaths, depth = 0) {
  node.depth = depth;
  node.x = GRAPH_PADDING_X + depth * (GRAPH_NODE_WIDTH + GRAPH_HORIZONTAL_GAP);
  node.y = top + (node.subtreeHeight - node.height) / 2;

  if (!node.children.length || collapsedPaths.has(node.id)) {
    return;
  }

  const childrenHeight = node.children.reduce((sum, child) => sum + child.subtreeHeight, 0);
  const childrenGap = GRAPH_VERTICAL_GAP * Math.max(0, node.children.length - 1);
  let cursor = top + (node.subtreeHeight - (childrenHeight + childrenGap)) / 2;

  node.children.forEach((child) => {
    placeGraphTree(child, cursor, collapsedPaths, depth + 1);
    cursor += child.subtreeHeight + GRAPH_VERTICAL_GAP;
  });
}

function flattenVisibleGraphNodes(root, collapsedPaths) {
  const list = [];
  const stack = [root];

  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    list.push(node);
    if (collapsedPaths.has(node.id)) {
      continue;
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }

  return list;
}

function getMaxDepth(nodes) {
  return nodes.reduce((max, node) => Math.max(max, node.depth), 0);
}

function drawGraphEdges(svg, node, collapsedPaths) {
  if (collapsedPaths.has(node.id)) {
    return;
  }

  node.children.forEach((child) => {
    const startX = node.x + GRAPH_NODE_WIDTH;
    const startY = node.y + node.height / 2;
    const endX = child.x;
    const endY = child.y + child.height / 2;
    const curve = Math.max(34, GRAPH_HORIZONTAL_GAP * 0.48);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`
    );
    path.setAttribute("class", "json-graph-edge");
    svg.append(path);

    drawGraphEdges(svg, child, collapsedPaths);
  });
}

function createGraphNodeElement(node, collapsedPaths, onToggle, onCopyPath) {
  const box = document.createElement("article");
  box.className = "json-graph-node";
  if (node.children.length) {
    box.classList.add("is-branch");
  }
  box.style.left = `${node.x}px`;
  box.style.top = `${node.y}px`;
  box.style.width = `${GRAPH_NODE_WIDTH}px`;
  box.style.minHeight = `${node.height}px`;

  const head = document.createElement("div");
  head.className = "json-graph-head";

  const title = document.createElement("p");
  title.className = "json-graph-title";
  title.textContent = node.title;

  const tools = document.createElement("div");
  tools.className = "json-graph-tools";

  const copyPathBtn = document.createElement("button");
  copyPathBtn.type = "button";
  copyPathBtn.className = "json-graph-copy-path";
  copyPathBtn.textContent = "🔗";
  copyPathBtn.title = node.path;
  copyPathBtn.setAttribute("aria-label", node.path);
  copyPathBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    onCopyPath(node.path);
  });
  tools.append(copyPathBtn);

  if (node.children.length) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "json-graph-toggle";
    const collapsed = collapsedPaths.has(node.id);
    toggle.textContent = collapsed ? "+" : "-";
    toggle.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      onToggle(node.id);
    });
    tools.append(toggle);
  }

  head.append(title, tools);
  box.append(head);

  if (node.lines.length) {
    const list = document.createElement("div");
    list.className = "json-graph-lines";
    node.lines.forEach((lineText) => {
      const line = document.createElement("p");
      line.className = "json-graph-line";
      line.textContent = lineText;
      list.append(line);
    });
    box.append(list);
  }

  if (node.children.length) {
    box.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      onToggle(node.id);
    });
  }

  return box;
}

export default function initJsonTreeViewer() {
  const input = document.querySelector("#jtv-input");
  const tree = document.querySelector("#jtv-tree");
  const graph = document.querySelector("#jtv-graph");
  const graphInner = document.querySelector("#jtv-graph-inner");
  const graphControls = document.querySelector("#jtv-graph-controls");
  const zoomLabel = document.querySelector("#jtv-zoom-label");
  const zoomValue = document.querySelector("#jtv-zoom-value");
  const zoomRange = document.querySelector("#jtv-zoom-range");
  const zoomOutBtn = document.querySelector("#jtv-zoom-out");
  const zoomInBtn = document.querySelector("#jtv-zoom-in");
  const zoomResetBtn = document.querySelector("#jtv-zoom-reset");
  const status = document.querySelector("#jtv-status");
  const modeTreeBtn = document.querySelector("#jtv-mode-tree");
  const modeGraphBtn = document.querySelector("#jtv-mode-graph");
  const parseBtn = document.querySelector("#jtv-parse-btn");
  const expandBtn = document.querySelector("#jtv-expand-btn");
  const collapseBtn = document.querySelector("#jtv-collapse-btn");
  const sampleBtn = document.querySelector("#jtv-sample-btn");
  const clearBtn = document.querySelector("#jtv-clear-btn");
  const copyBtn = document.querySelector("#jtv-copy-btn");

  if (
    !input ||
    !tree ||
    !graph ||
    !graphInner ||
    !graphControls ||
    !zoomLabel ||
    !zoomValue ||
    !zoomRange ||
    !zoomOutBtn ||
    !zoomInBtn ||
    !zoomResetBtn ||
    !status ||
    !modeTreeBtn ||
    !modeGraphBtn
  ) {
    return;
  }

  bindPageI18n({
    title: {
      zh: "ToolNestTW JSON Tree Viewer",
      en: "ToolNestTW JSON Tree Viewer"
    },
    text: {
      ".hero h1": { zh: "JSON Tree Viewer", en: "JSON Tree Viewer" },
      ".hero .lead": {
        zh: "將 JSON 內容解析為可展開樹狀結構，並支援圖形模式檢視。",
        en: "Parse JSON into an expandable tree and inspect it in graph mode."
      },
      ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
      ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作", en: "Actions" },
      ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出", en: "Output" },
      ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
      ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
      ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
      'label[for="jtv-input"]': { zh: "JSON 內容", en: "JSON input" },
      "#jtv-mode-tree": { zh: "清單模式", en: "List mode" },
      "#jtv-mode-graph": { zh: "圖形模式", en: "Graph mode" },
      "#jtv-zoom-label": { zh: "縮放", en: "Zoom" },
      "#jtv-zoom-reset": { zh: "重置", en: "Reset" },
      "#jtv-parse-btn": { zh: "解析 Tree", en: "Parse Tree" },
      "#jtv-expand-btn": { zh: "全部展開", en: "Expand All" },
      "#jtv-collapse-btn": { zh: "全部收合", en: "Collapse All" },
      "#jtv-sample-btn": { zh: "載入範例", en: "Load Example" },
      "#jtv-clear-btn": { zh: "清除", en: "Clear" },
      "#jtv-copy-btn": { zh: "複製格式化 JSON", en: "Copy Formatted JSON" },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
        zh: "1. 貼上 JSON 內容。",
        en: "1. Paste JSON input."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
        zh: "2. 點擊解析 Tree。",
        en: "2. Click Parse Tree."
      },
      ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
        zh: "3. 可切換圖形模式，點節點收合/展開並用 🔗 複製節點路徑。",
        en: "3. In graph mode, click nodes to collapse/expand and use 🔗 to copy node path."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
        zh: "解析失敗？ 通常是 JSON 格式不合法（引號、逗號、括號）。",
        en: "Parse failed? The JSON syntax is likely invalid."
      },
      ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
        zh: "會上傳資料嗎？ 不會，全部在瀏覽器本機運算。",
        en: "Is input uploaded? No, all processing is local in browser."
      }
    },
    placeholder: {
      "#jtv-input": {
        zh: '例如：{"project":"ToolNestTW","items":[1,2,3]}',
        en: 'Example: {"project":"ToolNestTW","items":[1,2,3]}'
      }
    }
  });

  input.value = loadRecentInput(TOOL_PATH);
  let lastParsed = null;
  let currentMode = "tree";
  let zoomPercent = 100;
  let graphBaseWidth = 0;
  let graphBaseHeight = 0;
  let pinchActive = false;
  let pinchStartDistance = 0;
  let pinchStartZoom = 100;
  const collapsedPaths = new Set();

  bindCopyButton(copyBtn, () => (lastParsed ? JSON.stringify(lastParsed, null, 2) : ""));

  const renderZoomValue = () => {
    zoomValue.textContent = `${zoomPercent}%`;
  };

  const applyZoom = () => {
    renderZoomValue();
    zoomRange.value = String(zoomPercent);

    const stage = graphInner.querySelector(".json-graph-stage");
    if (!stage || graphBaseWidth <= 0 || graphBaseHeight <= 0) {
      return;
    }

    const scale = zoomPercent / 100;
    stage.style.transform = `scale(${scale})`;
    graphInner.style.width = `${graphBaseWidth * scale}px`;
    graphInner.style.height = `${Math.max(graphBaseHeight * scale, 200)}px`;
  };

  const applyMode = () => {
    const isTree = currentMode === "tree";
    tree.hidden = !isTree;
    graph.hidden = isTree;
    graphControls.hidden = isTree;
    modeTreeBtn.classList.toggle("btn-primary", isTree);
    modeGraphBtn.classList.toggle("btn-primary", !isTree);
    expandBtn.disabled = !isTree;
    collapseBtn.disabled = !isTree;
    zoomLabel.hidden = isTree;
    zoomValue.hidden = isTree;
    zoomRange.disabled = isTree;
    zoomOutBtn.disabled = isTree;
    zoomInBtn.disabled = isTree;
    zoomResetBtn.disabled = isTree;
  };

  const toggleCollapseByPath = (path) => {
    if (collapsedPaths.has(path)) {
      collapsedPaths.delete(path);
    } else {
      collapsedPaths.add(path);
    }
    if (lastParsed) {
      renderGraph(lastParsed);
    }
  };

  const handleCopyPath = async (path) => {
    try {
      await copyText(path);
      toast(t("copiedPath"), "success");
    } catch {
      toast(t("invalidInput"));
    }
  };

  const renderGraph = (parsed) => {
    graphInner.replaceChildren();

    const root = buildGraphModel(parsed);
    measureGraphTree(root, collapsedPaths);
    placeGraphTree(root, GRAPH_PADDING_Y, collapsedPaths);
    const nodes = flattenVisibleGraphNodes(root, collapsedPaths);
    const maxDepth = getMaxDepth(nodes);

    graphBaseWidth =
      GRAPH_PADDING_X * 2 + (maxDepth + 1) * GRAPH_NODE_WIDTH + maxDepth * GRAPH_HORIZONTAL_GAP;
    graphBaseHeight = root.subtreeHeight + GRAPH_PADDING_Y * 2;

    const stage = document.createElement("div");
    stage.className = "json-graph-stage";
    stage.style.width = `${graphBaseWidth}px`;
    stage.style.height = `${graphBaseHeight}px`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "json-graph-svg");
    svg.setAttribute("viewBox", `0 0 ${graphBaseWidth} ${graphBaseHeight}`);
    svg.setAttribute("width", String(graphBaseWidth));
    svg.setAttribute("height", String(graphBaseHeight));
    drawGraphEdges(svg, root, collapsedPaths);

    const nodeLayer = document.createElement("div");
    nodeLayer.className = "json-graph-node-layer";
    nodeLayer.append(
      ...nodes.map((node) =>
        createGraphNodeElement(node, collapsedPaths, toggleCollapseByPath, handleCopyPath)
      )
    );

    stage.append(svg, nodeLayer);
    graphInner.append(stage);
    applyZoom();
  };

  const resetOutput = () => {
    lastParsed = null;
    status.textContent = t("noTree");
    tree.replaceChildren();
    graphInner.replaceChildren();
    graphBaseWidth = 0;
    graphBaseHeight = 0;
    collapsedPaths.clear();
  };

  const renderParsed = (parsed) => {
    const root = createTreeNode(parsed, null, "root", 1, handleCopyPath);
    tree.replaceChildren(root.node);
    renderGraph(parsed);
    status.textContent = t("statusTree", { nodes: root.count, depth: root.depth });
  };

  const parse = () => {
    const source = input.value.trim();
    if (!source) {
      toast(t("invalidInput"));
      return;
    }

    try {
      const parsed = JSON.parse(source);
      lastParsed = parsed;
      collapsedPaths.clear();
      collectBranchPaths(buildGraphModel(parsed), collapsedPaths);
      renderParsed(parsed);
      toast(t("parsed"), "success");
      saveRecentInput(TOOL_PATH, input.value);
    } catch {
      toast(t("invalidInput"));
    }
  };

  parseBtn?.addEventListener("click", parse);
  expandBtn?.addEventListener("click", () => {
    setAllBranchesOpen(tree, true);
  });
  collapseBtn?.addEventListener("click", () => {
    setAllBranchesOpen(tree, false);
  });
  modeTreeBtn.addEventListener("click", () => {
    currentMode = "tree";
    applyMode();
  });
  modeGraphBtn.addEventListener("click", () => {
    currentMode = "graph";
    applyMode();
  });

  const setZoom = (nextZoom) => {
    zoomPercent = Math.max(40, Math.min(220, Math.round(nextZoom)));
    applyZoom();
  };

  zoomRange.addEventListener("input", () => {
    setZoom(Number(zoomRange.value));
  });
  zoomOutBtn.addEventListener("click", () => {
    setZoom(zoomPercent - 10);
  });
  zoomInBtn.addEventListener("click", () => {
    setZoom(zoomPercent + 10);
  });
  zoomResetBtn.addEventListener("click", () => {
    setZoom(100);
  });

  graph.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      setZoom(zoomPercent + (event.deltaY < 0 ? 8 : -8));
    },
    { passive: false }
  );

  const touchDistance = (touchA, touchB) => {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.hypot(dx, dy);
  };

  graph.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 2) {
        return;
      }
      pinchActive = true;
      pinchStartDistance = touchDistance(event.touches[0], event.touches[1]);
      pinchStartZoom = zoomPercent;
    },
    { passive: false }
  );

  graph.addEventListener(
    "touchmove",
    (event) => {
      if (!pinchActive || event.touches.length !== 2) {
        return;
      }
      event.preventDefault();
      const currentDistance = touchDistance(event.touches[0], event.touches[1]);
      if (currentDistance <= 0 || pinchStartDistance <= 0) {
        return;
      }
      setZoom((pinchStartZoom * currentDistance) / pinchStartDistance);
    },
    { passive: false }
  );

  const stopPinchIfNeeded = (event) => {
    if (event.touches.length < 2) {
      pinchActive = false;
    }
  };
  graph.addEventListener("touchend", stopPinchIfNeeded);
  graph.addEventListener("touchcancel", () => {
    pinchActive = false;
  });

  sampleBtn?.addEventListener("click", () => {
    input.value = SAMPLE_JSON;
    saveRecentInput(TOOL_PATH, input.value);
    parse();
  });
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearRecentInput(TOOL_PATH);
    resetOutput();
  });
  input.addEventListener("input", () => {
    saveRecentInput(TOOL_PATH, input.value);
  });

  onLanguageChange(() => {
    if (lastParsed) {
      renderParsed(lastParsed);
      applyMode();
      return;
    }
    status.textContent = t("noTree");
    applyMode();
    renderZoomValue();
  });

  applyMode();
  renderZoomValue();
  status.textContent = t("noTree");
}
