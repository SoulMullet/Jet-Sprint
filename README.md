# JET SPRINT v0.22.0 — Ghost Racing / Tape Deck

A mobile-first, single-player 3D jet sprint prototype built with JavaScript, Vite, Three.js and Web Audio. Geometry and sound are procedural; licensed interface fonts are bundled locally. No paid assets, account, API keys or backend are required.

This build records completed races and bonus rivers as fixed-interval world-pose replays, adds Personal Best / Previous Run / saved ghosts, per-course force-class records and route-based time delta. Open **Pit Control → GHOST**, **REPLAYS / PERSONAL RECORDS** on the title screen, or **WATCH RACE REPLAY** in results for playback, seeking, camera choice, telemetry and portable import/export. IndexedDB stores replays; older tuning/progress keys remain intact. Ghosts never resimulate physics or affect water, timing or prizes. See [controls, storage limits, exact changed files and verification](docs/GHOST_RACING.md), and [Unreal migration contracts/plan](docs/UNREAL_MIGRATION.md). This remains a browser game; no Unreal port or dependencies are included.

The prior camera/HUD/navigation and touch-gesture polish is retained; see [that implementation report](docs/gameplay-polish.md).

The playable campaign is **Rookie Run → River Rush 1 → Timberline → River Rush 2 → Devil’s Bend → River Rush 3 → Championship**. Rookie Run retains the existing Kōwhai Sprint Park geometry, handling and three-lap format. Three new racing courses add progressively tighter lines, hairpins and shared junctions. Every race has three valid laps. Finishing opens a physical river gate and freezes the race clock while you keep driving; the Championship ends with series results.

The rivers are approximately **1.69 km / 2.43 km / 3.45 km**, with 21 / 22.8 / 24.6 m channels, downstream current, increasingly strong standing crests and later river rocks. Ordered checkpoints, pace/navigation scoring and optional side jumps remain. Normal progression uses one continuous world and scene: boat momentum, controls, camera, audio and airborne spray continue through every boundary. At the next venue, drive through the staging inlet, wait for green and cross the start line to start timing. No interstage loading screen or automatic boat relocation is used.

Look for **CAMPAIGN-4 · v0.22.0 · commit** in the HUD. The MARINE-87 fonts, original boat integrator, arcade touch buttons, retained keyboard/gamepad adapters, automatic course/river cameras, V8 and tuning labs are available. See [current camera/control architecture, changed files, screenshots and verification](docs/arcade-river-camera.md), [campaign architecture](docs/campaign-expanded.md), [retained interface/spray notes](docs/marine-87.md), [physics audit](docs/boat-physics.md) and [rendering notes](docs/hf-graphics-v2.md). [Phase 1 notes](docs/campaign-phase1.md) describe the superseded short river and preview basin.

## Prizes, progress and world preparation

| Event | Completion prize | First clean achievement |
| --- | ---: | ---: |
| Rookie Run | $500 | $250 |
| River Rush 1 | $250 | $150 |
| Timberline | $1,000 | $500 |
| River Rush 2 | $500 | $250 |
| Devil’s Bend | $2,000 | $1,000 |
| River Rush 3 | $1,000 | $500 |
| Championship | $5,000 | $2,500 |

Base prizes pay on valid replays. The clean achievement pays once per event: avoid significant impacts, grounding and respawns for the entire event. A completely clean first campaign earns **$15,400**. Compact rewards show the actual solo finishing time, personal-best status and wallet; there are no invented opponent positions. Open **Pit Control → RACE → Series record / wallet** for lifetime earnings, all seven best times and claimed clean bonuses.

Wallet, lifetime earnings, event records, paid attempt sequences and unlocked venues save under **`jet-sprint-campaign-v2`**, schema 2. The previous `jet-sprint-campaign-v1` record migrates additively without retroactive rewards and remains intact, so an older open build cannot overwrite the new wallet. Existing tuning/preset/score keys are unchanged. Duplicate or stale completion callbacks cannot pay again; explicit restart creates a new attempt. Storage failures retain the active in-memory result, show a warning and offer **Retry wallet save**. Same-origin deployments preserve saves; clearing site data, private-session expiry or changing origins does not.

The title screen lets you begin a new run at an unlocked venue. That initial selection prepares before Start becomes available; later transitions keep the player in control. Explicit Restart begins again at the current venue’s staging area (Rookie Run starts at its stripe), rather than restoring a midriver snapshot. Progress and prizes already earned remain saved.

Environment geometry is prepared on one module worker and installed in small jobs, using bounded 160 m tiles: at most 49 on Low/Medium, 64 on High/Ultra, plus the retained origin scene. The next venue prepares during the current race and river journey; distant unneeded chunks dispose their owned GPU resources. Grass/water/banks share exact clipped tile boundaries. A failed worker produces an explicitly labelled simplified-water fallback while navigation, collisions and progress continue. Use **RACE → Debug Tools → Retry scenery preparation** to recover. This fallback preserves play/progress but is visibly degraded scenery.

Open **Pit Control → RACE → Debug Tools → Level debug / select track or river** in the published game or local development. Choose any of the four tracks or three bonus rivers and press **Go to selected level**. This starts a practice visit and closes the panel; distant scenery prepares around the selected location. Practice awards no prizes or unlocks, and Restart returns to normal Rookie Run. The panel also shows gate/checkpoint/stream status and FPS.

River duration targets are 90–120 / 120–180 / 180–240 seconds, rather than imposed timers. The continuous automated driver meets these ranges; human pace and subjective course difficulty still need playtesting. Physical iPhone Safari, real Xbox hardware, sustained mobile FPS and thermal behavior have not been tested. Use Low on constrained devices. The optional GPU water diagnostic grid remains at Rookie Run; later waterways use procedural/HF waves, the new standing crests and environmental current, rather than a streamed hydrology solver. The existing large Three.js bundle advisory remains.

The rendering includes multi-frequency freshwater waves, animated normal textures, live planar scenery reflections on High/Ultra, a historical three-band foam wake, instanced spray/mist/droplets, physical sky lighting, wet clear-coated boat materials, cockpit/engine details, cutout fir foliage and instanced bank vegetation. Ultra adds depth-based contact occlusion. Art and textures are generated locally; licensed fonts are served with the site.

The V8 Sound Lab, 32 live controls, independent presets/JSON and stationary tuning remain available; see [the earlier track and V8 notes](docs/track-v8-upgrade.md) for audio controls. That document describes the superseded Shelter course.

## Arcade touch controls and retained Control Lab

**Touch:** hold LEFT or RIGHT at the lower left and THROTTLE at the lower right. Independent pointer sets support simultaneous inputs and release/cancellation immediately clears that button. Steering still depends on waterjet thrust. The old analog rails and their tuning code remain available but hidden in gameplay. Their layout, calibration and Hold/Hybrid touch options are archived; they do not latch the new buttons. Existing keyboard/gamepad input processing and controller configuration are retained.

Open **Pit Control → INPUT** for the existing controller and command-response lab. Its saved values, presets, mappings, dead zones, curves and JSON remain intact. These still tune keyboard and controller input; arcade touch buttons request discrete commands directly. **Centre steering / idle throttle now** clears held input.

Landscape is the primary phone layout. Coarse-pointer phones in portrait display a rotate prompt and hold the boat/race clock until landscape returns. Touch input releases safely; the run is preserved. Fullscreen/orientation lock is attempted only from the prompt’s button on browsers that support it. iPhone Safari can rotate naturally without those APIs.

**Keyboard:** A/D or Left/Right steer; W/Up/Space accelerates. R restarts; P/Escape pauses/resumes. A real pause freezes physics and the logical race/countdown clock without resetting the run. Tuning opened directly from the toolbar still runs the clock; opening it from Pause keeps the run paused. Keyboard input never drives through an editing field or tuning/results dialog.

**Xbox-compatible controllers:** connect by USB or pair in the operating system, focus the game, then press a controller button. The title LED and steering housing indicate connection; release RT and centre the stick to arm. Left stick X steers, RT accelerates, A starts/confirms, Menu pauses, View cycles cameras, and B goes back. D-pad up/down selects visible menu controls; left/right adjusts ranges/selects or changes tabs, and A activates buttons/disclosures. Text entry/file pickers still use browser/OS input. LT is unassigned: the current hull has no brake or reverse.

Auto accepts the browser's **standard mapping**; older nonstandard drivers can select Standard buttons or Axis triggers, choose the RT axis and its rest convention. Trigger values stay proportional. Controller removal/API failure/focus loss clears input immediately; reconnection and leaving menus require neutral before throttle can resume. Neutral controllers cannot steal touch. Device priority defaults to most recent deliberate input; commands are never combined across devices, and a superseded held throttle cannot reopen automatically. Optional brief vibration/rumble uses supported APIs only. Some browsers need one real click, tap or keyboard gesture to enable Web Audio; **Pause → Enable / resume audio** exposes that action.

Open **Live input / Raw → Command** for signals, dead-zone/response plots, raw pad values (even while disarmed), device status, return modes, filter targets and ramp/smoothing settings. Inside Control Lab, controller response is previewed live while boat commands stay zero; touch/keyboard signals are visible on course. The optional on-course overlay is hidden and collapsed by default. All control settings auto-save under **`jet-sprint-controls-v1`**, schema 1, with safe field validation/migration and page-hide flush. Group/reset-all controls affect only this store. **Portable control JSON** exports/downloads or imports JSON/files without replacing hull, water, audio, camera, graphics or campaign settings.

See [controls architecture, changed files, verification and manual device checklist](docs/controls-v1.md). Physical Xbox hardware, Bluetooth/USB drivers, haptics and iPhone Safari require real-device testing; injected Gamepad API snapshots and Chromium touch/viewport checks do not establish those results.

## Campaign vertical slice

Finish three laps through every required gate, then follow the exit navigator. The gate opens in about 0.8 seconds; throttle, steering and momentum remain active. **Race results** opens the three-lap classification and local score saving; **Back to the boat** closes it. Viewing results releases held inputs while the boat coasts. Restart / R stages a new Track 1 race and retains tuning and saved records.

**Willow Run** has a gentle downstream current opposing your ascent. Gold checkpoint flags turn teal as each forward crossing is accepted. Bonus points reward pace between checkpoints and clean navigation; a bank hit removes that leg's clean bonus. The small side ramp is optional, with an unobstructed central bypass. Its short ballistic hop retains horizontal momentum and awards a one-time landing bonus. Missing a gate shows a return cue; it does not teleport or reset the boat. At **Mātai Basin**, keep exploring the oval waterway. Further races, fuel, shops, economy and the remaining campaign are outside Phase 1.

`campaign-data.js` declares **eight tracks and seven progressively harder river links**. Only Track 1 / River 1 / the Track 2 placeholder are authored/playable; other entries are explicitly planned. Course/river definitions use metres/seconds, stable IDs and a serializable graph. Reusable factories and a rendering-independent progression controller accept definitions; Three.js scenery and UI remain separate. This creates portable boundaries for future development without starting an Unreal migration.

Destination water and collision topology are prepared at startup as part of one bounded world. During river travel, five incremental jobs prepare the destination's signs, dock, markers and island landmark, then batch them into at most six material meshes. Bends, riverside trees and distance culling conceal that preparation. This is bounded preparation of the first slice, not a full eight-zone streaming implementation.

## Automatic tuning persistence and development tools

All existing registered game/physics/water/spray knobs, V8 settings, graphics and per-mode camera tuning save through their original handlers. Their stable keys and versioned envelopes are retained: `jet-sprint-settings` (schema 3), `jet-sprint-v8-settings` (schema 1), `jet-sprint-summer-graphics-v1`, and `jet-sprint-cameras-v1`. Release metadata never selects defaults or a new key. Game/audio flush on page hide; graphics/cameras save on change. Category/factory resets and preset/JSON workflows remain. The stationary dyno's throttle is a transient input, not a stored tuning parameter.

Campaign best times, bonus records and the Track 2 milestone use the separate `jet-sprint-campaign-v1` envelope. Restarting a run does not erase them. Same-origin GitHub Pages deployments replace files without clearing localStorage. Exports remain the portable backup if the host changes or site data is cleared.

Run `npm run dev`, then open **Pit Control → RACE → Debug Tools → Campaign diagnostics / DEV** for course, state, laps, gate, river checkpoints, preparation status and FPS. **Practice: bonus river** / **Practice: Track 2** deliberately relocate the boat for testing and cannot unlock campaign progress. This panel and its shortcut API are excluded from production; the normal game contains no transition teleports. Physical iPhone Safari and sustained mobile FPS remain unverified.

## MARINE-87 interface and ballistic spray

**Russo One** renders titles, race headings, timer/lap instruments and prominent numbers. **Chakra Petch Medium/SemiBold** renders functional labels, menus, buttons and tuning. Both are bundled as local WOFF2 files with complete OFL notices. Canvas signs/debug labels share these families, wait for loading before texture creation, and repaint after a late load. Reused fixed-width glyph cells keep live numbers steady. Development mode logs loaded font faces and computed families; inspect them with `__JET_SPRINT_FONTS__.inspect()`. Browser platform-font reporting also confirms actual custom glyphs. See [font attribution](public/fonts/ATTRIBUTION.md).

Each airborne drop starts at the transformed local **-X stern** with a rearward launch and configurable inherited translation. Its numeric world-space velocity/position then advance at **120 Hz** with Y-axis gravity; subsequent steering and boat rotation cannot redirect it. Interpolated instanced billboards render the pool. Water contact retires the airborne drop and creates a brief surface foam ring. The attached curve/core and old comparison particle implementation have been removed. Hull sheets still respond separately to slip and lateral load; propulsion, steering and historical wake direction are preserved.

Open **Pit Control → SPRAY** for eight saved controls: launch speed, upward angle, gravity scale, inherited velocity, spread, particle density, maximum lifetime and splash intensity. Each has a numeric readout and individual reset. **Reset spray defaults** changes only those fields; values use the existing game-settings/preset mechanism. Original reach/volume/effects controls remain in the surface-wake disclosure. See [audit, exact changed files, render evidence and validation](docs/marine-87.md).

## Arcade interface

The MARINE-87 identity uses rounded navy instrument housings, warm cream faces, burnt-orange switches, faded racing red and muted teal. Reusable tokens and components define substantial radii, restrained bevels, shadows, pressed/focus states, sliders, toggles, tabs, selects, dialogs and readouts. Open **PIT CONTROL** from the title screen or toolbar. Its **RACE / HULL / SPRAY / VIDEO / V8 / VIEW / INPUT** tabs reuse the actual bound settings, physics, graphics, sound and camera panels, with the new spray panel integrated into the same console. The console scrolls above the driving buttons and applies changes live; opening it releases held inputs. It does not pause a race. Closing or leaving V8 ends a stationary engine test so a hidden test cannot leave the clock frozen.

Every numeric tuning slider has its original live readout and an individual reset button. Existing category/factory resets, saved presets, file imports, JSON sharing, telemetry, debug tools and storage keys remain available. Arrow keys/Home/End navigate console tabs; Escape closes the console and restores focus. Destructive full-game preset operations use a styled confirmation dialog. Camera cycling remains one tap in the top toolbar.

The HUD pairs a prominent rounded run timer and compact lap indicator with an analog-inspired speed needle, teal RPM arc and the engine's **actual RPM**, a minimal route cue and round starting lamps. Touch steering/throttle rails share the rounded, tactile surfaces. Reduced-motion preferences disable transitions, route-cue animation and needle smoothing. Native input semantics, comfortable touch targets and safe-area spacing support keyboard and touch. Existing title/setup, countdown, results/leaderboard and all seven tuning departments receive the same treatment. The input release/pause menu uses the retained housings and typography.

See [current QA details and screenshots](docs/marine-87.md). No dependencies were added. The earlier MARINE-87 Chromium checks covered 110 live sliders, preset workflows, phone-sized simultaneous touch, reload persistence, results using a completed-race fixture, and 320×568 through 1920×1080 layouts. Physical iPhone Safari and sustained mobile frame rates remain unverified.

## Boat Physics Lab

Open **PIT CONTROL → HULL** during play or from the title screen. The scrollable drawer ends above the steering/throttle buttons and keeps the race running. Its six collapsible categories expose 37 live sliders for propulsion, waterjet steering, force-based banking, planing, drift/grip and damped water response, plus banking inversion. Each category has its own reset; **Restore factory physics** restores Balanced without changing graphics, cameras, audio or saved presets.

**Balanced** is the new-user default: 85 km/h nominal target, 65% drift, 75% steering response and a 9° maximum bank angle. **Arcade** gives quicker response and stronger recovery. **Simulation-Inspired** adds inertia and more demanding cornering. Old valid handling values migrate additively and take precedence over new defaults; a changed tune displays **Custom**.

Open **Custom presets & JSON** to save, update, load, rename or delete a physics-only preset. Export/copy, paste/import and JSON file import are available. Physics JSON and category resets leave unrelated settings untouched. Custom physics presets have their own collection; older full-game presets remain available in **RACE → Saved Presets**. Enable **Show live physics telemetry**, then close the drawer to see real speed/input, yaw, actual/target roll, lateral slip, thrust, planing and preset values.

Thrust builds with pump pressure and the stern nozzle produces both propulsion and yaw. Lifting throttle removes most steering authority; velocity continues independently of heading. The hull now banks from lateral acceleration, rises onto plane and follows a lightweight deterministic sample of the existing wind/wake field. This adds no fluid solver or GPU readback. Diagnostic waves in the optional GPU fluid solver are not sampled by the hull; see the documented approximation. Spray follows actual thrust and stern height, and V8 load includes propulsion load. No new audio settings are introduced.

## Graphics Quality Lab

Open **PIT CONTROL → VIDEO** for live water, spray, lighting, atmosphere, scenery and resolution controls. Use **Low** for older phones, **Medium** for modern phones, **High** for desktop, or **Ultra** for stronger desktop GPUs. Low disables shadows/postprocessing/live reflections; Medium retains soft shadows and sky reflections. High/Ultra add live reflections, more waves/particles/vegetation and larger shadow maps. The FPS switch reports the current animation frame rate; no physical-device benchmark is implied.

The Lab saves separately from gameplay, audio and camera preferences. **Copy settings JSON**, **Paste JSON**, **Import JSON** and **Reset graphics defaults** operate on graphics only. The render budget is linked to the existing Graphics selector. Device pixel ratio and the budget can cap effective resolution and shadow size. Previous graphics JSON/settings remain readable. New coarse-pointer devices default conservatively to Low (Medium when reported memory is above 4 GB); desktop defaults to High. Manual choices persist.

**Water material comparison** switches between the previous and current water materials in the same live scene. Both use independent ballistic spray; there is no attached plume fallback. This temporary comparison choice is not saved. Older full-build captures in the rendering notes describe historical releases.

New sessions default to the lightweight procedural water renderer. Existing saved water-mode and diagnostic-wave choices are respected. Simulated water remains available under Water Physics; it allocates GPU resources only when selected, and releases them when you return to procedural/legacy water. Both renderers share HF water appearance controls. Older wave-height, spray-distance and water-volume controls still apply alongside the Lab.

## Racing cameras and Camera Lab

Standard courses default to **FLAT_TRACK_FIXED**: a stationary three-quarter camera fitted to the actual racing-course bounds, with channel/bank margins. The boat moves through the course. An optional ring improves visibility; Camera Lab warns when the boat projects below 9 pixels. The camera does not automatically chase or zoom during normal flat racing.

Crossing a valid river gate triggers **RIVER_TRANSITION**, a live two-second crane sweep into **RIVER_FOLLOW**. The river view tracks from above/behind with smoothed heading, bend anticipation, speed pullback and a longer view ahead. Boat input, physics, audio, spray and race progression continue. Arrival sweeps back to the next course’s fixed view. Restart/practice selection restores the appropriate camera. Normal motion never resets the boat.

**Pit Control → VIEW → Camera Lab** has Flat-Track, River Follow and Cinematic Transition sections. All numeric controls have readouts/units/resets. Compare perspective and true orthographic flat projections, auto-fit the course, tune the river boom/lag/banking and sweep duration/arc/easing/focus. **Test Transition** previews without altering progression, **Skip Transition** finishes the sweep, and **Reset Transition** restores only its tune. Per-course presets automatically save under **`jet-sprint-racing-cameras-v2`**, schema 2. The selected course owns its outgoing river/sweep settings. Copy/export, file download, text/file import and course reset are available. Existing `jet-sprint-cameras-v1` values remain intact.

The existing camera-cycle button and Xbox View action opt into the retained legacy comparison modes. **Use automatic gameplay cameras** or Restart returns to the new primary system. The lab’s course dropdown edits that preset; use the level selector under RACE to preview another venue live. The Campaign overview remains a diagnostic override.

See [implementation, screenshots, changed files and verification](docs/arcade-river-camera.md). Physical iPhone Safari, real Xbox hardware and sustained 60 FPS remain unverified.

## Local development

Use Node.js 22.12+ (or 24) and npm:

```sh
npm ci
npm run dev
```

Open the address Vite prints. On a phone on the same network, use the computer's LAN address and port 5173. Allow access through your local firewall. Rotate the device to landscape for the widest course view; portrait phones show a rotate prompt, and landscape uses the new course/river cameras.

Press **HIT THE WATER** to unlock audio and begin. Hold THROTTLE and either steering button simultaneously. On desktop use **W / up arrow / space** for throttle, **A/D / left/right arrows** for steering, and **R** to restart. Release throttle to coast; reapply throttle to steer and recover a slide. Slide through bends and carry momentum. Bank contact slows and redirects the boat without ending the run. The setup panel adjusts top speed, drift retention and steering response; new-install defaults are 85 km/h, 65%, and 75%. Existing saved values are preserved.

A READY stage and the saved lamp countdown hold the boat at Rookie Run’s stripe while allowing engine revving. Green releases the boat and starts the timer together. Later venue staging retains boat control and momentum; timing starts only after green and a forward start-line crossing. Follow the prescribed route through all ordered gates for three laps. Wrong turns require recovering the missed gate while the clock continues. Results/local leaderboards remain available, including backward-compatible reading of old five-lap records. There is no reverse throttle, opponent AI, ghost or network play.

See [v0.7.1 navigation and Bigfoot notes](docs/v0.7.1.md) for the checkpoint fix, both debug systems and validation. See [v0.7.0 build notes](docs/v0.7.0.md) for recommended handling values, settings migrations, changed files, validation and the physical iPhone checklist. Older release sections below describe their historical behavior.

## Checks

```sh
npm test
npm run build
npm run preview
```

Node tests cover the full seven-event continuous input/physics route, four three-lap courses, rewards/replays/idempotency, saved-data migration, checkpoint/start rules, worker lifecycle/disposal/tile seams, plus the existing controls, handling, cameras, V8, spray and fluid suites. Build output is in `dist/`. Vite reports its existing large-chunk advisory (about 267 KB compressed for the main module). Browser checks should cover launch/audio unlock, simultaneous steering/throttle, pointer cancellation, drift recovery, restart, background/resume and portrait/landscape. Test on an actual iPhone in Safari before claiming iPhone performance. Audio can depend on device mute and volume settings.

## GitHub Pages

Push this repository to GitHub, then select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included `Deploy GitHub Pages` workflow runs tests and builds on pushes to `main`; it can also be run manually. It uploads `dist/` and deploys with the official Pages actions. Relative Vite asset paths support a project subdirectory such as `/Jet-Sprint/`. No paid services or secrets are needed. Deployment requires repository Pages permissions.

Every production build writes `dist/build-info.json` with the release identity, **`four-track-1987`**, **`wallet-v2`**, **`worker-tiles-v1`**, retained **`analog-input-v1`**, commit and SHA-256 hashes of all served assets. After deployment, **Verify actual published build and font files** fetches the real Pages manifest, requires the current commit/markers, requires **`recorded-world-poses-v1`** and **`portable-data-v1`**, then downloads and hashes the actual HTML, JavaScript (including the worker), CSS, icon, font and license files. A stale or mismatched publication fails the workflow. Review its deployment job/summary, not just the green build job. To check a served build yourself: `node scripts/verify-deployment.mjs https://soulmullet.github.io/Jet-Sprint/ FULL_COMMIT_SHA`. For a local preview built without `GITHUB_SHA`, use `local` as the expected commit.

## Code map

- `src/main.js`: course/boat rendering, pooled spray and wake, camera, input integration/pause, lap checkpoints and HUD.
- `src/campaign-data.js` / `src/campaign-world.js`: serializable courses/rivers and shared world-space topology, sampling, collision and staging paths.
- `src/campaign-tour.js` / `src/campaign.js`: seven-event lifecycle, original gate/checkpoint/jump behavior and isolated river forces.
- `src/campaign-rewards.js` / `src/campaign-progress.js`: validated reward transactions, versioned wallet, migrations and milestones.
- `src/campaign-streaming.js` / `src/campaign-chunk-{geometry,worker}.js`: bounded incremental scenery lifecycle and off-thread triangulation.
- `src/campaign-{presentation,scenery,whitewater,ui}.js` / `src/campaign.css`: gates/markers/scenery, standing crests, progress/rewards and series records.
- `src/controls.js` / `src/control-input.js` / `src/control-gamepad.js`: physical device adapters, shared normalized commands and Gamepad profiles/safety.
- `src/control-settings.js` / `src/control-lab.js` / `src/gamepad-menu.js` / `src/controls.css`: independent persistent input tuning, live diagnostics, controller menu navigation and analog hardware styling.
- `src/physics.js` / `src/handling.js`: fixed-step waterjet dynamics and shared handling defaults.
- `src/hull-motion.js` / `src/boat-presentation.js`: force-driven visual springs, water sampling and the hull/engine render transform.
- `src/physics-lab.js`: six-section Lab, physics-only custom presets/JSON and optional telemetry, using the existing settings store.
- `src/course.js` / `src/track.js`: independent waterway graph, prescribed route, directional gates and shared clipped channel geometry.
- `src/navigation.js` / `src/route-math.js`: turn instructions, scoped route projection, recovery and HUD.
- `src/debug-views.js`: optional numbered gates/route diagnostics, Bigfoot marker/path/status and trigger/reset controls.
- `src/audio.js`: interaction-unlocked harmonic V8 synthesis (an approximation, not a recording).
- `src/design-system.css` / `src/style.css` / `src/typography.js`: shared font loading, canvas typography, stable numeric glyph cells and responsive interface styling.
- `src/spray-frame.js`: reused boat-local nozzle/chine transforms and airborne launch calculations.
- `src/interface.js` / `src/ui-components.js`: shared Pit Control shell, range resets, tabs, tooltips, confirmation dialog and focus handling.
- `public/fonts`: three locally bundled OFL fonts and their attribution/licenses.
- `src/hf-{water,reflections,effects,wake,scenery,boat-details,venue-materials}.js`: active HF rendering components.
- `src/graphics-lab.js` / `src/summer-settings.js` / `src/summer-post.js`: quality/persistence/UI, live renderer settings and optional postprocessing.

The renderer uses preset-dependent pixel density (up to 2 on Ultra), bounded GPU particle pools, instancing, foliage LOD and optional shadows/reflections/postprocessing. Physics runs at 120 Hz with bounded catch-up after pauses. No real-device frame-rate benchmark or physical iPhone test has been performed. Historical release sections below describe previous rendering behavior.

## v0.2 changes and validation

The existing winding course is 42% longer/wider in world dimensions, with water half-width increased from 5.9 to 7.3 and shared collision clearance. The boat, lap checkpoints, 85 km/h top speed, 65% drift, restart, and bounded water effects remain. Steering defaults to 85%, with fast smoothed turn-in and recovery. The stable isometric follow camera prioritizes nearby water and the approaching course; landscape overlays accommodate safe areas.

Pointer capture and independent per-control sets support throttle plus steering, multiple fingers on one button, and mixed keyboard/touch. Cancellation, capture loss, blur, backgrounding and restart clear input. Play surfaces cancel touch/gesture defaults and context menus; document-wide touch restrictions and viewport zoom limits were removed.

Audio uses two eight-pulse exhaust banks per two crank revolutions, filtered harmonic texture, a bass layer, gentle saturation, output compression, separate intake/jet noise, and smoothed 900-RPM idle/load/speed response with lift-off burble. Audio is initialized/resumed only from a gesture and suspended on blur/background. This remains procedural synthesis, not a sampled engine recording.

Validation: `npm test` covers multitouch state, repeated presses, cancellation, capture loss, mixed keyboard input, release, speed convergence, steering response/recovery, drift and enlarged bank bounds. `npm run build` passes; the existing Three.js bundle-size advisory remains (~135 KB gzipped). Chromium production-build checks at 390×844, 844×390 and 375×667 found visible controls, correct canvas sizing, working acceleration and blur cleanup, and no JavaScript errors.

Physical iPhone Safari testing is still required for rapid-tap zoom suppression, simultaneous real fingers, long presses, rubber-band behavior, rotation/browser-toolbar changes, background/audio resume, sound quality through headphones/speakers, and sustained frame rate. No real-device performance or subjective V8 audio validation is claimed.

## v0.3 speed, water and forest update

Track investigation found bend radii as small as **4.81 world units**, below the **8.4-unit bank half-width**. The old offset ribbon therefore folded over itself at inside corners, producing overlapping triangles and flipped normals/dark wedges. `src/track.js` now unions rounded channel segments and triangulates their outer boundaries and holes once at startup. This replaces the defective geometry rather than hiding it. Collision projection now uses continuous line segments rather than isolated samples, removing sample-transition corrections. Genuine shore contact still redirects/slows the hull; the 0.8-unit center clearance intentionally protects its width. These code findings explain plausible artifact/slowdown sources; matching every reported mark on a physical device remains a verification step.

Acceleration defaults to 21 m/s² (was 15); drag scales with acceleration to retain the 85 km/h default terminal speed. Top speed is adjustable from 85–120 km/h. Setup also exposes acceleration (15–28), camera response (3–12), and effects (0.5–1.5). A smooth 5-unit speed pullback, animated surface ripples, and the longer wake strengthen motion cues. Steering/drift remain 85/65. Steering touch targets are approximately 30% larger.

The V8 now emphasizes lower harmonic rolloff, a stronger exhaust/bass balance, a one-crank-order bass layer, and stronger low-speed pump load. Compression is followed by a bounded 0.88-peak soft output ceiling. Audio loudness and character still require listening on iPhone speakers and headphones; a numerical ceiling cannot establish subjective sound quality.

Spray uses a bounded pool of 800 fading circular particles in one draw call. Throttle, acceleration, lateral slip and speed affect emission and velocity; high-speed jet trajectories span roughly 3–5 hull lengths relative to the moving boat. Existing foam rings remain. No per-particle objects or allocations occur during updates.

`src/bigfoot.js` creates one low-poly dark-brown humanoid. Most sightings are slow peeks; rare walks swing its long arms/legs with a hunched posture. Candidate paths are checked for land clearance and have concealing trees at each end. Sightings wait 45–120 seconds, prefer visible screen edges, and 20% of sessions disable sightings entirely. There are no notifications or gameplay collisions.

Validation: production build and Node regression suites pass, including upward-facing water normals, continuous segment projection, and valid-water collision clearance across bends. Production Chromium checks passed at 390×844, 844×390 and 375×667, including two simultaneous touch contacts, cancellation, blur cleanup, and no page JavaScript exceptions. Bundle size is about 145 KB gzipped; the existing Vite chunk advisory remains. Physical iPhone Safari checks are needed for actual audio quality/loudness, rapid tapping/zoom, long-press and multitouch behavior, 60 FPS under sustained spray, visual corner cleanup throughout complete laps, plume appearance, and rare Bigfoot concealment from different camera positions. Desktop software rendering is not a phone performance benchmark.

## v0.4 interactive water and five-lap races

- Racing now uses four ordered directional gate crossings per lap. Five completed laps freeze the clock/boat and open results with millisecond lap, total, best and average times. Restart resets the race and unlocks input. The results screen saves a short display name and opens a **local, device-only** leaderboard. A schema-v1 record contains an ID, course, gameplay version, modified flag, five lap times, total and date. Each course/version/modified group retains ten fastest unique race IDs. Any speed/drift/steering/acceleration deviation during a race permanently marks that race modified, even if settings are restored. Storage failures leave results usable and display a save error.
- The top-speed slider maximum extends from 120 to **180 km/h**, retaining 85 km/h default and all lower values. Above 120, acceleration scales up to 1.5×, turn response up to 1.1× and camera response up to 1.2×. Physics remains fixed at 120 Hz (about 0.42 m travel per step at maximum speed), with intentional shoreline response retained.
- Spray Distance and Water Volume sliders cover 0–200%, default to 100%, and persist locally. Backward ballistic velocity and bounded emission density react immediately to new settings. The 800-slot particle pool now includes splash mist/foam and reuses 90 expanding ripple rings. Splash events are checked against visible water; surface shading has continuous moving highlights, animated normals and a boat-local bow/wake field. The clean union channel geometry remains unchanged. Water effects are decorative and exert no collision forces.
- Bigfoot is 40% larger. Two distinct throttle presses within 300 ms provoke a visible nearby actor; a hold or an additional simultaneous finger does not count as another press. His chase follows a land-constrained direction toward boat progress, rejects water/tree moves and gives up after eight seconds or a blocked path. Retreat retraces checked positions, then returns to a concealing tree. A bounded history of ballistic spray envelopes tests actual travel age before triggering a flinch, raised arms, grunt and retreat, interrupting a chase. Interactions have cooldowns and never affect race scoring or boat collisions. Existing occasional peeks and walks remain.
- V8 synthesis retains the exhaust pulse foundation and output ceiling, adding a stronger low layer, short 85 ms reflection and a very quiet 18 ms modulated delay for richness. Dry sound remains dominant for mono compatibility. Parameters are grouped in `audioTuning`; brief procedural Bigfoot vocalizations share the output limiter.

Validation includes race direction/order/five-lap completion and clock freeze; standard/modified score separation and deduplication; double-tap timing; 180 km/h convergence and bank bounds; ballistic spray reach; Bigfoot land clearance, interaction cooldown and delayed splash reaction; and existing track/controls suites. Production build passes with the existing Vite large-chunk advisory (~149 KB gzipped). Browser checks verify real slider persistence and the five-lap results/save/restart UI using test-only interception (no instrumentation ships). Production mobile-size checks cover 390×844, 844×390 and 375×667, simultaneous throttle/steering, cancellation and blur release.

Physical iPhone Safari validation is still required for 60 FPS under maximum volume/speed, subjective bass/echo/mono sound, touch double-taps and zoom prevention, plume arcs/splash visibility, Bigfoot pursuit/retreat around all scenery, browser toolbar rotation changes, and full player-driven five-lap races. This is not a global or cheat-resistant leaderboard. The existing GitHub Pages workflow is retained.

## v0.5 graphics overhaul

This release keeps v0.4's physics, audio, controls, five-lap race rules, spray trajectories and leaderboard schema. Scores continue using gameplay version `0.4` so this visual-only update retains existing compatible records.

- **Lighting and water:** warm directional sunlight, hemisphere skylight, ACES tone mapping, atmospheric haze and a generated environment map provide a consistent PBR palette. One boat-following directional shadow system uses 512/1024 maps on Medium/High. Water uses an aligned 512px procedural channel-depth texture, shallow/deep coloration, shoreline foam, animated normal perturbations, sun/environment highlights, a Fresnel approximation and the existing localized bow/wake field. These are lightweight surface-shading approximations, not physical fluid displacement or real-time scene reflections.
- **Boat and spray:** a curved, bevelled racing hull surrounds twin seats, metallic cage, exposed V8 covers/intake/headers, trim and a visible jet nozzle. Static parts batch into five shared-material meshes; the existing banking/bobbing behavior remains. Sun-tinted soft circular spray has greater screen presence while retaining the ballistic pool, splash foam/ripples and gameplay reach model. Quality affects density, not trajectory or collision reach.
- **Environment:** generated ground texture and land-only terrain variation replace the flat ground slab. Three evergreen proportions use tiered foliage, varied instance colors and trunks; instanced shrubs/rocks, logs and stumps populate tested land. Vegetation batches refresh at 0.5-second intervals with camera-distance limits and preset-based density. Course markers use two instanced meshes. Scenery adds no boat collisions. Bigfoot retains all behaviors with rounded body/limbs, muzzle, instanced fur tufts and directional shadows.
- **Camera and quality:** speed smoothly widens the existing 43-degree camera by up to two degrees, retaining follow angle/lookahead. Low/Medium/High cap DPR at 1/1.35/1.7, use 45/70/100% particle density, vary foliage coverage and water detail, and disable/enable shadows. Auto starts at Medium, samples six-second windows, reduces quality below 45 FPS, and only increases it after three windows above 57 FPS. Hidden-tab intervals are excluded; the user's selected mode persists under `jet-sprint-graphics`. Water sliders and their saved settings remain separate.

All visual assets are generated locally with Three.js and Canvas; there are no new external asset downloads or licenses to verify. `src/visuals.js` owns visual construction and `src/graphics.js` owns the quality policy. No postprocessing chain or screen-space reflection pass is required.

Validation: seven Node suites pass, including the complete boat geometry merge, graphics persistence/Auto behavior and all existing physics/track/Bigfoot/race/controls suites. Production build passes (~155 KB gzipped JavaScript; Vite's existing large-chunk advisory remains). Chromium checks exercised all quality modes with no shader or JavaScript errors, plus test-only instrumented five-lap results, leaderboard save and restart. In a sampled 390×844 idle camera view, optimized rendering used about 58 draw calls versus roughly 267 in the initial unbatched v0.5 implementation; triangle counts were about 44–46k depending on preset and visibility. These are desktop software-rendering samples, not an iPhone frame-rate benchmark.

Physical iPhone Safari testing remains required for sustained FPS/thermal behavior, Auto quality thresholds, real-device shadow/water appearance, DPR/resizing/orientation, Safari gesture prevention and multitouch, complete player-driven races, and Bigfoot/spray visibility in motion. The result is a procedural PBR arcade presentation; photographic foliage, displacement-based water and per-part boat LOD are not implemented. The existing GitHub Pages workflow remains unchanged.

## v0.6 — Phase 1 shallow-water foundation

**Scope:** this release implements the water foundation only. The boat's arcade physics, locked camera angle, audio, controls, spray sliders/trajectories, Bigfoot behaviors, race clock and local leaderboard remain unchanged. Boat forces and rooster-tail injection are **not coupled** to water yet; that is Phase 2 and requires separate approval. Gameplay version `0.4` remains in compatible leaderboard records.

### Solver and rendering

`src/fluid/numerics.js` defines the numerical contract and a CPU validation oracle. Actual gameplay runs `src/fluid/shaders.js` through `src/fluid/solver.js`:

- A bounded 144 × 144 metre Cartesian domain covers the whole course. Bathymetry is derived from distance to the existing continuous channel centreline: about 0.18 m at the bank to 1.13 m centrally, with a static impermeable land mask. The synthetic bed is an inferred channel floor, not a surveyed terrain asset. Outer grid faces and land interfaces reflect normal momentum. Wet/dry transitions inside the fluid mask use hydrostatic reconstruction; floodplain overtopping is outside this phase.
- Cell state contains depth `h` and momenta `hu`, `hv`. First-order finite-volume HLL fluxes use hydrostatic reconstruction and per-face bed-pressure corrections to preserve a lake at rest over a variable bed. The first fullscreen pass computes donor draining and receiver-capacity limits; the second applies the same conservative limited flux to both sides of each face, then bed/friction/queued momentum sources. Implicit friction and a 6 m/s water-flow speed cap damp extreme forcing. A conservative 4 m depth-capacity bound preserves volume while maintaining the design CFL bound; this is a safety restriction, not a model for arbitrarily deep/violent floods.
- Fixed steps are `min(1/120, 0.24*dx/(6 + sqrt(g*4)))`, with at most four steps per rendered frame. Excess wall-clock time is dropped instead of accumulating an unbounded catch-up queue; simulation slows under sustained low FPS. The UI supports 64²/96²/128²/192² grids. Auto follows Low/Medium/High graphics at 64²/96²/128². Changing resolution rebuilds bathymetry and resets water; it does not conservatively remap a live field across grids.
- WebGL2 and `EXT_color_buffer_float` (or half-float-only `EXT_color_buffer_half_float`) are checked, then RGBA32F/RGBA16F framebuffer completeness is probed. State uses nearest texel sampling, so no floating-point linear-filter extension is required. RGBA32F is preferred. The half-float path uses the fourth state channel for a compensated depth residual, greatly reducing mass drift from half-precision rounding; horizontal momenta remain half precision. Shader failures or target allocation failure retry at 64² where applicable, then retain legacy water. Missing capabilities disable the simulated option and explain the fallback.
- A regular polygonal surface samples **actual bed + simulated depth** in its vertex shader; surface normals come from elevation gradients. Water/land clipping and elevation, flow and wet/dry debug colors use the same field. No sine-wave displacement substitutes for the simulation. Grid-aligned shorelines remain visibly coarse at low resolution. The retained legacy water is available for comparison.

At 192², the three RGBA32F render targets occupy about 1.7 MiB; initial-state and terrain textures add about 1.1 MiB before surface geometry and driver overhead. Memory and work remain bounded. The game never reads the full grid back each frame. The full-grid reads in the browser harness are explicit validation only.

### Controls and API

Open **Game Settings** for Water mode, Simulation grid, Water debug, **Test ripple**, and **Reset water**. Race restart seeds one small, mass-neutral radial momentum demonstration ahead of the starting boat. Test ripple adds a bounded impulse near the current boat position; it is a manual numerical demonstration, not boat coupling. Reset water restores the exact still initial state and clears queued forces/timing. Simulation pauses with gameplay/backgrounding and is not stepped in legacy mode. Reset and comparison do not affect lap timing or score eligibility.

`ShallowWaterSolver` exposes `update(seconds)`, `reset()`, `texture`, `bedTexture`, `injectForce({x,z,radius,impulseX,impulseZ,radial})`, and `samplePoints([{x,z}, ...])`. Injection is a bounded, queued velocity impulse applied to momentum, not added water. The sparse sampling API accepts at most eight points and returns depth, elevation, horizontal velocity and wetness, or `null` if driver readback is unavailable. It is synchronous and intended as a clean Phase-2 entry point; gameplay does not call it. A future coupling implementation must budget/async sampling and validate forces before using it in the boat loop.

### Validation and limits

Run `npm test` and `npm run build`. For the actual GPU tests, run `npm run dev` and open `/test/fluid-browser.html`. The harness compares GPU states with the CPU reference, checks variable-bed equilibrium, closed-domain conservation, wetting/drying, solid obstacles, source injection, sparse sampling and exact reset. Both RGBA32F and compensated RGBA16F are forced independently. It also tests the actual course mask at 64² and 128². CPU tests cover reflected disturbances, strong wet/dry shocks, positivity, depth capacity, closed volume and missing-capability fallback.

Measured with Chromium's SwiftShader backend (numerical validation, **not iPhone performance**):

| Case | Simulated time | Relative volume error |
| --- | ---: | ---: |
| Float32 closed wave | 60 s / 7,200 steps | 5.43 × 10⁻⁹ |
| Compensated float16 closed wave | 60 s / 7,200 steps | 8.21 × 10⁻⁷ |
| Float32 actual course, 64² | 5 s / 600 steps | 3.71 × 10⁻⁸ |
| Float32 actual course, 128² | 5 s / 600 steps | 1.85 × 10⁻⁸ |

No negative depth was observed in these cases. The float32 small-disturbance GPU/reference maximum state error was below 4.1 × 10⁻⁷. The deliberately strong shock case reached the conservative depth limit without volume loss or negative cells; its maximum short-run GPU/reference state errors were 2.27 × 10⁻⁵ for float32 and 0.0296 for float16 (on momenta initially near 21 m²/s). Half precision remains less accurate for strong flow, despite compensated mass storage. Still-water tests showed zero volume drift; compensated float16 still-water velocities remained zero. Plain uncompensated half-float storage was rejected after measurable volume drift. Supported GPU capabilities on this test renderer included both float target formats; no unsupported physical iPhone model is inferred from these results.

Browser checks exercise all water debug modes, the simulated/legacy toggle, resolution rebuilding, reset, acceleration, simultaneous throttle/steering with cancellation, five-lap results, score save and race restart. The same gameplay checks pass with the float-render-target capability deliberately disabled, using legacy water. Existing GitHub Pages build/deploy configuration remains intact. The production bundle still has Vite's existing chunk-size advisory.

This is a first-order, dissipative shallow-water solver with a 3D rendered surface, **not 3D Navier–Stokes**. It does not model breaking waves, full jet fluid, dispersive ripples, open boundaries, evolving bathymetry, floodplain inundation, or two-way boat forces. Physical iPhone Safari testing remains necessary for extension availability, half-float residual/subnormal behavior, render-target/sampling support, shader correctness, sustained FPS/thermal behavior at each resolution, orientation/background recovery, touch behavior and full player-driven races. No mobile FPS measurement is claimed. Phase 2 has not begun.

## v0.6.1 — Visible waves and clipped shorelines (Phase 1 only)

Diagnosis on the previous build: GPU samples after the original single impulse ranged from −0.100/+0.013 m at 0.25 simulated seconds to −0.00239/+0.00179 m at ten seconds. Texture synchronization, coordinate mapping and vertex displacement were functioning; there was no per-frame reset. The unforced, first-order dissipative solver approached still water, while unit-scale displacement and weak surface contrast made its remaining motion hard to see at the existing camera scale. The camera and solver kernels are unchanged in this release.

The shoreline squares came from rendering the rectangular solver grid and using nearest wet/depth texels for fragment rejection and foam coloration. Debug mode was already off. The render surface now subdivides the **original union channel geometry**, preserving its full winding outline and holes, and uses manual wet-normalized bilinear field reconstruction. Land texels no longer contaminate elevation and normal estimates. Normal gameplay uses no cell-mask discard or rectangular cell-color foam. Wet/dry handling in the conservative simulation is unchanged.

`src/fluid/render-geometry.js` creates an indexed, shore-clipped mesh (~26,822 vertices / 52,379 triangles for the current course), cached across simulation-resolution changes. `src/fluid/surface.js` displaces it with reconstructed physical elevation, multiplied by a visual-only 0–300% slider (240% default). A smooth 0.65 m display bound and shore taper prevent exaggerated spikes and edge separation. Matching elevation derivatives drive interpolated normals, with stronger PBR highlights, Fresnel reflections and physical crest/trough contrast. Reconstruction runs in the vertex shader, with no new simulation pass or per-frame grid readback/upload.

A clearly labelled **Repeat diagnostic waves** checkbox defaults on. Every 1.25 simulated seconds it injects a bounded channel-aligned physical momentum impulse near the current view. This temporary Phase-1 diagnostic supplies actual traveling crests/troughs during normal gameplay; disabling it lets the solver settle naturally. It does not represent boat/jet coupling or feed forces back to the boat. Test ripple is repeatable manually; Reset water restores equilibrium until the next enabled diagnostic pulse. Visual height adjustment never changes solver state or stability parameters.

Larger troughs exposed another pre-existing issue: the bank mesh was a solid channel-wide sheet at −0.13 m, and the ground was only −0.21 m beneath the water. `channelBankGeometry` now subtracts the exact water polygon from the bank polygon, making a true bank ring. Only underwater ground vertices are lowered to accommodate troughs. The course footprint, bank outline, above-water scenery placements, forest, rocks, vegetation, physics and camera code are retained. No decorative covering meshes are used.

Verification: full-course area/containment and bank-ring regression tests; existing numerical, wet/dry, conservation, gameplay and fallback tests; production build; and fixed-camera browser snapshots at multiple wave times with no shader/JavaScript errors. The visual slider was checked at 0% and 300%. A 15-second GPU run with repeated impulses at 96² retained nonnegative depths, reached physical elevation ranges of roughly −0.23/+0.20 m, and had relative water-volume error 1.99×10⁻⁸. Original and traveling-wave screenshots show changing surface lighting and finish-stripe occlusion from actual deformation, with no shoreline grid squares. Physical iPhone Safari checks are still required for sustained performance, specular shimmer, wave readability and full-course visual review. Vite's existing bundle advisory remains. Phase 2 has not begun.

Files changed: `src/fluid/{render-geometry,surface,system}.js`, `src/track.js`, `src/visuals.js` (underwater floor only), settings integration in `src/main.js`, `index.html`, checkbox CSS, package versions, and `test/fluid-render.test.js`.

## v0.6.3 — Race starts and durable settings

A new `RaceStart` state machine drives READY → COUNTDOWN → RACING → FINISHED. READY lasts 0.65 active seconds, followed by the configured countdown (five seconds by default). Upper amber starts the countdown; lower amber joins at 60% of its duration (two seconds remaining at the default); green extinguishes both ambers and opens racing. One scheduled logical green timestamp governs lamp state, release and race timing. Late frames consume transitions once and play only the most recent signal, avoiding a burst of stale beeps. Backgrounding pauses the logical clock. Restart synchronizes the event timestamp, discards the old start and stages a fresh boat/race.

The new physical signal sits 13 metres normal to the start centreline on land and adds no collision object. It uses a weatherproof dark metal housing, brackets/bolts, recessed glass-like lenses, hoods, subtle scuff instances and soft emissive sprite glow; there are no extra point lights. The corresponding three-lamp HUD displays READY/SET/GO and fades after green. Engine revving during staging changes only audio RPM; physics and lap accounting are gated until green. Throttle remains held through release and accelerates using the existing boat dynamics. Countdown duration is captured when a start begins; duration changes apply to the next start. HUD, countdown audio and pre-start revving preferences can change live.

`Race.step` retains its checkpoint/lap behavior and now accepts an optional authoritative elapsed time. In gameplay, time is measured relative to green even when a slow rendered frame causes capped physics catch-up. The physics loop continues to use at-most-1/120-second substeps, including a bounded remainder at the end of a rendered frame. The clock cannot run during staging or after finish. Audio signals and pre-start RPM use the existing Web Audio graph; master mute/volume are applied after its limiter/ceiling and affect the engine, signals and Bigfoot sounds alike. Audio is still created/resumed only from user gestures.

### Settings and migration

`src/settings.js` is the single registry for all **20** existing/new options, with stable IDs, category, type, defaults, ranges/options and units. It includes every former slider/select/checkbox: handling, camera response, speed effects, spray distance/volume, water mode/resolution/debug, visual wave height, repeat diagnostics and graphics. The existing project has no separate user-adjustable wake width, wake length or solver damping sliders; their underlying behavior is retained, rather than adding new physics changes in this update. Audio and race-start preferences are newly registered.

Active settings use `jet-sprint-settings` with schema version 1, independent of game release version. Changes apply immediately and writes debounce for 250 ms; page hide/visibility events flush pending changes. Startup restores before applying values, migrates `jet-sprint-water` and `jet-sprint-graphics` if no new document exists, and preserves those old keys. An invalid legacy field does not discard unrelated valid fields. New IDs receive defaults; existing IDs retain values. Schema-0 aliases such as `topSpeed`/`steering` migrate explicitly. Unsupported schema versions and malformed imports are rejected; unknown keys are carried in exported `legacy` backup data and can be recovered when later recognized. Invalid saved documents are retained as backup text when practical. No settings operation reads, clears or writes the leaderboard key.

Exports contain schema version, informational game version, timestamp, all current values and retained legacy data. Imports accept JSON data only, reject invalid types/enums/structures, clamp numeric ranges/steps with feedback, and impose a 200 KB limit. Clipboard copy/paste has a visible text-area fallback, plus JSON download, file import and Web Share where supported. Names and imported text are rendered with text/value APIs, never executed as code or inserted as HTML.

Named presets use the separate `jet-sprint-presets` collection. Save/load/rename/delete are local to this browser. Reusing a name requires explicit overwrite confirmation; rename collisions are rejected. Reset affects active registered settings only and retains presets, backup keys and race results. Storage errors leave current controls and exports usable. Same-origin browser storage survives deployments but cannot survive a user clearing site data or guarantee recovery from an abrupt browser kill before the debounce flush; portable JSON is the backup route.

### Validation and preservation

New tests cover exact start thresholds/proportional timing, no staged propulsion/time, natural launch, restart, audio-only pre-start revving, complete registry coverage, all-setting refresh restoration, historical/schema migration, JSON validation/clamping, unknown data, preset CRUD/overwrite protection, storage failure and leaderboard-key isolation. Existing five-lap, physics, controls, GPU numerics, shoreline, graphics and Bigfoot tests pass. Production build passes with the existing Vite chunk-size advisory.

Chromium browser checks verified zero staged timer/velocity with held throttle, release at green, zero difference between the race clock and elapsed logical time from green, restart staging, preset save/load/rename/delete, JSON round-trip and refresh restoration. A separate instrumented run verified five lap results, save, restart and byte-for-byte leaderboard isolation after settings changes. No page/shader errors were observed. Test-only hooks were injected by the browser harness and do not ship.

The camera presentation block is unchanged, as are the course, shoreline geometry, GPU solver, water renderer, wake/spray dynamics and Bigfoot code. No next fluid phase is included. Physical iPhone Safari testing remains necessary for actual sound/beep balance, gesture audio resume, held multitouch at green, tower/HUD readability, clipboard/Web Share/download/file import, storage in private/restricted modes, orientation/background recovery and sustained performance. No physical-device test is claimed.

Files: new `settings.js`, `settings-panel.js`, `race-start.js`, `race-signal.js`; integration in `main.js`, `race.js`, `audio.js`, `index.html` and CSS; new settings/start/audio tests; package version and this README.
