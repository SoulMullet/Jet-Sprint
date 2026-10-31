import { mountInstrumentGauge } from "./instrument-gauge.js";
import { mountFontDiagnostics } from "./typography.js";
import { registry } from "./settings.js";
import { audioControls } from "./audio-settings.js";
import { summerControls } from "./summer-settings.js";
import { cameraDefaults } from "./camera-settings.js";
import {
  instrumentRange,
  updateRange,
  mountTooltips,
  trapFocus,
} from "./ui-components.js";

const panelDefinitions = [
  ["race", "RACE", "RACE / SETUP", "debug"],
  ["physics", "HULL", "HULL / DYNAMICS", "physicsLab"],
  ["spray", "SPRAY", "SPRAY / WATERJET", "sprayLab"],
  ["graphics", "VIDEO", "VIDEO / CALIBRATION", "graphicsLab"],
  ["audio", "V8", "V8 / SOUND LAB", "soundLab"],
  ["camera", "VIEW", "VIEW / CAMERAS", "cameraSettings"],
  ["controls", "INPUT", "CONTROL LAB / ANALOG", "controlLab"],
  ["replays", "GHOST", "GHOST / REPLAY LAB", "ghostReplayLab"],
];

/** Presentation only: existing panels and handlers are reparented, never cloned. */
export function mountInterface({
  preferences,
  audioSettings,
  summerPreferences,
  cameraPreferences,
  release,
  soundLab,
}) {
  const $ = (id) => document.getElementById(id);
  const consoleRoot = document.createElement("section");
  consoleRoot.id = "pitConsole";
  consoleRoot.hidden = true;
  consoleRoot.setAttribute("aria-labelledby", "pitTitle");
  consoleRoot.innerHTML = `<div class="pit-heading"><div><h2 id="pitTitle">PIT / CONTROL</h2><p><i class="status-led" aria-hidden="true"></i>LIVE TUNING / DEVICE MEMORY</p></div><button id="pitClose" type="button" aria-label="Close Pit Control">×</button></div><nav class="pit-tabs" role="tablist" aria-label="Tuning departments"></nav><div class="pit-scroll"></div><div class="pit-footer"><span>JET SPRINT / ENGINEERING</span><span>CHANGES APPLY LIVE</span></div>`;
  document.body.append(consoleRoot);
  const tabs = consoleRoot.querySelector(".pit-tabs"),
    scroll = consoleRoot.querySelector(".pit-scroll");
  const title = $("pitTitle"),
    toggle = $("pitToggle"),
    close = $("pitClose");
  const pages = new Map(),
    positions = new Map();
  let active = "physics",
    returnFocus = toggle;

  // Move the nested camera/graphics panels first, so Race no longer duplicates them.
  for (const id of ["graphicsLab", "cameraSettings"]) scroll.append($(id));
  for (const [key, text, heading, id] of panelDefinitions) {
    const root = $(id),
      button = document.createElement("button");
    root.classList.add("pit-page");
    root.setAttribute("role", "tabpanel");
    root.setAttribute("aria-labelledby", `pit-tab-${key}`);
    root.hidden = true;
    if (root instanceof HTMLDetailsElement) root.open = false;
    scroll.append(root);
    button.id = `pit-tab-${key}`;
    button.type = "button";
    button.textContent = text;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", id);
    button.setAttribute("aria-selected", "false");
    button.tabIndex = -1;
    button.onclick = () => open(key, false);
    tabs.append(button);
    pages.set(key, { root, button, heading });
  }

  function open(key = active, focus = true) {
    if (consoleRoot.hidden) returnFocus = document.activeElement;
    else positions.set(active, scroll.scrollTop);
    release();
    if (key !== "audio" && soundLab.testing) soundLab.setTesting(false);
    active = key;
    for (const [name, page] of pages) {
      const selected = name === key;
      page.root.hidden = !selected;
      if (page.root instanceof HTMLDetailsElement) page.root.open = selected;
      page.button.setAttribute("aria-selected", String(selected));
      page.button.tabIndex = selected ? 0 : -1;
    }
    title.textContent = pages.get(key).heading;
    consoleRoot.hidden = false;
    document.body.classList.add("pit-open");
    toggle.setAttribute("aria-expanded", "true");
    $("physicsLabToggle").setAttribute(
      "aria-expanded",
      String(key === "physics"),
    );
    scroll.scrollTop = positions.get(key) || 0;
    pages.get(key).button.scrollIntoView({block: "nearest", inline: "nearest"});
    if (focus) pages.get(key).button.focus({ preventScroll: true });
    refreshControls();
  }
  function shut() {
    positions.set(active, scroll.scrollTop);
    consoleRoot.hidden = true;
    document.body.classList.remove("pit-open");
    toggle.setAttribute("aria-expanded", "false");
    $("physicsLabToggle").setAttribute("aria-expanded", "false");
    for (const { root } of pages.values()) {
      root.hidden = true;
      if (root instanceof HTMLDetailsElement) root.open = false;
    }
    // A hidden dyno must not leave the race clock frozen with no visible stop control.
    if (soundLab.testing) soundLab.setTesting(false);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  toggle.onclick = () => (consoleRoot.hidden ? open() : shut());
  toggle.dataset.tooltip = "Live setup / physics, graphics, V8 and cameras";
  close.onclick = shut;
  $("physicsLabToggle").addEventListener("click", () => open("physics"));
  $("physicsLabShortcut").addEventListener("click", () => open("physics"));
  $("physicsLabClose").addEventListener("click", shut);
  const introTune = document.createElement("button");
  introTune.id = "introTune";
  introTune.type = "button";
  introTune.textContent = "PIT CONTROL / SETUP";
  introTune.onclick = () => open("physics");
  $("buildDebug").before(introTune);
  tabs.addEventListener("keydown", (event) => {
    const keys = [...pages.keys()],
      index = keys.indexOf(active);
    let next;
    if (event.key === "ArrowRight") next = keys[(index + 1) % keys.length];
    if (event.key === "ArrowLeft")
      next = keys[(index + keys.length - 1) % keys.length];
    if (event.key === "Home") next = keys[0];
    if (event.key === "End") next = keys.at(-1);
    if (next) {
      event.preventDefault();
      open(next);
    }
  });
  consoleRoot.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      shut();
    }
  });

  // Keep the compact, existing camera-cycle action beside the race toolbar.
  const cameraButton = $("cameraSwitch");
  cameraButton.classList.add("tool-button");
  document.querySelector(".race-toolbar").prepend(cameraButton);
  const cameraLabel = document.createElement("span");
  const cameraIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h5l2-3h5l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/></svg>';
  function refreshCamera() {
    cameraLabel.textContent = cameraButton
      .getAttribute("aria-label")
      .split(". Switch")[0]
      .replace("Camera: ", "");
    cameraButton.innerHTML = cameraIcon;
    cameraButton.append(cameraLabel);
    cameraButton.dataset.tooltip = `${cameraLabel.textContent} / cycle camera`;
  }
  cameraPreferences.subscribe(() => {
    refreshCamera();
    refreshControls();
  });
  refreshCamera();
  $("restart").dataset.tooltip = "Restart race / R";

  function rangeSpec(input) {
    if (registry[input.id]) {
      const spec = registry[input.id];
      return {
        name: spec.label,
        defaultValue: spec.default,
        reset: () => preferences.set(input.id, spec.default),
      };
    }
    if (input.id.startsWith("audio-")) {
      const key = input.id.slice(6),
        spec = audioControls[key];
      return {
        name: spec.label,
        defaultValue: spec.default,
        reset: () => audioSettings.set(key, spec.default),
      };
    }
    if (input.id.startsWith("summer-")) {
      const key = input.id.slice(7),
        spec = summerControls[key];
      return {
        name: spec.label,
        defaultValue: spec.value,
        reset: () => summerPreferences.set(key, spec.value),
      };
    }
    if (input.id.startsWith("camera-")) {
      const key = input.id.slice(7),
        mode = cameraPreferences.mode,
        value = cameraDefaults[mode][key];
      return {
        defaultValue: value,
        reset: () => cameraPreferences.set(mode, key, value),
      };
    }
    return {
      defaultValue: 0,
      reset: () => {
        input.value = 0;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
    };
  }
  function refreshControls() {
    for (const input of consoleRoot.querySelectorAll("input[type=range]")) {
      instrumentRange(input, rangeSpec(input));
      updateRange(input);
    }
    for (const input of consoleRoot.querySelectorAll("input[type=checkbox]")) {
      const label = input.closest("label");
      label?.classList.add("toggle-row");
      if (label && label.firstChild !== input) label.prepend(input);
    }
    for (const quality of ["low", "medium", "high", "ultra"])
      $("summer-" + quality).setAttribute(
        "aria-pressed",
        String(summerPreferences.values.preset === quality),
      );
  }
  preferences.subscribe(refreshControls);
  audioSettings.subscribe(refreshControls);
  summerPreferences.subscribe(refreshControls);
  consoleRoot.addEventListener("input", (event) => {
    if (event.target.matches("input[type=range]")) updateRange(event.target);
  });
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          (r.type === "attributes" && r.target.matches("input[type=range]")) ||
          [...r.addedNodes].some(
            (n) =>
              n.nodeType === 1 &&
              (n.matches("input[type=range]") ||
                n.querySelector("input[type=range]")),
          ),
      )
    )
      refreshControls();
  });
  observer.observe(consoleRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
  $("summer-low").parentElement.classList.add("quality-presets");
  $("audioStatus").classList.add("panel-description");
  refreshControls();
  mountTooltips();
  trapFocus($("results"));

  const gauge = mountInstrumentGauge(document.querySelector(".speed"));
  if (import.meta.env.DEV) mountFontDiagnostics();
  return {
    open,
    close: shut,
    update: (dt, rpm, maxRPM, speed, top) =>
      gauge.update(dt, rpm, maxRPM, speed, top),
  };
}
