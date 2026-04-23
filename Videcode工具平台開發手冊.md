# ToolNestTW Web Tools 平台開發手冊

版本：v1.1  
更新日期：2026-04-24  
架構類型：純前端靜態工具站（Static + Modular JS）

---

# 1. 專案定位

這個專案是多工具集合平台，每個工具都必須能單獨開頁、單獨被搜尋、單獨被維護。

核心原則：

* 每個工具都是獨立頁面
* 主要邏輯全部在前端完成
* 不依賴後端 API 才能使用
* 共用版型與共用元件，降低維護成本
* 每個工具都要能直接被首頁搜尋、分類頁列出、推薦工具導流

---

# 2. 實際技術組成

| 層級 | 實作方式 |
| --- | --- |
| 頁面 | 靜態 HTML |
| 互動 | Vanilla JS ES Module |
| 樣式 | `assets/css/styles.css` |
| 共用框架 | `assets/components/layout.js` |
| 工具註冊 | `assets/js/tools.registry.js` |
| i18n | `assets/js/i18n.js` + `assets/js/page_i18n.js` |
| 本機儲存 | `localStorage` |
| 部署目標 | 靜態站（目前 sitemap 指向 `toolnesttw.pages.dev`） |

---

# 3. 目錄快速地圖

```
/assets
  /components   共用 UI / layout / copy / download / toast
  /css          全站樣式
  /js
    /tools      每個工具自己的前端邏輯
    category.js 分類頁渲染
    main.js     首頁渲染
    page_i18n.js 工具頁文案綁定
    tools.registry.js 全站工具清單

/text           文字工具實際頁面
/dev            開發工具實際頁面
/image          圖片工具實際頁面
/data           資料工具實際頁面
/convert        轉換工具實際頁面
/utility        其他工具實際頁面

/tools/...      舊網址轉址頁（meta refresh）

/index.html     首頁
/sitemap.xml    站點清單
/robots.txt     搜尋引擎規則
```

重點：

* 真正工具頁放在 `/分類/工具名/index.html`
* `/tools/.../*.html` 目前主要是舊路徑 redirect，不是新功能主入口

---

# 4. 新工具一定要改的地方

新增一個工具，最少會動到這些檔案：

1. 新增工具頁 HTML  
   位置：`/分類/工具名/index.html`

2. 新增工具邏輯 JS  
   位置：`/assets/js/tools/工具名.js`

3. 註冊到工具清單  
   位置：`/assets/js/tools.registry.js`

4. 新增舊路徑 redirect  
   位置：`/tools/分類/工具名.html`

通常也要一起更新：

* `sitemap.xml`
* 分類頁 meta description / keywords
* 本手冊

---

# 5. 工具頁標準結構

大多數工具頁都遵循這個結構：

1. `hero`
   顯示 H1 與一句 lead。

2. `panel` x N
   常見順序如下：

* 輸入
* 操作或設定
* 輸出
* 使用方式
* FAQ
* 推薦工具

3. 頁尾 script

```html
<script type="module">
  import initLayout from "/assets/components/layout.js?v=1.6.26";
  import initTool from "/assets/js/tools/your_tool.js?v=1.6.26";

  initLayout();
  initTool();
</script>
```

---

# 6. 共用模組怎麼用

常用元件：

| 檔案 | 用途 |
| --- | --- |
| `assets/components/layout.js` | Header / Footer / 推薦工具 / 最近使用 |
| `assets/components/toast.js` | 提示訊息 |
| `assets/components/copy.js` | 複製輸出 |
| `assets/components/download.js` | 下載 Blob 檔案 |
| `assets/js/page_i18n.js` | 工具頁 title / 文案 / placeholder 綁定 |
| `assets/js/utils.js` | `localStorage`、escapeHTML、檔案與格式工具 |

實務原則：

* 能重用就不要重寫
* 下載檔案優先走 `downloadBlob`
* 文案如果是工具頁固定文字，優先放進 `bindPageI18n`
* 只把少量設定存在 `localStorage`，不要存大型敏感內容

---

# 7. 工具註冊機制

全站所有首頁、分類頁、推薦工具，都依賴 `assets/js/tools.registry.js`。

單筆資料格式：

```js
{
  name: {
    en: "SRT Range Shift",
    zh: "SRT 區間平移器"
  },
  path: "/data/srt_range_shift",
  category: "data",
  keywords: ["srt", "subtitle", "shift"],
  summary: {
    zh: "擷取指定字幕區間，並依起始範圍自動平移時間軸。",
    en: "Filter subtitle cues by range and auto-shift timestamps from the selected start."
  }
}
```

注意：

* `path` 必須對應真實頁面路徑
* `category` 會決定分類頁歸屬與推薦工具優先順序
* `keywords` 直接影響站內搜尋命中

---

# 8. i18n 實作方式

目前專案是「全站共用字典 + 工具頁局部綁定」的混合做法。

使用原則：

* 全站共用文案放在 `assets/js/i18n.js`
* 單一工具自己的標題、段落、placeholder 放在該工具 JS 內，用 `bindPageI18n`
* 動態訊息（例如處理結果、狀態字串）在工具 JS 內自行用 `t()` 處理

---

# 9. UI 與互動規範

新工具至少要有：

* 明確輸入區
* 主操作按鈕
* 清除或重設方式
* 可讀輸出區
* 錯誤提示
* 行動裝置可用

建議：

* 文字型輸出用 monospace
* 結果區上方加狀態摘要
* 需要下載時，同時保留可複製輸出

---

# 10. 安全與實作限制

禁止：

* `eval()`
* 直接把未處理使用者輸入插進 `innerHTML`
* 依賴未審核第三方遠端 script

建議：

* 要插 HTML 時，先確定資料來源可控
* 純文字輸出優先用 `textContent` / `value`
* 所有檔案處理預設在瀏覽器本機完成

---

# 11. SEO 與靜態頁同步

新增工具後，除了頁面本身，通常要同步確認：

* 該工具頁的 `<title>`
* `<meta name="description">`
* `<meta name="keywords">`
* `sitemap.xml`
* 所屬分類頁的 description / keywords 是否需要補新工具關鍵字

---

# 12. 這次新增工具實例：SRT 區間平移器

這次新增的是資料工具類別的 `SRT 區間平移器`，目的是：

* 上傳或貼上 `.srt`
* 指定保留的時間區間
* 依起始範圍自動平移字幕時間
* 讓選定區間的起點自動對齊 `00:00:00,000`
* 重新編號輸出字幕
* 下載新的 `.srt`

本次落點：

* 頁面：`data/srt_range_shift/index.html`
* 邏輯：`assets/js/tools/srt_range_shift.js`
* redirect：`tools/data/srt_range_shift.html`
* 註冊：`assets/js/tools.registry.js`

這個工具很適合作為之後新增「檔案輸入 + 純前端轉換 + 下載輸出」類型功能的參考模板。

---

# 13. 新工具開發 SOP

實際操作時，建議照這個順序：

1. 先選分類與 URL path
2. 建立 `/分類/工具名/index.html`
3. 建立 `/assets/js/tools/工具名.js`
4. 用 `bindPageI18n` 補齊中英文文案
5. 註冊到 `tools.registry.js`
6. 新增 `/tools/...` redirect
7. 更新 sitemap 與相關 meta
8. 手動測一次首頁搜尋、分類頁、推薦工具、工具頁功能

---

# 14. 維護時優先檢查哪些地方

如果某個工具「頁面存在但站內找不到」，先檢查：

* `tools.registry.js` 有沒有註冊
* `category` 是否正確
* `path` 是否和實際目錄一致

如果某個工具「可開頁但推薦工具沒變」，先檢查：

* `layout.js`
* `tools.registry.js`
* 目前頁面 `path` 是否正常

如果某個工具「功能正常但搜尋抓不到」，先檢查：

* `keywords`
* 中英文名稱
* summary 是否太弱

---

# 15. 開發準則總結

開發任何新工具時，先問四件事：

* 能不能純前端完成？
* 能不能維持單頁體驗？
* 能不能重用現有 layout / registry / toast / copy / download？
* 上線後首頁、分類頁、推薦工具、sitemap 是否會一起更新？

這四件事都成立，再開始做。

---
