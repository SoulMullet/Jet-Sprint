/** Safari can rotate naturally; state is suspended, never restarted. */
export function mountOrientationPrompt(release) {
  const root = document.createElement("aside");
  root.id = "rotateDevice";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Rotate device to landscape");
  root.innerHTML =
    '<div class="rotate-card"><svg viewBox="0 0 100 80" aria-hidden="true"><rect x="22" y="7" width="40" height="64" rx="8" transform="rotate(-30 45 40)"/><path d="M76 13q20 23 1 49m-6-8 6 9 10-4"/></svg><h2>TURN FOR THE RIVER</h2><p>Rotate your device to landscape.<br>Your run is held safely while you turn.</p><button type="button">Try landscape / fullscreen</button></div>';
  document.body.append(root);
  const query = matchMedia(
    "(pointer:coarse) and (orientation:portrait) and (max-width:700px)",
  );
  let blocked = query.matches;
  const change = () => {
    blocked = query.matches;
    if (blocked) release();
  };
  query.addEventListener("change", change);
  root.querySelector("button").onclick = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.("landscape");
    } catch {
      /* iPhone Safari uses physical rotation. */
    }
  };
  return {
    get blocked() {
      return blocked;
    },
  };
}
