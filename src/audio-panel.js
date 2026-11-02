import { engineRecordings } from "./engine-samples.js";
import { audioControls, enginePresets } from "./audio-settings.js";
export function mountSoundLab(store, engine, { onTestChange = () => {} } = {}) {
  const node = (tag, text, parent) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    parent?.append(el);
    return el;
  };
  const root = node("details", null, document.body);
  root.id = "soundLab";
  node("summary", "ENGINE AUDIO LAB", root);
  const body = node("div", null, root);
  body.className = "sound-lab-body";
  node(
    "p",
    "Real V8 recordings / live RPM and load mixing. Engine and music volumes save independently.",
    body,
  );
  const status = node("p", null, body);
  status.id = "audioStatus";
  status.setAttribute("role", "status");
  const message = (text) => (status.textContent = text);
  const button = (text, id, action, parent = body) => {
    const b = node("button", text, parent);
    b.id = id;
    b.type = "button";
    b.onclick = async () => {
      try {
        await action();
      } catch (e) {
        message(e.message);
      }
    };
    return b;
  };
  const select = node("select", null, body);
  select.id = "enginePreset";
  select.setAttribute("aria-label", "Engine sound preset");
  for (const [id, p] of Object.entries(enginePresets)) {
    const option = node("option", p.name, select);
    option.value = id;
  }
  const custom = node("option", "Custom", select);
  custom.value = "custom";
  select.onchange = () => {
    store.select(select.value);
    message("Sound preset applied.");
  };
  let testing = false,
    throttle = 0,
    jumpRemaining = 0;
  const testContact = { airborne: false, landed: false };
  const test = node("section", null, body);
  test.className = "engine-test";
  const toggle = button(
    "Start stationary engine test",
    "engineTest",
    () => {
      api.setTesting(!testing);
    },
    test,
  );
  toggle.setAttribute("aria-pressed", "false");
  const rpm = node("output", "900 RPM", test);
  rpm.id = "testRPM";
  rpm.setAttribute("aria-label", "Live engine RPM");
  const label = node("label", "Test throttle ", test),
    value = node("output", "0%", label),
    slider = node("input", null, label);
  slider.id = "testThrottle";
  slider.type = "range";
  slider.min = 0;
  slider.max = 100;
  slider.value = 0;
  slider.disabled = true;
  slider.setAttribute("aria-label", "Stationary test throttle");
  slider.oninput = () => {
    throttle = Number(slider.value) / 100;
    value.textContent = `${slider.value}%`;
  };
  node(
    "p",
    "Stationary test freezes the boat and race clock. Start audio with a tap; use headphones or speakers with bass.",
    test,
  );
  const jumpButton = button(
    "Simulate jump / landing",
    "simulateEngineJump",
    () => {
      if (!testing) api.setTesting(true);
      jumpRemaining = jumpRemaining > 0 ? 0 : 1.25;
      testContact.landed = false;
    },
    test,
  );
  node(
    "p",
    "Jump preview changes audio contact only; it does not move the live boat.",
    test,
  );
  const unlock = button(
    "Enable / resume audio",
    "unlockEngine",
    async () => {
      await engine.start();
      message(
        engine.ctx?.state === "running"
          ? "Audio enabled."
          : engine.ctx
            ? "Tap again to resume audio."
            : "Web Audio is unavailable in this browser.",
      );
    },
    test,
  );
  const tip = node(
    "p",
    "Nine real recordings / source RPM is uncalibrated. Three cruise beds crossfade with RPM/load; high rev blends near redline, and rev-out follows debounced physical flight. All loops remain continuous.",
    body,
  );
  tip.className = "idle-tip";
  const samples = node("details", null, body);
  node("summary", "Sample Playback Test", samples);
  node(
    "p",
    "Hear each supplied recording directly (four-second preview). Testing pauses the race. Engine volume and mute still apply.",
    samples,
  );
  for (const [id, path] of Object.entries(engineRecordings)) {
    const title = path.split("/").at(-1);
    button(
      "Play " + title,
      "sampleTest-" + id,
      async () => {
        api.setTesting(true);
        await engine.audition(id);
      },
      samples,
    );
  }
  button(
    "Stop sample preview",
    "sampleTest-stop",
    () => engine.stopAudition(),
    samples,
  );
  const diagnostics = node("details", null, body);
  diagnostics.id = "engineDiagnostics";
  node("summary", "Engine Audio Diagnostics", diagnostics);
  const diagnosticText = node("pre", null, diagnostics);
  diagnosticText.style.cssText =
    "white-space:pre-wrap;overflow-wrap:anywhere;font:inherit";
  let diagnosticTime = 0;
  const sliders = {},
    groups = {};
  let group;
  for (const [id, s] of Object.entries(audioControls)) {
    if (!groups[s.group]) {
      group = groups[s.group] = node("details", null, body);
      group.dataset.group = s.group;
      node("summary", s.group, group);
      group.open = s.group === "Engine behavior";
    } else group = groups[s.group];
    const label = node("label", s.label + " ", group),
      output = node("output", null, label),
      input = node("input", null, label);
    input.type = s.type === "toggle" ? "checkbox" : "range";
    input.id = "audio-" + id;
    input.min = s.min;
    input.max = s.max;
    input.step = s.step;
    input.setAttribute("aria-label", s.label);
    input[s.type === "toggle" ? "onchange" : "oninput"] = () => {
      store.set(
        id,
        s.type === "toggle" ? Number(input.checked) : Number(input.value),
      );
      if (store.warning) message(store.warning);
    };
    sliders[id] = { input, output };
  }
  button("Reset to Defaults", "resetEngine", () => {
    store.reset();
    message("Marine Jet Sprint V8 restored.");
  });
  const saved = node("details", null, body);
  node("summary", "Save, load & JSON", saved);
  const name = node("input", null, saved);
  name.type = "text";
  name.maxLength = 40;
  name.placeholder = "Audio preset name";
  name.id = "audioPresetName";
  name.setAttribute("aria-label", "Audio preset name");
  const list = node("select", null, saved);
  list.id = "savedAudioPresets";
  list.setAttribute("aria-label", "Saved audio presets");
  const refreshList = (chosen) => {
    list.replaceChildren();
    const empty = node("option", "Choose a saved audio preset", list);
    empty.value = "";
    for (const r of store.records) {
      const opt = node("option", r.name, list);
      opt.value = r.name;
    }
    list.value = chosen || "";
  };
  refreshList();
  list.onchange = () => {
    if (list.value) name.value = list.value;
  };
  button(
    "Save Preset",
    "saveAudioPreset",
    () => {
      store.save(name.value);
      refreshList(name.value.trim().slice(0, 40));
      message("Audio preset saved on this device.");
    },
    saved,
  );
  button(
    "Load Preset",
    "loadAudioPreset",
    () => {
      store.load(list.value);
      message("Saved audio preset loaded.");
    },
    saved,
  );
  const json = node("textarea", null, saved);
  json.id = "audioJSON";
  json.rows = 5;
  json.spellcheck = false;
  json.setAttribute("aria-label", "V8 settings JSON");
  button(
    "Export Settings as JSON",
    "exportAudio",
    () => {
      json.value = store.exportText();
      const url = URL.createObjectURL(
          new Blob([json.value], { type: "application/json" }),
        ),
        a = node("a", null, document.body);
      a.href = url;
      a.download = "jet-sprint-v8.json";
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("Audio JSON exported and shown below.");
    },
    saved,
  );
  button(
    "Import Settings from JSON",
    "importAudio",
    () => {
      store.importText(json.value);
      message("Audio settings imported.");
    },
    saved,
  );
  const file = node("input", null, saved);
  file.type = "file";
  file.id = "importAudioFile";
  file.accept = ".json,application/json";
  file.setAttribute("aria-label", "Import V8 settings JSON file");
  file.onchange = async () => {
    try {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 100000) throw Error("Audio file exceeds 100 KB.");
      const text = await f.text();
      store.importText(text);
      json.value = text;
      message("Audio file imported.");
    } catch (e) {
      message(e.message);
    } finally {
      file.value = "";
    }
  };
  const refresh = () => {
    select.value = store.preset;
    for (const [id, { input, output }] of Object.entries(sliders)) {
      input.value = store.values[id];
      if (audioControls[id].type === "toggle")
        input.checked = !!store.values[id];
      output.textContent =
        audioControls[id].type === "toggle"
          ? store.values[id]
            ? "ON"
            : "OFF"
          : store.values[id] + audioControls[id].unit;
    }
    engine.setSettings(store.values);
  };
  store.subscribe(() => {
    refresh();
    if (store.warning) message(store.warning);
  });
  refresh();
  message(
    store.warning ||
      "Marine V8 ready. Tap stationary test or start racing to hear it.",
  );
  root.addEventListener("toggle", () => {
    if (root.open) {
      const settings = document.getElementById("debug");
      if (settings) settings.open = false;
    }
  });
  const api = {
    root,
    get testing() {
      return testing;
    },
    get throttle() {
      return throttle;
    },
    get contact() {
      return testContact;
    },
    stepTest(dt) {
      const wasAir = testContact.airborne;
      jumpRemaining = Math.max(0, jumpRemaining - dt);
      testContact.airborne = jumpRemaining > 0;
      testContact.landed = wasAir && !testContact.airborne;
    },
    setTesting(on) {
      on = !!on;
      if (on !== testing) {
        if (on) engine.beginTest();
        else engine.endTest();
      }
      testing = on;
      jumpRemaining = 0;
      testContact.airborne = false;
      testContact.landed = false;
      throttle = 0;
      slider.value = 0;
      value.textContent = "0%";
      slider.disabled = !testing;
      toggle.textContent = testing
        ? "End stationary engine test"
        : "Start stationary engine test";
      toggle.setAttribute("aria-pressed", String(testing));
      document.body.classList.toggle("sound-testing", testing);
      onTestChange(testing);
      if (!testing) engine.stopAudition();
      if (testing) {
        engine.start();
        message("Stationary test · race clock paused.");
      } else message("Stationary test ended.");
    },
    update() {
      const text = `${Math.round(engine.rpm)} RPM`;
      if (rpm.textContent !== text) rpm.textContent = text;
      unlock.hidden = engine.ctx?.state === "running";
      if (performance.now() - diagnosticTime > 150) {
        diagnosticTime = performance.now();
        const d = engine.inspect();
        diagnosticText.textContent = `${d.backend}\n${d.state} / airborne ${d.airborne ? "YES" : "NO"}\nRPM ${d.rpm} / change ${d.rpmRate} RPM/s\nThrottle ${d.throttle}% / load ${Math.round(d.load * 100)}%\nContext: ${d.context}\n${Object.entries(
          d.samples,
        )
          .map(([k, v]) => k + ": " + v)
          .join(
            "\n",
          )}\nLayers / playback rates:\n${d.layers.map((l) => l.id + " " + Math.round(l.gain * 100) + "% @ " + l.playbackRate + "×").join("\n")}\nCrossfade: ${d.crossfade}\nRev ${d.acceleration ? "active" : "idle"} / rev-down ${d.revDown ? "active" : "idle"}\nLoops ${d.loopSources} / active sources ${d.activeSources}\n${d.warning}`;
        if (d.warning) message(d.warning);
      }
    },
    message,
  };
  return api;
}
