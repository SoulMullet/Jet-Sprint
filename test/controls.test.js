import test from "node:test";
import assert from "node:assert/strict";
import {
  ControlSettings,
  controlDefaults,
  controlSpecs,
  controlStorageKey,
  decodeControls,
} from "../src/control-settings.js";
import {
  ControlInput,
  response,
  filterInput,
  returnInput,
} from "../src/control-input.js";
import {
  GamepadSource,
  readGamepad,
  buttonValue,
} from "../src/control-gamepad.js";
import { stepBoat, settings } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
const storage = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
const setup = () => {
  const store = new ControlSettings(storage());
  return { store, input: new ControlInput(store) };
};
const tick = (input, n = 120, speed = 0) => {
  for (let i = 0; i < n; i++) input.update(1 / 120, speed);
  return input.input;
};
const pad = () => ({
  id: "Xbox 360 Controller",
  index: 0,
  connected: true,
  mapping: "standard",
  axes: [0, 0, 0, 0, 0, -1],
  buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
});
const turn = (command, n = 120) => {
  const b = { x: 0, z: 0, vx: 0, vz: 0, angle: 0 };
  for (let i = 0; i < n; i++)
    stepBoat(b, command, 1 / 120, (x, z) => ({ x, z, index: 0 }));
  return b;
};

test("dead zones remove stick drift and preserve proportional signed endpoints", () => {
  for (const x of [-0.12, -0.03, 0, 0.05, 0.12])
    assert.equal(response(x, 0.12), 0);
  assert.ok(Math.abs(response(0.56, 0.12) - 0.5) < 1e-12);
  assert.ok(Math.abs(response(-0.56, 0.12) + 0.5) < 1e-12);
  assert.equal(response(1, 0.3), 1);
  assert.equal(response(-1, 0.3), -1);
  for (const x of [NaN, Infinity, -Infinity, undefined])
    assert.equal(response(x, 0.1), 0);
  assert.equal(response(-1, 0, 1, 1, false), 0);
});
test("response exponent/sensitivity tune a monotonic curve, bounded at full scale", () => {
  assert.equal(response(0.5, 0, 2), 0.25);
  assert.equal(response(0.5, 0, 1, 1.5), 0.75);
  for (const exponent of [0.5, 1, 3]) {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = response(i / 100, 0.08, exponent, 2);
      assert.ok(value >= previous && value <= 1);
      previous = value;
    }
  }
});
test("smoothing is time based, ramp limits are directional and zero smoothing is immediate", () => {
  const integrate = (rate) => {
    let x = 0;
    for (let i = 0; i < rate; i++) x = filterInput(x, 1, 0.15, 100, 1 / rate);
    return x;
  };
  assert.ok(Math.abs(integrate(30) - integrate(120)) < 1e-12);
  assert.equal(filterInput(0, 1, 0, 2, 0.05), 0.1);
  assert.equal(filterInput(1, 0, 0, 4, 0.05), 0.8);
  assert.equal(filterInput(0, 0.4, 0, 100, 0.05), 0.4);
  assert.equal(filterInput(0.4, 1, 0, 100, 0), 0.4);
});
test("touch spring, hold, hybrid delay and gradual throttle returns are independent of frame rate", () => {
  for (const mode of ["spring", "hold", "hybrid", "gradual"]) {
    const run = (rate) => {
      let value = 0.8;
      for (let i = 1; i <= rate; i++)
        value = returnInput(value, mode, 1, 1, 1 / rate, i / rate, 0.25);
      return value;
    };
    assert.ok(Math.abs(run(30) - run(120)) < 0.00011, mode);
  }
  assert.equal(returnInput(0.6, "hold", 10, 2, 1), 0.6);
  assert.equal(returnInput(-0.6, "hybrid", 1, 1, 0.1, 0.2, 0.3), -0.6);
  assert.ok(
    Math.abs(returnInput(-0.6, "hybrid", 1, 1, 0.1, 0.4, 0.3) + 0.5) < 1e-12,
  );
  assert.equal(returnInput(0.2, "gradual", 1, 1, 0.5), 0);
});
test("one shared command interface produces precise analog steering/throttle and input-only speed scaling", () => {
  const { store, input } = setup();
  Object.assign(store.values, {
    steerSmoothing: 0,
    steerRamp: 60,
    throttleSmoothing: 0,
    steerDeadzone: 0,
    throttleDeadzone: 0,
    speedSteering: 20,
  });
  input.set("touch", 0.5, 0.37, true);
  tick(input);
  assert.equal(input.input.steering, 0.5);
  assert.equal(input.input.throttle, 0.37);
  assert.equal(input.input.right, true);
  tick(input, 120, 1);
  assert.equal(input.input.steering, 0.4);
  assert.equal(settings.top, handlingDefaults.top);
});
test("keyboard ramps up and down through the same pipeline without latching keys", () => {
  const { store, input } = setup();
  Object.assign(store.values, {
    throttleSmoothing: 0,
    throttleRampUp: 2,
    throttleRampDown: 1,
  });
  input.set("keyboard", 1, 1, true);
  tick(input, 12);
  assert.ok(Math.abs(input.input.throttle - 0.2) < 1e-12);
  input.set("keyboard", 0, 0, false, false);
  tick(input, 12);
  assert.ok(Math.abs(input.input.throttle - 0.1) < 1e-12);
  tick(input, 120);
  assert.equal(input.input.throttle, 0);
  assert.equal(input.input.steering, 0);
});
test("last meaningful input owns a whole command pair; neutral controller cannot steal touch", () => {
  const { input } = setup();
  input.set("touch", -0.8, 0.7, true);
  tick(input);
  assert.equal(input.active, "touch");
  input.set("gamepad", 0.03, 0, false, false);
  tick(input);
  assert.equal(input.active, "touch");
  input.set("keyboard", 1, 0.2, true);
  tick(input);
  assert.equal(input.active, "keyboard");
  assert.ok(input.input.steering > 0);
  assert.ok(input.input.throttle < 0.3);
  input.set("touch", -0.4, 0.6, true);
  tick(input);
  assert.equal(input.active, "touch");
  input.set("gamepad", -0.7, 0.3, true);
  tick(input);
  assert.equal(input.active, "gamepad");
  input.release();
  assert.deepEqual(input.input, {
    steering: 0,
    throttle: 0,
    left: false,
    right: false,
  });
});
test("explicit device preference applies only while engaged and allows fallback", () => {
  const { store, input } = setup();
  store.values.priority = "touch";
  input.set("touch", -0.5, 0.4, true);
  input.set("keyboard", 1, 1, true);
  tick(input);
  assert.equal(input.active, "touch");
  input.set("touch", 0, 0, false, false);
  tick(input);
  assert.equal(input.active, "keyboard");
  store.values.priority = "gamepad";
  input.set("gamepad", 0, 0, false, false);
  tick(input);
  assert.equal(input.active, "keyboard");
});
test("a superseded hold or held key cannot reopen throttle after the newer device goes idle", () => {
  const { input } = setup();
  input.set("touch", 0.3, 0.8, true);
  tick(input);
  input.set("keyboard", -1, 0.2, true);
  tick(input);
  input.set("touch", 0.3, 0.8, true, false);
  input.set("keyboard", 0, 0, false, false);
  tick(input);
  assert.equal(input.input.throttle, 0);
  assert.equal(input.active, "keyboard");
  input.set("touch", 0.3, 0.6, true, true);
  tick(input);
  assert.equal(input.active, "touch");
  assert.ok(input.input.throttle > 0.5);
});
test("touch endpoint calibration and controller calibration are bounded and do not affect keyboard", () => {
  const { store, input } = setup();
  Object.assign(store.values, {
    throttleDeadzone: 0,
    touchThrottleIdle: 0.2,
    touchThrottleFull: 0.8,
    steerDeadzone: 0,
    steerSmoothing: 0,
  });
  input.set("touch", 0.4, 0.5, true);
  tick(input);
  assert.ok(Math.abs(input.input.throttle - 0.5) < 1e-12);
  input.set("keyboard", 0.4, 0.5, true);
  tick(input);
  assert.equal(input.input.throttle, 0.5);
  input.set("gamepad", 0.05, 0.02, true);
  tick(input);
  assert.equal(input.input.steering, 0);
  assert.equal(input.input.throttle, 0);
});
test("standard controller analog values and button fallbacks; LT has no invented reverse behavior", () => {
  const p = pad(),
    s = controlDefaults(),
    out = {};
  p.axes[0] = -0.43;
  p.buttons[7] = { value: 0.36, pressed: false };
  p.buttons[6] = { value: 1, pressed: true };
  readGamepad(p, s, out);
  assert.equal(out.steering, -0.43);
  assert.equal(out.throttle, 0.36);
  assert.equal(out.supported, true);
  assert.equal(buttonValue({ pressed: true }), 1);
  assert.equal(buttonValue(0.4), 0.4);
  assert.equal(buttonValue({ value: NaN }), 0);
  p.buttons[7] = null;
  readGamepad(p, s, out);
  assert.equal(out.throttle, 0);
});
test("unknown mappings are safe until selected; legacy axis triggers support both rest conventions", () => {
  const p = pad(),
    s = controlDefaults(),
    out = {};
  p.mapping = "";
  p.axes[0] = 1;
  p.axes[5] = 1;
  readGamepad(p, s, out);
  assert.equal(out.supported, false);
  assert.equal(out.throttle, 0);
  assert.equal(out.steering, 0);
  s.padMapping = "axis-triggers";
  p.axes[5] = -0.2;
  readGamepad(p, s, out);
  assert.equal(out.throttle, 0.4);
  s.padTriggerRest = "zero";
  p.axes[5] = 0.7;
  readGamepad(p, s, out);
  assert.equal(out.throttle, 0.7);
  s.padRightAxis = 9;
  readGamepad(p, s, out);
  assert.equal(out.throttle, 0);
});
test("hot-plugging requires neutral, proportional controls update and disconnect invokes a hard safety stop once", () => {
  const { store } = setup(),
    events = [];
  let lost = 0;
  const source = new GamepadSource(store, {
      onLost: () => lost++,
      onAction: (a) => events.push(a),
    }),
    p = pad();
  p.buttons[7].value = 1;
  source.poll([p], 0.016);
  assert.equal(source.armed, false);
  assert.equal(source.state.throttle, 0);
  assert.equal(source.inspect().rawThrottle, 1);
  p.buttons[7].value = 0;
  source.poll([p], 0.016);
  assert.equal(source.armed, true);
  p.axes[0] = 0.5;
  p.buttons[7].value = 0.4;
  source.poll([p], 0.016);
  assert.equal(source.state.steering, 0.5);
  assert.equal(source.state.throttle, 0.4);
  assert.equal(source.state.intent, true);
  source.poll([p], 0.016);
  assert.equal(source.state.intent, false);
  source.poll([], 0.016);
  assert.equal(lost, 1);
  assert.equal(source.state.throttle, 0);
  assert.equal(source.connected, false);
  source.poll([], 0.016);
  assert.equal(lost, 1);
  source.poll([p], 0.016);
  assert.equal(source.state.throttle, 0);
});
test("controller actions edge-trigger/repeat, and menus never leave a held trigger armed", () => {
  const { store } = setup(),
    events = [],
    source = new GamepadSource(store, { onAction: (a) => events.push(a) }),
    p = pad();
  source.poll([p], 0.016);
  p.buttons[0].value = 1;
  source.poll([p], 0.016);
  source.poll([p], 1);
  assert.deepEqual(events, ["confirm"]);
  p.buttons[13].value = 1;
  source.poll([p], 0.016);
  source.poll([p], 0.41);
  assert.deepEqual(events, ["confirm", "down", "down"]);
  source.poll([p], 0.016, true, false);
  assert.equal(source.armed, false);
  p.buttons[7].value = 0.7;
  source.poll([p], 0.016, true, false);
  source.poll([p], 0.016, true, true);
  assert.equal(source.state.throttle, 0);
  p.buttons[7].value = 0;
  source.poll([p], 0.016);
  assert.equal(source.armed, true);
  p.buttons[7].value = 0.5;
  source.poll([p], 0.016);
  assert.equal(source.state.throttle, 0.5);
  source.poll([p], 0.016, false);
  assert.equal(source.state.throttle, 0);
  assert.equal(source.armed, false);
});
test("all control settings persist with stable keys across updates without changing any old stores", () => {
  const db = storage();
  for (const key of [
    "jet-sprint-settings",
    "jet-sprint-v8-settings",
    "jet-sprint-cameras-v1",
    "jet-sprint-summer-graphics-v1",
  ])
    db.setItem(key, "original " + key);
  const original = new Map(db.data),
    store = new ControlSettings(db);
  store.set("steerReturn", "hold");
  store.set("throttleRampUp", 7.4);
  store.set("steerX", 19);
  store.flush();
  const restored = new ControlSettings(db);
  assert.equal(restored.values.steerReturn, "hold");
  assert.equal(restored.values.throttleRampUp, 7.4);
  assert.equal(restored.values.steerX, 19);
  assert.ok(db.getItem(controlStorageKey).includes('"schemaVersion": 1'));
  for (const [k, v] of original) assert.equal(db.getItem(k), v);
  restored.flush();
  store.flush();
});
test("invalid saved fields are sanitized individually, old schema defaults added safely, unsafe imports rejected atomically", () => {
  const db = storage();
  db.setItem(
    controlStorageKey,
    JSON.stringify({
      schemaVersion: 0,
      values: {
        steerSensitivity: 999,
        throttleSmoothing: "oops",
        steerReturn: "wrong",
        throttleRampUp: 4,
      },
    }),
  );
  const store = new ControlSettings(db);
  assert.equal(store.values.steerSensitivity, 2);
  assert.equal(store.values.throttleSmoothing, 0.02);
  assert.equal(store.values.steerReturn, "spring");
  assert.equal(store.values.throttleRampUp, 4);
  assert.equal(store.values.padMapping, "auto");
  const saved = store.exportText();
  assert.throws(
    () =>
      store.importText('{"schemaVersion":1,"settings":{"steerCurve":null}}'),
    /finite/,
  );
  assert.equal(store.exportText(), saved);
  assert.throws(
    () => decodeControls('{"schemaVersion":99,"settings":{}}'),
    /schema/,
  );
  assert.throws(
    () => decodeControls('{"schemaVersion":1,"type":"physics","settings":{}}'),
    /configuration/,
  );
  store.importText(
    '{"schemaVersion":1,"settings":{"__proto__":{"polluted":true},"steerCurve":1.75}}',
  );
  assert.equal({}.polluted, undefined);
  assert.equal(store.values.steerCurve, 1.75);
  store.flush();
});
test("presets change only input response, retain layout/calibration, customize and scoped reset", () => {
  const { store } = setup(),
    physics = { ...settings };
  store.set("steerWidth", 250);
  store.set("touchSteerCentre", 0.1);
  store.set("throttleX", 90);
  store.select("simulation");
  assert.equal(store.preset, "simulation");
  assert.equal(store.values.steerReturn, "hold");
  assert.equal(store.values.speedSteering, 0);
  assert.equal(store.values.steerWidth, 250);
  assert.equal(store.values.touchSteerCentre, 0.1);
  store.set("steerCurve", 1.7);
  assert.equal(store.preset, "custom");
  store.reset("Steering");
  assert.equal(store.values.steerCurve, 1);
  assert.equal(store.values.throttleReturn, "hold");
  assert.equal(store.values.throttleX, 90);
  const exported = store.exportText();
  store.reset();
  store.importText(exported);
  assert.equal(store.values.throttleX, 90);
  assert.deepEqual(settings, physics);
  store.flush();
});
test("every declared control has a valid default/range and blocked storage never blocks driving", () => {
  const store = new ControlSettings({
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  });
  assert.ok(store.warning);
  store.set("steerCurve", 2);
  assert.equal(store.flush(), false);
  const input = new ControlInput(store);
  input.set("keyboard", 1, 1, true);
  tick(input);
  assert.ok(input.input.throttle > 0.99);
  for (const [key, s] of Object.entries(controlSpecs))
    if (s.type === "number") {
      assert.ok(s.value >= s.min && s.value <= s.max, key);
      assert.ok(s.step > 0);
    }
});
test("analog adapter exactly preserves legacy full-lock forces and proportional nozzle authority", () => {
  for (const direction of [-1, 1])
    assert.deepEqual(
      turn({ steering: direction, throttle: 0.7 }),
      turn({ left: direction < 0, right: direction > 0, throttle: 0.7 }),
    );
  const small = turn({ steering: 0.25, throttle: 0.8 }),
    large = turn({ steering: 1, throttle: 0.8 });
  assert.ok(small.angle > 0 && small.angle < large.angle);
  assert.ok(Math.abs(small.nozzle - large.nozzle * 0.25) < 1e-12);
  for (const value of [NaN, Infinity])
    assert.equal(turn({ steering: value, throttle: 1 }).nozzle, 0);
});
test("processed analog steering with no waterjet thrust cannot rotate a stationary or coasting boat", () => {
  const { input } = setup();
  input.set("gamepad", 0.7, 0, true);
  tick(input);
  const stopped = turn(input.input);
  assert.equal(stopped.angle, 0);
  assert.equal(stopped.yawRate, 0);
  const b = { x: 0, z: 0, vx: 15, vz: 0, angle: 0 };
  for (let i = 0; i < 240; i++)
    stepBoat(b, input.input, 1 / 120, (x, z) => ({ x, z, index: 0 }));
  assert.equal(b.angle, 0);
});

// Centre trim retains both full-lock endpoints and never steers an idle axis.
test("touch centre calibration rescales remaining travel to both full-lock endpoints", () => {
  const { store, input } = setup();
  Object.assign(store.values, {
    steerSmoothing: 0,
    steerDeadzone: 0,
    speedSteering: 0,
    touchSteerCentre: 0.2,
  });
  for (const [raw, expected] of [
    [1, 1],
    [-1, -1],
    [0.2, 0],
    [0.6, 0.5],
    [0, 0],
  ]) {
    input.set("touch", raw, 0.1, true);
    tick(input);
    assert.ok(Math.abs(input.input.steering - expected) < 1e-12);
  }
});
