import { toast } from "/assets/components/toast.js?v=1.6.26";
import { getLanguage, onLanguageChange } from "/assets/js/i18n.js?v=1.6.26";
import { bindPageI18n } from "/assets/js/page_i18n.js?v=1.6.26";

const copy = {
    zh: {
        noInput: "<strong>拖曳圖片或資料夾到這裡（支援多重檔案）</strong>",
        noInputHint: "<p class=\"hint\">或手動選擇多張圖片。所有處理都在本地進行，保護您的隱私。</p>",
        noResult: "掃描結果將會顯示在這裡。",
        selected: "已選擇 {count} 張圖片",
        selectedHint: "點擊或拖曳加入更多圖片",
        extracting: "提取圖片特徵中：{current} / {total}",
        comparing: "特徵交叉比對中...",
        scanDone: "掃描完成！發現 {count} 組相似圖片。",
        noSimilar: "比對結束：沒有發現任何相似的圖片！",
        scriptDownloaded: "腳本已下載！請放入與圖片相同的資料夾執行。",
        zipCreating: "正在產生 ZIP 壓縮檔，請稍候...",
        zipDone: "ZIP 下載完成！",
        zipError: "打包 ZIP 時發生錯誤。",
        invalidFormat: "請上傳支援的圖片格式 (JPG, PNG, GIF, BMP, WEBP)。",
        scanError: "掃描時發生錯誤，請重試。",
        groupTitle: "群組 {index} ({count} 張圖片)",
        jszipError: "JSZip 函式庫加載失敗，請檢查網路連線。"
    },
    en: {
        noInput: "<strong>Drop images or folders here (multiple files supported)</strong>",
        noInputHint: "<p class=\"hint\">Or manually select images. All processing is local to protect your privacy.</p>",
        noResult: "Scan results will appear here.",
        selected: "{count} image(s) selected",
        selectedHint: "Click or drag to add more",
        extracting: "Extracting features: {current} / {total}",
        comparing: "Comparing features...",
        scanDone: "Scan complete! Found {count} similar group(s).",
        noSimilar: "No similar images found.",
        scriptDownloaded: "Script downloaded! Run it in the same directory as images.",
        zipCreating: "Generating ZIP archive, please wait...",
        zipDone: "ZIP format downloaded!",
        zipError: "Error generating ZIP.",
        invalidFormat: "Unsupported format. Use JPG, PNG, GIF, BMP, or WEBP.",
        scanError: "Scan error occurred, please try again.",
        groupTitle: "Group {index} ({count} image(s))",
        jszipError: "JSZip library failed to load, please check connection."
    }
};

function t(key, params = {}) {
    const lang = getLanguage();
    const template = copy[lang]?.[key] || copy.en[key] || key;
    return Object.entries(params).reduce((result, [name, value]) => {
        return result.replaceAll(`{${name}}`, String(value));
    }, template);
}

function initImageSimilarity() {
    const dropZone = document.getElementById("similarity-drop-zone");
    const fileInput = document.getElementById("similarity-file");
    const inputGallery = document.getElementById("similarity-input-gallery");
    const scanBtn = document.getElementById("similarity-scan-btn");
    const clearBtn = document.getElementById("similarity-clear-btn");
    const thresholdSlider = document.getElementById("similarity-threshold");
    const thresholdText = document.getElementById("similarity-threshold-text");
    const modeSelect = document.getElementById("similarity-mode");

    const progressContainer = document.getElementById("similarity-progress-container");
    const progressText = document.getElementById("similarity-progress-text");
    const progressBar = document.getElementById("similarity-progress-bar");

    const resultsContainer = document.getElementById("similarity-results-container");
    const downloadBatBtn = document.getElementById("similarity-download-bat-btn");
    const downloadZipBtn = document.getElementById("similarity-download-zip-btn");

    let files = [];
    let fileHashes = []; // Array of { file, name, hash, bitLength }
    let groups = [];     // Array of arrays containing similar file objects
    let isScanning = false;
    let inputObjectUrls = []; // Track URLs to prevent memory leaks

    const HASH_SIZE = 16;
    const EXTENSIONS = ["jpg", "jpeg", "png", "bmp", "webp", "gif"];

    bindPageI18n({
        title: {
            zh: "ToolNestTW 相似圖片整理",
            en: "ToolNestTW Image Similarity Splitter"
        },
        text: {
            ".hero h1": { zh: "相似圖片整理", en: "Image Similarity Splitter" },
            ".hero .lead": {
                zh: "純前端運算，在您的瀏覽器中尋找並分類相似的圖片，支援輸出分類腳本或打包下載。",
                en: "Find and group similar images entirely in-browser. Export sorting scripts or zip."
            },
            ".tool-page > .panel:nth-of-type(1) h2": { zh: "輸入", en: "Input" },
            ".tool-page > .panel:nth-of-type(2) h2": { zh: "操作設定", en: "Settings" },
            ".tool-page > .panel:nth-of-type(3) h2": { zh: "輸出結果", en: "Output" },
            ".tool-page > .panel:nth-of-type(4) h2": { zh: "使用方式", en: "How to use" },
            ".tool-page > .panel:nth-of-type(5) h2": { zh: "常見問題", en: "FAQ" },
            ".tool-page > .panel:nth-of-type(6) h2": { zh: "推薦工具", en: "Recommended tools" },
            'label[for="similarity-threshold"]': { zh: "相似度容差值 (0.01 - 0.50)", en: "Similarity Threshold (0.01 - 0.50)" },
            '#similarity-threshold-label-1': { zh: "目前容差: ", en: "Current Threshold: " },
            '#similarity-threshold-label-2': { zh: " (值越小要求越嚴格)", en: " (Smaller is stricter)" },
            'label[for="similarity-mode"]': { zh: "整理模式 (.bat 輸出)", en: "Sorting Mode (.bat Output)" },
            '#similarity-mode option[value="move"]': { zh: "移動到資料夾 (Move)", en: "Move to Folders (Move)" },
            '#similarity-mode option[value="name"]': { zh: "重新命名 (Rename)", en: "Rename with Prefix (Rename)" },
            "#similarity-scan-btn": { zh: "開始掃描", en: "Start Scan" },
            "#similarity-clear-btn": { zh: "清除", en: "Clear" },
            "#similarity-download-bat-btn": { zh: "下載整理腳本 (.bat)", en: "Download sorting script (.bat)" },
            "#similarity-download-zip-btn": { zh: "下載分類包 (.zip)", en: "Download categorized pack (.zip)" },
            ".tool-page > .panel:nth-of-type(4) p:nth-of-type(1)": {
                zh: "1. 上傳或拖曳多張圖片進入虛線框。",
                en: "1. Upload or drag multiple images into the dotted box."
            },
            ".tool-page > .panel:nth-of-type(4) p:nth-of-type(2)": {
                zh: "2. 調整「相似度容差值」，預設 0.3 能找出大部分視覺相近的圖片。",
                en: "2. Adjust 'Similarity Threshold', the default 0.3 finds visual matches accurately."
            },
            ".tool-page > .panel:nth-of-type(4) p:nth-of-type(3)": {
                zh: "3. 點擊「開始掃描」進行特徵交叉比對。",
                en: "3. Click 'Start Scan' to compute and cross-compare characteristic hashes."
            },
            ".tool-page > .panel:nth-of-type(4) p:nth-of-type(4)": {
                zh: "4. 掃描完成後，您可以預覽相似群組，並選擇下載 .bat 腳本（用於在本地快速移動或命名檔案），或直接下載分類好的 .zip 包。",
                en: "4. When complete, preview groups and download the .bat script (runs locally to sort) or the packed .zip."
            },
            ".tool-page > .panel:nth-of-type(4) div h3": { zh: ".bat 腳本使用教學", en: ".bat Script Tutorial" },
            ".tool-page > .panel:nth-of-type(4) div > p": {
                zh: "下載 .bat 腳本後，請將該檔案移動到您原始圖片所在的資料夾中，然後點擊執行即可。以下為兩種模式的執行示範：",
                en: "Once the .bat downloaded, drop it in the exact folder your original images reside in and double-click to execute. Demonstration:"
            },
            ".tool-page > .panel:nth-of-type(4) div h4:nth-of-type(1)": { zh: "移動模式 (Move)", en: "Move to Folder Mode" },
            ".tool-page > .panel:nth-of-type(4) div h4:nth-of-type(2)": { zh: "重新命名模式 (Rename)", en: "Prefix Rename Mode" },
            ".tool-page > .panel:nth-of-type(5) p:nth-of-type(1)": {
                zh: "圖片會上傳到伺服器嗎？ 不會。所有處理都會在您的瀏覽器中本地執行，過程既快速又安全。",
                en: "Are images uploaded? No. Everything processes directly within your browser instance locally, saving bandwidth and keeping it private."
            },
            ".tool-page > .panel:nth-of-type(5) p:nth-of-type(2)": {
                zh: ".bat 腳本怎麼用？ 下載後將它與原始圖片放在同一個資料夾，點擊執行即可自動為您分類/重新命名圖片檔案。",
                en: "How does the .bat script work? Drop it in the same directory as the images, double-click it, and it will execute the commands required to sort/rename locally."
            }
        }
    });

    // Update threshold text
    thresholdSlider.addEventListener("input", (e) => {
        thresholdText.textContent = e.target.value;
    });

    // Handle Drag & Drop
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add("drag-over");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove("drag-over");
        }, false);
    });

    dropZone.addEventListener("drop", (e) => {
        if (isScanning) return;
        const droppedFiles = e.dataTransfer.files;
        handleFiles(droppedFiles);
    });

    dropZone.addEventListener("click", () => {
        if (!isScanning) {
            fileInput.click();
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (isScanning) return;
        handleFiles(e.target.files);
        // Reset input to allow re-upload of same files if deleted
        fileInput.value = "";
    });

    function handleFiles(fileList) {
        const validFiles = Array.from(fileList).filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return EXTENSIONS.includes(ext) && !file.name.includes("相似圖片群組_");
        });

        if (validFiles.length === 0) {
            toast(t("invalidFormat"));
            return;
        }

        files = [...files, ...validFiles];
        updateUI();
    }

    function updateUI() {
        // Revoke old URLs to prevent memory leak
        inputObjectUrls.forEach(url => URL.revokeObjectURL(url));
        inputObjectUrls = [];

        if (files.length > 0) {
            scanBtn.disabled = false;
            dropZone.innerHTML = `<strong>${t("selected", { count: files.length })}</strong><p class="hint">${t("selectedHint")}</p>`;

            inputGallery.style.display = "flex";
            inputGallery.innerHTML = files.map(file => {
                const url = URL.createObjectURL(file);
                inputObjectUrls.push(url);
                return `
                    <div style="width: 80px; height: 80px; flex-shrink: 0; overflow: hidden; border-radius: 4px; border: 1px solid var(--border);">
                        <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" title="${file.name}"/>
                    </div>
                `;
            }).join('');
        } else {
            scanBtn.disabled = true;
            downloadBatBtn.disabled = true;
            downloadZipBtn.disabled = true;
            dropZone.innerHTML = t("noInput") + t("noInputHint");
            resultsContainer.innerHTML = `<p class="hint">${t("noResult")}</p>`;
            progressContainer.style.display = "none";
            inputGallery.style.display = "none";
            inputGallery.innerHTML = "";
        }
    }

    clearBtn.addEventListener("click", () => {
        if (isScanning) return;
        files = [];
        fileHashes = [];
        groups = [];
        updateUI();
    });

    scanBtn.addEventListener("click", async () => {
        if (files.length === 0 || isScanning) return;
        isScanning = true;
        scanBtn.disabled = true;
        clearBtn.disabled = true;
        downloadBatBtn.disabled = true;
        downloadZipBtn.disabled = true;

        progressContainer.style.display = "block";
        resultsContainer.innerHTML = "";

        try {
            await processSimilarImages();
        } catch (err) {
            console.error(err);
            toast(t("scanError"));
        } finally {
            isScanning = false;
            scanBtn.disabled = false;
            clearBtn.disabled = false;
            if (groups.length > 0) {
                downloadBatBtn.disabled = false;
                downloadZipBtn.disabled = false;
            }
        }
    });

    // =========== Core Logistics ===========

    async function processSimilarImages() {
        fileHashes = [];
        groups = [];

        // 1. Calculate hashes
        progressBar.max = files.length;
        for (let i = 0; i < files.length; i++) {
            progressText.textContent = t("extracting", { current: i + 1, total: files.length });
            progressBar.value = i + 1;

            try {
                const hash = await getDHash(files[i]);
                if (hash !== null) {
                    fileHashes.push({
                        file: files[i],
                        name: files[i].name,
                        hash: hash.value,
                        bitLength: hash.bitLength
                    });
                }
            } catch (err) {
                console.warn(`無法處理圖片 ${files[i].name}`, err);
            }
        }

        // 2. Compare hashes (O(N^2))
        progressText.textContent = t("comparing");
        progressBar.removeAttribute('value'); // indeterminate progress

        // Give UI a moment to update
        await new Promise(r => setTimeout(r, 100));

        const threshold = parseFloat(thresholdSlider.value);
        const maxDistance = (HASH_SIZE * HASH_SIZE) * threshold;
        const paths = fileHashes;
        const adj = Array.from({ length: paths.length }, () => []);

        for (let i = 0; i < paths.length; i++) {
            for (let j = i + 1; j < paths.length; j++) {
                const dist = getHammingDistance(paths[i].hash, paths[j].hash);
                if (dist <= maxDistance) {
                    adj[i].push(j);
                    adj[j].push(i);
                }
            }
        }

        // 3. BFS Grouping
        const visited = new Set();

        for (let i = 0; i < paths.length; i++) {
            if (!visited.has(i)) {
                const queue = [i];
                visited.add(i);
                const comp = [];

                while (queue.length > 0) {
                    const curr = queue.shift();
                    comp.push(curr);
                    for (const neighbor of adj[curr]) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }

                if (comp.length > 1) {
                    groups.push(comp.map(idx => paths[idx]));
                }
            }
        }

        // 4. Show results
        progressBar.value = progressBar.max;
        progressText.textContent = t("scanDone", { count: groups.length });

        if (groups.length === 0) {
            resultsContainer.innerHTML = `<p class="hint">${t("noSimilar")}</p>`;
        } else {
            renderGroups();
        }
    }

    // Gets dHash value using HTML5 Canvas
    function getDHash(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d", { willReadFrequently: true });

                // resize to (hash_size + 1) x hash_size
                canvas.width = HASH_SIZE + 1;
                canvas.height = HASH_SIZE;

                // Draw image on canvas (squashed)
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Get pixel data
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const pixels = [];

                // Convert to grayscale
                for (let i = 0; i < data.length; i += 4) {
                    // standard grayscale conversion: 0.299 R + 0.587 G + 0.114 B
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    pixels.push(gray);
                }

                const differences = [];
                for (let row = 0; row < HASH_SIZE; row++) {
                    for (let col = 0; col < HASH_SIZE; col++) {
                        const idx = row * (HASH_SIZE + 1) + col;
                        const pixelLeft = pixels[idx];
                        const pixelRight = pixels[idx + 1];
                        differences.push(pixelLeft > pixelRight);
                    }
                }

                // differences to string to simulate Bit operations across > 32bits limitation in JS
                // Javascript bitwise operations are capped at 32-bit signed integers.
                // Since Dhash size = 16x16 = 256 bits, we use a string representation of the bit sequence.
                const hashValue = differences.map(val => val ? '1' : '0').join('');

                URL.revokeObjectURL(url);
                resolve({ value: hashValue, bitLength: HASH_SIZE * HASH_SIZE });
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    // Hamming distance on string representations of bit vectors
    function getHammingDistance(hash1, hash2) {
        let distance = 0;
        const len = Math.min(hash1.length, hash2.length);
        for (let i = 0; i < len; i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }
        return distance;
    }

    // =========== Rendering ===========
    function renderGroups() {
        resultsContainer.innerHTML = groups.map((group, index) => {
            const thumbnailsHTML = group.map(item => {
                const objUrl = URL.createObjectURL(item.file);
                return `
                <div style="display:inline-block; margin: 4px; border: 1px solid var(--border); border-radius: 4px; padding: 4px; text-align: center; max-width: 120px;">
                    <img src="${objUrl}" style="max-height: 80px; max-width: 100px; object-fit: contain; display: block; margin: 0 auto;"/>
                    <div style="font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;" title="${item.name}">${item.name}</div>
                </div>
              `;
            }).join('');

            return `
            <div style="margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--border); border-radius: 8px;">
                <h3 style="margin-top: 0;">${t("groupTitle", { index: index + 1, count: group.length })}</h3>
                <div style="display: flex; flex-wrap: wrap;">${thumbnailsHTML}</div>
            </div>
          `;
        }).join('');
    }

    // =========== Exporters ===========

    downloadBatBtn.addEventListener("click", () => {
        const mode = modeSelect.value;
        const batLines = ["@echo off", "chcp 65001", "echo ========================================", "echo ToolNestTW 相似圖片整理自動腳本", "echo ========================================"];

        let groupCounter = 1;

        if (mode === "move") {
            groups.forEach(comp => {
                const folderName = `相似圖片群組_${groupCounter}`;
                batLines.push(`if not exist "${folderName}" mkdir "${folderName}"`);

                comp.forEach(item => {
                    batLines.push(`if exist "${item.name}" move /Y "${item.name}" "${folderName}\\${item.name}"`);
                });
                groupCounter++;
            });
        } else if (mode === "name") {
            groups.forEach(comp => {
                const prefix = `相似圖片${groupCounter.toString().padStart(2, '0')}_`;

                comp.forEach(item => {
                    batLines.push(`if exist "${item.name}" ren "${item.name}" "${prefix}${item.name}"`);
                });
                groupCounter++;
            });
        }

        batLines.push("pause");

        const blob = new Blob([batLines.join("\r\n")], { type: "text/plain;charset=utf-8" });
        const dlUrl = URL.createObjectURL(blob);
        const tempLink = document.createElement("a");
        tempLink.href = dlUrl;
        tempLink.download = "toolnest_image_sort.bat";
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(dlUrl);

        toast(t("scriptDownloaded"), "success");
    });

    downloadZipBtn.addEventListener("click", async () => {
        if (typeof JSZip === 'undefined') {
            toast(t("jszipError"));
            return;
        }

        const mode = modeSelect.value;
        toast(t("zipCreating"));
        downloadBatBtn.disabled = true;
        downloadZipBtn.disabled = true;

        try {
            const zip = new JSZip();
            let groupCounter = 1;
            const groupedFiles = new Set(); // Track files added to groups

            if (mode === "move") {
                groups.forEach(comp => {
                    const folder = zip.folder(`相似圖片群組_${groupCounter}`);
                    comp.forEach(item => {
                        folder.file(item.name, item.file);
                        groupedFiles.add(item.file);
                    });
                    groupCounter++;
                });
            } else if (mode === "name") {
                groups.forEach(comp => {
                    const prefix = `相似圖片${groupCounter.toString().padStart(2, '0')}_`;
                    comp.forEach(item => {
                        zip.file(`${prefix}${item.name}`, item.file);
                        groupedFiles.add(item.file);
                    });
                    groupCounter++;
                });
            }

            // 加入未分類的圖片到根目錄
            files.forEach(file => {
                if (!groupedFiles.has(file)) {
                    zip.file(file.name, file);
                }
            });

            const content = await zip.generateAsync({ type: "blob" });
            const dlUrl = URL.createObjectURL(content);
            const tempLink = document.createElement("a");
            tempLink.href = dlUrl;
            tempLink.download = "toolnest_similar_images.zip";
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            URL.revokeObjectURL(dlUrl);

            toast(t("zipDone"), "success");
        } catch (err) {
            console.error(err);
            toast(t("zipError"));
        } finally {
            downloadBatBtn.disabled = false;
            downloadZipBtn.disabled = false;
        }
    });

    // Bind dynamic HTML translations to re-renders if elements changed after load
    onLanguageChange(() => {
        if (files.length === 0) {
            dropZone.innerHTML = t("noInput") + t("noInputHint");
        } else {
            dropZone.innerHTML = `<strong>${t("selected", { count: files.length })}</strong><p class="hint">${t("selectedHint")}</p>`;
        }
        if (groups.length === 0 && !isScanning && files.length > 0) {
            // Just selected but not scanned
        } else if (groups.length === 0 && !isScanning) {
            resultsContainer.innerHTML = `<p class="hint">${t("noResult")}</p>`;
        } else if (groups.length > 0) {
            progressText.textContent = t("scanDone", { count: groups.length });
            renderGroups();
        } else if (groups.length === 0 && isScanning) {
            // In scan
        } else {
            resultsContainer.innerHTML = `<p class="hint">${t("noSimilar")}</p>`;
        }
    });
}

export default initImageSimilarity;
