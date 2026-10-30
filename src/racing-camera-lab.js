import { cameraSpecs, sanitizeCameraPreset } from "./racing-camera-settings.js";
import { instrumentRange, updateRange } from "./ui-components.js";
export function mountRacingCameraLab(store, manager, parent, world) {
  const old = [...parent.children];
  const root = document.createElement("div");
  root.id = "racingCameraLab";
  parent.prepend(root);
  const title = document.createElement("h3");
  title.textContent = "CAMERA LAB / ARCADE & RIVER";
  root.append(title);
  const label = document.createElement("label");
  label.textContent = "Course preset ";
  const course = document.createElement("select");
  course.id = "racingCameraCourse";
  for (const c of world.courses) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    course.append(o);
  }
  label.append(course);
  root.append(label);
  const note = document.createElement("p");
  note.textContent =
    "Each venue stores its flat camera, outgoing river and sweep separately. Select a level in RACE to preview that venue live. Xbox input settings remain in INPUT.";
  root.append(note);
  const ranges = [];
  let editing = store.course,
    applying = false;
  const edit = (fn) => {
    const active = store.course;
    applying = true;
    store.use(editing);
    fn();
    store.use(active);
    applying = false;
    refresh();
  };
  const apply = (g, k, v) => edit(() => store.set(g, k, v));
  for (const [group, heading] of [
    ["flat", "Flat-Track Camera"],
    ["river", "River Follow Camera"],
    ["transition", "Cinematic Transition Lab"],
  ]) {
    const section = document.createElement("details");
    section.className = "settings-section";
    section.open = group === "flat";
    const caption = document.createElement("summary");
    caption.textContent = heading;
    section.append(caption);
    root.append(section);
    for (const [k, s] of Object.entries(cameraSpecs[group])) {
      const label = document.createElement("label");
      label.textContent = s[0];
      const output = document.createElement("output"),
        input = document.createElement("input");
      input.type = "range";
      input.id = `racing-${group}-${k}`;
      input.min = s[2];
      input.max = s[3];
      input.step = s[4];
      label.append(output, input);
      section.append(label);
      instrumentRange(input, {
        name: s[0],
        defaultValue: s[1],
        reset: () => apply(group, k, s[1]),
      });
      input.oninput = () => apply(group, k, Number(input.value));
      ranges.push({ group, k, input, output, s });
    }
    const choice = (key, caption, options) => {
      const l = document.createElement("label");
      l.textContent = caption;
      const s = document.createElement("select");
      s.id = `racing-${group}-${key}`;
      for (const v of options) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        s.append(o);
      }
      s.onchange = () => apply(group, key, s.value);
      l.append(s);
      section.append(l);
      return s;
    };
    if (group === "flat") {
      choice("framing", "Framing mode", ["auto", "manual"]);
      choice("projection", "Projection", ["perspective", "orthographic"]);
      const b = document.createElement("button");
      b.id = "racingAutoFit";
      b.textContent = "Auto-Fit Active Track";
      b.onclick = () => {
        edit(() => store.autoFit());
        manager.debug = false;
      };
      section.append(b);
    }
    if (group === "transition") {
      choice("easing", "Easing curve", ["smooth", "smoother", "cosine"]);
      for (const [id, text, fn] of [
        [
          "testSweep",
          "Test Transition",
          () => {
            manager.testTransition();
            document.getElementById("pitClose").click();
          },
        ],
        [
          "resetSweep",
          "Reset Transition",
          () => edit(() => store.reset("transition")),
        ],
        ["skipSweep", "Skip Transition", () => manager.skip()],
      ]) {
        const b = document.createElement("button");
        b.id = id;
        b.textContent = text;
        b.onclick = fn;
        section.append(b);
      }
    }
  }
  const status = document.createElement("p");
  status.id = "racingCameraStatus";
  status.role = "status";
  root.append(status);
  const action = (id, text, fn) => {
    const b = document.createElement("button");
    b.id = id;
    b.textContent = text;
    b.onclick = fn;
    root.append(b);
  };
  action("useGameplayCameras", "Use automatic gameplay cameras", () => {
    manager.debug = false;
    manager.reset();
  });
  action("resetRacingCameras", "Reset this course to defaults", () =>
    edit(() => store.reset()),
  );
  const json = document.createElement("textarea");
  json.id = "racingCameraJSON";
  json.rows = 4;
  json.setAttribute("aria-label", "Camera Lab JSON import or export");
  root.append(json);
  action("copyRacingCameras", "Copy / Export Settings", async () => {
    json.value = store.export();
    try {
      await navigator.clipboard.writeText(json.value);
    } catch {
      json.focus();
      json.select();
    }
  });
  action("downloadRacingCameras", "Download Settings JSON", () => {
    const url = URL.createObjectURL(
      new Blob([store.export()], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "jet-sprint-camera-lab.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  action("importRacingCameras", "Import Settings", () => {
    try {
      store.import(json.value);
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.setAttribute("aria-label", "Import Camera Lab JSON file");
  file.onchange = async () => {
    try {
      store.import(await file.files[0].text());
    } catch (e) {
      status.textContent = e.message;
    }
  };
  root.append(file);
  const legacy = document.createElement("details");
  legacy.className = "settings-section";
  const summary = document.createElement("summary");
  summary.textContent = "Developer comparison / legacy cameras";
  legacy.append(summary);
  for (const child of old)
    if (child.tagName !== "SUMMARY") legacy.append(child);
  parent.append(legacy);
  function refresh() {
    const p =
      editing === store.course
        ? store.values
        : (store.presets[editing] ?? sanitizeCameraPreset());
    course.value = editing;
    for (const { group, k, input, output, s } of ranges) {
      input.value = p[group][k];
      output.textContent = p[group][k] + s[5];
      updateRange(input);
    }
    root.querySelector("#racing-flat-projection").value = p.flat.projection;
    root.querySelector("#racing-flat-framing").value = p.flat.framing;
    root.querySelector("#racing-transition-easing").value = p.transition.easing;
    status.textContent = store.warning;
  }
  course.onchange = () => {
    editing = course.value;
    refresh();
  };
  store.subscribe(() => {
    if (!applying) editing = store.course;
    refresh();
  });
  refresh();
  const timer = setInterval(() => {
    if (!parent.hidden)
      status.textContent =
        store.warning ||
        `${manager.state} · Boat ${Math.round(manager.boatPixels || 0)} px · Fit ${Math.round(manager.fitDistance || 0)} m. ${manager.warning || ""}`;
  }, 500);
  window.addEventListener("pagehide", () => clearInterval(timer), {
    once: true,
  });
  return root;
}
