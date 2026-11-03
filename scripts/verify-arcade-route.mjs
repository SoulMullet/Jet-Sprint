// Offline steering driver for reproducible route/physics checks, never loaded by gameplay.
import { createArcadeWorld } from "../src/arcade/river-world.js";
import { ArcadeTuning } from "../src/arcade/tuning.js";
import {
  ArcadeRiverTour,
  ArcadeRecords,
  ArcadeService,
} from "../src/arcade/run.js";
import { stepBoat, PHYSICS_STEP, settings } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export function driveArcade(shortcut = false) {
  Object.assign(settings, handlingDefaults);
  const { world, levels } = createArcadeWorld(),
    storage = {
      getItem() {
        return null;
      },
      setItem() {},
    },
    tuning = new ArcadeTuning(storage),
    tour = new ArcadeRiverTour(
      world,
      levels,
      new ArcadeRecords(storage, levels),
      tuning,
    ),
    service = new ArcadeService(tuning),
    p = levels[0].start,
    b = {
      x: p.x,
      z: p.z,
      angle: p.heading,
      vx: 0,
      vz: 0,
      pump: 0,
      nozzle: 0,
      yawRate: 0,
    },
    start = { state: "RACING", startAt: 0 };
  let now = 0,
    airFrames = 0,
    maxHeight = 0;
  const proj = {},
    ahead = {},
    branchProjection = {};
  while (!tour.done && now < 126) {
    const d = world.river.project(
      b,
      Math.max(0, tour.routeDistance - 30),
      Math.min(world.river.length, tour.routeDistance + 100),
      proj,
    ).distance;
    let route = world.river,
      distance = d;
    if (
      shortcut &&
      d > world.shortcut.start - 30 &&
      d < world.shortcut.end - 12
    ) {
      route = world.shortcut.path;
      distance = route.project(b, 0, route.length, branchProjection).distance;
    }
    const v = Math.hypot(b.vx, b.vz);
    route.sample(distance + 12 + v * 0.5, ahead);
    if (route === world.shortcut.path) {
      ahead.x += ahead.tz * 3;
      ahead.z -= ahead.tx * 3;
    }
    const a = Math.atan2(ahead.z - b.z, ahead.x - b.x) - b.angle,
      error = Math.atan2(Math.sin(a), Math.cos(a));
    const steering = Math.max(-1, Math.min(1, error * 2.2 - b.yawRate * 0.75)),
      before = { x: b.x, z: b.z };
    if (tour.beforePhysics(b, PHYSICS_STEP))
      stepBoat(
        b,
        { throttle: 1, steering },
        PHYSICS_STEP,
        world.collisionNearest,
        service.framing(),
      );
    now += PHYSICS_STEP;
    tour.step(before, b, PHYSICS_STEP, settings, now, start);
    airFrames += Number(tour.airborne);
    maxHeight = Math.max(maxHeight, tour.height);
  }
  return {
    route: shortcut ? "shortcut" : "safe",
    seconds: now,
    done: tour.done,
    failure: tour.failed,
    checkpoints: tour.checkpoint,
    required: levels[0].checkpoints.length,
    ...tour.summary(),
    airFrames,
    maxHeight,
    length: world.river.length,
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  console.log(JSON.stringify([driveArcade(), driveArcade(true)], null, 2));
