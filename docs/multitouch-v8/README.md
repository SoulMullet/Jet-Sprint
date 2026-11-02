# Independent multi-touch and nine-recording V8 — v0.30.0

This extends the existing `mountArcadeTouch` → `ControlInput` pipeline and `Engine` → `EngineRPMModel` mixer. Boat forces, throttle-dependent nozzle steering, upgrade/nitrous consumption, race timing, courses, cameras, water, music and career data contracts are retained. There is no second engine player or alternative game UI.

## Control handling

The previous controls maintained per-control sets, but also cancelled every bubbling `touchstart`, `touchmove` and `touchend` on the full controls overlay. This mixed a legacy touch cancellation path with Pointer Events. It has been removed. The exact iPhone failure could not be reproduced on physical hardware in this environment; this report does not claim a device-confirmed WebKit root cause.

`ArcadePointers` now explicitly maps every pointer ID to one owning control. A throttle owner never becomes a global gesture owner, and a second throttle finger cannot replace it. LEFT and RIGHT have independent sets/captures and share the existing normalized touch source with throttle. Starting/releasing steering publishes the unchanged throttle value. No `isPrimary` filtering, document-wide touch cancellation, or touch propagation blocking is used.

The owning button captures on pointerdown. Throttle moves use a rectangle frozen before the pressed-state transform, preserving analog travel and the existing nitrous thresholds/hysteresis. Captured movement outside the button remains valid, including the upper nitrous zone. `pointerup`, `pointercancel`, `lostpointercapture`, and uncaptured pointer-leave/move release only the owning control. A pending capture can be interrupted before `gotpointercapture` without a lost event; the uncaptured-move check also clears this case. Global safety release clears ownership before releasing native captures, so late capture events cannot clear another finger.

`touch-action: none` is scoped to canvas/game surfaces and dedicated buttons. The transparent controls overlay uses `auto`; menus and Camera/Audio Lab retain their existing scrolling/range behavior. Selection, double-click and legacy gesture guards remain on gameplay elements. Keyboard Space + Left Shift still uses one keyboard source even when the throttle button has focus. Gamepad mapping/processing is unchanged.

## Exact recordings and playback

The originals were fetched from GitHub commit `9c0077f` without moving or renaming them. Their SHA-256, codec, levels and measured decoded duration are recorded in [source-analysis.json](source-analysis.json).

| Original path | Role | Authored loop | Timbre anchor |
| --- | --- | --- | --- |
| `public/audio/Engine/EngineCruiseLayerTwo.m4a` | Third cruise bed | 0.65–5.25 s, 120 ms splice | 4,500 RPM |
| `public/audio/Engine/EngineHighRev.m4a` | Sustained near-redline bed | 0.55–2.02 s, 90 ms splice | 6,500 RPM |
| `public/audio/Engine/EngineRevOut.m4a` | Unloaded airborne bed | 0.72–1.54 s, 75 ms splice | 6,900 RPM |

Anchors are approximate timbre references, **not measured RPM in the recordings**. `seamlessLoop` uses the existing complementary cosine splice, DC removal, RMS matching and peak bounding. Cruise recordings loop independently with different fixed start phases; no added detuning/chorus is used. The original six recordings remain present and active.

The same conversion script adds `.wav` compatibility copies beside the three originals, without replacing existing files. They are 32 kHz stereo PCM copies of the supplied recordings. If M4A fetching/decoding fails, the existing loader tries WAV; if both fail, diagnostics report the filename and the remaining recordings continue. Missing cruise-two/high-rev energy returns to original cruise layers; missing rev-out returns to the original Jump recording. Total asset failure stays silent without interrupting gameplay. Original M4A hashes are unchanged.

There are **seven persistent loop sources**: idle, three cruise beds, Jump, HighRev and RevOut. Existing Rev/RevDown remain bounded one-shots. Each file is decoded once per engine context, loop buffers are prepared once, and weights reuse a preallocated seven-element array. Crossing RPM or flight thresholds changes gains/rates without creating a new player/source. Pause/restart reuse the context and buffers. All sources feed the existing EQ, compression, mute/volume and safety ceiling. The music context remains separate.

### Cruise, redline and flight

Cruise shares follow simulated RPM and pump/hull load, with bounded slow variation and exponential smoothing. Nested sine/cosine weights distribute power across the three cruise recordings. The high-rev share progressively replaces cruise energy rather than being stacked at full gain. It enters at **82% of configured maximum RPM**, releases below **78.5%**, and smooths between states. Playback rates use absolute simulated RPM and each timbre anchor, retain the existing 0.72–1.32 limits, and have adjustable pitch response. Boat speed remains one existing load-model input; it is not a direct audio pitch control.

RevOut uses the existing authoritative `campaign.airborne`/`landed` contact passed by `main.js`, including all nine physical campaign jumps. Default meaningful-flight delay is **80 ms** with **70 ms** water-contact hysteresis. New sensitivity scales the delay from 0.5× to 1.5×; it never invents an airborne event. Flight lowers loaded tone, raises free-rev demand according to throttle/duration, and blends RevOut with the retained Jump layer. Landing fades back through the existing transition. Short events reuse the continuous loop, without frame-by-frame starts or a chopped one-shot.

The existing small wind/wake bob and banking presentation do not report physical liftoff and deliberately do not trigger free-rev audio. This change does not add a new wave-launch physics system. Future genuine contact-loss events can use the same contact input.

## Existing Audio Lab and saved values

All nine controls are generated inside the existing **PIT CONTROL → V8 / ENGINE AUDIO LAB**, with numeric readouts, existing per-control resets, presets/import/export and Reset to Defaults.

| Control / stable ID | Default | Effect |
| --- | ---: | --- |
| Cruise Layer Two Volume / `cruiseLayerTwoVolume` | 55% | Independent third-cruise gain |
| Cruise Layer Crossfade Speed / `cruiseCrossfadeSpeed` | 45% | Cruise and RPM-band blend response |
| Cruise Layer Variation Intensity / `cruiseVariationIntensity` | 20% | Slow bounded share variation |
| Engine RPM Pitch Response / `rpmPitchResponse` | 55% | Playback-rate smoothing; existing Pitch Variation retains depth |
| High RPM Layer Volume / `highRPMLayerVolume` | 70% | Independent redline-layer gain |
| High RPM Activation Threshold / `highRPMThreshold` | 82% redline | Entry point, with a 3.5-point release hysteresis |
| Airborne Rev-Out Volume / `revOutVolume` | 75% | Independent airborne gain |
| Airborne Rev-Out Sensitivity / `revOutSensitivity` | 50% | Scales physical-flight debounce; default retains 80 ms |
| Airborne Audio Transition Speed / `airborneTransitionSpeed` | 50% | Entry/recontact blend speed |

The stable `jet-sprint-v8-settings` and `jet-sprint-v8-presets` keys/schema 1 remain. Older saves gain additive defaults for the nine missing fields; existing values and named presets remain. All 65 audio controls round-trip through the same settings store. No career, input, camera or physics save is migrated by the audio changes. Actual audio initialization/resume still occurs from user gestures only.

## Verification

- **298 Node tests pass**, including pointer ownership, unchanged nitrous gesture logic, normalized/continuous three-cruise blending, high-RPM hysteresis, flight debounce/recontact, missing-layer redistribution, old-save migration and all 65 audio settings. Existing physics, throttle-dependent steering, progression, timing and nine physical jump integration tests remain passing.
- **Production build passes** with 35 hashed assets. Existing large JavaScript chunk advisory remains. Build proof requires `multisample-v8-v3` and `independent-captures-v2`; the deployed verifier fetches/hashes all engine M4A/WAV files, music, HTML, code, CSS and fonts for the exact commit.
- [Actual production-game browser check](browser-proof.json): native Chromium CDP touch input adds the steering finger **after** throttle is held/dragged, repeats left/right taps, holds steering during throttle motion, swipes nitrous up/down, tests independent releases and capture loss/cancellation, checks scale 1/scroll 0 and uncancelled legacy touch events, then changes all nine real Audio Lab fields and verifies reload persistence with old values retained. This is touch emulation, not a mouse test and not physical Safari.
- [Native audio rendering](audio-proof.json): 24 seconds each at default/max settings, invalid M4A decode → WAV, missing only the three new recordings, and all assets missing. All nine roles become active in normal runs; all new loops remain persistent. Default peak ≈0.536; maximum-settings peak ≈0.538, finite and below full scale. All-missing output is silent; missing-new keeps the original six roles. CPU/offline rendering cannot establish subjective sound quality.
- [Multitouch/nitrous screenshot](multitouch-nitro.png), [cruise controls](audio-lab.png), [airborne controls](airborne-lab.png).

**Limits:** Physical iPhone Safari multitouch, actual Xbox hardware, listening on speakers/headphones, sustained mobile FPS and a full course playthrough were not tested. The existing authoritative jump contacts were exercised in automated tests; ambient bob is not physical flight. Publication is reported separately after the GitHub Actions verification step succeeds.

### Reproduce the automated checks

```sh
npm ci
npm test
npm run build
npm run preview -- --port 4270 --strictPort --base /Jet-Sprint/
# Separate terminal, optional Chromium integration tool:
# Install/use Playwright in a separate test environment, not in game dependencies.
JET_SPRINT_URL=http://127.0.0.1:4270/Jet-Sprint/ node scripts/verify-touch-v8-browser.mjs
# Audio renders import the real source through Vite; start another terminal:
npm run dev -- --port 4264 --strictPort
JET_SPRINT_DEV_URL=http://localhost:4264/ node scripts/verify-v8-render.mjs
```

Both optional scripts accept `PLAYWRIGHT_MODULE` (module specifier/path) and `CHROMIUM_PATH` for an existing installation. Each launches an isolated browser; the labelled legacy profile fixture seeds QA cash only inside that isolated browser and buys the kit through the real shop. It does not modify ordinary player profiles or add a production cash-grant mechanism. The audio script uses the real browser decoder and `OfflineAudioContext`; it does not use a synthetic replacement engine. The scripts regenerate this directory's proof files/screenshots.

### Physical iPhone Safari acceptance procedure

1. Open the deployed version in landscape. Use a profile with the nitrous kit and charge; preserve/export any real profile before testing. Tap HIT THE WATER to unlock audio.
2. Put the right thumb low on throttle and slide to 100%; **keep it down**. Add/remove the other finger on LEFT/RIGHT at least 20 times. Check the throttle stays 100%, steering responds immediately, and the boat turns only with jet thrust.
3. Keep LEFT held while sliding throttle down/up, then repeat with RIGHT. Steering must persist; releasing either finger must leave the other control intact.
4. While steering, continue the same throttle thumb into NITRO. Verify BOOST and falling charge. Slide back down: boost stops and normal throttle remains 100%. Continue lower and release normally.
5. Test fingers outside control bounds, three concurrent fingers, rapid alternating taps, Safari background/foreground, pause/labs, restart, and rotation. Inputs must never stick. Return from a menu with fingers released before resuming.
6. Rapid double taps/alternation must not change page scale, select text or scroll. Camera Lab zoom and menu/range scrolling must still work.
7. V8 Lab: audition the three exact filenames. Run stationary idle → partial throttle → full RPM → idle, then drive under load. Listen for continuous cruise variation and a smooth redline blend without a repeated onset.
8. Use the audio jump preview, then a real optional ramp: debounce, unloaded rev-out, held airborne tone and smooth landing. Tiny bob/banking and repeated short contacts must not chatter. Lift throttle during flight to confirm rev-out responds.
9. Adjust all nine new controls, save/load a named preset, reload and check values plus old engine/music volume. Compare engine and music together at safe listening volume. Physical listening is required to judge phasing, V8 character and transitions.

## Files changed

- Input: `src/arcade-pointers.js` (new), `src/arcade-touch.js`, `src/gameplay-gestures.js`, `src/arcade-layout.css`, `src/gameplay-polish.css`.
- Audio: `src/engine-samples.js`, `src/engine-rpm.js`, `src/audio.js`, `src/audio-settings.js`, `src/audio-panel.js`; three new `.wav` compatibility files under `public/audio/Engine`.
- Tests: `test/multitouch-v8.test.js` (new), `test/engine-samples.test.js`, `test/engine-rpm.test.js`, `test/audio-settings.test.js`, `test/gameplay-polish.test.js`, `test/deployment-proof.test.js`.
- Tools: `scripts/verify-touch-v8-browser.mjs`, `scripts/verify-v8-render.mjs` (new), `scripts/convert-engine-audio.sh`, `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`.
- Version/report: `package.json`, `package-lock.json`, `index.html`, `src/settings.js`, root README and this directory's report, fixture, analysis, browser/audio proofs and screenshots. User-supplied M4As and all earlier audio assets remain unchanged.
