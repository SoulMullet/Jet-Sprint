import { format } from "../race.js";
export function mountModeSelector(arcade) {
  const row = document.createElement("div");
  row.className = "mode-selector";
  row.setAttribute("aria-label", "Game mode");
  for (const [id, label] of [
    ["racing", "JET SPRINT / RACING"],
    ["arcade-river", "ARCADE RIVER"],
  ]) {
    const a = document.createElement("a"),
      url = new URL(location.href);
    if (id === "racing") url.searchParams.delete("mode");
    else url.searchParams.set("mode", id);
    a.href = url.href;
    a.textContent = label;
    a.setAttribute(
      "aria-current",
      arcade === (id === "arcade-river") ? "page" : "false",
    );
    row.append(a);
  }
  document.querySelector(".intro-description").after(row);
}
export function mountArcadeUI(
  tour,
  records,
  { getPlaying, getBoat, retry, release, onMenu },
) {
  const $ = (id) => document.getElementById(id),
    hud = document.createElement("aside");
  hud.id = "arcadeHUD";
  hud.innerHTML =
    '<div><span>SUNSET RIVER</span><strong id="arcadeCash">$0</strong></div><div class="arcade-progress"><label>TO FINISH <output id="arcadePercent">0%</output></label><div><i id="arcadeProgress"></i></div></div><div><span>HULL</span><strong id="arcadeCondition">100</strong></div>';
  document.body.append(hud);
  document.querySelector(".intro-tagline").innerHTML =
    "OPEN RIVER.<br>FULL SEND.";
  document.querySelector(".intro-description").textContent =
    "Hold THROTTLE to accelerate; release to coast. Touch the water view and drag left or right to steer. Hit wide ramps, dodge hazards and grab cash. Reach FINISH before 2:05.";
  document.querySelector(".entry-strap>span").textContent =
    "SUNSET RIVER / ARCADE INVITATIONAL";
  document.querySelector(".entry-course>strong").textContent = "SUNSET RIVER";
  document.querySelector(".entry-course>span").textContent =
    "ARCADE / 60–90 SECOND TARGET";
  document.querySelector(".entry-course>span:last-child").textContent =
    "TWO RAMPS / TWO ROUTES / ONE MORE RUN";
  const specs = document.querySelectorAll(".entry-specs>div");
  specs[1].querySelector("b").textContent = "HOLD";
  specs[1].querySelector("span").textContent = "THROTTLE";
  specs[2].querySelector("b").textContent = tour.tuning.values.cruiseSpeed;
  specs[2].querySelector("span").textContent = "MPH / ARCADE PRESET";
  $("start").textContent = "RUN THE RIVER";
  $("raceRestart").textContent = "RETRY / FULL SEND";
  $("raceRestart").classList.add("button-primary");
  $("continueJourney").hidden = true;
  $("saveScore").hidden = true;
  $("playerName").closest("label").hidden = true;
  $("board").hidden = true;
  $("resultsReplay").hidden = true;
  const menu = document.createElement("button");
  menu.textContent = "BACK TO START";
  menu.id = "arcadeMenu";
  menu.onclick = onMenu;
  $("raceRestart").after(menu);
  const pauseMenu = document.createElement("button");
  pauseMenu.textContent = "BACK TO START";
  pauseMenu.onclick = onMenu;
  document.querySelector(".pause-card").append(pauseMenu);
  document.querySelector("#intro footer").innerHTML =
    '<span>TOUCH</span> DRAG TO STEER · HOLD THROTTLE TO GO<br><span>KEYS</span> A / D OR ARROWS · SPACE / W THROTTLE · R RETRY · P PAUSE<br><span id="controllerEntryStatus">PAD</span> LEFT STICK + RT · A START';
  const points = tour.level.route.points,
    xs = points.map((p) => p.x),
    zs = points.map((p) => p.z),
    minX = Math.min(...xs),
    minZ = Math.min(...zs),
    scale = Math.min(
      210 / (Math.max(...xs) - minX),
      112 / (Math.max(...zs) - minZ),
    ),
    map = points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${15 + (p.x - minX) * scale},${14 + (p.z - minZ) * scale}`,
      )
      .join(" ");
  for (const p of document.querySelectorAll(
    ".entry-course .map-bank,.entry-course .map-water",
  ))
    p.setAttribute("d", map);
  $("raceRestart").onclick = retry;
  let clock = 1,
    lastCash = 0;
  return {
    finish(result) {
      release();
      const s = tour.summary();
      $("resultTitle").textContent = tour.failed
        ? "ONE MORE TRY"
        : "RIVER COMPLETE";
      document.querySelector("#results .eyebrow").textContent = tour.failed
        ? "QUICK RECOVERY"
        : "FINISH LINE";
      document.querySelector(".finish-strap").textContent =
        tour.failed || s.rating;
      $("resultStats").replaceChildren();
      for (const text of [
        `TIME ${format(s.time)} / CASH $${s.cash}`,
        `${s.jumps}/2 JUMPS · ${s.collisions} IMPACTS${s.shortcut ? " · GOLD CUT" : ""}`,
        `PERSONAL BEST ${records.best(tour.level.id) === null ? "—" : format(records.best(tour.level.id))}`,
        records.warning ||
          (tour.reward?.personalBest && !tour.failed
            ? "NEW PERSONAL BEST"
            : "DRAG TO STEER. HOLD THROTTLE TO GO."),
      ]) {
        const p = document.createElement("p");
        p.textContent = text;
        $("resultStats").append(p);
      }
      $("results").hidden = false;
      $("raceRestart").focus();
    },
    update(dt) {
      clock += dt;
      if (clock < 0.08) return;
      clock = 0;
      hud.hidden = !getPlaying();
      const progress =
        tour.done && !tour.failed
          ? 100
          : Math.max(
              0,
              Math.min(
                99,
                (100 * (tour.routeDistance - tour.level.startDistance)) /
                  (tour.level.finish.distance - tour.level.startDistance),
              ),
            );
      $("arcadeCash").textContent = "$" + tour.cash;
      $("arcadePercent").textContent = Math.round(progress) + "%";
      const remaining = Math.max(
          0,
          tour.world.definition.timeLimit - tour.race.total,
        ),
        hurry = !tour.done && remaining <= 20;
      hud.querySelector(".arcade-progress label").firstChild.textContent = hurry
        ? "TIME LEFT "
        : "TO FINISH ";
      if (hurry) $("arcadePercent").textContent = Math.ceil(remaining) + "s";
      $("arcadeProgress").style.width = progress + "%";
      $("arcadeCondition").textContent = Math.round(tour.condition);
      hud.classList.toggle("cash-hit", tour.cash > lastCash);
      lastCash = tour.cash;
    },
  };
}
