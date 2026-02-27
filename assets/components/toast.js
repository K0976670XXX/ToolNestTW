let stack;

function getStack() {
  if (stack) {
    return stack;
  }

  stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.append(stack);
  return stack;
}

export function toast(message, type = "error", durationMs = 2600) {
  const container = getStack();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  container.append(el);

  window.setTimeout(() => {
    el.remove();
  }, durationMs);
}





