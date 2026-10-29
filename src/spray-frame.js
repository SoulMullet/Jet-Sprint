// Visual emission only. Hull local +X is bow/forward; local -X is stern/aft.
// Physics yaw is +towards world +Z, rendered by Three.js rotation.y = -angle.
// Keep the immutable water/wake history and the propulsion integrator independent.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const flat = Object.freeze({});
export function createSprayFrame() {
  return {};
}
export function updateSprayFrame(out, b, pose = flat) {
  const c = Math.cos(b.angle),
    s = Math.sin(b.angle);
  const pitch = pose.pitch || 0,
    roll = pose.roll || 0;
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  out.x = b.x;
  out.y = -0.12 + (pose.heave || 0);
  out.z = b.z;
  out.hx = c;
  out.hz = s;
  out.forwardCos = cp;
  // Columns of Ry(-angle) Rx(roll) Rz(pitch), matching BoatPresentation's YXZ.
  out.fx = c * cp - s * sr * sp;
  out.fy = cr * sp;
  out.fz = s * cp + c * sr * sp;
  out.ux = -c * sp - s * sr * cp;
  out.uy = cr * cp;
  out.uz = -s * sp + c * sr * cp;
  out.sx = -s * cr;
  out.sy = -sr;
  out.sz = c * cr;
  out.forward = b.vx * c + b.vz * s;
  out.lateral = -b.vx * s + b.vz * c;
  out.yaw = b.yawRate || 0;
  out.load = Number.isFinite(b.lateralAcceleration)
    ? b.lateralAcceleration
    : out.forward * out.yaw;
  out.slip = Math.atan2(out.lateral, Math.max(0.5, Math.abs(out.forward)));
  out.pump = clamp(b.pump || 0, 0, 1.6);
  out.nozzle = clamp(b.nozzle || 0, -Math.PI * 0.45, Math.PI * 0.45);
  localSprayPoint(out, -2.35, 0.34, 0, out);
  out.sternX = out.px;
  out.sternY = out.py;
  out.sternZ = out.pz;
  return out;
}
export function localSprayPoint(frame, x, y, z, out) {
  out.px = frame.x + frame.fx * x + frame.ux * y + frame.sx * z;
  out.py = Math.max(
    0.035,
    frame.y + frame.fy * x + frame.uy * y + frame.sy * z,
  );
  out.pz = frame.z + frame.fz * x + frame.uz * y + frame.sz * z;
  return out;
}
export function jetLaunch(
  out,
  frame,
  speed,
  distance,
  scale = 1,
  spread = 0,
  lift = 1,
) {
  const exit =
    (8 + speed * 0.6 + frame.pump * 4) * Math.max(0, distance) * scale;
  // Carry translation, but distance is a length control: reducing it must never
  // turn the world-space launch into a forward-facing fountain at high speed.
  const aft = Math.min(
    -0.5 / Math.max(0.1, frame.forwardCos),
    frame.forward * 0.55 - exit * Math.cos(frame.nozzle),
  );
  // Water goes opposite the hull's reaction force: positive nozzle => +local Z.
  const side =
    (frame.lateral - 2.35 * frame.yaw) * 0.35 +
    exit * Math.sin(frame.nozzle) +
    spread;
  out.px = frame.sternX;
  out.py = frame.sternY;
  out.pz = frame.sternZ;
  out.vx = frame.fx * aft + frame.sx * side;
  out.vz = frame.fz * aft + frame.sz * side;
  out.vy = Math.min(
    9.2,
    Math.max(
      1.2,
      (3.5 + speed * 0.12) *
        lift *
        Math.min(1, Math.sqrt(Math.max(0, distance))) +
        frame.fy * aft +
        frame.sy * side,
    ),
  );
  return out;
}
export function hullLaunch(out, frame, speed, sample = 0.5, lift = 1) {
  // Slip loads the leading chine; a clean turn throws a sheet to the outside.
  const side =
    Math.sign(frame.lateral - frame.load * 0.15) || Math.sign(-frame.yaw) || 1;
  localSprayPoint(frame, -0.6 - sample, 0.18, side * 0.86, out);
  const aft = Math.min(-0.8, frame.forward * 0.2 - (1 + speed * 0.12));
  const across =
    side *
      (2 +
        Math.abs(frame.lateral) * 0.7 +
        Math.min(25, Math.abs(frame.load)) * 0.12) +
    frame.lateral * 0.25;
  out.vx = frame.fx * aft + frame.sx * across;
  out.vz = frame.fz * aft + frame.sz * across;
  out.vy = Math.min(
    9.2,
    Math.max(
      1,
      (1.5 +
        Math.abs(frame.lateral) * 0.18 +
        Math.min(20, Math.abs(frame.load)) * 0.06) *
        lift +
        frame.fy * aft +
        frame.sy * across,
    ),
  );
  return out;
}
export function hullSprayRate(frame, speed, impact = 0) {
  const t = clamp((speed - 0.5) / 4.5, 0, 1),
    moving = t * t * (3 - 2 * t);
  return (
    moving *
      (Math.abs(frame.lateral) * 65 +
        Math.abs(Math.sin(frame.slip)) * speed * 35 +
        Math.min(25, Math.abs(frame.load)) * 12) +
    Math.max(0, impact) * 600
  );
}
export function flightTime(y, vy) {
  return Math.min(
    2,
    (vy + Math.sqrt(vy * vy + 19.6 * Math.max(0, y - 0.035))) / 9.8,
  );
}
