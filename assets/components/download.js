import { toast } from "/assets/components/toast.js?v=1.6.26";

export function downloadBlob(blob, filename) {
  if (!blob) {
    toast("Invalid input format");
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}









