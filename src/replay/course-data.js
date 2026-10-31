import { flightPitch, jumpDefaults } from "../river-jumps.js";
import { forceKeys, handlingKeys } from "../handling.js";
import { S, wrapAngle } from "./model.js";
export const BOAT_CONFIG = "sprint-boat-1987-v1",
  PHYSICS_VERSION = "waterjet-forces-v1";
export function fingerprint(value) {
  const text = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const tuneIdentifier = (tuning) =>
  "forces-" +
  fingerprint([
    ...forceKeys.map((k) => [k, tuning[k]]),
    ...["jumpLaunchScale", "jumpGravityScale"]
      .filter((k) => (tuning[k] ?? 1) !== 1)
      .map((k) => [k, tuning[k]]),
  ]);
export const recordKey = (meta) =>
  [meta.course.kind, meta.course.id, meta.course.revision, meta.tuneId].join(
    "/",
  );
export function courseDescriptor(world, index, kind = "race") {
  const path = kind === "race" ? world.courses[index] : world.legs[index].river,
    definition =
      kind === "race"
        ? world.definition.tracks[index]
        : world.definition.rivers[index],
    gates = kind === "race" ? path.gates : world.legs[index].checkpoints;
  const q = (n) => Math.round(n * 10000) / 10000;
  return {
    id: definition.id,
    name: definition.name,
    kind,
    index,
    routeId: definition.routeId || definition.id,
    revision: `${definition.version || 1}-${fingerprint([definition.waterWidth, path.points.map((p) => [q(p.x), q(p.z)]), gates.map((g) => [g.x, g.z, g.tx, g.tz, g.distance, g.halfWidth].map(q))])}`,
    length: path.length,
    gateCount: gates.length,
    lapCount: kind === "race" ? definition.laps : 0,
  };
}
export function createReplayMeta(course, tuning, build, sessionId, id) {
  return {
    id,
    sessionId,
    build,
    createdAt: new Date().toISOString(),
    name: course.name + " / recorded run",
    course,
    boatConfig: BOAT_CONFIG,
    physicsVersion: PHYSICS_VERSION,
    tuneId: tuneIdentifier(tuning),
    tuning: Object.fromEntries(
      [...handlingKeys, "jumpLaunchScale", "jumpGravityScale"].map((k) => [
        k,
        tuning[k] ?? jumpDefaults[k],
      ]),
    ),
  };
}
export function orderedProgress(tour, b, out = {}) {
  if (
    tour.phase === "RACE" ||
    tour.phase === "EXIT" ||
    tour.phase === "CHAMPION"
  ) {
    const c = tour.venue,
      r = tour.race;
    if (r.done) {
      out.progress = c.length * r.lapCount;
      out.valid = true;
      return out;
    }
    const next = r.next,
      previous = c.gates[(next + c.gates.length - 1) % c.gates.length],
      end = next === 0 ? c.length : c.gates[next].distance,
      p = c.project(b, previous.distance - 8, end + 10, out);
    out.progress =
      r.laps.length * c.length +
      Math.max(previous.distance, Math.min(end - 1e-5, p.distance));
    out.valid = p.error < tour.track.waterWidth + 1;
    return out;
  }
  const leaf = tour.leaf,
    g =
      leaf.world.checkpoints[
        Math.min(leaf.checkpoint, leaf.world.checkpoints.length - 1)
      ],
    prev = leaf.checkpoint
      ? leaf.world.checkpoints[leaf.checkpoint - 1].distance
      : tour.river.gateDistance,
    p = leaf.world.river.project(
      b,
      Math.max(0, prev - 8),
      g.distance + 10,
      out,
    );
  out.progress = Math.max(prev, Math.min(g.distance - 1e-5, p.distance));
  out.valid = p.error < tour.river.waterWidth + 1;
  return out;
}
// Same YXZ pose convention as BoatPresentation, expressed without Three.js.
export function captureRow(
  b,
  motion,
  height,
  verticalVelocity,
  progress,
  lap,
  next,
  input,
  out,
  previous = null,
  dt = 1 / 120,
  airborne = false,
) {
  const pitch =
      (motion.pitch || 0) +
      flightPitch(verticalVelocity, Math.hypot(b.vx, b.vz), airborne),
    x = motion.roll || 0,
    y = -b.angle,
    z = pitch,
    c1 = Math.cos(x / 2),
    c2 = Math.cos(y / 2),
    c3 = Math.cos(z / 2),
    s1 = Math.sin(x / 2),
    s2 = Math.sin(y / 2),
    s3 = Math.sin(z / 2);
  out.fill(0);
  out[S.x] = b.x;
  out[S.y] = -0.12 + (motion.heave || 0) + height;
  out[S.z] = b.z;
  out[S.qx] = s1 * c2 * c3 + c1 * s2 * s3;
  out[S.qy] = c1 * s2 * c3 - s1 * c2 * s3;
  out[S.qz] = c1 * c2 * s3 - s1 * s2 * c3;
  out[S.qw] = c1 * c2 * c3 + s1 * s2 * s3;
  out[S.vx] = b.vx;
  out[S.vy] = previous ? (out[S.y] - previous[S.y]) / dt : verticalVelocity;
  out[S.vz] = b.vz;
  // World angular velocity from the quaternion delta, including pitch/roll.
  if (previous) {
    const ax = out[4],
      ay = out[5],
      az = out[6],
      aw = out[7],
      bx = -previous[4],
      by = -previous[5],
      bz = -previous[6],
      bw = previous[7],
      dx = aw * bx + ax * bw + ay * bz - az * by,
      dy = aw * by - ax * bz + ay * bw + az * bx,
      dz = aw * bz + ax * by - ay * bx + az * bw,
      dw = aw * bw - ax * bx - ay * by - az * bz,
      l = Math.hypot(dx, dy, dz),
      angle = wrapAngle(2 * Math.atan2(l, dw)),
      k = l > 1e-9 ? angle / (l * dt) : 0;
    out[S.wx] = dx * k;
    out[S.wy] = dy * k;
    out[S.wz] = dz * k;
  } else out[S.wy] = -(b.yawRate || 0);
  out[S.throttle] = input.throttle || 0;
  out[S.steering] = input.steering || 0;
  out[S.speed] = Math.hypot(b.vx, b.vz);
  out[S.slip] = b.slipAngle || 0;
  out[S.heading] = wrapAngle(b.angle);
  out[S.progress] = progress;
  out[S.lap] = lap;
  out[S.checkpoint] = next;
  return out;
}
