import { tuneIdentifier } from "../src/replay/course-data.js";
import { handlingDefaults } from "../src/handling.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { createRiverLevels, RiverRunProgress } from "../src/river-levels.js";
import { RiverRunTour } from "../src/river-run.js";
import {
  riverJumpSites,
  safeJumpFlight,
  flightPitch,
} from "../src/river-jumps.js";
import { BoatPresentation } from "../src/boat-presentation.js";
import { calmHeight } from "../src/calm-water.js";
import {
  riverEnvironmentData,
  resolveLogContacts,
} from "../src/river-environment-data.js";
import { RiverEnvironment } from "../src/river-environment.js";
import { BallisticSpray } from "../src/ballistic-spray.js";
import { RacingCameras } from "../src/cameras.js";
import { CameraSettings } from "../src/camera-settings.js";
import { CampaignCameras } from "../src/racing-camera-manager.js";
import { RacingCameraSettings } from "../src/racing-camera-settings.js";
const memory = () => ({ getItem: () => null, setItem() {} }),
  world = createCampaignAdventure(),
  levels = createRiverLevels(world);
test("all nine actual ramp crossings keep the rendered boat finite through takeoff, apex and landing in every camera", () => {
  for (const [index, leg] of world.legs.entries())
    for (const j of riverJumpSites(leg)) {
      const tour = new RiverRunTour(
        world,
        levels,
        new RiverRunProgress(memory(), levels),
      );
      tour.resume(index);
      const c = tour.leaf;
      c.elapsed = 0;
      const p = leg.river.sample(j.distance),
        offset = j.offset * j.side,
        b = {
          x: p.x - p.tz * offset + p.tx * 0.2,
          z: p.z + p.tx * offset + p.tz * 0.2,
          vx: p.tx * 20,
          vz: p.tz * 20,
          angle: Math.atan2(p.tz, p.tx),
          yawRate: 0.1,
        },
        before = { x: b.x - p.tx * 0.4, z: b.z - p.tz * 0.4 };
      c.step(before, b, 1 / 120);
      assert.equal(c.airborne, true, `${index}/${j.id}`);
      assert.ok(Number.isFinite(tour.verticalVelocity));
      const model = new THREE.Group(),
        presentation = new BoatPresentation(model, { fixedStep: true }),
        preferences = new CameraSettings(memory()),
        legacy = new RacingCameras(new THREE.PerspectiveCamera(), preferences),
        manager = new CampaignCameras(
          new THREE.PerspectiveCamera(),
          legacy,
          new RacingCameraSettings(memory()),
          world,
        );
      manager.resize(844, 390);
      legacy.resize(844, 390);
      let peak = 0,
        frames = 0;
      while (c.airborne && frames++ < 300) {
        c.beforePhysics(b, 1 / 120);
        presentation.update(b, {}, 1 / 120, frames / 120, 3000, 85, tour);
        model.updateMatrixWorld(true);
        assert.ok(model.matrixWorld.elements.every(Number.isFinite));
        assert.equal(model.visible, true);
        assert.equal(
          model.position.y,
          -0.12 + presentation.motion.heave + tour.height,
        );
        peak = Math.max(peak, c.height);
        const auto = manager.update(b, model, b, 1 / 120, {
          playing: true,
          top: 85,
          tour,
        });
        assert.ok(auto.position.toArray().every(Number.isFinite));
        for (const mode of ["classic", "chase", "cockpit", "overhead"]) {
          preferences.use?.(mode);
          preferences.mode = mode;
          const cam = legacy.update(b, model, b, 1 / 120, { playing: true });
          assert.ok(cam.matrixWorld.elements.every(Number.isFinite), mode);
        }
      }
      assert.ok(peak > 0.4);
      assert.equal(c.airborne, false);
      assert.ok(c.landed);
      assert.ok(c.landingSpeed > 3);
      assert.equal(c.height, 0);
      assert.ok(frames < 300);
    }
});
test("unsafe high-speed launches are bypassed rather than flinging the boat outside navigable water", () => {
  const l = world.legs[0],
    p = l.river.sample(170);
  assert.equal(
    safeJumpFlight(l, { x: p.x, z: p.z, vx: 300, vz: 0 }, 8, 5),
    false,
  );
  assert.equal(flightPitch(undefined, 20, true), 0);
});
test("calm water stays low-amplitude and changes slowly without coordinate tile resets", () => {
  let max = 0,
    motion = 0;
  for (let x = -1000; x < 1000; x += 13)
    for (let z = -200; z < 200; z += 17) {
      const h = calmHeight(x, z, 0);
      max = Math.max(max, Math.abs(h));
      motion = Math.max(motion, Math.abs(h - calmHeight(x, z, 1)));
      assert.ok(Math.abs(h - calmHeight(x + 0.001, z, 0)) < 0.0001);
    }
  assert.ok(max < 0.014);
  assert.ok(motion < 0.001);
});
test("routes, ramps and environment are deterministic; no new wood, rocks or wildlife block the racing line", () => {
  const other = createCampaignAdventure(),
    data = riverEnvironmentData(world);
  assert.deepEqual(riverEnvironmentData(other), data);
  assert.deepEqual(
    other.courses.map((c) => c.points.map((p) => [p.x, p.z])),
    world.courses.map((c) => c.points.map((p) => [p.x, p.z])),
  );
  assert.ok(data.logs.length > 12 && data.seals.length >= 3);
  for (const l of data.logs)
    for (const p of [l.a, l.b, l]) {
      const n = world.nearest(p.x, p.z);
      assert.ok(
        Math.hypot(p.x - n.x, p.z - n.z) >
          (n.hullLimit ?? 6.5) + 1.2 + l.radius,
      );
    }
  for (const r of data.boulders) {
    const n = world.nearest(r.x, r.z);
    assert.ok(
      Math.hypot(r.x - n.x, r.z - n.z) >= (n.waterWidth ?? 9) + r.radius + 1.99,
    );
  }
  for (const s of data.seals) {
    const n = world.nearest(s.x, s.z);
    assert.ok(Math.hypot(s.x - n.x, s.z - n.z) > (n.hullLimit ?? 6.5) + 2);
  }
});
test("log contact uses the visible capsule endpoints and severity while the central lane remains clear", () => {
  const logs = riverEnvironmentData(world).logs,
    l = logs[0],
    b = { x: l.x + 0.1, z: l.z, vx: -3, vz: 0, collisionImpulse: 0 };
  resolveLogContacts(b, logs);
  assert.ok(Math.hypot(b.x - l.x, b.z - l.z) >= l.radius + 1.2 - 0.001);
  const p = world.legs[0].river.sample(300),
    center = { x: p.x, z: p.z, vx: p.tx * 15, vz: p.tz * 15 },
    before = { ...center };
  resolveLogContacts(center, logs);
  assert.deepEqual(center, before);
});
test("seals surface, submerge and respect the saved wildlife-off setting without collision data", () => {
  const env = new RiverEnvironment(new THREE.Scene(), world),
    site = env.data.seals[0];
  for (let i = 0; i < 600; i++) env.update(1 / 60, site, { wildlife: "on" });
  assert.ok(env.active >= 0);
  assert.ok(env.seals.some((s) => s.group.visible));
  for (let i = 0; i < 400; i++) env.update(1 / 60, site, { wildlife: "on" });
  assert.equal(env.active, -1);
  env.update(0.1, site, { wildlife: "off" });
  assert.ok(env.seals.every((s) => !s.group.visible && !s.ripple.visible));
  assert.equal(world.debris, env.data.logs);
});
test("hard landings create bounded world-space spray bursts and stronger surface impacts", () => {
  const a = new BallisticSpray(256),
    b = new BallisticSpray(256),
    boat = { x: 3, z: 5, vx: 10, vz: 0 };
  a.landingBurst(boat, 1);
  b.landingBurst(boat, 4);
  assert.ok(b.count > a.count);
  assert.ok(b.count <= 96);
  assert.equal(b.splashes[4], 4);
  assert.ok([...b.position].every(Number.isFinite));
});

test("custom jump physics is a separate ghost force class while default old records stay compatible", () => {
  const base = tuneIdentifier(handlingDefaults);
  assert.equal(
    tuneIdentifier({
      ...handlingDefaults,
      jumpLaunchScale: 1,
      jumpGravityScale: 1,
    }),
    base,
  );
  assert.notEqual(
    tuneIdentifier({ ...handlingDefaults, jumpLaunchScale: 1.2 }),
    base,
  );
  assert.notEqual(
    tuneIdentifier({ ...handlingDefaults, jumpGravityScale: 0.8 }),
    base,
  );
  assert.equal(tuneIdentifier({ ...handlingDefaults, landingSplash: 2 }), base);
});
