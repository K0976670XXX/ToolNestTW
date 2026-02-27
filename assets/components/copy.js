import { toast } from "/assets/components/toast.js?v=1.6.26";

async function fallbackCopy(text) {
  const proxy = document.createElement("textarea");
  proxy.value = text;
  proxy.style.position = "fixed";
  proxy.style.opacity = "0";
  document.body.append(proxy);
  proxy.select();
  document.execCommand("copy");
  proxy.remove();
}

export function bindCopyButton(button, getText) {
  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    const text = String(typeof getText === "function" ? getText() : getText || "");
    if (!text.trim()) {
      toast("Invalid input format");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await fallbackCopy(text);
      }
      toast("Copied to clipboard.", "success");
    } catch {
      toast("Invalid input format");
    }
  });
}









