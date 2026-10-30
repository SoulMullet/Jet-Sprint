import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { CameraSettings } from "../src/camera-settings.js";
import { RacingCameras } from "../src/cameras.js";
import {
  RacingCameraSettings,
  racingCameraKey,
} from "../src/racing-camera-settings.js";
import { CampaignCameras, easeCamera } from "../src/racing-camera-manager.js";
import { ControlInput } from "../src/control-input.js";
import { ControlSettings } from "../src/control-settings.js";
const world = createCampaignAdventure();
function setup(index = 0) {
  const saved = new Map(),
    storage = {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
    store = new RacingCameraSettings(storage),
    camera = new THREE.PerspectiveCamera(),
    legacy = new RacingCameras(camera, new CameraSettings(storage)),
    manager = new CampaignCameras(camera, legacy, store, world),
    p = world.courses[index].sample(0),
    boat = { x: p.x, z: p.z, angle: Math.atan2(p.tz, p.tx), vx: 7, vz: 2 },
    model = { position: new THREE.Vector3(p.x, 0, p.z) },
    tour = {
      venue: world.courses[index],
      phase: "RACE",
      leaf: { world: world.legs[index] ?? world.legs[2] },
    },
    frame = { playing: true, tour };
  manager.resize(844, 390);
  return {
    manager,
    store,
    saved,
    storage,
    boat,
    model,
    tour,
    frame,
    update: (dt = 1 / 60) => manager.update(boat, model, p, dt, frame),
  };
}
test("all four complete racing courses fit landscape in both projections and remain stationary as the boat moves", () => {
  for (let i = 0; i < 4; i++)
    for (const projection of ["perspective", "orthographic"])
      for (const size of [
        [844, 390],
        [667, 375],
        [1920, 1080],
        [1024, 768],
      ]) {
        const x = setup(i);
        x.update();
        x.store.set("flat", "projection", projection);
        x.manager.resize(...size);
        const c = x.update();
        const pos = c.position.clone(),
          q = c.quaternion.clone();
        for (const p of x.tour.venue.points) {
          const v = new THREE.Vector3(p.x, 0, p.z).project(c);
          assert.ok(
            Math.abs(v.x) <= 0.99 && Math.abs(v.y) <= 0.99,
            JSON.stringify({ i, projection, size, v }),
          );
        }
        x.boat.x += 60;
        x.boat.angle += 2;
        x.update();
        assert.ok(c.position.distanceTo(pos) < 1e-9);
        assert.ok(c.quaternion.angleTo(q) < 1e-7);
      }
});
test("only a river entry triggers one smooth sweep; live boat and input data are untouched", () => {
  const x = setup();
  x.update();
  x.tour.phase = "EXIT";
  x.update();
  assert.equal(x.manager.transitionCount, 0);
  const source = x.manager.camera.position.clone();
  x.tour.phase = "RIVER";
  let maxStep = 0,
    previous = source;
  for (let i = 0; i < 180; i++) {
    const before = JSON.stringify(x.boat);
    const c = x.update();
    assert.equal(JSON.stringify(x.boat), before);
    maxStep = Math.max(maxStep, c.position.distanceTo(previous));
    previous = c.position.clone();
    if (i === 60) {
      x.boat.x += 2;
      x.boat.angle += 0.8;
    }
    assert.ok(c.projectionMatrix.elements.every(Number.isFinite));
  }
  assert.equal(x.manager.state, "RIVER_FOLLOW");
  assert.equal(x.manager.transitionCount, 1);
  assert.ok(maxStep < 12, maxStep);
});
test("orthographic transition starts with matching framing and finishes as perspective without a projection cut", () => {
  const x = setup();
  x.update();
  x.store.set("flat", "projection", "orthographic");
  const before = x.update(),
    point = new THREE.Vector3(x.boat.x, 0, x.boat.z),
    a = point.clone().project(before);
  x.tour.phase = "RIVER";
  const b = point.clone().project(x.update(0.00001));
  assert.ok(a.distanceTo(b) < 0.002, JSON.stringify({ a, b }));
  for (let i = 0; i < 150; i++) x.update();
  assert.equal(x.manager.state, "RIVER_FOLLOW");
  assert.equal(x.manager.camera.isPerspectiveCamera, true);
});
test("arrival sweeps back to fixed course; restart/practice restores the correct stage camera", () => {
  const x = setup();
  x.tour.phase = "RIVER";
  x.update();
  assert.equal(x.manager.state, "RIVER_FOLLOW");
  x.tour.venue = world.courses[1];
  x.tour.phase = "STAGING";
  x.update();
  assert.equal(x.manager.state, "RIVER_TRANSITION");
  for (let i = 0; i < 150; i++) x.update();
  assert.equal(x.manager.state, "FLAT_TRACK_FIXED");
  x.manager.reset();
  x.update();
  assert.equal(x.manager.state, "FLAT_TRACK_FIXED");
  x.tour.phase = "RIVER";
  x.manager.reset();
  x.update();
  assert.equal(x.manager.state, "RIVER_FOLLOW");
});
test("test preview/skip/easing leave progression and boat untouched and return to gameplay", () => {
  const x = setup();
  x.update();
  const original = JSON.stringify(x.boat),
    phase = x.tour.phase;
  x.manager.testTransition();
  x.update();
  x.manager.skip();
  x.update();
  for (let i = 0; i < 230; i++) x.update();
  assert.equal(x.tour.phase, phase);
  assert.equal(JSON.stringify(x.boat), original);
  assert.equal(x.manager.preview, false);
  assert.equal(x.manager.state, "FLAT_TRACK_FIXED");
  for (const k of ["smooth", "smoother", "cosine"]) {
    assert.equal(easeCamera(0, k), 0);
    assert.equal(easeCamera(1, k), 1);
  }
});
test("camera settings persist independently per course without changing existing records; import rejects unsupported schemas", () => {
  const x = setup();
  x.saved.set("jet-sprint-cameras-v1", "legacy");
  x.saved.set("jet-sprint-controls-v1", "controller");
  x.update();
  x.store.set("flat", "yaw", 45);
  x.store.set("river", "height", 50);
  x.store.use(world.courses[1].id);
  assert.equal(x.store.values.flat.yaw, 20);
  x.store.set("flat", "yaw", -20);
  const copy = new RacingCameraSettings(x.storage);
  copy.use(world.courses[0].id);
  assert.equal(copy.values.flat.yaw, 45);
  assert.equal(copy.values.river.height, 50);
  copy.use(world.courses[1].id);
  assert.equal(copy.values.flat.yaw, -20);
  copy.set("transition", "duration", 999);
  assert.equal(copy.values.transition.duration, 5);
  const text = copy.export();
  copy.reset();
  copy.import(text);
  assert.equal(copy.values.flat.yaw, -20);
  assert.throws(() => copy.import('{"schema":1}'));
  assert.equal(x.saved.get("jet-sprint-cameras-v1"), "legacy");
  assert.equal(x.saved.get("jet-sprint-controls-v1"), "controller");
  assert.ok(x.saved.has(racingCameraKey));
});
test("arcade buttons bypass touch shaping/hold settings and release instantly; gamepad calculations match the retained pipeline", () => {
  const v = new ControlSettings({ getItem: () => null, setItem() {} });
  v.values.steerSmoothing = 0.8;
  v.values.throttleSmoothing = 0.8;
  v.values.padCurve = 1.4;
  const a = new ControlInput(v),
    b = new ControlInput(v);
  a.arcadeTouch = true;
  a.set("touch", -1, 1, true);
  a.update(1 / 60);
  assert.equal(a.input.steering, -1);
  assert.equal(a.input.throttle, 1);
  a.set("touch", 0, 0, false);
  a.update(0);
  assert.equal(a.input.throttle, 0);
  assert.equal(a.input.steering, 0);
  a.release();
  for (let i = 0; i < 100; i++) {
    for (const p of [a, b]) {
      p.set("gamepad", 0.48, 0.62, true);
      p.update(1 / 60, 0.5);
    }
    assert.deepEqual(a.input, b.input);
  }
});

// The camera uses elapsed render time independently of the boat's catch-up cap.
test("sweep duration remains two seconds at 10, 30 and 120 animation frames per second", () => {
  for (const dt of [0.1, 1 / 30, 1 / 120]) {
    const x = setup();
    x.update();
    x.tour.phase = "RIVER";
    let elapsed = 0;
    while (x.manager.state !== "RIVER_FOLLOW" && elapsed < 2.3) {
      x.update(dt);
      elapsed += dt;
    }
    assert.ok(elapsed >= 2 - 1e-8 && elapsed <= 2 + dt + 1e-8, elapsed);
    assert.equal(x.manager.state, "RIVER_FOLLOW");
    assert.equal(x.manager.transitionCount, 1);
  }
});
