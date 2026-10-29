import test from "node:test";
import assert from "node:assert/strict";
import { BallisticSpray, SPRAY_STEP } from "../src/ballistic-spray.js";
import { SettingsStore, settingsKey } from "../src/settings.js";
import { sprayControls, sprayDefaults } from "../src/spray-settings.js";
import {
  createSprayFrame,
  updateSprayFrame,
  jetLaunch,
} from "../src/spray-frame.js";
const body = {
  x: 0,
  z: 0,
  angle: 0,
  vx: 20,
  vz: 0,
  pump: 1,
  yawRate: 0,
  lateralAcceleration: 0,
};
const drop = { px: 0, py: 10, pz: 0, vx: -10, vy: 4, vz: 2 };
const near = (a, b, e = 1e-4) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test("sharp turns and full spins cannot rotate or redirect existing drops", () => {
  const a = new BallisticSpray(256),
    b = new BallisticSpray(256);
  a.emit(drop, 5);
  b.emit(drop, 5);
  for (let i = 0; i < 90; i++) {
    a.advance(
      SPRAY_STEP,
      {
        ...body,
        angle: i * 0.8,
        vx: Math.cos(i * 0.8) * 20,
        vz: Math.sin(i * 0.8) * 20,
      },
      { emit: false },
    );
    b.advance(SPRAY_STEP, body, { emit: false });
    assert.deepEqual(a.position, b.position);
    assert.deepEqual(a.velocity, b.velocity);
  }
  near(a.velocity[0], -10);
  near(a.velocity[2], 2);
  assert.deepEqual(Array.from(a.launches.slice(0, 3)), [-10, 4, 2]);
});
test("new drops follow the new heading while previously emitted drops keep their velocity", () => {
  const p = new BallisticSpray(2048);
  p.advance(0.1, body, {
    tuning: { ...sprayDefaults, spraySpread: 0, sprayInheritance: 0 },
  });
  const initial = p.cursor,
    old = Array.from(p.velocity.slice(0, 3));
  p.advance(
    0.1,
    { ...body, angle: Math.PI / 2, vx: 0, vz: 20 },
    { tuning: { ...sprayDefaults, spraySpread: 0, sprayInheritance: 0 } },
  );
  near(p.velocity[0], old[0]);
  near(p.velocity[2], old[2]);
  assert.ok(p.cursor > initial);
  p.advance(
    0.05,
    { ...body, angle: Math.PI / 2, vx: 0, vz: 20 },
    { tuning: { ...sprayDefaults, spraySpread: 0, sprayInheritance: 0 } },
  );
  const i = (p.cursor - 1) % p.limit;
  assert.ok(p.launches[i * 4 + 2] < -20);
  assert.ok(Math.abs(p.launches[i * 4]) < 0.1);
});
test("water intersection retires airborne state once and produces a brief world-space contact", () => {
  const p = new BallisticSpray(32, { surfaceAt: () => 0.25 });
  p.emit({ px: 4, py: 0.27, pz: 3, vx: -2, vy: -4, vz: 1 }, 3);
  p.advance(1 / 60, body, {
    emit: false,
    tuning: { ...sprayDefaults, spraySplash: 150 },
  });
  assert.equal(p.count, 0);
  assert.equal(p.impactCount, 1);
  near(p.splashes[1], 0.25);
  assert.ok(p.splashes[0] < 4);
  assert.ok(p.splashes[2] > 3);
  near(p.splashes[4], 1.5);
  p.advance(0.1, { ...body, angle: 2 }, { emit: false });
  assert.equal(p.impactCount, 1);
  const land = new BallisticSpray(32, { isWater: () => false });
  land.emit({ px: 0, py: 0.001, pz: 0, vx: 0, vy: -2, vz: 0 }, 2);
  land.integrate(0.01, -9.8, 1);
  assert.equal(land.count, 0);
  assert.equal(land.impactCount, 0);
});
test("30/60/120 Hz input advances the same fixed-step world simulation", () => {
  const runs = [30, 60, 120].map((hz) => {
    const p = new BallisticSpray(2048);
    for (let n = 1; n <= hz * 2; n++)
      p.advance(
        1 / hz,
        { ...body, x: (20 * n) / hz },
        { tuning: { ...sprayDefaults, spraySpread: 0 } },
      );
    return p;
  });
  for (const p of runs.slice(1)) {
    assert.equal(p.cursor, runs[0].cursor);
    assert.equal(p.count, runs[0].count);
    for (let n = 0; n < p.count; n++) {
      const i = p.active[n];
      for (let axis = 0; axis < 3; axis++)
        near(p.position[i * 3 + axis], runs[0].position[i * 3 + axis], 0.002);
    }
  }
});
test("all eight spray controls affect their intended calculation", () => {
  const f = updateSprayFrame(createSprayFrame(), body),
    base = jetLaunch({}, f, 20, 1, 1, 0.7, 1, sprayDefaults);
  assert.ok(
    jetLaunch({}, f, 20, 1, 1, 0.7, 1, {
      ...sprayDefaults,
      sprayLaunchSpeed: 50,
    }).vx < base.vx,
  );
  assert.ok(
    jetLaunch({}, f, 20, 1, 1, 0.7, 1, { ...sprayDefaults, sprayUpAngle: 40 })
      .vy > base.vy,
  );
  assert.ok(
    jetLaunch({}, f, 20, 1, 1, 0.7, 1, {
      ...sprayDefaults,
      sprayInheritance: 0,
    }).vx < base.vx,
  );
  assert.ok(
    Math.abs(
      jetLaunch({}, f, 20, 1, 1, 0.7, 1, { ...sprayDefaults, spraySpread: 15 })
        .vz,
    ) > Math.abs(base.vz),
  );
  const light = new BallisticSpray(128),
    heavy = new BallisticSpray(128);
  for (const p of [light, heavy]) p.emit(drop, 5);
  light.advance(0.1, body, {
    emit: false,
    tuning: { ...sprayDefaults, sprayGravity: 0.5 },
  });
  heavy.advance(0.1, body, {
    emit: false,
    tuning: { ...sprayDefaults, sprayGravity: 2 },
  });
  assert.ok(heavy.position[1] < light.position[1]);
  const sparse = new BallisticSpray(2048),
    dense = new BallisticSpray(2048);
  for (let n = 0; n < 60; n++) {
    sparse.advance(1 / 60, body, {
      tuning: { ...sprayDefaults, sprayDensity: 50 },
    });
    dense.advance(1 / 60, body, {
      tuning: { ...sprayDefaults, sprayDensity: 150 },
    });
  }
  assert.ok(dense.cursor > sparse.cursor * 2.5);
  const short = new BallisticSpray(8),
    long = new BallisticSpray(8);
  short.emit(drop, 0.3);
  long.emit(drop, 3);
  short.advance(0.1, body, { emit: false });
  for (let n = 0; n < 4; n++) {
    short.advance(0.1, body, { emit: false });
    long.advance(0.1, body, { emit: false });
  }
  assert.equal(short.count, 0);
  assert.equal(long.count, 1);
});
test("spray settings migrate additively, persist, export and reset without changing other tuning", () => {
  const data = new Map([
      [
        settingsKey,
        JSON.stringify({
          schemaVersion: 3,
          settings: {
            top: 149,
            drift: 72,
            masterVolume: 35,
            physicsPreset: "custom",
          },
          legacy: { future: 17 },
        }),
      ],
    ]),
    storage = {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    },
    s = new SettingsStore(storage);
  for (const [id, c] of Object.entries(sprayControls)) s.set(id, c.max);
  s.flush();
  const restored = new SettingsStore(storage);
  for (const [id, c] of Object.entries(sprayControls))
    assert.equal(restored.values[id], c.max);
  const portable = s.exportText();
  restored.resetSpray();
  for (const [id, value] of Object.entries(sprayDefaults))
    assert.equal(restored.values[id], value);
  assert.equal(restored.values.top, 149);
  assert.equal(restored.values.drift, 72);
  assert.equal(restored.values.masterVolume, 35);
  assert.equal(restored.legacy.future, 17);
  restored.importText(portable);
  assert.equal(restored.values.sprayLaunchSpeed, 60);
  s.flush();
  restored.flush();
});
test("bounded pools stay finite through repeated spins and water impacts", () => {
  const p = new BallisticSpray(256);
  for (let n = 0; n < 600; n++)
    p.advance(
      1 / 60,
      {
        ...body,
        angle: n * 0.4,
        vx: 20 * Math.cos(n * 0.4),
        vz: 20 * Math.sin(n * 0.4),
      },
      { tuning: { ...sprayDefaults, sprayDensity: 200, sprayGravity: 2 } },
    );
  assert.ok(p.count <= 256);
  assert.ok(p.impactCount > 0);
  for (const a of [p.position, p.velocity, p.launches, p.splashes])
    assert.ok(a.every(Number.isFinite));
});
