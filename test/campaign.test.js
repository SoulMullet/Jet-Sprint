import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignDefinition,
  track1,
  track2,
  river1,
} from "../src/campaign-data.js";
import { createCampaignWorld } from "../src/campaign-world.js";
import { Campaign, crossesGate } from "../src/campaign.js";
import { CampaignProgress, campaignKey } from "../src/campaign-progress.js";
import { CampaignScenery } from "../src/campaign-scenery.js";
import { Race, defaults, readScores, saveScore } from "../src/race.js";
import { RouteNavigator } from "../src/navigation.js";
import { stepBoat } from "../src/physics.js";
import { nearestOnTrack, channelPolygons, landGeometry } from "../src/track.js";
import { SettingsStore, registry, settingsKey } from "../src/settings.js";
import {
  AudioSettings,
  audioControls,
  AUDIO_KEY,
} from "../src/audio-settings.js";
import { SummerSettings, summerControls } from "../src/summer-settings.js";
import {
  CameraSettings,
  cameraDefaults,
  controlFor,
} from "../src/camera-settings.js";

const world = createCampaignWorld();
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    map,
  };
};
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const at = (g, forward, lateral = 0) => ({
  x: g.x + g.tx * forward - g.tz * lateral,
  z: g.z + g.tz * forward + g.tx * lateral,
});
function riverFixture() {
  const c = new Campaign(world);
  c.finishRace({ done: true, laps: [1, 1, 1], total: 3 });
  c.gateOpen = 1;
  const b = {
    ...at(world.gate, 1),
    vx: 10 * world.gate.tx,
    vz: 10 * world.gate.tz,
    angle: Math.atan2(world.gate.tz, world.gate.tx),
  };
  c.step(at(world.gate, -1), b, 1 / 120);
  assert.equal(c.phase, "RIVER");
  return c;
}

test("campaign declares eight tracks and seven connected progressively harder rivers, with only the vertical slice available", () => {
  const { tracks, rivers } = campaignDefinition;
  assert.equal(tracks.length, 8);
  assert.equal(rivers.length, 7);
  assert.equal(new Set(tracks.map((t) => t.id)).size, 8);
  for (let i = 0; i < 7; i++) {
    assert.equal(rivers[i].from, tracks[i].id);
    assert.equal(rivers[i].to, tracks[i + 1].id);
    assert.equal(rivers[i].difficulty, i + 1);
  }
  assert.equal(tracks[0].status, "playable");
  assert.equal(tracks[1].status, "placeholder");
  assert.ok(tracks.slice(2).every((t) => t.status === "planned"));
  assert.ok(rivers.slice(1).every((r) => r.status === "planned"));
  assert.deepEqual(
    JSON.parse(JSON.stringify(campaignDefinition)),
    campaignDefinition,
  );
});
test("one continuous footprint connects three island racing loops, the narrower open river and destination", () => {
  const polygons = channelPolygons(world.network, 9);
  assert.equal(polygons.length, 1);
  const start = world.river.sample(0),
    end = world.river.sample(world.river.length),
    arrival = world.destination.sample(0);
  near(world.race.project(start, 0, world.race.length).error, 0, 0.05);
  near(Math.hypot(end.x - arrival.x, end.z - arrival.z), 0);
  assert.deepEqual(world.river.sample(-100), world.river.sample(0));
  assert.deepEqual(world.river.sample(world.river.length + 100), end);
  for (const path of world.network.paths)
    for (const p of path) {
      assert.ok(Math.abs(p.x) + path.waterWidth + 1.1 < 128);
      assert.ok(Math.abs(p.z) + path.waterWidth + 1.1 < 128);
    }
  for (const d of [30, 70, 110]) {
    const p = world.river.sample(d),
      n = world.nearest(p.x, p.z);
    assert.equal(n.waterWidth, river1.waterWidth);
    assert.equal(n.hullLimit, river1.waterWidth - 2.5);
  }
});
test("indexed queries match a brute-force clearance oracle at merges, banks and far outside the map", () => {
  let seed = 87;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let sample = 0; sample < 1200; sample++) {
    const x =
        sample < 1198 ? random() * 360 - 180 : sample === 1198 ? -1000 : 1000,
      z = random() * 300 - 150;
    let best = Infinity;
    for (const path of world.network.paths)
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i],
          b = path[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z,
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
            ),
          );
        best = Math.min(
          best,
          Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - path.waterWidth,
        );
      }
    const p = world.nearest(x, z);
    near(Math.hypot(x - p.x, z - p.z) - p.waterWidth, best);
  }
  const fixed = world.race.network,
    p = fixed.paths[0][4],
    n = nearestOnTrack(fixed, p.x, p.z);
  near(Math.hypot(p.x - n.x, p.z - n.z), 0);
});

test("graded campaign terrain meets the banks without sliver folds or far-field subdivision cost", () => {
  const ground = landGeometry(world.network, 10.1),
    p = ground.attributes.position,
    n = ground.attributes.normal;
  assert.ok(
    ground.index.count / 3 < 5000,
    "keep distant grass cheap on mobile",
  );
  for (let i = 0; i < p.count; i++) {
    near(p.getY(i), 0.35, 1e-6);
    assert.ok(n.getY(i) > 0.99);
    const q = world.nearest(p.getX(i), p.getZ(i));
    assert.ok(
      Math.hypot(p.getX(i) - q.x, p.getZ(i) - q.z) >= q.waterWidth + 1.04,
    );
  }
  ground.dispose();
});
test("three ordered laps stop the clock and unlock the gate without resetting boat momentum; old five-lap scores remain readable", () => {
  const r = new Race(world.race.gates, 6.5, 3),
    c = new Campaign(world);
  let before = world.race.sample(0);
  assert.equal(c.finishRace(r), false);
  for (let d = 0.25; !r.done && d < world.race.length * 3 + 1; d += 0.25) {
    const b = world.race.sample(d);
    r.step(before, b, 1 / 120, defaults);
    before = b;
  }
  assert.equal(r.laps.length, 3);
  assert.equal(r.done, true);
  const time = r.total;
  const boat = { x: before.x, z: before.z, vx: 14, vz: 3, angle: 1, pump: 0.8 },
    prior = { ...boat };
  assert.equal(c.finishRace(r), true);
  assert.deepEqual(boat, prior);
  assert.equal(c.gateState, "opening");
  r.step(before, before, 10, defaults);
  assert.equal(r.total, time);
  const store = memory();
  for (const laps of [3, 5])
    saveScore(
      store,
      {
        id: String(laps),
        course: "fixture",
        version: "old-or-new",
        total: 30,
        laps: Array(laps).fill(30 / laps),
        ...(laps === 3 ? { lapCount: 3 } : {}),
      },
      "Driver",
    );
  assert.equal(readScores(store).length, 2);
});
test("closed and opening exit gates physically stop swept crossings; an open forward crossing starts the bonus", () => {
  const c = new Campaign(world),
    g = world.gate,
    b = { ...at(g, 3), vx: g.tx * 20, vz: g.tz * 20 };
  c.step(at(g, -3), b, 0.05);
  assert.equal(c.phase, "RACE");
  assert.ok((b.x - g.x) * g.tx + (b.z - g.z) * g.tz < 0);
  c.finishRace({ done: true, laps: [1, 1, 1], total: 3 });
  const opening = { ...at(g, 3), vx: g.tx * 20, vz: g.tz * 20 };
  c.step(at(g, -3), opening, 0.05);
  assert.ok((opening.x - g.x) * g.tx + (opening.z - g.z) * g.tz < 0);
  assert.equal(c.phase, "EXIT");
  c.gateOpen = 1;
  const forward = { ...at(g, 2), vx: g.tx * 20, vz: g.tz * 20 };
  c.step(at(g, -2), forward, 0.05);
  assert.equal(c.phase, "RIVER");
  assert.ok(Math.hypot(forward.vx, forward.vz) > 19);
  assert.equal(crossesGate(at(g, 2), at(g, -2), g), false);
  assert.equal(
    crossesGate(at(g, -2, g.halfWidth + 1), at(g, 2, g.halfWidth + 1), g),
    false,
  );
  for (let side = -20; side <= 20; side += 0.5) {
    const p = at(g, 0, side),
      n = world.nearest(p.x, p.z);
    if (Math.hypot(p.x - n.x, p.z - n.z) < n.hullLimit)
      assert.ok(
        Math.abs(side) < g.halfWidth,
        "gate covers every navigable line across its channel",
      );
  }
});
test("river current acts downstream in world space without changing heading, pump or steering; course water has no current", () => {
  const c = riverFixture(),
    p = world.river.sample(70),
    b = { ...p, angle: 1, pump: 0.7, vx: p.tx * 12, vz: p.tz * 12 },
    prior = { ...b };
  c.beforePhysics(b, 0.05);
  assert.ok((b.vx - prior.vx) * p.tx + (b.vz - prior.vz) * p.tz < 0);
  near(b.angle, prior.angle);
  near(b.pump, prior.pump);
  const s = world.race.sample(20),
    onTrack = { ...s, vx: 12, vz: 2, angle: 0 },
    copy = { ...onTrack };
  c.beforePhysics(onTrack, 0.05);
  assert.deepEqual(onTrack, copy);
  c.phase = "ARRIVED";
  const returning = { ...p, angle: 1, pump: 0, vx: 0, vz: 0 };
  c.beforePhysics(returning, 0.05);
  assert.ok(
    returning.vx * p.tx + returning.vz * p.tz < 0,
    "river still flows when revisited after arrival",
  );
});
test("bonus checkpoints require order, direction and channel width; speed and clean navigation award bounded scores once", () => {
  const c = riverFixture(),
    first = world.checkpoints[0],
    last = world.checkpoints.at(-1);
  c.step(at(last, -1), at(last, 1), 0.05);
  assert.equal(c.checkpoint, 0);
  assert.equal(c.phase, "RIVER");
  c.step(at(first, 1), at(first, -1), 0.05);
  assert.equal(c.checkpoint, 0);
  c.step(at(first, -1, 8), at(first, 1, 8), 0.05);
  assert.equal(c.checkpoint, 0);
  c.step(at(first, -1), at(first, 1), 1);
  assert.equal(c.checkpoint, 1);
  const score = c.score;
  assert.ok(score >= 175 && score <= 475);
  c.step(at(first, 1), at(first, -1), 0.05);
  c.step(at(first, -1), at(first, 1), 0.05);
  assert.equal(c.score, score);
  const fast = riverFixture(),
    slow = riverFixture(),
    dirty = riverFixture();
  fast.step(at(first, -1), at(first, 1), 1);
  slow.step(at(first, -1), at(first, 1), 10);
  dirty.step(at(first, -1), { ...at(first, 1), collisionImpulse: 3 }, 1);
  assert.ok(fast.score > slow.score);
  assert.equal(fast.score - dirty.score, 75);
});
test("optional side jump can be bypassed; a powered ramp crossing flies and lands under gravity without rotating velocity", () => {
  const c = riverFixture(),
    j = river1.jump,
    g = c.jumpGate,
    p = world.river.sample(j.distance),
    offset = j.side * j.offset;
  const bypass = riverFixture();
  bypass.step(at(g, -1), { ...at(g, 1), vx: p.tx * 10, vz: p.tz * 10 }, 0.05);
  assert.equal(bypass.airborne, false);
  const b = {
    ...at(g, 1, offset),
    vx: p.tx * 10,
    vz: p.tz * 10,
    angle: Math.atan2(p.tz, p.tx),
    yawRate: 0.2,
  };
  c.step(at(g, -1, offset), b, 0.05);
  assert.equal(c.airborne, true);
  const v = [b.vx, b.vz],
    origin = { x: b.x, z: b.z };
  let peak = 0;
  for (let i = 0; i < 120 && c.airborne; i++) {
    c.beforePhysics(b, 1 / 120);
    peak = Math.max(peak, c.height);
  }
  assert.ok(peak > 0.4);
  assert.equal(c.airborne, false);
  assert.equal(c.height, 0);
  assert.deepEqual([b.vx, b.vz], v);
  assert.ok(Math.hypot(b.x - origin.x, b.z - origin.z) > 5);
  assert.equal(c.jumpAwarded, true);
  assert.equal(c.score, 150);
});
test("stage factory and progression take definitions rather than requiring new per-stage logic", () => {
  const alternate = createCampaignWorld({
      raceDefinition: { ...track1, id: "test-race", laps: 2 },
      riverDefinition: { ...river1, id: "test-river", current: 1.2 },
      destinationDefinition: { ...track2, id: "test-destination", number: 7 },
    }),
    c = new Campaign(alternate);
  assert.equal(c.finishRace({ done: true, laps: [1, 1, 1], total: 3 }), false);
  assert.equal(c.finishRace({ done: true, laps: [1, 1], total: 2 }), true);
  c.phase = "ARRIVED";
  assert.equal(c.inspect().course, "test-destination");
  assert.equal(
    c.cue({ ...alternate.destination.sample(10), angle: 0 }, 0.05, {}).text,
    "TRACK 07",
  );
});
test("destination preparation completes in bounded jobs, batches its props, and never grows on repeat visits", () => {
  const old = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
    }),
  };
  try {
    // Three.js construction is the same implementation used by main.js.
    const scene = {
        children: [],
        add(...items) {
          this.children.push(...items);
        },
      },
      scenery = new CampaignScenery(scene, world);
    assert.equal(scenery.inspect().status, "queued");
    for (let i = 0; i < 5; i++) scenery.prepareOne();
    assert.equal(scenery.inspect().status, "ready");
    assert.ok(scenery.destination.children.length <= 6);
    const count = scenery.destination.children.length;
    for (let i = 0; i < 100; i++) scenery.prepareOne();
    assert.equal(scenery.prepared, 5);
    assert.equal(scenery.destination.children.length, count);
  } finally {
    globalThis.document = old;
  }
});
test("campaign storage migrates additively, keeps tuning intact, and rejects shortcut unlocks", () => {
  const store = memory();
  store.setItem(settingsKey, "existing tune");
  store.setItem(
    campaignKey,
    JSON.stringify({ schema: 1, unlocked: 1, bestRace: 42, bestBonus: 90 }),
  );
  const p = new CampaignProgress(store);
  p.race(38);
  p.arrive(400);
  assert.equal(new CampaignProgress(store).values.unlocked, 2);
  assert.equal(store.getItem(settingsKey), "existing tune");
  const c = new Campaign(world, p);
  c.practice = true;
  c.phase = "RIVER";
  c.gateOpen = 1;
  c.checkpoint = world.checkpoints.length - 1;
  c.step(
    at(world.checkpoints.at(-1), -1),
    at(world.checkpoints.at(-1), 1),
    0.05,
  );
  assert.equal(p.values.bestBonus, 400);
  p.reset();
  assert.equal(p.values.unlocked, 1);
  assert.equal(store.getItem(settingsKey), "existing tune");
});
test("all persistent tuning families retain every changed value across release metadata and a new visit", () => {
  const store = memory(),
    game = new SettingsStore(store),
    audio = new AudioSettings(store),
    video = new SummerSettings(store, true),
    view = new CameraSettings(store);
  for (const [id, s] of Object.entries(registry))
    if (id !== "physicsPreset")
      game.set(
        id,
        s.type === "number"
          ? s.max
          : s.type === "boolean"
            ? !s.default
            : s.options.at(-1),
      );
  for (const [id, s] of Object.entries(audioControls)) audio.set(id, s.max);
  for (const [id, s] of Object.entries(summerControls)) video.set(id, s.max);
  for (const [mode, values] of Object.entries(cameraDefaults))
    for (const key of Object.keys(values))
      view.set(mode, key, controlFor(mode, key).max);
  view.select("overhead");
  game.flush();
  audio.flush();
  const raw = JSON.parse(store.getItem(settingsKey));
  raw.gameVersion = "0.16.0-before-deployment";
  store.setItem(settingsKey, JSON.stringify(raw));
  assert.deepEqual(new SettingsStore(store).values, game.values);
  assert.deepEqual(new AudioSettings(store).values, audio.values);
  assert.deepEqual(new SummerSettings(store).values, video.values);
  assert.deepEqual(new CameraSettings(store).modes, view.modes);
  assert.equal(new CameraSettings(store).mode, "overhead");
  assert.ok(store.getItem(AUDIO_KEY));
});

test("a binary-input driver races three laps, follows the exit, fights the current and reaches Track 2 continuously", () => {
  const store = memory(),
    progress = new CampaignProgress(store),
    c = new Campaign(world, progress),
    r = new Race(world.race.gates, 6.5, 3),
    nav = new RouteNavigator(world.race, 6.5),
    s = world.race.sample(0);
  const b = {
      x: s.x,
      z: s.z,
      angle: Math.atan2(s.tz, s.tx),
      vx: 0,
      vz: 0,
      yawRate: 0,
    },
    before = {},
    phases = [];
  let finishTime = null;
  for (let i = 0; i < 120 * 600 && c.phase !== "ARRIVED"; i++) {
    const phase = c.phase;
    let target;
    if (phase === "RACE" || (phase === "EXIT" && !c.exitApproach)) {
      const guide = phase === "RACE" ? r : c.exitGuide,
        prev =
          world.race.gates[
            (guide.next + world.race.gates.length - 1) % world.race.gates.length
          ],
        end =
          guide.next === 0
            ? world.race.length
            : world.race.gates[guide.next].distance;
      const d = world.race.project(b, prev.distance - 8, end + 25).distance,
        cue =
          phase === "RACE" ? nav.update(b, r, 1 / 120) : c.cue(b, 1 / 120, {});
      target = cue.wrong
        ? { x: cue.targetX, z: cue.targetZ }
        : world.race.sample(d + 8);
    } else {
      const cue = c.cue(b, 1 / 120, {});
      if (phase === "EXIT") {
        const p = world.river.project(b, 0, 25);
        target = world.river.sample(p.distance + 8);
      } else {
        const g = world.checkpoints[c.checkpoint],
          prev = c.checkpoint
            ? world.checkpoints[c.checkpoint - 1].distance
            : river1.gateDistance,
          p = world.river.project(
            b,
            Math.max(0, prev - 8),
            Math.min(world.river.length, g.distance + 20),
          );
        target = cue.wrong
          ? { x: cue.targetX, z: cue.targetZ }
          : world.river.sample(Math.min(g.distance + 2, p.distance + 8));
      }
    }
    const angle = Math.atan2(target.z - b.z, target.x - b.x),
      error = Math.atan2(Math.sin(angle - b.angle), Math.cos(angle - b.angle)),
      speed = Math.hypot(b.vx, b.vz);
    const input = {
      throttle:
        speed < (phase === "RIVER" ? 11 : 9) ||
        (Math.abs(error) > 0.35 && speed < 12),
      left: error - (b.yawRate || 0) * 0.3 < -0.08,
      right: error - (b.yawRate || 0) * 0.3 > 0.08,
    };
    before.x = b.x;
    before.z = b.z;
    if (c.beforePhysics(b, 1 / 120)) stepBoat(b, input, 1 / 120, world.nearest);
    c.step(before, b, 1 / 120);
    if (c.phase === "RACE") {
      r.step(before, b, 1 / 120, defaults);
      if (r.done) {
        c.finishRace(r);
        finishTime = r.total;
      }
    }
    assert.ok(
      Math.hypot(b.x - before.x, b.z - before.z) < 1,
      "no teleport or forced relocation",
    );
    if (phase !== c.phase) {
      phases.push(c.phase);
      assert.ok(
        Math.hypot(b.vx, b.vz) > 1,
        "control/momentum remains active at transitions",
      );
    }
  }
  assert.deepEqual(phases, ["EXIT", "RIVER", "ARRIVED"]);
  assert.equal(r.laps.length, 3);
  assert.equal(r.total, finishTime);
  assert.equal(c.checkpoint, world.checkpoints.length);
  assert.ok(c.score > 500);
  assert.equal(progress.values.unlocked, 2);
  assert.equal(c.practice, false);
});
