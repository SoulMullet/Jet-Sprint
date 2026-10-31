import {
  RaceRecorder,
  SAMPLE_FIELDS,
  S,
  compatibility,
  sampleReplay,
  rowPose,
  buildProgressIndex,
  timeAtProgress,
} from "./model.js";
import {
  courseDescriptor,
  createReplayMeta,
  tuneIdentifier,
  recordKey,
  captureRow,
  orderedProgress,
} from "./course-data.js";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
/** Observes the existing official race; never writes boat, race or campaign state. */
export class ReplaySession {
  constructor({ world, repository, preferences, getTuning, build }) {
    Object.assign(this, { world, repository, preferences, getTuning, build });
    this.courses = world.courses.map((_, i) => courseDescriptor(world, i));
    this.legacyRivers = world.legs.map((_, i) =>
      courseDescriptor(world, i, "river"),
    );
    this.rivers =
      world.riverRunLevels?.map((l) => l.replayDescriptor) || this.legacyRivers;
    this.listeners = new Set();
    this.pendingSaves = new Set();
    this.catalog = [];
    this.records = [];
    this.status = "Replay storage opening…";
    this.lastCompleted = null;
    this.savedResult = null;
    this.ghost = null;
    this.ghostStatus = "Record a completed run to create a ghost.";
    this.ghostEpoch = 0;
    this.beforeRow = new Array(SAMPLE_FIELDS.length);
    this.row = new Array(SAMPLE_FIELDS.length);
    this.ghostRow = new Array(SAMPLE_FIELDS.length);
    this.ghostPose = {};
    this.projection = {};
    this.before = {};
    this.reset();
    preferences.subscribe((k) => {
      if (k === "enabled" && !preferences.values.enabled && this.recorder) {
        this.recorder = null;
        this.status =
          "Recording disabled; incomplete run discarded. Enable to record the next event.";
      }
      if (["mode", "selectedId"].includes(k)) this.selectGhost();
      this.emit();
    });
    this.ready = this.refresh().catch((e) => {
      this.status = e.message;
      this.emit();
    });
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  async refresh() {
    this.catalog = await this.repository.list();
    this.records = await this.repository.records();
    this.status =
      this.repository.warning || `${this.catalog.length} stored recordings`;
    this.emit();
  }
  reset() {
    this.recorder = null;
    this.activeCourse = null;
    this.sessionId = uid();
    this.mixedTune = false;
    this.liveTime = 0;
    this.liveProgress = 0;
    this.progressValid = false;
    this.ghost = null;
    this.ghostEpoch++;
    this.currentTune = tuneIdentifier(this.getTuning());
  }
  noteTuneChange() {
    const id = tuneIdentifier(this.getTuning());
    if (this.recorder && id !== this.currentTune) this.mixedTune = true;
    this.currentTune = id;
  }
  metadata(course) {
    const meta = createReplayMeta(
      course,
      this.getTuning(),
      this.build,
      this.sessionId,
      uid(),
    );
    if (this.lastCompleted?.meta.sessionId === this.sessionId)
      meta.previousEventId = this.lastCompleted.meta.id;
    return meta;
  }
  begin(course, initial, practice) {
    this.activeCourse = course;
    this.currentTune = tuneIdentifier(this.getTuning());
    this.mixedTune = false;
    this.splits = [];
    this.recorder = null;
    this.activePractice = practice;
    if (this.preferences.values.enabled) {
      this.recorder = new RaceRecorder(
        this.metadata(course),
        this.preferences.values.interval,
      );
      this.recorder.push(0, initial);
      this.recorder.event({
        t: 0,
        type: course.kind === "river" ? "river-start" : "start",
      });
      this.status = "Recording actual world-space trajectory";
    }
    this.selectGhost();
    this.emit();
  }
  beforeStep(tour, b, motion, input, start) {
    Object.assign(this.before, {
      phase: tour.phase,
      index: tour.index,
      race: tour.race,
      leaf: tour.leaf,
      next: tour.race.next,
      laps: tour.race.laps.length,
      checkpoint: tour.checkpoint,
    });
    const active = ["RACE", "RIVER"].includes(tour.phase),
      p = active
        ? orderedProgress(tour, b, this.projection)
        : { progress: 0, valid: false };
    captureRow(
      b,
      motion,
      tour.height,
      tour.leaf?.verticalVelocity || 0,
      p.progress,
      tour.phase === "RIVER" ? 0 : tour.race.laps.length,
      tour.phase === "RIVER" ? tour.checkpoint : tour.race.next,
      input,
      this.beforeRow,
      null,
      1 / 120,
      tour.airborne,
    );
    if (
      active &&
      (!this.activeCourse ||
        this.activeCourse.index !== tour.index ||
        this.activeCourse.kind !== (tour.phase === "RIVER" ? "river" : "race"))
    ) {
      const time = tour.phase === "RIVER" ? tour.elapsed : tour.race.total;
      if (time === 0 && (tour.phase === "RIVER" || start.state === "RACING"))
        this.begin(
          tour.phase === "RIVER"
            ? this.rivers[tour.index]
            : this.courses[tour.index],
          this.beforeRow,
          tour.practice,
        );
    }
  }
  afterStep(tour, b, motion, input, transition, dt) {
    const pre = this.before;
    if (transition === "river-start") {
      this.beforeRow[S.progress] = tour.river.gateDistance;
      this.beforeRow[S.lap] = 0;
      this.beforeRow[S.checkpoint] = 0;
      this.begin(this.rivers[pre.index], this.beforeRow, tour.practice);
    }
    if (transition === "race-start") {
      const p = orderedProgress(tour, b, this.projection);
      captureRow(
        b,
        motion,
        tour.height,
        tour.leaf?.verticalVelocity || 0,
        p.progress,
        0,
        1,
        input,
        this.row,
      );
      this.begin(this.courses[tour.index], this.row, tour.practice);
    }
    const course = this.activeCourse;
    if (!course) return;
    const raceEvent =
        course.kind === "race" &&
        (pre.phase === "RACE" || transition === "race-start"),
      riverEvent =
        course.kind === "river" &&
        (pre.phase === "RIVER" || transition === "river-start");
    if (!raceEvent && !riverEvent) return;
    const clock = raceEvent ? pre.race.total : pre.leaf.elapsed,
      done =
        transition === "race-complete" ||
        transition === "arrival" ||
        transition === "river-complete";
    let progress,
      valid = true,
      lap = 0,
      next = 0;
    if (raceEvent) {
      const p = orderedProgress(tour, b, this.projection);
      progress = p.progress;
      valid = p.valid;
      lap = pre.race.laps.length;
      next = pre.race.next;
    } else {
      const leaf = pre.leaf,
        path = leaf.world.river,
        g =
          leaf.world.checkpoints[
            Math.min(leaf.checkpoint, course.gateCount - 1)
          ],
        previous = leaf.checkpoint
          ? leaf.world.checkpoints[leaf.checkpoint - 1].distance
          : leaf.river.gateDistance,
        p = path.project(
          b,
          Math.max(0, previous - 8),
          g.distance + 10,
          this.projection,
        );
      progress = done
        ? g.distance
        : Math.max(previous, Math.min(g.distance - 1e-5, p.distance));
      valid = p.error < leaf.river.waterWidth + 1;
      next = leaf.checkpoint;
    }
    this.liveTime = clock;
    this.liveProgress = progress;
    this.progressValid = valid;
    const recorder = this.recorder;
    if (!recorder) return;
    captureRow(
      b,
      motion,
      raceEvent ? tour.height : pre.leaf.height,
      raceEvent ? tour.leaf?.verticalVelocity || 0 : pre.leaf.verticalVelocity,
      progress,
      lap,
      next,
      input,
      this.row,
      recorder.previous,
      dt,
      raceEvent ? tour.airborne : pre.leaf.airborne,
    );
    // The official clock can advance across a clamped/stalled render frame.
    // Hold the last actual pose through unsimulated time, then record this step.
    if (recorder.previous && clock - recorder.previous[0] > dt * 1.5)
      recorder.push(clock - dt, recorder.previous);
    recorder.push(clock, this.row);
    if (recorder.reason) {
      this.status = recorder.reason + " Incomplete recording discarded.";
      this.recorder = null;
      this.emit();
      return;
    }
    if (transition === "river-start" || transition === "race-start")
      recorder.event({
        t: 0,
        type: "transition",
        from: pre.phase,
        to: tour.done ? "FINISHED" : tour.phase,
      });
    const accepted = raceEvent
      ? pre.race.next !== pre.next || pre.race.laps.length !== pre.laps
      : pre.leaf.checkpoint !== pre.checkpoint;
    if (accepted) {
      const checkpoint = raceEvent ? pre.next : pre.checkpoint,
        split = {
          t: clock,
          lap: raceEvent ? pre.laps + 1 : 0,
          checkpoint,
          progress: raceEvent
            ? pre.laps * course.length +
              (checkpoint === 0
                ? course.length
                : tour.venue.gates[checkpoint].distance)
            : pre.leaf.world.checkpoints[checkpoint].distance,
        };
      this.splits.push(split);
      recorder.event({ ...split, type: "checkpoint" });
    }
    if (raceEvent && pre.race.laps.length !== pre.laps)
      recorder.event({ t: clock, type: "lap", lap: pre.race.laps.length });
    if (done) {
      recorder.event({
        t: clock,
        type: raceEvent ? "race-complete" : "river-complete",
      });
      recorder.event({
        t: clock,
        type: "transition",
        from: pre.phase,
        to: tour.done ? "FINISHED" : tour.phase,
      });
      const official = {
        total: clock,
        laps: raceEvent ? [...pre.race.laps] : [],
        splits: [...this.splits],
      };
      this.recorder = null;
      try {
        const recording = recorder.finish(official, {
          eligible: !this.activePractice && !this.mixedTune,
          reason: this.activePractice
            ? "Practice run: excluded from official records."
            : this.mixedTune
              ? "Physics tuning changed during this run."
              : "",
        });
        this.lastCompleted = recording;
        if (raceEvent) this.lastRaceReplay = recording;
        this.lastCompletedBytes = new TextEncoder().encode(
          JSON.stringify(recording),
        ).length;
        this.status = "Saving completed replay…";
        this.emit();
        const saving = this.saveCompleted(recording);
        this.pendingSaves.add(saving);
        saving.finally(() => this.pendingSaves.delete(saving));
      } catch (e) {
        this.status = e.message;
        this.emit();
      }
    }
  }
  async saveCompleted(recording, pinned = false) {
    try {
      const result = await this.repository.commit(recording, { pinned });
      this.savedResult = {
        ...result,
        id: recording.meta.id,
        course: recording.meta.course,
        time: recording.official.total,
      };
      await this.refresh();
      this.status = this.repository.warning || "Completed replay saved";
      this.emit();
      return result;
    } catch (e) {
      this.status =
        e.message + " The completed run is still available for export.";
      this.emit();
      return null;
    }
  }
  async flush() {
    await Promise.all([...this.pendingSaves]);
  }
  async selectGhost() {
    const epoch = ++this.ghostEpoch;
    this.ghost = null;
    const course = this.activeCourse;
    if (!course || this.preferences.values.mode === "disabled") {
      this.ghostStatus = "Ghost disabled";
      return;
    }
    this.ghostStatus = "Loading ghost…";
    await this.ready;
    const key = recordKey({ course, tuneId: this.currentTune }),
      stats = this.records.find((r) => r.key === key),
      mode = this.preferences.values.mode,
      id =
        mode === "selected"
          ? this.preferences.values.selectedId
          : mode === "previous"
            ? stats?.previousReplayId
            : stats?.bestReplayId;
    if (!id) {
      this.ghostStatus =
        "No compatible completed ghost for this course/tune yet.";
      this.emit();
      return;
    }
    try {
      const replay = await this.repository.get(id),
        match = compatibility(replay, course, { tuneId: this.currentTune });
      if (epoch !== this.ghostEpoch) return;
      if (!match.ok) throw Error(match.reasons.join(" "));
      this.ghost = replay;
      this.ghostIndex = buildProgressIndex(replay);
      this.ghostStatus =
        match.warning ||
        `${mode === "previous" ? "PREVIOUS RUN" : mode === "selected" ? "SAVED REPLAY" : "PERSONAL BEST"} / ${replay.official.total.toFixed(3)} s`;
    } catch (e) {
      if (epoch === this.ghostEpoch) this.ghostStatus = e.message;
    }
    this.emit();
  }
  ghostAt(time) {
    if (!this.ghost || time < 0 || time > this.ghost.official.total)
      return null;
    return rowPose(
      sampleReplay(this.ghost, time, this.ghostRow),
      this.ghostPose,
    );
  }
  delta() {
    if (!this.ghost || !this.progressValid) return null;
    const t = timeAtProgress(this.ghostIndex, this.liveProgress);
    return t === null ? null : this.liveTime - t;
  }
  inspect() {
    return {
      status: this.status,
      ghostStatus: this.ghostStatus,
      recording: !!this.recorder,
      sampleInterval:
        this.recorder?.interval ?? this.preferences.values.interval,
      snapshots:
        this.recorder?.samples.length ??
        this.lastCompleted?.samples.length ??
        0,
      bytes: this.lastCompletedBytes || 0,
      course: this.activeCourse?.id,
      ghostId: this.ghost?.meta.id ?? null,
      delta: this.delta(),
      stored: this.catalog.length,
      temporary: !!this.repository.warning,
    };
  }
}
