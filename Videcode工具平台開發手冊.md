# ToolNestTW Web Tools 平台開發手冊

版本：v1.0
架構類型：純前端工具平台（Static + Modular JS）
目標：建立高可擴充、高 SEO、低維護成本的工具站

---

# 1. 專案目標

ToolNestTW 是一個多工具集合平台，設計目標：

* 所有工具皆為**獨立頁面**
* 不依賴後端即可運作（初期）
* 可快速新增新工具
* SEO 友善
* 模組化架構

---

# 2. 技術棧

| 層級       | 技術                          |
| -------- | --------------------------- |
| Frontend | Vanilla JS / TypeScript（可選） |
| UI       | 原生 CSS / Tailwind（可選）       |
| 打包       | Vite（建議）                    |
| 部署       | Cloudflare Pages / Netlify  |
| 資料儲存     | localStorage                |

---

# 3. 專案目錄結構

```
/public
/assets
    /css
    /js
    /components
/tools
    /text
    /image
    /convert
    /dev
    /data
    /utility
index.html
sitemap.xml
robots.txt
```

---

# 4. URL 規範（強制）

所有工具必須符合：

```
/分類/工具名稱
```

範例：

```
/text/url_encode
/dev/uuid_generator
/image/compress
```

命名規則：

| 規則   | 說明          |
| ---- | ----------- |
| 小寫   | 避免 SEO 分裂   |
| 底線   | 不使用 dash    |
| 動詞在前 | encode_text |

---

# 5. 新工具開發流程（標準 SOP）

新增工具必須遵循以下流程：

---

## Step 1 — 建立頁面

```
/tools/text/url_encode.html
```

---

## Step 2 — 套用統一模板

所有頁面都必須使用標準 layout：

```
<header>
<h1>
工具 UI
結果區
FAQ
推薦工具
<footer>
```

---

## Step 3 — 引入共用元件

```html
<script type="module">
import initLayout from "/assets/components/layout.js"
initLayout()
</script>
```

---

## Step 4 — 實作核心邏輯

只允許寫在：

```
/assets/js/tools/
```

檔名規範：

```
url_encode.js
```

---

## Step 5 — 註冊工具 metadata

新增至：

```
/assets/js/tools.registry.js
```

格式：

```js
{
 name: "URL Encode",
 path: "/text/url_encode",
 category: "text",
 keywords: ["url", "encode", "decoder"]
}
```

---

# 6. 共用元件列表（必須使用）

| 元件          | 功能     |
| ----------- | ------ |
| layout.js   | 統一頁面框架 |
| toast.js    | 提示訊息   |
| copy.js     | 複製按鈕   |
| download.js | 下載功能   |
| drag.js     | 拖曳上傳   |
| theme.js    | 深色模式   |

---

# 7. UI 統一規範

所有工具頁必須一致：

### Input 區

* textarea 或 file upload
* placeholder 必須說明格式

### Action 區

* 主按鈕
* 清除按鈕
* 範例按鈕

### Output 區

* 結果顯示
* copy 按鈕

---

# 8. 性能規範

必須遵守：

* 單頁 JS < 100KB
* 不允許大型 library
* 不允許同步 blocking code

---

# 9. SEO 規範（強制）

每頁必須包含：

```
<title>
<meta description>
<meta keywords>
```

H 標籤規範：

```
H1 = 工具名稱
H2 = 使用方式
H2 = FAQ
```

---

# 10. 安全規範

禁止：

* eval()
* innerHTML 插入未處理字串
* 外部 script（未審核）

所有輸入必須：

```
escapeHTML()
```

---

# 11. localStorage 使用規範

允許用途：

* 最近輸入
* 最近使用工具
* 收藏工具

禁止用途：

* 敏感資料
* token
* 密碼

---

# 12. 工具分類定義

| 類別      | 說明   |
| ------- | ---- |
| text    | 文字處理 |
| image   | 圖片處理 |
| convert | 格式轉換 |
| dev     | 開發工具 |
| data    | 資料工具 |
| utility | 通用工具 |

---

# 13. 工具品質標準

新工具上線必須符合：

* 可複製結果
* 有範例
* 有錯誤提示
* 行動裝置可用

---

# 14. 錯誤處理標準

所有錯誤統一格式：

```
toast("Invalid input format")
```

不可使用：

```
alert()
```

---

# 15. 版本管理策略

Git commit 規範：

```
feat: add url encoder
fix: json formatter bug
style: ui update
refactor: optimize parser
```

---

# 16. 未來擴充預留

架構必須支援未來加入：

* WebAssembly 工具
* Worker thread 運算
* 後端 API 任務工具

---

# 17. MVP 工具清單（第一階段）

必做：

```
/text/json_formatter
/text/url_encode
/dev/uuid_generator
/dev/hash_generator
/image/resize
/image/compress
/data/qr_generator
```

---

# 18. 設計原則（核心哲學）

ToolNestTW 不追求：

> 工具數量多

ToolNestTW 追求：

> 每個工具都是該關鍵字最佳頁

---

# 19. 開發準則總結

開發任何新工具時，請先確認：

```
是否能純前端完成？
是否能單頁完成？
是否有搜尋需求？
是否可模組化？
```

只要有一項答案是否 → 不建議開發

---

# 最終結語（給工程團隊）

ToolNestTW 的成功關鍵不是技術複雜度，而是：

* 架構一致性
* 工具品質
* SEO 結構
* 擴充速度

請嚴格遵守本手冊規範。

---
