import test from "node:test";
import assert from "node:assert/strict";
import { RelativeDragSteering } from "../src/arcade/drag-steering.js";
import {
  ControlSettings,
  controlDefaults,
  controlStorageKey,
} from "../src/control-settings.js";
import { bindControls } from "../src/controls.js";

test("relative CSS-pixel drag is signed, proportional, dead-zoned and clamped at 90 pixels", () => {
  const s = new RelativeDragSteering(controlDefaults());
  assert.equal(s.down(10, 280), true);
  assert.equal(s.target, 0);
  for (const [dx, expected] of [
    [-5, 0],
    [5, 0],
    [-47.5, -0.5],
    [47.5, 0.5],
    [-90, -1],
    [90, 1],
    [500, 1],
  ]) {
    s.move(10, 280 + dx);
    assert.equal(s.target, expected);
  }
  assert.equal(s.down(20, 0), false);
  assert.equal(s.move(20, -999), false);
  assert.equal(s.end(20), false);
  assert.equal(s.pointer, 10);
});

test("drag response and 200 ms return are frame-rate independent, hold displacement and recenter at each new contact", () => {
  const simulate = (hz) => {
    const s = new RelativeDragSteering(controlDefaults());
    s.down(1, 100);
    s.move(1, 190);
    for (let i = 0; i < hz / 2; i++) s.update(1 / hz);
    assert.ok(s.value > 0.999);
    s.end(1);
    for (let i = 0; i < hz / 10; i++) s.update(1 / hz);
    const halfway = s.value;
    for (let i = 0; i < hz / 10 + 1; i++) s.update(1 / hz);
    assert.equal(s.value, 0);
    s.down(2, 600);
    assert.equal(s.value, 0);
    assert.equal(s.target, 0);
    s.move(2, 510);
    s.update(0.1);
    s.end(2, true);
    assert.equal(s.value, 0);
    return halfway;
  };
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 0.00001);
});

class Surface extends EventTarget {
  constructor(parent) {
    super();
    this.parentElement = parent;
    this.captures = new Set();
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
  }
  querySelector() {
    return { textContent: "" };
  }
  setAttribute() {}
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
  }
}
function send(target, type, props = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, props);
  target.dispatchEvent(e);
  return e;
}
function fixture(run) {
  const names = ["window", "document", "navigator"],
    descriptors = names.map((k) =>
      Object.getOwnPropertyDescriptor(globalThis, k),
    );
  const win = new EventTarget(),
    doc = new EventTarget();
  Object.assign(doc, {
    hidden: false,
    body: { classList: { contains: () => false } },
    getElementById: () => null,
  });
  for (const [k, value] of Object.entries({
    window: win,
    document: doc,
    navigator: { getGamepads: () => [] },
  }))
    Object.defineProperty(globalThis, k, { value, configurable: true });
  const values = new Map(),
    store = new ControlSettings({
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    }),
    root = {},
    surface = new Surface(root);
  let allowed = true;
  const controls = bindControls(
    { steering: new Surface(root), throttle: new Surface(root) },
    store,
    { arcade: true, riverDrag: { surface }, canDrive: () => allowed },
  );
  const tick = (n = 24) => {
    for (let i = 0; i < n; i++) controls.update(1 / 120, 0);
  };
  const pointer = (type, id, x = 300, y = 220) =>
    send(surface, type, {
      pointerId: id,
      pointerType: "touch",
      clientX: x,
      clientY: y,
    });
  try {
    run({
      controls,
      pointer,
      tick,
      surface,
      win,
      doc,
      store,
      values,
      allow: (v) => {
        allowed = v;
      },
    });
  } finally {
    store.flush();
    for (let i = 0; i < names.length; i++) {
      if (descriptors[i])
        Object.defineProperty(globalThis, names[i], descriptors[i]);
      else delete globalThis[names[i]];
    }
  }
}
test("actual control adapter delivers drag to the boat input, ignores vertical/secondary moves and returns smoothly on release", () =>
  fixture(({ controls, pointer, tick, surface }) => {
    assert.equal(pointer("pointerdown", 7).defaultPrevented, false);
    assert.equal(surface.hasPointerCapture(7), true);
    tick();
    assert.equal(controls.input.steering, 0);
    pointer("pointermove", 7, 300, 330);
    tick();
    assert.equal(controls.input.steering, 0);
    pointer("pointermove", 7, 210);
    tick();
    assert.ok(controls.input.steering < -0.99);
    pointer("pointerdown", 8, 500);
    pointer("pointermove", 8, 590);
    pointer("pointerup", 8);
    tick();
    assert.ok(controls.input.steering < -0.99);
    pointer("pointermove", 7, 390);
    tick(36);
    assert.ok(controls.input.steering > 0.99);
    tick();
    assert.ok(controls.input.steering > 0.99);
    pointer("pointerup", 7);
    tick(12);
    assert.ok(controls.input.steering > 0.45 && controls.input.steering < 0.55);
    tick(13);
    assert.equal(controls.input.steering, 0);
    assert.equal(surface.hasPointerCapture(7), false);
  }));
test("actual control adapter clears cancellation, lost/pending capture, pause, focus loss and hidden-page touches without stuck input", () =>
  fixture(({ controls, pointer, tick, surface, win, doc, allow }) => {
    const hold = () => {
      pointer("pointerdown", 1);
      pointer("pointermove", 1, 390);
      tick();
      assert.ok(controls.input.steering > 0.99);
    };
    for (const type of ["pointercancel", "lostpointercapture"]) {
      hold();
      pointer(type, 1);
      tick();
      assert.equal(controls.input.steering, 0);
    }
    pointer("pointerdown", 1);
    surface.releasePointerCapture(1);
    pointer("pointermove", 1, 390);
    tick();
    assert.equal(controls.input.steering, 0);
    hold();
    surface.releasePointerCapture(1);
    tick();
    assert.equal(controls.input.steering, 0);
    assert.equal(controls.inspect().drag.pointer, null);
    hold();
    allow(false);
    tick();
    assert.equal(controls.input.steering, 0);
    assert.equal(controls.inspect().drag.pointer, null);
    allow(true);
    hold();
    send(win, "blur");
    assert.equal(controls.input.steering, 0);
    hold();
    doc.hidden = true;
    send(doc, "visibilitychange");
    assert.equal(controls.input.steering, 0);
    doc.hidden = false;
  }));
test("old control saves inherit Arcade drag defaults without changing existing response values; tuning persists and resets independently", () =>
  fixture(({ store, values }) => {
    store.importText(
      JSON.stringify({
        schema: 1,
        values: { steerReturn: "hold", padCurve: 1.7, throttleReturn: "hold" },
      }),
    );
    assert.equal(store.values.arcadeDragDistance, 90);
    store.set("arcadeDragDistance", 110);
    store.set("arcadeDragReturn", 0.23);
    store.flush();
    const restored = new ControlSettings({
      getItem: (k) => values.get(k),
      setItem() {},
    });
    assert.equal(restored.values.arcadeDragDistance, 110);
    assert.equal(restored.values.arcadeDragReturn, 0.23);
    restored.reset("Arcade River drag");
    restored.flush();
    assert.equal(restored.values.arcadeDragDistance, 90);
    assert.equal(restored.values.padCurve, 1.7);
    assert.equal(restored.values.steerReturn, "hold");
    assert.ok(values.has(controlStorageKey));
  }));
