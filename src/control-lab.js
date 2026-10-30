import { controlSpecs, controlPresets } from "./control-settings.js";
import { response } from "./control-input.js";
import {
  instrumentRange,
  updateRange,
  confirmDialog,
} from "./ui-components.js";

export function mountControlLab(store, controls) {
  const node = (tag, text, parent) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    parent?.append(el);
    return el;
  };
  const root = node("details", null, document.body);
  root.id = "controlLab";
  root.className = "control-lab";
  node("summary", "CONTROL LAB / ANALOG SYSTEMS", root);
  node(
    "p",
    "Input tuning only. Hull forces, top speed and handling profiles stay in HULL. Changes save automatically on this device.",
    root,
  ).className = "panel-description";
  const presetLabel = node("label", "Input response preset ", root),
    presets = node("select", null, presetLabel);
  presets.id = "controlPreset";
  for (const [id, preset] of Object.entries(controlPresets)) {
    const option = node("option", preset.name, presets);
    option.value = id;
  }
  node("option", "Custom", presets).value = "custom";
  presets.onchange = () => {
    if (presets.value !== "custom") store.select(presets.value);
  };
  const status = node(
    "p",
    store.warning ||
      "Arcade response ready. Drag each rail; use two fingers to steer and accelerate.",
    root,
  );
  status.id = "controlStatus";
  status.role = "status";
  const groups = {},
    fields = {};
  const button = (text, id, fn, parent = root) => {
    const b = node("button", text, parent);
    b.id = id;
    b.type = "button";
    b.onclick = async () => {
      try {
        await fn();
      } catch (error) {
        status.textContent = error.message;
      }
    };
    return b;
  };
  for (const [id, spec] of Object.entries(controlSpecs)) {
    let group = groups[spec.group];
    if (!group) {
      group = groups[spec.group] = node("details", null, root);
      group.className = "settings-section";
      node("summary", spec.group, group);
      group.open = spec.group === "Steering";
    }
    const label = node("label", spec.label + " ", group),
      input = node(spec.type === "enum" ? "select" : "input", null, label);
    input.id = "control-" + id;
    let output;
    if (spec.type === "number") {
      input.type = "range";
      input.min = spec.min;
      input.max = spec.max;
      input.step = spec.step;
      output = node("output", null, label);
      input.before(output);
      instrumentRange(input, {
        name: spec.label,
        defaultValue: spec.value,
        reset: () => store.set(id, spec.value),
      });
    } else if (spec.type === "enum")
      for (const value of spec.options) {
        const option = node(
          "option",
          value.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase()),
          input,
        );
        option.value = value;
      }
    else {
      input.type = "checkbox";
      label.classList.add("toggle-row");
      label.prepend(input);
    }
    input.addEventListener(spec.type === "number" ? "input" : "change", () => {
      store.set(
        id,
        spec.type === "number"
          ? Number(input.value)
          : spec.type === "boolean"
            ? input.checked
            : input.value,
      );
      status.textContent = "Control setup saved automatically.";
    });
    if (spec.note) {
      const note = node("small", spec.note, group);
      note.className = "control-help";
    }
    fields[id] = { input, output };
  }
  for (const [name, group] of Object.entries(groups))
    button(
      `Reset ${name}`,
      `control-reset-${name.replaceAll(" ", "-")}`,
      () => store.reset(name),
      group,
    );
  node(
    "p",
    "Calibration: trim the steering centre and throttle endpoints above. Neutral remains idle. All values are fractions of full travel. Reset Calibration restores the untrimmed rails.",
    groups.Calibration,
  );
  button(
    "Centre steering / idle throttle now",
    "controlNeutral",
    () => {
      controls.release();
      status.textContent = "Both touch axes centred. Hold modes cleared.";
    },
    groups.Calibration,
  );
  node(
    "p",
    "Xbox: left stick steers, RT accelerates, A confirms/starts, Menu pauses, View cycles cameras. D-pad moves through menu controls; left/right adjusts values. B goes back. LT is unassigned because this hull has no brake or reverse.",
    groups.Controller,
  );
  node(
    "p",
    "Pair or plug in the controller, then press a button to expose it to the browser. Auto accepts standard mappings. For older drivers choose Standard buttons or Axis triggers and set RT axis/rest. Release RT and centre the stick to arm after connecting or leaving a menu.",
    groups.Controller,
  );
  button("Reset all control settings", "resetControls", async () => {
    if (
      await confirmDialog(
        "Reset only Control Lab settings? Hull, spray, water, audio, camera and race records are kept.",
      )
    ) {
      controls.release();
      store.reset();
    }
  });
  const portable = node("details", null, root);
  node("summary", "Portable control JSON", portable);
  const json = node("textarea", null, portable);
  json.id = "controlJSON";
  json.rows = 6;
  json.spellcheck = false;
  json.setAttribute("aria-label", "Control settings JSON");
  button(
    "Export JSON",
    "exportControls",
    () => {
      json.value = store.exportText();
      portable.open = true;
      status.textContent = "Control JSON ready to copy or download.";
    },
    portable,
  );
  button(
    "Download JSON",
    "downloadControls",
    () => {
      json.value = store.exportText();
      const url = URL.createObjectURL(
          new Blob([json.value], { type: "application/json" }),
        ),
        a = node("a", null, document.body);
      a.href = url;
      a.download = "jet-sprint-controls.json";
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    portable,
  );
  button(
    "Import JSON",
    "importControls",
    () => {
      store.importText(json.value);
      controls.release();
      status.textContent =
        "Control JSON imported. Other tuning stores were preserved.";
    },
    portable,
  );
  const file = node("input", null, portable);
  file.type = "file";
  file.id = "importControlFile";
  file.accept = ".json,application/json";
  file.setAttribute("aria-label", "Import control JSON file");
  file.onchange = async () => {
    try {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 100000) throw Error("Control file exceeds 100 KB.");
      json.value = await f.text();
      store.importText(json.value);
      controls.release();
      status.textContent = "Control file imported.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      file.value = "";
    }
  };
  const diagnostics = node("details", null, root);
  diagnostics.id = "inputDiagnostics";
  node("summary", "LIVE INPUT / RAW → COMMAND", diagnostics);
  const signals = node("div", null, diagnostics);
  signals.className = "input-signal-grid";
  const readouts = {};
  for (const [id, text] of [
    ["rawSteering", "RAW STEER"],
    ["steering", "FILTERED"],
    ["rawThrottle", "RAW THROTTLE"],
    ["throttle", "FILTERED"],
  ]) {
    const label = node("label", text, signals),
      output = node("output", "0.000", label),
      meter = node("meter", null, label);
    meter.min =
      id.toLowerCase().includes("steer") || id === "steering" ? -1 : 0;
    meter.max = 1;
    readouts[id] = { output, meter };
  }
  const curves = node("div", null, diagnostics);
  curves.className = "input-curves";
  curves.innerHTML = `<figure><figcaption>STEERING / DEAD ZONE</figcaption><svg viewBox="0 0 200 100" role="img" aria-label="Steering response with shaded dead zone"><path class="curve-grid" d="M0 99H200M1 0V100M100 0V100"/><rect class="curve-deadzone" x="98" y="0" width="4" height="100"/><path id="steerCurvePath" class="curve-line"/><circle id="steerCurveDot" r="4"/></svg></figure><figure><figcaption>THROTTLE / RESPONSE</figcaption><svg viewBox="0 0 200 100" role="img" aria-label="Throttle response curve"><path class="curve-grid" d="M0 99H200M1 0V100"/><path id="throttleCurvePath" class="curve-line"/><circle id="throttleCurveDot" r="4"/></svg></figure>`;
  const report = node("pre", null, diagnostics);
  report.id = "inputDiagnosticReadout";
  node(
    "p",
    "In setup, controller signals preview the same filters while boat commands stay zero. Touch/keyboard signals are live in the on-course overlay after closing setup.",
    diagnostics,
  ).className = "control-help";
  const overlay = node("details", null, document.body);
  overlay.id = "inputOverlay";
  overlay.hidden = true;
  node("summary", "INPUT / LIVE", overlay);
  const overlayText = node("pre", null, overlay);
  const refresh = () => {
    presets.value = store.preset;
    for (const [id, { input, output }] of Object.entries(fields)) {
      const s = controlSpecs[id],
        value = store.values[id];
      if (s.type === "boolean") input.checked = value;
      else input.value = value;
      if (output) {
        output.textContent = value + s.unit;
        updateRange(input);
      }
    }
    overlay.hidden = !store.values.diagnostics;
    if (store.warning) status.textContent = store.warning;
    curveKey = "";
    revision++;
  };
  let time = 0,
    curveKey = "",
    revision = 0;
  function update(dt) {
    time += dt;
    if (time < 0.1) return;
    time = 0;
    if ((root.hidden || !diagnostics.open) && (!overlay.open || overlay.hidden))
      return;
    const delivered = controls.inspect(),
      d = delivered.preview ?? delivered,
      v = store.values;
    for (const [key, { output, meter }] of Object.entries(readouts)) {
      output.textContent = d[key].toFixed(3);
      meter.value = d[key];
    }
    const pad = delivered.controller,
      text = `${delivered.preview ? "SETUP PREVIEW / BOAT DISARMED\n" : ""}BOAT ${delivered.steering.toFixed(3)} / ${delivered.throttle.toFixed(3)}\nDEVICE ${d.device.toUpperCase()}\nPAD ${pad.connected ? pad.id : pad.apiAvailable ? "not connected" : "API unavailable"}\n${pad.connected ? `${pad.supported ? "Mapping ready" : "Choose mapping"} / ${pad.armed ? "armed" : "centre stick + release RT"}` : "Press a pad button to detect"}\nPAD RAW ${pad.rawSteering.toFixed(3)} / ${pad.rawThrottle.toFixed(3)}\nRETURN ${v.steerReturn} / ${v.throttleReturn}\nSMOOTH ${v.steerSmoothing.toFixed(3)} / ${v.throttleSmoothing.toFixed(3)} s\nRAMP steer ${v.steerRamp}/s · throttle +${v.throttleRampUp}/−${v.throttleRampDown}/s\nTARGET ${d.targetSteering.toFixed(3)} / ${d.targetThrottle.toFixed(3)}`;
    report.textContent = text;
    overlayText.textContent = `STEER ${d.rawSteering.toFixed(2)} → ${d.steering.toFixed(2)}\nGAS   ${d.rawThrottle.toFixed(2)} → ${d.throttle.toFixed(2)}\n${text}`;
    const isPad = d.device === "gamepad",
      key = d.device + "/" + revision;
    if (key !== curveKey) {
      curveKey = key;
      let steering = "",
        throttle = "";
      for (let i = 0; i <= 64; i++) {
        const x = i / 64,
          s = x * 2 - 1;
        const steer = response(
          isPad ? response(s, v.padDeadzone, v.padCurve, v.padSensitivity) : s,
          v.steerDeadzone,
          v.steerCurve,
          v.steerSensitivity,
        );
        const gas = response(
          isPad
            ? response(x, v.padTriggerDeadzone, v.padThrottleCurve, 1, false)
            : x,
          v.throttleDeadzone,
          v.throttleCurve,
          v.throttleSensitivity,
          false,
        );
        steering += `${i ? "L" : "M"}${(x * 200).toFixed(2)},${(50 - steer * 46).toFixed(2)}`;
        throttle += `${i ? "L" : "M"}${(x * 200).toFixed(2)},${(96 - gas * 92).toFixed(2)}`;
      }
      document.getElementById("steerCurvePath").setAttribute("d", steering);
      document.getElementById("throttleCurvePath").setAttribute("d", throttle);
      const dead = isPad
          ? v.padDeadzone + (1 - v.padDeadzone) * v.steerDeadzone
          : v.steerDeadzone,
        rect = curves.querySelector(".curve-deadzone");
      rect.setAttribute("x", (1 - dead) * 100);
      rect.setAttribute("width", dead * 200);
    }
    for (const [id, x, y] of [
      ["steerCurveDot", (d.rawSteering + 1) * 100, 50 - d.targetSteering * 46],
      ["throttleCurveDot", d.rawThrottle * 200, 96 - d.targetThrottle * 92],
    ]) {
      const dot = document.getElementById(id);
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
    }
  }
  store.subscribe(refresh);
  refresh();
  return { root, update };
}
