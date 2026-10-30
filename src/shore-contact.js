import { nearestOnTrack } from "./track.js";
// The hull is inset from the OUTSIDE of the union, not from every tributary.
// Capsule insets do not commute with union; the old query made false internal banks.
export function createShoreContact(network) {
  const scratch = {},
    recent = [];
  const radius = 2.5 / Math.cos(Math.PI / 16),
    directions = Array.from({ length: 16 }, (_, i) => [
      Math.cos((i * Math.PI) / 8),
      Math.sin((i * Math.PI) / 8),
    ]);
  const query = (x, z) => {
    const p = nearestOnTrack(network, x, z);
    p.collision = null;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d <= (p.waterWidth ?? 9) - radius) return p;
    if (d > (p.waterWidth ?? 9)) return p; // Solid land always retains bank collision.
    const rx = (x - p.x) / d,
      rz = (z - p.z) / d,
      sx = x + rx * 2.5,
      sz = z + rz * 2.5;
    const edge = nearestOnTrack(network, sx, sz, scratch),
      ex = sx - edge.x,
      ez = sz - edge.z,
      ed = Math.hypot(ex, ez);
    // Ordinary exposed banks keep the exact existing response and cheap path.
    if (
      ed > (edge.waterWidth ?? 9) &&
      (ex * rx + ez * rz) / ed > 0.995 &&
      Math.abs(ed - (edge.waterWidth ?? 9) - (d - (p.hullLimit ?? 6.5))) < 0.01
    )
      return p;
    let nx = 0,
      nz = 0,
      weight = 0,
      depth = 0,
      strongestX = 0,
      strongestZ = 0;
    for (const [ax, az] of directions) {
      const sx = x + ax * radius,
        sz = z + az * radius,
        n = nearestOnTrack(network, sx, sz, scratch),
        dx = sx - n.x,
        dz = sz - n.z,
        l = Math.hypot(dx, dz),
        outside = l - (n.waterWidth ?? 9);
      if (outside > 0) {
        nx += ax * outside;
        nz += az * outside;
        weight += outside;
        if (outside > depth) {
          depth = outside;
          strongestX = ax;
          strongestZ = az;
        }
      }
    }
    let length = Math.hypot(nx, nz);
    if (weight > 0 && length < weight * 0.2) {
      nx = strongestX;
      nz = strongestZ;
      length = 1;
    }
    if (weight > 0 && length > 1e-8) {
      nx /= length;
      nz /= length;
      p.collision = {
        x: x - nx * depth,
        z: z - nz * depth,
        hullLimit: 0,
        depth,
        nx,
        nz,
      };
    } else p.collision = { x, z, hullLimit: 0, depth: 0, nx: 0, nz: 0 };
    return p;
  };
  query.record = (b) => {
    if (b.bankDepth > 0.001) {
      recent.push({
        x: b.x,
        z: b.z,
        nx: b.bankNX,
        nz: b.bankNZ,
        impulse: b.collisionImpulse,
        depth: b.bankDepth,
      });
      if (recent.length > 32) recent.shift();
    }
  };
  query.recent = recent;
  query.radius = 2.5;
  return query;
}
