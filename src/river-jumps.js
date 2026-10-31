// Pure route-space jump definitions. Main spline/checkpoint geometry is untouched.
export const jumpDefaults = {
  jumpLaunchScale: 1,
  jumpGravityScale: 1,
  landingSplash: 1,
};
export function flightPitch(velocity, speed, airborne) {
  return airborne
    ? Math.max(
        -0.3,
        Math.min(
          0.3,
          Math.atan2(
            Number.isFinite(velocity) ? velocity : 0,
            Math.max(1, speed),
          ) * 0.35,
        ),
      )
    : 0;
}
export function safeJumpFlight(world, b, launch, gravity) {
  const duration =
    (launch + Math.sqrt(launch * launch + 2 * gravity * 0.02)) / gravity;
  for (let i = 1; i <= 16; i++) {
    const t = (duration * i) / 16,
      x = b.x + b.vx * t,
      z = b.z + b.vz * t,
      n = world.nearest(x, z);
    if (Math.hypot(x - n.x, z - n.z) > (n.hullLimit ?? 6.5) - 0.25)
      return false;
    for (const rock of world.rocks || [])
      if (Math.hypot(x - rock.x, z - rock.z) < rock.radius + 1.45) return false;
  }
  return true;
}
export function riverJumpSites(world) {
  if (world.jumpSites) return world.jumpSites;
  const r = world.riverDefinition,
    sites = [{ ...r.jump, id: r.id + ":jump-0" }];
  for (const fraction of [0.43, 0.73]) {
    for (let delta = 0; delta < 120; delta += 8) {
      const distance = Math.min(
          world.river.length - 110,
          world.river.length * fraction + delta,
        ),
        p = world.river.sample(distance),
        j = {
          ...r.jump,
          id: r.id + ":jump-" + sites.length,
          distance,
          side: sites.length % 2 ? 1 : -1,
          offset: 3.7,
          launch: 3.8,
        };
      const b = {
        x: p.x - p.tz * j.side * j.offset,
        z: p.z + p.tx * j.side * j.offset,
        vx: p.tx * 28,
        vz: p.tz * 28,
      };
      if (
        sites.every((s) => Math.abs(s.distance - distance) > 100) &&
        safeJumpFlight(world, b, j.launch, 9.8)
      ) {
        sites.push(j);
        break;
      }
    }
  }
  world.jumpSites = sites;
  return sites;
}
