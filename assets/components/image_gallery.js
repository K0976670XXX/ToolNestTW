export function createImageLightbox() {
  const root = document.createElement("div");
  root.className = "image-lightbox";
  root.hidden = true;

  const panel = document.createElement("div");
  panel.className = "image-lightbox-panel";
  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const head = document.createElement("div");
  head.className = "image-lightbox-head";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn image-lightbox-close";
  closeBtn.textContent = "Close";
  closeBtn.setAttribute("aria-label", "Close preview");

  const image = document.createElement("img");
  image.className = "image-lightbox-image";
  image.alt = "";

  const caption = document.createElement("p");
  caption.className = "image-lightbox-caption";

  head.append(closeBtn);
  panel.append(head, image, caption);
  root.append(panel);
  document.body.append(root);

  const close = () => {
    root.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    caption.textContent = "";
    document.body.style.removeProperty("overflow");
  };

  const open = ({ src, captionText }) => {
    image.src = src;
    image.alt = captionText || "";
    caption.textContent = captionText || "";
    root.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const onEsc = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  closeBtn.addEventListener("click", close);
  root.addEventListener("click", close);
  document.addEventListener("keydown", onEsc);

  const setCloseLabel = (value) => {
    if (!value) {
      return;
    }
    closeBtn.textContent = value;
    closeBtn.setAttribute("aria-label", value);
  };

  const destroy = () => {
    document.removeEventListener("keydown", onEsc);
    root.remove();
    document.body.style.removeProperty("overflow");
  };

  return { open, close, setCloseLabel, destroy };
}

export function renderThumbnailGrid({
  container,
  items,
  getSrc,
  getName,
  emptyText,
  onOpen
}) {
  if (!container) {
    return;
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "thumb-empty";
    empty.textContent = emptyText || "";
    container.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const src = getSrc(item, index);
    const name = getName(item, index);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb-item";
    button.setAttribute("aria-label", name);

    const image = document.createElement("img");
    image.src = src;
    image.alt = name;
    image.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = name;

    button.append(image, label);
    button.addEventListener("click", () => {
      onOpen({ src, captionText: name });
    });
    fragment.append(button);
  });

  container.replaceChildren(fragment);
}

