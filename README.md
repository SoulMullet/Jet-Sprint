# JET SPRINT v0.1

A mobile-first, single-player 3D jet sprint prototype built with JavaScript, Vite, Three.js and Web Audio. All geometry and sound are procedural; no assets, account, API keys or backend required.

## Local development

Use Node.js 22.12+ (or 24) and npm:

```sh
npm ci
npm run dev
```

Open the address Vite prints. On a phone on the same network, use the computer's LAN address and port 5173. Allow access through your local firewall. Rotate the device to landscape for the widest course view; portrait widens the overhead view to retain the circuit.

Press **HIT THE WATER** to unlock audio and begin. Hold throttle and either steering button simultaneously. On desktop use **W / up arrow / space** for throttle, **A/D / left/right arrows** for steering, and **R** to restart. Release throttle to coast and tighten turns. Slide through bends and carry momentum. Bank contact slows and redirects the boat without ending the run. The setup panel adjusts top speed, drift retention and steering response; defaults are 85 km/h, 65%, and 75%.

The timer begins at launch, on the start stripe. Follow the initial boat heading, pass the three ordered course sectors, then cross the stripe to record a lap. Best time is kept for the current page session; restart resets the current race and retains best. There is no reverse throttle, AI, ghost, progression or network play.

## Checks

```sh
npm test
npm run build
npm run preview
```

Node tests cover speed convergence, steering, drag, bank recovery and drift settings. Build output is in `dist/`. Vite may warn about the Three.js bundle size (~134 KB compressed). Browser checks should cover: launch/audio unlock, simultaneous throttle and steering, pointer cancellation, left/right drift recovery, full valid laps, restart, background/resume, portrait and landscape. Test on an actual iPhone in Safari before claiming iPhone compatibility or performance. Audio can depend on device mute and volume settings.

## GitHub Pages

Push this repository to GitHub, then select **Settings → Pages → Build and deployment → Source → GitHub Actions**. The included `Deploy GitHub Pages` workflow runs tests and builds on pushes to `main`; it can also be run manually. It uploads `dist/` and deploys with the official Pages actions. Relative Vite asset paths support a project subdirectory such as `/Jet-Sprint/`. No paid services or secrets are needed. Deployment requires repository Pages permissions and has not been published by this development task.

## Code map

- `src/main.js`: course/boat rendering, pooled spray and wake, camera, controls, lap checkpoints and HUD.
- `src/physics.js`: fixed-step arcade dynamics and configurable tuning.
- `src/audio.js`: interaction-unlocked harmonic V8 synthesis (an approximation, not a recording).
- `src/style.css`: responsive overlays and touch controls.

The renderer caps pixel density at 1.7, uses low-poly geometry, no shadows and bounded particle pools. Physics runs at 120 Hz with bounded catch-up after pauses. No frame-rate benchmark or real iPhone test has been performed.
