export const replaySettingsKey = "jet-sprint-replay-settings-v1";
export const replayDefaults = Object.freeze({
  enabled: true,
  mode: "personal-best",
  opacity: 0.38,
  color: "#d9ac46",
  interval: 0.05,
  telemetry: false,
  selectedId: "",
});
export class ReplaySettings {
  constructor(storage) {
    this.storage = storage;
    this.values = { ...replayDefaults };
    this.listeners = new Set();
    this.warning = "";
    try {
      const d = JSON.parse(storage.getItem(replaySettingsKey) || "null");
      if (d?.schema === 1)
        for (const [k, v] of Object.entries(d.values || {})) this.assign(k, v);
    } catch {
      this.warning =
        "Replay settings could not be restored; defaults are active.";
    }
  }
  assign(k, v) {
    if (["enabled", "telemetry"].includes(k) && typeof v === "boolean")
      this.values[k] = v;
    else if (
      k === "mode" &&
      ["personal-best", "previous", "selected", "disabled"].includes(v)
    )
      this.values[k] = v;
    else if (k === "opacity" && Number.isFinite(v))
      this.values[k] = Math.max(0.08, Math.min(0.85, v));
    else if (k === "interval" && Number.isFinite(v))
      this.values[k] = Math.max(0.05, Math.min(0.1, v));
    else if (k === "color" && /^#[\da-f]{6}$/i.test(v)) this.values[k] = v;
    else if (k === "selectedId" && typeof v === "string" && v.length <= 100)
      this.values[k] = v;
  }
  set(k, v) {
    this.assign(k, v);
    try {
      this.storage.setItem(
        replaySettingsKey,
        JSON.stringify({ schema: 1, values: this.values }),
      );
      this.warning = "";
    } catch {
      this.warning = "Replay settings are active but not saved.";
    }
    for (const fn of this.listeners) fn(k);
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  reset() {
    for (const [k, v] of Object.entries(replayDefaults)) this.set(k, v);
  }
}
