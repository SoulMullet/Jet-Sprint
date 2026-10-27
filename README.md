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
