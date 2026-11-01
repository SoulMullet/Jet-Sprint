import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { settings, stepBoat } from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
import { boatPerformance, upgradeDefaults } from "../src/garage/upgrades.js";
import { toMph } from "../src/speed-units.js";
const saved = { ...settings },
  near = (x, z) => ({ x, z, hullLimit: 1e9 }),
  fresh = () => ({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    angle: 0,
    pump: 0,
    nozzle: 0,
    yawRate: 0,
  }),
  rows = [];
Object.assign(settings, handlingDefaults);
try {
  for (let engine = 0; engine <= 4; engine++)
    for (let pump = 0; pump <= 3; pump++) {
      const b = fresh(),
        perf = {
          ...boatPerformance({ engineStage: engine, pumpStage: pump }),
          powerScale: 1,
        };
      let sixty = null;
      for (let i = 0; i < 7200; i++) {
        stepBoat(b, { throttle: 1, steering: 0 }, 1 / 120, near, perf);
        if (sixty === null && toMph(b.vx) >= 60) sixty = i / 120;
      }
      const baseline = toMph(b.vx),
        t = upgradeDefaults();
      perf.thrustScale *= t.nitroPower;
      perf.boostDragScale = t.nitroPower / (1 + t.nitroSpeedInfluence) ** 3;
      perf.nitrous = 1;
      for (let i = 0; i < 2400; i++)
        stepBoat(b, { throttle: 1, steering: 0 }, 1 / 120, near, perf);
      rows.push({
        engine,
        pump,
        targetMPH: perf.topMph,
        settledMPH: baseline,
        secondsTo60MPH: sixty,
        boostMPH: toMph(b.vx),
      });
    }
  for (const r of rows) assert.ok(Math.abs(r.settledMPH - r.targetMPH) < 1);
  const full = rows.find((r) => r.engine === 4 && r.pump === 3);
  assert.ok(full.boostMPH > 140 && full.boostMPH < 145);
  const report = {
    conditions:
      "Actual stepBoat integrator at 120 Hz; published Balanced force settings; one healthy 650 kg hull; full throttle, centred nozzle, open straight water, no banks/current; 60 seconds settling then 20 seconds sustained injection. Tank is bypassed only in this reference benchmark; gameplay tank consumption is separately tested.",
    rows,
  };
  await mkdir("docs/career-upgrades", { recursive: true });
  await writeFile(
    "docs/career-upgrades/performance-proof.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  Object.assign(settings, saved);
}
