import { mphToMps } from "../speed-units.js";
export const UPGRADE_VERSION = "one-boat-upgrades-v1";
export const upgradeEconomy = Object.freeze({
  engine: [1000, 2500, 5000, 9000],
  pump: [750, 2000, 4500],
  nitrous: 2500,
  nitrousRefill: 150,
  tankCapacity: 100,
});
export const upgradeSpecs = {
  stockTopMph: ["Stock top speed", 93, 70, 110, 1, " MPH"],
  engineSpeed1: ["Engine 1 speed multiplier", 101 / 93, 1, 1.3, 0.001, "×"],
  engineSpeed2: ["Engine 2 speed multiplier", 109 / 93, 1.05, 1.45, 0.001, "×"],
  engineSpeed3: ["Engine 3 speed multiplier", 118 / 93, 1.1, 1.55, 0.001, "×"],
  engineSpeed4: ["Engine 4 speed multiplier", 128 / 93, 1.15, 1.7, 0.001, "×"],
  enginePower1: ["Engine 1 power multiplier", 1.1, 1, 1.5, 0.01, "×"],
  enginePower2: ["Engine 2 power multiplier", 1.22, 1, 1.8, 0.01, "×"],
  enginePower3: ["Engine 3 power multiplier", 1.35, 1, 2, 0.01, "×"],
  enginePower4: ["Engine 4 power multiplier", 1.5, 1, 2.2, 0.01, "×"],
  pumpThrust1: ["Pump 1 thrust multiplier", 1.08, 1, 1.3, 0.01, "×"],
  pumpThrust2: ["Pump 2 thrust multiplier", 1.18, 1, 1.5, 0.01, "×"],
  pumpThrust3: ["Pump 3 thrust multiplier", 1.3, 1, 1.7, 0.01, "×"],
  nitroPower: ["Nitrous power multiplier", 1.34, 1.05, 1.7, 0.01, "×"],
  nitroSpeedInfluence: [
    "Nitrous maximum-speed influence",
    0.075,
    0.02,
    0.18,
    0.005,
    "×",
  ],
  nitroConsumption: ["Nitrous consumption", 5, 1, 12, 0.1, " units/s"],
  nitroActivationThreshold: [
    "Extra thumb travel to activate",
    28,
    14,
    50,
    1,
    " px",
  ],
  nitroHysteresis: ["Nitrous gesture hysteresis", 12, 5, 20, 1, " px"],
  nitroThrottleRequirement: [
    "Nitrous throttle requirement",
    0.8,
    0.5,
    1,
    0.05,
    "×",
  ],
  nitroCameraIntensity: ["Nitrous camera intensity", 0.6, 0, 1, 0.05, "×"],
};
export const upgradeDefaults = () =>
  Object.fromEntries(Object.entries(upgradeSpecs).map(([k, s]) => [k, s[1]]));
export const standardUpgradeBalance = Object.freeze(upgradeDefaults());
export const pumpSpeed = [1, 1.012, 1.03, 1.04];
export function sanitizeUpgradeTuning(raw = {}) {
  return Object.fromEntries(
    Object.entries(upgradeSpecs).map(([k, s]) => [
      k,
      Number.isFinite(raw[k]) ? Math.max(s[2], Math.min(s[3], raw[k])) : s[1],
    ]),
  );
}
export function boatPerformance(boat, t = upgradeDefaults()) {
  const e = boat.engineStage || 0,
    p = boat.pumpStage || 0;
  const topMph = t.stockTopMph * (e ? t["engineSpeed" + e] : 1) * pumpSpeed[p],
    power = (e ? t["enginePower" + e] : 1) * (p ? t["pumpThrust" + p] : 1);
  return {
    version: UPGRADE_VERSION,
    engineStage: e,
    pumpStage: p,
    nitrousInstalled: !!boat.nitrousInstalled,
    topMph,
    topSpeedMps: mphToMps(topMph),
    thrustScale: power,
    dragCalibrationScale: power,
    gainScale: Math.max(1, (t.stockTopMph * 1.609344) / 120),
    responseScale: 1 + e * 0.035 + p * 0.09,
  };
}
export function upgradeQuote(profile, category) {
  const b = profile.boat,
    stage =
      category === "engine"
        ? b.engineStage
        : category === "pump"
          ? b.pumpStage
          : Number(b.nitrousInstalled),
    prices = upgradeEconomy[category];
  if (!["engine", "pump", "nitrous"].includes(category))
    throw Error("Unknown upgrade category.");
  const maximum = category === "engine" ? 4 : category === "pump" ? 3 : 1,
    price =
      stage >= maximum ? 0 : category === "nitrous" ? prices : prices[stage];
  return {
    category,
    stage,
    next: Math.min(maximum, stage + 1),
    maximum,
    price,
    owned: stage >= maximum,
    available:
      stage < maximum && profile.cash >= price && !profile.career.activeAttempt,
  };
}
export function nitrousQuote(profile) {
  const b = profile.boat,
    missing = Math.max(0, b.nitrousCapacity - b.nitrousFill),
    rate = upgradeEconomy.nitrousRefill / upgradeEconomy.tankCapacity;
  const fullCost = Math.ceil(Math.max(0, missing - 1e-8) * rate),
    units =
      fullCost <= profile.cash
        ? missing
        : Math.min(missing, Math.floor((profile.cash / rate) * 1000) / 1000),
    cost = Math.ceil(Math.max(0, units - 1e-8) * rate);
  return {
    units,
    cost,
    to: Math.min(b.nitrousCapacity, b.nitrousFill + units),
    available:
      b.nitrousInstalled &&
      units > 1e-8 &&
      cost <= profile.cash &&
      !profile.career.activeAttempt,
  };
}

// Progression owns propulsion; steering/drift/visual preferences remain live.
export const careerPropulsionKeys = Object.freeze([
  "top",
  "maxThrust",
  "forwardDrag",
  "pumpResponse",
  "pumpDecay",
]);
