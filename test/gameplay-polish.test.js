import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignAdventure } from "../src/campaign-world.js";
import {
  validateCourse,
  validateCampaign,
  validateArrow,
} from "../src/course-validation.js";
import * as THREE from "three";
import { GameplaySettings } from "../src/gameplay-settings.js";
import { WaterGuidance, guidanceWindow } from "../src/water-guidance.js";
import { RacingCameraSettings } from "../src/racing-camera-settings.js";
import { protectGameplayGestures } from "../src/gameplay-gestures.js";
import { stepBoat, settings } from "../src/physics.js";
import { Race } from "../src/race.js";
const w = createCampaignAdventure();
test("all course checkpoints follow the intended ordered route and reject reverse crossings", () => {
  for (const c of w.courses) {
    assert.equal(validateCourse(c).valid, true);
    for (let i = 0; i < c.gates.length; i++) {
      const g = c.gates[i],
        race = new Race(c.gates, 7, 3);
      race.next = i;
      const before = { x: g.x + g.tx, z: g.z + g.tz },
        after = { x: g.x - g.tx, z: g.z - g.tz };
      race.step(before, after, 0.1, settings);
      assert.equal(race.next, i);
      assert.equal(race.check.code, "wrong-direction");
      race.step(after, before, 0.1, settings);
      assert.equal(race.next, i === 0 ? 1 : (i + 1) % c.gates.length);
    }
  }
});
test("validation detects flipped vectors, missing edge references, bad gate order and disconnected transitions", () => {
  const c = w.courses[0],
    gates = c.gates.map((g) => ({ ...g }));
  gates[1].tx *= -1;
  gates[1].tz *= -1;
  gates[2].edgeId = "missing";
  gates[3].distance = gates[2].distance - 1;
  const bad = {
    ...c,
    gates,
    legs: c.legs.map((l, i) => (i ? l : { ...l, to: "missing" })),
  };
  const codes = validateCourse(bad).issues.map((i) => i.code);
  for (const code of [
    "reversed-checkpoint",
    "missing-checkpoint-edge",
    "checkpoint-order",
    "invalid-route-transition",
  ])
    assert.ok(codes.includes(code));
});
test("navigation follows the next required route visit through a crossing, not a nearer opposing branch", () => {
  const c = w.courses[0],
    g = c.gates[7],
    tour = { phase: "RACE", venue: c, race: { gates: c.gates, next: 7 } },
    boat = { x: g.x, z: g.z };
  const a = guidanceWindow(tour, boat, null, { ahead: 60 }),
    b = guidanceWindow(tour, boat, { wrong: true }, { ahead: 60 });
  assert.ok(a.start <= g.distance + 0.01);
  assert.ok(b.start <= g.distance - 10);
  for (let d = b.start; d < b.end; d += 4) {
    const p = c.sample(d);
    assert.equal(validateArrow(c, p), true);
    assert.equal(validateArrow(c, { ...p, tx: -p.tx, tz: -p.tz }), false);
  }
});
test("merged water has no phantom hull boundary while real land and shoreline still collide", () => {
  const x = -107,
    z = 8,
    p = w.nearest(x, z);
  assert.ok(Math.hypot(x - p.x, z - p.z) > p.hullLimit);
  assert.equal(w.collisionNearest(x, z).collision.depth, 0);
  const b = { x, z, angle: 0, vx: 0, vz: 0 };
  stepBoat(b, { throttle: 0, steering: 0 }, 1 / 120, w.collisionNearest);
  assert.ok(Math.hypot(b.x - x, b.z - z) < 0.001);
  const land = { x: -125, z: 8, angle: 0, vx: 2, vz: 0 };
  stepBoat(land, { throttle: 0, steering: 0 }, 1 / 120, w.collisionNearest);
  assert.ok(Math.hypot(land.x + 125, land.z - 8) > 1);
  assert.ok(land.bankDepth > 0);
});
test("deep course validation excludes overlap edges and retains connected channel boundaries", () => {
  const reports = validateCampaign(w, { deep: true });
  assert.ok(
    reports.every((r) => r.valid),
    JSON.stringify(reports),
  );
  assert.ok(
    reports.reduce((n, r) => n + r.collisionJoins.excludedInternal, 0) > 0,
  );
});
test("manual zoom persists and Auto-Fit explicitly restores automatic framing without overwriting other courses", () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    s = new RacingCameraSettings(storage);
  s.use(w.courses[0].id);
  s.set("flat", "distance", 65);
  s.set("flat", "zoom", 2.5);
  assert.equal(s.values.flat.framing, "manual");
  const copy = new RacingCameraSettings(storage);
  copy.use(w.courses[0].id);
  assert.equal(copy.values.flat.zoom, 2.5);
  assert.equal(copy.values.flat.distance, 65);
  copy.use(w.courses[1].id);
  assert.equal(copy.values.flat.zoom, 1);
  copy.use(w.courses[0].id);
  copy.autoFit();
  assert.equal(copy.values.flat.framing, "auto");
  assert.equal(copy.values.flat.zoom, 1);
});
test("Safari gesture fallback cancels every rapid gameplay tap but never installs document/menu handlers", () => {
  const game = new EventTarget(),
    menu = new EventTarget();
  const cleanup = protectGameplayGestures(game);
  for (let i = 0; i < 20; i++)
    for (const type of [
      "touchstart",
      "touchend",
      "gesturestart",
      "gesturechange",
      "dblclick",
      "selectstart",
      "contextmenu",
    ]) {
      const a = new Event(type, { cancelable: true }),
        b = new Event(type, { cancelable: true });
      game.dispatchEvent(a);
      menu.dispatchEvent(b);
      assert.equal(a.defaultPrevented, true);
      assert.equal(b.defaultPrevented, false);
    }
  cleanup();
  const e = new Event("touchend", { cancelable: true });
  game.dispatchEvent(e);
  assert.equal(e.defaultPrevented, false);
});

test("bank contact correction is continuous across a merged-channel joint", () => {
  let previous = null;
  for (let z = 6; z < 10; z += 0.02) {
    const p = w.collisionNearest(-105.8, z),
      c = p.collision ?? p,
      depth = Math.max(
        0,
        Math.hypot(-105.8 - c.x, z - c.z) - (c.hullLimit ?? 6.5),
      );
    if (previous !== null) assert.ok(Math.abs(depth - previous) < 0.12);
    previous = depth;
  }
});

test("rendered chevrons stay anchored to route metres, face forward and clear the water", () => {
  const store = new GameplaySettings({ getItem: () => null, setItem() {} }),
    scene = new THREE.Scene(),
    guidance = new WaterGuidance(scene, store, (_x, _z, _t, out) =>
      Object.assign(out, { height: 1, wake: 0.2 }),
    ),
    c = w.courses[0],
    tour = { phase: "RACE", venue: c, race: { next: 3 } },
    p = c.sample(c.gates[2].distance + 4);
  guidance.update(0.1, tour, p, null, 0, true);
  const first = guidance.samples.map((s) => s.distance);
  assert.ok(first.length > 3);
  for (let i = 0; i < guidance.samples.length; i++) {
    const sample = guidance.samples[i],
      m = new THREE.Matrix4();
    guidance.mesh.getMatrixAt(i, m);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(m);
    assert.ok(forward.x * sample.tx + forward.z * sample.tz > 0.99);
    assert.ok(m.elements[13] >= 1.45);
    assert.ok(
      Math.abs(
        sample.distance / store.values.arrows.spacing -
          Math.round(sample.distance / store.values.arrows.spacing),
      ) < 1e-8,
    );
  }
  const p2 = c.sample(p.distance + 0.05);
  guidance.update(0.1, tour, p2, null, 0.1, true);
  assert.deepEqual(
    guidance.samples.map((s) => s.distance),
    first,
  );
  store.set("arrows", "size", 3.4);
  store.set("color", null, "#d9ac46");
  const restored = new GameplaySettings({
    getItem: () => JSON.stringify({ schema: 1, values: store.values }),
  });
  assert.equal(restored.values.arrows.size, 3.4);
  restored.reset("arrows");
  assert.equal(restored.values.color, "#e8d9b5");
});
