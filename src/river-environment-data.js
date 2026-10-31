import { clearShoreRock } from "./scenery-clearance.js";
import { riverJumpSites } from "./river-jumps.js";
// Stable decoration seed/version, independent of route generation and Math.random.
export function riverEnvironmentData(world) {
  const logs = [],
    boulders = [],
    seals = [];
  let seed = 87031;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const leg of world.legs) {
    const r = leg.riverDefinition,
      jumps = riverJumpSites(leg);
    for (
      let distance = 290;
      distance < leg.river.length - 150;
      distance += 480
    ) {
      if (
        jumps.some((j) => Math.abs(j.distance - distance) < 65) ||
        leg.checkpoints.some((g) => Math.abs(g.distance - distance) < 18)
      )
        continue;
      const p = leg.river.sample(distance),
        side = random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const length = k === 0 ? 3.4 : 0.8 + random() * 0.5,
          radius = k === 0 ? 0.28 : 0.12,
          x =
            p.x -
            p.tz *
              side *
              (k === 0
                ? r.waterWidth + 0.15
                : r.waterWidth - 0.6 + (k - 1) * 0.2) +
            p.tx * k * 1.5,
          z =
            p.z +
            p.tx *
              side *
              (k === 0
                ? r.waterWidth + 0.15
                : r.waterWidth - 0.6 + (k - 1) * 0.2) +
            p.tz * k * 1.5;
        const a = { x: x - (p.tx * length) / 2, z: z - (p.tz * length) / 2 },
          b = { x: x + (p.tx * length) / 2, z: z + (p.tz * length) / 2 };
        if (
          [a, b, { x, z }].every((q) => {
            const n = world.nearest(q.x, q.z);
            return (
              Math.hypot(q.x - n.x, q.z - n.z) >
              (n.hullLimit ?? 6.5) + 1.2 + radius + 0.2
            );
          })
        )
          logs.push({
            id: r.id + ":wood-" + logs.length,
            x,
            z,
            tx: p.tx,
            tz: p.tz,
            length,
            radius,
            y: k === 0 ? -0.08 : -0.02,
            a,
            b,
          });
      }
      const radius = 1 + random() * 1.6,
        shore = clearShoreRock(
          p.x + p.tz * side * (r.waterWidth + 4),
          p.z - p.tx * side * (r.waterWidth + 4),
          radius,
          world.nearest,
        );
      boulders.push({
        id: r.id + ":shore-" + boulders.length,
        riverId: r.id,
        ...shore,
        radius,
      });
    }
    for (const f of [0.3, 0.65]) {
      const p = leg.river.sample(leg.river.length * f),
        x = p.x - p.tz * (r.waterWidth - 0.4),
        z = p.z + p.tx * (r.waterWidth - 0.4),
        n = world.nearest(x, z);
      if (Math.hypot(x - n.x, z - n.z) > (n.hullLimit ?? 6.5) + 2)
        seals.push({ x, z });
    }
  }
  return {
    version: "river-dressing-1987-v1",
    seed: 87031,
    logs,
    boulders,
    seals,
  };
}
export function resolveLogContacts(b, logs) {
  for (const log of logs) {
    if (Math.abs(b.x - log.x) > 6 || Math.abs(b.z - log.z) > 6) continue;
    const dx = log.b.x - log.a.x,
      dz = log.b.z - log.a.z,
      t = Math.max(
        0,
        Math.min(
          1,
          ((b.x - log.a.x) * dx + (b.z - log.a.z) * dz) / (dx * dx + dz * dz),
        ),
      ),
      x = log.a.x + dx * t,
      z = log.a.z + dz * t,
      ox = b.x - x,
      oz = b.z - z,
      d = Math.hypot(ox, oz),
      radius = log.radius + 1.2;
    if (d >= radius || d < 1e-7) continue;
    const nx = ox / d,
      nz = oz / d,
      v = b.vx * nx + b.vz * nz;
    b.x = x + nx * radius;
    b.z = z + nz * radius;
    if (v < 0) {
      b.vx -= v * nx * 1.2;
      b.vz -= v * nz * 1.2;
      b.collisionImpulse = Math.max(b.collisionImpulse || 0, -v * 1.2);
    }
  }
}
