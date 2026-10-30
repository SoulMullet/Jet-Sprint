import { visibilitySpecs } from "./gameplay-settings.js";
import { instrumentRange, updateRange } from "./ui-components.js";
export function mountGameplayLabs(
  store,
  parent,
  { validate, toggleCheckpoints },
) {
  const root = document.createElement("div");
  root.id = "gameplayLabs";
  parent.prepend(root);
  const ranges = [];
  for (const [group, title] of [
    ["arrows", "Navigation Lab / water chevrons"],
    ["hud", "HUD / visibility"],
  ]) {
    const section = document.createElement("details");
    section.className = "settings-section";
    const summary = document.createElement("summary");
    summary.textContent = title;
    section.append(summary);
    root.append(section);
    for (const [k, s] of Object.entries(visibilitySpecs[group])) {
      const l = document.createElement("label"),
        o = document.createElement("output"),
        input = document.createElement("input");
      l.textContent = s[0];
      input.id = `visibility-${group}-${k}`;
      input.type = "range";
      input.min = s[2];
      input.max = s[3];
      input.step = s[4];
      input.oninput = () => store.set(group, k, Number(input.value));
      l.append(o, input);
      section.append(l);
      instrumentRange(input, {
        name: s[0],
        defaultValue: s[1],
        reset: () => store.set(group, k, s[1]),
      });
      ranges.push({ input, o, s, group, k });
    }
    if (group === "arrows") {
      const l = document.createElement("label");
      l.textContent = "Arrow color ";
      const input = document.createElement("input");
      input.id = "visibility-arrow-color";
      input.type = "color";
      input.value = store.values.color;
      input.oninput = () => store.set("color", null, input.value);
      l.append(input);
      section.append(l);
    }
    const reset = document.createElement("button");
    reset.textContent = "Reset " + group + " defaults";
    reset.onclick = () => store.reset(group);
    section.append(reset);
  }
  const d = document.createElement("details");
  d.id = "collisionDebugLab";
  d.className = "settings-section";
  const title = document.createElement("summary");
  title.textContent = "Collision Debug Lab / course validation";
  d.append(title);
  root.append(d);
  for (const [key, text] of [
    ["geometry", "Active exposed shoreline"],
    ["normals", "Collision normals"],
    ["segments", "Segment boundaries / centerlines"],
    ["overlaps", "Excluded overlapping internal boundaries"],
    ["footprint", "Boat collision footprint"],
    ["contacts", "Recent contact points / normals"],
    ["seams", "Highlight suspicious collision seams"],
    ["safeZones", "HUD safe zones / track visibility"],
    ["checkpoints", "Checkpoint numbers and forward vectors"],
  ]) {
    const l = document.createElement("label"),
      input = document.createElement("input");
    input.id = "visibility-debug-" + key;
    input.type = "checkbox";
    input.checked = store.values.debug[key];
    input.onchange = () => {
      store.set("debug", key, input.checked);
      if (key === "checkpoints") toggleCheckpoints(input.checked);
    };
    l.append(input, document.createTextNode(text));
    d.append(l);
  }
  const status = document.createElement("pre");
  status.id = "courseValidationReport";
  d.append(status);
  const b = document.createElement("button");
  b.id = "validateCourses";
  b.textContent = "Validate all courses now";
  b.onclick = () => (status.textContent = JSON.stringify(validate(), null, 2));
  d.append(b);
  function refresh() {
    for (const { input, o, s, group, k } of ranges) {
      input.value = store.values[group][k];
      o.textContent = store.values[group][k] + s[5];
      updateRange(input);
    }
    root.querySelector("#visibility-arrow-color").value = store.values.color;
    const h = store.values.hud;
    document.documentElement.style.setProperty("--race-hud-scale", h.scale);
    document.documentElement.style.setProperty("--race-hud-opacity", h.opacity);
    document.documentElement.style.setProperty("--race-hud-x", h.x + "px");
    document.documentElement.style.setProperty("--race-hud-y", h.y + "px");
    document.body.classList.toggle(
      "show-safe-zones",
      store.values.debug.safeZones,
    );
  }
  store.subscribe(refresh);
  refresh();
  return root;
}
