# Boat Physics & Handling · v0.14.0

## Audit before implementation

The active checkout is `main` at `1c7fe50`, matching `origin/main`, with a clean worktree. `index.html` loads `src/main.js`; Vite builds that same entry for GitHub Pages. There is one boat controller: `stepBoat()` in `src/physics.js`, called in bounded 1/120-second substeps from the racing branch of the animation loop. Countdown/staged revving does not run the integrator.

The existing model filters throttle into pump pressure, steers a stern nozzle, integrates yaw torque/damping, applies thrust and hull-frame lateral resistance, and dissipates quadratic drag. Bank collisions project the hull center back into the unchanged 6.5 m corridor and reflect outward velocity. Velocity is independent of heading, so existing drift momentum is real rather than a visual rotation.

`racingBoat()` builds a batched mesh group with local +X forward. `BoatPresentation` positions that group and adds small input-driven roll, speed/acceleration pitch and a constant sinusoidal bob. It does not write horizontal physics state. Four saved cameras consume the group transform; driver-only batches are hidden in Cockpit. The force-based visual hull upgrade will keep that contract.

`SettingsStore` owns schema-2 gameplay settings, migration, validation, debounced localStorage, portable JSON and named presets. Graphics, camera and V8 Sound Lab data have separate stores. Stable legacy handling IDs will be reused, new physics controls will use this registry, and the dedicated Physics Lab will reparent existing control rows rather than duplicate handlers/controllers. Physics-only presets/import/reset must leave unrelated settings untouched. Previous leaderboard records must remain stored under their original gameplay version.

The existing HF water/spray, terrain, course, camera, navigator, countdown and audio systems are active. This task changes handling and its presentation/integration; it does not replace the course or graphics architecture.

## Active handling model

`stepBoat()` is still the only horizontal controller, now with measured telemetry. Pump pressure follows the requested throttle exponentially, with independent rise/release times. The same stern jet vector supplies forward/side force and yaw torque about a reference 650 kg hull / 1,500 kg·m² yaw inertia. Maximum thrust is a real newton ceiling; acceleration tuning changes the effective mass/inertia gain. Nozzle response is immediate, while yaw authority ramps with available thrust and actual launch motion. A dead pump has no rudder by default. The throttle-off authority slider deliberately offers a small optional arcade coasting assist.

Velocity stays in world space and is never snapped to the hull heading. Lateral drag depends on hull grip, speed and retained drift; centered-nozzle recovery adds configurable stabilization. Loaded slides dissipate forward speed. Spinout sensitivity optionally reduces yaw stabilization at excessive slip, with zero disabling it. Forward drag includes a displacement-to-planing transition and a nominal top-speed drag curve. Changing drag can change attainable speed; the top-speed setting is a target for the default tune, not an artificial exact limiter under every custom combination. A higher safety speed bound prevents runaway extreme tunes.

The existing collision corridor and rebound response remain. Collision impulse, body-frame acceleration, slip, pump pressure, nozzle, thrust and yaw are measured by this active controller. Finite-state recovery, bounded yaw/nozzle/speed, exponential damping and ≤1/120-second direct-call substeps protect extreme settings. The existing main loop already uses 120 Hz substeps and now advances hull motion with each one. The countdown continues to exclude propulsion integration, and restart clears all hull spring state.

## Banking, planing and water response

`HullMotion` is a separate rendering state, not another boat controller. Lateral acceleration and speed × yaw determine turn load. A damped roll spring follows that load, with independent loading/recovery speed, damping, overshoot and inversion. Actual roll is bounded by the configured limit (9° default, 0–25° available). A brief counter-roll can occur during the initial sideways stern jet reaction; settled turn load banks the hull into the turn. No steering-input-only lean remains.

Planing factor comes from the active forward-speed transition. The bow rises with planing/acceleration and settles under deceleration. Separate pitch and heave springs respond to sampled water slope, wave encounters and bank impulses. The original mesh dimensions and +X heading contract remain; its root sits nearer the waterline and rises a few centimeters onto plane. Banking/pitch do not feed rotation into the x/z collision solver. The cameras continue to consume this same boat root and real driver-seat transform.

The CPU sampler evaluates the existing rendered analytic wind components and historical HF wake field at the hull center, bow, stern and both chines. It reuses samples and performs no GPU readback, fluid simulation or random idle shake. Calm flat water is stable. **Limitation:** it approximates visual water contact, not buoyancy, slamming or two-way fluid coupling. The optional shallow-water solver's extra diagnostic waves and exact shoreline taper are not reconstructed on the CPU. Motion is bounded for water/model compatibility. Gust/wake inputs may differ slightly because wake history updates once per rendered frame.

The HF jet core/droplets now use actual thrust and the moving stern outlet height; side spray uses measured lateral acceleration and hull impact. Historical wake samples remain aft and fixed in world space. The existing `Engine.update()` accepts optional propulsion load; Sound Lab rev tests keep their prior path and every audio setting remains unchanged. Listening quality on speakers/headphones still requires human testing.

## Physics Lab and persistence

**BOAT PHYSICS** opens a nonmodal, scrollable drawer above the touch controls. The six requested groups contain 37 numeric sliders plus bank inversion. Labels show live numeric values/units and short descriptions. Each category has a reset; factory reset affects handling only. Opening releases held inputs to avoid stuck controls; the race continues and touch throttle/steering remain reachable while tuning. Closing/reopening retains values. Telemetry is optional and displays the real active controller and hull-spring values at a compact update rate; it hides while settings panels are open.

Stable legacy handling IDs are retained. `SettingsStore` migrates schemas 0/1/2 additively to schema 3, preserving validated old values and unknown backup fields. New users receive Balanced; existing nondefault tunes are identified as Custom. Arcade/Balanced/Simulation-Inspired presets change actual force and presentation settings. The new physics preset collection uses the existing `NamedPresets` implementation under `jet-sprint-physics-presets-v1`, leaving old full-game presets intact. Save/update/load/rename/delete, copy/export, JSON import and file import are implemented; clipboard denial falls back to a selectable text box.

Physics-only JSON/reset/presets do not change graphics, audio, cameras, diagnostic-water preferences or race records. Old complete game JSON can also supply physics values. Invalid imports are validated before changing active settings. Changed force settings mark the current race modified; visual bank/pitch/bounce tuning alone does not. The leaderboard gameplay version changes to `0.14-waterjet-handling` so old physics times are not compared as equivalent. Previous records remain stored under their original version.

The readonly console diagnostic `__JET_SPRINT_PHYSICS__.inspect()` exposes applied tuning, controller state, actual/target roll/pitch, planing, stern height, audio load/backend and race/camera status. It does not provide a mutation API.

## Verification

Node coverage includes every force slider's measured effect, every visual slider's motion trace, symmetric/inverted/limited banking and settling, planing/acceleration/deceleration, 30/60/120 Hz agreement, throttle-off authority, idle stability, extreme ranges/NaN recovery/collisions, deterministic water/wake sampling, additive settings migration, physics-only JSON/preset isolation and engine-load integration. All three physics presets complete five ordered laps with the binary-input test driver. Existing four-camera full-race, navigation, countdown, audio DSP, graphics, terrain and fluid tests remain enabled.

`npm test`: **115 passed, 0 failed**. `npm run build`: **passed**, with the existing Vite large-chunk advisory (about 230 KB gzip). No dependency was added and no test/check was disabled. An older assertion that required yaw on the very first stationary substep now checks immediate nozzle response followed by movement-driven yaw, matching the requested behavior. Schema tests now check schema 3.

Production Chromium checks under `/Jet-Sprint/` covered all 37 live slider bindings, opposite bank directions, bow lift/planing, zero-speed unpowered steering, throttle-lift thrust decay, actual thrust ceilings, all three presets, category/factory reset, custom save/update/rename/load/delete, JSON copy/import/file import, reload persistence, telemetry, four cameras, audio startup through AudioWorklet, simultaneous steering/throttle and release. The Lab was checked at 390 × 844, 375 × 667 and 844 × 390; its scrolled Close control remains reachable and its bottom stays above the driving buttons. Shader/page errors were monitored.

Captures: [right bank / Chase](boat-physics/chase-right.png), [left bank / Chase](boat-physics/chase-left.png), [phone Lab](boat-physics/mobile-lab.png), [bank tuning while scrolled](boat-physics/mobile-bank.png), [landscape Lab](boat-physics/landscape-lab.png), [touch driving / telemetry](boat-physics/mobile-driving.png).

Controlled browser animation steps under software WebGL are not a device performance benchmark. No physical iPhone Safari, sustained FPS/thermal test, subjective audio review or human full-race playtest is claimed. Automated five-lap completion establishes navigability under the test driver, not subjective racing feel. Actual jet-sprint boat behavior still uses bounded arcade approximations rather than validated naval hydrodynamics.

## Deployment and changed files

The active HUD reads **PHYSICS-V1 · v0.14.0 · commit**. Local builds say `local`; the retained Vite configuration injects the CI commit prefix for Pages. The existing `.github/workflows/deploy.yml` still tests/builds main and deploys `dist/` with official Pages actions. A successful commit/push is not sufficient: check the release commit's Deploy GitHub Pages run, then reload `https://soulmullet.github.io/Jet-Sprint/?build=COMMIT` and confirm the HUD label and Boat Physics button.

This cloud environment can read GitHub Actions but its network policy blocks direct public Pages access. Local production rendering and workflow status can be checked here; public-site visual output cannot.

Changed: `src/handling.js`, `physics.js`, new `hull-motion.js` and `physics-lab.js`, `boat-presentation.js`, `settings.js`, `settings-panel.js`, `main.js`, `hf-effects.js`, `audio.js`, `race.js`, the gameplay-version constant in `course.js`, `style.css`, package versions, HUD text, README, this document/captures and physics/settings regression tests. Course geometry, navigation, countdown, control bindings, camera modes/settings and V8 tuning data are retained.
