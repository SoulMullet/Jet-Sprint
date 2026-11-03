import { RiverRunTour } from "../river-run.js";
import { boatPerformance, standardUpgradeBalance } from "../garage/upgrades.js";
export const ARCADE_RECORD_KEY = "jet-sprint-arcade-river-records-v1";
export const arcadeControlPreset = Object.freeze({
  id: "arcade-drag-auto-v1",
  throttle: "automatic",
  steering: "relative-drag",
  jump: "ramps",
});
export function applyArcadeControls(input, allowed, racing, done) {
  input.throttle = allowed && racing && !done ? 1 : 0;
  input.nitrous = false;
  return input;
}
export class ArcadeRecords {
  constructor(storage, levels) {
    this.storage = storage;
    this.levels = levels;
    this.warning = "";
    this.values = { schema: 1, records: {} };
    try {
      const raw = JSON.parse(storage.getItem(ARCADE_RECORD_KEY) || "null");
      if (raw?.schema > 1) {
        this.readOnly = true;
        this.warning =
          "Newer Arcade records retained; this build will not overwrite them.";
      }
      if (raw?.schema === 1)
        for (const l of levels) {
          const r = raw.records?.[l.id];
          if (
            r?.revision === l.revision &&
            Number.isFinite(r.best) &&
            r.best > 0 &&
            r.best < 300
          )
            this.values.records[l.id] = { revision: l.revision, best: r.best };
        }
    } catch {
      this.warning = "Arcade best unavailable; original saves are unchanged.";
    }
  }
  isUnlocked() {
    return true;
  }
  best(id) {
    return this.values.records[id]?.best ?? null;
  }
  complete(level, time, practice) {
    if (practice) return { practice: true };
    const before = this.best(level.id);
    if (!Number.isFinite(time) || time <= 0 || time > 300)
      return { personalBest: false };
    this.values.records[level.id] = {
      revision: level.revision,
      best: Math.min(before ?? Infinity, time),
    };
    this.retry();
    return {
      personalBest: before === null || time < before,
      best: this.best(level.id),
    };
  }
  retry() {
    if (this.readOnly) return false;
    try {
      this.storage.setItem(ARCADE_RECORD_KEY, JSON.stringify(this.values));
      this.warning = "";
      return true;
    } catch {
      this.warning = "Arcade best active but not saved.";
      return false;
    }
  }
}
export class ArcadeService {
  constructor(tuning) {
    this.tuning = tuning;
    this.spec = { ...boatPerformance({}), powerScale: 1, nitrous: 0 };
    this.balance = standardUpgradeBalance;
    this.nitrousActive = false;
  }
  framing() {
    const t = this.tuning.values;
    if (this.speed !== t.cruiseSpeed) {
      this.speed = t.cruiseSpeed;
      Object.assign(
        this.spec,
        boatPerformance(
          {},
          { ...standardUpgradeBalance, stockTopMph: t.cruiseSpeed },
        ),
      );
    }
    this.spec.steeringResponseScale = t.steeringResponse;
    this.spec.steeringDampingScale = 1.15;
    return this.spec;
  }
  updateNitrous() {
    return this.framing();
  }
  stopNitrous() {}
}
export class ArcadeRiverTour extends RiverRunTour {
  constructor(world, levels, records, tuning) {
    super(world, levels, records);
    this.tuning = tuning;
  }
  reset(index = 0) {
    super.reset(index);
    this.cash = 0;
    this.collected = new Set();
    this.condition = 100;
    this.collisions = 0;
    this.failed = "";
    this.hitCooldown = 0;
    this.recovery = 0;
    this.rampLift = 0;
    this.routeDistance = this.level.startDistance;
    this.shortcutTaken = false;
    this.branchProjection = {};
  }
  get height() {
    return this.leaf.airborne ? this.leaf.height : this.rampLift;
  }
  beforePhysics(b, dt) {
    b.collisionImpulse = 0;
    this.rampLift = 0;
    if (this.airborne)
      b.yawRate *= Math.exp(-dt * (this.tuning.values.landingStability * 3));
    else
      for (const j of this.leaf.jumpSites) {
        const p = j.point,
          along = (b.x - p.x) * p.tx + (b.z - p.z) * p.tz,
          lateral = -(b.x - p.x) * p.tz + (b.z - p.z) * p.tx;
        if (along >= -j.deckLength && along < 0 && Math.abs(lateral) < j.halfWidth)
          this.rampLift = j.deckRise * (1 + along / j.deckLength);
      }
    return super.beforePhysics(b, dt);
  }
  step(before, b, dt, settings, now, start) {
    if (this.done) return null;
    if (
      start.state === "RACING" &&
      now - start.startAt >= this.world.definition.timeLimit
    ) {
      this.race.total = this.world.definition.timeLimit;
      this.failed = "TIME UP / 2:05 LIMIT";
      this.done = this.race.done = true;
      return "arcade-failed";
    }
    const wasAir = this.airborne,
      transition = super.step(before, b, dt, settings, now, start);
    if (start.state !== "RACING") return transition;
    if (!wasAir && this.airborne) {
      this.leaf.height = 0.55;
      this.rampLift = 0;
    }
    const t = this.tuning.values;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if ((b.collisionImpulse || 0) > 4 && this.hitCooldown === 0) {
      this.collisions++;
      this.condition = Math.max(
        0,
        this.condition - Math.min(32, (b.collisionImpulse - 3) * 1.1),
      );
      this.hitCooldown = 0.85;
      this.recovery = 0.5;
    }
    if (this.recovery > 0) {
      this.recovery -= dt;
      b.yawRate *= Math.exp(-dt * t.impactRecovery * 5);
    }
    if (this.landed) {
      b.yawRate *= 1 - t.landingStability * 0.6;
      const fx = Math.cos(b.angle),
        fz = Math.sin(b.angle),
        lateral = (-b.vx * fz + b.vz * fx) * t.landingStability * 0.25;
      b.vx += fz * lateral;
      b.vz -= fx * lateral;
    }
    for (const p of this.world.pickups) {
      if (!this.collected.has(p.id) && Math.hypot(p.x - b.x, p.z - b.z) < 3.5) {
        this.collected.add(p.id);
        this.cash += p.value;
      }
    }
    this.routeDistance = Math.max(
      this.level.startDistance,
      this.level.route.project(
        b,
        Math.max(0, this.routeDistance - 45),
        Math.min(this.level.route.length, this.routeDistance + 90),
        this.projection || (this.projection = {}),
      ).distance,
    );
    const shortcut = this.world.shortcut;
    if (
      this.routeDistance > shortcut.start &&
      this.routeDistance < shortcut.end
    ) {
      const q = shortcut.path.project(
        b,
        0,
        shortcut.path.length,
        this.branchProjection,
      );
      if (
        q.error < 8 &&
        q.distance > shortcut.path.length * 0.25 &&
        q.distance < shortcut.path.length * 0.75
      )
        this.shortcutTaken = true;
    }
    if (!transition && this.condition <= 0) {
      this.failed = "HULL NEEDS A BREATHER";
      this.done = this.race.done = true;
      return "arcade-failed";
    }
    return transition;
  }
  summary() {
    return {
      cash: this.cash,
      time: this.race.total,
      condition: this.condition,
      jumps: this.leaf.takenJumps.size,
      collisions: this.collisions,
      shortcut: this.shortcutTaken,
      rating: this.failed
        ? "BACK IN THE WATER"
        : this.race.total < 75 && this.cash >= 250
          ? "RIVER ACE"
          : this.race.total < 90
            ? "HOT RIVER RUN"
            : "RIVER RUNNER",
    };
  }
}
