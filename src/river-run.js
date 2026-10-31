import { CampaignTour } from "./campaign-tour.js";
import { modified } from "./race.js";

// Lifecycle adapter over the real River Rush simulation. The archived circuit
// tour still owns its original forces, currents, rock/bank collision and jumps.
export class RiverRunTour {
  constructor(world, levels, progress) {
    this.world = world;
    this.levels = levels;
    this.progress = progress;
    this.simulator = new CampaignTour(world, null);
    this.mode = "river-run";
    this.reset();
  }
  reset(index = 0) {
    this.progress.cancel?.(this.attempt);
    this.attempt = null;
    this.simulator.reset();
    this.index = index;
    this.simulator.index = index;
    this.simulator.configureRace();
    this.simulator.phase = "RIVER";
    this.level = this.levels[index];
    this.leaf.phase = "RIVER";
    this.leaf.gateOpen = 1;
    this.phase = "RIVER";
    this.practice = false;
    this.done = false;
    this.begun = false;
    this.origin = null;
    this.reward = null;
    this.rewardSerial = 0;
    this.results = [];
    this.pendingCountdown = false;
    const path = this.level.route;
    this.venue = {
      ...this.simulator.venue,
      id: this.level.id,
      name: this.level.name,
      version: 1,
      closed: false,
      points: path.points,
      line: path.points,
      gates: this.level.checkpoints,
      length: path.length,
      sample: path.sample,
      project: path.project,
    };
    this.track = {
      ...this.level.definition,
      id: this.level.id,
      routeId: this.level.replayDescriptor.routeId,
      laps: 0,
    };
    this.race = {
      total: 0,
      lapStart: 0,
      laps: [],
      lapCount: 0,
      next: 0,
      done: false,
      modified: false,
      check: { code: "approaching", gate: 0, signed: 0, lateral: 0 },
      lastCrossing: null,
      reset: () => {
        this.race.total = 0;
        this.race.done = false;
        this.race.next = 0;
        this.race.modified = false;
      },
    };
  }
  get leaves() {
    return this.simulator.leaves;
  }
  get leaf() {
    return this.simulator.leaf;
  }
  get river() {
    return this.level.definition;
  }
  get event() {
    return this.track;
  }
  get stage() {
    return this.index + 1;
  }
  get height() {
    return this.leaf.height;
  }
  get airborne() {
    return this.leaf.airborne;
  }
  get landed() {
    return this.leaf.landed;
  }
  get elapsed() {
    return this.race.total;
  }
  get checkpoint() {
    return this.leaf.checkpoint;
  }
  get score() {
    return this.leaf.score;
  }
  get gateOpen() {
    return 1;
  }
  get gateState() {
    return "open";
  }
  get eventClean() {
    return this.simulator.eventClean;
  }
  get navigator() {
    return this.simulator.navigator;
  }
  begin() {
    if (this.begun) return;
    this.begun = true;
    this.attempt = this.progress.begin?.(this.level, this.practice) ?? null;
  }
  resume(index) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.levels.length ||
      !this.progress.isUnlocked(this.levels[index])
    )
      throw Error("Choose an accessible river level.");
    this.reset(index);
    return this.level.start;
  }
  practiceStage(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.levels.length)
      throw Error("Choose an existing practice river.");
    this.reset(index);
    this.practice = true;
    return this.level.start;
  }
  beforePhysics(b, dt) {
    return this.simulator.beforePhysics(b, dt);
  }
  step(before, b, dt, settings, now, start) {
    this.simulator.contact(b);
    if (start.state === "RACING" && !this.begun) this.begin();
    this.progress.motion?.(b, dt, this.attempt);
    if (this.done || start.state !== "RACING") return null;
    this.race.modified ||= modified(settings);
    this.origin ??= start.startAt;
    this.leaf.elapsed = Math.max(
      this.leaf.elapsed,
      Math.max(0, now - this.origin - dt),
    );
    const previous = this.leaf.checkpoint,
      g = this.level.checkpoints[previous];
    this.leaf.step(before, b, dt);
    this.race.total = this.leaf.elapsed;
    this.race.next = Math.min(
      this.leaf.checkpoint,
      this.level.checkpoints.length - 1,
    );
    if (g) {
      const signed = (b.x - g.x) * g.tx + (b.z - g.z) * g.tz,
        lateral = -(b.x - g.x) * g.tz + (b.z - g.z) * g.tx;
      this.race.check = {
        code:
          this.leaf.checkpoint !== previous
            ? "accepted"
            : signed < 0
              ? "approaching"
              : "beyond-plane",
        gate: previous,
        signed,
        lateral,
      };
      if (this.leaf.checkpoint !== previous)
        this.race.lastCrossing = {
          gate: previous,
          code: "accepted",
          time: this.race.total,
          lateral,
        };
    }
    if (this.leaf.checkpoint !== previous)
      this.progress.checkpoint?.(
        this.attempt,
        previous,
        this.leaf.checkpoint,
        this.race.total,
      );
    if (this.leaf.phase === "ARRIVED") {
      this.done = this.race.done = true;
      this.reward = this.progress.complete(
        this.level,
        this.race.total,
        this.practice,
        {
          attempt: this.attempt,
          checkpoints: this.checkpoint,
          clean: this.eventClean,
        },
      );
      this.rewardSerial++;
      this.results.push({ level: this.level.id, total: this.race.total });
      return "river-complete";
    }
    return null;
  }
  cue(b, dt, input) {
    if (this.done)
      return {
        kind: "straight",
        text: "FINISH",
        preview: this.level.name.toUpperCase(),
        targetX: b.x + Math.cos(b.angle) * 12,
        targetZ: b.z + Math.sin(b.angle) * 12,
        distance: 0,
        wrong: false,
        notice: "River complete · Results, replay or restart",
      };
    return this.leaf.cue(b, dt, input);
  }
  markRespawn() {
    this.simulator.markRespawn();
  }
  inspect() {
    return {
      mode: this.mode,
      course: this.level.id,
      environment: this.level.environmentId,
      state: this.done ? "FINISHED" : this.race.total > 0 ? "RIVER" : "READY",
      stage: this.stage,
      event: this.level.name,
      gate: "open",
      checkpoints: this.checkpoint,
      checkpointTotal: this.level.checkpoints.length,
      riverTime: this.elapsed,
      completed: this.done,
      practice: this.practice,
      airborne: this.airborne,
      clean: this.eventClean,
      best: this.progress.best(this.level.id),
    };
  }
}
