// Portable replay kernel: seconds, metres, radians, RH Y-up / local +X forward.
// No renderer, physics integrator, device APIs or persistence dependencies.
export const REPLAY_VERSION = 1;
export const REPLAY_LIMITS = Object.freeze({
  bytes: 8 * 1024 * 1024,
  samples: 36002,
  events: 1024,
  seconds: 1800,
});
export const SAMPLE_FIELDS = Object.freeze([
  "t",
  "x",
  "y",
  "z",
  "qx",
  "qy",
  "qz",
  "qw",
  "vx",
  "vy",
  "vz",
  "wx",
  "wy",
  "wz",
  "throttle",
  "steering",
  "speed",
  "slip",
  "heading",
  "progress",
  "lap",
  "checkpoint",
]);
export const S = Object.freeze(
  Object.fromEntries(SAMPLE_FIELDS.map((k, i) => [k, i])),
);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (n, a = -1e6, b = 1e6) =>
  typeof n === "number" && Number.isFinite(n) && n >= a && n <= b;
const text = (v, max = 128) =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const fail = (ok, message) => {
  if (!ok) throw Error(message);
};
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function interpolateRow(a, b, t, out = new Array(SAMPLE_FIELDS.length)) {
  const u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  if (u === 0 || u === 1) {
    const row = u === 0 ? a : b;
    for (let i = 0; i < out.length; i++) out[i] = row[i];
    out[0] = t;
    return out;
  }
  for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * u;
  out[0] = t;
  for (const i of [S.heading, S.slip])
    out[i] = a[i] + wrapAngle(b[i] - a[i]) * u;
  out[S.lap] = u < 1 ? a[S.lap] : b[S.lap];
  out[S.checkpoint] = u < 1 ? a[S.checkpoint] : b[S.checkpoint];
  let dot = 0;
  for (let i = 4; i < 8; i++) dot += a[i] * b[i];
  const sign = dot < 0 ? -1 : 1;
  dot = clamp(Math.abs(dot), 0, 1);
  const theta = Math.acos(dot),
    sin = Math.sin(theta),
    wa = sin > 1e-6 ? Math.sin((1 - u) * theta) / sin : 1 - u,
    wb = sin > 1e-6 ? Math.sin(u * theta) / sin : u;
  let norm = 0;
  for (let i = 4; i < 8; i++) {
    out[i] = a[i] * wa + b[i] * sign * wb;
    norm += out[i] ** 2;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 4; i < 8; i++) out[i] /= norm;
  return out;
}
export function sampleReplay(
  replay,
  time,
  out = new Array(SAMPLE_FIELDS.length),
) {
  const rows = replay.samples,
    t = clamp(time, 0, replay.official.total);
  let lo = 0,
    hi = rows.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  return interpolateRow(rows[lo], rows[hi], t, out);
}
export function rowPose(row, out = {}) {
  for (let i = 0; i < SAMPLE_FIELDS.length; i++) out[SAMPLE_FIELDS[i]] = row[i];
  return out;
}
export class RaceRecorder {
  constructor(meta, interval = 0.05) {
    this.meta = meta;
    this.interval = clamp(interval, 0.05, 0.1);
    this.samples = [];
    this.events = [];
    this.previous = null;
    this.tick = 1;
    this.reason = "";
  }
  push(time, state) {
    if (this.reason) return;
    const row = state.slice();
    row[0] = time;
    if (!this.previous) {
      row[0] = 0;
      this.previous = row;
      this.samples.push(row.slice());
      return;
    }
    if (time <= this.previous[0]) return;
    if (
      time > REPLAY_LIMITS.seconds ||
      time / this.interval > REPLAY_LIMITS.samples - 2
    ) {
      this.reason = "Recording limit reached (30 minutes).";
      return;
    }
    while (this.tick * this.interval <= time + 1e-9) {
      const sample = interpolateRow(
        this.previous,
        row,
        this.tick * this.interval,
      );
      sample[S.throttle] = row[S.throttle];
      sample[S.steering] = row[S.steering];
      this.samples.push(sample);
      this.tick++;
    }
    this.previous = row;
  }
  event(event) {
    if (!this.reason && this.events.length < REPLAY_LIMITS.events)
      this.events.push({ ...event });
    else this.reason ||= "Event limit reached.";
  }
  finish(official, { eligible = true, reason = "" } = {}) {
    if (this.reason || !this.previous || this.previous[0] !== official.total)
      throw Error(
        this.reason || "Recording does not end at the official finish time.",
      );
    const last = this.samples.at(-1);
    if (Math.abs(last[0] - official.total) > 1e-8)
      this.samples.push(this.previous.slice());
    else this.samples[this.samples.length - 1] = this.previous.slice();
    return validateReplay({
      type: "jet-sprint-replay",
      version: REPLAY_VERSION,
      coordinates: "RH_Y_UP_X_FORWARD",
      fields: [...SAMPLE_FIELDS],
      meta: this.meta,
      interval: this.interval,
      complete: true,
      eligible,
      eligibilityNote: reason,
      official,
      events: this.events,
      samples: this.samples,
    });
  }
}
export function validateReplay(r) {
  fail(
    r?.type === "jet-sprint-replay" && r.version === REPLAY_VERSION,
    "Unsupported replay format/version.",
  );
  fail(
    r.coordinates === "RH_Y_UP_X_FORWARD",
    "Unsupported replay coordinate convention.",
  );
  fail(
    Array.isArray(r.fields) && r.fields.join(",") === SAMPLE_FIELDS.join(","),
    "Unexpected snapshot field layout.",
  );
  const m = r.meta,
    c = m?.course,
    o = r.official;
  fail(
    m &&
      text(m.id, 100) &&
      /^[\w:-]+$/.test(m.id) &&
      text(m.build, 80) &&
      text(m.createdAt, 40) &&
      text(m.boatConfig, 80) &&
      text(m.physicsVersion, 80) &&
      text(m.tuneId, 80) &&
      text(m.sessionId, 100),
    "Invalid replay metadata.",
  );
  fail(
    c &&
      text(c.id, 100) &&
      text(c.name, 96) &&
      text(c.revision, 100) &&
      text(c.routeId, 100) &&
      ["race", "river"].includes(c.kind) &&
      Number.isInteger(c.index) &&
      c.index >= 0 &&
      c.index < 4 &&
      finite(c.length, 1, 100000) &&
      Number.isInteger(c.gateCount) &&
      c.gateCount > 0 &&
      c.gateCount <= 128 &&
      Number.isInteger(c.lapCount) &&
      c.lapCount >= (c.kind === "race" ? 1 : 0) &&
      c.lapCount <= 10,
    "Invalid course metadata.",
  );
  fail(
    text(m.name, 100) &&
      m.tuning &&
      typeof m.tuning === "object" &&
      !Array.isArray(m.tuning) &&
      Object.keys(m.tuning).length <= 128 &&
      Object.entries(m.tuning).every(
        ([k, v]) =>
          !["__proto__", "constructor", "prototype"].includes(k) &&
          (typeof v === "boolean" || finite(v, -1e6, 1e6)),
      ),
    "Invalid boat configuration.",
  );
  fail(
    r.complete === true &&
      typeof r.eligible === "boolean" &&
      typeof r.eligibilityNote === "string" &&
      r.eligibilityNote.length <= 200,
    "Incomplete or invalid recording.",
  );
  fail(
    finite(r.interval, 0.05, 0.1) &&
      o &&
      finite(o.total, 1e-6, REPLAY_LIMITS.seconds) &&
      Array.isArray(o.laps) &&
      Array.isArray(o.splits),
    "Invalid official times.",
  );
  fail(
    o.laps.length === (c.kind === "race" ? c.lapCount : 0) &&
      o.laps.every((t) => finite(t, 1e-6, REPLAY_LIMITS.seconds)) &&
      (c.kind !== "race" ||
        Math.abs(o.laps.reduce((a, b) => a + b, 0) - o.total) < 1e-6),
    "Lap times do not match the official result.",
  );
  fail(
    o.splits.length === c.gateCount * (c.kind === "race" ? c.lapCount : 1),
    "Missing official checkpoint splits.",
  );
  let lastTime = -1,
    lastProgress = -1;
  for (const [i, s] of o.splits.entries()) {
    const lap = c.kind === "race" ? Math.floor(i / c.gateCount) + 1 : 0,
      checkpoint = c.kind === "race" ? (i + 1) % c.gateCount : i;
    fail(
      finite(s.t, 0, o.total + 1e-8) &&
        s.t > lastTime &&
        finite(s.progress, 0, c.length * Math.max(1, c.lapCount) + 1) &&
        s.progress > lastProgress &&
        s.lap === lap &&
        s.checkpoint === checkpoint,
      "Invalid official checkpoint order/splits.",
    );
    lastTime = s.t;
    lastProgress = s.progress;
  }
  fail(
    Math.abs(lastTime - o.total) < 1e-6,
    "Final checkpoint does not match official finish.",
  );
  fail(
    Array.isArray(r.samples) &&
      r.samples.length >= 2 &&
      r.samples.length <= REPLAY_LIMITS.samples,
    "Snapshot limit exceeded or missing snapshots.",
  );
  lastTime = -1;
  for (const [i, row] of r.samples.entries()) {
    fail(
      Array.isArray(row) &&
        row.length === SAMPLE_FIELDS.length &&
        row.every((n) => finite(n)),
      "Invalid/non-finite snapshot.",
    );
    fail(
      row[0] > lastTime && row[0] <= o.total + 1e-8,
      "Snapshots must have increasing timestamps.",
    );
    lastTime = row[0];
    fail(
      i === r.samples.length - 1 || Math.abs(row[0] - i * r.interval) < 1e-6,
      "Snapshots do not follow the declared fixed interval.",
    );
    const norm = Math.hypot(...row.slice(4, 8));
    fail(Math.abs(norm - 1) < 0.002, "Invalid orientation quaternion.");
    fail(
      finite(row[S.throttle], 0, 1) &&
        finite(row[S.steering], -1, 1) &&
        finite(row[S.speed], 0, 200) &&
        Number.isInteger(row[S.lap]) &&
        row[S.lap] >= 0 &&
        row[S.lap] <= c.lapCount &&
        finite(row[S.progress], 0, c.length * Math.max(1, c.lapCount) + 1) &&
        row.slice(S.vx, S.vz + 1).every((n) => finite(n, -200, 200)) &&
        Number.isInteger(row[S.checkpoint]) &&
        row[S.checkpoint] >= 0 &&
        row[S.checkpoint] <
          (c.kind === "river" ? c.gateCount + 1 : c.gateCount),
      "Invalid telemetry.",
    );
  }
  fail(
    r.samples[0][0] === 0 && Math.abs(r.samples.at(-1)[0] - o.total) < 1e-8,
    "Missing exact start/finish snapshot.",
  );
  fail(
    Array.isArray(r.events) && r.events.length <= REPLAY_LIMITS.events,
    "Invalid event count.",
  );
  lastTime = -1;
  const types = [
    "start",
    "checkpoint",
    "lap",
    "race-complete",
    "river-start",
    "river-complete",
    "transition",
  ];
  for (const e of r.events) {
    fail(
      e &&
        types.includes(e.type) &&
        finite(e.t, 0, o.total + 1e-8) &&
        e.t >= lastTime &&
        (!Object.hasOwn(e, "lap") || Number.isInteger(e.lap)) &&
        (!Object.hasOwn(e, "checkpoint") || Number.isInteger(e.checkpoint)),
      "Invalid replay event.",
    );
    lastTime = e.t;
  }
  const encoded = JSON.stringify(r);
  fail(
    encoded.length <= REPLAY_LIMITS.bytes &&
      new TextEncoder().encode(encoded).byteLength <= REPLAY_LIMITS.bytes,
    "Replay exceeds 8 MB.",
  );
  return r;
}
export function decodeReplay(text) {
  fail(
    typeof text === "string" && text.length <= REPLAY_LIMITS.bytes,
    "Replay exceeds 8 MB.",
  );
  fail(
    new TextEncoder().encode(text).byteLength <= REPLAY_LIMITS.bytes,
    "Replay exceeds 8 MB.",
  );
  return validateReplay(JSON.parse(text));
}
export function compatibility(
  replay,
  course,
  {
    boatConfig = "sprint-boat-1987-v1",
    physicsVersion = "waterjet-forces-v1",
    tuneId,
  } = {},
) {
  const c = replay.meta.course,
    reasons = [];
  if (
    c.id !== course.id ||
    c.kind !== course.kind ||
    c.routeId !== course.routeId ||
    c.revision !== course.revision
  )
    reasons.push("Different course, route or geometry revision.");
  if (replay.meta.boatConfig !== boatConfig)
    reasons.push("Different boat model configuration.");
  return {
    ok: !reasons.length,
    reasons,
    warning:
      replay.meta.physicsVersion !== physicsVersion
        ? "Original physics version differs; recorded poses are still used."
        : tuneId && replay.meta.tuneId !== tuneId
          ? "Different recorded tune; playback remains trajectory-based."
          : "",
  };
}
export class ReplayPlayer {
  constructor(replay) {
    this.replay = replay;
    this.time = 0;
    this.speed = 1;
    this.playing = false;
    this.row = new Array(SAMPLE_FIELDS.length);
    this.pose = {};
  }
  seek(t) {
    this.time = clamp(
      Number.isFinite(t) ? t : 0,
      0,
      this.replay.official.total,
    );
    if (this.time === this.replay.official.total) this.playing = false;
    return this.sample();
  }
  sample() {
    return rowPose(sampleReplay(this.replay, this.time, this.row), this.pose);
  }
  advance(dt) {
    if (this.playing && finite(dt, 0, 10000))
      this.seek(this.time + dt * this.speed);
    return this.sample();
  }
  setSpeed(speed) {
    if (![0.25, 0.5, 1, 2].includes(speed))
      throw Error("Unsupported playback speed.");
    this.speed = speed;
  }
  restart() {
    this.time = 0;
    this.playing = true;
    return this.sample();
  }
}
// Ordered route progress, never Euclidean distance. Official splits are exact
// anchors; within each required gate interval use the first forward traversal.
export function buildProgressIndex(replay) {
  let t0 = 0,
    p0 = replay.samples[0][S.progress],
    rowIndex = 0;
  const points = [[p0, 0]];
  for (const split of replay.official.splits) {
    let maximum = p0;
    while (
      rowIndex < replay.samples.length &&
      replay.samples[rowIndex][0] < split.t
    ) {
      const row = replay.samples[rowIndex++];
      if (row[0] <= t0) continue;
      const p = clamp(row[S.progress], p0, split.progress - 1e-5);
      if (p > maximum + 1e-6) {
        points.push([p, row[0]]);
        maximum = p;
      }
    }
    points.push([split.progress, split.t]);
    t0 = split.t;
    p0 = split.progress;
  }
  return points;
}
export function timeAtProgress(points, progress) {
  if (!finite(progress, points[0][0], points.at(-1)[0] + 1e-6)) return null;
  let lo = 0,
    hi = points.length - 1;
  while (lo + 1 < hi) {
    const m = (lo + hi) >> 1;
    if (points[m][0] <= progress) lo = m;
    else hi = m;
  }
  const a = points[lo],
    b = points[hi];
  return (
    a[1] + (b[1] - a[1]) * clamp((progress - a[0]) / (b[0] - a[0] || 1), 0, 1)
  );
}
