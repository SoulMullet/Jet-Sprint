// Dynamically imported in development only; this module is absent from dist.
export function mountCampaignDebug({
  campaign,
  world,
  scenery,
  race,
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
  const readout = document.createElement("pre");
  readout.id = "campaignDiagnosticReadout";
  for (const [stage, label] of [
    ["river", "Practice: bonus river"],
    ["track2", "Practice: Track 2"],
  ]) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = stage === "river" ? "devRiver" : "devTrack2";
    b.textContent = label;
    b.onclick = () => jump(stage);
    root.append(b);
  }
  root.append(readout);
  const note = document.createElement("p");
  note.textContent =
    "Practice shortcuts relocate the boat and do not unlock campaign progress. Normal play has no teleport.";
  root.append(note);
  parent.prepend(root);
  const inspect = () => ({
    ...campaign.inspect(),
    laps: race.laps.length,
    lapTarget: race.lapCount,
    raceTime: race.total,
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
