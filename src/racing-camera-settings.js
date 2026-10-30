// Independent schema: old camera, controller and handling records remain intact.
export const racingCameraKey = "jet-sprint-racing-cameras-v2";
export const cameraSpecs = {
  flat: {
    zoom: ["Zoom", 1, 0.35, 5, 0.01, "×"],
    yaw: ["Yaw", 20, -180, 180, 1, "°"],
    pitch: ["Pitch", 55, 30, 80, 1, "°"],
    distance: ["Manual camera distance", 160, 10, 1000, 1, " m"],
    fov: ["Field of view", 43, 25, 80, 1, "°"],
    offsetX: ["Target X offset", 0, -100, 100, 1, " m"],
    offsetY: ["Target map Y offset (world Z)", 0, -100, 100, 1, " m"],
    targetHeight: ["Target height", 0, 0, 15, 0.1, " m"],
    scale: ["Orthographic scale", 1, 0.7, 2, 0.01, "×"],
    padding: ["Course framing padding", 1.12, 1, 1.6, 0.01, "×"],
    marker: ["Boat visibility marker", 1, 0, 1, 1, ""],
  },
  river: {
    height: ["Follow height", 36, 15, 80, 1, " m"],
    distance: ["Follow distance", 24, 10, 70, 1, " m"],
    pitch: ["Downward angle", 58, 40, 75, 1, "°"],
    yaw: ["Yaw offset", 0, -60, 60, 1, "°"],
    lag: ["Position smoothing", 0.22, 0.02, 1, 0.01, " s"],
    rotationLag: ["Rotation smoothing", 0.45, 0.05, 2, 0.01, " s"],
    lookAhead: ["Look-ahead", 12, 0, 35, 0.5, " m"],
    speedZoom: ["Speed-sensitive zoom", 1, 0, 1, 1, ""],
    speedIntensity: ["Speed zoom intensity", 0.18, 0, 0.6, 0.01, "×"],
    anticipation: ["Corner anticipation", 0.35, 0, 1, 0.01, "×"],
    bank: ["Camera banking intensity", 0.05, 0, 0.3, 0.01, "×"],
    bankLag: ["Banking smoothing", 0.5, 0.05, 2, 0.01, " s"],
    targetHeight: ["Target vertical offset", 0.5, 0, 8, 0.1, " m"],
  },
  transition: {
    duration: ["Duration", 2, 0.5, 5, 0.1, " s"],
    height: ["Sweep height", 18, 0, 60, 1, " m"],
    arc: ["Sweep arc intensity", 0.25, -1, 1, 0.01, "×"],
    rotation: ["Rotation timing", 0.6, 0.1, 1, 0.01, "×"],
    zoom: ["Zoom timing", 0.65, 0.1, 1, 0.01, "×"],
    takeover: ["Follow takeover timing", 0.35, 0, 0.9, 0.01, "×"],
    focus: ["Boat focus strength", 0.7, 0, 1, 0.01, "×"],
  },
};
const defaults = () => ({
  flat: Object.fromEntries(
    Object.entries(cameraSpecs.flat).map(([k, s]) => [k, s[1]]),
  ),
  river: Object.fromEntries(
    Object.entries(cameraSpecs.river).map(([k, s]) => [k, s[1]]),
  ),
  transition: Object.fromEntries(
    Object.entries(cameraSpecs.transition).map(([k, s]) => [k, s[1]]),
  ),
});
export function sanitizeCameraPreset(raw = {}) {
  const p = defaults();
  for (const [group, specs] of Object.entries(cameraSpecs))
    for (const [k, s] of Object.entries(specs)) {
      const v = raw[group]?.[k];
      if (typeof v === "number" && Number.isFinite(v))
        p[group][k] = Math.max(s[2], Math.min(s[3], v));
    }
  p.flat.framing = raw.flat?.framing === "manual" ? "manual" : "auto";
  p.flat.projection =
    raw.flat?.projection === "orthographic" ? "orthographic" : "perspective";
  p.transition.easing = ["smooth", "smoother", "cosine"].includes(
    raw.transition?.easing,
  )
    ? raw.transition.easing
    : "smoother";
  return p;
}
export class RacingCameraSettings {
  constructor(storage) {
    this.storage = storage;
    this.presets = {};
    this.course = "";
    this.values = sanitizeCameraPreset();
    this.listeners = new Set();
    this.warning = "";
    try {
      const raw = JSON.parse(storage.getItem(racingCameraKey) || "null");
      if (raw) {
        if (raw.schema !== 2) throw Error("Unsupported camera schema");
        this.decode(raw);
      }
    } catch {
      this.warning =
        "Camera Lab defaults active; saved configuration could not be read.";
    }
  }
  decode(raw) {
    if (
      raw?.schema !== 2 ||
      !raw.courses ||
      typeof raw.courses !== "object" ||
      Array.isArray(raw.courses)
    )
      throw Error("Choose a Camera Lab schema 2 export.");
    const next = {};
    for (const [id, p] of Object.entries(raw.courses).slice(0, 32))
      if (/^[a-z0-9-]{1,80}$/.test(id)) next[id] = sanitizeCameraPreset(p);
    this.presets = next;
  }
  use(id) {
    if (this.course === id) return;
    this.course = id;
    this.values = this.presets[id] ?? sanitizeCameraPreset();
    this.emit();
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.revision = (this.revision || 0) + 1;
    for (const fn of this.listeners) fn();
  }
  save() {
    this.presets[this.course] = structuredClone(this.values);
    try {
      this.storage.setItem(racingCameraKey, this.export());
      this.warning = "";
    } catch {
      this.warning =
        "Camera settings active but not saved; export to keep them.";
    }
    this.emit();
  }
  set(group, key, value) {
    const raw = structuredClone(this.values);
    raw[group][key] = value;
    if (group === "flat" && key === "distance") raw.flat.framing = "manual";
    this.values = sanitizeCameraPreset(raw);
    this.save();
  }
  reset(group) {
    if (group) this.values[group] = sanitizeCameraPreset()[group];
    else this.values = sanitizeCameraPreset();
    this.save();
  }
  export() {
    return JSON.stringify(
      {
        type: "jet-sprint-racing-cameras",
        schema: 2,
        courses: { ...this.presets, [this.course]: this.values },
      },
      null,
      2,
    );
  }
  import(text) {
    const raw = JSON.parse(text);
    this.decode(raw);
    this.values = this.presets[this.course] ?? sanitizeCameraPreset();
    this.save();
  }
  autoFit() {
    Object.assign(this.values.flat, {
      distance: 160,
      zoom: 1,
      framing: "auto",
      offsetX: 0,
      offsetY: 0,
      targetHeight: 0,
      scale: 1,
    });
    this.save();
  }
}
