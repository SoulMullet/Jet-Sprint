# Four racing cameras

The camera previously lived directly in `main.js`: an elevated PerspectiveCamera followed a smoothed route/velocity target, with fixed world orientation and a small speed-dependent FOV increase. The active animation loop now calls `RacingCameras.update()` from `src/cameras.js` and renders its returned camera. This is the same game and renderer, not a second scene or prototype. Track geometry, physics, race rules, controls, water/audio modules and existing settings data are unchanged.

| Mode | Projection and behavior | Tuning |
| --- | --- | --- |
| Classic Arcade | Original elevated, fixed-angle follow; original default framing, portrait adjustment, speed effect and upcoming-turn/velocity target | Distance, height, FOV, lag, look-ahead multiplier |
| Chase | Low third person; heading follows the hull with lag and a yaw-rate bound; subtle route anticipation; boom obstruction queries against visible static scenery and terrain | Distance, height, FOV, lag, look-ahead |
| Cockpit | Perspective eye at the actual driver seat, just forward of the helmet; existing bow/cage remain, with no invented dashboard | Eye height, FOV, heading lag, forward look distance |
| Overhead | Orthographic, north up; near-vertical follow with stable orientation | Tilt distance, height, zoom, lag, route look-ahead |

Camera changes and restarts rebase immediately to a valid pose instead of flying through scenery or through the crew. During following, target/position interpolation uses frame-rate-independent exponential damping, with quaternion interpolation for rotating views. Cockpit translation stays anchored to the seat so position lag cannot enter the engine or crew. Its heading lag is capped at 20° relative to the hull. Heading never derives from the sign of hull velocity, so drifting sideways or moving backwards does not introduce a sudden 180° flip. The game still has no reverse-throttle input; negative hull velocity was exercised in tests without changing physics.

Chase anticipates the route slightly and limits effective look-ahead relative to follow distance to retain the boat in frame. Obstruction checks reuse a ray, vectors and hit arrays, run at 15 Hz or after 0.8 m of endpoint movement, and pull the boom inward with a 1.2 m safety margin. The camera stays at least 2.4 m high, above the course's banks/grass. Hidden low-quality scenery is excluded from obstruction queries. Outward movement recovers through the same camera damping. Extreme custom settings and dense scenery still merit hands-on playtesting.

The player driver is isolated into camera-layer batches and hidden only in Cockpit. Normal player views and the moored boat keep their crew. This adds a few player draw calls, without creating new geometry or a fictional cockpit. Both projections resize with the viewport; orthographic bounds/zoom update only when aspect or tuning changes. Reused vectors/matrices/quaternions keep follow calculations free of per-frame transform-object allocations. There is no extra render pass or postprocessing.

## Controls and persistence

- Click/tap **▣ camera-name** to cycle the four views. The selected name appears briefly. Switching does not release held steering/throttle inputs.
- Open **Game Settings → Racing Cameras** for the mode selector and mode-specific sliders. Lag is in seconds; higher values mean softer following. Cockpit translation is seat-anchored and Overhead uses zoom instead of FOV.
- **Reset Cameras to Defaults** resets all four camera tunings and selects Classic. It leaves physics, audio, presets and scores intact.
- Preferences use `jet-sprint-cameras-v1`, schema 1. Valid stored mode/tunings survive reload; invalid values are clamped or defaulted. Storage failures leave live controls usable and display a message in the camera panel.
- With no camera save, Classic initializes from the existing `cameraResponse`. Editing the old slider, or loading/importing a gameplay preset containing it, still updates Classic's lag. Once camera preferences exist, their tuning takes priority at startup. Camera preferences are independent of existing gameplay/audio JSON exports and storage keys.
- The previous full-course overview remains available as a diagnostic override; switching or resetting cameras exits it. Restart keeps the selected racing mode.

## Verification

`npm test`: **88 passed, 0 failed**. Camera coverage includes original Classic framing/response; persistence and independent reset; denied/malformed storage; portrait/landscape projection updates; chase framing at tuning limits; solid/hidden obstruction handling; cockpit seat/layers; backwards/lateral velocity; yaw wrapping; restart rebasing; and five complete real-integrator laps per mode with ordered gates, finish timing and explicit bank contact. All prior gameplay/audio/fluid/settings regressions remain enabled.

`npm run build`: passed; the existing Vite bundle-size advisory remains.

The production build was served under `/Jet-Sprint/` and checked in Chromium. All four modes rendered while following a moving boat. Mode and changed Overhead height/zoom survived a page reload. Camera reset retained existing gameplay settings. Restart returned speed to zero. At 390 × 844, simultaneous simulated steering/throttle inputs stayed active while clicking the camera switch and released cleanly afterwards. No page/shader errors were observed.

Screenshots: [Classic](cameras/classic.png), [Chase](cameras/chase.png), [Cockpit](cameras/cockpit.png), [Overhead](cameras/overhead.png), [phone-sized Chase](cameras/mobile.png).

These captures use controlled animation-frame advancement under software WebGL with low graphics/legacy water. Full manual laps, subjective motion comfort, real-time FPS, sustained physical iPhone Safari performance and third-finger touch switching on actual hardware remain unverified. Automated five-lap runs and collision/reverse cases are not a claim of human playtesting. Direct public Pages visual access is blocked by the cloud network policy; GitHub Actions deployment results can be checked separately.

## Files

- `src/cameras.js`: camera following, projections and obstruction queries.
- `src/camera-settings.js`: per-mode tuning, validation and persistence.
- `src/camera-panel.js` and `src/style.css`: cycling, name display and settings UI.
- `src/main.js`: active render-loop, resize/restart, foliage-focus and legacy-setting integration.
- `src/visuals.js`: player-driver visibility batches for Cockpit.
- `src/debug-views.js`: use the currently active camera for existing debug tools.
- `test/cameras.test.js`, README and this document: regression coverage and usage.
