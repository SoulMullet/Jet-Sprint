import { instrumentRange, updateRange } from "../ui-components.js";
export const ARCADE_TUNING_KEY = "jet-sprint-arcade-river-tuning-v1";
export const arcadeSpecs = {
  cruiseSpeed: ["Arcade top speed", 78, 60, 93, 1, " MPH", "assist"],
  steeringResponse: ["Steering response", 1.2, 0.6, 1.8, 0.05, "×", "assist"],
  impactRecovery: ["Impact recovery", 0.6, 0, 1, 0.05, "×", "assist"],
  landingStability: ["Landing stability", 0.7, 0, 1, 0.05, "×", "assist"],
  distance: ["Chase distance", 24, 14, 40, 1, " m", "camera"],
  height: ["Chase height", 16, 9, 26, 1, " m", "camera"],
  smoothing: ["Camera response", 6, 2, 12, 0.5, " /s", "camera"],
  fov: ["Field of view", 60, 45, 75, 1, "°", "camera"],
  pullback: ["Speed pullback", 0.25, 0, 0.6, 0.025, "×", "camera"],
  anticipation: ["Turn anticipation", 0.25, 0, 0.6, 0.025, "×", "camera"],
};
export const arcadeDefaults = () =>
  Object.fromEntries(Object.entries(arcadeSpecs).map(([k, s]) => [k, s[1]]));
export class ArcadeTuning {
  constructor(storage) {
    this.storage = storage;
    this.values = arcadeDefaults();
    this.warning = "";
    try {
      const p = JSON.parse(storage.getItem(ARCADE_TUNING_KEY) || "null");
      if (p?.schema === 1) this.assign(p.values);
    } catch {
      this.warning = "Arcade tuning unavailable; defaults active.";
    }
  }
  assign(v = {}) {
    for (const [k, s] of Object.entries(arcadeSpecs))
      if (Number.isFinite(v[k]))
        this.values[k] = Math.max(s[2], Math.min(s[3], v[k]));
  }
  set(k, v) {
    this.assign({ [k]: v });
    this.save();
  }
  save() {
    try {
      this.storage.setItem(
        ARCADE_TUNING_KEY,
        JSON.stringify({ schema: 1, values: this.values }),
      );
      this.warning = "";
    } catch {
      this.warning = "Arcade tuning active but not saved.";
    }
  }
  reset(group) {
    for (const [k, s] of Object.entries(arcadeSpecs))
      if (s[6] === group) this.values[k] = s[1];
    this.save();
  }
}
export function mountArcadeTuning(parent, tuning, group) {
  const root = document.createElement("details");
  root.className = "settings-section arcade-tuning";
  root.innerHTML = `<summary>Arcade River / ${group === "assist" ? "handling assists" : "chase camera"}</summary><p>Applies only in Arcade River. Original racing settings stay intact.</p>`;
  parent.prepend(root);
  const fields = [];
  const refresh = () => {
    for (const [k, s, input, out] of fields) {
      input.value = tuning.values[k];
      out.textContent = Number(input.value).toFixed(s[4] < 1 ? 2 : 0) + s[5];
      updateRange(input);
    }
  };
  for (const [k, s] of Object.entries(arcadeSpecs)) {
    if (s[6] !== group) continue;
    const label = document.createElement("label"),
      input = document.createElement("input"),
      out = document.createElement("output");
    input.type = "range";
    input.id = "arcade-" + k;
    input.min = s[2];
    input.max = s[3];
    input.step = s[4];
    label.append(s[0] + " ", out, input);
    root.append(label);
    input.oninput = () => {
      tuning.set(k, Number(input.value));
      refresh();
    };
    instrumentRange(input, {
      name: s[0],
      defaultValue: s[1],
      reset: () => {
        tuning.set(k, s[1]);
        refresh();
      },
    });
    fields.push([k, s, input, out]);
  }
  const reset = document.createElement("button");
  reset.textContent = "Reset Arcade " + group;
  reset.onclick = () => {
    tuning.reset(group);
    refresh();
  };
  root.append(reset);
  refresh();
  return root;
}
