import {
  standardUpgradeBalance,
  upgradeDefaults,
  upgradeSpecs,
  sanitizeUpgradeTuning,
} from "./upgrades.js";
import { instrumentRange, updateRange } from "../ui-components.js";
export const upgradeTuningKey = "jet-sprint-upgrade-tuning-v1";
export class UpgradeTuning {
  constructor(storage, { development = false } = {}) {
    this.storage = storage;
    this.development = development;
    this.values = upgradeDefaults();
    this.warning = "";
    try {
      const raw = JSON.parse(storage.getItem(upgradeTuningKey) || "null");
      if (raw?.schema === 1) this.values = sanitizeUpgradeTuning(raw.values);
    } catch {
      this.warning = "Unreadable upgrade tuning retained; defaults active.";
    }
  }
  get effective() {
    return this.development ? this.values : standardUpgradeBalance;
  }
  set(id, value) {
    if (!Object.hasOwn(upgradeSpecs, id)) return;
    this.values = sanitizeUpgradeTuning({ ...this.values, [id]: value });
    this.save();
  }
  save() {
    try {
      this.storage.setItem(
        upgradeTuningKey,
        JSON.stringify({ schema: 1, values: this.values }),
      );
    } catch {
      this.warning = "Development tuning active but not saved.";
    }
  }
  reset() {
    this.values = upgradeDefaults();
    this.save();
  }
}
export function mountUpgradeLab(parent, tuning) {
  const root = document.createElement("details");
  root.id = "upgradeLab";
  root.className = "physics-group";
  root.innerHTML =
    "<summary>Development / career performance</summary><p>Career uses the published balance. Open with ?dev=1 to test saved physics and upgrade tuning in practice; no cash prizes or competitive ghosts.</p>";
  parent.append(root);
  if (!tuning.development) return root;
  const fields = [];
  const refresh = () => {
    for (const { input, out, key, s } of fields) {
      input.value = tuning.values[key];
      out.textContent =
        Number(input.value).toFixed(s[4] < 0.01 ? 3 : s[4] < 1 ? 2 : 0) + s[5];
      updateRange(input);
    }
  };
  for (const [key, s] of Object.entries(upgradeSpecs)) {
    const label = document.createElement("label"),
      out = document.createElement("output"),
      input = document.createElement("input");
    label.append(s[0] + " ", out, input);
    input.type = "range";
    input.id = "upgrade-" + key;
    input.min = s[2];
    input.max = s[3];
    input.step = s[4];
    input.oninput = () => {
      tuning.set(key, Number(input.value));
      refresh();
    };
    root.append(label);
    fields.push({ input, out, key, s });
    instrumentRange(input, {
      name: s[0],
      defaultValue: s[1],
      reset: () => {
        tuning.set(key, s[1]);
        refresh();
      },
    });
  }
  const reset = document.createElement("button");
  reset.textContent = "Reset career development balance";
  reset.id = "resetUpgradeTuning";
  reset.onclick = () => {
    tuning.reset();
    refresh();
  };
  root.append(reset);
  refresh();
  return root;
}
