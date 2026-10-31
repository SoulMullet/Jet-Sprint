# JET SPRINT — Unreal Engine migration foundation

This release remains a JavaScript/Vite/Three.js browser game. It contains **no Unreal dependencies, Unreal project, Blueprint assets or engine port**. The exported JSON is portable data; the JavaScript algorithms described below still require adaptation/reimplementation and verification in the target engine.

Open **Pit Control → GHOST → Development / portable data → Export Unreal-ready game data** for a snapshot of authored and cooked courses, collision descriptions, parameter registries, factory presets and current tuning. Replay JSON is exported separately from the library. Schemas are [foundation v1](schemas/foundation-v1.schema.json) and [replay v1](schemas/replay-v1.schema.json).

The active v0.23 entry mode is standalone River Runs. The export now includes `activeMode` and `primaryRiverLevels`: stable IDs, original environment IDs, rest-start poses, finish planes, revisions, unlock requirements and standalone replay descriptors. Archived circuit/bonus data remains in `courses`, `rivers` and `campaign`; it does not describe the current entry progression.

## 1. Current architecture

| Boundary | Current owner | Migration significance |
| --- | --- | --- |
| Device input | `controls.js`, `control-gamepad.js`, `control-input.js` | Touch/keyboard/Gamepad adapters produce normalized steering −1…1 and throttle 0…1. The processing kernel is independent of Three.js. |
| Boat dynamics | `physics.js`, `handling.js`, `physics-parameters.js` | SI force model and central parameter registry, normally stepped at 120 Hz. Thrust-dependent nozzle steering, yaw inertia, lateral grip/drag and bank response remain intact. |
| Official race | `race.js`, `race-start.js` | Ordered directional gate acceptance, original lap times, monotonic logical race clock and start sequence. |
| Primary river lifecycle | `river-levels.js`, `river-run.js`, `river-run-ui.js` | Reuses original river forces/checkpoints through a lifecycle adapter; independent rest-start timing, level bests, results and restart. |
| Archived campaign | `campaign-data.js`, `campaign.js`, `campaign-tour.js`, `campaign-progress.js` | Original topology, river current/jumps, circuits and rewards retained. No currency transactions in normal river play. |
| Course construction | `course.js`, `campaign-world.js`, `track.js` | Uses Three.js spline helpers and polygon clipping. Exports of its resulting numeric data are portable; these construction modules are not drop-in Unreal code. |
| Replays | `replay/model.js`, `replay/course-data.js`, `replay/session.js` | Fixed-interval recording, explicit world-pose interpolation, official event/split observations and route-progress comparison. No ghost physics resimulation. |
| Storage | `replay/storage.js`, existing settings/progress stores | IndexedDB for replay payloads/catalog/records; localStorage for small preferences. Replace browser adapters in Unreal. |
| Rendering | `visuals.js`, `boat-presentation.js`, `graphics-lab.js`, `fluid/*`, `hf-*`, campaign presentation/streaming | Three.js geometry, materials, instancing, render targets and GLSL. Requires new Unreal rendering implementations. |
| Camera | `racing-camera-manager.js`, `cameras.js`, camera settings | Existing river follow, archived fixed course/cinematic sweep, and comparison modes. `speed-framing.js` uses measured speed and exact response filters. Replays use a separate instance of this same controller. |
| Audio | `audio-settings.js`, `audio.js`, `v8-dsp.js`, `v8-worklet.js` | Parameter registry and presets are data. Web Audio/AudioWorklet wiring is browser-specific; DSP math is a reference implementation. |
| Interface | `interface.js`, labs, `replay/feature.js`, CSS | Native DOM controls and MARINE-87 design tokens. Reimplement screens in UMG; retain the interaction and tuning contracts. |

The main loop observes snapshots immediately after each existing physics/campaign step and hull-presentation step. The recorder does not own the boat, inputs, official race, water or rewards. Viewer playback freezes the live run and uses independent poses, clock and cameras; it cannot complete a gate or pay a prize.

## 2. Reusable data structures

The foundation pack is UTF-8 JSON containing:

- Authored campaign definitions and world-space course nodes, ordered edge visits, edge polylines, route samples with arc distances, and directional checkpoints.
- Waterway boundaries described as the **union of swept discs/capsules** over numeric `[x,z]` paths, with each path's water half-width. Real rock circles, hull clearance and join support settings are explicit.
- Boat mass (650 kg), reference yaw inertia (1,500 kg·m²), fixed step (1/120 s), all handling controls/units/defaults and the existing three factory profiles.
- Camera controls, normalized gameplay actions, input processing presets, Audio Lab controls/factory presets, graphics/lab ranges and current tuning.
- Replay field layout, format version and bounds.

The pack exports factory presets and live tuning. Existing named/custom Lab JSON exports remain separate and retain their original schemas/keys. It does not copy browser database internals or contain recorded sound, shader binaries, engine objects or executable callbacks.

Numeric data is reusable. JavaScript force integration, checkpoint code, splines, clipping, procedural meshes, DSP, browser event handling and GLSL need reimplementation or a deliberate compatibility layer. Merely parsing this JSON does not produce a playable Unreal version.

## 3. Three.js-specific components

`THREE.Object3D`, BufferGeometry, Mesh/InstancedMesh, ShaderMaterial, camera projection matrices, raycasters, texture/render-target ownership and scene traversal are renderer adapters. The procedural hull is currently authored in `visuals.js`; export/rebuild an appropriately licensed static mesh for Unreal rather than carrying Three.js objects across engines.

Hull motion computes visual roll/pitch/heave separately from planar dynamics. Its water sampling and pose convention should become an engine adapter. Ghost playback applies an explicit recorded transform and never invokes that motion solver again.

The browser's water renderer and optional GPU shallow-water diagnostic solver are distinct from the boat integrator. A migration needs an explicit decision about which visual/solver behavior to reproduce. Ghost files do **not** contain a historical water simulation, scenery state or V8 audio track.

## 4. Proposed Unreal equivalents

| Current concept | Suggested Unreal counterpart |
| --- | --- |
| Course/river definition | Primary Data Asset + import commandlet/editor utility |
| Ordered route polyline | `USplineComponent` plus retained baked arc-distance table |
| Gate plane/route acceptance | Gameplay component/C++ subsystem with numeric planes and edge ownership |
| Boat force controller | Fixed-step C++ movement component; visual mesh separate from simulation |
| Input processing | Enhanced Input adapters → normalized action frame → movement component |
| World-space ghost | Non-colliding Actor + mesh, driven by recorded transform samples |
| Replay kernel | C++ subsystem and versioned `USTRUCT` header/sample/event/official-result structures |
| IndexedDB repository | SaveGame/platform file adapter with atomic catalog/payload updates |
| Course/river preparation | World Partition or bounded level-instance/asset streaming |
| Water/wake/spray | Water materials, render targets and Niagara; retain world-space particle ballistics |
| Camera controller | PlayerCameraManager/camera components with fixed, follow and transition states |
| HUD/Labs | UMG widgets sharing a central theme and data-driven numeric controls |
| V8 worklet | MetaSounds/custom DSP operator or C++ audio generator |

These are implementation candidates, not newly created engine assets.

## 5. Blueprint versus C++

Use C++ for fixed-step boat integration, ordered gate acceptance, replay parsing/validation, recording buffers, quaternion interpolation, progress-to-time indexing, bounded storage and automated numerical parity tests. These systems benefit from explicit units, deterministic scheduling and allocation control.

Blueprints/UMG are good candidates for menus, telemetry channel selection, Lab layouts, results/record celebrations, scenery dressing, cinematic authoring and user-triggered replay actions. Data Assets should expose tuning ranges and presets. Keep a single authoritative physics/race state beneath these presentation layers.

Do not resimulate ghosts through a Blueprint boat controller or Chaos. They are recorded poses. Multiple future ghost Actors should consume independent playback channels while sharing the same official race clock.

## 6. Course spline and collision import

Start with the **cooked numeric route/edge polylines**, not an approximate hand-drawn spline. Three.js Catmull–Rom sampling and Unreal spline interpolation/reparameterization can differ. Preserve exported arc distances and checkpoint planes as authoritative while validating imported geometry.

1. Convert nodes and baked edge/route samples into the target coordinate system.
2. Build spline/mesh visuals from those samples. Keep ordered edge visits separately: a shared junction can be visited several times in different directions.
3. Import gate origin, tangent, half-width, distance and edge ID. Gate zero is start/finish; the first required race gate is index one.
4. Preserve the active-edge clearance policy: own-edge distance ≤ gate half-width + 0.2 m, and either nearest branch is the active edge or its clearance is within 0.6 m of the competing branch. Recreate the original nearest-segment queries; do not serialize a JavaScript `accept` closure.
5. Build collision from the **outside of the water union**, then account for the 2.5 m circular hull. Insetting every tributary separately recreates the previously fixed invisible internal banks.
6. Preserve real rock/gate collision. Rock padding is 1.2 m in the current controller. Ambiguous shoreline joins use 16 conservative support directions; this is not a general 3D hull solver.
7. Run forward/reverse gates, repeated-junction route visits, seam clearance and bank-impact parity fixtures before adjusting scenery.

The numeric export describes the current collision representation and policies. Unreal collision meshes, Landscape and WaterBody actors will require construction; the export does not generate them automatically.

## 7. Physics tuning migration

Retain SI quantities during parity work: metres, seconds, kilograms, newtons and radians for simulation state. The exported control registry declares each knob's unit; degree-valued controls such as nozzle authority and bank angle **remain degrees until the controller converts them**. Do not reinterpret every tuning number as radians because pose state uses radians.

Run the same 120 Hz integration schedule before introducing Chaos-specific response. Compare the existing test scenarios: straight acceleration/coasting, throttle-off steering, powered turns, drift recovery, bank/rock/gate collisions and 30/60/120 Hz substep equivalence. Keep force tuning separate from visual banking/heave/water response. Saved tuning belongs to stable versioned schemas, not release-number reset keys.

Matching parameter names alone does not guarantee matching handling. Reimplement equations, coordinate signs, order of operations and contact rules, then tune deliberately after numerical parity is understood.

## 8. Ghost replay compatibility

[Replay schema v1](schemas/replay-v1.schema.json) uses one completed **race or river bonus per file**. A shared `sessionId` and optional `previousEventId` link campaign events. Start/finish and river transition events are explicit. The exit cruise between a race finish and river entry is not part of the official timed files; there is no continuous seven-event replay editor in this release.

The 22 numeric snapshot columns are declared in `fields`: elapsed time; XYZ position; quaternion XYZW; XYZ linear/angular velocity; throttle; steering; horizontal speed; slip; heading; ordered course progress; completed laps; next checkpoint. Captures normally use 0.05 s intervals; the exact official finish sample can fall between grid ticks. Original checkpoint splits, lap times and total time are stored separately. Use double precision for official times and world coordinates.

Replay playback linearly interpolates movement/telemetry and uses shortest-arc normalized quaternion interpolation. Preserve exact snapshot endpoints. Changing the current physics tune cannot alter a recorded trajectory. At a stalled/clamped render interval, the recorder holds the last actual pose through time that was not simulated, then captures the next real step.

Compatibility requires the same course ID, route, geometry revision and boat configuration. Build/physics differences can be warnings because playback does not resimulate physics. Course geometry signatures use FNV-1a over JSON numeric water width/route samples/gates, quantized to 0.0001 world units; this is a compatibility fingerprint, not a security signature. The force-tune identifier groups personal records fairly; explicitly selected cross-tune ghosts remain playable with a warning.

Time delta uses ordered, unwrapped route progress with exact official split anchors and first forward traversals between gates. It does not use boat separation in world space. Keep lap number and required gate interval so intersecting channels cannot be confused.

For Unreal's X-forward/Y-right/Z-up convention:

```text
Position/linear velocity: UE = 100 * [webX, webZ, webY]  (cm, cm/s)
Quaternion XYZW:          UE = [-webQx, -webQz, -webQy, webQw]
World angular velocity:  UE = [-webWx, -webWz, -webWy]  (rad/s)
```

Swapping Y/Z changes handedness. Angular velocity is an axial vector, so it needs the extra sign; do not apply the position conversion blindly. A web +90° heading should become Unreal +90° yaw. Respect Unreal API degree/radian expectations and quaternion component ordering. Use Large World Coordinates or an explicit local origin when streaming later venues.

Validate before allocating: v1 limits files to 8 MiB, 36,002 snapshots, 1,024 events and 1,800 seconds. Check finite numbers, bounds, quaternion norms, fixed cadence, increasing timestamps, complete official splits, lap sums and the exact finish. Reject incompatible/incomplete files clearly. Future schema upgrades need explicit conversion readers; retain old recordings rather than silently deleting them.

Imports never award campaign money, unlocks or official personal records. The current library keeps old PB payloads when a new PB wins, and storage pressure cannot silently replace those files. A platform adapter should preserve this transactional behavior.

## 9. Audio parameter migration

`audio-settings.js` centralizes the existing V8 knobs and factory presets. RPM limits, response, load, idle instability, cam lope, exhaust/filter/resonance and output settings are exported with units and defaults. Existing Sound Lab exports remain compatible with the browser build.

Port the four-stroke firing/phase relationships and procedural DSP deliberately into MetaSounds or a custom C++ generator. Web Audio AudioParam scheduling, AudioWorklet lifecycle, browser gesture unlock and Safari restrictions have no direct Unreal equivalent. Compare sample-rate behavior, throttle/RPM response, limiter output and spectral/idle behavior with the existing DSP tests. Do not map percentages blindly to arbitrary Unreal effects.

The present Replay Viewer is silent and leaves the live engine paused; it does not reconstruct an original audio waveform. Optional replay audio should eventually use a separate generator driven by recorded telemetry, without touching the player's engine state.

## 10. Recommended migration sequence

1. Lock the portable schemas and build a commandlet/importer that reads current foundation/replay JSON.
2. Reproduce one baked course, gate acceptance and route-progress queries in a headless numerical harness.
3. Implement fixed-step boat movement and normalized input adapters; run the existing force/steering/contact scenarios against captured fixtures.
4. Reproduce a basic visual hull/camera and validate the recorded pose convention and coordinate conversion.
5. Implement world-pose ghost playback, official split comparison and atomic platform storage before changing physics.
6. Import all current courses/rivers and establish bounded streaming. Validate the uninterrupted existing campaign.
7. Rebuild MARINE-87 UMG screens, Lab bindings, records, viewer and telemetry around the same data contracts.
8. Port V8 DSP, water/wake/spray and atmospheric rendering in measured stages.
9. Test real mobile/desktop/console controls and platform storage, then profile on target hardware.
10. Add new content or deliberate engine-specific handling improvements only after the migrated vertical slice is reliable.

This update provides the data contracts, exports, ghost/replay kernels and documentation for those steps. It does not establish Unreal numerical parity or target-console/mobile performance.
