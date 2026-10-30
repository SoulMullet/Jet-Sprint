// Development diagnostics; no geometry is changed automatically.
export function validateCourse(course) {
  const issues = [],
    check = (condition, code, detail) => {
      if (!condition) issues.push({ code, detail });
    };
  const ids = new Set(course.edges.map((e) => e.id));
  let previous = -1;
  for (const [i, g] of course.gates.entries()) {
    check(
      Number.isFinite(g.distance) && g.distance > previous,
      "checkpoint-order",
      i,
    );
    previous = g.distance;
    check(ids.has(g.edgeId), "missing-checkpoint-edge", i);
    const a = course.sample(g.distance - 2),
      b = course.sample(g.distance + 2),
      l = Math.hypot(b.x - a.x, b.z - a.z);
    check(
      l > 0 && (g.tx * (b.x - a.x) + g.tz * (b.z - a.z)) / l > 0.7,
      "reversed-checkpoint",
      i,
    );
  }
  for (const [i, e] of course.legs.entries()) {
    check(ids.has(e.id), "missing-route-edge", e.id);
    const next = course.legs[(i + 1) % course.legs.length],
      a = e.points.at(-1),
      b = next.points[0];
    check(
      e.to === next.from,
      "invalid-route-transition",
      `${e.id} → ${next.id}`,
    );
    check(
      Math.hypot(a.x - b.x, a.z - b.z) < 0.01,
      "disconnected-waterway",
      `${e.id} → ${next.id}`,
    );
  }
  for (const e of course.edges)
    for (let i = 1; i < e.points.length; i++)
      check(
        Math.hypot(
          e.points[i].x - e.points[i - 1].x,
          e.points[i].z - e.points[i - 1].z,
        ) > 1e-8,
        "duplicate-segment",
        `${e.id}:${i}`,
      );
  return {
    course: course.id,
    valid: issues.length === 0,
    gates: course.gates.length,
    issues,
  };
}
export function validateArrow(course, arrow) {
  const p = course.sample(arrow.distance);
  return p.tx * arrow.tx + p.tz * arrow.tz > 0.98;
}
export function reportCourseValidation(world) {
  const reports = world.courses.map(validateCourse);
  for (const r of reports)
    if (r.valid)
      console.info(
        `[Course validation] ${r.course}: ${r.gates} ordered forward checkpoints, connected route.`,
      );
    else console.warn("[Course validation]", r);
  return reports;
}

export function validateCollisionJoins(world, course) {
  const issues = [];
  let tested = 0,
    excludedInternal = 0;
  for (const j of course.junctions) {
    const center = course.nodes[j.node];
    for (let dx = -10; dx <= 10; dx += 2)
      for (let dz = -10; dz <= 10; dz += 2) {
        const x = center.x + dx,
          z = center.z + dz,
          raw = world.nearest(x, z),
          distance = Math.hypot(x - raw.x, z - raw.z);
        if (
          distance <= (raw.hullLimit ?? 6.5) ||
          distance > (raw.waterWidth ?? 9)
        )
          continue;
        let fits = true;
        for (let k = 0; k < 32; k++) {
          const a = (k * Math.PI) / 16,
            sx = x + Math.cos(a) * 2.5,
            sz = z + Math.sin(a) * 2.5,
            n = world.nearest(sx, sz);
          if (Math.hypot(sx - n.x, sz - n.z) > (n.waterWidth ?? 9) + 0.001) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        tested++;
        const p = world.collisionNearest(x, z),
          c = p.collision ?? p,
          depth = Math.hypot(x - c.x, z - c.z) - (c.hullLimit ?? 6.5);
        if (depth > 0.15)
          issues.push({
            code: "internal-collision-edge",
            detail: { x, z, depth },
          });
        else excludedInternal++;
      }
  }
  return { tested, excludedInternal, issues };
}
export function validateCampaign(
  world,
  { deep = false, arrows = [], activeCourse } = {},
) {
  return world.courses.map((course) => {
    const r = validateCourse(course);
    if (deep) {
      const collisions = validateCollisionJoins(world, course);
      r.collisionJoins = {
        tested: collisions.tested,
        excludedInternal: collisions.excludedInternal,
      };
      r.issues.push(...collisions.issues);
    }
    if (course.id === activeCourse)
      for (const a of arrows)
        if (!validateArrow(course, a))
          r.issues.push({
            code: "navigation-arrow-against-route",
            detail: a.distance,
          });
    r.valid = r.issues.length === 0;
    return r;
  });
}
