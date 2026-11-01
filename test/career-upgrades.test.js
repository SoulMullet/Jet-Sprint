import { restoreNitrousProjection } from "../src/nitrous-effects.js";
import test from "node:test";
import assert from "node:assert/strict";
import { PlayerCareer } from "../src/garage/career.js";
import { MaintenanceTuning } from "../src/garage/tuning.js";
import {
  UpgradeTuning,
  upgradeTuningKey,
} from "../src/garage/upgrade-tuning.js";
import {
  upgradeEconomy,
  boatPerformance,
  upgradeDefaults,
} from "../src/garage/upgrades.js";
import { freshProfile, decodeProfile } from "../src/garage/profile-model.js";
import { profileKey } from "../src/garage/profile-store.js";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { createRiverLevels } from "../src/river-levels.js";
import { settings, stepBoat } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import {
  toMph,
  kphToMph,
  mphToMps,
  displaySetting,
  storedSetting,
} from "../src/speed-units.js";
import { NitrousGesture } from "../src/nitrous-gesture.js";
import { ControlInput } from "../src/control-input.js";
import { ControlSettings } from "../src/control-settings.js";
import { GamepadSource, gamepadMapping } from "../src/control-gamepad.js";
import { tuneIdentifier } from "../src/replay/course-data.js";
const levels = createRiverLevels(createCampaignAdventure()),
  mem = () => {
    const m = new Map();
    return { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
  },
  create = (storage = mem(), extra = {}) =>
    new PlayerCareer(storage, levels, new MaintenanceTuning(storage), extra),
  boat = () => ({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    angle: 0,
    pump: 0,
    nozzle: 0,
    yawRate: 0,
  }),
  open = (x, z) => ({ x, z, hullLimit: 1e9 });
function rich(c) {
  c.profile.cash = 100000;
  c.dirty = true;
  assert.ok(c.flush());
}
test("all sequential upgrades debit exact prices, stay on one boat, and survive reload with no repeat purchase", () => {
  const store = mem(),
    c = create(store),
    id = c.profile.boat.id;
  assert.equal(c.buyUpgrade("engine").ok, false);
  rich(c);
  let spent = 0;
  for (const category of ["engine", "pump", "nitrous"])
    for (const price of Array.isArray(upgradeEconomy[category])
      ? upgradeEconomy[category]
      : [upgradeEconomy[category]]) {
      assert.equal(c.upgradeQuote(category).price, price);
      assert.equal(c.buyUpgrade(category).ok, true);
      spent += price;
    }
  assert.equal(c.profile.cash, 100000 - spent);
  assert.equal(c.profile.boat.id, id);
  assert.equal(c.profile.boat.engineStage, 4);
  assert.equal(c.profile.boat.pumpStage, 3);
  assert.equal(c.profile.boat.nitrousInstalled, true);
  assert.equal(c.profile.boat.nitrousFill, 100);
  for (const k of ["engine", "pump", "nitrous"])
    assert.equal(c.buyUpgrade(k).ok, false);
  const restored = create(store);
  assert.deepEqual(restored.profile.boat, c.profile.boat);
  assert.equal(restored.profile.cash, c.profile.cash);
});
test("old schema-1 profiles migrate without changing cash, maintenance, records or tuning", () => {
  const storage = mem(),
    p = freshProfile(levels);
  p.schemaVersion = 1;
  p.economyVersion = "garage-economy-v1";
  p.cash = 4321;
  p.boat.fuel = 42;
  p.boat.condition = 61;
  for (const k of [
    "engineStage",
    "pumpStage",
    "nitrousInstalled",
    "nitrousCapacity",
    "nitrousFill",
  ])
    delete p.boat[k];
  const text = JSON.stringify(p);
  storage.setItem(profileKey, text);
  storage.setItem("jet-sprint-settings", "original tuning");
  const c = create(storage);
  assert.equal(c.profile.schemaVersion, 2);
  assert.equal(c.profile.cash, 4321);
  assert.equal(c.profile.boat.fuel, 42);
  assert.equal(c.profile.boat.condition, 61);
  assert.equal(c.profile.boat.engineStage, 0);
  assert.equal(c.profile.boat.nitrousFill, 0);
  assert.equal(storage.getItem(profileKey + ".backup"), text);
  assert.equal(storage.getItem("jet-sprint-settings"), "original tuning");
  assert.equal(decodeProfile(text).boat.pumpStage, 0);
});
test("tank drains only for legal active boost, never refills on restart, and partial refill charges only stored resource", () => {
  const storage = mem(),
    c = create(storage);
  rich(c);
  c.buyUpgrade("nitrous");
  const full = c.profile.boat.nitrousFill;
  for (const [input, allowed] of [
    [{ throttle: 0, nitrous: true }, true],
    [{ throttle: 1, nitrous: false }, true],
    [{ throttle: 1, nitrous: true }, false],
  ]) {
    c.updateNitrous(input, 1, allowed);
    assert.equal(c.profile.boat.nitrousFill, full);
  }
  for (let i = 0; i < 120; i++)
    c.updateNitrous({ throttle: 1, nitrous: true }, 1 / 120);
  assert.ok(Math.abs(c.profile.boat.nitrousFill - 95) < 1e-8);
  c.stopNitrous();
  assert.equal(
    decodeProfile(storage.getItem(profileKey)).boat.nitrousFill,
    c.profile.boat.nitrousFill,
  );
  const token = c.begin(levels[0]);
  assert.equal(c.buyUpgrade("engine").ok, false);
  assert.equal(c.refillNitrous().ok, false);
  c.cancel(token);
  const fill = c.profile.boat.nitrousFill;
  assert.equal(c.profile.boat.nitrousFill, fill);
  c.profile.cash = 3;
  c.dirty = true;
  c.flush();
  const q = c.quoteNitrous();
  assert.equal(q.cost, 3);
  assert.equal(q.units, 2);
  assert.equal(c.refillNitrous().ok, true);
  assert.equal(c.profile.boat.nitrousFill, fill + 2);
  assert.equal(c.profile.cash, 0);
  c.profile.boat.nitrousFill = 0.01;
  c.dirty = true;
  for (let i = 0; i < 10; i++)
    c.updateNitrous({ throttle: 1, nitrous: true }, 1 / 120);
  assert.equal(c.nitrousActive, false);
  assert.equal(c.profile.boat.nitrousFill, 0);
  assert.equal(c.framing().nitrous, 0);
  const stock = create();
  stock.updateNitrous({ throttle: 1, nitrous: true }, 1);
  assert.equal(stock.nitrousActive, false);
});
test("failed profile commits cannot grant upgrades or charge cash; development balance never silently applies in career", () => {
  const backing = mem();
  let fail = false;
  const storage = {
      getItem: (k) => backing.getItem(k),
      setItem: (k, v) => {
        if (fail) throw Error("quota");
        backing.setItem(k, v);
      },
    },
    c = create(storage);
  rich(c);
  fail = true;
  assert.equal(c.buyUpgrade("engine").ok, false);
  assert.equal(c.profile.boat.engineStage, 0);
  assert.equal(c.profile.cash, 100000);
  backing.setItem(
    upgradeTuningKey,
    JSON.stringify({
      schema: 1,
      values: { stockTopMph: 110, engineSpeed4: 1.7 },
    }),
  );
  const normal = new UpgradeTuning(backing),
    dev = new UpgradeTuning(backing, { development: true });
  assert.equal(normal.effective.stockTopMph, 93);
  assert.equal(dev.effective.stockTopMph, 110);
  assert.equal(boatPerformance(c.profile.boat, normal.effective).topMph, 93);
  const practice = create(mem(), { development: true });
  const token = practice.begin(levels[0]);
  assert.ok(token);
  assert.equal(practice.profile.career.activeAttempt.practice, true);
});
test("captured throttle gesture reaches full throttle before nitrous, has hysteresis, and cancels safely", () => {
  const g = new NitrousGesture(),
    rect = { top: 200, bottom: 322 },
    status = { installed: true, fill: 100, activation: 28, hysteresis: 12 };
  g.move(300, rect, status);
  assert.ok(g.throttle > 0 && g.throttle < 0.5);
  g.move(212, rect, status);
  assert.equal(g.throttle, 1);
  assert.equal(g.nitrous, false);
  g.move(183, rect, status);
  assert.equal(g.nitrous, true);
  g.move(190, rect, status);
  assert.equal(g.nitrous, true);
  g.move(200, rect, status);
  assert.equal(g.nitrous, false);
  assert.equal(g.throttle, 1);
  g.move(280, rect, status);
  assert.ok(g.throttle < 1);
  g.clear();
  assert.equal(g.throttle, 0);
  assert.equal(g.nitrous, false);
  for (const state of [
    { ...status, installed: false },
    { ...status, fill: 0 },
  ]) {
    g.move(150, rect, state);
    assert.equal(g.nitrous, false);
    assert.equal(g.throttle, 1);
  }
});
test("keyboard command arbitration and standard RB nitrous preserve throttle and require deliberate arming", () => {
  const store = new ControlSettings(mem()),
    p = new ControlInput(store);
  p.set("keyboard", 0, 0, true, true, true);
  p.update(1 / 60);
  assert.equal(p.input.nitrous, false);
  p.set("keyboard", 0, 1, true, true, true);
  p.update(1 / 60);
  assert.equal(p.input.nitrous, true);
  p.release();
  assert.equal(p.input.nitrous, false);
  const source = new GamepadSource(store),
    pad = {
      index: 0,
      id: "Xbox fixture",
      mapping: "standard",
      connected: true,
      axes: [0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
    };
  source.poll([pad], 1 / 60);
  pad.buttons[7].value = 1;
  pad.buttons[gamepadMapping.nitrous].value = 1;
  const active = source.poll([pad], 1 / 60);
  assert.equal(active.nitrous, true);
  assert.equal(active.throttle, 1);
  source.poll([pad], 1 / 60, true, false);
  assert.equal(source.state.nitrous, false);
  pad.buttons[5].value = 0;
  pad.buttons[7].value = 0;
  source.poll([pad], 1 / 60);
  assert.equal(source.armed, true);
});
test("MPH display boundaries round-trip old storage and replay configuration isolates acquired upgrades", () => {
  assert.equal(toMph(mphToMps(93)), 93);
  assert.ok(Math.abs(kphToMph(150) - 93.2057) < 0.001);
  for (const k of [
    "top",
    "planingSpeed",
    "speedThreshold",
    "sprayLaunchSpeed",
    "impactThreshold",
  ])
    assert.ok(Math.abs(storedSetting(k, displaySetting(k, 42)) - 42) < 1e-10);
  assert.notEqual(
    tuneIdentifier({ ...handlingDefaults, careerEngine: 0 }),
    tuneIdentifier({ ...handlingDefaults, careerEngine: 1 }),
  );
  assert.notEqual(
    tuneIdentifier(handlingDefaults),
    tuneIdentifier({ ...handlingDefaults, careerEngine: 0 }),
  );
});
test("real waterjet integration reaches stage reference speeds, pump improves launch, nitrous adds thrust without a velocity jump", () => {
  const saved = { ...settings };
  Object.assign(settings, handlingDefaults);
  try {
    const targets = [93, 101, 109, 118, 128],
      times = [];
    for (let stage = 0; stage <= 4; stage++) {
      const b = boat(),
        perf = {
          ...boatPerformance({ engineStage: stage, pumpStage: 0 }),
          powerScale: 1,
        };
      let sixty = null;
      for (let i = 0; i < 4800; i++) {
        stepBoat(b, { throttle: 1, steering: 0 }, 1 / 120, open, perf);
        if (sixty === null && toMph(b.vx) >= 60) sixty = i / 120;
      }
      assert.ok(
        Math.abs(toMph(b.vx) - targets[stage]) < 1,
        stage + ": " + toMph(b.vx),
      );
      times.push(sixty);
    }
    for (let i = 1; i < times.length; i++) assert.ok(times[i] < times[i - 1]);
    const launches = [];
    for (let pump = 0; pump <= 3; pump++) {
      const b = boat(),
        perf = {
          ...boatPerformance({ engineStage: 2, pumpStage: pump }),
          powerScale: 1,
        };
      for (let i = 0; i < 120; i++)
        stepBoat(b, { throttle: 1 }, 1 / 120, open, perf);
      launches.push(b.vx);
    }
    for (let i = 1; i < launches.length; i++)
      assert.ok(launches[i] > launches[i - 1]);
    const b = boat(),
      t = upgradeDefaults(),
      perf = {
        ...boatPerformance({ engineStage: 4, pumpStage: 3 }),
        powerScale: 1,
      };
    for (let i = 0; i < 4800; i++)
      stepBoat(b, { throttle: 1 }, 1 / 120, open, perf);
    const before = b.vx;
    perf.thrustScale *= t.nitroPower;
    perf.boostDragScale = t.nitroPower / (1 + t.nitroSpeedInfluence) ** 3;
    perf.nitrous = 1;
    stepBoat(b, { throttle: 1 }, 1 / 120, open, perf);
    assert.ok(b.vx > before && b.vx - before < 1);
    for (let i = 0; i < 2399; i++)
      stepBoat(b, { throttle: 1 }, 1 / 120, open, perf);
    assert.ok(toMph(b.vx) > 140 && toMph(b.vx) < 145);
    const still = boat();
    for (let i = 0; i < 120; i++)
      stepBoat(still, { throttle: 0, steering: 1 }, 1 / 120, open, perf);
    assert.equal(still.angle, 0);
    assert.equal(still.vx, 0);
    assert.equal(still.vz, 0);
  } finally {
    Object.assign(settings, saved);
  }
});

test("camera boost restoration never overwrites a camera reset or compounds FOV/zoom", () => {
  const c = { isPerspectiveCamera: true, fov: 45, updateProjectionMatrix() {} };
  restoreNitrousProjection({ camera: c, before: 43, after: 45 });
  assert.equal(c.fov, 43);
  c.fov = 50;
  restoreNitrousProjection({ camera: c, before: 43, after: 45 });
  assert.equal(c.fov, 50);
  const ortho = {
    isPerspectiveCamera: false,
    zoom: 0.98,
    updateProjectionMatrix() {},
  };
  restoreNitrousProjection({ camera: ortho, before: 1, after: 0.98 });
  assert.equal(ortho.zoom, 1);
});
test("one validated finish can fund the first engine upgrade, time-target tiers pay once, and repeat racing remains rewarded", () => {
  for (const [seconds, base] of [
    [120, 200],
    [85, 350],
    [70, 500],
  ]) {
    const c = create(),
      level = levels[0];
    const run = () => {
      const token = c.begin(level);
      for (let i = 0; i < level.checkpoints.length; i++) {
        c.step(
          seconds / level.checkpoints.length,
          { vx: 0, vz: 0, collisionImpulse: 0 },
          token,
          0,
        );
        c.checkpoint(
          token,
          i,
          i + 1,
          (seconds * (i + 1)) / level.checkpoints.length,
        );
      }
      const proof = {
        attempt: token,
        checkpoints: level.checkpoints.length,
        clean: true,
      };
      return { proof, reward: c.complete(level, seconds, false, proof) };
    };
    const first = run();
    assert.equal(first.reward.prize, base);
    assert.equal(first.reward.total, base + 250 + 25);
    assert.equal(c.buyUpgrade("engine").ok, true);
    const cash = c.profile.cash;
    assert.equal(c.complete(level, seconds, false, first.proof).valid, false);
    assert.equal(c.profile.cash, cash);
    const second = run();
    assert.equal(second.reward.total, base + 25);
  }
});
