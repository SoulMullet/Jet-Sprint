/** Small DOM components; native controls retain keyboard and Safari semantics. */
export function rangeFraction(input) {
  const min = Number(input.min || 0),
    max = Number(input.max || 100);
  return max > min
    ? Math.max(0, Math.min(1, (Number(input.value) - min) / (max - min)))
    : 0;
}

export function instrumentRange(input, { defaultValue, reset, name } = {}) {
  if (input.dataset.instrumented) return;
  input.dataset.instrumented = "true";
  const label = input.closest("label");
  if (!label) return;
  label.htmlFor = input.id;
  label.classList.add("control-range");
  const caption = document.createElement("span");
  caption.className = "control-label";
  for (const node of [...label.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) caption.append(node);
  }
  label.prepend(caption);
  const title =
    name ||
    caption.textContent.trim() ||
    input.getAttribute("aria-label") ||
    "Parameter";
  input.setAttribute("aria-label", title);
  const output = label.querySelector("output");
  if (output) output.htmlFor = input.id;
  if (defaultValue !== undefined) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "range-reset";
    button.dataset.resetFor = input.id;
    button.dataset.tooltip = `Reset ${title} to ${defaultValue}`;
    button.setAttribute("aria-label", `Reset ${title} to default`);
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/></svg>';
    button.disabled = input.disabled;
    button.onclick = (event) => {
      event.preventDefault();
      reset();
      updateRange(input);
    };
    label.append(button);
  }
  updateRange(input);
}

export function updateRange(input) {
  input.style.setProperty("--fill", `${rangeFraction(input) * 100}%`);
  const reset = input.closest("label")?.querySelector(".range-reset");
  if (reset && reset.disabled !== input.disabled)
    reset.disabled = input.disabled;
}

/** The same confirmation component is used for destructive preset operations. */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "ui-dialog";
    dialog.setAttribute("aria-labelledby", "confirmationTitle");
    dialog.setAttribute("aria-describedby", "confirmationMessage");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "PIT CONTROL / CONFIRM";
    const title = document.createElement("h2");
    title.id = "confirmationTitle";
    title.textContent = "CHANGE SETUP?";
    const text = document.createElement("p");
    text.id = "confirmationMessage";
    text.textContent = message;
    const actions = document.createElement("div");
    actions.className = "dialog-actions";
    let done = false;
    const finish = (accepted) => {
      if (done) return;
      done = true;
      dialog.remove();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
      resolve(accepted);
    };
    for (const [label, accepted] of [
      ["Cancel", false],
      ["Confirm", true],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.confirm = String(accepted);
      if (accepted) button.className = "button-primary";
      button.onclick = () => finish(accepted);
      actions.append(button);
    }
    dialog.append(eyebrow, title, text, actions);
    document.body.append(dialog);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    if (dialog.showModal) dialog.showModal();
    else {
      dialog.setAttribute("open", "");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
    }
    trapFocus(dialog);
    actions.firstElementChild.focus();
  });
}

export function trapFocus(root) {
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [
      ...root.querySelectorAll(
        'button,input,select,textarea,summary,[tabindex="0"]',
      ),
    ].filter((el) => !el.disabled && el.getClientRects().length);
    const first = items[0],
      last = items.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

export function mountTooltips() {
  const tooltip = document.createElement("div");
  tooltip.id = "instrumentTooltip";
  tooltip.className = "ui-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  let target;
  const hide = () => {
    tooltip.hidden = true;
    target?.removeAttribute("aria-describedby");
    target = null;
  };
  const show = (element) => {
    hide();
    target = element;
    target.setAttribute("aria-describedby", tooltip.id);
    tooltip.textContent = target.dataset.tooltip;
    tooltip.hidden = false;
    const rect = target.getBoundingClientRect(),
      box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, rect.right - box.width))}px`;
    tooltip.style.top = `${Math.max(8, rect.top - box.height - 8)}px`;
  };
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (el) show(el);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest("[data-tooltip]");
    if (el) show(el);
  });
  document.addEventListener("pointerout", hide);
  document.addEventListener("pointerdown", hide);
  document.addEventListener("scroll", hide, true);
  window.addEventListener("blur", hide);
}
