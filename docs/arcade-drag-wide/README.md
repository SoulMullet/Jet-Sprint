# Arcade drag steering and wide jumps — v0.31.1

Open [Arcade River](https://soulmullet.github.io/Jet-Sprint/?mode=arcade-river), select **RUN THE RIVER**, touch the unobstructed water view and drag horizontally. Acceleration is automatic. Release to centre steering. Keyboard/gamepad steering and the original Racing mode remain available. Add `&dev=1` for the temporary lower-left live steering/build indicator; normal gameplay has no new diagnostic overlay.

## Root cause and active implementation

The deployed v0.31.0 source correctly selected Arcade with `?mode=arcade-river`, but `main.js → bindControls({arcade:true})` mounted `mountArcadeTouch`, the existing LEFT/RIGHT/throttle-button adapter used by Racing. The Arcade HUD hid throttle and presented hold steering. Relative drag was deliberately deferred in that implementation; there was no connected canvas drag adapter or saved feature flag enabling one. This was an implementation omission, not evidence of a stale deployment.

The two actual `leg.jumpSites` inherited a fixed `halfWidth:8`, producing **16 m** decks and launch zones. Their previous placement also put a wide outer approach at risk of rejection by the existing straight-line flight-safety check. Editing a texture would not fix either issue.

The new active path is `main.js → bindControls({riverDrag:{surface:renderer.domElement}}) → mountRiverDrag / RelativeDragSteering → controls.update → ControlInput.touch → input.steering → existing stepBoat`. The existing automatic-throttle override still supplies `input.throttle=1` only during a playable run. Arcade does not mount the old steering-button overlay. Racing continues to use its original independent throttle/steering/nitrous pointers.

One captured pointer owns a neutral CSS-pixel reference. Horizontal displacement maps proportionally to −1…+1; vertical motion and additional pointers do not alter its reference. Hold retains steering. Normal release returns from its current value to zero over 200 ms. Cancellation, lost/pending capture, pause, resize, backgrounding and focus loss clear it safely. Ownership is checked each update as well as on events: Chrome can defer `lostpointercapture` until the next pointer event, so losing capture while stationary cannot latch steering. There are no new global `preventDefault`, touch-sequence cancellation or camera gestures. Existing `#game canvas {touch-action:none}` and gesture protection remain scoped to gameplay; UI buttons/labs keep normal events.

## Measured ramps

At both launch sites the wet channel is **44 m** wide. The boat's existing **2.5 m** shoreline clearance on each side gives a **39 m usable boat-centre corridor**. Coverage percentages below use that corridor, not the decorative bank span.

| Ramp | Previous width | Current width | Usable-corridor coverage | Route distance before → after |
| --- | ---: | ---: | ---: | ---: |
| Tutorial | 16 m | **33.15 m** | 41.03% → **85%** | 330 → **210 m** |
| Main / finish approach | 16 m | **29.25 m** | 41.03% → **75%** | 1,875.56 → **1,970.56 m** |

`arcadeRamp()` samples the active water/contact width at each site and calculates `halfWidth = 2 × hullLimit × coverage / 2`. Future local-width changes therefore affect the deck and takeoff zone together. Local +X follows the river tangent; local Z spans the perpendicular `(-tz, tx)` direction. The same generated definition drives the visible deck, approach elevation, gold rails/chevrons and the existing physical launch gate.

Each deck is an 8 m wedge from water level to its 0.55 m lip, with its leading thickness below water. The first ramp appears around seven seconds into the reference run. Both ramps were positioned on straighter approaches for clear ballistic landing corridors; the channel spline and other course layout were not changed. Each corresponding log remains 24 m after launch, so jumping clears it and outer water still offers a bypass. The previous 7.2 m/s upward launch, 9 m/s minimum approach, gravity, momentum, splash/wake and V8 landing/rev-out systems are retained. Extreme outward flight still has the original safety check; widening does not remove shoreline collision protection.

[Before](before-ramp.png) and [after](after-ramp.png) are actual game renders from the unchanged default chase camera, about 27–29 m before the tutorial launch. The scenery differs because the ramp moved upstream. [Second ramp](second-ramp.png), [airborne](jump.png), [developer input](drag-debug.png), [Control Lab](control-lab.png), [results](results.png) and [short landscape results](results-short-landscape.png) are also captured from the running production build.

## Controls and persistence

**PIT CONTROL → CONTROL LAB → Arcade River drag** adds these resettable numeric ranges to the existing lab:

| Setting | Default | Range |
| --- | ---: | ---: |
| Full steering displacement | 90 CSS px | 50–160 CSS px |
| Dead zone | 5 CSS px | 0–12 CSS px |
| Response smoothing | 35 ms | 0–120 ms |
| Release to centre | 200 ms | 150–250 ms |

Values use the existing **`jet-sprint-controls-v1`** store/export/reset mechanism. Existing schema-1 saves supply defaults for the new fields while retaining old calibration, priority, gamepad, keyboard and throttle values. Existing input-response presets do not override these separate Arcade fields. Hull, camera, audio, spray, career and Arcade record stores are unchanged.

## Verification

- **313 Node tests pass; no failures.** New mapping/adapter checks cover proportional endpoints, dead zone, both signs, secondary fingers, vertical motion, hold/release timing at different rates, cancellation, pending/established capture loss without another move, pause/focus/visibility reset, old-save defaults, persistence and independent reset. Ramp tests measure actual geometry, width adaptation and six real force/contact/flight approaches.
- **Production build passes** with the existing large-chunk advisory. Local publication verification hashes all **35 production files**. `build-info.json` now requires `arcadeInput:relative-drag-wide-v1`; regular build labels show v0.31.1 and developer mode shows `DRAG-WIDE-V1`. The existing deployment pipeline is unchanged.
- [Browser proof](browser-proof.json): Chromium at 844×390 with native CDP touch events. Drag reaches negative/positive **boat commands**, not just an overlay; release reads 0.5 after 100 ms and zero after 210 ms. Vertical motion is neutral, a second finger does not steal steering, auto throttle remains active, Pause works, cancellation and stationary native capture loss clear steering. Four drag ranges are part of the existing lab; native arrow-key adjustment works on the focused range, and changed distance/return values survive reload. Page scale stays 1, with no selection or scrolling in these checks.
- Full safe and shortcut races use standard Gamepad API inputs through the actual production loop and validate both jumps, all checkpoints, results, fast Retry, failure and persistence. [Offline route proof](route-proof.json) uses the actual force integrator and reports both complete routes.
- **Six separate browser approach checks** start from prepared practice poses/velocities 14 m before the real ramps at **−90%, centre and +90% of each half-width** (±14.9175 m and ±13.1625 m). DevTools accesses the live frame scope only in the QA script; the game ships no teleport/test setter. The unmodified runtime then launches, flies, clears the log and lands. These checks produce zero collision impulse and retain over 33 m/s after landing. They do not claim a player steered a full race in each outer lane and do not save fake PBs.
- [Original Racing regression](racing-regression/browser-proof.json) passes simultaneous manual throttle/steering, nitrous swipes, interrupted capture, keyboard controls, nine decoded V8 recordings and Audio Lab reload persistence. Original physics, audio, water simulation, camera and input modules remain in use.

Browser automation suppresses most GPU draws during accelerated logical runs and turns real rendering on for screenshots. It does not benchmark frame rate. **Physical iPhone Safari, Xbox hardware, sustained mobile FPS, subjective audio listening and human gameplay feel were not tested.** Manual Safari/rotation/first-time-play testing remains necessary. The browser approaches are repeatable prepared conditions, not proof that every speed, heading or aggressive drift will launch safely.

## Reproduce

```sh
npm ci
npm test
npm run build
node scripts/verify-arcade-route.mjs
npm run preview -- --port 4270 --strictPort --base /Jet-Sprint/
# Separately, with an optional Playwright / Chromium installation:
ARCADE_QA_OUTPUT=docs/arcade-drag-wide \
JET_SPRINT_URL=http://127.0.0.1:4270/Jet-Sprint/ \
node scripts/verify-arcade-browser.mjs
```

The browser script accepts `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`; these are test tools, not game dependencies. Test phones by dragging from several unobstructed points, holding each direction, releasing, adding a second finger and tapping Pause. Adjust/reset drag ranges, reload, rotate both ways, then verify Racing's original throttle/steering/nitrous controls. Try each ramp's left, centre and right lanes and listen/look for launch and water recontact.

## Exact changed files and purpose

- `src/arcade/drag-steering.js` — new relative input state and canvas Pointer Events adapter, ownership safety and developer-only indicator.
- `src/controls.js` — opt-in connection to the existing normalized touch/keyboard/gamepad pipeline.
- `src/control-settings.js`, `src/control-lab.js` — four persistent, resettable Arcade drag ranges within the existing lab.
- `src/main.js` — active mode wiring, Control Lab instructions, version/input/ramp inspection.
- `src/arcade/ramps.js` — shared width derivation and continuous wedge geometry.
- `src/arcade/river-world.js` — actual generated ramp dimensions/locations; corresponding existing logs/pickups follow those sites.
- `src/campaign-scenery.js` — Arcade deck geometry/width diagnostics and updated launch-area instructions; original Racing dimensions preserved.
- `src/arcade/run.js` — preset description and approach elevation from the shared ramp definition.
- `src/arcade/scenery.js` — chevron placement scaled across each actual wider deck.
- `src/arcade/ui.js`, `src/arcade/arcade.css` — drag instructions and small developer-only readout styling; no HUD redesign.
- `test/arcade-drag.test.js`, `test/arcade-river.test.js` — input lifecycle, migration, dimensions and real jump/landing checks.
- `scripts/verify-arcade-browser.mjs` — connected production touch, full-race and prepared ramp-approach verification/screenshots.
- `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, `test/deployment-proof.test.js` — verify the active correction marker and published asset hashes.
- `package.json`, `package-lock.json`, `src/settings.js`, `index.html` — v0.31.1 build labels.
- Root `README.md`, `docs/arcade-river/README.md`, this report and its evidence files — current launch instructions, historical-report pointer and concrete verification.

No new tracks, economy, combat, camera rewrite, physics engine replacement, audio assets or npm dependencies were added. Publication status is reported after the actual deployed commit passes the existing Pages verification step.
