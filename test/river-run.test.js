import { PlayerCareer, CareerRiverProgress } from "../src/garage/career.js";
import { MaintenanceTuning } from "../src/garage/tuning.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignAdventure } from "../src/campaign-world.js";
import {
  createRiverLevels,
  RiverRunProgress,
  riverRunProgressKey,
  validateRiverLevels,
} from "../src/river-levels.js";
import { RiverRunTour } from "../src/river-run.js";
import { stepBoat, settings } from "../src/physics.js";
import { RaceStart } from "../src/race-start.js";
import { ControlInput } from "../src/control-input.js";
import { ControlSettings } from "../src/control-settings.js";
import { SpeedFraming } from "../src/speed-framing.js";
import {
  RacingCameraSettings,
  racingCameraKey,
  sanitizeCameraPreset,
} from "../src/racing-camera-settings.js";
import { ReplaySession } from "../src/replay/session.js";
import { ReplaySettings } from "../src/replay/settings.js";
import { ReplayRepository } from "../src/replay/storage.js";
import * as THREE from "three";
import { CampaignCameras } from "../src/racing-camera-manager.js";
import { RacingCameras } from "../src/cameras.js";
import { CameraSettings } from "../src/camera-settings.js";
const world = createCampaignAdventure(),
  levels = createRiverLevels(world);
const memory = () => {
  const map = new Map();
  return { map, getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
};
test("exactly the three existing bonus environments become primary open river levels", () => {
  assert.equal(levels.length, world.legs.length);
  assert.equal(levels.length, 3);
  for (const [level, i] of levels.map((l, i) => [l, i])) {
    assert.equal(level.environment, world.legs[i]);
    assert.equal(level.route, world.legs[i].river);
    assert.equal(level.checkpoints, world.legs[i].checkpoints);
    assert.equal(
      level.finish.distance,
      world.legs[i].checkpoints.at(-1).distance,
    );
    assert.ok(level.startDistance < level.checkpoints[0].distance);
    assert.ok(level.route.length > 1600);
    assert.equal(level.unlockRequirements.length, 0);
  }
  const p = new RiverRunProgress(memory(), levels),
    tour = new RiverRunTour(world, levels, p);
  assert.equal(tour.phase, "RIVER");
  assert.equal(tour.race.lapCount, 0);
  assert.deepEqual(tour.race.laps, []);
  assert.equal(tour.gateOpen, 1);
  assert.equal(tour.venue.closed, false);
  assert.equal(tour.level, levels[0]);
});
test("river personal bests persist under a new key without changing archived campaign or tuning data", () => {
  const store = memory();
  for (const [k, v] of [
    ["jet-sprint-campaign-v2", "legacy wallet and records"],
    ["jet-sprint-settings", "physics tune"],
    ["jet-sprint-controls-v1", "Xbox controls"],
  ])
    store.setItem(k, v);
  const p = new RiverRunProgress(store, levels);
  p.complete(levels[0], 110);
  p.complete(levels[0], 105);
  p.complete(levels[0], 120);
  const restored = new RiverRunProgress(store, levels);
  assert.equal(restored.best(levels[0].id), 105);
  assert.equal(restored.values.records[levels[0].id].recent, 120);
  assert.equal(restored.values.records[levels[0].id].completions, 3);
  assert.equal(
    store.getItem("jet-sprint-campaign-v2"),
    "legacy wallet and records",
  );
  assert.equal(store.getItem("jet-sprint-settings"), "physics tune");
  assert.equal(store.getItem("jet-sprint-controls-v1"), "Xbox controls");
  assert.ok(store.getItem(riverRunProgressKey));
  restored.complete(levels[1], 100, true);
  assert.equal(restored.best(levels[1].id), null);
});
test("river save failures keep the result in memory and permit retry", () => {
  let fail = true;
  const store = memory(),
    set = store.setItem;
  store.setItem = (k, v) => {
    if (fail) throw Error("quota");
    set(k, v);
  };
  const p = new RiverRunProgress(store, levels);
  p.complete(levels[0], 100);
  assert.equal(p.best(levels[0].id), 100);
  assert.ok(p.warning);
  fail = false;
  assert.equal(p.retry(), true);
  assert.equal(new RiverRunProgress(store, levels).best(levels[0].id), 100);
});
test("standalone river start, finish and restart never enter a circuit or require a lap", async (t) => {
  const store = memory(),
    career = new PlayerCareer(store, levels, new MaintenanceTuning(store)),
    progress = new CareerRiverProgress(career);
  world.riverRunLevels = levels;
  for (const level of levels) {
    const tour = new RiverRunTour(world, levels, progress);
    tour.resume(level.index);
    tour.begin();
    const start = new RaceStart();
    start.begin(0, 2);
    const b = {
        x: level.start.x,
        z: level.start.z,
        angle: level.start.heading,
        vx: 0,
        vz: 0,
        pump: 0,
        nozzle: 0,
        yawRate: 0,
      },
      processor = new ControlInput(new ControlSettings(memory())),
      repo = new ReplayRepository(null),
      replays = new ReplaySession({
        world,
        repository: repo,
        preferences: new ReplaySettings(memory()),
        getTuning: () => settings,
        build: "river-test",
      }),
      motion = { roll: 0, pitch: 0, heave: 0 };
    let now = 0;
    for (let i = 0; i < 120 * 600 && !tour.done; i++) {
      const dt = 1 / 120;
      now += dt;
      start.update(now);
      if (start.state !== "RACING") {
        assert.equal(tour.elapsed, 0);
        continue;
      }
      const cue = tour.cue(b, dt, {}),
        g = level.checkpoints[tour.checkpoint],
        prev = tour.checkpoint
          ? level.checkpoints[tour.checkpoint - 1].distance
          : level.definition.gateDistance,
        p = level.route.project(b, Math.max(0, prev - 8), g.distance + 20),
        target = cue.wrong
          ? { x: cue.targetX, z: cue.targetZ }
          : level.route.sample(Math.min(g.distance + 2, p.distance + 10)),
        error = Math.atan2(
          Math.sin(Math.atan2(target.z - b.z, target.x - b.x) - b.angle),
          Math.cos(Math.atan2(target.z - b.z, target.x - b.x) - b.angle),
        ),
        speed = Math.hypot(b.vx, b.vz);
      processor.set(
        "gamepad",
        Math.max(-1, Math.min(1, (error - (b.yawRate || 0) * 0.3) * 4)),
        Number(speed < 15 || (Math.abs(error) > 0.35 && speed < 12)),
        true,
      );
      const input = processor.update(dt, speed / (settings.top / 3.6)),
        before = { x: b.x, z: b.z };
      replays.beforeStep(tour, b, motion, input, start);
      if (tour.beforePhysics(b, dt))
        stepBoat(b, input, dt, world.collisionNearest, career.framing());
      const change = tour.step(before, b, dt, settings, now, start);
      replays.afterStep(tour, b, motion, input, change, dt);
      assert.equal(tour.phase, "RIVER");
      assert.equal(tour.race.laps.length, 0);
      assert.ok(Math.hypot(b.x - before.x, b.z - before.z) < 1);
      if (change === "river-complete") start.finish();
    }
    assert.equal(tour.done, true, JSON.stringify(tour.inspect()));
    assert.equal(tour.checkpoint, level.checkpoints.length);
    const total = tour.elapsed;
    assert.ok(total > 60 && total < 300);
    assert.equal(progress.best(level.id), total);
    assert.ok(tour.reward.valid, JSON.stringify(tour.reward));
    assert.ok(career.profile.cash > 600);
    assert.ok(career.profile.boat.fuel < 100);
    assert.equal(
      JSON.parse(store.getItem("jet-sprint-player-profile-v1")).boat.fuel,
      career.profile.boat.fuel,
    );
    await replays.flush();
    assert.equal(replays.lastCompleted.meta.course.id, level.id);
    assert.equal(replays.lastCompleted.official.total, total);
    assert.deepEqual(replays.lastCompleted.official.laps, []);
    assert.equal(
      replays.lastCompleted.official.splits.length,
      level.checkpoints.length,
    );
    for (let i = 0; i < 10; i++)
      tour.step(b, b, 0.01, settings, now + i * 0.01, start);
    assert.equal(tour.elapsed, total);
    assert.equal(progress.values.records[level.id].completions, 1);
    tour.reset(level.index);
    assert.equal(tour.elapsed, 0);
    assert.equal(tour.checkpoint, 0);
    assert.equal(tour.done, false);
    assert.equal(tour.level.id, level.id);
    assert.equal(tour.leaf.gateOpen, 1);
    t.diagnostic(
      JSON.stringify({
        level: level.name,
        environment: level.environmentId,
        time: total,
        checkpoints: level.checkpoints.length,
        noLaps: true,
        replaySaved: true,
      }),
    );
  }
});
test("speed framing uses actual speed, reaches twenty percent and eight degrees, then returns smoothly", () => {
  const p = sanitizeCameraPreset().river,
    s = new SpeedFraming();
  for (let i = 0; i < 100; i++) s.update(0, 85, 0.05, p);
  assert.equal(s.output.distanceScale, 1);
  assert.equal(s.output.fovExtra, 0);
  let previous = 1;
  for (let i = 0; i < 200; i++) {
    s.update(85 / 3.6, 85, 0.05, p);
    assert.ok(
      s.output.distanceScale >= previous - 1e-12 &&
        s.output.distanceScale <= 1.2,
    );
    previous = s.output.distanceScale;
  }
  assert.ok(Math.abs(s.output.distanceScale - 1.2) < 1e-7);
  assert.ok(Math.abs(s.output.fovExtra - 8) < 1e-7);
  for (let i = 0; i < 200; i++) {
    s.update(0, 85, 0.05, p);
    assert.ok(s.output.distanceScale <= previous + 1e-12);
    previous = s.output.distanceScale;
  }
  assert.ok(Math.abs(s.output.distanceScale - 1) < 1e-7);
  assert.ok(s.output.fovExtra < 1e-6);
  s.reset();
  assert.equal(s.output.distanceScale, 1);
});
test("speed pullback is frame-rate independent, respects thresholds, drift/reverse speed and disable", () => {
  const p = sanitizeCameraPreset().river,
    outputs = [];
  for (const hz of [30, 60, 120]) {
    const s = new SpeedFraming();
    for (let i = 0; i < hz * 2; i++) s.update(85 / 3.6, 85, 1 / hz, p);
    outputs.push({ ...s.output });
  }
  for (const r of outputs) {
    assert.ok(Math.abs(r.distanceScale - outputs[0].distanceScale) < 1e-12);
    assert.ok(Math.abs(r.fovExtra - outputs[0].fovExtra) < 1e-12);
  }
  const s = new SpeedFraming();
  s.update(p.speedThreshold / 3.6, 85, 10, p);
  assert.equal(s.output.distanceScale, 1);
  s.update(85 / 3.6, 85, 10, { ...p, speedZoom: 0 });
  assert.equal(s.output.distanceScale, 1);
});
test("camera migration preserves old custom pullback and other presets while adding safe defaults", () => {
  const store = memory();
  store.setItem(
    racingCameraKey,
    JSON.stringify({
      schema: 2,
      courses: {
        "kowhai-sprint-park": {
          river: {
            speedIntensity: 0.33,
            height: 42,
            distance: 31,
            speedZoom: 1,
          },
          flat: { yaw: 35, zoom: 1.8 },
        },
      },
    }),
  );
  const s = new RacingCameraSettings(store);
  s.inherit("kowhai-sprint-park", levels[0].id);
  s.use(levels[0].id);
  assert.equal(s.values.river.speedPullback, 33);
  assert.equal(s.values.river.speedFovIncrease, 8);
  assert.equal(s.values.river.height, 42);
  assert.equal(s.values.flat.yaw, 35);
  s.set("river", "speedPullback", 25);
  s.set("river", "speedFovIncrease", 10);
  s.set("river", "distanceSmoothing", 0.6);
  const copy = new RacingCameraSettings(store);
  copy.use(levels[0].id);
  assert.equal(copy.values.river.speedPullback, 25);
  assert.equal(copy.values.river.speedFovIncrease, 10);
  copy.use("kowhai-sprint-park");
  assert.equal(copy.values.river.speedPullback, 33);
  assert.equal(copy.values.river.height, 42);
  assert.equal(sanitizeCameraPreset().river.speedPullback, 20);
});
test("actual follow camera gradually reaches the longer boom and wider FOV without using throttle", () => {
  const store = new RacingCameraSettings(memory()),
    manager = new CampaignCameras(
      new THREE.PerspectiveCamera(),
      { overviewCenter: { x: 0, z: 0 }, resize() {}, reset() {} },
      store,
      world,
    ),
    tour = new RiverRunTour(
      world,
      levels,
      new RiverRunProgress(memory(), levels),
    ),
    start = levels[0].start,
    b = { x: start.x, z: start.z, angle: start.heading, vx: 0, vz: 0 },
    model = new THREE.Group();
  model.position.set(b.x, -0.12, b.z);
  manager.resize(844, 390);
  let camera = manager.update(b, model, b, 0, { top: 85, playing: true, tour }),
    base = camera.position.distanceTo(new THREE.Vector3(b.x, 0, b.z));
  assert.equal(camera.fov, 55);
  b.vx = (start.tx * 85) / 3.6;
  b.vz = (start.tz * 85) / 3.6;
  for (let i = 0; i < 1200; i++)
    camera = manager.update(b, model, b, 1 / 120, {
      top: 85,
      playing: true,
      tour,
    });
  assert.ok(Math.abs(camera.fov - 63) < 1e-6);
  assert.ok(
    Math.abs(
      camera.position.distanceTo(new THREE.Vector3(b.x, 0, b.z)) / base - 1.2,
    ) < 1e-6,
  );
  b.vx = b.vz = 0;
  for (let i = 0; i < 2400; i++)
    camera = manager.update(b, model, b, 1 / 120, {
      top: 85,
      playing: true,
      tour,
    });
  assert.ok(Math.abs(camera.fov - 55) < 1e-6);
  assert.ok(
    Math.abs(
      camera.position.distanceTo(new THREE.Vector3(b.x, 0, b.z)) - base,
    ) < 1e-5,
  );
});
test("river route validation detects reversed gates, bad ordering and navigation direction", () => {
  assert.ok(validateRiverLevels(levels).every((r) => r.valid));
  const level = {
    ...levels[0],
    checkpoints: levels[0].checkpoints.map((g) => ({ ...g })),
  };
  level.checkpoints[1].tx *= -1;
  level.checkpoints[1].tz *= -1;
  level.checkpoints[2].distance = level.checkpoints[1].distance - 1;
  const arrow = level.route.sample(80);
  arrow.distance = 80;
  arrow.tx *= -1;
  arrow.tz *= -1;
  const report = validateRiverLevels([level], [arrow], level.id)[0];
  assert.equal(report.valid, false);
  for (const code of [
    "river-checkpoint-order",
    "reversed-river-checkpoint",
    "river-navigation-against-route",
  ])
    assert.ok(report.issues.some((i) => i.code === code));
});
test("crossing the finish backwards or before the ordered river gates does not complete the level", () => {
  const tour = new RiverRunTour(
      world,
      levels,
      new RiverRunProgress(memory(), levels),
    ),
    start = new RaceStart();
  start.begin(-2.65, 2);
  start.update(0);
  const finish = levels[0].finish,
    a = { x: finish.x - finish.tx, z: finish.z - finish.tz, vx: 0, vz: 0 },
    b = { ...a, x: finish.x + finish.tx, z: finish.z + finish.tz };
  tour.step(a, b, 0.01, settings, 0.01, start);
  assert.equal(tour.done, false);
  assert.equal(tour.checkpoint, 0);
  tour.leaf.checkpoint = levels[0].checkpoints.length - 1;
  tour.step(b, a, 0.01, settings, 0.02, start);
  assert.equal(tour.done, false);
  tour.step(a, b, 0.01, settings, 0.03, start);
  assert.equal(tour.done, true);
  assert.equal(tour.race.laps.length, 0);
});
test("the existing low chase mode also uses speed framing while retaining its low-speed preferences", () => {
  const preferences = new CameraSettings(memory());
  preferences.mode = "chase";
  const p = preferences.modes.chase,
    cameras = new RacingCameras(new THREE.PerspectiveCamera(), preferences),
    b = { x: 0, z: 0, angle: 0, vx: 0, vz: 0 },
    model = new THREE.Group(),
    ahead = { x: 12, z: 0 },
    frame = {
      playing: true,
      top: 85,
      speedFraming: sanitizeCameraPreset().river,
    };
  cameras.resize(844, 390);
  let camera = cameras.update(b, model, ahead, 0.01, frame);
  assert.ok(Math.abs(camera.fov - p.fov) < 1e-9);
  const low = camera.position.x;
  b.vx = 85 / 3.6;
  for (let i = 0; i < 1200; i++)
    camera = cameras.update(b, model, ahead, 1 / 120, frame);
  assert.ok(Math.abs(camera.fov - p.fov - 8) < 0.05);
  assert.ok(Math.abs(camera.position.x / low - 1.2) < 1e-5);
});
