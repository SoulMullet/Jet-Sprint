/** CSS touch-action owns touch/scroll/zoom; never cancel a whole touch sequence. */
export function protectGameplayGestures(surface) {
  const cancel = (event) => {
    if (event.cancelable) event.preventDefault();
  };
  const events = [
    "gesturestart",
    "gesturechange",
    "gestureend",
    "dblclick",
    "selectstart",
    "contextmenu",
    "dragstart",
  ];
  for (const type of events)
    surface.addEventListener(type, cancel, { passive: false });
  return () => {
    for (const type of events) surface.removeEventListener(type, cancel);
  };
}
