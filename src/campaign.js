import { Race } from "./race.js";
import { RouteNavigator } from "./navigation.js";

export function crossesGate(before, after, g) {
  const a = (before.x - g.x) * g.tx + (before.z - g.z) * g.tz,
    b = (after.x - g.x) * g.tx + (after.z - g.z) * g.tz;
  if (a > 0 || b <= 0) return false;
  const t = -a / (b - a),
    x = before.x + (after.x - before.x) * t - g.x,
    z = before.z + (after.z - before.z) * t - g.z;
  return Math.abs(-x * g.tz + z * g.tx) <= g.halfWidth;
}
const signed = (p, g) => (p.x - g.x) * g.tx + (p.z - g.z) * g.tz;

// Progression and environmental forces only. The boat controller stays separate.
export class Campaign {
  constructor(world, progress) {
    this.world = world;
    this.track = world.raceDefinition;
    this.river = world.riverDefinition;
    this.destination = world.destinationDefinition;
    this.progress = progress;
    this.projection = {};
    this.target = {};
    this.jumpPoint = world.river.sample(this.river.jump.distance);
    this.jumpGate = { ...this.jumpPoint, halfWidth: this.river.waterWidth };
    this.exitAt = world.race.project(
      { x: this.river.spline[0][0], z: this.river.spline[0][1] },
      0,
      world.race.length,
    ).distance;
    const hullLimit = this.track.waterWidth - 2.5;
    this.exitGuide = new Race(world.race.gates, hullLimit, 1);
    this.exitNavigator = new RouteNavigator(world.race, hullLimit);
    this.reset();
  }
  reset() {
    this.phase = "RACE";
    this.gateOpen = 0;
    this.checkpoint = 0;
    this.elapsed = 0;
    this.score = 0;
    this.clean = true;
    this.legStart = 0;
    this.lastDistance = this.river.gateDistance;
    this.practice = false;
    this.exitApproach = false;
    this.jumpTaken = false;
    this.jumpAwarded = false;
    this.height = this.verticalVelocity = 0;
    this.airborne = false;
    this.landed = false;
    this.exitGuide.reset();
    this.exitNavigator.reset();
  }
  finishRace(race) {
    if (
      this.phase !== "RACE" ||
      !race.done ||
      race.laps.length !== this.track.laps
    )
      return false;
    this.phase = "EXIT";
    if (!this.practice) this.progress?.race(race.total, this.track.id);
    return true;
  }
  get gateState() {
    return this.gateOpen >= 1
      ? "open"
      : this.phase === "RACE"
        ? "closed"
        : "opening";
  }
  beforePhysics(b, dt) {
    this.landed = false;
    if (this.airborne) {
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.angle += (b.yawRate || 0) * dt;
      b.yawRate *= Math.exp(-dt * 0.4);
      this.verticalVelocity -= 9.8 * dt;
      this.height += this.verticalVelocity * dt;
      if (this.height <= 0) {
        this.height = 0;
        this.airborne = false;
        this.landed = true;
        const n = this.world.nearest(b.x, b.z),
          inWater = Math.hypot(b.x - n.x, b.z - n.z) < (n.hullLimit ?? 6.5);
        if (inWater && !this.jumpAwarded) {
          this.score += this.river.jump.bonus;
          this.jumpAwarded = true;
        } else if (!inWater) this.clean = false;
      }
      return false;
    }
    if (this.phase === "RIVER" || this.phase === "ARRIVED") {
      const p = this.world.nearest(b.x, b.z);
      if (p.segmentId === this.river.id) {
        const f = this.world.river.project(
            b,
            0,
            this.world.river.length,
            this.projection,
          ),
          k = 1 - Math.exp(-this.river.currentResponse * dt);
        // A gentle downstream drift, applied once per step rather than to heading.
        const drift =
          Math.min(
            this.river.current,
            Math.max(0, this.river.current + b.vx * f.tx + b.vz * f.tz),
          ) * k;
        b.vx -= f.tx * drift;
        b.vz -= f.tz * drift;
      }
    }
    return true;
  }
  step(before, b, dt) {
    this.gateHit=0;
    if (this.phase !== "RACE")
      this.gateOpen = Math.min(1, this.gateOpen + dt * 1.25);
    const { gate, river, checkpoints } = this.world;
    if (this.gateOpen < 1) {
      const a = signed(before, gate),
        d = signed(b, gate),
        side = a <= 0 ? -1 : 1;
      const lateral = -(b.x - gate.x) * gate.tz + (b.z - gate.z) * gate.tx;
      if (
        Math.abs(lateral) < gate.halfWidth + 1.5 &&
        ((a * d <= 0 && a !== d) || Math.abs(d) < 1.2)
      ) {
        b.x += (side * 1.25 - d) * gate.tx;
        b.z += (side * 1.25 - d) * gate.tz;
        const v = b.vx * gate.tx + b.vz * gate.tz;
        this.gateHit=Math.abs(v);
        if (v * side < 0) {
          b.vx -= v * gate.tx * 1.2;
          b.vz -= v * gate.tz * 1.2;
        }
      }
    }
    if (this.phase === "EXIT") {
      this.exitGuide.step(before, b, dt, {});
      const p = this.world.race.project(
        b,
        0,
        this.world.race.length,
        this.projection,
      );
      if (
        Math.abs(p.distance - this.exitAt) < 28 ||
        Math.hypot(b.x - gate.x, b.z - gate.z) < 24
      )
        this.exitApproach = true;
      if (this.gateOpen === 1 && crossesGate(before, b, gate)) {
        this.phase = "RIVER";
        this.elapsed = 0;
        this.checkpoint = 0;
        this.legStart = 0;
        this.clean = true;
      }
    }
    if (this.phase !== "RIVER") return;
    this.elapsed += dt;
    if (b.collisionImpulse > 0.2) this.clean = false;
    const g = checkpoints[this.checkpoint];
    if (g && crossesGate(before, b, g)) {
      const speed =
        (g.distance - this.lastDistance) /
        Math.max(0.1, this.elapsed - this.legStart);
      const scoring = this.river.scoring;
      this.score +=
        scoring.checkpoint +
        Math.min(
          scoring.maxSpeedBonus,
          Math.round(speed * scoring.speedFactor),
        ) +
        (this.clean ? scoring.clean : 0);
      this.lastDistance = g.distance;
      this.legStart = this.elapsed;
      this.clean = true;
      this.checkpoint++;
      if (this.checkpoint === checkpoints.length) {
        this.phase = "ARRIVED";
        if (!this.practice)
          this.progress?.arrive(this.score, this.river.id, this.destination.id);
      }
    }
    if (this.phase !== "RIVER" || this.jumpTaken || this.airborne) return;
    const j = this.river.jump,
      p = this.jumpPoint,
      lateral = -(b.x - p.x) * p.tz + (b.z - p.z) * p.tx;
    if (
      crossesGate(before, b, this.jumpGate) &&
      Math.abs(lateral - j.side * j.offset) < j.halfWidth &&
      Math.hypot(b.vx, b.vz) >= j.minSpeed
    ) {
      this.jumpTaken = true;
      this.airborne = true;
      this.height = 0.02;
      this.verticalVelocity = j.launch;
    }
  }
  cue(b, dt, input) {
    if (this.phase === "RACE") return null;
    if (this.phase === "EXIT" && !this.exitApproach) {
      const cue = this.exitNavigator.update(b, this.exitGuide, dt, input);
      cue.preview = `EXIT GATE / ${this.river.name.toUpperCase()}`;
      return cue;
    }
    let wrong = false,
      text = "UPSTREAM",
      preview = this.river.name.toUpperCase(),
      distance = 0;
    if (this.phase === "EXIT") {
      this.world.river.sample(this.river.gateDistance + 7, this.target);
      text = "EXIT OPEN";
      preview = "FOLLOW THE RIVER";
      distance = Math.hypot(b.x - this.target.x, b.z - this.target.z);
    } else if (this.phase === "RIVER") {
      const g = this.world.checkpoints[this.checkpoint],
        previous = this.checkpoint
          ? this.world.checkpoints[this.checkpoint - 1].distance
          : this.river.gateDistance;
      const p = this.world.river.project(
        b,
        Math.max(0, previous - 8),
        Math.min(this.world.river.length, g.distance + 20),
        this.projection,
      );
      wrong = signed(b, g) > 2;
      this.world.river.sample(
        wrong ? g.distance - 8 : Math.min(g.distance + 2, p.distance + 13),
        this.target,
      );
      text = wrong ? "RETURN TO GATE" : "UPSTREAM";
      preview = `CHECKPOINT ${this.checkpoint + 1}/${this.world.checkpoints.length}`;
      distance = wrong
        ? Math.hypot(b.x - this.target.x, b.z - this.target.z)
        : Math.max(0, g.distance - p.distance);
    } else {
      const p = this.world.destination.project(
        b,
        0,
        this.world.destination.length,
        this.projection,
      );
      this.world.destination.sample(p.distance + 15, this.target);
      text = `TRACK ${String(this.destination.number).padStart(2, "0")}`;
      preview = "FREE CRUISE / PREVIEW";
      distance = Math.hypot(b.x - this.target.x, b.z - this.target.z);
    }
    const delta = Math.atan2(
      Math.sin(Math.atan2(this.target.z - b.z, this.target.x - b.x) - b.angle),
      Math.cos(Math.atan2(this.target.z - b.z, this.target.x - b.x) - b.angle),
    );
    const kind =
      Math.abs(delta) < 0.35
        ? "straight"
        : `${Math.abs(delta) > 1.45 ? "sharp-" : ""}${delta > 0 ? "right" : "left"}`;
    return {
      kind,
      text,
      preview,
      distance: Math.round(distance),
      wrong,
      urgent: wrong || distance < 30,
      targetX: this.target.x,
      targetZ: this.target.z,
      notice:
        this.phase === "ARRIVED"
          ? `${this.destination.name} reached · Free cruise · Restart to race again`
          : wrong
            ? "Missed checkpoint · Approach from behind the gate"
            : "",
    };
  }
  inspect() {
    return {
      course:
        this.phase === "RACE" || this.phase === "EXIT"
          ? this.track.id
          : this.phase === "RIVER"
            ? this.river.id
            : this.destination.id,
      state: this.phase,
      gate: this.gateState,
      gateOpen: this.gateOpen,
      checkpoints: this.checkpoint,
      checkpointTotal: this.world.checkpoints.length,
      riverTime: this.elapsed,
      score: this.score,
      airborne: this.airborne,
      jumpTaken: this.jumpTaken,
      practice: this.practice,
    };
  }
}
