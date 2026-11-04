import { protectGameplayGestures } from "./gameplay-gestures.js";
import { NitrousGesture } from "./nitrous-gesture.js";
import { ArcadePointers } from "./arcade-pointers.js";
/** Steering pointer sets and one captured throttle thumb share the existing input pipeline. */
export function mountArcadeTouch({
  set,
  release,
  onPress,
  canDrive,
  steering = true,
  getNitrous = () => ({ installed: false, fill: 0 }),
}) {
  const root = document.createElement("nav");
  root.id = "arcadeControls";
  root.setAttribute("aria-label", "Arcade boat controls");
  root.innerHTML =
    (steering
      ? '<div class="arcade-steering"><button id="steerLeft" aria-label="Steer left" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 3 6 12 18 21Z" fill="currentColor"/></svg>LEFT</button><button id="steerRight" aria-label="Steer right" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3 18 12 6 21Z" fill="currentColor"/></svg>RIGHT</button></div>'
      : "") +
    '<button id="arcadeThrottle" aria-label="Hold to accelerate; slide upward beyond the button for nitrous" aria-pressed="false"><span id="touchNitroZone"><b>NITRO</b><small id="touchNitroText">NO KIT</small><i id="touchNitroGauge"></i></span><span>THROTTLE</span><output id="touchThrottleValue">0%</output><small>HOLD TO GO</small></button>';
  document.body.append(root);
  const pointers = new ArcadePointers(),
    held = pointers.held,
    gesture = new NitrousGesture();
  let throttlePointer = null,
    throttleRect = null;
  const controls = steering
    ? [
        ["left", "steerLeft"],
        ["right", "steerRight"],
        ["throttle", "arcadeThrottle"],
      ]
    : [["throttle", "arcadeThrottle"]];
  const endPointer = {};
  const paint = () => {
    for (const [name, id] of controls) {
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
    const captures = [...pointers.owners];
    pointers.clear();
    throttlePointer = null;
    throttleRect = null;
    gesture.clear();
    for (const [id, name] of captures) {
      if (typeof id !== "number") continue;
      const el = document.getElementById(
        name === "throttle"
          ? "arcadeThrottle"
          : name === "left"
            ? "steerLeft"
            : "steerRight",
      );
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }
    paint();
  };
  for (const [name, id] of controls) {
    const el = document.getElementById(id);
    protectGameplayGestures(el);
    const end = (e) => {
      if (!pointers.release(name, e.pointerId)) return;
      if (name === "throttle" && e.pointerId === throttlePointer) {
        throttlePointer = null;
        throttleRect = null;
        gesture.clear();
      }
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
      paint();
    };
    endPointer[name] = end;
    el.addEventListener("pointerdown", (e) => {
      if (
        !canDrive() ||
        (e.pointerType === "mouse" && e.button !== 0) ||
        !pointers.press(name, e.pointerId)
      )
        return;
      // CSS owns browser gestures. Do not cancel the legacy touch sequence:
      // WebKit must deliver secondary fingers to their own controls.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        pointers.release(name, e.pointerId);
        return;
      }
      if (name === "throttle") {
        throttlePointer = e.pointerId;
        // Freeze geometry before the pressed-state transform, for this finger.
        throttleRect = el.getBoundingClientRect();
        gesture.move(e.clientY, throttleRect, getNitrous());
        gesture.throttle = 1;
      }
      onPress(name);
      paint();
    });
    el.addEventListener("pointermove", (e) => {
      if (!pointers.owns(name, e.pointerId)) return;
      // Capture can be interrupted before the browser delivers its first
      // gotpointercapture event. That pending-capture loss may emit no lost event.
      if (
        !el.hasPointerCapture(e.pointerId) ||
        (e.pointerType === "mouse" && e.buttons === 0)
      ) {
        end(e);
        return;
      }
      if (name === "throttle" && e.pointerId === throttlePointer) {
        gesture.move(e.clientY, throttleRect, getNitrous());
        gesture.throttle = 1;
        paint();
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, end);
    el.addEventListener("pointerleave", (e) => {
      // Captured drags deliberately continue outside the throttle/NITRO bounds.
      // If capture was interrupted, release only that control, not its neighbour.
      if (!el.hasPointerCapture(e.pointerId)) end(e);
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => {
      // Space + Shift stays one keyboard source even when this button has focus.
      if (name === "throttle" && e.key === " ") return;
      if ([" ", "Enter"].includes(e.key) && canDrive()) {
        e.preventDefault();
        e.stopPropagation();
        if (!pointers.press(name, "key-" + name)) return;
        if (name === "throttle") gesture.throttle = 1;
        paint();
      }
    });
    el.addEventListener("keyup", (e) => {
      if (name === "throttle" && e.key === " ") return;
      if ([" ", "Enter"].includes(e.key)) {
        e.stopPropagation();
        if (!pointers.release(name, "key-" + name)) return;
        if (name === "throttle") gesture.clear();
        paint();
      }
    });
    el.addEventListener("blur", () => {
      pointers.release(name, "key-" + name);
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
  return {
    clear,
    root,
    update() {
      // Pending capture loss can emit no lost event until the finger moves again.
      for (const [id, name] of pointers.owners) {
        if (typeof id !== "number") continue;
        const el = document.getElementById(
          name === "throttle"
            ? "arcadeThrottle"
            : name === "left"
              ? "steerLeft"
              : "steerRight",
        );
        if (!el.hasPointerCapture(id)) endPointer[name]({ pointerId: id });
      }
    },
  };
}
