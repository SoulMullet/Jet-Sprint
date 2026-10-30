export const gameplayLabKey = "jet-sprint-visibility-v1";
export const visibilitySpecs = {
  arrows: {
    size: ["Arrow size", 2.2, 0.8, 6, 0.1, " m"],
    spacing: ["Arrow spacing", 8, 3, 20, 0.5, " m"],
    opacity: ["Arrow opacity", 0.9, 0.1, 1, 0.05, ""],
    brightness: ["Arrow brightness", 1, 0.3, 2, 0.05, "×"],
    height: ["Height above mean water", 0.65, 0.2, 2, 0.05, " m"],
    ahead: ["Distance ahead", 65, 15, 150, 1, " m"],
    fade: ["Fade distance", 12, 3, 40, 1, " m"],
    count: ["Visible arrows", 12, 3, 32, 1, ""],
  },
  hud: {
    scale: ["HUD scale", 0.85, 0.6, 1.3, 0.05, "×"],
    opacity: ["HUD opacity", 0.9, 0.3, 1, 0.05, ""],
    x: ["HUD horizontal offset", 0, 0, 100, 1, " px"],
    y: ["HUD vertical offset", 0, 0, 70, 1, " px"],
  },
};
export class GameplaySettings {
  constructor(storage) {
    this.storage = storage;
    this.listeners = new Set();
    this.values = {
      arrows: {},
      hud: {},
      debug: {
        geometry: false,
        normals: false,
        segments: false,
        overlaps: false,
        footprint: false,
        contacts: false,
        seams: false,
        safeZones: false,
        checkpoints: false,
      },
      color: "#e8d9b5",
    };
    for (const [g, s] of Object.entries(visibilitySpecs))
      for (const [k, r] of Object.entries(s)) this.values[g][k] = r[1];
    try {
      const d = JSON.parse(storage.getItem(gameplayLabKey) || "null");
      if (d?.schema === 1) {
        for (const k of Object.keys(this.values.debug))
          if (typeof d.values?.debug?.[k] === "boolean")
            this.values.debug[k] = d.values.debug[k];
        for (const [g, s] of Object.entries(visibilitySpecs))
          for (const [k, r] of Object.entries(s)) {
            const v = d.values?.[g]?.[k];
            if (Number.isFinite(v))
              this.values[g][k] = Math.max(r[2], Math.min(r[3], v));
          }
        if (/^#[\da-f]{6}$/i.test(d.values?.color))
          this.values.color = d.values.color;
      }
    } catch {
      /* defaults, unrelated saves stay intact */
    }
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  set(group, key, value) {
    if (group === "debug") this.values.debug[key] = !!value;
    else if (group === "color") {
      if (!/^#[\da-f]{6}$/i.test(value)) return;
      this.values.color = value;
    } else {
      const s = visibilitySpecs[group]?.[key];
      if (!s || !Number.isFinite(value)) return;
      this.values[group][key] = Math.max(s[2], Math.min(s[3], value));
    }
    try {
      this.storage.setItem(
        gameplayLabKey,
        JSON.stringify({ schema: 1, values: this.values }),
      );
      this.warning = "";
    } catch {
      this.warning = "Visibility tune active but not saved.";
    }
    for (const fn of this.listeners) fn();
  }
  reset(group) {
    if (group === "arrows") this.set("color", null, "#e8d9b5");
    for (const [k, s] of Object.entries(visibilitySpecs[group]))
      this.set(group, k, s[1]);
  }
}
