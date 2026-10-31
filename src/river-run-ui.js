import * as THREE from "three";
import { format } from "./race.js";
import { interfaceFont } from "./typography.js";

export function createRiverRunMarkers(scene, levels) {
  const gold = new THREE.MeshBasicMaterial({ color: "#d9ac46" }),
    cream = new THREE.MeshBasicMaterial({ color: "#e8d9b5" }),
    dark = new THREE.MeshBasicMaterial({ color: "#183237" });
  for (const level of levels)
    for (const [kind, point] of [
      ["START", level.start],
      ["FINISH", level.finish],
    ]) {
      const root = new THREE.Group();
      root.position.set(point.x, 0, point.z);
      root.rotation.y = -Math.atan2(point.tz, point.tx);
      root.name = level.name + " " + kind;
      scene.add(root);
      const width = level.definition.waterWidth;
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.18, 4.5, 6),
          gold,
        );
        pole.position.set(0, 2, side * (width + 0.5));
        root.add(pole);
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 1.2),
          kind === "FINISH" ? cream : gold,
        );
        flag.material = flag.material.clone();
        flag.material.side = THREE.DoubleSide;
        flag.position.set(0.8, 3.5, side * (width + 0.5));
        root.add(flag);
      }
      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#183237";
      ctx.fillRect(0, 0, 384, 96);
      ctx.strokeStyle = "#d9ac46";
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 376, 88);
      ctx.fillStyle = "#e8d9b5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 47px ${interfaceFont}`;
      ctx.fillText(kind, 192, 48);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
      );
      sign.position.set(0, 5, 0);
      sign.scale.set(7, 1.75, 1);
      root.add(sign);
      if (kind === "FINISH")
        for (let j = 0; j < 20; j++) {
          const m = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, (width * 2) / 20),
            j % 2 ? cream : dark,
          );
          m.rotation.x = -Math.PI / 2;
          m.position.set(0, 0.12, -width + ((j + 0.5) * width * 2) / 20);
          root.add(m);
        }
    }
}

export function mountRiverRunUI(
  tour,
  progress,
  levels,
  { showResults, onSelect, onNext, getPlaying, getBoat },
) {
  const $ = (id) => document.getElementById(id),
    root = document.createElement("aside");
  root.id = "journeyHUD";
  root.innerHTML =
    '<span class="instrument-label" id="journeyStage"></span><strong id="journeyTitle"></strong><p id="journeyDetail"></p><output id="journeyScore"></output><small id="journeyNext"></small>';
  document.body.append(root);
  const results = document.createElement("button");
  results.id = "journeyResults";
  results.className = "tool-button";
  results.textContent = "RESULTS";
  results.onclick = showResults;
  document.querySelector(".race-toolbar").append(results);
  const summary = document.createElement("p");
  summary.id = "campaignSummary";
  summary.className = "campaign-summary";
  summary.textContent = "THREE RIVER RUNS / ONE PERSISTENT BOAT";
  document.querySelector(".entry-specs").after(summary);
  const label = document.createElement("label");
  label.className = "campaign-start-label";
  label.textContent = "RIVER LEVEL ";
  const select = document.createElement("select");
  select.id = "campaignStart";
  select.setAttribute("aria-label", "River level");
  for (const l of levels) {
    const o = document.createElement("option");
    o.value = l.index;
    o.textContent = `${String(l.index + 1).padStart(2, "0")} / ${l.name}`;
    o.disabled = !progress.isUnlocked(l);
    select.append(o);
  }
  label.append(select);
  summary.after(label);
  select.onchange = () => onSelect(Number(select.value));
  const retry = document.createElement("button");
  retry.id = "retryRiverRecord";
  retry.textContent = "Retry river record save";
  retry.hidden = true;
  retry.onclick = () => progress.retry();
  root.append(retry);
  const next = document.createElement("button");
  next.id = "nextRiverLevel";
  next.className = "button-primary";
  next.textContent = "NEXT RIVER";
  next.onclick = () => onNext(tour.index + 1);
  $("raceRestart").before(next);
  $("saveScore").hidden = true;
  $("playerName").closest("label").hidden = true;
  $("board").hidden = true;
  $("continueJourney").textContent = "BACK TO THE RIVER";
  $("raceRestart").textContent = "RESTART THIS RIVER";
  $("resultsReplay").textContent = "WATCH RUN REPLAY";
  document.querySelector(".best-instrument .instrument-label").textContent =
    "BEST RUN";
  document.querySelector(".entry-course>span").textContent =
    "RIVER RUSH / EXISTING WATERWAYS";
  document.querySelector(".entry-course>strong").textContent =
    "START TO FINISH";
  document.querySelector(".entry-course>span:last-child").textContent =
    "THREE RIVERS / NO LAPS";
  document.querySelector(".intro-tagline").innerHTML =
    "BIG-BLOCK POWER.<br>OPEN RIVER.";
  document.querySelector(".intro-description").innerHTML =
    "Three winding River Rush levels.<br>Start upstream. Race to the finish.";
  const specs = document.querySelectorAll(".entry-specs>div");
  specs[1].querySelector("b").textContent = "03";
  specs[1].querySelector("span").textContent = "RIVER LEVELS";
  let clock = 1,
    lastIndex = -1;
  const projection = {};
  function map(level) {
    const points = level.route.points,
      xs = points.map((p) => p.x),
      zs = points.map((p) => p.z),
      minX = Math.min(...xs),
      minZ = Math.min(...zs),
      scale = Math.min(
        210 / (Math.max(...xs) - minX),
        112 / (Math.max(...zs) - minZ),
      ),
      d = points
        .map(
          (p, i) =>
            `${i ? "L" : "M"}${15 + (p.x - minX) * scale},${14 + (p.z - minZ) * scale}`,
        )
        .join(" ");
    for (const p of document.querySelectorAll(
      ".entry-course .map-bank,.entry-course .map-water",
    ))
      p.setAttribute("d", d);
  }
  return {
    finish(result) {
      const best = progress.best(tour.level.id);
      $("resultTitle").textContent = "RIVER COMPLETE";
      document.querySelector(".finish-strap").textContent =
        tour.level.name.toUpperCase() + " / POINT TO POINT";
      document.querySelector("#results .eyebrow").textContent = "FINISH LINE";
      $("resultStats").replaceChildren();
      for (const text of [
        `COMPLETION ${format(result.total)}`,
        `PERSONAL BEST ${best === null ? "—" : format(best)}`,
        tour.practice
          ? "PRACTICE / NO RECORD SAVED"
          : tour.reward?.personalBest
            ? "NEW LEVEL BEST"
            : "RUN COMPLETE",
        `${tour.checkpoint}/${tour.level.checkpoints.length} ordered checkpoints`,
      ]) {
        const p = document.createElement("p");
        p.textContent = text;
        $("resultStats").append(p);
      }
      if (tour.reward?.valid) {
        const p = document.createElement("p");
        p.textContent = `PRIZE $${tour.reward.total} / CASH $${tour.reward.wallet}`;
        $("resultStats").append(p);
        const breakdown = document.createElement("p");
        breakdown.textContent = `Finish $${tour.reward.prize} · First clear $${tour.reward.firstClear} · Improved time $${tour.reward.improvement} · Clean $${tour.reward.cleanBonus}`;
        $("resultStats").append(breakdown);
      } else if (tour.reward?.reason) {
        const p = document.createElement("p");
        p.textContent = tour.reward.reason;
        $("resultStats").append(p);
      }
      next.hidden =
        tour.index + 1 >= levels.length ||
        !progress.isUnlocked(levels[tour.index + 1]);
      $("results").hidden = false;
      $("continueJourney").focus();
    },
    update(dt, result, force = false) {
      clock += dt;
      if (clock < 0.1 && !force) return;
      clock = 0;
      for (const l of levels)
        select.options[l.index].disabled = !progress.isUnlocked(l);
      root.hidden = !getPlaying();
      document.body.classList.toggle("journey-active", !root.hidden);
      results.hidden = !result;
      retry.hidden = !progress.warning;
      const level = tour.level,
        last = level.finish.distance,
        start = level.startDistance;
      const previous = tour.checkpoint
          ? level.checkpoints[tour.checkpoint - 1].distance
          : start,
        nextDistance =
          level.checkpoints[
            Math.min(tour.checkpoint, level.checkpoints.length - 1)
          ].distance,
        b = getBoat?.(),
        distance = b
          ? Math.max(
              previous,
              Math.min(
                nextDistance,
                level.route.project(
                  b,
                  Math.max(0, previous - 8),
                  nextDistance + 5,
                  projection,
                ).distance,
              ),
            )
          : previous,
        percent = tour.done
          ? 100
          : Math.max(
              0,
              Math.min(
                99,
                Math.round((100 * (distance - start)) / (last - start)),
              ),
            );
      $("journeyStage").textContent =
        `${tour.practice ? "PRACTICE / " : ""}RIVER RUN ${tour.index + 1} OF ${levels.length}`;
      $("journeyTitle").textContent = level.name.toUpperCase();
      $("journeyDetail").textContent = tour.done
        ? "FINISH / CLOCK STOPPED"
        : `CHECKPOINT ${Math.min(tour.checkpoint + 1, level.checkpoints.length)} / ${level.checkpoints.length}`;
      $("journeyScore").textContent = `${percent}% TO FINISH`;
      $("journeyNext").textContent =
        progress.warning ||
        `BEST ${progress.best(level.id) === null ? "—" : format(progress.best(level.id))}`;
      document.querySelector(".course-name b").textContent =
        level.name.toUpperCase();
      document.querySelector(".course-index").textContent = String(
        tour.index + 1,
      ).padStart(2, "0");
      if (lastIndex !== tour.index) {
        lastIndex = tour.index;
        select.value = String(tour.index);
        map(level);
      }
    },
  };
}
