import test from "node:test";
import assert from "node:assert/strict";
import { EngineRPMModel, engineBedMix } from "../src/engine-rpm.js";
import { Engine } from "../src/audio.js";
import {
  defaultAudio,
  AudioSettings,
  audioControls,
} from "../src/audio-settings.js";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { createRiverLevels, RiverRunProgress } from "../src/river-levels.js";
import { RiverRunTour } from "../src/river-run.js";
import { riverJumpSites } from "../src/river-jumps.js";
const s = defaultAudio();
function advance(
  m,
  seconds,
  throttle = 1,
  contact = {},
  speed = 12,
  settings = s,
) {
  for (let i = 0; i < Math.round(seconds * 120); i++)
    m.update(
      settings,
      speed,
      throttle,
      1 / 120,
      24,
      false,
      0.7,
      { planing: 0.5 },
      contact,
    );
}
test("release hysteresis triggers once on meaningful drops, ignores flutter, and exposes reapplication", () => {
  const m = new EngineRPMModel(s);
  advance(m, 3, 1);
  assert.equal(m.upSequence, 1);
  for (let i = 0; i < 50; i++) {
    advance(m, 0.03, 0.96);
    advance(m, 0.03, 1);
  }
  assert.equal(m.downSequence, 0);
  assert.equal(m.upSequence, 1);
  advance(m, 0.05, 0.2);
  assert.equal(m.downSequence, 1);
  advance(m, 3, 0);
  assert.equal(m.downSequence, 1);
  m.update(s, 12, 0.9, 1 / 120, 24, false, 0.7, null, null);
  assert.equal(m.reapplied, true);
  advance(m, 2, 0.9);
  advance(m, 0.1, 0.1);
  assert.equal(m.downSequence, 2);
  const insensitive = { ...s, revDownThreshold: 65 };
  const n = new EngineRPMModel(insensitive);
  advance(n, 2, 1, {}, 12, insensitive);
  advance(n, 0.3, 0.5, {}, 12, insensitive);
  assert.equal(n.downSequence, 0);
});
test("airborne delay and contact hysteresis reject jitter; genuine flight unloads RPM and landing restores load", () => {
  const wet = new EngineRPMModel(s),
    air = new EngineRPMModel(s);
  advance(wet, 3);
  advance(air, 3);
  for (let i = 0; i < 10; i++) {
    advance(air, 0.016, 1, { airborne: true });
    advance(air, 0.016, 1, { airborne: false });
  }
  assert.equal(air.airborne, false);
  advance(air, 2, 1, { airborne: true });
  advance(wet, 2);
  assert.equal(air.airborne, true);
  assert.ok(air.load < wet.load * 0.2);
  assert.ok(air.rpm > wet.rpm + 100);
  assert.ok(engineBedMix(air, s)[3] > 0.2);
  advance(air, 0.02, 1, { airborne: false });
  assert.equal(air.airborne, true);
  air.update(s, 12, 1, 1 / 120, 24, false, 0.7, null, {
    airborne: false,
    landed: true,
  });
  assert.equal(air.airborne, false);
  assert.equal(air.state, "landing");
  assert.ok(air.landing > 0.8);
  advance(air, 2, 1, { airborne: false });
  assert.ok(air.flightBlend < 0.001);
  assert.ok(air.load > wet.load * 0.9);
  const idle = new EngineRPMModel(s);
  advance(idle, 2, 0, { airborne: true }, 0);
  assert.equal(idle.rpm, s.idleRPM);
  assert.ok(engineBedMix(idle, s)[3] < 0.1);
});
test("dual cruise blend is load/RPM driven and each cruise recording has its own level", () => {
  const m = new EngineRPMModel(s);
  advance(m, 5, 0.7);
  let w = engineBedMix(m, s);
  assert.ok(w[1] > 0.1 && w[2] > 0.1);
  const initial = m.cruiseShare;
  advance(m, 3, 1);
  assert.ok(m.cruiseShare > initial);
  assert.equal(engineBedMix(m, { ...s, cruiseLayerOneVolume: 0 })[2], 0);
  assert.equal(engineBedMix(m, { ...s, cruiseLayer: 0 })[1], 0);
  advance(m, 5, 1, {}, 12, { ...s, cruiseBlend: 0 });
  assert.ok(m.cruiseShare < 0.001);
});
test("stationary testing uses a separate audio state and restores live RPM/load without changing the boat", () => {
  const e = new Engine(),
    boat = Object.freeze({
      yawRate: 0.2,
      lateralSpeed: 3,
      forwardAcceleration: 1,
      planing: 0.7,
    });
  for (let i = 0; i < 240; i++)
    e.update(12, 0.7, 1 / 120, 24, false, 0.7, boat);
  const model = e.model,
    snapshot = JSON.stringify(model);
  e.beginTest();
  for (let i = 0; i < 180; i++)
    e.update(0, 1, 1 / 120, 24, false, 0.7, null, { airborne: true });
  assert.notEqual(e.model, model);
  assert.equal(e.model.airborne, true);
  e.endTest();
  assert.equal(e.model, model);
  assert.equal(JSON.stringify(e.model), snapshot);
});
test("every added and existing control round-trips in the existing settings store", () => {
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    store = new AudioSettings(storage);
  for (const [id, spec] of Object.entries(audioControls))
    store.set(
      id,
      spec.min +
        Math.round(((spec.max - spec.min) / spec.step) * 0.6) * spec.step,
    );
  store.flush();
  const values = { ...store.values };
  store.save("Six recordings");
  store.reset();
  store.load("Six recordings");
  store.flush();
  assert.deepEqual(new AudioSettings(storage).values, values);
  assert.equal(Object.keys(values).length, 56);
});
test("all nine real campaign jumps drive the audio model from takeoff through landing without boat mutation", () => {
  const world = createCampaignAdventure(),
    levels = createRiverLevels(world),
    memory = { getItem: () => null, setItem() {} };
  for (const [index, leg] of world.legs.entries())
    for (const j of riverJumpSites(leg)) {
      const tour = new RiverRunTour(
        world,
        levels,
        new RiverRunProgress(memory, levels),
      );
      tour.resume(index);
      const c = tour.leaf;
      c.elapsed = 0;
      const p = leg.river.sample(j.distance),
        offset = j.offset * j.side;
      const boat = {
        x: p.x - p.tz * offset + p.tx * 0.2,
        z: p.z + p.tx * offset + p.tz * 0.2,
        vx: p.tx * 20,
        vz: p.tz * 20,
        angle: Math.atan2(p.tz, p.tx),
        yawRate: 0.1,
      };
      c.step({ x: boat.x - p.tx * 0.4, z: boat.z - p.tz * 0.4 }, boat, 1 / 120);
      assert.equal(c.airborne, true);
      const e = new Engine();
      for (let i = 0; i < 240; i++)
        e.update(20, 0.8, 1 / 120, 24, false, 0.7, boat);
      let heardFlight = false,
        steps = 0;
      while (c.airborne && steps++ < 400) {
        c.beforePhysics(boat, 1 / 120);
        const before = JSON.stringify(boat);
        e.update(
          Math.hypot(boat.vx, boat.vz),
          0.8,
          1 / 120,
          24,
          false,
          c.airborne ? 0 : 0.7,
          boat,
          { airborne: c.airborne, landed: c.landed },
        );
        assert.equal(JSON.stringify(boat), before);
        heardFlight ||= e.model.airborne && engineBedMix(e.model, s)[3] > 0.01;
      }
      assert.ok(heardFlight);
      assert.equal(c.airborne, false);
      assert.equal(e.model.airborne, false);
      assert.equal(e.model.state, "landing");
      assert.ok(e.model.landing > 0.8);
    }
});
