import { courseDescriptor } from "./replay/course-data.js";

// Promote only the three already authored River Rush environments.
// Coordinates and checkpoints still belong to the existing river implementation.
export function createRiverLevels(world) {
  return world.legs.map((environment, index) => {
    const definition = world.definition.rivers[index],
      startDistance = definition.gateDistance + 3,
      start = environment.river.sample(startDistance),
      finish = environment.checkpoints.at(-1),
      original = courseDescriptor(world, index, "river"),
      id = "river-run-" + definition.id;
    const replayDescriptor = {
      ...original,
      id,
      routeId: "river-run-v1-" + definition.id,
      revision: "standalone-1-" + original.revision,
    };
    return {
      id,
      index,
      name: definition.name,
      environmentId: definition.id,
      environment,
      definition,
      startDistance,
      start: {
        x: start.x,
        z: start.z,
        tx: start.tx,
        tz: start.tz,
        heading: Math.atan2(start.tz, start.tx),
      },
      finish: {
        x: finish.x,
        z: finish.z,
        tx: finish.tx,
        tz: finish.tz,
        halfWidth: finish.halfWidth,
        distance: finish.distance,
      },
      route: environment.river,
      checkpoints: environment.checkpoints,
      unlockRequirements: [],
      revision: replayDescriptor.revision,
      replayDescriptor,
    };
  });
}
export function validateRiverLevels(levels, arrows = [], activeId = "") {
  return levels.map((level) => {
    const issues = [];
    let previous = level.startDistance;
    for (const [i, g] of level.checkpoints.entries()) {
      const a = level.route.sample(g.distance - 2),
        b = level.route.sample(g.distance + 2),
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (g.distance <= previous)
        issues.push({ code: "river-checkpoint-order", detail: i });
      if ((g.tx * (b.x - a.x) + g.tz * (b.z - a.z)) / length < 0.9)
        issues.push({ code: "reversed-river-checkpoint", detail: i });
      previous = g.distance;
    }
    if (level.route !== level.environment.river)
      issues.push({ code: "substituted-river-environment" });
    if (level.id === activeId)
      for (const arrow of arrows) {
        const p = level.route.sample(arrow.distance);
        if (p.tx * arrow.tx + p.tz * arrow.tz < 0.98)
          issues.push({
            code: "river-navigation-against-route",
            detail: arrow.distance,
          });
      }
    return {
      course: level.id,
      valid: issues.length === 0,
      gates: level.checkpoints.length,
      issues,
    };
  });
}
export const riverRunProgressKey = "jet-sprint-river-runs-v1";
export class RiverRunProgress {
  constructor(storage, levels) {
    this.storage = storage;
    this.levels = levels;
    this.warning = "";
    this.values = { schema: 1, records: {} };
    try {
      const v = JSON.parse(storage.getItem(riverRunProgressKey) || "null");
      if (v?.schema === 1)
        for (const level of levels) {
          const r = v.records?.[level.id];
          if (
            r &&
            r.revision === level.revision &&
            Number.isFinite(r.best) &&
            r.best > 0 &&
            Number.isFinite(r.recent) &&
            r.recent > 0
          )
            this.values.records[level.id] = {
              revision: r.revision,
              best: r.best,
              recent: r.recent,
              completions: Math.max(
                1,
                Math.min(1e6, Math.floor(r.completions) || 1),
              ),
              completed: true,
            };
        }
    } catch {
      this.warning =
        "River records could not be restored. Existing campaign and tuning saves are unchanged.";
    }
  }
  isUnlocked(level) {
    return level.unlockRequirements.every(
      (id) => this.values.records[id]?.completed,
    );
  }
  best(id) {
    return this.values.records[id]?.best ?? null;
  }
  complete(level, time, practice = false) {
    if (practice) return { practice: true, personalBest: false };
    if (!Number.isFinite(time) || time <= 0 || time > 86400)
      throw Error("Invalid river completion time.");
    const old = this.values.records[level.id],
      personalBest = !old || time < old.best;
    this.values.records[level.id] = {
      revision: level.revision,
      best: Math.min(old?.best ?? Infinity, time),
      recent: time,
      completions: (old?.completions || 0) + 1,
      completed: true,
    };
    this.save();
    return {
      personalBest,
      previousBest: old?.best ?? null,
      best: this.best(level.id),
    };
  }
  save() {
    try {
      this.storage.setItem(riverRunProgressKey, JSON.stringify(this.values));
      this.warning = "";
      return true;
    } catch {
      this.warning =
        "River result is active but not saved. Retry or export before leaving.";
      return false;
    }
  }
  retry() {
    return this.save();
  }
}
