/** Use real existing DOM controls, including selects/ranges and nested details. */
export function navigateMenu(action, root) {
  if (!root) return false;
  const items = [
    ...root.querySelectorAll(
      'button,input,select,textarea,summary,[tabindex="0"]',
    ),
  ].filter(
    (el) =>
      !el.disabled &&
      !el.hidden &&
      el.getClientRects().length &&
      getComputedStyle(el).visibility !== "hidden",
  );
  if (!items.length) return false;
  let active = document.activeElement,
    index = items.indexOf(active);
  const focus = (el) => {
    document.querySelector(".gamepad-focus")?.classList.remove("gamepad-focus");
    el.classList.add("gamepad-focus");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  if (["up", "down"].includes(action)) {
    index =
      index < 0
        ? 0
        : (index + (action === "down" ? 1 : -1) + items.length) % items.length;
    focus(items[index]);
    return true;
  }
  if (index < 0) {
    focus(items[0]);
    active = items[0];
  }
  if (action === "confirm") {
    if (active instanceof HTMLSelectElement) {
      active.selectedIndex = (active.selectedIndex + 1) % active.options.length;
      active.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (active.tagName === "SUMMARY")
      active.parentElement.open = !active.parentElement.open;
    else if (active.matches("button,input[type=checkbox],input[type=radio]"))
      active.click();
    return true;
  }
  if (["left", "right"].includes(action)) {
    const direction = action === "right" ? 1 : -1;
    if (active instanceof HTMLInputElement && active.type === "range") {
      direction > 0 ? active.stepUp() : active.stepDown();
      active.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (active instanceof HTMLSelectElement) {
      active.selectedIndex =
        (active.selectedIndex + direction + active.options.length) %
        active.options.length;
      active.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (active.tagName === "SUMMARY")
      active.parentElement.open = direction > 0;
    else if (active.getAttribute("role") === "tab")
      active.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: direction > 0 ? "ArrowRight" : "ArrowLeft",
          bubbles: true,
        }),
      );
    return true;
  }
  return false;
}
