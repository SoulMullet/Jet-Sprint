import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createArcadeWorld } from "../src/arcade/river-world.js";
import { ArcadeTuning, ARCADE_TUNING_KEY } from "../src/arcade/tuning.js";
import {
  ArcadeRecords,
  ArcadeRiverTour,
  ArcadeService,
  ARCADE_RECORD_KEY,
  applyArcadeControls,
} from "../src/arcade/run.js";
import { ArcadeCamera } from "../src/arcade/camera.js";
import { arcadeWaterGeometry } from "../src/arcade/water.js";
import { arcadeRamp, arcadeRampGeometry } from "../src/arcade/ramps.js";
import { driveArcade } from "../scripts/verify-arcade-route.mjs";
import { campaignDefinition } from "../src/campaign-data.js";
import { resolveLogContacts } from "../src/river-environment-data.js";
import { settings, stepBoat, PHYSICS_STEP } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (k) => values.get(k),
    setItem: (k, v) => values.set(k, v),
  };
};
test("continuous surface covers both full routes with upward faces and a bounded mobile mesh, independent of streaming", () => {
  const { world } = createArcadeWorld(),
    g = arcadeWaterGeometry(world);
  g.computeBoundingBox();
  assert.ok(g.boundingBox.min.z < -1530 && g.boundingBox.max.z >= 20);
  assert.ok(g.index.count / 3 < 10000 && g.attributes.position.count < 10000);
  assert.equal(g.attributes.uv.count, g.attributes.position.count);
  for (let i = 0; i < g.attributes.normal.count; i++)
    assert.ok(g.attributes.normal.getY(i) > 0.99);
  g.dispose();
});
test("new river has continuous water, an actual dry fork island, two wide ramps and valid shared route gates without changing racing definitions", () => {
  const old = JSON.stringify(campaignDefinition),
    { world, levels } = createArcadeWorld(),
    level = levels[0];
  assert.equal(JSON.stringify(campaignDefinition), old);
  assert.ok(world.river.length > 1900 && world.river.length < 2200);
  for (let d = level.startDistance; d < world.river.length; d += 5) {
    const p = world.river.sample(d),
      n = world.nearest(p.x, p.z);
    assert.ok(Math.hypot(p.x - n.x, p.z - n.z) < n.hullLimit);
  }
  const branch = world.shortcut;
  for (let d = 0; d < branch.path.length; d += 5) {
    const p = branch.path.sample(d),
      n = world.nearest(p.x, p.z);
    assert.ok(Math.hypot(p.x - n.x, p.z - n.z) < n.hullLimit);
  }
  const n = world.nearest(132, -885);
  assert.ok(
    Math.hypot(132 - n.x, -885 - n.z) > n.waterWidth,
    "A real island separates the safe bend and cut.",
  );
  assert.equal(world.legs[0].jumpSites.length, 2);
  for (const [i, j] of world.legs[0].jumpSites.entries()) {
    assert.equal(j.usableWidth, 39);
    assert.ok(
      Math.abs((j.halfWidth * 2) / j.usableWidth - (i === 0 ? 0.85 : 0.75)) <
        1e-10,
    );
    const g = arcadeRampGeometry(j);
    g.computeBoundingBox();
    assert.ok(Math.abs(g.boundingBox.max.z - j.halfWidth) < 0.00001);
    assert.ok(Math.abs(g.boundingBox.min.z + j.halfWidth) < 0.00001);
    assert.equal(g.boundingBox.min.x, -j.deckLength);
    assert.equal(g.boundingBox.max.x, 0);
    assert.ok(Math.abs(g.boundingBox.max.y - j.deckRise) < 0.00001);
    g.dispose();
  }
  const originalWidth = world.nearest;
  world.nearest = () => ({ waterWidth: 16, hullLimit: 13.5 });
  assert.equal(
    arcadeRamp(world, 210, 0.85, "narrower").halfWidth * 2,
    27 * 0.85,
  );
  world.nearest = originalWidth;
  assert.ok(
    world.debris.length >= 2 &&
      world.rocks.length >= 4 &&
      world.pickups.length >= 20,
  );
  assert.ok(
    level.checkpoints.every(
      (g) => g.distance < branch.start - 12 || g.distance > branch.end + 25,
    ),
  );
});
test("both live Arcade ramp definitions launch and land from left/centre/right 90%-width lanes with no log/bank snag", () => {
  Object.assign(settings, handlingDefaults);
  const proof = [];
  for (const rampIndex of [0, 1])
    for (const fraction of [-0.9, 0, 0.9]) {
      const { world, levels } = createArcadeWorld(),
        m = memory(),
        tuning = new ArcadeTuning(m),
        tour = new ArcadeRiverTour(
          world,
          levels,
          new ArcadeRecords(m, levels),
          tuning,
        ),
        service = new ArcadeService(tuning),
        jump = tour.leaf.jumpSites[rampIndex],
        p = jump.point,
        offset = fraction * jump.halfWidth,
        b = {
          x: p.x - p.tx * 14 - p.tz * offset,
          z: p.z - p.tz * 14 + p.tx * offset,
          angle: Math.atan2(p.tz, p.tx),
          vx: p.tx * 32,
          vz: p.tz * 32,
          pump: 1,
          nozzle: 0,
          yawRate: 0,
        };
      let launched = false,
        landed = false,
        impact = 0,
        minLandingSpeed = Infinity;
      for (let i = 0; i < 270; i++) {
        const before = { x: b.x, z: b.z };
        if (tour.beforePhysics(b, PHYSICS_STEP))
          stepBoat(
            b,
            { throttle: 1, steering: 0 },
            PHYSICS_STEP,
            world.collisionNearest,
            service.framing(),
          );
        tour.step(before, b, PHYSICS_STEP, settings, i * PHYSICS_STEP, {
          state: "RACING",
          startAt: 0,
        });
        launched ||= tour.airborne;
        landed ||= tour.landed;
        impact = Math.max(impact, b.collisionImpulse || 0);
        if (landed)
          minLandingSpeed = Math.min(minLandingSpeed, Math.hypot(b.vx, b.vz));
      }
      assert.equal(launched, true, `${rampIndex}/${fraction} launches`);
      assert.equal(landed, true, `${rampIndex}/${fraction} lands`);
      assert.equal(
        impact,
        0,
        `${rampIndex}/${fraction} no physical obstacle/bank contact`,
      );
      assert.ok(
        minLandingSpeed > 30,
        "Horizontal momentum survives water recontact",
      );
      proof.push({
        ramp: rampIndex,
        offset,
        launched,
        landed,
        impact,
        minLandingSpeed,
      });
    }
  assert.equal(proof.length, 6);
});
test("safe and shortcut finish through actual force/contact/jump simulation in 60–90 seconds; shortcut pays more pickup cash", () => {
  const safe = driveArcade(),
    cut = driveArcade(true);
  for (const r of [safe, cut]) {
    assert.equal(r.failure, "");
    assert.equal(r.done, true);
    assert.equal(r.checkpoints, r.required);
    assert.equal(r.jumps, 2);
    assert.ok(r.seconds >= 60 && r.seconds <= 90);
    assert.ok(r.condition > 0);
    assert.ok(r.maxHeight > 2 && r.maxHeight < 4);
  }
  assert.equal(safe.shortcut, false);
  assert.equal(cut.shortcut, true);
  assert.ok(cut.cash > safe.cash);
  assert.ok(cut.seconds < safe.seconds);
});
test("automatic control preset preserves steering, disables nitrous, and releases propulsion outside active racing", () => {
  const input = { steering: -0.6, throttle: 0, nitrous: true };
  applyArcadeControls(input, true, true, false);
  assert.equal(input.throttle, 1);
  assert.equal(input.steering, -0.6);
  assert.equal(input.nitrous, false);
  for (const args of [
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ]) {
    applyArcadeControls(input, ...args);
    assert.equal(input.throttle, 0);
    assert.equal(input.steering, -0.6);
  }
});
test("Arcade PB and tuning use isolated stable keys and never touch a seeded career/input/audio/camera save", () => {
  const m = memory();
  for (const k of [
    "jet-sprint-player-profile-v1",
    "jet-sprint-v8-settings",
    "jet-sprint-controls-v1",
    "jet-sprint-racing-cameras-v2",
  ])
    m.setItem(k, "existing-" + k);
  const original = new Map(m.values),
    { world, levels } = createArcadeWorld(),
    records = new ArcadeRecords(m, levels),
    tuning = new ArcadeTuning(m);
  records.complete(levels[0], 75, false);
  records.complete(levels[0], 80, false);
  assert.equal(new ArcadeRecords(m, levels).best(levels[0].id), 75);
  records.complete(levels[0], 70, true);
  assert.equal(records.best(levels[0].id), 75);
  tuning.set("steeringResponse", 1.4);
  tuning.set("distance", 29);
  const restored = new ArcadeTuning(m);
  assert.equal(restored.values.steeringResponse, 1.4);
  assert.equal(restored.values.distance, 29);
  restored.reset("camera");
  assert.equal(restored.values.distance, 24);
  assert.equal(restored.values.steeringResponse, 1.4);
  for (const [k, v] of original) assert.equal(m.getItem(k), v);
  assert.ok(m.getItem(ARCADE_RECORD_KEY) && m.getItem(ARCADE_TUNING_KEY));
  assert.ok(world.arcade);
  m.setItem(
    ARCADE_RECORD_KEY,
    JSON.stringify({ schema: 2, records: { future: true } }),
  );
  const future = m.getItem(ARCADE_RECORD_KEY),
    readOnly = new ArcadeRecords(m, levels);
  readOnly.complete(levels[0], 60, false);
  assert.equal(m.getItem(ARCADE_RECORD_KEY), future);
  assert.match(readOnly.warning, /Newer/);
});
test("pickup can be collected only once per run; restart restores pickups and health without paying a career wallet", () => {
  const { world, levels } = createArcadeWorld(),
    m = memory(),
    tuning = new ArcadeTuning(m),
    tour = new ArcadeRiverTour(
      world,
      levels,
      new ArcadeRecords(m, levels),
      tuning,
    ),
    p = world.pickups[0],
    b = {
      x: p.x,
      z: p.z,
      vx: 0,
      vz: 0,
      angle: 0,
      yawRate: 0,
      collisionImpulse: 0,
    };
  const start = { state: "RACING", startAt: 0 };
  tour.step(b, b, 1 / 120, settings, 1, start);
  const cash = tour.cash;
  assert.equal(cash, 25);
  tour.step(b, b, 1 / 120, settings, 1.01, start);
  assert.equal(tour.cash, cash);
  tour.condition = 25;
  tour.reset();
  assert.equal(tour.cash, 0);
  assert.equal(tour.condition, 100);
  assert.equal(tour.collected.size, 0);
  assert.equal(m.getItem("jet-sprint-player-profile-v1"), undefined);
});
test("failure stops the run without recording a PB and resets immediately; minor impacts have forgiving cooldown", () => {
  const { world, levels } = createArcadeWorld(),
    m = memory(),
    tuning = new ArcadeTuning(m),
    tour = new ArcadeRiverTour(
      world,
      levels,
      new ArcadeRecords(m, levels),
      tuning,
    ),
    p = levels[0].start,
    b = {
      x: p.x,
      z: p.z,
      vx: 0,
      vz: 0,
      angle: p.heading,
      yawRate: 0,
      collisionImpulse: 25,
    },
    start = { state: "RACING", startAt: 0 };
  tour.step(b, b, 0.01, settings, 0.01, start);
  const after = tour.condition;
  tour.step(b, b, 0.01, settings, 0.02, start);
  assert.equal(tour.condition, after);
  let transition;
  for (let i = 0; i < 6 && !tour.done; i++) {
    b.collisionImpulse = 40;
    transition = tour.step(b, b, 1, settings, 1 + i, start);
  }
  assert.equal(transition, "arcade-failed");
  assert.ok(tour.failed);
  assert.equal(tour.progress.best(levels[0].id), null);
  tour.reset();
  assert.equal(tour.done, false);
  assert.equal(tour.failed, "");
});
test("logs collide at water contact but a genuine high flight clears them, without changing default contact behavior", () => {
  const { world } = createArcadeWorld(),
    log = world.debris[0],
    b = {
      x: log.x + log.tz * 0.5,
      z: log.z - log.tx * 0.5,
      vx: -log.tz * 12,
      vz: log.tx * 12,
    };
  const air = { ...b };
  resolveLogContacts(air, [log], 3);
  assert.deepEqual(air, b);
  resolveLogContacts(b, [log]);
  assert.ok(b.collisionImpulse > 0);
});
test("Arcade chase resizes, follows turns and jumps smoothly and never changes boat state or ordinary camera settings", () => {
  const { world, levels } = createArcadeWorld(),
    m = memory(),
    tuning = new ArcadeTuning(m),
    tour = new ArcadeRiverTour(
      world,
      levels,
      new ArcadeRecords(m, levels),
      tuning,
    ),
    camera = new THREE.PerspectiveCamera(60, 1, 0.5, 6000),
    chase = new ArcadeCamera(camera, tuning),
    b = { x: 0, z: -20, vx: 0, vz: -30, angle: -Math.PI / 2 },
    model = {};
  chase.resize(844, 390);
  const before = JSON.stringify(b);
  chase.update(b, model, tour, 1 / 60);
  assert.equal(JSON.stringify(b), before);
  const initial = camera.position.clone();
  for (let i = 0; i < 120; i++) {
    b.z -= 0.5;
    chase.update(b, model, tour, 1 / 60);
    assert.ok(camera.position.toArray().every(Number.isFinite));
  }
  assert.ok(camera.position.distanceTo(initial) > 40);
  assert.equal(camera.aspect, 844 / 390);
  chase.resize(390, 844);
  assert.equal(camera.aspect, 390 / 844);
  assert.equal(m.getItem(ARCADE_TUNING_KEY), undefined);
  const service = new ArcadeService(tuning);
  assert.equal(service.framing().topMph, 78);
  tuning.set("cruiseSpeed", 82);
  assert.equal(service.framing().topMph, 82);
});
