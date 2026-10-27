# JET SPRINT v0.2

A mobile-first, single-player 3D jet sprint prototype built with JavaScript, Vite, Three.js and Web Audio. All geometry and sound are procedural; no assets, account, API keys or backend required.

## Local development

Use Node.js 22.12+ (or 24) and npm:

```sh
npm ci
npm run dev
```

Open the address Vite prints. On a phone on the same network, use the computer's LAN address and port 5173. Allow access through your local firewall. Rotate the device to landscape for the widest course view; both orientations use a closer fixed-angle follow camera with velocity and course lookahead.

Press **HIT THE WATER** to unlock audio and begin. Hold throttle and either steering button simultaneously. On desktop use **W / up arrow / space** for throttle, **A/D / left/right arrows** for steering, and **R** to restart. Release throttle to coast and tighten turns. Slide through bends and carry momentum. Bank contact slows and redirects the boat without ending the run. The setup panel adjusts top speed, drift retention and steering response; defaults are 85 km/h, 65%, and 85%.

The timer begins at launch, on the start stripe. Follow the initial boat heading, pass the three ordered course sectors, then cross the stripe to record a lap. Best time is kept for the current page session; restart resets the current race and retains best. There is no reverse throttle, AI, ghost, progression or network play.

## Checks

```sh
npm test
npm run build
npm run preview
```

Node tests cover speed convergence, steering, drag, bank recovery and drift settings. Build output is in `dist/`. Vite may warn about the Three.js bundle size (~134 KB compressed). Browser checks should cover: launch/audio unlock, simultaneous throttle and steering, pointer cancellation, left/right drift recovery, full valid laps, restart, background/resume, portrait and landscape. Test on an actual iPhone in Safari before claiming iPhone compatibility or performance. Audio can depend on device mute and volume settings.

## GitHub Pages

Push this repository to GitHub, then select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included `Deploy GitHub Pages` workflow runs tests and builds on pushes to `main`; it can also be run manually. It uploads `dist/` and deploys with the official Pages actions. Relative Vite asset paths support a project subdirectory such as `/Jet-Sprint/`. No paid services or secrets are needed. Deployment requires repository Pages permissions. The existing main-branch workflow is retained.

## Code map

- `src/main.js`: course/boat rendering, pooled spray and wake, camera, controls, lap checkpoints and HUD.
- `src/physics.js`: fixed-step arcade dynamics and configurable tuning.
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
