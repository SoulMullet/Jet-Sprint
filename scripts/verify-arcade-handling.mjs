// Repeatable force-response measurements, not a human feel or device benchmark.
import { stepBoat, settings, PHYSICS_STEP } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import { boatPerformance } from "../src/garage/upgrades.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export function measureArcadeHandling() {
  Object.assign(settings, handlingDefaults);
  const open = (x, z) => ({ x, z, index: 0 }),
    service = boatPerformance({}),
    step = PHYSICS_STEP,
    at = (v) => ({
      x: 0,
      z: 0,
      angle: 0,
      vx: v,
      vz: 0,
      pump: 1,
      nozzle: 0,
      yawRate: 0,
    }),
    b = at(30);
  let first = 0,
    yawAt250,
    yawAt500,
    lateralAt500;
  for (let i = 1; i <= 120; i++) {
    stepBoat(b, { throttle: 1, steering: 1 }, step, open, service);
    if (!first && b.yawRate > 0.5) first = i * step;
    if (i === 30) yawAt250 = (b.yawRate * 180) / Math.PI;
    if (i === 60) {
      yawAt500 = (b.yawRate * 180) / Math.PI;
      lateralAt500 = b.lateralSpeed;
    }
  }
  const steadyYaw = b.yawRate,
    steadySpeed = Math.hypot(b.vx, b.vz),
    slip = (Math.abs(b.slipAngle) * 180) / Math.PI;
  let reverse = 0;
  for (let i = 1; i <= 120; i++) {
    stepBoat(b, { throttle: 1, steering: -1 }, step, open, service);
    if (!reverse && b.yawRate < 0) reverse = i * step;
  }
  const coast = at(30);
  stepBoat(coast, { throttle: 0, steering: 0 }, step, open, service);
  const releaseThrust = coast.thrust;
  for (let i = 1; i < 120; i++)
    stepBoat(coast, { throttle: 0, steering: 0 }, step, open, service);
  const low = at(3);
  low.pump = 0;
  for (let i = 0; i < 120; i++)
    stepBoat(low, { throttle: 0, steering: 1 }, step, open, service);
  const stationary = at(0);
  stationary.pump = 0;
  for (let i = 0; i < 240; i++)
    stepBoat(stationary, { throttle: 0, steering: 1 }, step, open, service);
  return {
    timeToPoint5Yaw: first,
    yawAt250,
    yawAt500,
    lateralAt500,
    steadyYaw: (steadyYaw * 180) / Math.PI,
    steadyTurnRadius: steadySpeed / Math.abs(steadyYaw),
    slip,
    reverseSignSeconds: reverse,
    releaseThrust,
    coastSpeedAt1sec: Math.hypot(coast.vx, coast.vz),
    coastDistanceAt1sec: Math.hypot(coast.x, coast.z),
    coastingLowSpeedYaw: (low.angle * 180) / Math.PI,
    stationaryYaw: stationary.angle,
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  console.log(
    JSON.stringify(
      {
        method:
          "120 Hz stock-service force measurements; same prepared initial conditions as before.json.",
        settings: { ...handlingDefaults },
        metrics: measureArcadeHandling(),
      },
      null,
      2,
    ),
  );
