import test from "node:test";
import assert from "node:assert/strict";
import { bindControls } from "../src/controls.js";
import { ControlSettings } from "../src/control-settings.js";

// Minimal browser boundary. Fixed, independently specified rail rectangles let
// actual event adapters run without a GPU or duplicating their input math.
class Surface extends EventTarget {
  constructor(rail, parent) {
    super();
    this.parentElement = parent;
    this.captured = new Set();
    this.attributes = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
    this.parts = {
      ".analog-rail": { getBoundingClientRect: () => rail },
      output: { textContent: "" },
      ".analog-header > span": { textContent: "" },
    };
  }
  querySelector(key) {
    return this.parts[key];
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
}
function event(target, type, properties = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, properties);
  target.dispatchEvent(e);
  return e;
}
function fixture(run) {
  const names = [
      "window",
      "document",
      "navigator",
      "innerWidth",
      "innerHeight",
      "getComputedStyle",
    ],
    before = Object.fromEntries(
      names.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]),
    );
  const win = new EventTarget(),
    root = {},
    elements = {
      steering: new Surface(
        { left: 10, width: 100, top: 300, height: 4, bottom: 304 },
        root,
      ),
      throttle: new Surface(
        { left: 300, width: 4, top: 200, height: 100, bottom: 300 },
        root,
      ),
    };
  const globals = {
    window: win,
    document: {
      hidden: false,
      documentElement: { style: { setProperty() {} } },
      body: { classList: { contains: () => false } },
      getElementById: () => null,
    },
    navigator: { getGamepads: () => [] },
    innerWidth: 390,
    innerHeight: 844,
    getComputedStyle: () => ({}),
  };
  for (const [k, value] of Object.entries(globals))
    Object.defineProperty(globalThis, k, { value, configurable: true });
  const store = new ControlSettings({ getItem: () => null, setItem() {} }),
    presses = [];
  let allowed = true;
  const controls = bindControls(elements, store, {
    onPress: (name) => presses.push(name),
    canDrive: () => allowed,
  });
  const advance = (n = 30) => {
    for (let i = 0; i < n; i++) controls.update(1 / 120, 0, allowed, true);
  };
  try {
    run({
      elements,
      store,
      controls,
      presses,
      advance,
      win,
      allow: (on) => (allowed = on),
    });
  } finally {
    store.flush();
    for (const k of names) {
      if (before[k]) Object.defineProperty(globalThis, k, before[k]);
      else delete globalThis[k];
    }
  }
}
test("actual pointer adapters capture independent axes, drag proportionally and emit one press edge per new finger", () =>
  fixture(({ elements, store, controls, presses, advance }) => {
    const down = (el, id, x, y) =>
      event(el, "pointerdown", {
        pointerId: id,
        pointerType: "touch",
        clientX: x,
        clientY: y,
      });
    assert.equal(down(elements.steering, 1, 35, 302).defaultPrevented, true);
    down(elements.throttle, 2, 302, 240);
    advance();
    assert.equal(controls.inspect().rawSteering, -0.5);
    assert.equal(controls.inspect().rawThrottle, 0.6);
    assert.ok(controls.input.steering < -0.4 && controls.input.throttle > 0.59);
    assert.equal(elements.steering.captured.has(1), true);
    assert.equal(elements.throttle.captured.has(2), true);
    down(elements.throttle, 3, 302, 210);
    assert.equal(presses.filter((p) => p === "throttle").length, 1);
    assert.equal(controls.inspect().touch.throttle, 0.6);
    store.values.throttleReturn = "hold";
    event(elements.throttle, "pointerup", { pointerId: 2 });
    advance();
    assert.equal(controls.inspect().touch.throttle, 0.6);
    // Existing double-tap gameplay depends on this fresh edge even above idle.
    down(elements.throttle, 4, 302, 235);
    assert.equal(presses.filter((p) => p === "throttle").length, 2);
    event(elements.throttle, "pointermove", {
      pointerId: 4,
      clientX: 302,
      clientY: 220,
    });
    advance();
    assert.equal(presses.filter((p) => p === "throttle").length, 2);
    assert.equal(controls.inspect().rawThrottle, 0.8);
    event(elements.throttle, "pointercancel", { pointerId: 4 });
    advance();
    assert.equal(controls.input.throttle, 0);
    assert.equal(controls.inspect().touch.throttle, 0);
    event(elements.steering, "lostpointercapture", { pointerId: 1 });
    advance();
    assert.equal(controls.input.steering, 0);
  }));
test("actual keyboard adapter tracks multiple keys and cannot rearm from autorepeat after a safety release", () =>
  fixture(({ win, controls, advance, allow }) => {
    event(win, "keydown", { key: "w" });
    event(win, "keydown", { key: " " });
    event(win, "keydown", { key: "a" });
    advance();
    assert.ok(controls.input.throttle > 0.99 && controls.input.steering < -0.9);
    event(win, "keyup", { key: "w" });
    event(win, "keydown", { key: "d" });
    advance();
    assert.ok(controls.input.throttle > 0.99);
    assert.ok(Math.abs(controls.input.steering) < 0.001);
    controls.release();
    event(win, "keydown", { key: " ", repeat: true });
    advance();
    assert.equal(controls.input.throttle, 0);
    event(win, "keydown", { key: "w", repeat: false });
    advance();
    assert.ok(controls.input.throttle > 0.99);
    allow(false);
    advance();
    assert.equal(controls.input.throttle, 0);
    allow(true);
    event(win, "keydown", { key: "w", repeat: true });
    advance();
    assert.equal(controls.input.throttle, 0);
    event(win, "keyup", { key: "w" });
    event(win, "keydown", { key: "w" });
    advance();
    assert.ok(controls.input.throttle > 0.99);
  }));
