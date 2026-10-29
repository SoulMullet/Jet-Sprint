# JET SPRINT v0.12.0 — Summer 1987

A mobile-first, single-player 3D jet sprint prototype built with JavaScript, Vite, Three.js and Web Audio. All geometry and sound are procedural; no assets, account, API keys or backend required.

The active course is **Cedar Creek Figure Eight**, a compact two-loop circuit with one flat diagonal crossover and a separate staging inlet. A rustic race-office cabin, dock and moored boat, old pickup, 24 animated spectators and original local racing signs establish a Pacific Northwest venue in summer 1987. Open **Game Settings → Figure-eight overview** to see the layout; the default follow camera is unchanged. Look for **SUMMER 1987 · v0.12.0** plus the build identifier in the playable HUD. See [Summer rendering and verification notes](docs/summer-1987.md).

The V8 Sound Lab, 32 live controls, independent presets/JSON and stationary tuning remain available; see [the earlier track and V8 notes](docs/track-v8-upgrade.md) for audio controls. That document describes the superseded Shelter course.

## Graphics Quality Lab

Open **Game Settings → Graphics Quality Lab** for live water, spray, lighting, atmosphere, scenery and resolution controls. Use **Mobile**, **High** or **Ultra** presets; Mobile disables postprocessing and shadows, caps density/resolution, and retains responsive touch controls. The FPS switch reports the current animation frame rate; no physical-device benchmark is implied.

The Lab saves separately from gameplay, audio and camera preferences. **Copy settings JSON**, **Paste JSON**, **Import JSON** and **Reset graphics defaults** operate on graphics only. The adaptive graphics preset is linked to the existing Graphics selector. Device pixel ratio and adaptive quality can cap the effective resolution and shadow map size.

New sessions default to the lightweight procedural water renderer. Existing saved water-mode and diagnostic-wave choices are respected. Simulated water remains available under Water Physics; it now allocates GPU resources only when selected, and releases them when you return to procedural/legacy water. Both renderers share Summer water appearance controls. Older wave-height, spray-distance and water-volume controls still apply alongside the Lab.

## Racing cameras

Use the compact **▣ camera-name** button to cycle **Classic Arcade → Chase → Cockpit → Overhead**. Classic retains the original elevated follow view. Chase follows low behind the boat; Cockpit uses the existing driver seat and boat model; Overhead is an orthographic, north-up view.

Open **Game Settings → Racing Cameras** to select a mode and tune its distance/height, FOV or zoom, lag, and look-ahead where applicable. Higher lag softens following. Each mode saves independently on this device. **Reset Cameras to Defaults** resets only camera preferences and returns to Classic. The legacy **Camera response** control still sets Classic's lag. Camera preferences are stored separately from the existing gameplay/audio settings and their JSON presets.

The existing **Figure-eight overview** remains a full-course diagnostic override. Switching camera or resetting cameras exits that overview. See [camera implementation and verification](docs/cameras.md) for limits and screenshots.

## Local development

Use Node.js 22.12+ (or 24) and npm:

```sh
npm ci
npm run dev
```

Open the address Vite prints. On a phone on the same network, use the computer's LAN address and port 5173. Allow access through your local firewall. Rotate the device to landscape for the widest course view; both orientations use a closer fixed-angle follow camera with velocity and course lookahead.

Press **HIT THE WATER** to unlock audio and begin. Hold throttle and either steering button simultaneously. On desktop use **W / up arrow / space** for throttle, **A/D / left/right arrows** for steering, and **R** to restart. Release throttle to coast; reapply throttle to steer and recover a slide. Slide through bends and carry momentum. Bank contact slows and redirects the boat without ending the run. The setup panel adjusts top speed, drift retention and steering response; new-install defaults are 85 km/h, 65%, and 75%. Existing saved values are preserved.

A READY stage and five-second lamp countdown hold the boat at the stripe while allowing engine revving. Green releases the boat and starts the timer together. Follow the navigator around both figure-eight loops and straight through the flat crossover on each diagonal; all ordered gates are required for each of five laps. Wrong turns require recovering the missed gate while the timer continues. Finish results and local leaderboards remain available. There is no reverse throttle, opponent AI, ghost, progression or network play.

See [v0.7.1 navigation and Bigfoot notes](docs/v0.7.1.md) for the checkpoint fix, both debug systems and validation. See [v0.7.0 build notes](docs/v0.7.0.md) for recommended handling values, settings migrations, changed files, validation and the physical iPhone checklist. Older release sections below describe their historical behavior.

## Checks

```sh
npm test
npm run build
npm run preview
```

Node tests cover speed convergence, steering, drag, bank recovery and drift settings. Build output is in `dist/`. Vite may warn about the Three.js bundle size (~176 KB compressed). Browser checks should cover: launch/audio unlock, simultaneous throttle and steering, pointer cancellation, left/right drift recovery, full valid laps, restart, background/resume, portrait and landscape. Test on an actual iPhone in Safari before claiming iPhone compatibility or performance. Audio can depend on device mute and volume settings.

## GitHub Pages

Push this repository to GitHub, then select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included `Deploy GitHub Pages` workflow runs tests and builds on pushes to `main`; it can also be run manually. It uploads `dist/` and deploys with the official Pages actions. Relative Vite asset paths support a project subdirectory such as `/Jet-Sprint/`. No paid services or secrets are needed. Deployment requires repository Pages permissions. The existing main-branch workflow is retained.

## Code map

- `src/main.js`: course/boat rendering, pooled spray and wake, camera, controls, lap checkpoints and HUD.
- `src/physics.js` / `src/handling.js`: fixed-step waterjet dynamics and shared handling defaults.
- `src/course.js` / `src/track.js`: independent waterway graph, prescribed route, directional gates and shared clipped channel geometry.
- `src/navigation.js` / `src/route-math.js`: turn instructions, scoped route projection, recovery and HUD.
- `src/debug-views.js`: optional numbered gates/route diagnostics, Bigfoot marker/path/status and trigger/reset controls.
- `src/audio.js`: interaction-unlocked harmonic V8 synthesis (an approximation, not a recording).
- `src/style.css`: responsive overlays and touch controls.

The renderer caps pixel density at 1.7, uses low-poly geometry, no shadows and bounded particle pools. Physics runs at 120 Hz with bounded catch-up after pauses. No frame-rate benchmark or real iPhone test has been performed.

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
