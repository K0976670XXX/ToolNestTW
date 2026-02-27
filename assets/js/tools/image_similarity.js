import { toast } from "/assets/components/toast.js?v=1.6.26";

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
            toast("請上傳支援的圖片格式 (JPG, PNG, GIF, BMP, WEBP)。");
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
            dropZone.innerHTML = `<strong>已選擇 ${files.length} 張圖片</strong><p class="hint">點擊或拖曳加入更多圖片</p>`;

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
            dropZone.innerHTML = `<strong>拖曳圖片或資料夾到這裡（支援多重檔案）</strong><p class="hint">或手動選擇多張圖片。所有處理都在本地進行，保護您的隱私。</p>`;
            resultsContainer.innerHTML = `<p class="hint">掃描結果將會顯示在這裡。</p>`;
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
            toast("掃描時發生錯誤，請重試。");
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
            progressText.textContent = `提取圖片特徵中：${i + 1} / ${files.length}`;
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
        progressText.textContent = `特徵交叉比對中...`;
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
        progressText.textContent = `掃描完成！發現 ${groups.length} 組相似圖片。`;

        if (groups.length === 0) {
            resultsContainer.innerHTML = `<p class="hint">比對結束：沒有發現任何相似的圖片！</p>`;
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
                <h3 style="margin-top: 0;">群組 ${index + 1} (${group.length} 張圖片)</h3>
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

        toast("腳本已下載！請放入與圖片相同的資料夾執行。");
    });

    downloadZipBtn.addEventListener("click", async () => {
        if (typeof JSZip === 'undefined') {
            toast("JSZip 函式庫加載失敗，請檢查網路連線。");
            return;
        }

        const mode = modeSelect.value;
        toast("正在產生 ZIP 壓縮檔，請稍候...");
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

            toast("ZIP 下載完成！");
        } catch (err) {
            console.error(err);
            toast("打包 ZIP 時發生錯誤。");
        } finally {
            downloadBatBtn.disabled = false;
            downloadZipBtn.disabled = false;
        }
    });
}

export default initImageSimilarity;
