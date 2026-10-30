import { format } from "./race.js";
import { money } from "./campaign-rewards.js";
export function mountCampaignUI(
  campaign,
  progress,
  world,
  showResults,
  prepareVenue = () => {},
) {
  const root = document.createElement("aside");
  root.id = "journeyHUD";
  root.hidden = true;
  root.innerHTML =
    '<span class="instrument-label" id="journeyStage"></span><strong id="journeyTitle"></strong><p id="journeyDetail"></p><output id="journeyScore"></output><small id="journeyNext"></small><button id="journeyResults" type="button">Race results</button><button id="retryCampaignSave" type="button" hidden>Retry wallet save</button>';
  document.body.append(root);
  const $ = (id) => document.getElementById(id),
    stage = $("journeyStage"),
    title = $("journeyTitle"),
    detail = $("journeyDetail"),
    score = $("journeyScore"),
    next = $("journeyNext"),
    results = $("journeyResults");
  results.onclick = showResults;
  $("retryCampaignSave").onclick = () => progress.retry();
  const summary = document.createElement("p");
  summary.id = "campaignSummary";
  summary.className = "campaign-summary";
  document.querySelector(".entry-specs").after(summary);
  const startLabel = document.createElement("label");
  startLabel.className = "campaign-start-label";
  startLabel.textContent = "NEW RUN / UNLOCKED VENUE";
  const choose = document.createElement("select");
  choose.id = "campaignStart";
  choose.setAttribute("aria-label", "Starting venue for a new run");
  startLabel.append(choose);
  summary.after(startLabel);
  const record = document.createElement("details");
  record.id = "campaignRecord";
  record.className = "settings-section";
  const caption = document.createElement("summary");
  caption.textContent = "Series record / wallet";
  record.append(caption);
  const totals = document.createElement("p");
  record.append(totals);
  const table = document.createElement("table");
  table.className = "campaign-record-table";
  table.innerHTML =
    "<thead><tr><th>EVENT</th><th>BEST</th><th>CLEAN BONUS</th></tr></thead><tbody></tbody>";
  record.append(table);
  document.getElementById("debug").append(record);
  let recordSignature = "";
  let unlocked = 0;
  choose.onchange = () => prepareVenue(Number(choose.value) || 0);
  const map = document.querySelector(".entry-course svg"),
    xs = world.courses[0].points.map((p) => p.x),
    zs = world.courses[0].points.map((p) => p.z),
    minX = Math.min(...xs),
    minZ = Math.min(...zs),
    scale = Math.min(
      210 / (Math.max(...xs) - minX),
      112 / (Math.max(...zs) - minZ),
    );
  const d =
    world.courses[0].points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${15 + (p.x - minX) * scale},${14 + (p.z - minZ) * scale}`,
      )
      .join(" ") + "Z";
  for (const p of map.querySelectorAll(".map-bank,.map-water"))
    p.setAttribute("d", d);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  motion.addEventListener?.("change", (e) => {
    reduced = e.matches;
  });
  let clock = 1,
    seen = -1,
    rewardUntil = 0,
    age = 0,
    displayWallet = progress.values.wallet;
  return {
    update(dt, result, force = false) {
      age += dt;
      displayWallet +=
        (progress.values.wallet - displayWallet) *
        (reduced ? 1 : 1 - Math.exp(-dt * 7));
      clock += dt;
      if (clock < 0.1 && !force) return;
      clock = 0;
      root.hidden = !document.body.classList.contains("racing");
      document.body.classList.toggle("journey-active", !root.hidden);
      root.classList.toggle("championship", campaign.phase === "CHAMPION");
      if (unlocked !== progress.values.unlocked) {
        const selected = choose.value;
        choose.replaceChildren();
        for (let i = 0; i < progress.values.unlocked; i++) {
          const o = document.createElement("option");
          o.value = i;
          o.textContent =
            String(i + 1).padStart(2, "0") +
            " / " +
            world.definition.tracks[i].name;
          choose.append(o);
        }
        choose.value = selected || String(progress.values.unlocked - 1);
        unlocked = progress.values.unlocked;
        if (!document.body.classList.contains("racing"))
          prepareVenue(Number(choose.value) || 0);
      }
      if (record.open) {
        const signature = JSON.stringify(progress.values);
        if (signature !== recordSignature) {
          recordSignature = signature;
          totals.textContent = `Wallet ${money(progress.values.wallet)} · Lifetime earnings ${money(progress.values.lifetimeEarnings)}`;
          const body = table.querySelector("tbody");
          body.replaceChildren();
          for (const event of world.definition.tracks.flatMap((track, i) => [
            track,
            ...(world.definition.rivers[i] ? [world.definition.rivers[i]] : []),
          ])) {
            const e = progress.values.events[event.id],
              row = document.createElement("tr");
            for (const text of [
              event.name,
              e?.bestTime ? format(e.bestTime) : "—",
              e?.cleanBonusClaimed
                ? "BANKED"
                : money(event.cleanPrize) + " available",
            ]) {
              const cell = document.createElement("td");
              cell.textContent = text;
              row.append(cell);
            }
            body.append(row);
          }
        }
      }
      summary.textContent = `WALLET ${money(progress.values.wallet)} · ${Math.min(4, progress.values.unlocked)} / 4 VENUES UNLOCKED`;
      if (seen !== campaign.rewardSerial) {
        seen = campaign.rewardSerial;
        rewardUntil = age + 6;
      }
      const reward =
        age < rewardUntil && campaign.rewardSerial > 0 ? campaign.reward : null;
      root.classList.toggle("reward-active", !!reward);
      stage.textContent = `${campaign.practice ? "PRACTICE / " : ""}STAGE ${campaign.stage} OF 7 · ${campaign.phase === "RIVER" ? "UPSTREAM" : campaign.phase === "STAGING" ? "STAGING" : campaign.phase === "CHAMPION" ? "SERIES COMPLETE" : "TIME TRIAL"}`;
      title.textContent = reward
        ? `${reward.name.toUpperCase()} ${reward.personalBest ? "· PB" : ""}`
        : campaign.event.name.toUpperCase();
      if (reward) {
        detail.textContent = reward.practice
          ? "Practice clear · No prize awarded"
          : reward.pending && progress.warning
            ? "Reward active · SAVE PENDING"
            : `Prize +${money(reward.prize)} · Clean +${money(reward.cleanBonus)}`;
      } else if (campaign.phase === "RIVER") {
        const leg = campaign.leaf.world,
          percent = Math.round(
            (100 * campaign.checkpoint) / leg.checkpoints.length,
          );
        detail.textContent = `${percent}% · Gates ${campaign.checkpoint}/${leg.checkpoints.length} · ${format(campaign.elapsed)}`;
      } else if (campaign.phase === "EXIT")
        detail.textContent = "Race complete · River exit " + campaign.gateState;
      else if (campaign.phase === "STAGING")
        detail.textContent = "Wait for green · Cross the start line";
      else if (campaign.phase === "CHAMPION")
        detail.textContent = "Four tracks + three rivers cleared";
      else
        detail.textContent = `Three laps · ${campaign.eventClean ? "Clean run active" : "Clean bonus missed"}`;
      score.textContent = `WALLET ${money(Math.round(displayWallet))}`;
      next.textContent = reward
        ? `${format(reward.time)} · ${reward.personalBest ? "PERSONAL BEST" : reward.practice ? "PRACTICE" : "EVENT COMPLETE"}`
        : campaign.phase === "RIVER"
          ? `NEXT / ${world.definition.tracks[campaign.index + 1].name}`
          : campaign.river
            ? `NEXT / ${campaign.river.name}`
            : "SERIES FINALE";
      results.hidden = !result;
      results.textContent =
        campaign.phase === "CHAMPION" ? "Championship results" : "Race results";
      $("retryCampaignSave").hidden = !progress.warning;
      if (progress.warning) next.textContent = progress.warning;
      const stream = globalThis.__JET_SPRINT_CAMPAIGN__?.inspect().streaming;
      if (!document.body.classList.contains("racing")) {
        const status = stream?.venues?.[Number(choose.value) || 0] ?? "ready";
        const preparing = status === "preparing";
        $("start").disabled = preparing;
        const text = $("start").firstChild;
        if (text?.nodeType === Node.TEXT_NODE)
          text.textContent = preparing ? "PREPARING VENUE" : "HIT THE WATER";
      }
      if (stream?.warning) next.textContent = stream.warning;
      document.querySelector(".course-name b").textContent =
        campaign.event.name.toUpperCase();
      document.querySelector(".course-index").textContent =
        campaign.phase === "RIVER"
          ? `R${campaign.index + 1}`
          : String(campaign.index + 1).padStart(2, "0");
    },
  };
}
