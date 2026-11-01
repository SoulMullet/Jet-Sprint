import { protectGameplayGestures } from "./gameplay-gestures.js";
import { NitrousGesture } from "./nitrous-gesture.js";
/** Steering pointer sets and one captured throttle thumb share the existing input pipeline. */
export function mountArcadeTouch({
  set,
  release,
  onPress,
  canDrive,
  getNitrous = () => ({ installed: false, fill: 0 }),
}) {
  const root = document.createElement("nav");
  root.id = "arcadeControls";
  root.setAttribute("aria-label", "Arcade boat controls");
  root.innerHTML =
    '<div class="arcade-steering"><button id="steerLeft" aria-label="Steer left" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 3 6 12 18 21Z" fill="currentColor"/></svg>LEFT</button><button id="steerRight" aria-label="Steer right" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3 18 12 6 21Z" fill="currentColor"/></svg>RIGHT</button></div><button id="arcadeThrottle" aria-label="Slide upward for throttle, continue upward for nitrous" aria-pressed="false"><span id="touchNitroZone"><b>NITRO</b><small id="touchNitroText">NO KIT</small><i id="touchNitroGauge"></i></span><span>JET</span><output id="touchThrottleValue">0%</output><small>SLIDE UP</small></button>';
  document.body.append(root);
  protectGameplayGestures(root);
  const held = { left: new Set(), right: new Set(), throttle: new Set() },
    gesture = new NitrousGesture();
  let throttlePointer = null;
  const paint = () => {
    for (const [name, id] of [
      ["left", "steerLeft"],
      ["right", "steerRight"],
      ["throttle", "arcadeThrottle"],
    ]) {
      const e = document.getElementById(id),
        down = held[name].size > 0;
      e.classList.toggle("active", down);
      e.setAttribute("aria-pressed", String(down));
    }
    document.getElementById("touchThrottleValue").textContent =
      Math.round(gesture.throttle * 100) + "%";
    set(
      Number(held.right.size > 0) - Number(held.left.size > 0),
      gesture.throttle,
      Object.values(held).some((s) => s.size),
      gesture.nitrous,
    );
  };
  const clear = () => {
    for (const s of Object.values(held)) s.clear();
    throttlePointer = null;
    gesture.clear();
    paint();
  };
  for (const [name, id] of [
    ["left", "steerLeft"],
    ["right", "steerRight"],
    ["throttle", "arcadeThrottle"],
  ]) {
    const el = document.getElementById(id);
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (
        !canDrive() ||
        (e.pointerType === "mouse" && e.button !== 0) ||
        (name === "throttle" && throttlePointer !== null)
      )
        return;
      held[name].add(e.pointerId);
      el.setPointerCapture(e.pointerId);
      if (name === "throttle") {
        throttlePointer = e.pointerId;
        gesture.move(e.clientY, el.getBoundingClientRect(), getNitrous());
      }
      onPress(name);
      paint();
    });
    el.addEventListener("pointermove", (e) => {
      if (name === "throttle" && e.pointerId === throttlePointer) {
        e.preventDefault();
        gesture.move(e.clientY, el.getBoundingClientRect(), getNitrous());
        paint();
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, (e) => {
        e.preventDefault();
        held[name].delete(e.pointerId);
        if (name === "throttle" && e.pointerId === throttlePointer) {
          throttlePointer = null;
          gesture.clear();
        }
        paint();
      });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => {
      if ([" ", "Enter"].includes(e.key) && canDrive()) {
        e.preventDefault();
        e.stopPropagation();
        held[name].add("key");
        if (name === "throttle") gesture.throttle = 1;
        paint();
      }
    });
    el.addEventListener("keyup", (e) => {
      if ([" ", "Enter"].includes(e.key)) {
        e.stopPropagation();
        held[name].delete("key");
        if (name === "throttle") gesture.clear();
        paint();
      }
    });
    el.addEventListener("blur", () => {
      held[name].delete("key");
      if (name === "throttle" && throttlePointer === null) gesture.clear();
      paint();
    });
  }
  window.addEventListener("blur", () => {
    clear();
    release();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clear();
      release();
    }
  });
  return { clear, root };
}
