import { Campaign, crossesGate } from "./campaign.js";
import { Race } from "./race.js";
import { RouteNavigator } from "./navigation.js";

// Owns event lifecycle only. The original boat integrator, clock, camera and
// audio remain outside. Every normal transition is driven by world crossings.
export class CampaignTour {
  constructor(world, progress) {
    this.world = world;
    this.progress = progress;
    this.projection = {};
    this.target = {};
    this.reset();
  }
  reset() {
    this.index = 0;
    this.phase = "RACE";
    this.practice = false;
    this.begun = false;
    this.attempt = null;
    this.raceOrigin = null;
    this.riverOrigin = null;
    this.eventClean = true;
    this.reward = null;
    this.rewardSerial = 0;
    this.pendingCountdown = false;
    this.results = [];
    this.completedRivers = 0;
    this.leaves = this.world.legs.map((w) => new Campaign(w));
    this.configureRace();
  }
  configureRace() {
    this.track = this.world.definition.tracks[this.index];
    this.venue = this.world.courses[this.index];
    this.race = new Race(
      this.venue.gates,
      this.track.waterWidth - 2.5,
      this.track.laps,
    );
    this.navigator = new RouteNavigator(
      this.venue,
      this.track.waterWidth - 2.5,
    );
    this.leaf = this.leaves[this.index] ?? null;
    this.river = this.world.definition.rivers[this.index] ?? null;
    this.eventClean = true;
  }
  begin() {
    if (this.begun) return;
    this.begun = true;
    this.attempt = this.practice ? null : this.progress?.begin(this.track.id);
  }
  get event() {
    return this.phase === "RIVER" ? this.river : this.track;
  }
  get stage() {
    return this.index * 2 + (this.phase === "RIVER" ? 2 : 1);
  }
  get gateOpen() {
    return this.leaf?.gateOpen ?? 0;
  }
  get gateState() {
    return this.leaf?.gateState ?? "championship";
  }
  get checkpoint() {
    return this.leaf?.checkpoint ?? 0;
  }
  get elapsed() {
    return this.leaf?.elapsed ?? 0;
  }
  get score() {
    return this.leaf?.score ?? 0;
  }
  get height() {
    return this.leaf?.height ?? 0;
  }
  get airborne() {
    return this.leaf?.airborne ?? false;
  }
  get landed() {
    return this.leaf?.landed ?? false;
  }
  get stagingPath() {
    return this.world.staging[this.index];
  }
  beforePhysics(b, dt) {
    if (this.leaf?.airborne) return this.leaf.beforePhysics(b, dt);
    if (this.leaf) this.leaf.landed = false;
    // A river retains its current if revisited. Apply once, independently of yaw/thrust.
    const n = this.world.nearest(b.x, b.z),
      leg = this.world.legs.find((l) => l.river.id === n.segmentId);
    if (leg) {
      const p = leg.river.project(b, 0, leg.river.length, this.projection),
        r = leg.riverDefinition;
      const rapid = 0.5 + 0.5 * Math.sin(p.distance / 37),
        strength = r.current * (1 + rapid * r.rapids.strength * 0.45),
        k = 1 - Math.exp(-r.currentResponse * dt),
        drift =
          Math.min(
            strength,
            Math.max(0, strength + b.vx * p.tx + b.vz * p.tz),
          ) * k;
      b.vx -= p.tx * drift;
      b.vz -= p.tz * drift;
    }
    return true;
  }
  contact(b) {
    for (const rock of this.world.rocks) {
      const dx = b.x - rock.x,
        dz = b.z - rock.z,
        r = rock.radius + 1.2,
        d = Math.hypot(dx, dz);
      if (d >= r || d < 1e-6) continue;
      const nx = dx / d,
        nz = dz / d,
        v = b.vx * nx + b.vz * nz;
      b.x = rock.x + nx * r;
      b.z = rock.z + nz * r;
      if (v < 0) {
        b.vx -= v * nx * 1.25;
        b.vz -= v * nz * 1.25;
        b.collisionImpulse = Math.max(b.collisionImpulse || 0, -v * 1.25);
      }
    }
    const raw = (this.world.collisionNearest??this.world.nearest)(b.x, b.z),n=raw.collision??raw;
    if (
      (b.collisionImpulse || 0) > 1.5 ||
      (b.bankDepth || 0) > .7 ||
      Math.hypot(b.x - n.x, b.z - n.z) > (n.hullLimit ?? 6.5) + 0.7
    )
      this.eventClean = false;
  }
  finishEvent(id, time) {
    let reward = null;
    if (!this.practice && this.attempt)
      reward = this.progress?.complete(this.attempt, {
        time,
        clean: this.eventClean,
      });
    this.reward = reward ?? {
      eventId: id,
      name: this.event.name,
      kind: this.phase === "RIVER" ? "river" : "race",
      time,
      clean: this.eventClean,
      practice: this.practice,
      pending: !this.practice,
      prize: 0,
      cleanBonus: 0,
      wallet: this.progress?.values.wallet ?? 0,
    };
    this.rewardSerial++;
  }
  step(before, b, dt, settings, now, start) {
    this.contact(b);
    const oldLeaf = this.leaf,
      was = this.phase;
    if (this.phase === "RIVER" && oldLeaf) {
      this.riverOrigin ??= now - oldLeaf.elapsed - dt;
      oldLeaf.elapsed = Math.max(oldLeaf.elapsed, now - this.riverOrigin - dt);
    }

    if (
      oldLeaf &&
      (this.phase === "RACE" ||
        this.phase === "STAGING" ||
        this.phase === "EXIT" ||
        this.phase === "RIVER")
    )
      oldLeaf.step(before, b, dt);
    if (oldLeaf?.gateHit > 1.5) this.eventClean = false;
    if (this.phase === "RACE") {
      if (start.state !== "RACING") return null;
      this.begin();
      const origin = this.raceOrigin ?? start.startAt;
      const complete = this.race.step(
        before,
        b,
        dt,
        settings,
        Math.max(0, now - origin),
      );
      if (complete && this.race.done) {
        this.finishEvent(this.track.id, this.race.total);
        this.results.push({
          track: this.track,
          ...this.race,
          laps: [...this.race.laps],
        });
        if (oldLeaf) {
          oldLeaf.finishRace(this.race);
          this.phase = "EXIT";
        } else this.phase = "CHAMPION";
        return "race-complete";
      }
    } else if (was === "EXIT" && oldLeaf.phase === "RIVER") {
      this.phase = "RIVER";
      this.riverOrigin = now - dt;
      this.eventClean = true;
      this.attempt = this.practice ? null : this.progress?.begin(this.river.id);
      return "river-start";
    } else if (was === "RIVER" && oldLeaf.phase === "ARRIVED") {
      this.finishEvent(this.river.id, oldLeaf.elapsed);
      this.completedRivers++;
      this.index++;
      this.configureRace();
      this.phase = "STAGING";
      this.raceOrigin = null;
      this.attempt = null;
      this.pendingCountdown = true;
      return "arrival";
    } else if (
      this.phase === "STAGING" &&
      start.state === "RACING" &&
      crossesGate(before, b, this.venue.gates[0])
    ) {
      this.phase = "RACE";
      this.eventClean = (b.collisionImpulse || 0) <= 1.5;
      this.raceOrigin = now;
      this.attempt = this.practice ? null : this.progress?.begin(this.track.id);
      return "race-start";
    }
    return null;
  }
  markRespawn() {
    this.eventClean = false;
  }
  cue(b, dt, input) {
    if (this.phase === "RACE")
      return this.navigator.update(b, this.race, dt, input);
    if (this.phase === "EXIT" || this.phase === "RIVER")
      return this.leaf.cue(b, dt, input);
    if (this.phase === "CHAMPION")
      return {
        kind: "straight",
        text: "CHAMPION",
        preview: "FOUR TRACKS COMPLETE",
        distance: 0,
        wrong: false,
        urgent: false,
        targetX: b.x + Math.cos(b.angle) * 15,
        targetZ: b.z + Math.sin(b.angle) * 15,
        notice: "Championship complete · Keep cruising or restart to replay",
      };
    const path = this.stagingPath,
      g = this.venue.gates[0],
      beyond = (b.x - g.x) * g.tx + (b.z - g.z) * g.tz > 2;
    const p = path.project(b, 0, path.length, this.projection);
    path.sample(
      beyond ? path.length - 18 : Math.min(path.length, p.distance + 16),
      this.target,
    );
    const delta = Math.atan2(
      Math.sin(Math.atan2(this.target.z - b.z, this.target.x - b.x) - b.angle),
      Math.cos(Math.atan2(this.target.z - b.z, this.target.x - b.x) - b.angle),
    );
    return {
      kind:
        Math.abs(delta) < 0.35
          ? "straight"
          : `${Math.abs(delta) > 1.45 ? "sharp-" : ""}${delta > 0 ? "right" : "left"}`,
      text: beyond ? "RETURN TO START" : "STARTING AREA",
      preview: this.track.name.toUpperCase(),
      distance: Math.round(Math.hypot(b.x - g.x, b.z - g.z)),
      wrong: beyond,
      urgent: beyond,
      targetX: this.target.x,
      targetZ: this.target.z,
      notice: "Keep control · Wait for green, then cross the start line",
    };
  }
  inspect() {
    return {
      course: this.event.id,
      state: this.phase,
      stage: this.stage,
      event: this.event.name,
      track: this.index + 1,
      gate: this.gateState,
      gateOpen: this.gateOpen,
      checkpoints: this.checkpoint,
      checkpointTotal: this.leaf?.world.checkpoints.length ?? 0,
      riverTime: this.elapsed,
      score: this.score,
      clean: this.eventClean,
      airborne: this.airborne,
      practice: this.practice,
      wallet: this.progress?.values.wallet ?? 0,
      attempt: this.attempt,
    };
  }
  resume(index) {
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index > 3 ||
      index >= (this.progress?.values.unlocked ?? 1)
    )
      throw Error("Venue is locked.");
    this.reset();
    this.index = index;
    this.configureRace();
    this.phase = "STAGING";
    this.begun = true;
    this.pendingCountdown = true;
    return this.stagingPath.sample(0);
  }
  practiceStage(stage) {
    if (!Number.isInteger(stage) || stage < 0 || stage > 6)
      throw Error("Choose campaign stage 1–7.");
    this.reset();
    this.practice = true;
    this.begun = true;
    this.index = Math.floor(stage / 2);
    this.configureRace();
    this.phase = stage % 2 ? "RIVER" : "RACE";
    if (this.leaf) {
      this.leaf.phase = this.phase;
      this.leaf.gateOpen = stage % 2 ? 1 : 0;
    }
    return stage % 2
      ? this.leaf.world.river.sample(this.river.gateDistance + 3)
      : this.venue.sample(0);
  }
}
