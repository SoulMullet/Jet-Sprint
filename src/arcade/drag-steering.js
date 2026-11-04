/** Relative CSS-pixel input only. Hull forces and the independently held throttle stay elsewhere. */
export class RelativeDragSteering {
  constructor(values) {
    this.values = values;
    this.reset();
  }
  reset() {
    this.pointer = null;
    this.origin =
      this.target =
      this.value =
      this.returnFrom =
      this.returnTime =
        0;
    this.intent = false;
  }
  down(id, x) {
    if (this.pointer !== null || !Number.isFinite(x)) return false;
    this.pointer = id;
    this.origin = x;
    this.target = this.value = this.returnTime = 0;
    this.intent = true;
    return true;
  }
  move(id, x) {
    if (this.pointer !== id || !Number.isFinite(x)) return false;
    const dx = x - this.origin,
      dead = this.values.arcadeDragDeadzone,
      full = Math.max(dead + 1, this.values.arcadeDragDistance);
    const magnitude = Math.min(
      1,
      Math.max(0, (Math.abs(dx) - dead) / (full - dead)),
    );
    this.target = magnitude > 0 ? Math.sign(dx) * magnitude : 0;
    this.intent = true;
    return true;
  }
  end(id, cancel = false) {
    if (this.pointer !== id) return false;
    this.pointer = null;
    this.target = 0;
    this.returnFrom = this.value;
    this.returnTime = 0;
    if (cancel) this.value = this.returnFrom = 0;
    return true;
  }
  update(dt) {
    if (this.pointer === null) {
      this.returnTime += Math.max(0, dt);
      this.value =
        this.returnFrom *
        Math.max(0, 1 - this.returnTime / this.values.arcadeDragReturn);
    } else {
      const seconds = this.values.arcadeDragSmoothing;
      this.value +=
        (this.target - this.value) *
        (seconds > 0 ? -Math.expm1(-Math.max(0, dt) / seconds) : 1);
      if (Math.abs(this.value - this.target) < 0.00001)
        this.value = this.target;
    }
    return this.value;
  }
}

/** Capture only the unobstructed game canvas; menu/lab pointers never enter here. */
export function mountRiverDrag({
  surface,
  store,
  canDrive,
  onPress,
  onInterrupt,
  debugLabel = "",
}) {
  const state = new RelativeDragSteering(store.values);
  const clear = () => {
    const id = state.pointer;
    state.reset();
    if (id !== null && surface.hasPointerCapture(id))
      surface.releasePointerCapture(id);
  };
  surface.addEventListener("pointerdown", (e) => {
    if (
      !canDrive() ||
      (e.pointerType === "mouse" && e.button !== 0) ||
      !state.down(e.pointerId, e.clientX)
    )
      return;
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      state.reset();
      return;
    }
    onPress("steering");
  });
  surface.addEventListener("pointermove", (e) => {
    if (state.pointer !== e.pointerId) return;
    if (
      !canDrive() ||
      !surface.hasPointerCapture(e.pointerId) ||
      (e.pointerType === "mouse" && e.buttons === 0)
    ) {
      clear();
      return;
    }
    state.move(e.pointerId, e.clientX);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    surface.addEventListener(type, (e) => {
      if (!state.end(e.pointerId, type !== "pointerup")) return;
      if (surface.hasPointerCapture(e.pointerId))
        surface.releasePointerCapture(e.pointerId);
    });
  }
  surface.addEventListener("pointerleave", (e) => {
    if (
      state.pointer === e.pointerId &&
      !surface.hasPointerCapture(e.pointerId)
    )
      clear();
  });
  window.addEventListener("blur", onInterrupt);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) onInterrupt();
  });
  // Imports can replace the values object; no stale tuning snapshot.
  store.subscribe(() => {
    state.values = store.values;
  });
  let indicator = null;
  if (debugLabel) {
    indicator = document.createElement("output");
    indicator.id = "arcadeSteeringDebug";
    indicator.setAttribute(
      "aria-label",
      "Developer live boat steering command",
    );
    document.body.append(indicator);
  }
  return {
    state,
    clear,
    update(dt) {
      // Browsers can defer lostpointercapture until the next pointer event.
      // Poll ownership too so an interrupted stationary finger cannot latch.
      if (state.pointer !== null && !surface.hasPointerCapture(state.pointer))
        clear();
      return state.update(dt);
    },
    paint(command) {
      if (indicator)
        indicator.textContent = `${debugLabel} / STEER ${command.toFixed(3)} / DRAG ${state.target.toFixed(3)}`;
    },
  };
}
