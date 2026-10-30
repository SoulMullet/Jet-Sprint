import * as THREE from "three";
import { createCourse } from "./course.js";
import { track1, track2, river1 } from "./campaign-data.js";
import { nearestOnTrack } from "./track.js";

// Open routes clamp at their ends; they never wrap into a false return leg.
export function createJourneyPath(definition, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    definition.spline.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    "centripetal",
  );
  const samples = curve.getPoints(Math.ceil(curve.getLength() / 1.2));
  let length = 0;
  const line = samples.map((p, i) => {
    if (i) length += p.distanceTo(samples[i - 1]);
    return { x: p.x, z: p.z, distance: length };
  });
  const points = samples;
  points.id = definition.id;
  points.waterWidth = definition.waterWidth;
  const sample = (distance, out = {}) => {
    const d = closed
      ? ((distance % length) + length) % length
      : Math.max(0, Math.min(length, distance));
    let lo = 0,
      hi = line.length - 2;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if (line[m].distance <= d) lo = m;
      else hi = m - 1;
    }
    const p = line[lo],
      q = line[lo + 1],
      span = q.distance - p.distance,
      t = (d - p.distance) / span;
    out.x = p.x + (q.x - p.x) * t;
    out.z = p.z + (q.z - p.z) * t;
    out.tx = (q.x - p.x) / span;
    out.tz = (q.z - p.z) / span;
    out.distance = d;
    return out;
  };
  const project = (point, min = 0, max = length, out = {}) => {
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i],
        q = line[i + 1];
      if (q.distance < min || p.distance > max) continue;
      const dx = q.x - p.x,
        dz = q.z - p.z,
        l = q.distance - p.distance;
      const t = Math.max(
        Math.max(0, (min - p.distance) / l),
        Math.min(
          Math.min(1, (max - p.distance) / l),
          ((point.x - p.x) * dx + (point.z - p.z) * dz) / (l * l),
        ),
      );
      const x = p.x + dx * t,
        z = p.z + dz * t,
        e = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (e < best) {
        best = e;
        out.x = x;
        out.z = z;
        out.distance = p.distance + t * l;
        out.tx = dx / l;
        out.tz = dz / l;
      }
    }
    out.error = Math.sqrt(best);
    return out;
  };
  return {
    id: definition.id,
    name: definition.name,
    definition,
    points,
    line,
    length,
    sample,
    project,
  };
}
export function createCampaignWorld({
  raceDefinition = track1,
  riverDefinition = river1,
  destinationDefinition = track2,
} = {}) {
  const race = createCourse(raceDefinition.route, raceDefinition),
    river = createJourneyPath(riverDefinition),
    destination = createJourneyPath(destinationDefinition, true);
  for (const edge of race.edges)
    edge.points.waterWidth = raceDefinition.waterWidth;
  const network = {
    baseWidth: raceDefinition.waterWidth,
    gradedFloodplain: true,
    bounds: { minX: -260, maxX: 260, minZ: -240, maxZ: 240 },
    paths: [...race.network.paths, river.points, destination.points],
  };
  const gate = {
    ...river.sample(riverDefinition.gateDistance),
    halfWidth: riverDefinition.waterWidth + 1,
  };
  const checkpoints = [];
  for (
    let d = riverDefinition.gateDistance + riverDefinition.checkpointSpacing;
    d < river.length - 12;
    d += riverDefinition.checkpointSpacing
  )
    checkpoints.push({
      ...river.sample(d),
      halfWidth: riverDefinition.waterWidth - 1.5,
    });
  checkpoints.push({
    ...river.sample(river.length - 3),
    halfWidth: riverDefinition.waterWidth - 1.5,
  });
  return {
    race,
    river,
    destination,
    network,
    gate,
    checkpoints,
    raceDefinition,
    riverDefinition,
    destinationDefinition,
    nearest: (x, z) => nearestOnTrack(network, x, z),
  };
}
