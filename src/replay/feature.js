import { ReplayRepository } from "./storage.js";
import { ReplaySettings, replayDefaults } from "./settings.js";
import { ReplaySession } from "./session.js";
import {
  ReplayPlayer,
  decodeReplay,
  compatibility,
  REPLAY_LIMITS,
} from "./model.js";
import { recordKey, tuneIdentifier } from "./course-data.js";
import { GhostVisual, ReplayCameras, suspendVisuals } from "./visual.js";
import { TelemetryGraph, telemetryCSV } from "./telemetry.js";
import { format } from "../race.js";
import {
  instrumentRange,
  updateRange,
  confirmDialog,
} from "../ui-components.js";

const download = (name, text, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function createReplayFeature({
  world,
  scene,
  boat,
  cameraSettings,
  obstruction,
  getTuning,
  build,
  root,
  storage,
  onViewerChange,
  onOpenLab,
  exportFoundation,
  onPrime,
  transientVisuals = [],
}) {
  const preferences = new ReplaySettings(storage),
    repository = new ReplayRepository(),
    session = new ReplaySession({
      world,
      repository,
      preferences,
      getTuning,
      build,
    }),
    visual = new GhostVisual(scene, boat),
    cameras = new ReplayCameras(world, cameraSettings, obstruction);
  const $ = (id) => document.getElementById(id);
  root.innerHTML = `<summary>Ghost & Replay Lab</summary><p class="lab-intro">Recorded world poses / original official timing. Ghosts have no physics, wake or prize influence. Records are separated by course revision and force tune.</p><div class="replay-options"><label><input id="replayRecording" type="checkbox"> Record river runs and archived races</label><label>Ghost mode<select id="ghostMode"><option value="personal-best">Personal Best</option><option value="previous">Previous Run</option><option value="selected">Selected Saved Replay</option><option value="disabled">Ghost Disabled</option></select></label><label>Ghost opacity<output></output><input id="ghostOpacity" type="range" min="0.08" max="0.85" step="0.01"></label><label>Ghost color<input id="ghostColor" type="color"></label><label>Sample interval / next event<output></output><input id="replayInterval" type="range" min="0.05" max="0.1" step="0.005"></label></div><button id="resetReplaySettings">Reset ghost settings</button><p id="ghostStatus" role="status"></p><output id="replayDiagnostics" class="replay-diagnostics"></output><details class="settings-section" open><summary>Replay library / this device</summary><label>Recording<select id="savedReplay"><option value="">No completed recordings yet</option></select></label><div class="replay-actions"><button id="saveReplay">Save Replay</button><button id="loadReplay">Load Replay / Viewer</button><button id="useReplayGhost">Use selected ghost</button><button id="exportReplay">Export Replay</button><button id="importReplay">Import Replay</button><button id="deleteReplay">Delete Replay</button></div><input id="replayFile" type="file" accept=".json,application/json" hidden><p id="replayStorageStatus" role="status"></p></details><details class="settings-section" open><summary>Personal records / current force tune</summary><div id="replayRecords"></div></details><details id="telemetryLab" class="settings-section"><summary>Telemetry Lab / recorded vs personal best</summary><div id="labTelemetryGraph"></div><button id="exportTelemetry">Export telemetry CSV</button><p>Snapshots include speed, inputs, slip, heading, world angular velocity, ordered progress and the original lap/checkpoint events.</p></details><details class="settings-section"><summary>Development / portable data</summary><button id="clearTestReplays">Clear unprotected test recordings</button><button id="exportFoundation">Export Unreal-ready game data</button><p>Saved and personal-best history is protected. Import does not award records or prizes. Record interval changes apply to the next event.</p></details>`;
  const viewer = document.createElement("dialog");
  viewer.id = "replayViewer";
  viewer.className = "ui-dialog replay-viewer";
  viewer.setAttribute("aria-labelledby", "replayTitle");
  viewer.innerHTML = `<header class="replay-heading"><div><span class="instrument-label">JET SPRINT / TAPE DECK</span><h2 id="replayTitle">RACE REPLAY</h2><p id="replayOriginalTimes"></p></div><button id="closeReplay" aria-label="Close replay and return to the game" data-confirm="false">RETURN</button></header><section id="viewerTelemetry" class="replay-telemetry" hidden></section><section class="replay-transport"><div class="replay-transport-row"><button id="replayPlay">PLAY</button><button id="replayRestart">REWIND</button><label>Speed<select id="replaySpeed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Camera<select id="replayCamera"><option value="fixed">Fixed course</option><option value="follow">Elevated follow</option></select></label><label><input id="replayTelemetry" type="checkbox"> Telemetry</label></div><label class="replay-timeline-label">RECORDED TIMELINE<output id="replayTime"></output><input id="replayTimeline" type="range" min="0" max="1" step="0.01" value="0" aria-label="Replay timeline in seconds"></label><output id="replayPoseReadout"></output></section>`;
  document.body.append(viewer);
  const labGraph = new TelemetryGraph(
      $("labTelemetryGraph"),
      "labTelemetryMetric",
    ),
    viewerGraph = new TelemetryGraph(
      $("viewerTelemetry"),
      "viewerTelemetryMetric",
    );
  const delta = document.createElement("aside");
  delta.id = "ghostDelta";
  delta.hidden = true;
  delta.setAttribute("aria-label", "Time difference to recorded ghost");
  delta.innerHTML = "<span>GHOST / DELTA</span><strong>—</strong>";
  document.body.append(delta);
  const celebration = document.createElement("aside");
  celebration.id = "courseRecordCelebration";
  celebration.hidden = true;
  celebration.setAttribute("role", "status");
  celebration.innerHTML =
    "<span>OFFICIAL / PERSONAL BEST</span><strong>NEW COURSE RECORD</strong><output></output>";
  document.body.append(celebration);
  const menu = document.createElement("button");
  menu.id = "openReplayLibrary";
  menu.textContent = "REPLAYS / PERSONAL RECORDS";
  menu.onclick = onOpenLab;
  $("start").after(menu);
  const results = document.createElement("button");
  results.id = "resultsReplay";
  results.textContent = "WATCH RACE REPLAY";
  results.onclick = () => {
    if (session.lastRaceReplay || session.lastCompleted)
      openViewer(session.lastRaceReplay || session.lastCompleted);
    else onOpenLab();
  };
  $("continueJourney").before(results);
  let restoreEffects = null;
  let viewerFrame = null,
    viewerFrameKey = "",
    player = null,
    comparison = null,
    comparisonKey = "",
    librarySignature = "",
    clock = 0,
    celebrationAge = 0,
    celebrationId = "",
    viewerActive = false,
    viewPose = null,
    viewTour = null,
    previousBoatVisible = true,
    compatibilityStatus = "No replay selected";
  const ranges = [
    ["ghostOpacity", "opacity", "×"],
    ["replayInterval", "interval", " s"],
  ];
  for (const [id, key, unit] of ranges) {
    const input = $(id);
    input.oninput = () => preferences.set(key, Number(input.value));
    instrumentRange(input, {
      name: key === "opacity" ? "Ghost opacity" : "Recording interval",
      defaultValue: replayDefaults[key],
      reset: () => preferences.set(key, replayDefaults[key]),
    });
  }
  $("replayRecording").onchange = (e) =>
    preferences.set("enabled", e.target.checked);
  $("ghostMode").onchange = (e) => preferences.set("mode", e.target.value);
  $("ghostColor").oninput = (e) => preferences.set("color", e.target.value);
  $("resetReplaySettings").onclick = () => preferences.reset();
  function preferenceUI() {
    for (const [id, key, unit] of ranges) {
      $(id).value = preferences.values[key];
      $(id).closest("label").querySelector("output").textContent =
        preferences.values[key] + unit;
      updateRange($(id));
    }
    $("replayRecording").checked = preferences.values.enabled;
    $("ghostMode").value = preferences.values.mode;
    $("ghostColor").value = preferences.values.color;
    $("replayTelemetry").checked = preferences.values.telemetry;
    $("viewerTelemetry").hidden = !preferences.values.telemetry;
  }
  preferences.subscribe(preferenceUI);
  preferenceUI();
  async function action(fn) {
    try {
      await fn();
      await session.refresh();
    } catch (e) {
      session.status = e.message;
      session.emit();
    }
  }
  async function selected() {
    const id = $("savedReplay").value;
    if (!id) throw Error("Select a completed replay.");
    return repository.get(id);
  }
  const expectedCourse = (r) =>
    [...session.courses, ...session.rivers, ...session.legacyRivers].find(
      (c) =>
        c.kind === r.meta.course.kind &&
        c.id === r.meta.course.id &&
        c.index === r.meta.course.index,
    );
  function match(r) {
    const c = expectedCourse(r);
    return c
      ? compatibility(r, c, { tuneId: tuneIdentifier(getTuning()) })
      : { ok: false, reasons: ["Course is not present in this build."] };
  }
  async function checkSelection() {
    try {
      const r = await selected(),
        m = match(r);
      compatibilityStatus = m.ok
        ? m.warning || "Course revision compatible"
        : m.reasons.join(" ");
    } catch (e) {
      compatibilityStatus = e.message;
    }
    session.emit();
  }
  $("savedReplay").onchange = () => {
    preferences.set("selectedId", $("savedReplay").value);
    checkSelection();
  };
  $("saveReplay").onclick = () => {
    if (session.lastCompleted)
      session.saveCompleted(session.lastCompleted, true);
    else
      action(() => {
        throw Error("Finish a river run or archived race first.");
      });
  };
  $("loadReplay").onclick = () =>
    action(async () => openViewer(await selected()));
  $("useReplayGhost").onclick = () =>
    action(async () => {
      const r = await selected(),
        m = match(r);
      if (!m.ok) throw Error(m.reasons.join(" "));
      preferences.set("selectedId", r.meta.id);
      preferences.set("mode", "selected");
    });
  $("exportReplay").onclick = () =>
    action(async () => {
      const r = $("savedReplay").value
        ? await selected()
        : session.lastCompleted;
      if (!r) throw Error("Finish or load a replay first.");
      download(
        r.meta.course.id + "-" + r.meta.id + ".jet-sprint.json",
        JSON.stringify(r),
      );
    });
  const exportLatest = document.createElement("button");
  exportLatest.id = "exportLatestReplay";
  exportLatest.textContent = "Export latest run";
  exportLatest.onclick = () => {
    const r = session.lastCompleted;
    if (r)
      download(r.meta.course.id + "-latest.jet-sprint.json", JSON.stringify(r));
  };
  $("exportReplay").after(exportLatest);
  $("importReplay").onclick = () => $("replayFile").click();
  $("replayFile").onchange = () =>
    action(async () => {
      const file = $("replayFile").files[0];
      if (!file) return;
      if (file.size > REPLAY_LIMITS.bytes) throw Error("Replay exceeds 8 MB.");
      const replay = decodeReplay(await file.text());
      await repository.commit(replay, { imported: true, pinned: true });
      preferences.set("selectedId", replay.meta.id);
      compatibilityStatus = match(replay).ok
        ? "Imported / course compatible"
        : "Imported / incompatible course (export/delete remains available)";
      $("replayFile").value = "";
    });
  $("deleteReplay").onclick = () =>
    action(async () => {
      const id = $("savedReplay").value;
      if (!id) throw Error("Select a replay.");
      if (
        await confirmDialog(
          "Delete this replay file? Any original personal-best times remain, but its ghost will be unavailable. Export a backup first.",
        )
      ) {
        await repository.remove(id, true);
        if (preferences.values.selectedId === id)
          preferences.set("selectedId", "");
        await session.selectGhost();
      }
    });
  $("clearTestReplays").onclick = () =>
    action(async () => {
      const result = await repository.clearTests();
      session.status = `Cleared ${result.removed.length} unprotected practice recordings.`;
    });
  $("exportFoundation").onclick = () =>
    download(
      "jet-sprint-foundation-v1.json",
      JSON.stringify(exportFoundation(preferences.values), null, 2),
    );
  $("exportTelemetry").onclick = () => {
    const r =
      player?.replay ||
      session.lastCompleted ||
      (session.recorder ? { samples: session.recorder.samples } : null);
    if (r) download("jet-sprint-telemetry.csv", telemetryCSV(r), "text/csv");
    else {
      session.status = "Record a run before exporting telemetry.";
      session.emit();
    }
  };
  function closeViewer() {
    if (!viewerActive) return;
    viewerActive = false;
    player.playing = false;
    viewer.close();
    document.body.classList.remove("replay-open");
    boat.visible = previousBoatVisible;
    restoreEffects?.();
    restoreEffects = null;
    visual.model.visible = false;
    onViewerChange(false);
  }
  function openViewer(replay) {
    const m = match(replay);
    if (!m.ok) throw Error(m.reasons.join(" "));
    if (viewerActive) closeViewer();
    viewerFrame = null;
    viewerFrameKey = "";
    player = new ReplayPlayer(replay);
    player.restart();
    cameras.load(replay);
    viewPose = player.sample();
    const c = replay.meta.course;
    viewTour = {
      index: c.index,
      phase: c.kind === "river" ? "RIVER" : "RACE",
      venue: world.courses[c.index],
      leaves: world.legs.map((_, i) => ({
        phase: i === c.index && c.kind === "river" ? "RIVER" : "RACE",
        gateOpen: i === c.index && c.kind === "river" ? 1 : 0,
        checkpoint: 0,
      })),
    };
    restoreEffects = suspendVisuals(transientVisuals);
    previousBoatVisible = boat.visible;
    boat.visible = false;
    viewerActive = true;
    document.body.classList.add("replay-open");
    onViewerChange(true);
    onPrime(viewPose);
    $("replayTitle").textContent = c.name.toUpperCase();
    $("replayOriginalTimes").textContent =
      `ORIGINAL ${format(replay.official.total)}${replay.official.laps.length ? " · LAPS " + replay.official.laps.map(format).join(" / ") : replay.meta.course.id.startsWith("river-run-") ? " · RIVER RUN" : " · RIVER BONUS"}${replay.eligible ? "" : " · PRACTICE / CUSTOM SESSION"}`;
    $("replayTimeline").max = replay.official.total;
    $("replaySpeed").value = "1";
    $("replayCamera").value = cameras.mode;
    $("replayCamera").querySelector('[value="fixed"]').textContent =
      c.kind === "river" ? "Isometric river" : "Fixed course";
    if (!viewer.open) viewer.showModal();
    $("closeReplay").focus();
    loadComparison(replay);
  }
  $("closeReplay").onclick = closeViewer;
  viewer.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeViewer();
  });
  viewer.addEventListener("close", () => {
    if (viewerActive) closeViewer();
  });
  $("replayPlay").onclick = () => {
    if (player.time === player.replay.official.total) player.seek(0);
    player.playing = !player.playing;
  };
  $("replayRestart").onclick = () => {
    player.restart();
    cameras.reset();
    onPrime(player.sample());
  };
  $("replayTimeline").oninput = (e) => {
    player.seek(Number(e.target.value));
    cameras.reset();
    onPrime(player.sample());
  };
  $("replaySpeed").onchange = (e) => player.setSpeed(Number(e.target.value));
  $("replayCamera").onchange = (e) => cameras.setMode(e.target.value);
  $("replayTelemetry").onchange = (e) =>
    preferences.set("telemetry", e.target.checked);
  async function loadComparison(primary) {
    if (!primary?.meta) return;
    const stats = session.records.find(
        (r) => r.key === recordKey(primary.meta),
      ),
      id = stats?.bestReplayId,
      key = primary.meta.id + ":" + id;
    if (key === comparisonKey) return;
    comparisonKey = key;
    comparison = null;
    if (!id) return;
    try {
      const r = await repository.get(id);
      if (comparisonKey === key) comparison = r;
    } catch {
      /* Deleted or unavailable comparison: primary remains playable. */
    }
  }
  function refresh() {
    const signature = session.catalog
      .map((c) => c.id + ":" + c.pinned + ":" + c.wasPersonalBest)
      .join("|");
    if (signature !== librarySignature) {
      librarySignature = signature;
      const old = preferences.values.selectedId || $("savedReplay").value;
      $("savedReplay").replaceChildren();
      if (!session.catalog.length) {
        const o = document.createElement("option");
        o.value = "";
        o.textContent = "No completed recordings yet";
        $("savedReplay").append(o);
      }
      for (const c of [...session.catalog].sort(
        (a, b) => b.savedAt - a.savedAt,
      )) {
        const o = document.createElement("option");
        o.value = c.id;
        o.textContent = `${c.label} · ${format(c.total)}${c.wasPersonalBest ? " · PB ARCHIVE" : ""}${c.pinned ? " · SAVED" : ""}${c.test ? " · PRACTICE" : ""}${c.imported ? " · IMPORT" : ""}`;
        $("savedReplay").append(o);
      }
      if (session.catalog.some((c) => c.id === old))
        $("savedReplay").value = old;
      else if (session.catalog.length)
        preferences.set("selectedId", $("savedReplay").value);
    }
    $("saveReplay").disabled = $("exportLatestReplay").disabled =
      !session.lastCompleted;
    $("loadReplay").disabled =
      $("useReplayGhost").disabled =
      $("deleteReplay").disabled =
        !session.catalog.length;
    $("exportReplay").disabled =
      !session.catalog.length && !session.lastCompleted;
    $("resultsReplay").disabled =
      !session.lastRaceReplay && !session.lastCompleted;
    $("ghostStatus").textContent = session.ghostStatus;
    $("replayStorageStatus").textContent = [
      session.status,
      preferences.warning,
      compatibilityStatus,
    ]
      .filter(Boolean)
      .join(" · ");
    const key = tuneIdentifier(getTuning()),
      records = $("replayRecords");
    records.replaceChildren();
    for (const c of [...session.courses, ...session.rivers].sort(
      (a, b) => a.index - b.index || a.kind.localeCompare(b.kind),
    )) {
      const stats = session.records.find(
          (r) => r.key === recordKey({ course: c, tuneId: key }),
        ),
        row = document.createElement("p");
      row.textContent = `${c.name} / ${stats ? format(stats.bestTotal) + (stats.bestLap ? " · LAP " + format(stats.bestLap) : " · BEST RIVER") + " · RECENT " + format(stats.recentTotal) : "NO OFFICIAL RECORD"}`;
      records.append(row);
      if (stats) {
        const details = document.createElement("details"),
          summary = document.createElement("summary"),
          list = document.createElement("ol");
        summary.textContent =
          "Best cumulative checkpoint splits / " + stats.bestSplits.length;
        for (const split of stats.bestSplits) {
          const item = document.createElement("li");
          item.textContent =
            (c.kind === "race" ? "LAP " + split.lap + " / " : "") +
            "GATE " +
            split.checkpoint +
            " · " +
            format(split.t);
          list.append(item);
        }
        details.append(summary, list);
        records.append(details);
      }
    }
    const latest = session.savedResult;
    if (latest?.record && latest.id !== celebrationId && !repository.warning) {
      celebrationId = latest.id;
      celebrationAge = 5;
      celebration.querySelector("strong").textContent = latest.firstRecord
        ? "COURSE RECORD SET"
        : "NEW COURSE RECORD";
      celebration.querySelector("output").textContent =
        `${latest.course.name.toUpperCase()} / ${format(latest.time)}`;
    }
  }
  session.subscribe(refresh);
  refresh();
  return {
    session,
    preferences,
    repository,
    visual,
    viewer,
    cameras,
    get active() {
      return viewerActive;
    },
    get renderBoat() {
      return viewPose;
    },
    get renderTour() {
      return viewTour;
    },
    beforeStep: (...args) => session.beforeStep(...args),
    afterStep: (...args) => session.afterStep(...args),
    reset() {
      closeViewer();
      session.reset();
    },
    noteTuneChange() {
      session.noteTuneChange();
    },
    close: closeViewer,
    openViewer,
    update(dt, tour, { playing, paused, hidden, width, height }) {
      if (!hidden && viewerActive) {
        viewPose = player.advance(dt);
        viewPose.angle = viewPose.heading;
        const leaf = viewTour.leaves[viewTour.index];
        if (leaf) leaf.checkpoint = viewPose.checkpoint;
        visual.update(viewPose, preferences.values, true);
        $("replayTimeline").value = player.time;
        $("replayPlay").textContent = player.playing ? "PAUSE" : "PLAY";
        $("replayTime").textContent =
          `${format(player.time)} / ${format(player.replay.official.total)}`;
        $("replayPoseReadout").textContent =
          `${Math.round(viewPose.speed * 3.6)} KM/H · THR ${Math.round(viewPose.throttle * 100)}% · STEER ${Math.round(viewPose.steering * 100)}% · ${viewPose.slip.toFixed(2)} RAD SLIP`;
      } else if (!viewerActive) {
        const showing =
          playing &&
          !tour.done &&
          session.activeCourse &&
          ["RACE", "RIVER"].includes(tour.phase) &&
          session.activeCourse.index === tour.index &&
          session.activeCourse.kind ===
            (tour.phase === "RIVER" ? "river" : "race");
        visual.update(
          showing ? session.ghostAt(session.liveTime) : null,
          preferences.values,
        );
      }
      clock += dt;
      if (clock > 0.25) {
        clock = 0;
        const info = session.inspect();
        $("replayDiagnostics").textContent =
          `${info.recording ? "REC" : "IDLE"} · ${info.snapshots.toLocaleString()} snapshots · ${info.sampleInterval.toFixed(3)} s / ${Math.round(1 / info.sampleInterval)} Hz · Last file ${(info.bytes / 1048576).toFixed(2)} MB · ${info.stored}/32 stored · ${compatibilityStatus}`;
        const d =
          !viewerActive &&
          playing &&
          !tour.done &&
          ["RACE", "RIVER"].includes(tour.phase)
            ? session.delta()
            : null;
        delta.hidden = d === null;
        delta.classList.toggle("ahead", d !== null && d < 0);
        delta.querySelector("strong").textContent =
          d === null
            ? "—"
            : `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(2)} s`;
        const primary = viewerActive
          ? player.replay
          : session.recorder
            ? {
                meta: session.recorder.meta,
                samples: session.recorder.samples,
                official: { total: session.liveTime },
              }
            : session.lastCompleted;
        if (primary) {
          loadComparison(primary);
          if (
            !viewerActive &&
            !$("pitConsole").hidden &&
            !root.hidden &&
            $("telemetryLab").open
          )
            labGraph.update(
              primary,
              comparison,
              viewerActive
                ? player.time
                : session.recorder
                  ? session.liveTime
                  : primary.official.total,
              !!session.recorder && !viewerActive,
            );
          if (viewerActive && preferences.values.telemetry)
            viewerGraph.update(primary, comparison, player.time);
        }
      }
      if (!paused && !hidden && !viewerActive)
        celebrationAge = Math.max(0, celebrationAge - dt);
      celebration.hidden = celebrationAge <= 0 || viewerActive || !playing;
      if (viewerActive) {
        const key = width + ":" + height;
        if (viewerFrameKey !== key) {
          viewerFrameKey = key;
          const top = viewer
              .querySelector(".replay-heading")
              .getBoundingClientRect(),
            bottom = viewer
              .querySelector(".replay-transport")
              .getBoundingClientRect();
          viewerFrame = {
            left: 14,
            top: top.bottom + 8,
            right: width - 14,
            bottom: Math.max(top.bottom + 70, bottom.top - 8),
          };
        }
        return cameras.update(
          viewPose,
          visual.model,
          dt,
          width,
          height,
          viewerFrame,
        );
      }
      return null;
    },
    inspect() {
      return {
        ...session.inspect(),
        viewer: viewerActive
          ? {
              time: player.time,
              speed: player.speed,
              playing: player.playing,
              camera: cameras.mode,
              pose: { ...viewPose },
              id: player.replay.meta.id,
            }
          : null,
      };
    },
  };
}
