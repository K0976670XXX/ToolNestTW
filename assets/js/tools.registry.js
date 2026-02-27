export const toolRegistry = [
  {
    name: {
      en: "JSON Formatter",
      zh: "JSON 格式化"
    },
    path: "/text/json_formatter",
    category: "data",
    keywords: ["json", "format", "minify", "格式化"],
    summary: {
      zh: "整理 JSON 排版並快速檢視結構。",
      en: "Format JSON with clean, readable structure."
    }
  },
  {
    name: {
      en: "JSON Validator",
      zh: "JSON 驗證器"
    },
    path: "/data/json_validator",
    category: "data",
    keywords: ["json", "validate", "lint", "驗證", "檢查"],
    summary: {
      zh: "檢查 JSON 格式是否正確並顯示錯誤。",
      en: "Validate JSON syntax and show parse errors."
    }
  },
  {
    name: {
      en: "JSON Tree Viewer",
      zh: "JSON Tree 檢視器"
    },
    path: "/data/json_tree_viewer",
    category: "data",
    keywords: ["json", "tree", "viewer", "visualizer", "檢視", "樹狀"],
    summary: {
      zh: "將 JSON 解析成可展開的樹狀結構。",
      en: "Visualize JSON with an expandable tree view."
    }
  },
  {
    name: {
      en: "SQL Formatter",
      zh: "SQL 格式化"
    },
    path: "/data/sql_formatter",
    category: "data",
    keywords: ["sql", "formatter", "beautify", "query", "格式化"],
    summary: {
      zh: "將 SQL 指令整理成清楚易讀排版。",
      en: "Format SQL statements into cleaner readable layout."
    }
  },
  {
    name: {
      en: "URL Encoder / Decoder",
      zh: "URL 編碼解碼"
    },
    path: "/text/url_encode_decode",
    category: "dev",
    keywords: ["url", "encode", "decode", "編碼", "解碼"],
    summary: {
      zh: "URL 與文字即時互轉編碼格式。",
      en: "Encode and decode URL strings instantly."
    }
  },
  {
    name: {
      en: "Base64 Encoder / Decoder",
      zh: "Base64 編碼解碼"
    },
    path: "/text/base64_encode_decode",
    category: "dev",
    keywords: ["base64", "encode", "decode", "編碼", "解碼"],
    summary: {
      zh: "Base64 與原始文字雙向轉換。",
      en: "Convert text to and from Base64."
    }
  },
  {
    name: {
      en: "Traditional / Simplified Chinese Converter",
      zh: "繁簡轉換器"
    },
    path: "/text/translate_cc",
    category: "text",
    keywords: ["traditional", "simplified", "opencc", "繁體", "簡體", "繁簡轉換"],
    summary: {
      zh: "繁體與簡體中文內容快速互轉。",
      en: "Convert between Traditional and Simplified Chinese."
    }
  },
  {
    name: {
      en: "Text Diff Checker",
      zh: "文字差異比對"
    },
    path: "/text/text_diff",
    category: "text",
    keywords: ["diff", "text compare", "line compare", "差異", "比對"],
    summary: {
      zh: "逐行比對兩段文字內容差異。",
      en: "Compare text differences line by line."
    }
  },
  {
    name: {
      en: "Word Counter",
      zh: "字數統計"
    },
    path: "/text/word_counter",
    category: "text",
    keywords: ["word", "count", "text stats", "字數", "統計"],
    summary: {
      zh: "統計字數、行數、字元與位元組。",
      en: "Count words, lines, characters, and bytes."
    }
  },
  {
    name: {
      en: "Slug Generator",
      zh: "Slug 產生器"
    },
    path: "/text/slug_generator",
    category: "text",
    keywords: ["slug", "url", "seo", "網址", "產生器"],
    summary: {
      zh: "將標題文字轉成 SEO 友善網址片段。",
      en: "Convert titles into SEO-friendly URL slugs."
    }
  },
  {
    name: {
      en: "UUID Generator",
      zh: "UUID 產生器"
    },
    path: "/dev/uuid_generator",
    category: "dev",
    keywords: ["uuid", "guid", "random id", "隨機"],
    summary: {
      zh: "一鍵產生 UUID 識別碼。",
      en: "Generate UUID values in one click."
    }
  },
  {
    name: {
      en: "Hash Generator",
      zh: "雜湊產生器"
    },
    path: "/dev/hash_generator",
    category: "dev",
    keywords: ["md5", "sha1", "sha256", "hash", "雜湊"],
    summary: {
      zh: "計算 MD5、SHA1、SHA256 雜湊值。",
      en: "Generate MD5, SHA1, and SHA256 hashes."
    }
  },
  {
    name: {
      en: "Regex Tester",
      zh: "Regex 測試器"
    },
    path: "/dev/regex_tester",
    category: "dev",
    keywords: ["regex", "regexp", "match", "正則", "測試"],
    summary: {
      zh: "測試正則表達式並檢視匹配結果。",
      en: "Test regular expressions and inspect matches."
    }
  },
  {
    name: {
      en: "Color Converter",
      zh: "色彩轉換器"
    },
    path: "/dev/color_converter",
    category: "dev",
    keywords: ["color", "hex", "rgb", "hsl", "顏色", "轉換"],
    summary: {
      zh: "在 HEX、RGB、HSL 之間快速轉換。",
      en: "Convert between HEX, RGB, and HSL."
    }
  },
  {
    name: {
      en: "JWT Decoder",
      zh: "JWT 解碼器"
    },
    path: "/dev/jwt_decoder",
    category: "dev",
    keywords: ["jwt", "token", "decode", "json web token", "解碼"],
    summary: {
      zh: "解析 JWT Header 與 Payload 內容。",
      en: "Decode JWT header and payload fields."
    }
  },
  {
    name: {
      en: "Cron Parser",
      zh: "Cron 解析器"
    },
    path: "/dev/cron_parser",
    category: "dev",
    keywords: ["cron", "schedule", "parser", "next runs", "排程", "解析"],
    summary: {
      zh: "將 Cron 轉為可讀語句，並支援常見規則一鍵套用。",
      en: "Turn cron into clear language and apply common presets quickly."
    }
  },
  {
    name: {
      en: "Image Resize",
      zh: "圖片尺寸調整"
    },
    path: "/image/resize",
    category: "image",
    keywords: ["image", "resize", "dimensions", "圖片", "尺寸"],
    summary: {
      zh: "批量調整圖片尺寸，維持操作直覺。",
      en: "Resize image dimensions for single or batch files."
    }
  },
  {
    name: {
      en: "Gemini Watermark Remover",
      zh: "Gemini 浮水印移除"
    },
    path: "/image/remove_gemini_watermark",
    category: "image",
    keywords: ["gemini", "watermark", "remove", "圖片", "浮水印", "移除"],
    summary: {
      zh: "修復 Gemini 圖片右下浮水印區塊。",
      en: "Remove Gemini watermark blocks from images."
    }
  },
  {
    name: {
      en: "Image Compress",
      zh: "圖片壓縮"
    },
    path: "/image/compress",
    category: "image",
    keywords: ["image", "compress", "quality", "圖片", "壓縮"],
    summary: {
      zh: "透過品質設定批量壓縮圖片。",
      en: "Compress images in batch with quality control."
    }
  },
  {
    name: {
      en: "Image Text Watermark",
      zh: "圖片文字浮水印"
    },
    path: "/image/text_watermark",
    category: "image",
    keywords: ["image", "watermark", "text watermark", "batch", "圖片", "浮水印", "文字浮水印"],
    summary: {
      zh: "加入文字浮水印，支援單張即時預覽與批量轉換。",
      en: "Add text watermarks with single live preview and one-click batch conversion."
    }
  },
  {
    name: {
      en: "Image Similarity Splitter",
      zh: "相似圖片整理"
    },
    path: "/image/image_similarity",
    category: "image",
    keywords: ["image", "similarity", "dhash", "find duplicates", "group", "相似", "重複", "整理"],
    summary: {
      zh: "純前端快速掃描並群組相似圖片，一鍵匯出腳本或壓縮檔。",
      en: "Find and group similar images in browser without uploads, export scripts or ZIP."
    }
  },
  {
    name: {
      en: "QR Code Generator",
      zh: "QR Code 產生器"
    },
    path: "/data/qr_generator",
    category: "data",
    keywords: ["qr", "qrcode", "generator", "條碼", "二維碼"],
    summary: {
      zh: "快速產生可下載的 QR Code。",
      en: "Generate downloadable QR codes quickly."
    }
  },
  {
    name: {
      en: "Unit Converter",
      zh: "單位換算系統"
    },
    path: "/utility/unit_converter",
    category: "convert",
    keywords: ["unit converter", "engineering", "finance", "health", "developer", "單位換算"],
    summary: {
      zh: "涵蓋網路、工程、金融、健康等多領域換算工具。",
      en: "Multi-domain converter suite for network, engineering, finance, health, and more."
    }
  },
  {
    name: {
      en: "Timezone Converter",
      zh: "時區轉換器"
    },
    path: "/utility/timezone_converter",
    category: "convert",
    keywords: ["timezone", "time zone", "utc", "offset", "時區", "轉換"],
    summary: {
      zh: "在不同時區間轉換日期時間。",
      en: "Convert datetimes across time zones."
    }
  },
  {
    name: {
      en: "Age Calculator",
      zh: "年齡計算器"
    },
    path: "/utility/age_calculator",
    category: "calc",
    keywords: ["age", "birthday", "date", "年齡", "生日", "計算"],
    summary: {
      zh: "計算年齡、總天數與下次生日。",
      en: "Calculate exact age and next birthday."
    }
  },
  {
    name: {
      en: "Base Converter",
      zh: "進制轉換"
    },
    path: "/convert/base_converter",
    category: "convert",
    keywords: ["base converter", "binary", "hex", "decimal", "radix", "進制", "二進制", "十六進制"],
    summary: {
      zh: "支援 2 到 36 進制整數互轉與常用進制對照。",
      en: "Convert integer values across base 2-36 with common base outputs."
    }
  },
  {
    name: {
      en: "Timestamp Converter",
      zh: "Unix 時間轉換"
    },
    path: "/convert/timestamp_converter",
    category: "convert",
    keywords: ["timestamp", "unix", "datetime", "時間戳", "轉換"],
    summary: {
      zh: "Unix 時間戳與日期時間雙向轉換。",
      en: "Convert between Unix timestamps and datetime."
    }
  }
];

export function normalizePath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const normalized = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return normalized || "/";
}

export function getToolByPath(pathname) {
  const normalized = normalizePath(pathname);
  return toolRegistry.find((tool) => tool.path === normalized) || null;
}

export function getRelatedTools(pathname, limit = 3) {
  const current = getToolByPath(pathname);
  if (!current) {
    return toolRegistry.slice(0, limit);
  }

  const sameCategory = toolRegistry.filter(
    (tool) => tool.path !== current.path && tool.category === current.category
  );

  const fallback = toolRegistry.filter(
    (tool) => tool.path !== current.path && tool.category !== current.category
  );

  return [...sameCategory, ...fallback].slice(0, limit);
}

export function getToolDisplayName(tool, lang = "en") {
  if (!tool?.name) {
    return "";
  }

  if (typeof tool.name === "string") {
    return tool.name;
  }

  return tool.name[lang] || tool.name.en || "";
}

export function getToolSummary(tool, lang = "en") {
  if (!tool?.summary) {
    return "";
  }

  if (typeof tool.summary === "string") {
    return tool.summary;
  }

  return tool.summary[lang] || tool.summary.en || "";
}





