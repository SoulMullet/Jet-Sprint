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
