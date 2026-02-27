import numpy as np
from PIL import Image
from tkinter import filedialog

# 浮水印資訊
LOGO_SIZE = [96,48]
MARGIN_RIGHT = [64,32]
MARGIN_BOTTOM = [64,32]

def remove_watermark(img, alpha, typ):
    x = W - MARGIN_RIGHT[typ] - LOGO_SIZE[typ]
    y = H - MARGIN_BOTTOM[typ] - LOGO_SIZE[typ]
    w = LOGO_SIZE[typ]
    h = LOGO_SIZE[typ]

    # 取出浮水印區塊
    wm = img[y:y+h, x:x+w, :]
    # 反向 Alpha
    wm_rec = (wm - alpha) / (1.0 - alpha/255.0)
    # 限制輸出在 [0, 255]
    wm = np.clip(np.round(wm_rec), 0, 255)
    # 寫回原圖
    img[y:y+h, x:x+w, :] = wm

    return img

if __name__ == "__main__":
    import sys, os
    os.chdir(sys.path[0])
    img_path = filedialog.askopenfilename(title="選擇圖片",filetypes=[("img files", "*.jpg *.png *.webp")]) # "input.png"
    out_path = img_path.split(".")[-2] + "_out.png"
    
    # 載入影像
    img = np.array(Image.open(img_path).convert("RGB"), dtype=np.float32)
    H, W, _ = img.shape
    typ = 0 if (W > 1024 and H > 1024) else 1
        
    # 載入已知浮水印 (透明度):
    bg_path = "bg_96.png" if typ==0 else "bg_48.png"
    alpha = np.array(Image.open(bg_path).convert("RGB"), dtype=np.float32)
    # 移除浮水印
    output = remove_watermark(img, alpha, typ)
    # 輸出
    result = Image.fromarray(np.uint8(output))
    result.save(out_path)
    

