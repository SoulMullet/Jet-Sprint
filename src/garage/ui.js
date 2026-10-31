import { garageEconomy, emergencyAvailable } from "./definitions.js";
import { GaragePreview } from "./preview.js";
import { format } from "../race.js";
const money = (n) => "$" + Math.floor(n).toLocaleString("en-US");
export function mountGarage({
  career,
  boat,
  environment,
  levels,
  onOpen,
  onClose,
  getPlaying,
  getLevel,
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "garage";
  dialog.setAttribute("aria-labelledby", "garageTitle");
  dialog.innerHTML = `<div class="garage-frame"><header class="garage-heading"><div><p class="eyebrow">KŌWHAI MARINE / SERVICE BAY 01</p><h2 id="garageTitle">THE GARAGE</h2></div><button id="closeGarage" aria-label="Close garage">RETURN <span aria-hidden="true">→</span></button></header><section class="garage-boat" aria-label="Your existing jetboat"><div id="garageBoatView"></div><div class="garage-boat-plate"><span>ONE BOAT / YOUR BOAT</span><strong>BIG-BLOCK SPRINT ’87</strong><small>650 KG / NATURALLY ASPIRATED V8</small></div></section><section class="garage-service"><div class="garage-cash"><span>CASH ON HAND</span><strong id="garageCash"></strong><small>LOCAL CAREER / THIS DEVICE</small></div><div class="garage-instrument"><label id="garageFuelLabel">FUEL <output id="garageFuelText"></output></label><div id="garageFuel" class="garage-meter" role="meter" aria-labelledby="garageFuelLabel" aria-valuemin="0" aria-valuemax="100"><i></i></div><button id="garageRefuel"></button></div><div class="garage-instrument"><label id="garageConditionLabel">HULL CONDITION <output id="garageConditionText"></output></label><div id="garageCondition" class="garage-meter" role="meter" aria-labelledby="garageConditionLabel" aria-valuemin="0" aria-valuemax="100"><i></i></div><button id="garageRepair"></button></div><div class="garage-emergency"><button id="garageEmergency">EMERGENCY DOCK SERVICE / FREE</button><p>Critical and short of cash? Restore up to 20% fuel and 40% hull. Full servicing stays paid. Empty tanks retain reserve power.</p></div><p id="garageStatus" role="status"></p><button id="retryProfile" hidden>Retry profile / pending reward save</button></section><section class="garage-log"><h3>RIVER LOGBOOK</h3><p id="careerProgress"></p><div id="careerCourses"></div></section><section class="garage-future"><h3>FUTURE FIT-OUTS</h3><div id="garageUpgrades"></div><p>One owned boat. Upgrade purchases arrive in a later build.</p><button id="exportProfile">Save profile JSON backup</button></section><footer><span id="garageProfileState"></span><button id="garageReturn" class="button-primary">BACK TO THE WATER</button></footer></div>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector("#" + id),
    preview = new GaragePreview(boat, environment),
    view = $("garageBoatView");
  for (const text of garageEconomy.upgradeCategories) {
    const b = document.createElement("button");
    b.disabled = true;
    b.textContent = text.toUpperCase() + " / LATER";
    $("garageUpgrades").append(b);
  }
  const buttons = [];
  for (const [parent, id, text] of [
    ["#intro .entry-main", "introGarage", "GARAGE / YOUR BOAT"],
    [".pause-card", "pauseGarage", "Garage / fuel & repairs"],
    [".results-actions", "resultsGarage", "RETURN TO GARAGE"],
  ]) {
    // Results markup varies across older builds; use its existing action host.
    const host =
      document.querySelector(parent) ||
      (id === "introGarage"
        ? document.getElementById("start")?.parentElement
        : id === "resultsGarage"
          ? document.getElementById("raceRestart")?.parentElement
          : null);
    const b = document.createElement("button");
    b.id = id;
    b.className =
      id === "resultsGarage" ? "button-primary" : "button-secondary";
    b.textContent = text;
    if (id === "introGarage") document.getElementById("start").after(b);
    else host?.append(b);
    buttons.push(b);
  }
  const service = document.createElement("div");
  service.className = "service-status";
  service.innerHTML =
    '<span>FUEL <b id="runFuel">100%</b></span><span>HULL <b id="runCondition">100%</b></span>';
  document.getElementById("journeyHUD").append(service);
  let active = false,
    returnFocus = null,
    message = "",
    clock = 1,
    rect = { x: 0, y: 0, width: 0, height: 0 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const resize = () => {
    if (active) {
      const r = view.getBoundingClientRect();
      rect = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
  };
  window.addEventListener("resize", resize);
  dialog.addEventListener("scroll", resize, true);
  new ResizeObserver(resize).observe(view);
  function refresh(hudOnly = false) {
    const p = career.profile,
      b = p.boat,
      locked = !career.writable;
    document.getElementById("runFuel").textContent =
      b.fuel <= 0 ? "RESERVE" : Math.ceil(b.fuel) + "%";
    document.getElementById("runCondition").textContent =
      Math.ceil(b.condition) + "%";
    service.classList.toggle("service-low", b.fuel < 20 || b.condition < 30);
    if (hudOnly) return;
    $("garageCash").textContent = money(p.cash);
    for (const [kind, meter, text, button] of [
      ["fuel", "garageFuel", "garageFuelText", "garageRefuel"],
      ["condition", "garageCondition", "garageConditionText", "garageRepair"],
    ]) {
      $(meter).setAttribute("aria-valuenow", b[kind].toFixed(1));
      $(meter).style.setProperty("--level", b[kind] + "%");
      $(text).textContent = b[kind].toFixed(1) + "%";
      const q = career.quote(kind),
        label = kind === "fuel" ? "REFUEL" : "REPAIR";
      $(button).textContent =
        q.units < 0.00001
          ? b[kind] >= 99.999
            ? "FULL / READY"
            : "INSUFFICIENT CASH"
          : `${label} TO ${q.to.toFixed(1)}% / ${money(q.cost)}`;
      $(button).disabled = locked || !q.available;
    }
    $("garageEmergency").disabled = locked || !emergencyAvailable(p);
    $("garageStatus").textContent =
      career.warning ||
      message ||
      career.recoveryNotice ||
      "Fuel $2 / 1% · Hull $4 / 1%. Affordable partial service is offered when cash is low.";
    $("retryProfile").hidden = !career.dirty && !career.pendingFinish;
    $("garageProfileState").textContent =
      `CAREER ${p.career.completedCourses.length}/${levels.length} / ${career.dirty ? "SAVE PENDING" : career.writable ? "SAVED ON THIS DEVICE" : "READ ONLY"}`;
    $("careerProgress").textContent =
      `${p.career.unlockedCourses.filter((id) => levels.some((l) => l.id === id)).length}/${levels.length} rivers available · ${money(p.lifetimeEarnings)} career earnings`;
    $("careerCourses").replaceChildren();
    for (const l of levels) {
      const r = p.career.records[l.id],
        line = document.createElement("p");
      line.textContent = `${l.name} / ${p.career.unlockedCourses.includes(l.id) ? (r ? `BEST ${format(r.best)} · ${r.completions} RUNS` : "OPEN / SET YOUR TIME") : "CLEAR THE PREVIOUS RIVER"}`;
      $("careerCourses").append(line);
    }
    const scale = career.framing().powerScale;
    document.getElementById("runFuel").textContent =
      b.fuel <= 0 ? "RESERVE" : Math.ceil(b.fuel) + "%";
    document.getElementById("runCondition").textContent =
      Math.ceil(b.condition) + "%";
    service.classList.toggle("service-low", b.fuel < 20 || b.condition < 30);
    service.title =
      scale < 1
        ? "Reduced propulsion; steering remains available. Visit the garage."
        : "Fuel and condition persist between runs.";
  }
  function close() {
    if (!active) return;
    active = false;
    dialog.close();
    document.body.classList.remove("garage-open");
    onClose();
    returnFocus?.focus({ preventScroll: true });
  }
  function open() {
    if (active) return;
    returnFocus = document.activeElement;
    career.flush();
    onOpen();
    active = true;
    message = "";
    document.body.classList.add("garage-open");
    dialog.showModal();
    $("garageReturn").textContent = getPlaying()
      ? "RETURN TO THIS RUN"
      : "CHOOSE YOUR RIVER";
    refresh();
    dialog.scrollTop = 0;
    resize();
    $("closeGarage").focus({ preventScroll: true });
  }
  for (const b of buttons) b.onclick = open;
  $("closeGarage").onclick = close;
  $("garageReturn").onclick = close;
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  for (const [id, kind] of [
    ["garageRefuel", "fuel"],
    ["garageRepair", "condition"],
  ])
    $(id).onclick = () => {
      const r = career.service(kind);
      message = r.ok
        ? `${kind === "fuel" ? "Fuel" : "Hull"} serviced to ${r.to.toFixed(1)}% / ${money(r.cost)} paid.`
        : r.reason;
      refresh();
    };
  $("garageEmergency").onclick = () => {
    const r = career.emergency();
    message = r.ok
      ? "Emergency crew topped up only the basic reserve. You can race again."
      : r.reason;
    refresh();
  };
  $("retryProfile").onclick = () => {
    const ok = career.retry();
    message = ok
      ? "Profile and any pending reward saved."
      : "Save still unavailable. Export a backup before leaving.";
    refresh();
  };
  $("exportProfile").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([career.export()], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "jet-sprint-player-profile-v1.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message =
      "Profile JSON exported. Replays and tuning are backed up separately.";
    refresh();
  };
  return {
    dialog,
    open,
    close,
    get active() {
      return active;
    },
    update(dt) {
      clock += dt;
      if (clock >= 0.2) {
        clock = 0;
        refresh(!active);
      }
    },
    render(renderer, dt) {
      preview.render(renderer, rect, dt, reduced.matches);
    },
    inspect: () => ({
      active,
      profile: structuredClone(career.profile),
      warning: career.warning,
      powerScale: career.framing().powerScale,
      currentLevel: getLevel().id,
    }),
  };
}
