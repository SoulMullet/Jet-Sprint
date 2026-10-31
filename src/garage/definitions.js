// Portable economy/maintenance definitions. No engine or browser dependencies.
export const GARAGE_VERSION = "garage-economy-v1";
export const BOAT_ID = "sprint-boat-1987-v1";
export const garageEconomy = Object.freeze({
  version: GARAGE_VERSION,
  currency: "fictional-dollars",
  startingCash: 600,
  fuelPricePerPercent: 2,
  repairPricePerPercent: 4,
  entryFuel: 8,
  entryCondition: 15,
  emergencyFuel: 20,
  emergencyCondition: 40,
  prizes: [
    { finish: 250, firstClear: 100, improvement: 50, clean: 25 },
    { finish: 400, firstClear: 150, improvement: 75, clean: 40 },
    { finish: 600, firstClear: 200, improvement: 100, clean: 60 },
  ],
  upgradeCategories: ["Engine", "Waterjet", "Hull"],
});
export const maintenanceSpecs = {
  idleFuel: ["Running fuel use", 0.008, 0, 0.05, 0.001, "%/s"],
  throttleFuel: ["Full-throttle fuel use", 0.055, 0, 0.3, 0.005, "%/s"],
  loadFuel: ["Speed/load fuel use", 0.01, 0, 0.05, 0.001, "%/s"],
  impactThreshold: ["Damage threshold", 3, 1, 10, 0.1, "m/s Δv"],
  damageRate: ["Impact damage scale", 0.18, 0, 1, 0.01, "×"],
  impactRelease: ["Continuous-impact release", 0.45, 0.15, 2, 0.05, "s"],
  maxImpactDamage: ["Maximum single-impact damage", 12, 1, 25, 1, "%"],
  penaltyThreshold: ["Low-condition threshold", 30, 10, 60, 1, "%"],
  maxPenalty: ["Maximum condition power loss", 0.06, 0, 0.12, 0.01, "×"],
  reservePower: ["Empty-tank reserve power", 0.85, 0.7, 1, 0.01, "×"],
};
export const maintenanceDefaults = () =>
  Object.fromEntries(
    Object.entries(maintenanceSpecs).map(([k, s]) => [k, s[1]]),
  );
export function sanitizeMaintenance(raw = {}) {
  return Object.fromEntries(
    Object.entries(maintenanceSpecs).map(([k, s]) => [
      k,
      Number.isFinite(raw[k]) ? Math.max(s[2], Math.min(s[3], raw[k])) : s[1],
    ]),
  );
}
export function serviceQuote(profile, kind) {
  if (!["fuel", "condition"].includes(kind))
    throw Error("Unknown garage service.");
  const rate =
    kind === "fuel"
      ? garageEconomy.fuelPricePerPercent
      : garageEconomy.repairPricePerPercent;
  const missing = Math.max(0, 100 - profile.boat[kind]);
  const fullCost = Math.ceil(Math.max(0, missing - 1e-8) * rate);
  const units =
    fullCost <= profile.cash
      ? missing
      : Math.min(missing, Math.floor(profile.cash / rate));
  const cost = Math.ceil(Math.max(0, units - 1e-8) * rate);
  return {
    kind,
    units,
    cost,
    to: Math.min(100, profile.boat[kind] + units),
    full: units === missing,
    available: units > 0.00001 && cost <= profile.cash,
  };
}
export function emergencyAvailable(profile) {
  const e = garageEconomy,
    b = profile.boat;
  const critical = b.fuel < e.entryFuel || b.condition < e.entryCondition;
  const minimumCost =
    Math.ceil(Math.max(0, e.emergencyFuel - b.fuel) * e.fuelPricePerPercent) +
    Math.ceil(
      Math.max(0, e.emergencyCondition - b.condition) * e.repairPricePerPercent,
    );
  return critical && profile.cash < minimumCost;
}
export function powerScale(boat, tuning) {
  const damage =
    Math.max(0, 1 - boat.condition / tuning.penaltyThreshold) *
    tuning.maxPenalty;
  return (1 - damage) * (boat.fuel <= 0 ? tuning.reservePower : 1);
}
export function fuelConsumed(dt, throttle, speed, tuning) {
  return (
    Math.max(0, dt) *
    (tuning.idleFuel +
      tuning.throttleFuel * Math.max(0, Math.min(1, throttle)) +
      tuning.loadFuel * Math.max(0, Math.min(1, speed / (85 / 3.6))))
  );
}
export function impactDamage(impulse, tuning) {
  return Math.min(
    tuning.maxImpactDamage,
    Math.pow(Math.max(0, impulse - tuning.impactThreshold), 1.3) *
      tuning.damageRate,
  );
}
