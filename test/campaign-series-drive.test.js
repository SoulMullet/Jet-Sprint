import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignAdventure } from "../src/campaign-world.js";
import { CampaignTour } from "../src/campaign-tour.js";
import { CampaignProgress } from "../src/campaign-progress.js";
import { RaceStart } from "../src/race-start.js";
import { stepBoat, settings } from "../src/physics.js";
import { ControlInput } from "../src/control-input.js";
import { ControlSettings } from "../src/control-settings.js";
test("actual input pipeline drives the complete seven-event campaign without a transition teleport", (t) => {
  const w = createCampaignAdventure(),
    map = new Map(),
    progress = new CampaignProgress({
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, v),
    }),
    tour = new CampaignTour(w, progress),
    start = new RaceStart(),
    p = w.courses[0].sample(0),
    b = { x: p.x, z: p.z, angle: Math.atan2(p.tz, p.tx), vx: 0, vz: 0 };
  tour.begin();
  start.begin(0, 2);
  const processor = new ControlInput(
    new ControlSettings({ getItem: () => null, setItem() {} }),
  );
  let now = 0;
  const before = {};
  for (let i = 0; i < 120 * 3500 && tour.phase !== "CHAMPION"; i++) {
    const dt = 1 / 120;
    now += dt;
    start.update(now);
    if (tour.index === 0 && tour.phase === "RACE" && start.state !== "RACING")
      continue;
    const cue = tour.cue(b, dt, {});
    let target,
      desired = tour.index >= 2 ? 7 : 9;
    if (tour.phase === "RACE") {
      const c = tour.venue,
        r = tour.race,
        prev = c.gates[(r.next + c.gates.length - 1) % c.gates.length],
        end = r.next === 0 ? c.length : c.gates[r.next].distance,
        d = c.project(b, prev.distance - 8, end + 25).distance;
      target = cue.wrong
        ? { x: cue.targetX, z: cue.targetZ }
        : c.sample(d + (tour.index >= 2 ? 5 : 8));
    } else if (tour.phase === "EXIT") {
      if (!tour.leaf.exitApproach) target = { x: cue.targetX, z: cue.targetZ };
      else {
        const p = tour.leaf.world.river.project(b, 0, 100);
        target = tour.leaf.world.river.sample(p.distance + 10);
      }
    } else if (tour.phase === "RIVER") {
      const g = tour.leaf.world.checkpoints[tour.checkpoint],
        prev = tour.checkpoint
          ? tour.leaf.world.checkpoints[tour.checkpoint - 1].distance
          : tour.river.gateDistance,
        p = tour.leaf.world.river.project(
          b,
          Math.max(0, prev - 8),
          Math.min(tour.leaf.world.river.length, g.distance + 20),
        );
      target = cue.wrong
        ? { x: cue.targetX, z: cue.targetZ }
        : tour.leaf.world.river.sample(
            Math.min(g.distance + 2, p.distance + 10),
          );
      desired = 15;
    } else {
      const p = tour.stagingPath.project(b, 0, tour.stagingPath.length);
      target = cue.wrong
        ? { x: cue.targetX, z: cue.targetZ }
        : tour.stagingPath.sample(p.distance + 10);
      desired = 10;
    }
    const error = Math.atan2(
        Math.sin(Math.atan2(target.z - b.z, target.x - b.x) - b.angle),
        Math.cos(Math.atan2(target.z - b.z, target.x - b.x) - b.angle),
      ),
      speed = Math.hypot(b.vx, b.vz),
      steer = error - (b.yawRate || 0) * 0.3;
    // Proportional analog steering avoids a bang-bang driver's unstable
    // threshold loops at hairpins across V8 versions. The real input shaping
    // and boat integrator remain active; no recovery ever repositions the boat.
    processor.set(
      "gamepad",
      Math.max(-1, Math.min(1, steer * 4)),
      Number(speed < desired || (Math.abs(error) > 0.35 && speed < 12)),
      true,
    );
    const processed = processor.update(dt, speed / (settings.top / 3.6));
    before.x = b.x;
    before.z = b.z;
    if (tour.beforePhysics(b, dt)) stepBoat(b, processed, dt, w.nearest);
    const change = tour.step(before, b, dt, settings, now, start);
    if (change === "race-complete") start.finish();
    if (change === "arrival") start.begin(now, 2);
    if (Math.hypot(b.x - before.x, b.z - before.z) > 1)
      throw Error(
        "Jump " + JSON.stringify({ i, phase: tour.phase, b, before }),
      );
  }
  assert.equal(
    tour.phase,
    "CHAMPION",
    JSON.stringify({
      ...tour.inspect(),
      next: tour.race.next,
      laps: tour.race.laps,
      boat: b,
    }),
  );
  assert.equal(tour.results.length, 4);
  assert.equal(tour.completedRivers, 3);
  assert.ok(progress.values.wallet >= 10250 && progress.values.wallet <= 15400);
  assert.equal(progress.values.unlocked, 4);
  for (const e of Object.values(progress.values.events))
    assert.equal(e.completions, 1);
  const riverTimes = w.legs.map(
    (l) => progress.values.events[l.river.id].bestTime,
  );
  for (const [i, time] of riverTimes.entries()) {
    assert.ok(
      time >= w.legs[i].riverDefinition.targetSeconds[0] &&
        time <= w.legs[i].riverDefinition.targetSeconds[1],
      JSON.stringify(riverTimes),
    );
  }
  assert.ok(now < 3500);
  t.diagnostic(
    JSON.stringify({
      riverTimes,
      raceTimes: tour.results.map((r) => r.total),
      wallet: progress.values.wallet,
      runSeconds: now,
      continuousInputPipeline: true,
    }),
  );
});
