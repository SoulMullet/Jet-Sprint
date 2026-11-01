// Original saves and physics keep their SI/km-h contracts. MPH is a UI boundary.
export const MPH_PER_MPS = 1 / 0.44704,
  MPH_PER_KPH = 1 / 1.609344;
export const toMph = (mps) => mps * MPH_PER_MPS;
export const mphToMps = (mph) => mph * 0.44704;
export const kphToMph = (kph) => kph * MPH_PER_KPH;
export const mphToKph = (mph) => mph / MPH_PER_KPH;
const kphIds = ["top", "planingSpeed", "speedThreshold"],
  mpsIds = ["sprayLaunchSpeed", "impactThreshold"];
export const speedSetting = (id) => kphIds.includes(id) || mpsIds.includes(id);
export const displaySetting = (id, value) =>
  kphIds.includes(id)
    ? kphToMph(value)
    : mpsIds.includes(id)
      ? toMph(value)
      : value;
export const storedSetting = (id, value) =>
  kphIds.includes(id)
    ? mphToKph(value)
    : mpsIds.includes(id)
      ? mphToMps(value)
      : value;
