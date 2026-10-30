/** Pointer sets permit two thumbs and multiple contacts without latching. */
export function mountArcadeTouch({ set, release, onPress, canDrive }) {
  const root = document.createElement("nav");
  root.id = "arcadeControls";
  root.setAttribute("aria-label", "Arcade boat controls");
  root.innerHTML =
    '<div class="arcade-steering"><button id="steerLeft" aria-label="Steer left" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 3 6 12 18 21Z" fill="currentColor"/></svg>LEFT</button><button id="steerRight" aria-label="Steer right" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3 18 12 6 21Z" fill="currentColor"/></svg>RIGHT</button></div><button id="arcadeThrottle" aria-label="Hold throttle" aria-pressed="false"><span>JET</span>THROTTLE</button>';
  document.body.append(root);
  const held = { left: new Set(), right: new Set(), throttle: new Set() };
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
    set(
      Number(held.right.size > 0) - Number(held.left.size > 0),
      Number(held.throttle.size > 0),
      Object.values(held).some((s) => s.size),
    );
  };
  const clear = () => {
    for (const s of Object.values(held)) s.clear();
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
      if (!canDrive() || (e.pointerType === "mouse" && e.button !== 0)) return;
      held[name].add(e.pointerId);
      el.setPointerCapture(e.pointerId);
      onPress(name);
      paint();
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, (e) => {
        e.preventDefault();
        held[name].delete(e.pointerId);
        paint();
      });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => {
      if ([" ", "Enter"].includes(e.key) && canDrive()) {
        e.preventDefault();
        e.stopPropagation();
        held[name].add("key");
        paint();
      }
    });
    el.addEventListener("keyup", (e) => {
      if ([" ", "Enter"].includes(e.key)) {
        e.stopPropagation();
        held[name].delete("key");
        paint();
      }
    });
    el.addEventListener("blur", () => {
      held[name].delete("key");
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
