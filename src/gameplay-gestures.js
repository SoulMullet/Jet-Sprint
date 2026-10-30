/** Safari fallback belongs on gameplay elements, never the document or settings. */
export function protectGameplayGestures(surface) {
  const cancel = (event) => {
    if (event.cancelable) event.preventDefault();
  };
  const events = [
    "touchstart",
    "touchmove",
    "touchend",
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
