import {
  stepBoat,
  settings,
  PHYSICS_STEP,
  BOAT_MASS,
  REFERENCE_YAW_INERTIA,
} from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import { maintenanceDefaults, powerScale } from "../src/garage/definitions.js";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const parityFields = [
  "x",
  "z",
  "vx",
  "vz",
  "angle",
  "pump",
  "nozzle",
  "yawRate",
  "thrust",
];
const open = (x, z) => ({ x, z, hullLimit: 1e9 });
export function simulateParityCase(definition) {
  const saved = { ...settings };
  try {
    Object.assign(settings, handlingDefaults);
    const b = { ...definition.initial },
      samples = [];
    for (let step = 1; step <= definition.steps; step++) {
      const cmd = definition.commands.find((c) => step <= c.through);
      stepBoat(b, cmd, PHYSICS_STEP, open, {
        powerScale: definition.powerScale,
      });
      if (step % 60 === 0)
        samples.push({ step, state: parityFields.map((k) => b[k]) });
    }
    return samples;
  } finally {
    Object.assign(settings, saved);
  }
}
export function createParityPack() {
  const initial = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      pump: 0,
      nozzle: 0,
      yawRate: 0,
    },
    t = maintenanceDefaults(),
    cases = [
      {
        id: "healthy-straight",
        powerScale: 1,
        commands: [{ through: 960, throttle: 1, steering: 0 }],
      },
      {
        id: "healthy-turn-and-coast",
        powerScale: 1,
        commands: [
          { through: 240, throttle: 1, steering: 0 },
          { through: 600, throttle: 0.8, steering: 0.45 },
          { through: 960, throttle: 0, steering: -0.25 },
        ],
      },
      {
        id: "low-condition",
        powerScale: powerScale({ fuel: 50, condition: 0 }, t),
        commands: [{ through: 960, throttle: 1, steering: 0.2 }],
      },
      {
        id: "empty-tank-reserve",
        powerScale: powerScale({ fuel: 0, condition: 0 }, t),
        commands: [{ through: 960, throttle: 1, steering: 0.2 }],
      },
    ].map((c) => ({ ...c, steps: 960, initial: { ...initial } }));
  for (const c of cases) c.samples = simulateParityCase(c);
  return {
    type: "jet-sprint-physics-parity",
    version: 1,
    coordinates: "RH_Y_UP_X_FORWARD",
    units: {
      position: "metres",
      velocity: "m/s",
      heading: "radians",
      thrust: "newtons",
    },
    fixedStep: PHYSICS_STEP,
    massKg: BOAT_MASS,
    referenceYawInertiaKgM2: REFERENCE_YAW_INERTIA,
    boundary: "open-water; no banks/current",
    handling: handlingDefaults,
    maintenance: t,
    fields: parityFields,
    cases,
    tolerances: {
      javascriptAbsolute: 1e-8,
      proposedUnrealPositionMetres: 0.05,
      proposedUnrealHeadingRadians: 0.02,
    },
    scope:
      "Reference fixtures from the current JS integrator. No Unreal runner exists yet; cross-engine tolerances require validation.",
  };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const path = process.argv[2] || "docs/fixtures/physics-parity-v1.json";
  await writeFile(path, JSON.stringify(createParityPack(), null, 2) + "\n");
  console.log("Wrote " + path);
}
