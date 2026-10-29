// Shared names for CSS and canvas. Main waits before baking text into textures.
export const displayFont =
  '"Racing Sans One", Impact, "Arial Black", sans-serif';
export const interfaceFont = 'Rajdhani, "Arial Narrow", system-ui, sans-serif';
let loading;

export async function loadGameFonts(fonts = globalThis.document?.fonts) {
  if (!fonts) return false;
  loading ??= Promise.all([
    fonts.load('400 48px "Racing Sans One"', "JET SPRINT"),
    fonts.load("600 18px Rajdhani", "0123456789 SETUP"),
    fonts.load("700 24px Rajdhani", "0123456789 RACE"),
  ])
    .then((groups) =>
      groups.every(
        (group) =>
          group.length > 0 && group.every((face) => face.status === "loaded"),
      ),
    )
    .catch(() => false);
  let timer;
  const ready = await Promise.race([
    loading,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 4000);
    }),
  ]);
  clearTimeout(timer);
  const root = globalThis.document?.documentElement;
  if (root) root.dataset.fonts = ready ? "ready" : "fallback";
  // A slow font may finish after the bounded startup wait; update the status then.
  loading.then((ok) => {
    if (root) root.dataset.fonts = ok ? "ready" : "fallback";
  });
  return ready;
}

export function repaintAfterFonts(draw) {
  // Repaint baked canvas text if a slow local font arrives after the startup limit.
  loading?.then((ok) => {
    if (ok) draw();
  });
}

// Rajdhani has proportional numerals and no tnum table. Fixed-width glyph cells
// keep live instruments steady while still rendering the requested real font.
const digitCache = new WeakMap();
export function setInstrumentText(node, value) {
  const text = String(value);
  let state = digitCache.get(node);
  if (state?.text === text) return;
  if (!state || state.cells.length !== text.length) {
    const cells = [...text].map((char) => {
      const span = document.createElement("span");
      span.className = /[0-9]/.test(char)
        ? "instrument-digit"
        : "instrument-separator";
      span.textContent = char;
      return span;
    });
    node.replaceChildren(...cells);
    state = { cells, text };
    digitCache.set(node, state);
  } else {
    for (let i = 0; i < text.length; i++)
      if (state.text[i] !== text[i]) {
        state.cells[i].className = /[0-9]/.test(text[i])
          ? "instrument-digit"
          : "instrument-separator";
        state.cells[i].textContent = text[i];
      }
    state.text = text;
  }
}
