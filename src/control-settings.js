/** Input-only tuning. Stable origin-local key; independent of hull/audio/video stores. */
export const CONTROL_SCHEMA = 1;
export const controlStorageKey = "jet-sprint-controls-v1";
const number = (group, label, value, min, max, step, unit = "", note = "") => ({
  group,
  label,
  value,
  min,
  max,
  step,
  unit,
  note,
  type: "number",
});
const choice = (group, label, value, options) => ({
  group,
  label,
  value,
  options,
  type: "enum",
});
const toggle = (group, label, value = false) => ({
  group,
  label,
  value,
  type: "boolean",
});
export const controlSpecs = {
  steerSensitivity: number(
    "Steering",
    "Steering sensitivity",
    1,
    0.25,
    2,
    0.05,
    "×",
  ),
  steerDeadzone: number("Steering", "Steering dead zone", 0.02, 0, 0.3, 0.01),
  steerCurve: number(
    "Steering",
    "Steering response exponent",
    1,
    0.5,
    3,
    0.05,
    "",
    "1 is linear; higher values give finer control near centre.",
  ),
  steerSmoothing: number(
    "Steering",
    "Steering smoothing",
    0.025,
    0,
    0.3,
    0.005,
    " s",
  ),
  steerRamp: number(
    "Steering",
    "Steering ramp limit",
    18,
    0.5,
    60,
    0.5,
    "/s",
    "Full-scale units per second; higher is faster.",
  ),
  steerReturn: choice("Steering", "Steering release mode", "spring", [
    "spring",
    "hold",
    "hybrid",
  ]),
  steerReturnSpeed: number(
    "Steering",
    "Steering return speed",
    8,
    0.2,
    20,
    0.2,
    "/s",
  ),
  steerSpring: number(
    "Steering",
    "Steering spring strength",
    1.5,
    0.25,
    3,
    0.05,
    "×",
  ),
  steerReturnDelay: number(
    "Steering",
    "Hybrid return delay",
    0.15,
    0,
    1.5,
    0.05,
    " s",
  ),
  speedSteering: number(
    "Steering",
    "Steering reduction at top speed",
    10,
    0,
    65,
    1,
    "%",
    "Input scaling only. Does not change the hull steering model.",
  ),
  steerTravel: number("Steering", "Steering rail travel", 100, 35, 100, 1, "%"),
  steerWidth: number(
    "Steering",
    "Steering housing width",
    208,
    120,
    360,
    2,
    " px",
  ),
  steerHeight: number(
    "Steering",
    "Steering housing height",
    88,
    64,
    140,
    2,
    " px",
  ),
  steerX: number(
    "Steering",
    "Steering position X",
    0,
    0,
    100,
    1,
    "%",
    "Position within safe screen area; 0 is left, 100 is right.",
  ),
  steerY: number(
    "Steering",
    "Steering position Y",
    100,
    0,
    100,
    1,
    "%",
    "0 is top, 100 is bottom. Conflicting placements are separated.",
  ),
  throttleSensitivity: number(
    "Throttle",
    "Throttle sensitivity",
    1,
    0.5,
    2,
    0.05,
    "×",
  ),
  throttleDeadzone: number(
    "Throttle",
    "Throttle idle dead zone",
    0.015,
    0,
    0.25,
    0.005,
  ),
  throttleCurve: number(
    "Throttle",
    "Throttle response exponent",
    1,
    0.5,
    3,
    0.05,
  ),
  throttleSmoothing: number(
    "Throttle",
    "Throttle smoothing",
    0.02,
    0,
    0.3,
    0.005,
    " s",
  ),
  throttleRampUp: number(
    "Throttle",
    "Throttle acceleration ramp",
    10,
    0.2,
    30,
    0.2,
    "/s",
  ),
  throttleRampDown: number(
    "Throttle",
    "Throttle deceleration ramp",
    16,
    0.2,
    30,
    0.2,
    "/s",
  ),
  throttleReturn: choice("Throttle", "Throttle release mode", "spring", [
    "spring",
    "hold",
    "gradual",
  ]),
  throttleReturnSpeed: number(
    "Throttle",
    "Throttle return speed",
    12,
    0.2,
    20,
    0.2,
    "/s",
  ),
  throttleTravel: number(
    "Throttle",
    "Throttle rail travel",
    100,
    40,
    100,
    1,
    "%",
  ),
  throttleHeight: number(
    "Throttle",
    "Throttle housing height",
    156,
    100,
    280,
    2,
    " px",
  ),
  throttleWidth: number(
    "Throttle",
    "Throttle housing width",
    78,
    64,
    120,
    2,
    " px",
  ),
  throttleX: number("Throttle", "Throttle position X", 100, 0, 100, 1, "%"),
  throttleY: number("Throttle", "Throttle position Y", 100, 0, 100, 1, "%"),
  touchSteerCentre: number(
    "Calibration",
    "Touch steering centre trim",
    0,
    -0.25,
    0.25,
    0.01,
  ),
  touchThrottleIdle: number(
    "Calibration",
    "Touch throttle idle point",
    0,
    0,
    0.25,
    0.01,
  ),
  touchThrottleFull: number(
    "Calibration",
    "Touch throttle full point",
    1,
    0.75,
    1,
    0.01,
  ),
  padDeadzone: number(
    "Controller",
    "Controller stick dead zone",
    0.12,
    0,
    0.4,
    0.01,
  ),
  padTriggerDeadzone: number(
    "Controller",
    "Controller trigger dead zone",
    0.03,
    0,
    0.25,
    0.01,
  ),
  padSensitivity: number(
    "Controller",
    "Controller steering sensitivity",
    1,
    0.25,
    2,
    0.05,
    "×",
  ),
  padCurve: number(
    "Controller",
    "Controller steering exponent",
    1,
    0.5,
    3,
    0.05,
  ),
  padThrottleCurve: number(
    "Controller",
    "Controller trigger exponent",
    1,
    0.5,
    3,
    0.05,
  ),
  padMapping: choice("Controller", "Controller mapping", "auto", [
    "auto",
    "standard",
    "axis-triggers",
  ]),
  padTriggerRest: choice(
    "Controller",
    "Axis trigger rest position",
    "negative",
    ["negative", "zero"],
  ),
  padRightAxis: number("Controller", "Legacy RT axis index", 5, 1, 9, 1),
  priority: choice("Input behavior", "Input device priority", "recent", [
    "recent",
    "touch",
    "keyboard",
    "gamepad",
  ]),
  haptics: toggle("Input behavior", "Brief control haptics (where supported)"),
  diagnostics: toggle("Input behavior", "Show live input overlay"),
};
export const controlDefaults = () =>
  Object.fromEntries(
    Object.entries(controlSpecs).map(([k, s]) => [k, s.value]),
  );
export const controlPresets = {
  arcade: { name: "Arcade", values: {} },
  balanced: {
    name: "Balanced",
    values: {
      steerCurve: 1.3,
      steerSmoothing: 0.055,
      steerRamp: 10,
      steerReturn: "hybrid",
      steerReturnSpeed: 3,
      steerReturnDelay: 0.1,
      throttleCurve: 1.1,
      throttleSmoothing: 0.045,
      throttleRampUp: 5,
      throttleRampDown: 10,
      speedSteering: 15,
    },
  },
  simulation: {
    name: "Simulation",
    values: {
      steerDeadzone: 0.01,
      steerCurve: 1,
      steerSmoothing: 0.01,
      steerRamp: 40,
      steerReturn: "hold",
      throttleDeadzone: 0.005,
      throttleSmoothing: 0.01,
      throttleRampUp: 24,
      throttleRampDown: 24,
      throttleReturn: "hold",
      speedSteering: 0,
      padDeadzone: 0.08,
    },
  },
};
const plain = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
function sanitize(key, value) {
  const s = controlSpecs[key];
  if (s.type === "boolean") {
    if (typeof value !== "boolean")
      throw Error(`${s.label} must be true or false.`);
    return value;
  }
  if (s.type === "enum") {
    if (!s.options.includes(value)) throw Error(`Unsupported ${s.label}.`);
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value))
    throw Error(`${s.label} must be a finite number.`);
  return Number(
    Math.max(
      s.min,
      Math.min(
        s.max,
        Math.round((Math.max(s.min, Math.min(s.max, value)) - s.min) / s.step) *
          s.step +
          s.min,
      ),
    ).toFixed(6),
  );
}
export function decodeControls(text, strict = true) {
  if (typeof text !== "string" || text.length > 100000)
    throw Error("Control JSON must be under 100 KB.");
  const data = JSON.parse(text);
  if (!plain(data) || (data.type && data.type !== "jet-sprint-controls"))
    throw Error("Expected a JET SPRINT control configuration.");
  const version = data.schemaVersion ?? data.schema;
  if (![0, CONTROL_SCHEMA].includes(version))
    throw Error("Unsupported control settings schema.");
  const raw = data.settings ?? data.values;
  if (!plain(raw)) throw Error("Control settings object is missing.");
  const values = controlDefaults(),
    warnings = [];
  for (const key of Object.keys(controlSpecs))
    if (Object.hasOwn(raw, key)) {
      try {
        values[key] = sanitize(key, raw[key]);
      } catch (error) {
        if (strict) throw error;
        warnings.push(`${error.message} Default restored.`);
      }
    }
  return {
    values,
    warnings,
    preset: Object.hasOwn(controlPresets, data.preset) ? data.preset : "custom",
  };
}
export class ControlSettings {
  constructor(storage) {
    this.storage = storage;
    this.values = controlDefaults();
    this.preset = "arcade";
    this.listeners = new Set();
    this.warning = "";
    this.timer = null;
    try {
      const saved = storage.getItem(controlStorageKey);
      if (saved) {
        const next = decodeControls(saved, false);
        this.values = next.values;
        this.preset = next.preset;
        this.warning = next.warnings.join(" ");
      }
    } catch (error) {
      this.warning = `Controls restored to defaults: ${error.message}`;
    }
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    for (const fn of this.listeners) fn();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }
  set(key, value) {
    if (!Object.hasOwn(controlSpecs, key))
      throw Error("Unknown control setting.");
    this.values[key] = sanitize(key, value);
    this.preset = "custom";
    this.notify();
  }
  select(id) {
    if (!Object.hasOwn(controlPresets, id))
      throw Error("Unknown input preset.");
    // Presets change response only; keep layout, calibration, mapping and accessibility choices.
    const defaults = controlDefaults();
    for (const key of Object.keys(defaults))
      if (
        (["Steering", "Throttle"].includes(controlSpecs[key].group) &&
          !/Width|Height|Travel|X$|Y$/.test(key)) ||
        [
          "padDeadzone",
          "padCurve",
          "padSensitivity",
          "padThrottleCurve",
        ].includes(key)
      )
        this.values[key] = controlPresets[id].values[key] ?? defaults[key];
    this.preset = id;
    this.notify();
  }
  reset(group) {
    for (const [key, s] of Object.entries(controlSpecs))
      if (!group || s.group === group) this.values[key] = s.value;
    this.preset = group ? "custom" : "arcade";
    this.notify();
  }
  exportText() {
    return JSON.stringify(
      {
        type: "jet-sprint-controls",
        schemaVersion: CONTROL_SCHEMA,
        preset: this.preset,
        settings: this.values,
      },
      null,
      2,
    );
  }
  importText(text) {
    const next = decodeControls(text);
    this.values = next.values;
    this.preset = next.preset;
    this.notify();
  }
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      this.storage.setItem(controlStorageKey, this.exportText());
      return true;
    } catch {
      this.warning =
        "Controls active; storage unavailable. Export JSON to keep this setup.";
      return false;
    }
  }
}
