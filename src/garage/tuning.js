import {
  maintenanceDefaults,
  maintenanceSpecs,
  sanitizeMaintenance,
} from "./definitions.js";
import { instrumentRange, updateRange } from "../ui-components.js";
export const maintenanceKey = "jet-sprint-maintenance-tuning-v1";
export class MaintenanceTuning {
  constructor(storage) {
    this.storage = storage;
    this.values = maintenanceDefaults();
    this.warning = "";
    try {
      const raw = JSON.parse(storage.getItem(maintenanceKey) || "null");
      if (raw?.schema === 1) this.values = sanitizeMaintenance(raw.values);
    } catch {
      this.warning =
        "Maintenance defaults active; unreadable tuning is unchanged.";
    }
  }
  set(key, value) {
    if (!Object.hasOwn(maintenanceSpecs, key)) return;
    this.values = sanitizeMaintenance({ ...this.values, [key]: value });
    this.save();
  }
  save() {
    try {
      this.storage.setItem(
        maintenanceKey,
        JSON.stringify({ schema: 1, values: this.values }),
      );
      this.warning = "";
    } catch {
      this.warning = "Maintenance tuning active but not saved.";
    }
  }
  reset() {
    this.values = maintenanceDefaults();
    this.save();
  }
}
export function mountMaintenanceLab(parent, tuning) {
  const root = document.createElement("details");
  root.className = "physics-group";
  root.id = "maintenanceLab";
  root.innerHTML =
    "<summary>Development / fuel & condition</summary><p>Career-only maintenance. Physics presets, water and V8 tuning remain independent. Empty tanks retain reserve propulsion; steering stays active.</p>";
  parent.append(root);
  const inputs = [];
  const refresh = () => {
    for (const { input, output, key, s } of inputs) {
      input.value = tuning.values[key];
      output.textContent = `${Number(input.value).toFixed(s[4] < 0.01 ? 3 : s[4] < 1 ? 2 : 0)} ${s[5]}`;
      updateRange(input);
    }
    status.textContent = tuning.warning;
  };
  for (const [key, s] of Object.entries(maintenanceSpecs)) {
    const label = document.createElement("label"),
      input = document.createElement("input"),
      output = document.createElement("output");
    label.textContent = s[0] + " ";
    input.type = "range";
    input.id = "maintenance-" + key;
    input.min = s[2];
    input.max = s[3];
    input.step = s[4];
    label.append(output, input);
    root.append(label);
    inputs.push({ input, output, key, s });
    input.oninput = () => {
      tuning.set(key, Number(input.value));
      refresh();
    };
    instrumentRange(input, {
      defaultValue: s[1],
      reset: () => {
        tuning.set(key, s[1]);
        refresh();
      },
      name: s[0],
    });
  }
  const reset = document.createElement("button");
  reset.id = "resetMaintenance";
  reset.textContent = "Reset maintenance tuning";
  reset.onclick = () => {
    tuning.reset();
    refresh();
  };
  const status = document.createElement("p");
  status.role = "status";
  root.append(reset, status);
  refresh();
  return root;
}
