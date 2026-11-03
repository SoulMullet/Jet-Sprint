import {
  createCampaignAdventure,
  createJourneyPath,
} from "../campaign-world.js";
import { campaignDefinition } from "../campaign-data.js";
import { createRiverLevels } from "../river-levels.js";
import { createShoreContact } from "../shore-contact.js";
import { nearestOnTrack } from "../track.js";

export const ARCADE_COURSE_VERSION = "sunset-river-v1";
// Metres, Y-up. The two round basins are connected launch/finish water, not levels.
function basin(id, x, z) {
  return {
    id,
    name: "Sunset Marine",
    routeId: id + "-basin",
    version: 1,
    number: 1,
    spline: [
      [x, z + 12],
      [x - 12, z],
      [x, z - 12],
      [x + 12, z],
    ],
    nodes: { S: [x, z + 12], B: [x, z - 12] },
    edges: [{ id: "basin", from: "S", to: "S", start: 0, end: 4 }],
    route: ["basin"],
    waterWidth: 24,
    laps: 1,
    seed: 1987,
    sampleSpacing: 1.5,
    biome: "rookie",
    difficulty: 1,
    presentation: { focus: [x, z] },
  };
}
const river = {
  id: "sunset-river",
  name: "Sunset River",
  number: 1,
  waterWidth: 22,
  gateDistance: 8,
  checkpointSpacing: 85,
  sampleSpacing: 1.5,
  current: 0.45,
  currentResponse: 0.5,
  scoring: { checkpoint: 0, clean: 0, speedFactor: 0, maxSpeedBonus: 0 },
  rapids: { strength: 0.12, spacing: 140 },
  rockSpacing: 0,
  jump: {
    distance: 330,
    offset: 0,
    side: 1,
    halfWidth: 8,
    launch: 7.2,
    minSpeed: 9,
    bonus: 0,
  },
  spline: [
    [0, 0],
    [0, -90],
    [30, -180],
    [90, -260],
    [110, -350],
    [50, -430],
    [-45, -500],
    [-110, -590],
    [-90, -690],
    [10, -740],
    [110, -750],
    [165, -810],
    [160, -910],
    [110, -1010],
    [30, -1080],
    [-50, -1120],
    [-95, -1220],
    [-55, -1320],
    [35, -1370],
    [100, -1430],
    [100, -1530],
  ],
};
function logAt(path, distance, offset, length = 9) {
  const p = path.sample(distance),
    x = p.x - p.tz * offset,
    z = p.z + p.tx * offset,
    tx = -p.tz,
    tz = p.tx;
  return {
    id: "arcade-log-" + distance,
    x,
    z,
    tx,
    tz,
    length,
    radius: 0.32,
    y: 0.02,
    a: { x: x - (tx * length) / 2, z: z - (tz * length) / 2 },
    b: { x: x + (tx * length) / 2, z: z + (tz * length) / 2 },
  };
}
export function createArcadeWorld() {
  const world = createCampaignAdventure({
    ...campaignDefinition,
    id: ARCADE_COURSE_VERSION,
    timeLimit: 125,
    tracks: [basin("sunset-launch", 0, 0), basin("sunset-marina", 100, -1530)],
    rivers: [river],
  });
  const leg = world.legs[0],
    path = leg.river;
  world.arcade = true;
  world.circuitDecorations = false;
  const branch = createJourneyPath({
    id: "sunset-shortcut",
    name: "Gold Cut",
    waterWidth: 11,
    spline: [
      [110, -750],
      [103, -810],
      [102, -900],
      [110, -1010],
    ],
    sampleSpacing: 1.3,
  });
  // The spatial index caches immutable networks. Publish a new network so the
  // shortcut is real water for rendering, bathymetry, collisions and jumps.
  world.network = {
    ...world.network,
    paths: [...world.network.paths, branch.points],
  };
  world.nearest = (x, z) => nearestOnTrack(world.network, x, z);
  for (const environment of world.legs) {
    environment.network = world.network;
    environment.nearest = world.nearest;
  }
  world.collisionNearest = createShoreContact(world.network);
  world.shortcut = {
    path: branch,
    start: path.project(branch.sample(0)).distance,
    end: path.project(branch.sample(branch.length)).distance,
  };
  // Shared gates before/after the island validate either route; no hidden gate in a fork.
  leg.checkpoints = leg.checkpoints.filter(
    (g) =>
      g.distance < world.shortcut.start - 12 ||
      g.distance > world.shortcut.end + 25,
  );
  leg.arcade = true;
  leg.jumpSites = [330, path.length - 165].map((distance, i) => ({
    ...river.jump,
    id: "sunset-ramp-" + i,
    distance,
    deckLength: 8,
    deckRise: 0.55,
  }));
  const rocks = [
    { d: 190, o: 9 },
    { d: 550, o: -10 },
    { d: 1250, o: 10 },
    { d: path.length - 320, o: -10 },
  ].map(({ d, o }, i) => {
    const p = path.sample(d);
    return {
      id: "arcade-rock-" + i,
      riverId: river.id,
      x: p.x - p.tz * o,
      z: p.z + p.tx * o,
      radius: 1.6,
    };
  });
  const s = branch.sample(branch.length * 0.5);
  rocks.push({
    id: "shortcut-rock",
    riverId: river.id,
    x: s.x - s.tz * 5,
    z: s.z + s.tx * 5,
    radius: 1.35,
  });
  world.rocks.splice(0, world.rocks.length, ...rocks);
  leg.rocks = world.rocks;
  const logs = leg.jumpSites.map((j) => logAt(path, j.distance + 24, 0, 10));
  logs.push(logAt(path, 700, 9, 5));
  world.environmentData = {
    version: ARCADE_COURSE_VERSION,
    logs,
    boulders: [],
    seals: [],
  };
  world.debris = logs;
  world.pickups = [];
  const add = (route, d, offset = 0) => {
    const p = route.sample(d);
    world.pickups.push({
      id: "cash-" + world.pickups.length,
      x: p.x - p.tz * offset,
      z: p.z + p.tx * offset,
      value: 25,
    });
  };
  for (const [d, o] of [
    [180, -9],
    [205, -9],
    [520, 8],
    [545, 8],
    [720, -8],
    [750, -8],
    [1320, 9],
    [1345, 9],
  ])
    add(path, d, o);
  for (const j of leg.jumpSites)
    for (const d of [-18, -5, 15, 30, 45]) add(path, j.distance + d);
  for (let d = 35; d < branch.length - 20; d += 32) add(branch, d, -3);
  const levels = createRiverLevels(world);
  levels[0].id = "arcade-river-sunset";
  levels[0].revision = ARCADE_COURSE_VERSION;
  Object.assign(levels[0].replayDescriptor, {
    id: levels[0].id,
    revision: ARCADE_COURSE_VERSION,
  });
  world.riverRunLevels = levels;
  return { world, levels };
}
