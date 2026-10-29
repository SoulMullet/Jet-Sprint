# JET SPRINT v0.16.0 / MARINE-87

## Audit and scope

Started from clean `main` at `888076a`, matching `origin/main`. The live entry is `index.html` → `src/main.js`. `interface.js` reparents the original bound panels into Pit Control; the redesign uses those panels and handlers. The prior CSS defined Racing Sans One/Rajdhani and an angular instrument layout. Canvas text had already been centralized in `typography.js`.

The active spray was `HFSpray`, with shader-driven particle arcs and a separate `RoosterCore` curve. That attached curve recalculated its whole trajectory from the current boat heading and could behave like a hose. The developer comparison also retained a separate CPU implementation. All airborne paths are now replaced by one independently simulated pool, rather than leaving an alternative unused renderer.

The boat's bow is **local +X** and the stern outlet is **local (-2.35, 0.34, 0)**. Physics heading maps to Three.js `rotation.y = -angle`; the model uses YXZ rotation order with roll/pitch/heave from `BoatPresentation`. **Y is world-up**. These conventions were inspected and retained. Boat dynamics, presentation forces, course geometry, camera controllers, input handling, race state machines, audio DSP/settings and the historical wake modules are unchanged.

## Interface and typography

`design-system.css` owns reusable navy/cream/orange/faded-red/teal colors, font stacks, spacing, radii, bevels, shadows, animation durations, custom ranges/toggles/selects, tabs, dialogs, tooltips and focus/pressed/disabled states. `style.css` supplies the actual game layouts. The title/setup screen, rounded run timer/lap/best instruments, countdown lamps, navigation cue, touch controls, results/leaderboard and all **six** Pit Control departments use this system. Existing preset/JSON/telemetry/debug controls remain in their original panels. There was no pause screen to restyle.

`instrument-gauge.js` mounts a real SVG speed dial with a moving needle, scale labels, teal RPM arc and the existing engine's RPM readout. It reuses DOM nodes and throttles updates to 20 Hz. Reduced-motion mode disables needle smoothing and interface motion. Panels respect safe-area insets and scroll above the steering/throttle controls.

**Russo One Regular (400)** is used for titles, race headings, timers, lap numbers and major readouts. **Chakra Petch Medium (500) / SemiBold (600)** is used for functional labels, settings and menus. Three local WOFF2 files replace the prior font assets; complete SIL OFL notices and source attribution are included. No external font service or dependency is required. Fixed-width digit cells preserve stable numeric layout without substituting another family. Canvas signs and debug labels share the font definitions and repaint after late loading.

In development, `__JET_SPRINT_FONTS__.inspect()` reports each face's load status and computed family/weight of live UI nodes, with an initial console diagnostic. The inspector is excluded from production. [font-proof.json](marine-87/font-proof.json) includes both diagnostics and Chrome platform-font reports showing **actual custom rendered glyphs**, not merely CSS declarations.

## Independent world-space ballistics

`ballistic-spray.js` advances a fixed typed-array pool at **1/120 s**. At emission, `spray-frame.js` transforms the local outlet and rearward direction through the boat's full pose, adds configurable boat translation once, and stores immutable initial world position/velocity. The jet is straight aft irrespective of steering/nozzle deflection. Effective rearward exit speed is bounded so inherited forward translation cannot turn it into a forward jet. Separate chine spray responds to signed lateral velocity, slip and lateral acceleration.

Each subsequent step applies `velocity.y += gravity * h`, then `position += velocity * h`. An existing drop never reads a new boat transform, heading or steering input. Fixed-step birth sampling and interpolated world centers smooth render frames. The root particle mesh is attached to the scene with an identity transform, with only the short-lived contact-foam renderer as a child. The old curve/core and redundant comparison particle implementation are removed. Both water-material comparison views use the same independent ballistic pool.

Descending drops intersect the analytic water surface used by the hull. Contact retires the airborne particle and starts a short foam ring only inside the channel footprint. Gravity, impacts, aging and pooled retirement continue independently of new emission. Lifetimes cap airborne work; pools are bounded at 6,144 drops and 192 foam events, with existing graphics-quality limits and a lifetime-aware emission ceiling. One instanced draw renders all airborne families and one renders foam. No per-drop scene objects, physics-loop allocations, GPU readback or fluid solver were added.

Screenshot review caught a reversed billboard winding that hid simulated drops. Correcting its transverse basis restored front-facing quads. A rendered pixel comparison with foam disabled now verifies that airborne drops actually contribute visible pixels; [render-proof.json](marine-87/render-proof.json) records the results. Cockpit correctly looks forward and does not expose the aft plume.

## Spray tuning

**Pit Control → SPRAY** uses the original registry bindings and existing `jet-sprint-settings` schema 3 / full-game presets. New fields are additive; valid old values and unrelated keys/presets are preserved. All eight sliders have units, numeric readouts, individual resets and a spray-only default reset.

| Control | Default | Range |
| --- | ---: | ---: |
| Jet launch speed | 24 m/s | 8–60 m/s |
| Upward launch angle | 18° | 0–45° |
| Gravity scale | 1× | 0.25–2× |
| Inherited boat velocity | 0.55× | 0–1× |
| Spread | 4° | 0–18° |
| Particle density | 100% | 0–200% |
| Maximum airborne lifetime | 3 s | 0.3–5 s |
| Splash / foam intensity | 100% | 0–200% |

Launch controls affect new drops; gravity and splash intensity affect the continuing simulation. Existing effect, reach, volume and wake-persistence controls remain accessible. Reset spray defaults changes only the eight new fields. The existing game/preset export/import automatically includes them.

## Verification and evidence

- **`npm test`: 132 pass, 0 fail.** New tests cover independent momentum during sharp turns/full spins, new-heading births, semi-implicit gravity, water contact/retirement, dry-land impact rejection, 30/60/120 Hz agreement, all eight tuning effects, additive persistence/reset isolation and bounded finite pools. Existing boat/race/input/camera/audio/water suites remain enabled. The binary-input route driver still completes five laps.
- **`npm run build`: passes.** Build emits v0.16.0/MARINE-87 and a content manifest covering 11 served files. The existing Vite large-chunk advisory remains; no package dependencies were added.
- Headless **Chromium with software WebGL**, real entry/renderers: inspected the rendered title, HUD, countdown, HULL, SPRAY, VIDEO, V8, VIEW, RACE and results. Custom glyph reports confirm the intended faces. All **110** numeric sliders/readouts/resets are exercised through the existing handlers. All eight spray values survive a real page reload; spray reset restores its defaults.
- Existing game preset save/overwrite/rename/load/export/paste/file import/delete and confirmation cancellation pass. Physics built-in presets, six category resets, custom preset CRUD and JSON/file import pass. Graphics presets/selects/toggles/JSON and audio presets/save/load/JSON/file, stationary dyno, actual RPM and dyno tab-exit behavior pass. All four camera modes rebuild/reset their original controls correctly; 12 registry toggles/dropdowns remain functional.
- Six-panel layout/hit checks pass at **320×568, 375×667, 390×844, 667×375, 844×390 and 1920×1080**: no document overflow, Close remains reachable and the console stays above the driving buttons. Actual keyboard input and simultaneous steering/throttle touch contacts exercise the unchanged controls.
- Additional numeric-layout checks pass at 320×568 through 1440×1000 with 180 km/h, 9,000 RPM and long elapsed/best values; fixed digit widths remain equal and instrument/console bounds fit the viewport.
- Controlled real-renderer fixtures cover straight travel, left/right turns, sideways drift, reverse, powered near-stationary and unpowered idle. Classic, Chase, Cockpit, Overhead and a diagnostic side-profile view render without page/shader errors. [Ballistic proof](marine-87/ballistic-proof.json) compares a pre-existing drop through a full emitter spin against its expected independent trajectory; maximum error is below 0.00004 m. [Render proof](marine-87/render-proof.json) separately checks actual airborne pixels. [Near-stationary proof](marine-87/stationary-proof.json) checks a visible powered jet and the actual [canvas sign](marine-87/canvas-sign.png) font.
- Blocked font requests still allow initialization/start with readable fallback. An eight-second font delay exercises the four-second startup bound, eventual ready status and repaint of baked canvas signs.
- The **compiled production game served at `/Jet-Sprint/`** passes actual Russo One glyph checks, MARINE-87/v0.16.0 identification, active shader rendering, left/right keyboard steering, all four cameras and preservation/reload of nondefault handling/audio preferences. The development font inspector is absent. No failed resource, page or shader errors were reported. [Production phone-sized capture](marine-87/production-mobile.png).

The controlled render fixtures intercept the actual entry module only in the test browser, hold prescribed kinematic states, and invoke the real pool/camera/renderer. The diagnostic side camera and fixture APIs are **not shipped**. Results use the actual finish renderer with a completed-race fixture. These checks are not manually driven full races or physical-device benchmarks.

Representative captures: [title](marine-87/desktop-title.png), [phone title](marine-87/mobile-title.png), [phone HUD](marine-87/mobile-hud.png), [countdown](marine-87/countdown.png), [HULL](marine-87/lab-physics.png), [SPRAY](marine-87/lab-spray.png), [VIDEO](marine-87/lab-graphics.png), [V8](marine-87/lab-audio.png), [VIEW](marine-87/lab-camera.png), [RACE](marine-87/lab-race.png), [results](marine-87/mobile-results.png), [stern plume](marine-87/spray-straight.png), [left](marine-87/spray-left.png), [right](marine-87/spray-right.png), [sideways](marine-87/spray-sideways.png), [reverse](marine-87/spray-reverse.png), [idle](marine-87/spray-idle.png), [side profile](marine-87/spray-side-profile.png).

## Publication and changed files

`scripts/build-proof.mjs` runs after every Vite build. It records the release, full `GITHUB_SHA`, interface/simulation identity, font families and SHA-256/length of each generated HTML/JS/CSS/font/license/icon. After official GitHub Pages deployment, `scripts/verify-deployment.mjs` fetches the actual published manifest and every referenced file, rejects an old commit or mismatched content, and writes a workflow summary. Tests cover stale deployments and corrupt assets. The verifier has also passed against the local production build served under `/Jet-Sprint/`.

The exact added/modified/deleted paths, including evidence and font replacements, are in [changed-files.txt](marine-87/changed-files.txt). Earlier release documents/screenshots are historical records; the live identifier is **MARINE-87 · v0.16.0 · commit**.

## Limits

Physical iPhone Safari, real-device touch behavior, thermal behavior, sustained mobile FPS and subjective audio quality were **not tested**. The browser layout checks use Chromium phone-sized viewports, not Safari. Simulation/render work remains bounded, but that is not a measured mobile performance guarantee.

Water contact uses the existing lightweight analytic surface sampler; optional GPU diagnostic waves are not read back. Foam rings are a visual disturbance, not a new two-way fluid force. The pool does not add airborne terrain/scenery collision. Normal water-surface wake, propulsion and steering retain their original behavior. The existing large JavaScript bundle remains a potential loading cost.
