import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measureArcadeHandling } from "../scripts/verify-arcade-handling.mjs";
import { stepBoat, settings, PHYSICS_STEP } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import { SettingsStore, settingsKey } from "../src/settings.js";
import { ControlSettings, controlStorageKey } from "../src/control-settings.js";
import { ControlInput } from "../src/control-input.js";
const before = JSON.parse(
  readFileSync(
    new URL("../docs/arcade-handling/before.json", import.meta.url),
    "utf8",
  ),
);
const memory = (seed) => {
  const data = new Map(Object.entries(seed ?? {}));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
const open = (x, z) => ({ x, z, index: 0 });

test("Arcade factory tune responds and reverses faster, turns tighter and retains less side slip than the measured prior release", () => {
  const a = before.metrics,
    b = measureArcadeHandling();
  assert.ok(b.timeToPoint5Yaw < a.timeToPoint5Yaw * 0.6);
  assert.ok(b.yawAt250 > a.yawAt250 * 1.5);
  assert.ok(b.reverseSignSeconds < a.reverseSignSeconds * 0.6);
  assert.ok(b.steadyTurnRadius < a.steadyTurnRadius * 0.85);
  assert.ok(b.slip < a.slip * 0.6);
  assert.equal(b.releaseThrust, 0);
  assert.ok(b.coastSpeedAt1sec > 10 && b.coastSpeedAt1sec < 25);
  assert.ok(b.coastDistanceAt1sec > 15);
  assert.ok(b.coastingLowSpeedYaw > 10);
  assert.equal(b.stationaryYaw, 0);
});
test("release cuts thrust even with full stored pump pressure; velocity coasts and rapid direction changes stay capped", () => {
  Object.assign(settings, handlingDefaults);
  const b = {
    x: 0,
    z: 0,
    vx: 25,
    vz: 3,
    angle: 0,
    pump: 1,
    nozzle: 0.2,
    yawRate: 1,
  };
  stepBoat(b, { throttle: 0, steering: 1 }, PHYSICS_STEP, open);
  assert.equal(b.thrust, 0);
  assert.ok(Math.hypot(b.vx, b.vz) > 24);
  assert.equal(b.engineLoad, 0);
  for (let i = 0; i < 1200; i++) {
    stepBoat(
      b,
      { throttle: 1, steering: Math.floor(i / 12) % 2 ? 1 : -1 },
      PHYSICS_STEP,
      open,
    );
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
    assert.ok(
      Math.abs(b.yawRate) <=
        (handlingDefaults.maxTurnRate * Math.PI) / 180 + 1e-10,
    );
  }
  const idle = {
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    angle: 0,
    pump: 0,
    nozzle: 0,
    yawRate: 3,
  };
  for (let i = 0; i < 240; i++)
    stepBoat(idle, { throttle: 0, steering: 1 }, PHYSICS_STEP, open);
  assert.equal(idle.angle, 0);
  assert.equal(idle.yawRate, 0);
});
test("keyboard/gamepad release and device handover clear throttle and nitrous even with slow saved release filters", () => {
  const store = new ControlSettings(memory());
  Object.assign(store.values, {
    throttleSmoothing: 0.3,
    throttleRampDown: 0.2,
    throttleReturn: "hold",
  });
  for (const device of ["keyboard", "gamepad"]) {
    const p = new ControlInput(store);
    p.set(device, 0.5, 1, true, true, true);
    for (let i = 0; i < 120; i++) p.update(1 / 120);
    assert.ok(p.input.throttle > 0.9);
    assert.equal(p.input.nitrous, true);
    p.set(device, 0.5, 0, true, true, true);
    p.update(0);
    assert.equal(p.input.throttle, 0);
    assert.equal(p.input.nitrous, false);
  }
  const p = new ControlInput(store);
  p.set("keyboard", 0, 1, true, true, true);
  p.update(1);
  p.set("gamepad", 0.8, 0, true, true);
  p.update(0);
  assert.equal(p.input.throttle, 0);
  assert.equal(p.input.nitrous, false);
  assert.equal(p.sources.keyboard.throttle, 0);
});
test("factory saves upgrade once to Arcade; explicit custom values, named imports and unrelated stores stay intact", () => {
  const old = {
      schemaVersion: 3,
      gameVersion: "0.31.1",
      settings: {
        ...before.settings,
        physicsPreset: "balanced",
        musicVolume: 17,
        waterMode: "simulated",
      },
    },
    m = memory({
      [settingsKey]: JSON.stringify(old),
      career: "career bytes",
      audio: "audio bytes",
    });
  const s = new SettingsStore(m);
  assert.equal(s.values.physicsPreset, "arcade");
  assert.equal(s.values.steer, 95);
  assert.equal(s.values.drift, 35);
  assert.equal(s.values.musicVolume, 17);
  assert.equal(s.values.waterMode, "simulated");
  s.flush();
  assert.equal(new SettingsStore(m).values.steer, 95);
  assert.equal(m.getItem("career"), "career bytes");
  assert.equal(m.getItem("audio"), "audio bytes");
  old.settings.steer = 82;
  old.settings.physicsPreset = "custom";
  m.setItem(settingsKey, JSON.stringify(old));
  const custom = new SettingsStore(m);
  assert.equal(custom.values.steer, 82);
  assert.equal(custom.values.drift, 65);
  assert.equal(custom.values.maxTurnRate, 150);
  custom.flush();
  custom.importText(
    JSON.stringify({
      ...old,
      settings: { ...before.settings, physicsPreset: "balanced" },
    }),
  );
  assert.equal(custom.values.steer, 75);
  assert.equal(custom.values.drift, 65);
  custom.flush();
});
test("factory input latency migrates while custom response curves and archived hold values survive", () => {
  const old = {
      schemaVersion: 1,
      preset: "arcade",
      settings: {
        steerSmoothing: 0.025,
        arcadeDragSmoothing: 0.035,
        arcadeDragReturn: 0.2,
        steerRamp: 18,
        speedSteering: 10,
      },
    },
    m = memory({ [controlStorageKey]: JSON.stringify(old) }),
    s = new ControlSettings(m);
  assert.equal(s.values.steerSmoothing, 0.01);
  assert.equal(s.values.arcadeDragSmoothing, 0.01);
  assert.equal(s.values.arcadeDragReturn, 0.15);
  s.flush();
  old.preset = "custom";
  old.settings.throttleReturn = "hold";
  old.settings.padCurve = 1.7;
  m.setItem(controlStorageKey, JSON.stringify(old));
  const custom = new ControlSettings(m);
  assert.equal(custom.values.steerSmoothing, 0.025);
  assert.equal(custom.values.padCurve, 1.7);
  assert.equal(custom.values.throttleReturn, "hold");
  custom.flush();
});
