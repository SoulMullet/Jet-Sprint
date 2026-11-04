# Hold-to-accelerate and Arcade handling — v0.32.0

[Play Arcade River](https://soulmullet.github.io/Jet-Sprint/?mode=arcade-river&v=0.32.0), or choose Racing on the title. **Hold THROTTLE to go; release to coast.** Arcade keeps water-view drag steering, Racing keeps LEFT/RIGHT, keyboard uses A/D/arrows plus Space/W/Up, and a standard gamepad uses left stick plus RT. Ramps still launch automatically. Racing's same-finger upward nitrous swipe remains available when the owned boat has the kit.

## What changed in the active game

Arcade River previously wrote `throttle=1` every frame, and the force solver still produced forward jet thrust from decaying pump pressure after release. Keyboard/gamepad release could also pass through a saved release filter, and archived rail settings could hold an axis. These paths now obey one safety rule: **no held throttle command means zero input and zero jet thrust**. Nitrous requires that command too.

The existing shared touch component now mounts a throttle-only button beside Arcade's canvas drag; its two inputs share the normalized touch command without sharing pointer ownership. Racing mounts its existing three touch buttons. Pressing anywhere on THROTTLE gives full power while held; vertical travel controls only the existing nitrous gesture. Release/cancel/lost capture clears that throttle pointer and nitrous while leaving another steering finger intact. Per-frame capture checks also catch interrupted stationary pointers before browsers deliver `lostpointercapture`. Pause, restart, background/focus loss and device handover disarm held input. Keyboard/gamepad release bypasses their saved decay filters. Legacy release/hold preferences remain stored/exportable but are marked inactive in Control Lab; they cannot latch live throttle.

`stepBoat` remains the live 120 Hz force integrator: nozzle-vector thrust, mass, forward/lateral velocity, exponential water resistance, yaw inertia, bank collisions and service/upgrade scaling are retained. Pump pressure can settle for presentation/repress response, but released throttle has **zero thrust and engine load** on the next physics step. Off-throttle water drag dissipates velocity rather than setting it to zero. The small moving-hull yaw assist fades in/out by speed, never adds forward thrust, and is zero at rest. Steering torque builds faster, angular damping settles corrections sooner, and stronger lateral resistance reduces excessive slide. No route steering, position snapping, new camera controller or replacement physics engine was introduced.

## Actual factory values

These are active defaults, not merely newly exposed sliders. Existing **HULL / Boat Physics Lab** owns forces and banking; **INPUT / Control Lab** owns device smoothing. Individual/category resets and existing preset/import/export stores still work.

| Parameter | Previous factory | v0.32.0 factory |
| --- | ---: | ---: |
| Steering responsiveness | 75% | **95%** |
| Nozzle response | 12 /s | **22 /s** |
| Nozzle travel | 30° | **35°** |
| Maximum turn rate | Unexposed 4 rad/s safety clamp | **150°/s**, adjustable 45–220 |
| Powered low/high-speed authority | 1 / 1× | **1.4 / 1.3×** |
| Low-speed/coasting yaw assist | 0 | **0.65×**, adjustable 0–1 |
| Throttle-off nozzle authority | 0 | **0.16** |
| Keyboard/gamepad steering smoothing | 25 ms | **10 ms** |
| Relative-drag steering smoothing | 35 ms | **10 ms** |
| Drag release-to-centre | 200 ms | **150 ms** |
| Drift intensity | 65% | **35%** |
| Hull grip | 1× | **1.35×** |
| Lateral water resistance | 8 /s | **12 /s** |
| Drift recovery | 0.65 | **1.2** |
| Angular damping / inertia | 4.5 /s / 1× | **6.5 /s / 0.65×** |
| Additional off-throttle drag | 0 | **0.22 /s**, adjustable 0–1.2 |
| Nominal acceleration strength | 21 | **24 m/s²**, 1.143× prior gain |
| Pump rise / pressure release | 120 / 160 ms | **70 / 80 ms** |
| Visual banking intensity / limit | 1× / 9° | **1.05× / 11°** |
| Bank response / recovery | 9 / 6 per second | **12 / 8 per second** |

The old 4 rad/s clamp was a safety ceiling, not the achieved turn rate. The new force tune actually reaches its controlled 150°/s ceiling faster. Low-speed assistance is useful without throttle while moving, and cannot spin a stationary hull. Pressure-release time does **not** delay throttle/thrust cutoff. Standard gamepad RT remains proportional while physically pressed.

Arcade's existing mode-specific response/recovery/landing sliders remain at their saved values (factory response multiplier 1.2×, landing stability 0.7). The main table describes the shared hull tune. Original 78 MPH Arcade and 93 MPH stock Racing targets remain; engine/pump upgrades still scale top speed, power and response. Nominal acceleration is now a live adjustment alongside handling, while peak thrust, pump calibration and career speed remain controlled by their existing upgrade/development rules. Non-default force settings are still marked modified.

## Measured results

[Before](before.json) records the unchanged v0.31.1 source before editing. [After](after-metrics.json) uses the same prepared inputs: 120 Hz `stepBoat`, open water, stock 93 MPH service, 30 m/s initial speed and steady pump pressure. These are solver response measurements after a normalized steering step, not end-to-end touch latency or subjective feel tests.

| Measurement | Before | After |
| --- | ---: | ---: |
| Time to yaw rate 0.5 rad/s | 125 ms | **41.7 ms** |
| Yaw rate after 250 ms | 66.9°/s | **150°/s** |
| Full opposite-input yaw sign reversal | 233 ms | **100 ms** |
| Steady turn radius | 13.23 m | **10.38 m** |
| Steady slip angle | 30.58° | **13.13°** |
| First released-step thrust | 12,957 N | **0 N** |
| Coasting speed after 1 second | 24.12 m/s | **17.70 m/s** |
| Coasting distance in that second | 27.93 m | **22.88 m** |
| Heading change in 1 second, coasting from 3 m/s | 0° | **30.04°** |
| Stationary heading change, steering held | 0° | **0°** |

## Saves and preserved systems

Stable keys remain `jet-sprint-settings` (schema 3) and `jet-sprint-controls-v1` (schema 1). Exact known old factory Balanced/Arcade profiles upgrade once to the new default, with a migration message and `handlingRevision:hold-arcade-v1`. Custom tunes, explicit imported/named presets, graphics/audio/camera preferences and career data are retained. Explicitly chosen current Balanced or Simulation profiles are not repeatedly changed on reload. A known old Simulation factory profile keeps its forces with the new assist/drag disabled. Factory input latency values migrate separately; custom response curves remain as saved. Choose **Arcade** or Restore factory physics to opt a retained custom tune into the new handling.

Courses, water networks, ramp locations/widths, logs/rocks, ordered gates, race timing, damage/fuel rules, upgrades, cameras, music and V8 assets were not redesigned. The existing original Racing input and V8 browser checks still run. Replay files remain pose-based and readable; new recordings/exported data declare `waterjet-forces-v2`, and old versions display the existing compatibility warning rather than being deleted. The force-parity reference fixture was regenerated for the changed defaults/model. No Unreal runtime work was added.

## Verification

- **319 Node tests passed, zero failures.** Coverage includes new measured response/coast/low-speed bounds, rapid reversals, throttle/boost cutoff, independent multi-touch ownership, stationary capture loss, device handover, factory/custom save migration, reset/import isolation, slider extremes, fixed steps and existing gameplay/audio/camera/progression tests. Existing expected tests were updated where they asserted the intentionally removed auto-throttle, latched return or power-only coasting behaviour. The archived three-lap test now uses proportional steering feedback to exercise the more responsive model; it still drives all three profiles through the actual gates.
- Production build passes with the existing large-chunk advisory. Local asset verification checks all **35 production files**. The existing Pages verifier additionally requires `handling:held-throttle-arcade-v1` so an older deployment cannot pass as this build; the workflow itself was not replaced.
- [Production browser proof](browser-proof.json): native Chromium touch delivery confirms no unpressed acceleration, throttle-first/steering-first two-finger operation, held steering during throttle release, immediate zero input/thrust with coasting velocity, rapid alternation, cancellation, stationary capture loss, Pause/resume without re-acceleration, keyboard release and simulated standard RT release. Focused native ranges change the actual hull settings; turn cap, low-speed assist, off-throttle drag and acceleration survive reload. Drag/camera settings and original career bytes survive too.
- Complete safe/shortcut runs use only standard Gamepad API input through the real production loop with RT held. Both finish with all route validation and two jumps. [Offline route proof](route-proof.json) uses the same force integrator. Six separate prepared practice approaches still clear/land from the left, centre and right of both real ramps, with zero collision impulse; only their initial poses/velocities are seeded by the external QA driver, not jumps or landing outcomes.
- [Racing regression](racing-regression/browser-proof.json): native simultaneous touch steering/throttle, upward nitrous swipe, release while nitrous is active, keyboard Space release while Shift remains held, capture interruption and nine decoded V8 recordings/Audio Lab persistence pass. Audio playback sources remain reused; no new audio assets or players were added.
- Actual rendered screenshots were inspected: [playable HUD/throttle](after-ramp.png), [native held touch](touch-throttle.png), [handling range](handling-lab.png), [Control Lab](control-lab.png), [jump](jump.png), [results](results.png) and [short landscape](results-short-landscape.png). The throttle readout reflects the applied command for keyboard/gamepad too; [menu checks](menu-proof.json) verify the gameplay controls stay hidden on title/pause/lab screens. Browser checks found no JS/shader errors; gameplay page scale stayed 1 with no scrolling/selection.

Most GPU draws are suppressed only during accelerated logical QA runs, and real rendering is enabled for screenshots. **Physical iPhone Safari, physical Xbox controllers, sustained mobile FPS, subjective audio listening and human first-time gameplay feel remain unverified.** The tests demonstrate connected input/physics behaviour and reachability, not that human enjoyment has been measured.

## Reproduce / manual acceptance

```sh
npm ci
npm test
npm run build
node scripts/verify-arcade-handling.mjs
node scripts/verify-arcade-route.mjs
npm run preview -- --port 4270 --strictPort --base /Jet-Sprint/
# Separately, with optional Playwright / Chromium test tools:
ARCADE_QA_OUTPUT=docs/arcade-handling \
JET_SPRINT_URL=http://127.0.0.1:4270/Jet-Sprint/ node scripts/verify-arcade-browser.mjs
TOUCH_QA_OUTPUT=docs/arcade-handling/racing-regression \
JET_SPRINT_URL=http://127.0.0.1:4270/Jet-Sprint/ node scripts/verify-touch-v8-browser.mjs
```

The optional browser tools accept `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` and are not game dependencies. On a phone, start without touching throttle: there should be no jet power. Hold it, add a steering finger, alternate directions, then release throttle while keeping steering held. The boat should coast with no boost. Repeat with steering first; test cancellation, background/foreground, pause/resume and rotation. In Racing with a kit, swipe upward into nitrous, then release the throttle finger while steering remains held. With a pad, test RT release while RB stays held. Adjust/reset HULL and INPUT values and reload. A physical-device and human feel pass is still needed.

## Changed file groups

- `src/physics.js`, `src/handling.js` — active force cutoff, bounded assist/turn rate, coasting drag and factory profiles/recognition.
- `src/controls.js`, `src/control-input.js`, `src/arcade-touch.js` — held-input safety, independent drag/throttle command composition, capture checks, immediate release and command readout.
- `src/control-settings.js`, `src/control-lab.js` — persistent quicker input defaults, safe factory migration and archived-return UI explanations.
- `src/settings.js`, `src/physics-lab.js`, `src/garage/upgrades.js` — factory handling migration, reset/status copy and live nominal acceleration without removing upgrade scaling.
- `src/arcade/run.js`, `src/arcade/ui.js`, `src/arcade/arcade.css`, `src/arcade/drag-steering.js`, `src/main.js` — remove automatic throttle, mount the existing held button with drag, update instructions/layout/diagnostics, preserve nitrous/service gating.
- `src/replay/course-data.js`, `src/replay/model.js`, `scripts/export-physics-parity.mjs`, `docs/fixtures/physics-parity-v1.json` — label the changed force model and regenerate its reference traces; retain old pose playback.
- `scripts/verify-arcade-handling.mjs`, `scripts/verify-arcade-browser.mjs`, `scripts/verify-touch-v8-browser.mjs` — reproducible response measurements and connected hold/drag/RT/nitrous/UI/course checks.
- `test/arcade-handling.test.js`, `test/arcade-drag.test.js`, `test/arcade-river.test.js`, `test/controls.test.js`, `test/control-adapters.test.js`, `test/boat-overhaul.test.js`, `test/jet-steering.test.js`, `test/settings.test.js` — new acceptance coverage and updated expectations for the requested handling/release semantics.
- `package.json`, `package-lock.json`, `index.html`, `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, `test/deployment-proof.test.js` — v0.32.0 labels and mandatory published-build identity.
- Root README, historical Arcade reports and this evidence directory — current instructions, measured values, exact file purposes, screenshots and limitations.

Publication status is reported after the actual published commit passes the existing GitHub Pages verification step.
