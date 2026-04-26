import { downloadBlob } from "/assets/components/download.js?v=1.6.26";
import { toast } from "/assets/components/toast.js?v=1.6.26";

const STORAGE_KEY = "ToolNestTW:llmChat:profiles";
const MAX_IMAGES = 8;
const DEFAULT_IMAGE_MAX_EDGE = 1600;
const DEFAULT_IMAGE_QUALITY = 0.85;
const DEFAULT_CONTEXT_ROUNDS = 10;
const SERVICE_TEMPLATES = {
  openai: {
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1"
  },
  gemini: {
    name: "Gemini",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-pro"
  },
  openrouter: {
    name: "OpenRouter",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4.1"
  },
  ollama: {
    name: "Ollama",
    apiUrl: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2"
  },
  lmstudio: {
    name: "LM Studio",
    apiUrl: "http://localhost:1234/v1/chat/completions",
    model: "local-model"
  }
};

function readProfiles() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function normalizeName(name) {
  return String(name || "").trim();
}

function getProfileKey(name) {
  return normalizeName(name).toLowerCase();
}

function inferProtocol({ name, apiUrl, model }) {
  const text = `${name} ${apiUrl} ${model}`.toLowerCase();
  return text.includes("gemini") || text.includes("generativelanguage.googleapis.com") ? "gemini" : "openai";
}

function dataUrlToGeminiPart(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    inline_data: {
      mime_type: match[1],
      data: match[2]
    }
  };
}

function getGeminiUrl(apiUrl, model, apiKey, stream = false) {
  const trimmed = String(apiUrl || "").trim();
  const method = stream ? "streamGenerateContent" : "generateContent";
  let url;
  if (trimmed.includes(":generateContent") || trimmed.includes(":streamGenerateContent")) {
    url = trimmed
      .replace("{model}", encodeURIComponent(model))
      .replace(/:(streamGenerateContent|generateContent)/, `:${method}`);
  } else {
    const base = trimmed.replace(/\/$/, "");
    const prefix = /\/v\d+(beta|alpha)?$/i.test(base) ? base : `${base}/v1beta`;
    url = `${prefix}/models/${encodeURIComponent(model)}:${method}`;
  }
  const parsed = new URL(url);
  if (apiKey && !parsed.searchParams.has("key")) {
    parsed.searchParams.set("key", apiKey);
  }
  if (stream && !parsed.searchParams.has("alt")) {
    parsed.searchParams.set("alt", "sse");
  }
  return parsed.toString();
}

function getOpenAiMessages(messages, systemPrompt) {
  const result = [];
  if (systemPrompt.trim()) {
    result.push({ role: "system", content: systemPrompt.trim() });
  }
  messages.forEach((message) => {
    if (message.role === "user" && message.images?.length) {
      result.push({
        role: "user",
        content: [
          { type: "text", text: message.content || "" },
          ...message.images.map((image) => ({
            type: "image_url",
            image_url: { url: image.dataUrl }
          }))
        ]
      });
      return;
    }
    result.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content || ""
    });
  });
  return result;
}

function getTextTranscript(messages) {
  return messages.map((message) => {
    const role = message.role === "assistant" ? "Assistant" : "User";
    const imageNote = message.images?.length ? ` [${message.images.length} image(s)]` : "";
    return `${role}${imageNote}: ${message.content || ""}`;
  }).join("\n\n");
}

function estimateTextStats(text) {
  const content = String(text || "");
  const cjkCount = (content.match(/[\u3400-\u9fff\u3040-\u30ff\uff00-\uffef]/g) || []).length;
  const nonWhitespaceCount = (content.match(/\S/g) || []).length;
  const wordCount = (content.match(/[A-Za-z0-9_]+|[\u3400-\u9fff]/g) || []).length;
  const tokenCount = Math.ceil(cjkCount * 0.8 + Math.max(0, nonWhitespaceCount - cjkCount) / 4);
  return {
    charCount: nonWhitespaceCount,
    wordCount,
    tokenCount
  };
}

function getRecentMessagesByRounds(messages, rounds) {
  const limit = Math.max(1, Number(rounds) || DEFAULT_CONTEXT_ROUNDS);
  let seenUsers = 0;
  let startIndex = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      seenUsers += 1;
      if (seenUsers === limit) {
        startIndex = index;
        break;
      }
    }
  }
  return seenUsers < limit ? [...messages] : messages.slice(startIndex);
}

function getOldMessagesByRounds(messages, rounds) {
  const recent = getRecentMessagesByRounds(messages, rounds);
  return messages.slice(0, Math.max(0, messages.length - recent.length));
}

function buildSystemPrompt(systemPrompt, contextSummary) {
  const parts = [];
  if (systemPrompt.trim()) {
    parts.push(systemPrompt.trim());
  }
  if (contextSummary.trim()) {
    parts.push(`以下是舊對話摘要，請視為已知上下文並在回答時延續：\n${contextSummary.trim()}`);
  }
  return parts.join("\n\n");
}

function getGeminiContents(messages) {
  return messages.map((message) => {
    const parts = [];
    if (message.content) {
      parts.push({ text: message.content });
    }
    if (message.role === "user" && message.images?.length) {
      message.images.forEach((image) => {
        const part = dataUrlToGeminiPart(image.dataUrl);
        if (part) {
          parts.push(part);
        }
      });
    }
    return {
      role: message.role === "assistant" ? "model" : "user",
      parts: parts.length ? parts : [{ text: "" }]
    };
  });
}

function getReadableApiError(statusCode, json, fallback = "") {
  const apiMessage = json?.error?.message || json?.message || fallback;
  if (statusCode === 0) {
    return "瀏覽器無法連線到 API。常見原因是 CORS 未開放、URL 錯誤，或本機服務未啟動。";
  }
  if (statusCode === 400) {
    return `請求格式錯誤。請檢查模型名稱、圖片格式或 API URL。${apiMessage ? ` 原始訊息：${apiMessage}` : ""}`;
  }
  if (statusCode === 401) {
    return "API KEY 無效或已過期。請重新確認 Key。";
  }
  if (statusCode === 403) {
    return `權限不足。請確認 API KEY 是否有模型權限、帳號是否啟用該服務。${apiMessage ? ` 原始訊息：${apiMessage}` : ""}`;
  }
  if (statusCode === 404) {
    return "找不到 API 端點或模型。請檢查 API URL 與 API MODEL。";
  }
  if (statusCode === 429) {
    return "請求過多或額度不足。請稍後再試，或檢查帳號 quota。";
  }
  if (statusCode >= 500) {
    return `API 服務端錯誤 HTTP ${statusCode}。可稍後重試。${apiMessage ? ` 原始訊息：${apiMessage}` : ""}`;
  }
  return apiMessage || `HTTP ${statusCode}`;
}

function getReadableClientError(error) {
  if (error?.name === "AbortError") {
    return "已停止請求。";
  }
  if (error instanceof TypeError) {
    return "瀏覽器無法完成請求。常見原因是 CORS 未開放、API URL 錯誤、HTTPS/HTTP 混用，或本機服務未啟動。";
  }
  return `請求失敗：${error?.message || error}`;
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function dataURLToImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = dataUrl;
  });
}

async function compressImageFile(file, maxEdge, quality) {
  const originalDataUrl = await readFileAsDataURL(file);
  const image = await dataURLToImageElement(originalDataUrl);
  const safeMaxEdge = Math.max(256, Math.min(4096, Number(maxEdge) || DEFAULT_IMAGE_MAX_EDGE));
  const safeQuality = Math.max(0.3, Math.min(1, Number(quality) || DEFAULT_IMAGE_QUALITY));
  const scale = Math.min(1, safeMaxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  if (scale === 1 && file.size < 900 * 1024) {
    return {
      dataUrl: originalDataUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
      originalBytes: file.size,
      outputBytes: file.size,
      compressed: false
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/webp", safeQuality);
  const outputBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  return {
    dataUrl,
    width,
    height,
    originalBytes: file.size,
    outputBytes,
    compressed: scale < 1 || outputBytes < file.size
  };
}

async function fileToAttachment(file, options) {
  const result = await compressImageFile(file, options.maxEdge, options.quality);
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name: file.name || "image",
    type: result.dataUrl.match(/^data:([^;]+)/)?.[1] || file.type || "image/png",
    dataUrl: result.dataUrl,
    width: result.width,
    height: result.height,
    originalBytes: result.originalBytes,
    outputBytes: result.outputBytes,
    compressed: result.compressed
  };
}

function parseOpenAiResponse(json) {
  return json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || "";
}

function parseGeminiResponse(json) {
  return json?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

function parseOpenAiStreamChunk(json) {
  return json?.choices?.map((choice) => choice.delta?.content || choice.message?.content || choice.text || "").join("") || "";
}

function parseGeminiStreamChunk(json) {
  return json?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function readSseStream(response, parseChunk, onDelta) {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const processEvent = (eventText) => {
    const dataLines = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    dataLines.forEach((data) => {
      if (!data || data === "[DONE]") {
        return;
      }
      try {
        const delta = parseChunk(JSON.parse(data));
        if (delta) {
          fullText += delta;
          onDelta(delta, fullText);
        }
      } catch {
        // Ignore malformed partial SSE records.
      }
    });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n+/);
    buffer = events.pop() || "";
    events.forEach(processEvent);
  }
  if (buffer.trim()) {
    processEvent(buffer);
  }
  return fullText;
}

function toMarkdown(messages, contextSummary = "") {
  const summary = contextSummary.trim() ? `## 舊上下文摘要\n\n${contextSummary.trim()}\n\n---\n\n` : "";
  return `${summary}${messages.map((message) => {
    const title = message.role === "assistant" ? "Assistant" : "User";
    const images = message.images?.length
      ? `\n\n${message.images.map((image) => `![${image.name}](${image.dataUrl})`).join("\n")}`
      : "";
    return `## ${title}\n\n${message.content || ""}${images}`;
  }).join("\n\n---\n\n")}`;
}

export default function initLlmChat() {
  const templateSelect = document.querySelector("#llm-template");
  const profileSelect = document.querySelector("#llm-profile-select");
  const nameInput = document.querySelector("#llm-name");
  const apiUrlInput = document.querySelector("#llm-api-url");
  const modelInput = document.querySelector("#llm-model");
  const modelList = document.querySelector("#llm-model-list");
  const apiKeyInput = document.querySelector("#llm-api-key");
  const systemInput = document.querySelector("#llm-system");
  const imageMaxEdgeInput = document.querySelector("#llm-image-max-edge");
  const imageQualityInput = document.querySelector("#llm-image-quality");
  const streamInput = document.querySelector("#llm-stream");
  const contextRoundsInput = document.querySelector("#llm-context-rounds");
  const contextStats = document.querySelector("#llm-context-stats");
  const contextSummaryInput = document.querySelector("#llm-context-summary");
  const summarizeContextBtn = document.querySelector("#llm-summarize-context");
  const clearSummaryBtn = document.querySelector("#llm-clear-summary");
  const saveProfileBtn = document.querySelector("#llm-save-profile");
  const deleteProfileBtn = document.querySelector("#llm-delete-profile");
  const toggleKeyBtn = document.querySelector("#llm-toggle-key");
  const status = document.querySelector("#llm-status");
  const messageHost = document.querySelector("#llm-messages");
  const attachmentHost = document.querySelector("#llm-attachments");
  const input = document.querySelector("#llm-input");
  const imageInput = document.querySelector("#llm-image-input");
  const sendBtn = document.querySelector("#llm-send");
  const stopBtn = document.querySelector("#llm-stop");
  const clearChatBtn = document.querySelector("#llm-clear-chat");
  const exportMdBtn = document.querySelector("#llm-export-md");
  const exportJsonBtn = document.querySelector("#llm-export-json");

  if (
    !templateSelect ||
    !profileSelect ||
    !nameInput ||
    !apiUrlInput ||
    !modelInput ||
    !modelList ||
    !apiKeyInput ||
    !systemInput ||
    !imageMaxEdgeInput ||
    !imageQualityInput ||
    !streamInput ||
    !contextRoundsInput ||
    !contextStats ||
    !contextSummaryInput ||
    !summarizeContextBtn ||
    !clearSummaryBtn ||
    !saveProfileBtn ||
    !deleteProfileBtn ||
    !toggleKeyBtn ||
    !status ||
    !messageHost ||
    !attachmentHost ||
    !input ||
    !imageInput ||
    !sendBtn ||
    !stopBtn ||
    !clearChatBtn ||
    !exportMdBtn ||
    !exportJsonBtn
  ) {
    return;
  }

  const state = {
    messages: [],
    attachments: [],
    abortController: null,
    profiles: readProfiles(),
    contextSummary: ""
  };

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("status-invalid", isError);
  }

  function getContextRounds() {
    return Math.max(1, Math.min(200, Number(contextRoundsInput.value) || DEFAULT_CONTEXT_ROUNDS));
  }

  function getRequestMessages(messages = state.messages) {
    return getRecentMessagesByRounds(messages, getContextRounds());
  }

  function getContextSummary() {
    return contextSummaryInput.value.trim();
  }

  function updateContextStats() {
    const requestMessages = getRequestMessages();
    const summary = getContextSummary();
    const transcript = `${summary}\n\n${getTextTranscript(requestMessages)}`;
    const stats = estimateTextStats(transcript);
    const oldCount = getOldMessagesByRounds(state.messages, getContextRounds()).length;
    contextStats.textContent = `目前會送出最近 ${getContextRounds()} 輪，省略 ${oldCount} 則舊訊息；約 ${stats.charCount} 字、${stats.wordCount} 詞、${stats.tokenCount} tokens。`;
  }

  function renderProfiles(selectedKey = "") {
    const entries = Object.entries(state.profiles).sort((a, b) => a[1].name.localeCompare(b[1].name));
    profileSelect.replaceChildren(
      new Option(entries.length ? "選擇已儲存設定" : "尚無紀錄", ""),
      ...entries.map(([key, profile]) => new Option(profile.name, key))
    );
    profileSelect.value = selectedKey;
  }

  function renderModelList() {
    const key = getProfileKey(nameInput.value);
    const profile = state.profiles[key];
    modelList.replaceChildren(...(profile?.models || []).map((model) => {
      const option = document.createElement("option");
      option.value = model;
      return option;
    }));
  }

  function loadProfile(key) {
    const profile = state.profiles[key];
    if (!profile) {
      return;
    }
    nameInput.value = profile.name || "";
    apiUrlInput.value = profile.apiUrl || "";
    apiKeyInput.value = profile.apiKey || "";
    modelInput.value = profile.lastModel || profile.models?.[0] || "";
    systemInput.value = profile.systemPrompt || "";
    streamInput.checked = profile.stream !== false;
    imageMaxEdgeInput.value = profile.imageMaxEdge || DEFAULT_IMAGE_MAX_EDGE;
    imageQualityInput.value = profile.imageQuality || DEFAULT_IMAGE_QUALITY;
    contextRoundsInput.value = profile.contextRounds || DEFAULT_CONTEXT_ROUNDS;
    renderModelList();
    updateContextStats();
  }

  function saveCurrentProfile() {
    const name = normalizeName(nameInput.value);
    const model = modelInput.value.trim();
    if (!name) {
      toast("請輸入名字");
      return "";
    }
    const key = getProfileKey(name);
    const previous = state.profiles[key] || { name, models: [] };
    const models = model ? [model, ...(previous.models || []).filter((item) => item !== model)] : previous.models || [];
    state.profiles[key] = {
      name,
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value,
      lastModel: model || previous.lastModel || "",
      models: models.slice(0, 30),
      systemPrompt: systemInput.value,
      stream: streamInput.checked,
      imageMaxEdge: Number(imageMaxEdgeInput.value) || DEFAULT_IMAGE_MAX_EDGE,
      imageQuality: Number(imageQualityInput.value) || DEFAULT_IMAGE_QUALITY,
      contextRounds: Number(contextRoundsInput.value) || DEFAULT_CONTEXT_ROUNDS
    };
    writeProfiles(state.profiles);
    renderProfiles(key);
    renderModelList();
    return key;
  }

  function renderAttachments() {
    if (!state.attachments.length) {
      attachmentHost.hidden = true;
      attachmentHost.replaceChildren();
      return;
    }
    attachmentHost.hidden = false;
    attachmentHost.replaceChildren(...state.attachments.map((image) => {
      const item = document.createElement("button");
      const thumb = document.createElement("img");
      const name = document.createElement("span");
      const meta = document.createElement("small");
      item.type = "button";
      item.className = "llm-attachment";
      item.title = "移除圖片";
      thumb.src = image.dataUrl;
      thumb.alt = "";
      name.textContent = image.name;
      meta.textContent = image.compressed ? `${image.width}x${image.height}` : "原尺寸";
      item.append(thumb, name, meta);
      item.addEventListener("click", () => {
        state.attachments = state.attachments.filter((entry) => entry.id !== image.id);
        renderAttachments();
      });
      return item;
    }));
  }

  function renderMessages() {
    if (!state.messages.length) {
      const empty = document.createElement("div");
      empty.className = "thumb-empty";
      empty.textContent = "尚無對話。輸入訊息後會保留上下文。";
      messageHost.replaceChildren(empty);
      updateContextStats();
      return;
    }
    messageHost.replaceChildren(...state.messages.map((message) => {
      const item = document.createElement("article");
      const heading = document.createElement("h3");
      const body = document.createElement("pre");
      item.className = `llm-message is-${message.role}`;
      heading.textContent = message.role === "assistant" ? "Assistant" : "User";
      body.textContent = message.content || "";
      item.append(heading, body);
      if (message.images?.length) {
        const imageHost = document.createElement("div");
        imageHost.className = "llm-message-images";
        message.images.forEach((image) => {
          const thumb = document.createElement("img");
          thumb.src = image.dataUrl;
          thumb.alt = image.name;
          imageHost.append(thumb);
        });
        item.append(imageHost);
      }
      return item;
    }));
    messageHost.scrollTop = messageHost.scrollHeight;
    updateContextStats();
  }

  async function addImageFiles(files) {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      return;
    }
    const remaining = Math.max(0, MAX_IMAGES - state.attachments.length);
    const options = {
      maxEdge: Number(imageMaxEdgeInput.value) || DEFAULT_IMAGE_MAX_EDGE,
      quality: Number(imageQualityInput.value) || DEFAULT_IMAGE_QUALITY
    };
    setStatus("正在處理圖片...");
    const next = await Promise.all(imageFiles.slice(0, remaining).map((file) => fileToAttachment(file, options)));
    state.attachments.push(...next);
    renderAttachments();
    if (next.some((image) => image.compressed)) {
      setStatus("圖片已自動壓縮，可送出訊息。");
    } else {
      setStatus("圖片已加入，可送出訊息。");
    }
  }

  async function callOpenAi(config, messages, onDelta) {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      signal: state.abortController.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: getOpenAiMessages(messages, buildSystemPrompt(config.systemPrompt, config.contextSummary)),
        stream: config.stream
      })
    });
    if (config.stream && response.ok) {
      return readSseStream(response, parseOpenAiStreamChunk, onDelta);
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getReadableApiError(response.status, json));
    }
    return parseOpenAiResponse(json);
  }

  async function callGemini(config, messages, onDelta) {
    const body = {
      contents: getGeminiContents(messages)
    };
    const systemPrompt = buildSystemPrompt(config.systemPrompt, config.contextSummary);
    if (systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt.trim() }] };
    }
    const response = await fetch(getGeminiUrl(config.apiUrl, config.model, config.apiKey, config.stream), {
      method: "POST",
      signal: state.abortController.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (config.stream && response.ok) {
      return readSseStream(response, parseGeminiStreamChunk, onDelta);
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getReadableApiError(response.status, json));
    }
    return parseGeminiResponse(json);
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text && !state.attachments.length) {
      toast("請輸入訊息或加入圖片");
      return;
    }
    const config = {
      name: normalizeName(nameInput.value),
      apiUrl: apiUrlInput.value.trim(),
      model: modelInput.value.trim(),
      apiKey: apiKeyInput.value,
      systemPrompt: systemInput.value,
      contextSummary: getContextSummary(),
      stream: streamInput.checked
    };
    if (!config.name || !config.apiUrl || !config.model || !config.apiKey) {
      toast("請完整填寫名字、API URL、API MODEL、API KEY");
      return;
    }

    const userMessage = {
      role: "user",
      content: text,
      images: state.attachments,
      createdAt: new Date().toISOString()
    };
    state.messages.push(userMessage);
    const requestMessages = getRequestMessages(state.messages);
    input.value = "";
    state.attachments = [];
    renderAttachments();
    renderMessages();

    state.abortController = new AbortController();
    sendBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("正在等待模型回覆...");

    try {
      const protocol = inferProtocol(config);
      const assistantMessage = {
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString()
      };
      state.messages.push(assistantMessage);
      renderMessages();
      const onDelta = (delta, fullText) => {
        assistantMessage.content = fullText || `${assistantMessage.content}${delta}`;
        renderMessages();
      };
      const reply = protocol === "gemini"
        ? await callGemini(config, requestMessages, onDelta)
        : await callOpenAi(config, requestMessages, onDelta);
      assistantMessage.content = reply || assistantMessage.content || "(空回覆)";
      saveCurrentProfile();
      setStatus(`完成，使用 ${protocol === "gemini" ? "Gemini" : "OpenAI-compatible"} 協議${config.stream ? "串流" : ""}。`);
    } catch (error) {
      if (state.messages.at(-1)?.role === "assistant" && !state.messages.at(-1).content) {
        state.messages.pop();
      }
      const message = getReadableClientError(error);
      setStatus(message, error?.name !== "AbortError");
      toast(message);
    } finally {
      state.abortController = null;
      sendBtn.disabled = false;
      stopBtn.disabled = true;
      renderMessages();
    }
  }

  async function summarizeOldContext() {
    const oldMessages = getOldMessagesByRounds(state.messages, getContextRounds());
    if (!oldMessages.length) {
      toast("沒有可摘要的舊上下文");
      return;
    }
    const config = {
      name: normalizeName(nameInput.value),
      apiUrl: apiUrlInput.value.trim(),
      model: modelInput.value.trim(),
      apiKey: apiKeyInput.value,
      systemPrompt: "你是對話上下文摘要器。請保留重要事實、使用者偏好、已完成事項、未解決問題、關鍵檔名/參數。不要加入不存在的資訊。",
      contextSummary: "",
      stream: false
    };
    if (!config.name || !config.apiUrl || !config.model || !config.apiKey) {
      toast("請先完整填寫 API 設定，才能摘要上下文");
      return;
    }

    const existingSummary = getContextSummary();
    const prompt = [
      "請把以下舊對話整理成後續可延續使用的精簡摘要。",
      "輸出使用繁體中文，條列重點即可。",
      existingSummary ? `目前已有摘要，請一併整合並去除重複：\n${existingSummary}` : "",
      `舊對話：\n${getTextTranscript(oldMessages)}`
    ].filter(Boolean).join("\n\n");

    state.abortController = new AbortController();
    summarizeContextBtn.disabled = true;
    sendBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("正在摘要舊上下文...");

    try {
      const protocol = inferProtocol(config);
      const summary = protocol === "gemini"
        ? await callGemini(config, [{ role: "user", content: prompt }], () => {})
        : await callOpenAi(config, [{ role: "user", content: prompt }], () => {});
      contextSummaryInput.value = summary.trim();
      state.contextSummary = contextSummaryInput.value;
      updateContextStats();
      setStatus(`已摘要 ${oldMessages.length} 則舊訊息，後續請求會帶入摘要。`);
    } catch (error) {
      const message = getReadableClientError(error);
      setStatus(message, error?.name !== "AbortError");
      toast(message);
    } finally {
      state.abortController = null;
      summarizeContextBtn.disabled = false;
      sendBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  templateSelect.addEventListener("change", () => {
    const template = SERVICE_TEMPLATES[templateSelect.value];
    if (!template) {
      return;
    }
    nameInput.value = template.name;
    apiUrlInput.value = template.apiUrl;
    modelInput.value = template.model;
    renderModelList();
    setStatus(`已套用 ${template.name} 模板，請確認 API KEY 與模型。`);
  });
  profileSelect.addEventListener("change", () => loadProfile(profileSelect.value));
  nameInput.addEventListener("input", renderModelList);
  contextRoundsInput.addEventListener("input", updateContextStats);
  contextSummaryInput.addEventListener("input", () => {
    state.contextSummary = contextSummaryInput.value;
    updateContextStats();
  });
  summarizeContextBtn.addEventListener("click", () => void summarizeOldContext());
  clearSummaryBtn.addEventListener("click", () => {
    contextSummaryInput.value = "";
    state.contextSummary = "";
    updateContextStats();
    setStatus("舊上下文摘要已清除。");
  });
  saveProfileBtn.addEventListener("click", () => {
    const key = saveCurrentProfile();
    if (key) {
      toast("設定已儲存", "success");
    }
  });
  deleteProfileBtn.addEventListener("click", () => {
    const key = getProfileKey(nameInput.value);
    if (!key || !state.profiles[key]) {
      return;
    }
    delete state.profiles[key];
    writeProfiles(state.profiles);
    renderProfiles();
    renderModelList();
    toast("設定已刪除", "success");
  });
  toggleKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
    toggleKeyBtn.textContent = apiKeyInput.type === "password" ? "顯示 Key" : "隱藏 Key";
  });
  imageInput.addEventListener("change", async () => {
    try {
      await addImageFiles(imageInput.files);
    } catch {
      setStatus("圖片處理失敗，請換一張圖片或降低尺寸。", true);
    } finally {
      imageInput.value = "";
    }
  });
  input.addEventListener("paste", async (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.some((file) => file.type.startsWith("image/"))) {
      try {
        await addImageFiles(files);
      } catch {
        setStatus("貼上的圖片處理失敗，請換一張圖片或降低尺寸。", true);
      }
    }
  });
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendMessage();
    }
  });
  sendBtn.addEventListener("click", () => void sendMessage());
  stopBtn.addEventListener("click", () => state.abortController?.abort());
  clearChatBtn.addEventListener("click", () => {
    state.messages = [];
    contextSummaryInput.value = "";
    state.contextSummary = "";
    renderMessages();
    setStatus("對話已清除。");
  });
  exportMdBtn.addEventListener("click", () => {
    const blob = new Blob([toMarkdown(state.messages, getContextSummary())], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, `llm-chat-${Date.now()}.md`);
  });
  exportJsonBtn.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        name: nameInput.value,
        apiUrl: apiUrlInput.value,
        model: modelInput.value,
        protocol: inferProtocol({ name: nameInput.value, apiUrl: apiUrlInput.value, model: modelInput.value }),
        contextRounds: getContextRounds()
      },
      contextSummary: getContextSummary(),
      messages: state.messages
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `llm-chat-${Date.now()}.json`);
  });

  renderProfiles();
  renderModelList();
  renderAttachments();
  renderMessages();
  updateContextStats();
}
