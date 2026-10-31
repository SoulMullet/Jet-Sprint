# River Run Evolution 01 — v0.23.0

The playable entry is now **River Rush 1**, with River Rush 2 and 3 selectable immediately. These are the existing bonus environments, promoted through a lifecycle adapter; no substitute river or new course geometry was generated. The earlier Ghost Racing/Tape Deck work is also included in this publication ([implementation and evidence](GHOST_RACING.md)).

## Actual environments and lifecycle

| Main level ID | Existing environment ID | Original route length | Ordered checkpoints |
| --- | --- | ---: | ---: |
| `river-run-kowhai-upstream` | `kowhai-upstream` | about 1.69 km | 18 |
| `river-run-river-rush-2` | `river-rush-2` | about 2.43 km | 23 |
| `river-run-river-rush-3` | `river-rush-3` | about 3.45 km | 29 |

`createRiverLevels` keeps the actual `world.legs[index].river` object and its original checkpoint array. Each descriptor contains its ID, display name, environment, route, rest-start position/heading, last-checkpoint finish plane, course revision and unlock requirements. All three currently have empty requirements. Start positions lie three metres beyond the old entrance-gate distance; the playable run is therefore slightly shorter than each full authored environment. Existing poles/signs identify START and FINISH; the finish stripe is decorative and the real ordered directional checkpoint accepts completion.

`RiverRunTour` wraps the original `CampaignTour`/river leaf. Current, rapids, bank/rock collisions, optional jumps, waterjet steering and checkpoint acceptance use their existing implementation. Countdown/green comes from `RaceStart`; timing starts with green and stops at the final valid forward checkpoint crossing. Wrong/missing checkpoints cannot complete a run. Results use the original screen with completion time, personal best, replay, current-level restart and next-river controls. Pause holds logical time. Restart resets the selected river, boat, timer, checkpoint state, motion presentation and spray/wake pools, including after a debug practice visit. Result IDs retain the original fallback for browsers without secure-context UUID support.

Normal progression does not call the circuit race, three-lap completion, final-lap exit gate, prize/wallet transaction or championship sequence. Those modules, four circuit geometries, scoring implementation, old records and diagnostic camera tools remain in the repository. No economy or shop is introduced. Next River is an explicit new level start from results; this build does not claim a seamless connection between these separately selected runs.

HUD changes are limited to point-to-point information: level name, elapsed time, speed/RPM, existing navigation, ordered checkpoint count, progress and best time. Lap instruments are hidden. Existing MARINE-87 controls, fonts and labs remain. The level debug selector offers the same three real environments; its practice attempts do not award records.

## Camera implementation

`SpeedFraming` is a rendering-only, allocation-free filter. Measured horizontal velocity magnitude is normalized from the saved speed threshold to the tuned top speed. It never reads throttle. Distinct rising/falling exponential response rates control speed framing; an analytically integrated second response stage smooths boom distance. This produces equivalent constant-input response at 30, 60 and 120 Hz.

The original follow heading, turn anticipation, orientation, look-ahead, clearance and projection infrastructure remain. River-follow boom distance/height scale together, preserving the elevation angle; the low Chase comparison mode applies the same framing to its existing boom. Classic Arcade, Cockpit and Overhead retain their existing behavior. FOV begins at the selected preset's existing low-speed value. A completed run no longer aims back down the finished path while the player coasts. Paused comparison-camera look-ahead samples the open river with endpoint clamping, rather than inheriting circular point indexing.

| River Follow control | New-install default | Range |
| --- | ---: | ---: |
| Speed Pullback Intensity | 20% | 0–50% |
| High-Speed FOV Increase | 8° | 0–20° |
| Pullback Response Speed | 2.5/s | 0.2–8/s |
| Return Response Speed | 1.8/s | 0.2–8/s |
| Speed Threshold | 20 km/h | 0–80 km/h |
| Camera Distance Smoothing | 0.35 s | 0.02–2 s |

All six controls update live, autosave, and support individual/group reset. Speed Zoom disabled still disables this framing. An earlier saved fractional `speedIntensity` migrates to the corresponding percentage, so an old 18% or custom preference is respected rather than overwritten with 20%. Existing per-venue presets are inherited once into primary river presets, then remain independent. The camera store/key/schema remain `jet-sprint-racing-cameras-v2`, schema 2; the old per-mode store remains untouched.

## Save/replay compatibility

- Level best/completion data uses `jet-sprint-river-runs-v1`, schema 1, with stable IDs and revision checks. Writes occur on valid completion. Failed writes keep the result in memory and expose Retry; practice never writes a best.
- Campaign/wallet keys are neither migrated destructively nor rewritten. Existing physics, water, spray, V8, graphics, input and camera handlers/keys remain. Same-origin deployments retain browser data; storage clearing, private sessions and origin changes have their usual limits.
- Primary river replays receive distinct standalone IDs/revisions. Old moving-entry bonus times cannot become rest-start ghosts or level bests. Old circuit/bonus recordings remain importable/viewable against their original metadata.
- Level bests are the simple standalone completion record. Competitive ghost records retain their separate force-tune/course-revision grouping; an imported recording does not award a personal record.
- Portable foundation exports add optional `activeMode` and `primaryRiverLevels` while retaining archived numeric courses, rivers and boundaries. The version-1 schema remains backward compatible. This is data preparation, not an Unreal port.

## Verification and evidence

**236 automated tests pass on Node 22 and Node 24.** The full suite includes all three primary rivers driven from rest through the existing processed input, fixed-step physics and ordered checkpoints; reverse/out-of-order finish rejection; stopped/reset timing; level save isolation and write retry; camera migration, actual-controller integration and frame-rate-independent response. All original circuit, handling, controls, audio, spray, fluid, replay and streaming tests remain. A final release run also passes after UI copy updates. There is no separately configured lint or type-check command.

Production build passes, with 14 served files and the existing main-chunk advisory (approximately 298 KB gzip). Local deployment verification downloads and hashes every served file under `/Jet-Sprint/` and checks release/gameplay/replay markers.

The [rendered browser proof](river-run-evolution/browser-proof.json) drives **all three entire rivers through the live main game loop** using standard-controller snapshots and the actual input adapter. No stage or boat-position teleports occur during those runs. Recorded times are **112.258 / 162.067 / 229.300 seconds**, with **18 / 23 / 29 checkpoints**. It verifies countdown/pause, results/PBs, current-level restart, primary replay seeking, legacy save isolation, bests and six camera sliders after reload, preserved physics/V8 values, simultaneous touch, repeated double taps and rotation pause. A separate controlled measured-velocity fixture confirms the camera reaches 1.20× distance / 63° FOV from 55° and returns to baseline without using throttle.

The [production browser proof](river-run-evolution/production-proof.json) runs the **unmodified compiled bundle**, hashes the loaded JavaScript/CSS against its manifest, imports a real completed primary-river recording through the UI, checks playback/seek and independent live state, restores original spray visibility, exercises keyboard/CDP multitouch/Gamepad snapshots, saved replay settings/reload, reset, and delete cancellation/confirmation. [Checks manifest](river-run-evolution/checks.json) records build/runtime results. Rendered screenshots are [normal river start](river-run-evolution/river-start.png), [title](river-run-evolution/river-title.png), [results](river-run-evolution/river-results.png) and [production replay](river-run-evolution/production-viewer.png). The [camera boundary check](river-run-evolution/camera-edge-proof.json) places the boat near each finish in a dedicated fixture and cycles all four comparison modes while paused; camera transforms stay finite and the boat stays unchanged. Production UI checks also select a river from the title menu and restart a debug-selected River Rush 3 without returning to level 1. Compact menus/results use their existing vertical scrolling; focus can scroll to their action buttons.

The all-level browser harness uses a controlled frame clock and suppresses repeated drawing during accelerated simulation. Screenshots are actual rendered Chromium frames, inspected visually. Production checks retain drawing. These tests establish functional integration, **not physical iPhone Safari, real Xbox hardware, audio listening, sustained mobile FPS or thermal performance**. Human pace/feel and extreme user tuning still need device playtesting. Scrubbing to a distant replay position can briefly wait for the existing worker-backed scenery; controls stay available. Low quality remains recommended for constrained devices. Optional diagnostic GPU water remains at the old origin; it is not a river-wide hydrology solver.

## Files changed in this phase

- New: `src/river-levels.js`, `src/river-run.js`, `src/river-run-ui.js`, `src/river-run.css`, `src/speed-framing.js`, `test/river-run.test.js`.
- Integration: `src/main.js`, `src/campaign-debug.js`, `src/debug-views.js`, `src/gameplay-diagnostics.js`.
- Cameras: `src/cameras.js`, `src/racing-camera-manager.js`, `src/racing-camera-settings.js`, `src/racing-camera-lab.js`.
- Replay/data compatibility: `src/replay/session.js`, `src/replay/feature.js`, `src/replay/visual.js`, `src/portable-game-data.js`, `docs/schemas/foundation-v1.schema.json`.
- Release/deployment: `index.html`, `package.json`, `package-lock.json`, `src/settings.js`, `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, `test/deployment-proof.test.js`.
- Documentation/evidence: `README.md`, `docs/UNREAL_MIGRATION.md`, this report, and `docs/river-run-evolution/*`.

The preceding ghost-foundation commit's exact files and verification are listed separately in [GHOST_RACING.md](GHOST_RACING.md).

## Deployment

Push to `main` triggers the retained GitHub Pages workflow. Its deploy job checks the actual published manifest and every served file's hash, including fonts, for the exact commit. A successful build alone is not publication verification. The final response reports the observed workflow result. Existing open tabs need a refresh after publication; settings need no reset. This cloud cannot directly browse the Pages host under its network policy; published-content verification therefore runs on the GitHub Actions deployment runner.
