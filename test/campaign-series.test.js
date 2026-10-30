import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  campaignDefinition,
  campaignEvents,
  track1,
} from "../src/campaign-data.js";
import {
  createCampaignAdventure,
  sliceCampaignNetwork,
} from "../src/campaign-world.js";
import { CampaignTour } from "../src/campaign-tour.js";
import { CampaignProgress, campaignKey } from "../src/campaign-progress.js";
import {
  normalizeLedger,
  beginAttempt,
  creditCompletion,
} from "../src/campaign-rewards.js";
import {
  ChunkQueue,
  CampaignStreamer,
  tileBounds,
  tileKey,
} from "../src/campaign-streaming.js";
import { buildChunkGeometry } from "../src/campaign-chunk-geometry.js";
import { RaceStart } from "../src/race-start.js";
import { stepBoat, settings } from "../src/physics.js";
const w = createCampaignAdventure();
const memory = () => {
  const data = new Map();
  return {
    data,
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
const at = (g, d) => ({ x: g.x + g.tx * d, z: g.z + g.tz * d });
const packet = (bounds) => {
  const n = sliceCampaignNetwork(w.network, bounds);
  return {
    bounds,
    paths: n.paths.map((p) => ({
      id: p.id,
      width: p.waterWidth,
      points: p.map((q) => [q.x, q.z]),
    })),
  };
};

test("four distinct authored three-lap courses increase route complexity; Track 1 circuit remains unchanged", () => {
  assert.deepEqual(
    w.courses.map((c) => c.gates.length),
    [17, 21, 34, 44],
  );
  assert.deepEqual(
    campaignDefinition.tracks.map((t) => t.laps),
    [3, 3, 3, 3],
  );
  assert.equal(w.courses[0].length, 505.53518056060074);
  assert.equal(track1.waterWidth, 9);
  assert.deepEqual(track1.spline[0], [-80, 35]);
  assert.equal(new Set(w.courses.map((c) => JSON.stringify(c.line))).size, 4);
  assert.equal(campaignEvents.length, 7);
  for (const c of w.courses) {
    assert.ok(c.gates.every((g) => Number.isFinite(g.x) && g.halfWidth > 5));
    assert.ok(c.gates.every((g) => g.accept(g.x, g.z)));
  }
});
test("extended wide rivers physically join both racing courses through a staging inlet", () => {
  for (const [i, leg] of w.legs.entries()) {
    assert.ok(leg.river.length > [1500, 2200, 3100][i]);
    assert.ok(leg.riverDefinition.waterWidth >= 10.5);
    const inlet = w.staging[i + 1],
      r = leg.river.sample(leg.river.length),
      s = inlet.sample(0),
      e = inlet.sample(inlet.length),
      start = w.courses[i + 1].sample(0);
    assert.ok(Math.hypot(r.x - s.x, r.z - s.z) < 1e-6);
    assert.ok(Math.hypot(e.x - start.x, e.z - start.z) < 1e-6);
    for (const path of [leg.river, inlet])
      for (let d = 0; d <= path.length; d += 5) {
        const p = path.sample(d),
          n = w.nearest(p.x, p.z);
        assert.ok(
          Math.hypot(p.x - n.x, p.z - n.z) < 0.02,
          "connected collision water",
        );
      }
    const mouth = leg.river.sample(10);
    assert.equal(
      w.nearest(mouth.x, mouth.z).waterWidth,
      w.definition.tracks[i].waterWidth,
    );
  }
});
test("exact first clean campaign pays $15,400; successful replay pays bases only", () => {
  const p = new CampaignProgress(memory());
  for (const e of campaignEvents) {
    const a = p.begin(e.id),
      reward = p.complete(a, { time: 100, clean: true });
    assert.equal(reward.prize, e.prize);
    assert.equal(reward.cleanBonus, e.cleanPrize);
    assert.equal(p.complete(a, { time: 99, clean: true }), null);
  }
  assert.equal(p.values.wallet, 15400);
  assert.equal(p.values.lifetimeEarnings, 15400);
  assert.equal(p.values.unlocked, 4);
  for (const e of campaignEvents) {
    const a = p.begin(e.id),
      reward = p.complete(a, { time: 90, clean: true });
    assert.equal(reward.cleanBonus, 0);
    assert.equal(reward.personalBest, true);
    assert.equal(p.values.events[e.id].completions, 2);
    assert.equal(p.values.events[e.id].cleanClears, 2);
  }
  assert.equal(p.values.wallet, 25650);
  assert.equal(p.values.lifetimeEarnings, 25650);
});
test("dirty clear does not claim clean achievement; its first later clean replay earns it once", () => {
  const p = new CampaignProgress(memory()),
    id = campaignEvents[1].id;
  let a = p.begin(id);
  assert.equal(p.complete(a, { time: 125, clean: false }).total, 250);
  assert.equal(p.values.events[id].cleanBonusClaimed, false);
  a = p.begin(id);
  assert.equal(p.complete(a, { time: 120, clean: true }).total, 400);
  a = p.begin(id);
  assert.equal(p.complete(a, { time: 130, clean: true }).total, 250);
  assert.equal(p.values.wallet, 900);
});
test("stale, duplicate, overlapping and reloaded attempt callbacks cannot pay twice", () => {
  const db = memory(),
    p = new CampaignProgress(db),
    id = track1.id,
    a = p.begin(id),
    b = p.begin(id);
  assert.equal(p.complete(a, { time: 50, clean: true }), null);
  assert.equal(p.complete(b, { time: 55, clean: true }).total, 750);
  const reloaded = new CampaignProgress(db);
  assert.equal(reloaded.complete(b, { time: 55, clean: true }), null);
  assert.equal(reloaded.values.wallet, 750);
  const anotherTab = new CampaignProgress(db),
    c = anotherTab.begin(id);
  assert.equal(p.complete(b, { time: 50, clean: true }), null);
  assert.equal(anotherTab.complete(c, { time: 60, clean: true }).total, 500);
  assert.equal(new CampaignProgress(db).values.wallet, 1250);
  assert.equal(p.complete(c, { time: 60, clean: true }), null);
});
test("schema-1 records migrate without retroactive cash or loss of tuning/best times", () => {
  const db = memory();
  for (const key of [
    "jet-sprint-settings",
    "jet-sprint-controls-v1",
    "jet-sprint-v8-settings",
    "jet-sprint-cameras-v1",
    "jet-sprint-summer-graphics-v1",
    "jet-sprint-races-v1",
  ])
    db.setItem(key, "retained " + key);
  const originals = new Map(db.data);
  db.setItem(
    campaignKey,
    JSON.stringify({
      schema: 1,
      unlocked: 2,
      bestRace: 42,
      bestBonus: 900,
      bestRaces: { [track1.id]: 42 },
    }),
  );
  const p = new CampaignProgress(db);
  assert.equal(p.values.wallet, 0);
  assert.equal(p.values.events[track1.id].bestTime, 42);
  assert.equal(p.values.events[track1.id].cleanBonusClaimed, false);
  const a = p.begin(track1.id),
    r = p.complete(a, { time: 50, clean: true });
  assert.equal(r.personalBest, false);
  assert.equal(p.values.bestRace, 42);
  assert.equal(p.values.unlocked, 2);
  for (const [k, v] of originals) assert.equal(db.getItem(k), v);
  assert.equal(JSON.parse(db.getItem(campaignKey)).schema, 2);
});
test("bad currency values are sanitized and unsupported or invalid transactions rejected", () => {
  const ledger = normalizeLedger({
    wallet: -1,
    lifetimeEarnings: "cash",
    events: { [track1.id]: { sequence: 2, paidSequence: 999, bestTime: NaN } },
  });
  assert.equal(ledger.wallet, 0);
  assert.equal(ledger.events[track1.id].paidSequence, 2);
  assert.equal(normalizeLedger(null).wallet, 0);
  assert.equal(
    creditCompletion(ledger, { eventId: track1.id, sequence: 2 }, { time: 10 }),
    null,
  );
  assert.equal(
    creditCompletion(ledger, { eventId: "fake", sequence: 2 }, { time: 10 }),
    null,
  );
  assert.throws(() => beginAttempt(ledger, "fake"));
  for (const time of [0, -1, NaN, Infinity])
    assert.equal(
      creditCompletion(ledger, { eventId: track1.id, sequence: 3 }, { time }),
      null,
    );
});
test("storage failure remains playable, warns about unsaved funds and supports retry without another payout", () => {
  const db = memory();
  let blocked = false;
  const p = new CampaignProgress({
      getItem: db.getItem,
      setItem: (k, v) => {
        if (blocked) throw Error("quota");
        db.setItem(k, v);
      },
    }),
    a = p.begin(track1.id);
  blocked = true;
  assert.equal(p.complete(a, { time: 50, clean: true }).pending, true);
  assert.equal(p.values.wallet, 750);
  assert.match(p.warning, /not saved/);
  assert.equal(p.complete(a, { time: 50, clean: true }), null);
  blocked = false;
  assert.equal(p.retry(), true);
  assert.equal(new CampaignProgress(db).values.wallet, 750);
});
test("staging countdown cannot start a race from far away, before green, or in reverse; valid start retains momentum", () => {
  const tour = new CampaignTour(w, new CampaignProgress(memory()));
  tour.index = 1;
  tour.configureRace();
  tour.phase = "STAGING";
  tour.practice = true;
  const g = tour.venue.gates[0],
    b = {
      ...at(g, 1),
      vx: g.tx * 12,
      vz: g.tz * 12,
      angle: 1,
      pump: 0.7,
      steering: 0.4,
    };
  tour.step(at(g, -1), b, 1 / 120, settings, 10, { state: "COUNTDOWN" });
  assert.equal(tour.phase, "STAGING");
  tour.step(at(g, 1), { ...at(g, -1), vx: 0, vz: 0 }, 1 / 120, settings, 11, {
    state: "RACING",
  });
  assert.equal(tour.phase, "STAGING");
  tour.eventClean = false;
  const previous = { ...b };
  assert.equal(
    tour.step(at(g, -1), b, 1 / 120, settings, 12, { state: "RACING" }),
    "race-start",
  );
  assert.equal(tour.raceOrigin, 12);
  assert.equal(tour.race.total, 0);
  assert.equal(tour.eventClean, true);
  assert.equal(b.pump, previous.pump);
  assert.equal(b.angle, previous.angle);
  assert.equal(b.vx, previous.vx);
});
test("significant contacts/grounding disqualify the current event; gentle contact does not", () => {
  const tour = new CampaignTour(w),
    p = w.courses[0].sample(10),
    b = { ...p, vx: 0, vz: 0, collisionImpulse: 1.4 };
  tour.contact(b);
  assert.equal(tour.eventClean, true);
  b.collisionImpulse = 1.6;
  tour.contact(b);
  assert.equal(tour.eventClean, false);
  tour.eventClean = true;
  tour.markRespawn();
  assert.equal(tour.eventClean, false);
  tour.eventClean = true;
  tour.contact({ x: 900, z: 900, vx: 0, vz: 0 });
  assert.equal(tour.eventClean, false);
});
test("all seven developer practice events leave wallet and legitimate progression untouched", () => {
  const db = memory(),
    p = new CampaignProgress(db),
    tour = new CampaignTour(w, p),
    before = JSON.stringify(p.values);
  for (let stage = 0; stage < 7; stage++) {
    const b = tour.practiceStage(stage);
    assert.ok(Number.isFinite(b.x));
    tour.finishEvent(tour.event.id, 50);
    assert.equal(tour.reward.practice, true);
  }
  assert.equal(JSON.stringify(p.values), before);
  assert.equal(db.getItem(campaignKey), null);
  assert.throws(() => tour.practiceStage(7));
});
test("chunk queue is incremental, deduplicates requests and disposes owned resources once", () => {
  let created = 0,
    disposed = 0;
  const q = new ChunkQueue({
    create: (c, v) => {
      created++;
      return v ?? {};
    },
    dispose: () => disposed++,
  });
  q.request([{ key: "a", priority: 0 }]);
  q.request([{ key: "a", priority: 0 }]);
  q.step();
  assert.equal(q.inspect().building, 1);
  assert.equal(created, 1);
  q.step();
  q.step();
  q.step();
  assert.equal(q.inspect().ready, 1);
  assert.equal(created, 3);
  q.request([]);
  q.evict(() => true);
  q.evict(() => true);
  assert.equal(disposed, 1);
  assert.equal(q.chunks.size, 0);
});
test("pending worker jobs cannot be duplicated/evicted; failed jobs degrade explicitly and can retry", async () => {
  let resolve,
    disposed = 0,
    fail = true;
  const q = new ChunkQueue({
    create: () => new Promise((r) => (resolve = r)),
    dispose: () => disposed++,
    fallback: () => ({ simple: true }),
  });
  q.request([{ key: "a", priority: 0 }]);
  q.step();
  q.step();
  q.request([]);
  q.evict(() => true);
  assert.equal(disposed, 0);
  resolve({});
  await Promise.resolve();
  q.evict(() => true);
  assert.equal(disposed, 1);
  const f = new ChunkQueue({
    create: () => {
      if (fail) throw Error("asset failed");
      return {};
    },
    dispose() {},
    fallback: () => ({ safe: true }),
  });
  f.request([{ key: "a", priority: 0 }]);
  f.step();
  assert.equal(f.inspect().fallback, 1);
  assert.match(f.chunks.get("a").error, /asset failed/);
  fail = false;
  f.retry();
  for (let i = 0; i < 3; i++) f.step();
  assert.equal(f.inspect().ready, 1);
});
test("stream requests remain bounded over the whole world and preload the next starting area", () => {
  const m = new THREE.MeshStandardMaterial(),
    stream = new CampaignStreamer(new THREE.Scene(), w, {
      water: m,
      ground: m,
      bank: m,
    });
  stream.queue = new ChunkQueue({ create: (c, v) => v ?? {}, dispose() {} });
  const tour = new CampaignTour(w);
  for (const [i, leg] of w.legs.entries()) {
    tour.index = i;
    for (let d = 0; d < leg.river.length; d += 70) {
      const b = leg.river.sample(d),
        before = { ...b };
      stream.update(0.25, b, tour);
      assert.ok(stream.queue.chunks.size <= 49);
      assert.deepEqual(b, before);
    }
    const b = leg.river.sample(leg.river.length - 150);
    for (let i = 0; i < 150; i++) stream.update(0.05, b, tour);
    const next = w.courses[i + 1].sample(0),
      key = tileKey(Math.floor(next.x / 160), Math.floor(next.z / 160));
    assert.equal(stream.queue.chunks.get(key).status, "ready");
  }
  assert.ok(stream.queue.disposals > 0);
});
test("adjacent streamed tiles share exact water boundary samples and remain a level world-space surface", () => {
  const r = w.legs[0].river;
  let crossing;
  for (let i = 0; i < r.line.length - 1; i++) {
    const a = r.line[i],
      b = r.line[i + 1];
    if (a.x * b.x < 0 && a.z < -200) {
      crossing = a;
      break;
    }
  }
  assert.ok(crossing);
  const z = Math.floor(crossing.z / 160),
    left = buildChunkGeometry(packet(tileBounds(-1, z))),
    right = buildChunkGeometry(packet(tileBounds(0, z)));
  const edge = (g) => {
    const p = g.water.attributes.position.array,
      set = new Set();
    for (let i = 0; i < p.length; i += 3) {
      assert.ok(Math.abs(p[i + 1]) < 1e-5);
      if (Math.abs(p[i]) < 1e-5) set.add(Number(p[i + 2].toFixed(3)));
    }
    return [...set].sort((a, b) => a - b);
  };
  assert.deepEqual(edge(left), edge(right));
  assert.ok(edge(left).length > 2);
});

test("resume starts only an unlocked venue in its physical staging area and grants no money", () => {
  const db = memory(),
    p = new CampaignProgress(db),
    tour = new CampaignTour(w, p);
  assert.throws(() => tour.resume(1), /locked/);
  p.values.unlocked = 2;
  p.save();
  const before = p.values.wallet,
    start = tour.resume(1),
    entry = w.staging[1].sample(0);
  assert.deepEqual(start, entry);
  assert.equal(tour.phase, "STAGING");
  assert.equal(tour.attempt, null);
  assert.equal(p.values.wallet, before);
  assert.equal(tour.practice, false);
});
test("a pre-green restart cannot consume race checkpoints or pay a reward", () => {
  const tour = new CampaignTour(w, new CampaignProgress(memory()));
  tour.practiceStage(2);
  const g = tour.race.gates[1];
  tour.step(at(g, -1), { ...at(g, 1), vx: 0, vz: 0 }, 1 / 120, settings, 1, {
    state: "COUNTDOWN",
    startAt: 5,
  });
  assert.equal(tour.race.next, 1);
  assert.equal(tour.race.total, 0);
  assert.equal(tour.reward, null);
});

test("copy-on-write migration leaves v1 intact and an older tab cannot overwrite the v2 wallet", () => {
  const db = memory(),
    legacy = JSON.stringify({
      schema: 1,
      unlocked: 2,
      bestRace: 45,
      bestBonus: 300,
    });
  db.setItem("jet-sprint-campaign-v1", legacy);
  const p = new CampaignProgress(db);
  assert.equal(p.values.unlocked, 2);
  assert.equal(p.values.events[track1.id].bestTime, 45);
  const a = p.begin(track1.id);
  p.complete(a, { time: 50, clean: true });
  assert.equal(db.getItem("jet-sprint-campaign-v1"), legacy);
  db.setItem(
    "jet-sprint-campaign-v1",
    JSON.stringify({ schema: 1, unlocked: 1 }),
  );
  const next = new CampaignProgress(db);
  assert.equal(next.values.wallet, 750);
  assert.equal(next.values.unlocked, 2);
  assert.equal(next.values.events[track1.id].bestTime, 45);
});
