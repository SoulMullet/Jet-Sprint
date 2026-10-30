import { campaignEvents } from "./campaign-data.js";
// Dynamically imported only in development; absent from production.
export function mountCampaignDebug({
  campaign,
  world,
  scenery,
  getRace,
  startSequence,
  getBoat,
  getPlaying,
  getResult,
  getFPS,
  parent,
  jump,
}) {
  const root = document.createElement("details");
  root.id = "campaignDiagnostics";
  root.className = "settings-section";
  const summary = document.createElement("summary");
  summary.textContent = "Campaign diagnostics / DEV";
  root.append(summary);
  const label = document.createElement("label");
  label.textContent = "Practice event ";
  const select = document.createElement("select");
  select.id = "devCampaignStage";
  campaignEvents.forEach((e, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = `${i + 1}. ${e.name}`;
    select.append(o);
  });
  label.append(select);
  root.append(label);
  const b = document.createElement("button");
  b.id = "devCampaignJump";
  b.textContent = "Practice selected event";
  b.onclick = () => jump(select.value);
  root.append(b);
  for (const [stage, id, text] of [
    [1, "devRiver", "Practice: River Rush 1"],
    [2, "devTrack2", "Practice: Timberline"],
  ]) {
    const button = document.createElement("button");
    button.id = id;
    button.textContent = text;
    button.onclick = () => jump(stage);
    root.append(button);
  }
  const readout = document.createElement("pre");
  readout.id = "campaignDiagnosticReadout";
  root.append(readout);
  const note = document.createElement("p");
  note.textContent =
    "Practice relocates only for testing. No payouts, unlocks or clean achievements. Normal campaign transitions never relocate the boat.";
  root.append(note);
  parent.prepend(root);
  const inspect = () => ({
    ...campaign.inspect(),
    laps: getRace().laps.length,
    lapTarget: getRace().lapCount,
    raceTime: getRace().total,
    raceState: startSequence.state,
    playing: getPlaying(),
    boat: { ...getBoat() },
    streaming: scenery.inspect(),
    fps: getFPS?.() || "warming up",
    result: getResult(),
  });
  const timer = setInterval(() => {
    if (root.open) readout.textContent = JSON.stringify(inspect(), null, 2);
  }, 250);
  window.addEventListener("pagehide", () => clearInterval(timer), {
    once: true,
  });
  globalThis.__JET_SPRINT_DEV__ = Object.freeze({ inspect, jump });
}
