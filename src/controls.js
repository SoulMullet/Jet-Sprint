import { ControlInput, clamp, returnInput } from "./control-input.js";
import { mountArcadeTouch } from "./arcade-touch.js";
import { GamepadSource } from "./control-gamepad.js";

const keyMap = {
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  ArrowUp: "throttle",
  w: "throttle",
  " ": "throttle",
};
export const editingInput = (target) =>
  !!target?.closest?.(
    "input,select,textarea,[contenteditable=true],#pitConsole,.ui-dialog,#results,#pauseMenu,[role=slider]",
  );

/** DOM device adapters feed one normalized, input-only processor. */
export function bindControls(
  elements,
  store,
  {
    arcade = false,
    onPress = () => {},
    onAction = () => {},
    canDrive = () => true,
    getGamepads = () => navigator.getGamepads?.() ?? [],
  } = {},
) {
  const pipeline = new ControlInput(store),
    input = pipeline.input;
  const preview = new ControlInput(store);
  const entries = Object.entries(elements),
    axes = ["steering", "throttle"],
    painted = { steering: NaN, throttle: NaN };
  const outputs = Object.fromEntries(
    entries.map(([name, el]) => [name, el.querySelector("output")]),
  );
  const touch = { steering: 0, throttle: 0 },
    pointers = { steering: null, throttle: null },
    released = { steering: 0, throttle: 0 };
  const keys = { left: new Set(), right: new Set(), throttle: new Set() };
  let touchIntent = false,
    enabled = false,
    clock = 0,
    lastHaptic = -1,
    lastPaint = 0,
    layoutKey = "",
    lastPadThrottle = 0,
    mappingKey = [
      store.values.padMapping,
      store.values.padRightAxis,
      store.values.padTriggerRest,
    ].join("/");
  let buttons = null;
  pipeline.arcadeTouch = arcade;
  let monitoring = false;
  const gamepad = new GamepadSource(store, {
    onAction,
    onLost: () => release(),
  });
  function pulse() {
    if (!store.values.haptics || clock - lastHaptic < 0.1) return;
    lastHaptic = clock;
    if (pipeline.active === "gamepad") gamepad.haptic();
    else
      try {
        navigator.vibrate?.(8);
      } catch {
        /* Safari has no vibration API. */
      }
  }
  function release() {
    buttons?.clear();
    for (const name of Object.keys(pointers)) {
      const id = pointers[name];
      pointers[name] = null;
      touch[name] = 0;
      released[name] = 0;
      if (typeof id === "number")
        try {
          elements[name].releasePointerCapture(id);
        } catch {
          /* A cancelled pointer may already be released. */
        }
      elements[name].classList.remove("active");
    }
    for (const held of Object.values(keys)) held.clear();
    pipeline.release();
    preview.release();
    monitoring = false;
    gamepad.release();
    touchIntent = false;
    lastPadThrottle = 0;
    paint();
  }
  function setKey(name, key, down) {
    const wasHeld = keys[name].size > 0;
    down ? keys[name].add(key) : keys[name].delete(key);
    pipeline.set(
      "keyboard",
      Number(keys.right.size > 0) - Number(keys.left.size > 0),
      Number(keys.throttle.size > 0),
      Object.values(keys).some((s) => s.size > 0),
      down && !wasHeld,
    );
    if (down && !wasHeld) onPress(name);
  }
  function setTouch(name, value) {
    touch[name] = value;
    touchIntent = true;
  }
  for (const [name, el] of entries) {
    const rail = el.querySelector(".analog-rail");
    const position = (e) => {
      const rect = rail.getBoundingClientRect();
      setTouch(
        name,
        name === "steering"
          ? clamp(
              ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
              -1,
              1,
            )
          : clamp((rect.bottom - e.clientY) / Math.max(1, rect.height)),
      );
      paint();
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      if (!canDrive() || pointers[name] !== null) return;
      pointers[name] = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.classList.add("active");
      position(e);
      // A fresh press stays an edge even when a spring/hold leaves residual throttle.
      onPress(name);
      pulse();
    });
    el.addEventListener("pointermove", (e) => {
      if (pointers[name] === e.pointerId) {
        e.preventDefault();
        position(e);
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(type, (e) => {
        if (pointers[name] !== e.pointerId) return;
        e.preventDefault();
        pointers[name] = null;
        released[name] = 0;
        el.classList.remove("active");
        // Cancellation is a safety stop, never a request to latch a held axis.
        if (type !== "pointerup") {
          touch[name] = 0;
          pipeline.input[name] = 0;
        }
        if (el.hasPointerCapture?.(e.pointerId))
          el.releasePointerCapture(e.pointerId);
        paint();
      });
    el.addEventListener("keydown", (e) => {
      if (!canDrive()) return;
      let value = touch[name];
      if (["ArrowLeft", "ArrowDown"].includes(e.key)) value -= 0.05;
      else if (["ArrowRight", "ArrowUp"].includes(e.key)) value += 0.05;
      else if (e.key === "Home") value = name === "steering" ? -1 : 0;
      else if (e.key === "End") value = 1;
      else return;
      e.preventDefault();
      e.stopPropagation();
      if (pointers[name] === null) onPress(name);
      pointers[name] = "keyboard";
      setTouch(name, clamp(value, name === "steering" ? -1 : 0, 1));
      paint();
    });
    el.addEventListener("keyup", () => {
      if (pointers[name] === "keyboard") {
        pointers[name] = null;
        released[name] = 0;
      }
    });
    el.addEventListener("blur", () => {
      if (pointers[name] === "keyboard") {
        pointers[name] = null;
        touch[name] = 0;
      }
    });
  }
  window.addEventListener("keydown", (e) => {
    if (editingInput(e.target) || !canDrive()) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keyMap[key]) {
      e.preventDefault();
      if (!e.repeat || keys[keyMap[key]].has(key))
        setKey(keyMap[key], key, true);
    }
  });
  window.addEventListener("keyup", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keyMap[key]) setKey(keyMap[key], key, false);
  });
  window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === gamepad.index) release();
  });
  function layout() {
    if (arcade) return;
    const v = store.values,
      root = elements.steering.parentElement,
      css = getComputedStyle(root);
    const left = Math.max(12, parseFloat(css.paddingLeft) || 0),
      right = Math.max(12, parseFloat(css.paddingRight) || 0),
      bottom = Math.max(24, (parseFloat(css.paddingBottom) || 0) + 8),
      top = Math.max(110, (parseFloat(css.paddingTop) || 0) + 100);
    const w = innerWidth,
      h = innerHeight,
      tw = Math.min(v.throttleWidth, w * 0.27),
      th = Math.min(v.throttleHeight, Math.max(100, h * 0.25)),
      sw = Math.min(v.steerWidth, w - left - right - tw - 14),
      sh = Math.min(v.steerHeight, Math.max(64, h * 0.23));
    let sx = left + ((w - left - right - sw) * v.steerX) / 100;
    const sy = top + (Math.max(0, h - bottom - sh - top) * v.steerY) / 100;
    let tx = left + ((w - left - right - tw) * v.throttleX) / 100,
      ty = top + (Math.max(0, h - bottom - th - top) * v.throttleY) / 100;
    // Keep two independent hit regions available even with conflicting saved placements.
    if (
      sx < tx + tw + 12 &&
      sx + sw + 12 > tx &&
      sy < ty + th + 12 &&
      sy + sh + 12 > ty
    ) {
      if (sx - tw - 12 >= left) tx = sx - tw - 12;
      else if (sx + sw + tw + 12 <= w - right) tx = sx + sw + 12;
      else if (sy - th - 12 >= top) ty = sy - th - 12;
      else if (sy + sh + th + 12 <= h - bottom) ty = sy + sh + 12;
      else {
        sx = left;
        tx = w - right - tw;
      }
    }
    for (const [el, x, y, width, height] of [
      [elements.steering, sx, sy, sw, sh],
      [elements.throttle, tx, ty, tw, th],
    ]) {
      Object.assign(el.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
    }
    elements.steering.style.setProperty("--travel", v.steerTravel);
    elements.throttle.style.setProperty("--travel", v.throttleTravel);
    elements.steering.style.setProperty(
      "--caption-size",
      sw < 180 ? "8px" : "10px",
    );
    elements.throttle.style.setProperty(
      "--caption-size",
      `${Math.min(10, tw * 0.12)}px`,
    );
    const caption = elements.steering.querySelector(".analog-header > span");
    caption.textContent =
      sw < 120 ? "P ← → S" : sw < 180 ? "P ← STEER → S" : "PORT ← STEER → STBD";
    document.documentElement.style.setProperty(
      "--throttle-clearance",
      `${bottom + th + 12}px`,
    );
  }
  function paint() {
    for (const [name, el] of entries) {
      const value = touch[name],
        percent = Math.round(value * 100);
      if (value === painted[name]) continue;
      painted[name] = value;
      el.style.setProperty(
        "--position",
        `${name === "steering" ? (value + 1) * 50 : (1 - value) * 100}%`,
      );
      el.setAttribute("aria-valuenow", String(percent));
      el.setAttribute(
        "aria-valuetext",
        name === "steering"
          ? `${Math.abs(percent)}% ${percent < 0 ? "port" : percent > 0 ? "starboard" : "centre"}`
          : `${percent}% throttle`,
      );
      outputs[name].textContent =
        name === "steering"
          ? (percent < 0 ? "P " : percent > 0 ? "S " : "") +
            Math.abs(percent) +
            "%"
          : `${percent}%`;
    }
    const status = document.getElementById("inputDeviceStatus");
    const entry = document.getElementById("controllerEntryStatus");
    if (entry && entry.dataset.connected !== String(gamepad.connected)) {
      entry.dataset.connected = String(gamepad.connected);
      entry.title = gamepad.connected
        ? `${gamepad.id} connected`
        : "Press a controller button to connect";
      entry.setAttribute("aria-label", entry.title);
    }
    if (status) {
      const text = gamepad.connected
        ? gamepad.state.supported
          ? gamepad.armed
            ? "PAD CONNECTED"
            : "PAD · RELEASE RT / STICK"
          : "PAD · CHOOSE MAPPING"
        : "TOUCH / KEYS";
      if (status.textContent !== text) status.textContent = text;
      if (status.dataset.connected !== String(gamepad.connected))
        status.dataset.connected = String(gamepad.connected);
      const title =
        gamepad.id ||
        (gamepad.available
          ? "No controller detected. Press a controller button to connect."
          : "Gamepad API unavailable.");
      if (status.title !== title) status.title = title;
    }
  }
  function update(
    dt,
    speedRatio,
    allow = canDrive(),
    foreground = !document.hidden,
  ) {
    clock += dt;
    let pads;
    try {
      pads = foreground ? getGamepads() : [];
      gamepad.available = typeof navigator.getGamepads === "function";
    } catch {
      pads = [];
      gamepad.available = false;
    }
    // Actions remain available on title/pause/settings screens; driving does not.
    const pad = gamepad.poll(pads, dt, foreground, allow);
    allow = allow && canDrive();
    if (!allow) {
      if (enabled) release();
      enabled = false;
      pipeline.release();
      touch.steering = touch.throttle = 0;
    } else {
      enabled = true;
      const v = store.values;
      for (const name of axes)
        if (!arcade && pointers[name] === null) {
          released[name] += dt;
          touch[name] = returnInput(
            touch[name],
            name === "steering" ? v.steerReturn : v.throttleReturn,
            name === "steering" ? v.steerReturnSpeed : v.throttleReturnSpeed,
            name === "steering" ? v.steerSpring : 1,
            dt,
            released[name],
            v.steerReturnDelay,
          );
        }
      if (!arcade)
        pipeline.set(
          "touch",
          touch.steering,
          touch.throttle,
          pointers.steering !== null ||
            pointers.throttle !== null ||
            Math.abs(touch.steering) + touch.throttle > 0.0001,
          touchIntent,
        );
      touchIntent = false;
      pipeline.set(
        "gamepad",
        pad.steering,
        pad.throttle,
        pad.engaged,
        pad.intent,
      );
      if (pad.throttle > 0.04 && lastPadThrottle <= 0.04) onPress("throttle");
      lastPadThrottle = pad.throttle;
      pipeline.update(dt, speedRatio);
    }
    if (clock - lastPaint >= 1 / 30) {
      paint();
      lastPaint = clock;
    }
    const showPreview =
      !allow &&
      foreground &&
      document.body.classList.contains("pit-open") &&
      !document.getElementById("controlLab")?.hidden;
    if (showPreview && gamepad.connected && gamepad.state.supported) {
      preview.set("gamepad", gamepad.rawSteering, gamepad.rawThrottle, true);
      preview.update(dt, speedRatio);
    } else if (monitoring) preview.release();
    monitoring = showPreview && gamepad.connected && gamepad.state.supported;
  }
  store.subscribe(() => {
    const v = store.values,
      next = [
        v.steerWidth,
        v.steerHeight,
        v.steerX,
        v.steerY,
        v.steerTravel,
        v.throttleWidth,
        v.throttleHeight,
        v.throttleX,
        v.throttleY,
        v.throttleTravel,
      ].join("/");
    if (next !== layoutKey) {
      layoutKey = next;
      layout();
    }
    const mapping = [v.padMapping, v.padRightAxis, v.padTriggerRest].join("/");
    if (mapping !== mappingKey) {
      mappingKey = mapping;
      release();
    }
  });
  window.addEventListener("resize", () => {
    release();
    layout();
  });
  window.visualViewport?.addEventListener("resize", layout);
  if (arcade) {
    elements.steering.parentElement.hidden = true;
    buttons = mountArcadeTouch({
      canDrive,
      onPress,
      release,
      set: (steer, throttle, engaged) => {
        pipeline.set("touch", steer, throttle, engaged, true);
        touch.steering = steer;
        touch.throttle = throttle;
        pipeline.update(0);
      },
    });
  }
  layout();
  paint();
  return {
    input,
    release,
    update,
    gamepad,
    pulse,
    inspect: () => ({
      ...pipeline.inspect(),
      preview: monitoring ? preview.inspect() : null,
      controller: gamepad.inspect(),
      touch: { ...touch },
      steeringMode: store.values.steerReturn,
      throttleMode: store.values.throttleReturn,
      smoothing: {
        steering: store.values.steerSmoothing,
        throttle: store.values.throttleSmoothing,
      },
      ramp: {
        steering: store.values.steerRamp,
        throttleUp: store.values.throttleRampUp,
        throttleDown: store.values.throttleRampDown,
      },
    }),
  };
}
