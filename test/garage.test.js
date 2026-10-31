import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { createRiverLevels } from "../src/river-levels.js";
import { PlayerCareer, CareerRiverProgress } from "../src/garage/career.js";
import {
  profileKey,
  LocalProfileRepository,
} from "../src/garage/profile-store.js";
import {
  freshProfile,
  decodeProfile,
  validateProfile,
} from "../src/garage/profile-model.js";
import { MaintenanceTuning, maintenanceKey } from "../src/garage/tuning.js";
import {
  maintenanceDefaults,
  fuelConsumed,
  impactDamage,
  powerScale,
  serviceQuote,
  emergencyAvailable,
  garageEconomy,
} from "../src/garage/definitions.js";
import { stepBoat, settings } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
const levels = createRiverLevels(createCampaignAdventure());
const memory = () => {
  const map = new Map();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
const create = (store = memory(), options = {}) =>
  new PlayerCareer(store, levels, new MaintenanceTuning(store), options);
const still = { vx: 0, vz: 0, throttle: 0, collisionImpulse: 0 };
function validatedRun(c, level = levels[0], duration = 120) {
  const token = c.begin(level);
  for (let i = 0; i < level.checkpoints.length; i++) {
    c.step(duration / level.checkpoints.length, still, token, 0.5);
    c.checkpoint(
      token,
      i,
      i + 1,
      ((i + 1) * duration) / level.checkpoints.length,
    );
  }
  return {
    token,
    proof: {
      attempt: token,
      checkpoints: level.checkpoints.length,
      clean: true,
    },
  };
}
test("new player owns the existing boat, starts with one river and a persistent profile", () => {
  const store = memory(),
    c = create(store);
  assert.equal(c.profile.cash, 600);
  assert.equal(c.profile.boat.id, "sprint-boat-1987-v1");
  assert.equal(c.profile.boat.fuel, 100);
  assert.deepEqual(c.profile.boat.installedUpgrades, []);
  assert.deepEqual(c.profile.career.unlockedCourses, [levels[0].id]);
  c.step(60, still, null, 1);
  c.step(0.01, { ...still, collisionImpulse: 12 }, null, 0);
  c.flush();
  const reloaded = create(store);
  assert.equal(reloaded.profile.boat.fuel, c.profile.boat.fuel);
  assert.equal(reloaded.profile.boat.condition, c.profile.boat.condition);
  assert.equal(reloaded.profile.id, c.profile.id);
  assert.notEqual(reloaded.profile.boat.fuel, 100);
});
test("fuel consumption follows engine time, throttle and load, and is frame-rate independent", () => {
  const t = maintenanceDefaults();
  assert.ok(fuelConsumed(120, 1, 20, t) > fuelConsumed(120, 0, 0, t));
  const a = create(),
    b = create();
  a.step(120, still, null, 0.5);
  for (let i = 0; i < 120 * 60; i++) b.step(1 / 60, still, null, 0.5);
  assert.ok(Math.abs(a.profile.boat.fuel - b.profile.boat.fuel) < 1e-8);
  const fuel = a.profile.boat.fuel;
  a.step(100, still, null, 1, false);
  assert.equal(a.profile.boat.fuel, fuel);
  assert.ok(
    fuelConsumed(229, 1, 24, t) < 20,
    "a tank supports several longest runs",
  );
});
test("impact severity, gentle-contact threshold and peak envelope prevent continuous-contact damage spam", () => {
  const c = create(),
    t = maintenanceDefaults();
  assert.equal(impactDamage(2, t), 0);
  assert.ok(impactDamage(12, t) > impactDamage(6, t));
  for (let i = 0; i < 600; i++)
    c.step(1 / 120, { ...still, collisionImpulse: 2 }, null, 0, false);
  assert.equal(c.profile.boat.condition, 100);
  c.step(0.01, { ...still, collisionImpulse: 10 }, null, 0, false);
  const first = c.profile.boat.condition;
  for (let i = 0; i < 1000; i++)
    c.step(1 / 120, { ...still, collisionImpulse: 10 }, null, 0, false);
  assert.equal(c.profile.boat.condition, first);
  c.step(0.01, { ...still, collisionImpulse: 15 }, null, 0, false);
  assert.ok(
    Math.abs(c.profile.boat.condition - (100 - impactDamage(15, t))) < 1e-10,
  );
  c.step(t.impactRelease + 0.01, still, null, 0, false);
  c.step(0.01, { ...still, collisionImpulse: 10 }, null, 0, false);
  assert.ok(c.profile.boat.condition < 100 - impactDamage(15, t));
});
test("repair/refuel prices, affordable partial service and purchases persist without double spending", () => {
  const store = memory(),
    c = create(store);
  c.profile.boat.fuel = 75;
  c.profile.boat.condition = 80;
  c.dirty = true;
  c.flush();
  assert.equal(c.quote("fuel").cost, 50);
  const fuel = c.service("fuel");
  assert.equal(fuel.to, 100);
  assert.equal(c.profile.cash, 550);
  assert.equal(c.service("fuel").ok, false);
  assert.equal(c.service("condition").cost, 80);
  assert.equal(c.profile.cash, 470);
  assert.equal(JSON.parse(store.getItem(profileKey)).cash, 470);
  c.profile.cash = 7;
  c.profile.boat.fuel = 0;
  c.dirty = true;
  c.flush();
  assert.deepEqual([c.quote("fuel").units, c.quote("fuel").cost], [3, 6]);
  c.service("fuel");
  assert.equal(c.profile.boat.fuel, 3);
  assert.equal(c.profile.cash, 1);
});
test("zero cash emergency restores only a basic reserve and cannot become free full servicing", () => {
  const c = create();
  c.profile.cash = 0;
  c.profile.boat.fuel = 0;
  c.profile.boat.condition = 0;
  c.dirty = true;
  c.flush();
  assert.equal(emergencyAvailable(c.profile), true);
  assert.equal(c.emergency().ok, true);
  assert.equal(c.profile.boat.fuel, 20);
  assert.equal(c.profile.boat.condition, 40);
  assert.equal(c.profile.cash, 0);
  assert.equal(c.emergency().ok, false);
  assert.equal(c.service("fuel").ok, false);
  assert.ok(
    powerScale({ ...c.profile.boat, fuel: 0, condition: 0 }, c.tuning.values) >=
      0.7,
  );
});
test("valid runs pay once, unlock the next existing river and retain PB/result history", () => {
  const store = memory(),
    c = create(store),
    r = validatedRun(c),
    startCash = c.profile.cash;
  const reward = c.complete(levels[0], 120, false, r.proof);
  assert.equal(reward.valid, true);
  assert.equal(reward.total, 375);
  assert.equal(c.profile.cash, startCash + 375);
  assert.ok(c.profile.career.unlockedCourses.includes(levels[1].id));
  assert.equal(c.profile.results.length, 1);
  assert.equal(c.complete(levels[0], 120, false, r.proof).valid, false);
  assert.equal(c.profile.cash, startCash + 375);
  const second = validatedRun(c, levels[0], 110);
  assert.equal(c.complete(levels[0], 110, false, second.proof).total, 325);
  assert.equal(c.profile.career.records[levels[0].id].best, 110);
  const reload = create(store);
  assert.equal(reload.profile.cash, c.profile.cash);
  assert.equal(reload.profile.career.records[levels[0].id].best, 110);
  assert.equal(reload.profile.results.length, 2);
});
test("restarts, stale tokens, missing/reversed gates, practice and implausible teleports never pay", () => {
  for (const mode of [
    "restart",
    "stale",
    "gate-order",
    "missing",
    "practice",
    "teleport",
  ]) {
    const c = create(),
      r = validatedRun(c);
    if (mode === "restart") c.cancel(r.token);
    if (mode === "stale") c.begin(levels[0]);
    if (mode === "gate-order") c.profile.career.activeAttempt.valid = false;
    if (mode === "missing") r.proof.checkpoints--;
    if (mode === "teleport") c.profile.career.activeAttempt.seconds = 0.01;
    const cash = c.profile.cash;
    assert.equal(
      c.complete(levels[0], 120, mode === "practice", r.proof).valid,
      false,
      mode,
    );
    assert.equal(c.profile.cash, cash);
    assert.equal(c.profile.results.length, 0);
  }
  const c = create(),
    token = c.begin(levels[0]);
  c.step(1, still, token);
  c.checkpoint(token, 0, 2, 1);
  assert.equal(c.profile.career.activeAttempt.valid, false);
});
test("a reload expires in-flight attempts and restart does not refill fuel or repair hull", () => {
  const store = memory(),
    c = create(store),
    r = validatedRun(c);
  c.profile.boat.condition = 30;
  c.dirty = true;
  c.flush();
  const fuel = c.profile.boat.fuel,
    reload = create(store);
  assert.equal(reload.profile.career.activeAttempt, null);
  assert.equal(reload.complete(levels[0], 120, false, r.proof).valid, false);
  const token = reload.begin(levels[0]);
  reload.cancel(token);
  assert.equal(reload.profile.boat.fuel, fuel);
  assert.equal(reload.profile.boat.condition, 30);
});
test("legacy wallet/river migrations credit no retroactive prize and preserve all old keys/tuning", () => {
  const store = memory(),
    legacy = JSON.stringify({
      schema: 2,
      wallet: 1337,
      lifetimeEarnings: 2000,
      unlocked: 3,
    });
  store.setItem("jet-sprint-campaign-v2", legacy);
  store.setItem("jet-sprint-settings", "keep tuning");
  store.setItem(
    "jet-sprint-river-runs-v1",
    JSON.stringify({
      schema: 1,
      records: {
        [levels[0].id]: {
          revision: levels[0].revision,
          best: 105,
          recent: 110,
          completions: 2,
        },
      },
    }),
  );
  const c = create(store);
  assert.equal(c.profile.cash, 1337);
  assert.equal(c.profile.lifetimeEarnings, 2000);
  assert.equal(c.profile.career.records[levels[0].id].best, 105);
  assert.equal(c.profile.career.unlockedCourses.length, 3);
  assert.equal(c.profile.results.length, 0);
  assert.equal(create(store).profile.cash, 1337);
  assert.equal(store.getItem("jet-sprint-campaign-v2"), legacy);
  assert.equal(store.getItem("jet-sprint-settings"), "keep tuning");
  assert.equal(
    create(memory(), { existingPlayer: true }).profile.career.unlockedCourses
      .length,
    3,
  );
});
test("profile v0 migrates explicitly and corrupted current data recovers a validated backup", () => {
  const store = memory(),
    raw = freshProfile(levels);
  raw.schemaVersion = 0;
  raw.money = 321;
  raw.fuel = 42;
  raw.condition = 51;
  raw.boatId = raw.boat.id;
  delete raw.boat;
  delete raw.cash;
  assert.equal(decodeProfile(JSON.stringify(raw)).cash, 321);
  assert.equal(decodeProfile(JSON.stringify(raw)).boat.fuel, 42);
  const c = create(store);
  c.step(30, still, null, 1);
  c.flush();
  const backup = store.getItem(profileKey);
  store.setItem(profileKey + ".backup", backup);
  store.setItem(profileKey, "{broken");
  const recovered = create(store);
  assert.ok(recovered.recoveryNotice.includes("Recovered"));
  assert.equal(recovered.profile.boat.fuel, JSON.parse(backup).boat.fuel);
  assert.equal(store.getItem(profileKey + ".corrupt"), "{broken");
  assert.equal(JSON.parse(store.getItem(profileKey)).schemaVersion, 1);
});
test("invalid and future profiles are handled safely without touching unrelated saves", () => {
  const store = memory(),
    c = create(store);
  for (const mutate of [
    (p) => (p.cash = -1),
    (p) => (p.boat.fuel = 101),
    (p) => (p.boat.condition = NaN),
    (p) => (p.boat.id = "other"),
    (p) => (p.career.paidSequence = 10),
  ]) {
    const p = structuredClone(c.profile);
    mutate(p);
    assert.throws(() => validateProfile(p));
  }
  const future = { ...c.profile, schemaVersion: 99 },
    text = JSON.stringify(future);
  store.setItem(profileKey, text);
  const readOnly = create(store);
  assert.equal(readOnly.readOnly, true);
  assert.equal(readOnly.service("fuel").ok, false);
  assert.equal(store.getItem(profileKey), text);
});
test("quota failures never charge cash, grant unsaved service or duplicate a pending payout", () => {
  const backing = memory();
  let failing = false;
  const store = {
      getItem: (k) => backing.getItem(k),
      setItem: (k, v) => {
        if (failing) throw Error("Storage full");
        backing.setItem(k, v);
      },
    },
    c = create(store);
  c.profile.boat.fuel = 50;
  c.dirty = true;
  c.flush();
  failing = true;
  const cash = c.profile.cash;
  assert.equal(c.service("fuel").ok, false);
  assert.equal(c.profile.cash, cash);
  assert.equal(c.profile.boat.fuel, 50);
  failing = false;
  const r = validatedRun(c);
  failing = true;
  assert.equal(c.complete(levels[0], 120, false, r.proof).pending, true);
  assert.equal(c.profile.cash, cash);
  for (let i = 0; i < 100; i++) c.step(0.05, still, r.token, 0.5);
  assert.equal(c.begin(levels[0]), null);
  failing = false;
  assert.equal(c.retry(), true);
  const paid = c.profile.cash;
  assert.ok(paid > cash);
  assert.equal(c.retry(), true);
  assert.equal(c.profile.cash, paid);
});
test("visible revision conflicts reject stale purchases instead of overwriting newer cash", () => {
  const store = memory(),
    a = create(store);
  a.profile.boat.fuel = 90;
  a.dirty = true;
  a.flush();
  const b = create(store);
  b.profile.boat.fuel = 90;
  b.dirty = true;
  b.flush();
  assert.equal(a.service("fuel").ok, false);
  assert.equal(a.conflict, true);
  assert.equal(JSON.parse(store.getItem(profileKey)).boat.fuel, 90);
});
test("maintenance sliders persist independently and reset only their own tuning", () => {
  const store = memory();
  store.setItem("jet-sprint-settings", "physics");
  store.setItem("jet-sprint-v8-settings", "audio");
  const t = new MaintenanceTuning(store);
  t.set("throttleFuel", 0.1);
  t.set("maxPenalty", 0.09);
  const next = new MaintenanceTuning(store);
  assert.equal(next.values.throttleFuel, 0.1);
  assert.equal(next.values.maxPenalty, 0.09);
  next.reset();
  assert.deepEqual(next.values, maintenanceDefaults());
  assert.equal(store.getItem("jet-sprint-settings"), "physics");
  assert.equal(store.getItem("jet-sprint-v8-settings"), "audio");
  assert.equal(JSON.parse(store.getItem(maintenanceKey)).schema, 1);
});
test("healthy optional service scaling is identical to original physics; reserve retains jet steering", () => {
  const open = (x, z) => ({ x, z, hullLimit: 1e9 }),
    fresh = () => ({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      pump: 0,
      nozzle: 0,
      yawRate: 0,
    }),
    a = fresh(),
    b = fresh(),
    reserve = fresh(),
    saved = { ...settings };
  try {
    Object.assign(settings, handlingDefaults);
    for (let i = 0; i < 600; i++) {
      const cmd = { throttle: 1, steering: 0.3 };
      stepBoat(a, cmd, 1 / 120, open);
      stepBoat(b, cmd, 1 / 120, open, { powerScale: 1 });
      stepBoat(reserve, cmd, 1 / 120, open, { powerScale: 0.8 });
    }
    assert.deepEqual(a, b);
    assert.ok(reserve.thrust < a.thrust);
    assert.equal(reserve.nozzle, a.nozzle);
    assert.ok(Math.abs(reserve.angle) > 1);
    assert.ok(Math.hypot(reserve.vx, reserve.vz) > 1);
  } finally {
    Object.assign(settings, saved);
  }
});

test("locked courses require a prior clear while debug practice remains reward-free", () => {
  const c = create();
  assert.equal(c.begin(levels[2]), null);
  const token = c.begin(levels[2], true);
  assert.ok(token);
  assert.equal(c.profile.career.activeAttempt.practice, true);
});
