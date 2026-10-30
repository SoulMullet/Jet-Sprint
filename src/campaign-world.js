import * as THREE from "three";
import { createCourse } from "./course.js";
import { track1, track2, river1, campaignDefinition } from "./campaign-data.js";
import { nearestOnTrack } from "./track.js";

// Open routes clamp at their ends; they never wrap into a false return leg.
export function createJourneyPath(definition, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    definition.spline.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    "centripetal",
  );
  const samples = curve.getPoints(
    Math.ceil(curve.getLength() / (definition.sampleSpacing ?? 1.2)),
  );
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
  raceCourse = null,
  destinationCourse = null,
} = {}) {
  const race = raceCourse ?? createCourse(raceDefinition.route, raceDefinition),
    river = createJourneyPath(riverDefinition),
    destination =
      destinationCourse ?? createJourneyPath(destinationDefinition, true);
  for (const edge of race.edges)
    edge.points.waterWidth = raceDefinition.waterWidth;
  const mouthDistance = 60,
    mouth = river.points.filter(
      (_, i) => river.line[i].distance < mouthDistance,
    ),
    tail = river.points.filter(
      (_, i) => river.line[i].distance > mouthDistance,
    ),
    join = river.sample(mouthDistance);
  mouth.push({ x: join.x, z: join.z });
  tail.unshift({ x: join.x, z: join.z });
  Object.assign(mouth, { id: river.id, waterWidth: raceDefinition.waterWidth });
  Object.assign(tail, { id: river.id, waterWidth: riverDefinition.waterWidth });
  const riverFootprint = [mouth, tail];
  const network = {
    baseWidth: raceDefinition.waterWidth,
    gradedFloodplain: true,
    bounds: { minX: -260, maxX: 260, minZ: -240, maxZ: 240 },
    paths: [...race.network.paths, ...riverFootprint, destination.points],
  };
  const staging = destinationDefinition.staging
    ? createJourneyPath({
        id: destinationDefinition.id + ":staging",
        name: destinationDefinition.name + " staging",
        ...destinationDefinition.staging,
      })
    : null;
  if (staging) network.paths.push(staging.points);
  const all = network.paths.flat();
  network.bounds = {
    minX: Math.min(...all.map((p) => p.x)) - 45,
    maxX: Math.max(...all.map((p) => p.x)) + 45,
    minZ: Math.min(...all.map((p) => p.z)) - 45,
    maxZ: Math.max(...all.map((p) => p.z)) + 45,
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
    riverFootprint,
    destination,
    staging,
    network,
    gate,
    checkpoints,
    raceDefinition,
    riverDefinition,
    destinationDefinition,
    nearest: (x, z) => nearestOnTrack(network, x, z),
  };
}

export function createCampaignAdventure(definition = campaignDefinition) {
  const courses = definition.tracks.map((d) => createCourse(d.route, d));
  const staging = definition.tracks.map((d) =>
    d.staging
      ? createJourneyPath({
          id: d.id + ":staging",
          name: d.name + " staging",
          ...d.staging,
        })
      : null,
  );
  const legs = definition.rivers.map((d, i) =>
    createCampaignWorld({
      raceDefinition: definition.tracks[i],
      riverDefinition: d,
      destinationDefinition: definition.tracks[i + 1],
      raceCourse: courses[i],
      destinationCourse: courses[i + 1],
    }),
  );
  const paths = [];
  for (let i = 0; i < courses.length; i++) {
    for (const edge of courses[i].edges) {
      edge.points.waterWidth = definition.tracks[i].waterWidth;
      paths.push(edge.points);
    }
    if (staging[i]) paths.push(staging[i].points);
  }
  for (const leg of legs) paths.push(...leg.riverFootprint);
  const network = { paths, baseWidth: 9, gradedFloodplain: true };
  const nearest = (x, z) => nearestOnTrack(network, x, z);
  const rocks = [];
  for (const leg of legs) {
    leg.network = network;
    leg.nearest = nearest;
    const r = leg.riverDefinition;
    if (!r.rockSpacing) continue;
    let n = 0;
    for (let d = 230; d < leg.river.length - 180; d += r.rockSpacing) {
      const p = leg.river.sample(d),
        side = n++ % 2 ? 1 : -1,
        radius = r.number === 3 ? 2 : 1.35;
      rocks.push({
        id: `${r.id}:rock-${n}`,
        riverId: r.id,
        x: p.x - p.tz * side * (r.waterWidth - 3),
        z: p.z + p.tx * side * (r.waterWidth - 3),
        radius,
      });
    }
  }
  return {
    definition,
    courses,
    staging,
    legs,
    network,
    nearest,
    rocks,
    race: courses[0],
    river: legs[0].river,
    destination: courses[1],
    raceDefinition: definition.tracks[0],
  };
}

// Select whole intersecting line segments with a guard beyond the tile edge.
// Geometry is clipped afterwards, so there are no artificial channel end caps.
export function sliceCampaignNetwork(network, bounds, guard = 18) {
  const paths = [];
  for (const path of network.paths) {
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        run.id = path.id;
        run.waterWidth = path.waterWidth;
        paths.push(run);
      }
      run = [];
    };
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i],
        q = path[i + 1],
        r = (path.waterWidth ?? 9) + guard;
      if (
        Math.max(p.x, q.x) + r >= bounds.minX &&
        Math.min(p.x, q.x) - r <= bounds.maxX &&
        Math.max(p.z, q.z) + r >= bounds.minZ &&
        Math.min(p.z, q.z) - r <= bounds.maxZ
      ) {
        if (!run.length) run.push(p);
        run.push(q);
      } else flush();
    }
    flush();
  }
  return {
    paths,
    baseWidth: 9,
    gradedFloodplain: true,
    bounds,
    clipBounds: bounds,
  };
}
