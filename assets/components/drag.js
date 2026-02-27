export function bindDragDrop({ dropZone, fileInput, onFiles }) {
  if (!dropZone || !fileInput || typeof onFiles !== "function") {
    return;
  }

  const prevent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, prevent);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    if (!event.dataTransfer?.files?.length) {
      return;
    }
    onFiles(event.dataTransfer.files);
  });

  fileInput.addEventListener("change", () => {
    if (!fileInput.files?.length) {
      return;
    }
    onFiles(fileInput.files);
  });
}





