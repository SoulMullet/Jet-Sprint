# v0.22.0 — Ghost racing, replay and portable foundation

This release extends the playable game. Course geometry, boat forces, touch/Xbox adapters, original timing/checkpoint rules, water/spray, V8 parameters, fixed/follow cameras, gate sweep, tuning stores and campaign rewards remain in place.

## Use it

1. Finish a normal three-lap race or an upstream bonus river. Recording is enabled by default. The completed trajectory and original official result save automatically.
2. On the next visit, **Personal Best** races the fastest recorded result for that course revision and force tune. **Previous Run**, **Selected Saved Replay** and **Ghost Disabled** are available under **Pit Control → GHOST**.
3. Adjust ghost opacity/color there. Save Replay protects the latest completed run as a bookmark. The library offers Load Replay / Viewer, Use selected ghost, Export Replay, Import Replay and explicit Delete Replay.
4. Open **REPLAYS / PERSONAL RECORDS** from the title menu, or **WATCH RACE REPLAY** from results. Play/pause, scrub, rewind, choose 0.25×/0.5×/1×/2×, switch cameras and enable telemetry.
5. **Telemetry Lab** graphs speed, throttle, steering, slip, heading, yaw angular velocity and ordered progress. It compares with the relevant stored PB. Export telemetry as CSV; replay JSON also includes the original lap/checkpoint events and times.
6. **Development / portable data** exports the Unreal-ready JSON foundation pack and clears unprotected test recordings. Recording, interval, ghost style/mode/selection and telemetry preference save automatically. Interval changes apply to the next event; disabling recording discards the incomplete current capture.

Only one ghost is active. The same ghost/player/visual classes can be instantiated for future additional channels; no opponents or online systems were added.

## Authentic recording and timing

The existing physics loop remains authoritative. The observer runs immediately after each real fixed physics/campaign/hull-motion step. It resamples actual world position and YXZ-derived quaternion onto a normally 20 Hz grid, with adjustable 0.05–0.1 s intervals. It records linear/world angular velocity, the applied processed commands, speed, slip, heading, ordered route progress, laps and checkpoint index. The exact official finish sample is retained even when it falls between grid ticks.

Checkpoint/lap/transition events and official checkpoint splits, lap times and total time are separate data. The recorder does not recalculate official times. If the game's logical clock advances across a clamped/stalled rendering interval, it holds the last real pose through unsimulated time rather than inventing additional driving.

Playback interpolates stored snapshots; it never sends recorded inputs through today's boat controller. Ghosts clone the existing low-poly hull geometry, replace only their own materials, cast no shadows, have no raycast/contact participation and create no wake, spray or sound. A changed physics tune cannot redirect an already recorded boat.

Each file represents **one completed official event**, either a race or a river bonus. Shared session IDs and previous-event IDs link a campaign sequence. Race completion/exit and river entry/completion transitions are recorded. Untimed exit cruising is not included, and there is no continuous seven-event replay editor.

## Personal records and delta

Records are keyed by course/route geometry revision and the force-tuning signature. They retain fastest total, fastest lap, best cumulative checkpoint splits, fastest bonus-river time, recent total, previous-run file and PB file. Visual-only tuning does not create a different force class. A run that changes force tuning midway, or a debug practice visit, is viewable/exportable but cannot set official records. Imports never pay prizes, unlock tracks or establish official records.

The delta compares elapsed time at **ordered, unwrapped route progress**. It uses original split anchors and the ghost's first forward traversal between gates. Required checkpoint intervals and lap offsets distinguish intersections and repeated visits. It does not compare straight-line boat separation. Invalid off-route projections hide the continuous delta rather than inventing a distance-based result.

Beating an existing recorded PB shows NEW COURSE RECORD; the first recorded result uses COURSE RECORD SET. Existing campaign best times, named local leaderboards and wallet data remain in their original stores. Historical times cannot generate a historical ghost: this new recorded-run record set starts with captures from this release. Explicitly selecting a different force tune is allowed with a warning because trajectory playback remains valid.

## Storage, compatibility and limits

- IndexedDB database **`jet-sprint-replays-v1`**, version 1: payload, catalog and record stores. A single read/write transaction commits the file, personal-record references and any permitted retention changes together.
- Separate small preferences: **`jet-sprint-replay-settings-v1`**, schema 1. Existing settings, controller, camera, audio, graphics, progress and score keys are not renamed or cleared.
- Logical replay budget: **64 MiB / 32 files**. A file is at most **8 MiB**, **36,002 snapshots**, **1,024 events**, **30 minutes**. Recording stops clearly at the bound; incomplete captures do not become PBs.
- New PBs receive new IDs. Their former PB payloads remain archived. Saved files, all PB history and active PB/previous references are protected from automatic retention. Storage pressure reports an error; it cannot silently replace those files. Explicit deletion retains original record times but removes the deleted file's ghost reference.
- If IndexedDB is unavailable, bounded in-memory recording remains usable and the Lab clearly asks for export. Browser quota failures preserve the previous committed records and leave the latest completed run available through **Export latest run**. A browser killed before a pending write completes, private browsing, site-data clearing or platform eviction cannot be guaranteed against.
- Reloads and same-origin deployments retain the database. A different host/origin requires portable export/import. Import validates format, sizes, cadence, finite values, quaternions, increasing times, complete splits, lap sums and exact start/finish. It never applies an imported physics tune to the player.
- Course ID, route, geometry revision and boat configuration must match for playback. Different build/physics/tune metadata can warn without resimulation. Incompatible files remain exportable/deletable. Existing IDs cannot overwrite a different payload.

Portable contracts and the migration plan are in [UNREAL_MIGRATION.md](UNREAL_MIGRATION.md), [replay schema](schemas/replay-v1.schema.json) and [foundation schema](schemas/foundation-v1.schema.json). Boat mass/inertia/channel/fixed-step constants now have a renderer-independent source; all existing handling controls remain the integrator's parameter registry.

## Viewer and mobile rendering

The viewer holds the live boat, original race clock, wallet and live camera state. It has an independent player clock and a separate instance of the existing camera controller, not a physics/reward session. The fixed course view and elevated follow camera use recorded transforms. On rivers, the extra isometric option follows a local window so viewing does not require loading an entire multi-kilometre river at once. Its projection reserves space between the header and transport; optional telemetry is a side overlay.

Existing bounded scenery preparation follows the replay boat and returns to the player on close. A distant seek may briefly prepare scenery. Historical wave/scenery state and engine audio are not recorded; the viewer is silent, while gameplay sound/settings remain intact. Shared boat geometry and one active ghost limit additional rendering work. No sustained mobile performance claim is implied.

The GHOST tab uses the same interface theme/components. Department tabs now stay in one horizontally scrollable row on narrow panels; their keyboard navigation and other Lab handlers remain intact. Gameplay gesture protection stays scoped to canvas/driving buttons. The new modal blocks driving while retaining ordinary slider/select interactions, and native touch/keyboard/controller controls resume through their existing release/neutral logic.

## Verification

**225 tests pass on Node 22.23.4 and Node 24.19.0.** The production build passes with the existing main-chunk size advisory. No dependencies were added.

The new tests cover serialization, exact finish samples, fixed cadence, actual input snapshots, quaternion interpolation/pose convention, timing/seek/speeds, bounded invalid imports, route/lap deltas, bonus recordings, all ghost modes, PB history/atomic budget failures, deletion/cleanup, settings, camera viewport clearance and portable schemas/data. A paired real-physics test proves the recording observer leaves boat state, collisions, gate progress and official clock unchanged.

The continuous processed-input campaign driver completes all four races and three rivers with recording attached. Every completed file validates; its original official result equals the event result, and its sampled finish matches its exact stored endpoint. No transition relocates the boat. This is automated simulation, not a human/device playtest.

Rendered Chromium mobile-emulation checks inspect the real HUD/ghost and viewer. They cover selection modes, position/quaternion agreement, import/export/invalid data, IndexedDB reloads, save pinning, telemetry graphs/CSV, foundation export, original times, playback speeds, seeking, fixed/follow cameras, portrait/landscape, and unchanged live boat/clock/wallet/camera while viewing. Simultaneous touch and rapid double taps keep the original input behavior/page scale.

The development fixture uses a manual clock and suppresses repeated draws; screenshots explicitly render frames. It seeds an isolated browser database using real processed-input campaign recordings and a copy with a different ID to check previous-run selection. The results action uses a completed-race fixture. Separate production checks load the **unmodified compiled bundle** under `/Jet-Sprint/`, exercise native pointer controls/import, CDP touch and injected Gamepad API snapshots, then compare the loaded asset hashes with the production manifest.

Evidence: [ghost race](ghost-racing/ghost-race.png), [Lab](ghost-racing/ghost-lab.png), [fixed replay](ghost-racing/replay-fixed.png), [follow replay](ghost-racing/replay-follow.png), [river replay](ghost-racing/river-replay.png), [browser assertions](ghost-racing/browser-proof.json), [compiled viewer](ghost-racing/production-viewer.png), [production assertions](ghost-racing/production-proof.json), [commands/results](ghost-racing/checks.json).

**Limitations:** physical iPhone Safari, physical Xbox hardware, audio listening, sustained mobile FPS/thermal behavior and Unreal numerical parity have not been tested. Native browser storage can be evicted. Playback reproduces boat poses/timing, not historical water/audio/scenery. Ghost files are local/importable; there is no online leaderboard, multiplayer, full-session editor or multi-ghost selector.

GitHub Pages retains its push-to-main workflow. Its verifier now additionally requires the recorded-world-poses and portable-foundation markers before hashing every published file/font for the exact commit. See the release response for the actual deployment result; local source/build success alone is not publication.

## Exact changed files

- Replay kernel/data: `src/replay/model.js`, `src/replay/course-data.js`, `src/replay/session.js`.
- Storage/preferences: `src/replay/storage.js`, `src/replay/settings.js`.
- Visuals/interface/telemetry: `src/replay/visual.js`, `src/replay/feature.js`, `src/replay/telemetry.js`, `src/replay/replay.css`; existing `src/main.js`, `src/interface.js`.
- Shared physical parameters/export: `src/physics-parameters.js`, `src/portable-game-data.js`, existing `src/physics.js`.
- Tests: `test/replays.test.js`, `test/campaign-series-drive.test.js`, `test/deployment-proof.test.js`.
- Deployment proof: `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`.
- Version/setup: `package.json`, `package-lock.json`, `index.html`, `src/settings.js`, `README.md`.
- Documentation/schemas: this report, `docs/UNREAL_MIGRATION.md`, `docs/schemas/replay-v1.schema.json`, `docs/schemas/foundation-v1.schema.json`.
- QA artifacts: `docs/ghost-racing/browser-proof.json`, `checks.json`, `production-proof.json`, `ghost-race.png`, `ghost-lab.png`, `replay-fixed.png`, `replay-follow.png`, `river-replay.png`, `production-viewer.png`.
