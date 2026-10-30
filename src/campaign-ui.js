import { format } from "./race.js";
import { track1, track2, river1 } from "./campaign-data.js";
export function mountCampaignUI(campaign, progress, world, showResults) {
  const root = document.createElement("aside");
  root.id = "journeyHUD";
  root.hidden = true;
  root.innerHTML =
    '<span class="instrument-label" id="journeyStage"></span><strong id="journeyTitle"></strong><p id="journeyDetail"></p><output id="journeyScore"></output><button id="journeyResults" type="button">Race results</button>';
  document.body.append(root);
  const $ = (id) => document.getElementById(id),
    stage = $("journeyStage"),
    title = $("journeyTitle"),
    detail = $("journeyDetail"),
    score = $("journeyScore"),
    results = $("journeyResults");
  results.onclick = showResults;
  const map = document.querySelector(".entry-course svg"),
    xs = world.race.points.map((p) => p.x),
    zs = world.race.points.map((p) => p.z),
    minX = Math.min(...xs),
    minZ = Math.min(...zs),
    scale = Math.min(
      210 / (Math.max(...xs) - minX),
      112 / (Math.max(...zs) - minZ),
    );
  const d =
    world.race.points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${15 + (p.x - minX) * scale},${14 + (p.z - minZ) * scale}`,
      )
      .join(" ") + "Z";
  for (const path of map.querySelectorAll(".map-bank,.map-water"))
    path.setAttribute("d", d);
  const s = world.race.points[0];
  map
    .querySelector(".map-start")
    .setAttribute(
      "d",
      `M${10 + (s.x - minX) * scale},${14 + (s.z - minZ) * scale}l12 0`,
    );
  let clock = 1;
  return {
    update(dt, result) {
      clock += dt;
      if (clock < 0.1) return;
      clock = 0;
      root.hidden =
        campaign.phase === "RACE" ||
        !document.body.classList.contains("racing");
      document.body.classList.toggle("journey-active", !root.hidden);
      results.hidden = !result;
      if (campaign.phase === "EXIT") {
        stage.textContent = "THREE LAPS / COMPLETE";
        title.textContent =
          campaign.gateState === "open" ? "RIVER EXIT OPEN" : "GATE OPENING";
        detail.textContent = "Keep driving. Follow the navigator.";
        score.textContent = format(result?.total ?? 0);
      }
      if (campaign.phase === "RIVER") {
        stage.textContent = "BONUS 01 / UPSTREAM";
        title.textContent = "WILLOW RUN";
        detail.textContent = `Gates ${campaign.checkpoint}/${world.checkpoints.length} · ${format(campaign.elapsed)}`;
        score.textContent = `${campaign.score} PTS`;
      }
      if (campaign.phase === "ARRIVED") {
        stage.textContent = "TRACK 02 / ARRIVAL";
        title.textContent = "MĀTAI BASIN";
        detail.textContent = "Preview basin · Free cruise";
        score.textContent = `${campaign.score} BONUS PTS`;
      }
      const name =
        campaign.phase === "RIVER"
          ? river1.name
          : campaign.phase === "ARRIVED"
            ? track2.name
            : track1.name;
      document.querySelector(".course-name b").textContent = name.toUpperCase();
      document.querySelector(".course-index").textContent =
        campaign.phase === "RIVER"
          ? "R1"
          : campaign.phase === "ARRIVED"
            ? "02"
            : "01";
      if (progress.warning) detail.textContent = progress.warning;
    },
  };
}
