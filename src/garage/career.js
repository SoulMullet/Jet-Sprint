import {
  garageEconomy,
  serviceQuote,
  emergencyAvailable,
  powerScale,
  fuelConsumed,
  impactDamage,
} from "./definitions.js";
import { LocalProfileRepository } from "./profile-store.js";
export class PlayerCareer {
  constructor(storage, levels, tuning, { existingPlayer = false } = {}) {
    this.levels = levels;
    this.tuning = tuning;
    this.repository = new LocalProfileRepository(storage);
    this.listeners = new Set();
    const loaded = this.repository.load(levels, { existingPlayer });
    this.profile = loaded.profile;
    this.baseRevision = loaded.baseRevision;
    this.readOnly = !!loaded.readOnly;
    this.warning = loaded.notes.join(" ");
    this.recoveryNotice = this.warning;
    this.dirty = false;
    this.conflict = false;
    this.saveClock = 0;
    this.impactGap = Infinity;
    this.impactPeak = 0;
    this.performance = { powerScale: 1 };
    // A reload never resumes an old in-flight payout token. The boat starts a new run.
    if (!this.readOnly) {
      this.profile.career.activeAttempt = null;
      this.dirty = true;
      this.flush();
    }
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  get values() {
    return this.profile;
  }
  get writable() {
    return !this.readOnly && !this.conflict;
  }
  flush() {
    if (!this.dirty) return true;
    if (!this.writable) return false;
    try {
      this.profile = this.repository.commit(this.profile, this.baseRevision);
      this.baseRevision = this.profile.revision;
      this.dirty = false;
      this.warning = "";
      this.saveClock = 0;
      this.emit();
      return true;
    } catch (e) {
      this.warning = e.message;
      this.conflict = e.code === "CONFLICT";
      this.emit();
      return false;
    }
  }
  mutate(fn) {
    if (!this.writable)
      return { ok: false, reason: this.warning || "Profile is read only." };
    // Purchases and payouts are committed before becoming visible; failed writes
    // keep consumed fuel/damage dirty but cannot grant an unsaved paid service.
    if (!this.flush()) return { ok: false, reason: this.warning };
    const next = structuredClone(this.profile),
      result = fn(next);
    if (!result?.ok) return result;
    try {
      this.profile = this.repository.commit(next, this.baseRevision);
      this.baseRevision = this.profile.revision;
      this.dirty = false;
      this.warning = "";
      this.emit();
      return result;
    } catch (e) {
      this.warning = e.message;
      this.conflict = e.code === "CONFLICT";
      this.emit();
      return { ok: false, reason: e.message };
    }
  }
  begin(level, practice = false) {
    if (this.pendingFinish && !this.retry()) return null;
    const known = this.levels.find(
      (l) => l.id === level?.id && l.revision === level.revision,
    );
    if (!known) return null;
    level = known;
    const result = this.mutate((p) => {
      if (!practice && !p.career.unlockedCourses.includes(level.id))
        return { ok: false, reason: "Clear the previous river first." };
      if (p.career.sequence >= 1e9)
        return { ok: false, reason: "Attempt limit reached." };
      const sequence = ++p.career.sequence;
      p.career.activeAttempt = {
        sequence,
        courseId: level.id,
        revision: level.revision,
        gateCount: level.checkpoints.length,
        checkpoints: 0,
        seconds: 0,
        lastGateTime: 0,
        valid: true,
        clean: true,
        practice: !!practice,
      };
      return { ok: true, sequence, courseId: level.id };
    });
    return result.ok
      ? { sequence: result.sequence, courseId: result.courseId }
      : null;
  }
  cancel(token) {
    if (
      this.pendingFinish &&
      this.pendingFinish.proof.attempt?.sequence === token?.sequence &&
      !this.retry()
    )
      return;
    if (!token || !this.writable) return;
    const a = this.profile.career.activeAttempt;
    if (a?.sequence === token.sequence) {
      this.profile.career.activeAttempt = null;
      this.dirty = true;
      this.flush();
    }
  }
  checkpoint(token, from, to, time) {
    const a = this.profile.career.activeAttempt;
    if (!this.writable || !a || a.sequence !== token?.sequence) return;
    if (
      from !== a.checkpoints ||
      to !== from + 1 ||
      to > a.gateCount ||
      !Number.isFinite(time) ||
      time <= a.lastGateTime
    )
      a.valid = false;
    else {
      a.checkpoints = to;
      a.lastGateTime = time;
    }
    this.dirty = true;
    this.flush();
  }
  step(dt, b, token, throttle = b.throttle ?? 0, running = true) {
    if (!this.writable || !Number.isFinite(dt) || dt <= 0) return;
    const p = this.profile,
      a = p.career.activeAttempt,
      t = this.tuning.values;
    if (running) {
      p.boat.fuel = Math.max(
        0,
        p.boat.fuel -
          fuelConsumed(dt, throttle, Math.hypot(b.vx || 0, b.vz || 0), t),
      );
      this.dirty = true;
    }
    const impulse = Math.max(0, b.collisionImpulse || 0);
    if (impulse > 0.01) {
      if (this.impactGap >= t.impactRelease) this.impactPeak = 0;
      this.impactGap = 0;
      const severity = Math.max(this.impactPeak, impulse),
        damage = impactDamage(severity, t) - impactDamage(this.impactPeak, t);
      this.impactPeak = severity;
      if (damage > 0) {
        p.boat.condition = Math.max(0, p.boat.condition - damage);
        this.dirty = true;
        if (a && a.checkpoints < a.gateCount) a.clean = false;
      }
    } else this.impactGap += dt;
    if (a && a.sequence === token?.sequence && a.checkpoints < a.gateCount) {
      a.seconds += dt;
      if (a.seconds > 86400) a.valid = false;
      this.dirty = true;
    }
    this.saveClock += dt;
    if (this.saveClock >= 3) {
      this.saveClock = 0;
      this.flush();
    }
  }
  resetImpact() {
    this.impactGap = Infinity;
    this.impactPeak = 0;
  }
  framing() {
    this.performance.powerScale = powerScale(
      this.profile.boat,
      this.tuning.values,
    );
    return this.performance;
  }
  complete(level, time, practice, proof = {}) {
    const known = this.levels.find(
      (l) => l.id === level?.id && l.revision === level.revision,
    );
    if (!known)
      return { valid: false, total: 0, reason: "Unknown career course." };
    level = known;
    const token = proof.attempt,
      a = this.profile.career.activeAttempt;
    const minimum = Math.max(
      3,
      (level.finish.distance - level.startDistance) / 100,
    );
    if (
      practice ||
      !a ||
      a.practice ||
      a.sequence !== token?.sequence ||
      a.courseId !== level.id ||
      a.revision !== level.revision ||
      !a.valid ||
      a.checkpoints !== a.gateCount ||
      proof.checkpoints !== a.gateCount ||
      !Number.isFinite(time) ||
      time < minimum ||
      time > 86400 ||
      a.seconds < minimum ||
      time < a.seconds - 0.1 ||
      Math.abs(a.lastGateTime - time) > 0.1
    )
      return {
        valid: false,
        personalBest: false,
        total: 0,
        reason: practice
          ? "Practice / no payout"
          : "Run did not meet career validation / no payout",
      };
    const reward = this.mutate((p) => {
      const c = p.career,
        active = c.activeAttempt;
      if (
        !active ||
        active.sequence !== token.sequence ||
        token.sequence <= c.paidSequence
      )
        return {
          ok: false,
          reason: "This attempt was already settled or superseded.",
        };
      const old = c.records[level.id],
        same = old?.revision === level.revision,
        firstClear = !c.completedCourses.includes(level.id),
        personalBest = !same || time < old.best,
        table = garageEconomy.prizes[level.index],
        improvement = same && time < old.best - 0.01 ? table.improvement : 0,
        clean = active.clean && proof.clean !== false,
        prize =
          table.finish +
          (firstClear ? table.firstClear : 0) +
          improvement +
          (clean ? table.clean : 0);
      if (p.cash + prize > 1e9 || p.lifetimeEarnings + prize > 1e9)
        return { ok: false, reason: "Profile balance limit reached." };
      c.paidSequence = token.sequence;
      c.activeAttempt = null;
      p.cash += prize;
      p.lifetimeEarnings += prize;
      c.records[level.id] = {
        revision: level.revision,
        best: Math.min(same ? old.best : Infinity, time),
        recent: time,
        completions: (old?.completions || 0) + 1,
        completed: true,
      };
      if (firstClear) c.completedCourses.push(level.id);
      const next = this.levels[level.index + 1];
      if (next && !c.unlockedCourses.includes(next.id))
        c.unlockedCourses.push(next.id);
      const row = {
        courseId: level.id,
        sequence: token.sequence,
        total: time,
        prize,
        at: new Date().toISOString(),
      };
      p.results.push(row);
      p.results = p.results.slice(-50);
      return {
        ok: true,
        valid: true,
        personalBest,
        total: prize,
        prize: table.finish,
        firstClear: firstClear ? table.firstClear : 0,
        improvement,
        cleanBonus: clean ? table.clean : 0,
        wallet: p.cash,
        sequence: token.sequence,
        courseId: level.id,
        best: c.records[level.id].best,
      };
    });
    if (!reward.ok) {
      this.pendingFinish = { level, time, practice, proof };
      return {
        valid: false,
        pending: true,
        total: 0,
        personalBest: false,
        reason: "Result pending profile save. Retry in the garage.",
      };
    }
    this.pendingFinish = null;
    this.lastReward = reward;
    return reward;
  }
  retry() {
    if (!this.flush()) return false;
    if (this.pendingFinish) {
      const p = this.pendingFinish;
      return this.complete(p.level, p.time, p.practice, p.proof).valid === true;
    }
    return true;
  }
  quote(kind) {
    return serviceQuote(this.profile, kind);
  }
  service(kind) {
    return this.mutate((p) => {
      const q = serviceQuote(p, kind);
      if (!q.available)
        return {
          ok: false,
          reason: "Insufficient cash or service is already complete.",
        };
      p.cash -= q.cost;
      p.boat[kind] = q.to;
      return { ok: true, ...q };
    });
  }
  emergency() {
    return this.mutate((p) => {
      if (!emergencyAvailable(p))
        return {
          ok: false,
          reason:
            "Emergency service is reserved for critical fuel/condition without enough cash for a basic service.",
        };
      p.boat.fuel = Math.max(p.boat.fuel, garageEconomy.emergencyFuel);
      p.boat.condition = Math.max(
        p.boat.condition,
        garageEconomy.emergencyCondition,
      );
      return { ok: true, cost: 0 };
    });
  }
  export() {
    return JSON.stringify(this.profile, null, 2);
  }
}
// Adapter keeps the original tour/UI contract; profile is the sole live authority.
export class CareerRiverProgress {
  constructor(career, getThrottle = () => undefined) {
    this.career = career;
    this.getThrottle = getThrottle;
  }
  get values() {
    return { schema: 1, records: this.career.profile.career.records };
  }
  get warning() {
    return this.career.warning;
  }
  isUnlocked(level) {
    return this.career.profile.career.unlockedCourses.includes(level.id);
  }
  best(id) {
    const level = this.career.levels.find((l) => l.id === id),
      r = this.career.profile.career.records[id];
    return r?.revision === level?.revision ? r.best : null;
  }
  begin(level, practice) {
    this.career.resetImpact();
    return this.career.begin(level, practice);
  }
  cancel(token) {
    this.career.cancel(token);
  }
  motion(b, dt, token) {
    this.career.step(dt, b, token, this.getThrottle() ?? b.throttle ?? 0);
  }
  checkpoint(...args) {
    this.career.checkpoint(...args);
  }
  complete(...args) {
    return this.career.complete(...args);
  }
  retry() {
    return this.career.retry();
  }
}
