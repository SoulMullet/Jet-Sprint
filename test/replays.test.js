import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  RaceRecorder,
  ReplayPlayer,
  SAMPLE_FIELDS,
  S,
  validateReplay,
  decodeReplay,
  sampleReplay,
  interpolateRow,
  compatibility,
  buildProgressIndex,
  timeAtProgress,
} from "../src/replay/model.js";
import { ReplayRepository, planRecording } from "../src/replay/storage.js";
import {
  createReplayMeta,
  captureRow,
  courseDescriptor,
  orderedProgress,
  tuneIdentifier,
  recordKey,
} from "../src/replay/course-data.js";
import { ReplaySettings, replaySettingsKey } from "../src/replay/settings.js";
import {
  GhostVisual,
  ReplayCameras,
  suspendVisuals,
} from "../src/replay/visual.js";
import { ReplaySession } from "../src/replay/session.js";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { CampaignTour } from "../src/campaign-tour.js";
import { handlingDefaults } from "../src/handling.js";
import { portableGameData } from "../src/portable-game-data.js";
import { RacingCameraSettings } from "../src/racing-camera-settings.js";
import { graphSeries, telemetryCSV } from "../src/replay/telemetry.js";
import { stepBoat, settings } from "../src/physics.js";
import { RaceStart } from "../src/race-start.js";
import { readFile } from "node:fs/promises";
const course = {
  id: "test-route",
  name: "Test course",
  kind: "race",
  index: 0,
  revision: "1-abcd",
  routeId: "prescribed",
  length: 100,
  gateCount: 2,
  lapCount: 1,
};
const makeRow = (t = 0) => [
  t,
  t * 2,
  0.25,
  Math.sin(t),
  0,
  Math.sin(t / 20),
  0,
  Math.cos(t / 20),
  2,
  0,
  Math.cos(t),
  0,
  0.1,
  0,
  0.7,
  -0.3,
  2,
  0.2,
  t / 10,
  t * 10,
  Math.min(1, Math.floor(t / 10)),
  t >= 10 ? 1 : t >= 5 ? 0 : 1,
];
function recording(id = "run-1", duration = 10, kind = "race") {
  const c = { ...course, kind, lapCount: kind === "river" ? 0 : 1 },
    meta = createReplayMeta(c, handlingDefaults, "test-build", "session-1", id),
    rec = new RaceRecorder(meta, 0.05);
  for (let i = 0; i <= 120 * duration; i++) {
    const t = i / 120,
      row = makeRow((t * 10) / duration);
    row[0] = t;
    if (kind === "river") {
      row[S.lap] = 0;
      row[S.checkpoint] = t >= duration ? 2 : t >= duration / 2 ? 1 : 0;
    }
    rec.push(t, row);
  }
  const splits = [
    {
      t: duration / 2,
      progress: 50,
      lap: kind === "race" ? 1 : 0,
      checkpoint: kind === "race" ? 1 : 0,
    },
    {
      t: duration,
      progress: 100,
      lap: kind === "race" ? 1 : 0,
      checkpoint: kind === "race" ? 0 : 1,
    },
  ];
  rec.event({ t: 0, type: kind === "race" ? "start" : "river-start" });
  for (const s of splits) rec.event({ ...s, type: "checkpoint" });
  rec.event({
    t: duration,
    type: kind === "race" ? "race-complete" : "river-complete",
  });
  return rec.finish({
    total: duration,
    laps: kind === "race" ? [duration] : [],
    splits,
  });
}
test("fixed-interval recordings are independent of render cadence and include the exact official finish", () => {
  const times = [1 / 30, 1 / 60, 1 / 120];
  for (const dt of times) {
    const rec = new RaceRecorder(
      createReplayMeta(course, handlingDefaults, "test", "s", "id"),
      0.05,
    );
    rec.push(0, makeRow());
    for (let t = dt; t < 10; t += dt) rec.push(t, makeRow(t));
    rec.push(10, makeRow(10));
    const base = recording(),
      r = rec.finish(base.official);
    assert.equal(r.samples.length, 201);
    for (const row of r.samples) {
      assert.ok(Math.abs(row[S.x] - row[0] * 2) < 1e-9);
      assert.ok(Math.abs(Math.hypot(...row.slice(4, 8)) - 1) < 1e-9);
    }
    assert.equal(r.samples.at(-1)[0], r.official.total);
  }
});
test("replay serialization and import/export preserve original snapshots, events and official splits", () => {
  const r = recording();
  assert.deepEqual(decodeReplay(JSON.stringify(r)), r);
  assert.equal(telemetryCSV(r).split("\n")[0], SAMPLE_FIELDS.join(","));
  assert.ok(graphSeries(r.samples, "speed", 0, 10).length <= 241);
});
test("quaternion interpolation takes the shortest arc and playback never calls physics", () => {
  const a = makeRow(),
    b = makeRow(1);
  b[4] = -a[4];
  b[5] = -a[5];
  b[6] = -a[6];
  b[7] = -a[7];
  const q = interpolateRow(a, b, 0.5);
  assert.ok(Math.abs(q[7] - 1) < 1e-9);
  const r = recording(),
    p = new ReplayPlayer(r);
  p.restart();
  p.advance(0.25);
  assert.ok(Math.abs(p.time - 0.25) < 1e-9);
  p.setSpeed(2);
  p.advance(0.5);
  assert.equal(p.time, 1.25);
  p.playing = false;
  p.advance(2);
  assert.equal(p.time, 1.25);
  p.seek(8.123);
  assert.ok(Math.abs(p.sample().x - 16.246) < 1e-8);
  for (const speed of [0.25, 0.5, 1, 2]) {
    p.setSpeed(speed);
    p.restart();
    p.advance(1);
    assert.equal(p.time, speed);
  }
  p.seek(100);
  assert.equal(p.time, 10);
  assert.equal(p.playing, false);
  assert.throws(() => p.setSpeed(9));
});
test("invalid, oversized, incomplete and incompatible replay files are rejected safely", () => {
  const r = recording();
  for (const mutate of [
    (x) => (x.version = 999),
    (x) => (x.complete = false),
    (x) => (x.samples[2][4] = 9),
    (x) => (x.samples[2][0] = 0),
    (x) => (x.samples[2][1] = Infinity),
    (x) => (x.official.laps = [11]),
    (x) => x.official.splits.pop(),
    (x) => (x.official.splits[0].checkpoint = 0),
    (x) => (x.events[0].type = "unknown"),
    (x) => (x.samples[0][S.throttle] = 2),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => validateReplay(bad));
  }
  assert.throws(() => decodeReplay("x".repeat(8 * 1024 * 1024 + 1)));
  assert.throws(() => decodeReplay("{"));
  assert.equal(compatibility(r, course, { tuneId: "different" }).ok, true);
  assert.match(
    compatibility(r, course, { tuneId: "different" }).warning,
    /tune/,
  );
  assert.equal(compatibility(r, { ...course, revision: "2" }).ok, false);
});
test("route-progress deltas distinguish repeated intersections and different laps, with exact split anchors", () => {
  const r = recording();
  r.meta.course.lapCount = 3;
  r.official = { total: 30, laps: [10, 10, 10], splits: [] };
  r.samples = [];
  for (let i = 0; i <= 600; i++) {
    const t = i * 0.05,
      row = makeRow(t);
    row[S.x] = 0;
    row[S.z] = 0;
    row[S.lap] = Math.min(3, Math.floor(t / 10));
    r.samples.push(row);
  }
  for (let i = 0; i < 6; i++)
    r.official.splits.push({
      t: (i + 1) * 5,
      progress: (i + 1) * 50,
      lap: Math.floor(i / 2) + 1,
      checkpoint: (i + 1) % 2,
    });
  const index = buildProgressIndex(r);
  assert.equal(timeAtProgress(index, 50), 5);
  assert.equal(timeAtProgress(index, 150), 15);
  assert.equal(timeAtProgress(index, 250), 25);
  assert.equal(timeAtProgress(index, 300), 30);
  assert.ok(Math.abs(timeAtProgress(index, 172) - 17.2) < 1e-8);
  assert.equal(timeAtProgress(index, 400), null);
});
test("river bonus recordings preserve checkpoint and original bonus timing", () => {
  const r = recording("river-1", 12, "river");
  assert.equal(r.official.laps.length, 0);
  assert.equal(r.official.total, 12);
  assert.equal(r.events[0].type, "river-start");
  assert.equal(r.samples.at(-1)[S.checkpoint], 2);
  assert.equal(new ReplayPlayer(r).seek(6).progress, 50);
});
test("personal best, previous run, fastest lap and splits persist atomically without overwriting old PB history", async () => {
  const repo = new ReplayRepository(null);
  const first = recording("first", 12),
    second = recording("second", 10),
    slow = recording("third", 14);
  await repo.commit(first);
  await repo.commit(second);
  await repo.commit(slow);
  const stats = (await repo.records())[0];
  assert.equal(stats.bestTotal, 10);
  assert.equal(stats.bestLap, 10);
  assert.equal(stats.bestReplayId, "second");
  assert.equal(stats.previousReplayId, "third");
  assert.equal(stats.bestSplits[0].t, 5);
  assert.deepEqual(await repo.get("first"), first);
  const imported = recording("imported", 8);
  await repo.commit(imported, { imported: true, pinned: true });
  assert.equal((await repo.records())[0].bestTotal, 10);
  assert.equal(
    (await repo.list()).find((c) => c.id === "first").wasPersonalBest,
    true,
  );
});
test("storage budget failures preserve PB data and protected files; explicit deletion retains official records", async () => {
  const repo = new ReplayRepository(null, { limits: { count: 1, bytes: 8e6 } }),
    first = recording("protected", 12);
  await repo.commit(first);
  await assert.rejects(repo.commit(recording("faster", 10)), /budget/);
  assert.equal((await repo.records())[0].bestTotal, 12);
  assert.deepEqual(await repo.get("protected"), first);
  await assert.rejects(repo.remove("protected"), /Confirm/);
  await repo.remove("protected", true);
  assert.equal((await repo.records())[0].bestTotal, 12);
  assert.equal((await repo.records())[0].bestReplayId, null);
  assert.equal((await repo.list()).length, 0);
});
test("duplicate imports never replace different recordings with the same ID; practice cleanup protects saved files", async () => {
  const repo = new ReplayRepository(null),
    r = recording();
  await repo.commit(r);
  const changed = structuredClone(r);
  changed.meta.name = "different";
  await assert.rejects(
    repo.commit(changed, { imported: true }),
    /Nothing was overwritten/,
  );
  await repo.commit(r, { pinned: true });
  assert.equal((await repo.list())[0].pinned, true);
  const practice = recording("practice");
  practice.eligible = false;
  practice.eligibilityNote = "Practice";
  await repo.commit(practice);
  assert.equal((await repo.clearTests()).removed.length, 1);
  assert.equal((await repo.list()).length, 1);
});
test("ghost visual shares geometry but has independent material and no collision/shadow ray influence", () => {
  const scene = new THREE.Scene(),
    original = new THREE.Group(),
    material = new THREE.MeshBasicMaterial({ color: "red" }),
    mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), material);
  original.add(mesh);
  scene.add(original);
  const ghost = new GhostVisual(scene, original);
  ghost.update(new ReplayPlayer(recording()).seek(2), {
    opacity: 0.3,
    color: "#4d858b",
  });
  assert.equal(ghost.model.children[0].geometry, mesh.geometry);
  assert.notEqual(ghost.model.children[0].material, mesh.material);
  assert.equal(material.opacity, 1);
  assert.equal(mesh.position.x, 0);
  assert.equal(ghost.model.position.x, 4);
  assert.equal(ghost.model.children[0].castShadow, false);
  const hits = [];
  ghost.model.children[0].raycast({}, hits);
  assert.equal(hits.length, 0);
});
test("recorded YXZ quaternion matches the live boat transform, and world yaw velocity has the correct axis", () => {
  const b = {
      x: 10,
      z: 20,
      angle: 1.2,
      vx: 4,
      vz: 2,
      yawRate: 0.4,
      slipAngle: 0.2,
    },
    motion = { roll: 0.12, pitch: 0.07, heave: 0.08 },
    row = new Array(SAMPLE_FIELDS.length);
  captureRow(
    b,
    motion,
    0.3,
    0,
    20,
    0,
    1,
    { throttle: 0.8, steering: -0.5 },
    row,
  );
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.12, -1.2, 0.07, "YXZ"),
  );
  for (let i = 0; i < 4; i++)
    assert.ok(Math.abs(row[4 + i] - q.toArray()[i]) < 1e-12);
  const next = new Array(SAMPLE_FIELDS.length);
  captureRow(
    { ...b, angle: b.angle + 0.004 },
    motion,
    0.3,
    0,
    20,
    0,
    1,
    {},
    next,
    row,
    0.01,
  );
  assert.ok(Math.abs(next[S.wy] + 0.4) < 1e-8);
  assert.ok(Math.abs(next[S.wx]) + Math.abs(next[S.wz]) < 1e-8);
});
test("replay camera uses the existing fixed/follow implementation without changing live settings", () => {
  const w = createCampaignAdventure(),
    store = new RacingCameraSettings({ getItem: () => null, setItem() {} }),
    before = store.export(),
    cameras = new ReplayCameras(w, store);
  const r = recording();
  r.meta.course = courseDescriptor(w, 0);
  cameras.load(r);
  const pose = new ReplayPlayer(recording()).seek(2),
    model = new THREE.Group();
  for (const mode of ["fixed", "follow"]) {
    cameras.setMode(mode);
    const camera = cameras.update(pose, model, 0.016, 844, 390);
    assert.ok(camera.position.toArray().every(Number.isFinite));
    assert.equal(
      cameras.manager.state,
      mode === "fixed" ? "FLAT_TRACK_FIXED" : "RIVER_FOLLOW",
    );
  }
  assert.equal(store.export(), before);
});
test("ordered live progress uses the required gate interval instead of an adjacent crossing branch", () => {
  const w = createCampaignAdventure(),
    tour = new CampaignTour(w),
    c = tour.venue;
  tour.race.next = 7;
  const p = c.sample(c.gates[6].distance + 5),
    a = orderedProgress(tour, p, {});
  assert.ok(
    a.progress >= c.gates[6].distance && a.progress < c.gates[7].distance,
  );
  tour.race.laps.push(80);
  const b = orderedProgress(tour, p, {});
  assert.ok(Math.abs(b.progress - a.progress - c.length) < 1e-8);
});
test("replay preferences safely restore without changing existing game settings", () => {
  const map = new Map([["jet-sprint-settings", "do not touch"]]),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    prefs = new ReplaySettings(storage);
  prefs.set("opacity", 0.5);
  prefs.set("mode", "previous");
  const copy = new ReplaySettings(storage);
  assert.equal(copy.values.opacity, 0.5);
  assert.equal(copy.values.mode, "previous");
  assert.equal(map.get("jet-sprint-settings"), "do not touch");
  map.set(replaySettingsKey, "{bad");
  assert.equal(new ReplaySettings(storage).values.opacity, 0.38);
});
test("portable foundation contains JSON data, authored paths, exposed-bank rules and parameter registries", () => {
  const w = createCampaignAdventure(),
    pack = portableGameData(w, { example: 1 }, "test"),
    copy = JSON.parse(JSON.stringify(pack));
  assert.equal(copy.courses.length, 4);
  assert.equal(copy.rivers.length, 3);
  assert.equal(copy.boat.massKg, 650);
  assert.equal(copy.replay.version, 1);
  assert.equal(copy.boat.defaults.top, 85);
  assert.equal(copy.audio.defaults.idleRPM, 900);
  assert.equal(copy.boundaries.hullRadius, 2.5);
  assert.ok(copy.boundaries.paths.length > 10);
  assert.equal(copy.courses[0].checkpoints.length, w.courses[0].gates.length);
  assert.equal(copy.input.actions.steering.min, -1);
  assert.equal(copy.coordinates.unrealQuaternion, "[-qx,-qz,-qy,qw]");
});
test("Personal Best, Previous Run, Selected Saved Replay and Disabled select the intended recorded file", async () => {
  const world = {
      courses: [
        {
          id: course.id,
          points: [
            { x: 0, z: 0 },
            { x: 100, z: 0 },
          ],
          gates: [
            { x: 0, z: 0, tx: 1, tz: 0, distance: 0, halfWidth: 7 },
            { x: 50, z: 0, tx: 1, tz: 0, distance: 50, halfWidth: 7 },
          ],
          length: 100,
        },
      ],
      definition: {
        tracks: [
          {
            id: course.id,
            name: course.name,
            routeId: course.routeId,
            version: 1,
            laps: 1,
            waterWidth: 9,
          },
        ],
      },
      legs: [],
    },
    descriptor = courseDescriptor(world, 0),
    repo = new ReplayRepository(null),
    prefs = new ReplaySettings({ getItem: () => null, setItem() {} });
  for (const [id, total] of [
    ["first", 12],
    ["best", 10],
    ["recent", 14],
  ]) {
    const r = recording(id, total);
    r.meta.course = descriptor;
    await repo.commit(r);
  }
  const session = new ReplaySession({
    world,
    repository: repo,
    preferences: prefs,
    getTuning: () => handlingDefaults,
    build: "test",
  });
  await session.ready;
  session.begin(descriptor, makeRow(), false);
  await session.selectGhost();
  assert.equal(session.ghost.meta.id, "best");
  prefs.set("mode", "previous");
  await session.selectGhost();
  assert.equal(session.ghost.meta.id, "recent");
  prefs.set("selectedId", "first");
  prefs.set("mode", "selected");
  await session.selectGhost();
  assert.equal(session.ghost.meta.id, "first");
  assert.equal(session.ghostAt(3).x, 5);
  prefs.set("mode", "disabled");
  await session.selectGhost();
  assert.equal(session.ghost, null);
  assert.equal(session.ghostAt(3), null);
  prefs.set("enabled", false);
  assert.equal(session.recorder, null);
  assert.equal((await repo.list()).length, 3);
});
test("recording observes the real boat and race without changing controls, collisions, positions or official timing", () => {
  const world = createCampaignAdventure(),
    tourA = new CampaignTour(world),
    tourB = new CampaignTour(world),
    repo = new ReplayRepository(null),
    prefs = new ReplaySettings({ getItem: () => null, setItem() {} }),
    session = new ReplaySession({
      world,
      repository: repo,
      preferences: prefs,
      getTuning: () => settings,
      build: "test",
    }),
    startA = new RaceStart(),
    startB = new RaceStart(),
    p = world.courses[0].sample(0),
    a = { x: p.x, z: p.z, angle: Math.atan2(p.tz, p.tx), vx: 0, vz: 0 },
    b = { ...a },
    motion = { roll: 0, pitch: 0, heave: 0 };
  startA.begin(-2.65, 2);
  startB.begin(-2.65, 2);
  startA.update(0);
  startB.update(0);
  for (let i = 0; i < 600; i++) {
    const dt = 1 / 120,
      now = (i + 1) * dt,
      input = { throttle: i < 400 ? 1 : 0, steering: i > 100 ? 0.4 : 0 },
      beforeA = { x: a.x, z: a.z },
      beforeB = { x: b.x, z: b.z };
    session.beforeStep(tourA, a, motion, input, startA);
    if (tourA.beforePhysics(a, dt))
      stepBoat(a, input, dt, world.collisionNearest);
    const transition = tourA.step(beforeA, a, dt, settings, now, startA);
    session.afterStep(tourA, a, motion, input, transition, dt);
    if (tourB.beforePhysics(b, dt))
      stepBoat(b, input, dt, world.collisionNearest);
    tourB.step(beforeB, b, dt, settings, now, startB);
    assert.deepEqual(a, b);
    assert.equal(tourA.race.total, tourB.race.total);
    assert.equal(tourA.race.next, tourB.race.next);
  }
  assert.ok(session.recorder.samples.length > 90);
  const saved = { ...settings };
  session.getTuning = () => ({ ...saved, top: 100 });
  session.noteTuneChange();
  assert.equal(session.mixedTune, true);
});
test("snapshots capture the command applied during a step rather than inventing intermediate tap inputs", () => {
  const rec = new RaceRecorder(
      createReplayMeta(course, handlingDefaults, "test", "s", "tap-test"),
      0.05,
    ),
    a = makeRow(0.045),
    b = makeRow(0.055);
  a[S.throttle] = 0;
  a[S.steering] = -1;
  b[S.throttle] = 1;
  b[S.steering] = 1;
  rec.push(0, makeRow());
  rec.push(0.045, a);
  rec.push(0.055, b);
  const sample = rec.samples.find((r) => r[0] === 0.05);
  assert.equal(sample[S.throttle], 1);
  assert.equal(sample[S.steering], 1);
});
test("both replay camera projections keep a recorded boat inside the unobstructed tape-deck viewport", () => {
  const world = createCampaignAdventure(),
    store = new RacingCameraSettings({ getItem: () => null, setItem() {} }),
    r = recording();
  r.meta.course = courseDescriptor(world, 0);
  const path = world.courses[0],
    sample = path.sample(70),
    pose = {
      x: sample.x,
      y: -0.12,
      z: sample.z,
      vx: sample.tx * 10,
      vz: sample.tz * 10,
      heading: Math.atan2(sample.tz, sample.tx),
    },
    frame = { left: 14, top: 76, right: 830, bottom: 270 };
  for (const projection of ["perspective", "orthographic"]) {
    store.set("flat", "projection", projection);
    const cameras = new ReplayCameras(world, store);
    cameras.load(r);
    for (const mode of ["fixed", "follow"]) {
      cameras.setMode(mode);
      let previous = null;
      for (let i = 0; i < 5; i++) {
        const camera = cameras.update(
            pose,
            new THREE.Group(),
            0.05,
            844,
            390,
            frame,
          ),
          v = new THREE.Vector3(pose.x, pose.y, pose.z).project(camera),
          x = (v.x + 1) * 422,
          y = (1 - v.y) * 195;
        assert.ok(
          x >= frame.left &&
            x <= frame.right &&
            y >= frame.top &&
            y <= frame.bottom,
          JSON.stringify({ projection, mode, x, y }),
        );
        if (mode === "fixed" && previous)
          assert.deepEqual(camera.projectionMatrix.elements, previous);
        previous = [...camera.projectionMatrix.elements];
      }
    }
  }
});
test("portable schemas declare the actual snapshot field layout and foundation identity", async () => {
  const replay = JSON.parse(
      await readFile(
        new URL("../docs/schemas/replay-v1.schema.json", import.meta.url),
      ),
    ),
    foundation = JSON.parse(
      await readFile(
        new URL("../docs/schemas/foundation-v1.schema.json", import.meta.url),
      ),
    );
  assert.deepEqual(replay.properties.fields.const, SAMPLE_FIELDS);
  assert.equal(replay.properties.samples.items.minItems, SAMPLE_FIELDS.length);
  assert.equal(foundation.properties.type.const, "jet-sprint-foundation");
});

test("leaving a replay restores the original effect visibility even when the live game stays paused", () => {
  const spray = { visible: true },
    wake = { visible: false },
    water = { visible: true },
    restore = suspendVisuals([spray, wake]);
  assert.equal(spray.visible, false);
  assert.equal(wake.visible, false);
  assert.equal(water.visible, true);
  restore();
  assert.equal(spray.visible, true);
  assert.equal(wake.visible, false);
});
