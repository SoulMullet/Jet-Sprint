# Arcade River Prototype V1 — v0.31.0

Historical foundation report. **v0.31.1 replaces hold buttons with default relative drag steering and widens/repositions the two ramps.** See the [corrective build report](../arcade-drag-wide/README.md) for current controls, measurements and evidence.

Choose **ARCADE RIVER → RUN THE RIVER** on the title, or open [the Arcade URL](https://soulmullet.github.io/Jet-Sprint/?mode=arcade-river). Locally append `?mode=arcade-river` to Vite/preview's URL. The base URL and **JET SPRINT / RACING** choice retain the existing three River Rush races, manual throttle, nitrous gesture, career/garage, replay library and original tuning.

## Play

The boat accelerates automatically after a 0.65-second staging period. Hold **LEFT / RIGHT**, use **A/D or arrows**, or steer with the existing gamepad left stick. There is no jump button or required throttle/boost action. Follow the pale arrows; wide gold-chevron ramps launch automatically. Collect $25 pickups on the ramp lines, river edges and narrower **Gold Cut** fork. The gold water arrows identify the optional shortcut; the pale route is the safer main bend.

Cross the finish within **2:05**. The progress readout shows a time warning in the final 20 seconds. Minor impacts are forgiving; repeated hard impacts can exhaust the run's hull condition. Finish/failure results show time, collected cash, jumps/impacts, performance rating and local best, with a prominent **RETRY / FULL SEND** button. **R** retries; **P/Menu** pauses. Retry resets the existing simulation/effects and stages green in 0.65 seconds without rebuilding the world or reloading. Results' Back to Start and pause's Back to Start stop music/audio and return to the same mode menu.

Cash is **run score only** and resets on Retry. Arcade does not purchase upgrades, burn career fuel, spend nitrous, damage the owned career hull or award career money. The original game's existing economy remains available in Racing.

## Course and feel

Sunset River has **2,040.6 m** of authored centripetal spline, a broad launch basin, sweeping bends, tighter turns, a marina finish basin, **20 ordered shared checkpoints**, **two 16 m-wide ramp launch zones**, **five physical rocks**, **three floating logs**, and **25 pickups** worth $625 in total. Logs behind the ramps make jumping useful while leaving ground bypass space. The Gold Cut is a narrower 22 m-wide channel through a real island, rejoining before the next mandatory gate; neither route requires a hidden checkpoint in the other branch.

The main channel is roughly 44 m wide, with a wider opening. Water, shore collision and streaming use the same new immutable network, including the fork. A single **6,728-triangle / 5,184-vertex** water surface covers both routes and the basins independently of terrain jobs. It reuses the existing water shader and avoids rectangular water-tile material seams. Terrain/vegetation remain bounded and streamed. Arcade uses the lightweight shader/legacy water path; the saved original simulation preference is retained for Racing. There is no new GPU water solver or costly postprocessing dependency.

The current `stepBoat` integrator still owns waterjet thrust/nozzle yaw, inertia, drag, lateral drift, banking forces and bank contacts. Arcade passes optional nozzle-response/yaw-damping parameters; callers that omit them retain the old defaults. Impact recovery damps spin temporarily, with 0.85 s damage cooldown. Landing stability damps yaw and a fraction of lateral velocity on recontact. These assists do not drive a route or align the boat continuously to a spline.

The existing ballistic jump simulation retains horizontal momentum, gravity and water recontact. A ramp approach lift matches the visual deck; the launch starts at its actual 0.55 m lip height. Flight safety uses that height when checking the landing corridor. Real height clears low log/rock contacts, while water-level collisions remain physical. The original landing splash, wake, boat pose and debounced V8 rev-out/recontact audio are reused. Default jump apex is approximately 3.16 m.

Arcade's rendering-only chase camera smooths position/target, caps heading response during drifts, anticipates the selected waterway, pulls back with speed and follows jump height. It shares the existing Three.js perspective camera and obstruction query, updates projection on rotation/resize, and does not write boat forces or ordinary camera presets. No added shake or blur.

## Recommended tuning

Open **PIT CONTROL → HULL → Arcade River / handling assists** or **VIEW → Arcade River / chase camera**. All controls have numeric readouts, units, per-control resets and group Reset buttons.

| Setting | Default |
| --- | ---: |
| Arcade speed | 78 MPH |
| Steering response | 1.20× |
| Impact recovery | 0.60× |
| Landing stability | 0.70× |
| Camera distance / height | 24 m / 16 m |
| Camera smoothing | 6 /s |
| Field of view | 60°, plus up to 3° with speed |
| Speed pullback | 0.25× |
| Turn anticipation | 0.25× |

For an easier first run, try 72 MPH while retaining the other defaults. Ordinary Racing's stock target remains 93 MPH and its bought upgrades remain effective there. Arcade values never silently become career upgrades.

Arcade tuning persists in **`jet-sprint-arcade-river-tuning-v1`**; revisioned local best times use **`jet-sprint-arcade-river-records-v1`**. Bad values fall back/clamp; storage failure leaves the run usable with a result warning, and newer record schemas are not overwritten. Best times are local per course revision, without competitive tuning classes. Practice doesn't save a PB.

An existing career profile is not rewritten by Arcade attempts, rewards or retries. If no career profile exists, the original `PlayerCareer` migration initializes it once **before** Arcade can create shared graphics/audio preferences. This preserves the original first-visit unlock behavior: trying Arcade first does not masquerade as an old Racing installation and unlock every river. Shared audio/video/control preferences continue working through their original stores.

## Verification

- **307 Node tests passed**, including all prior physics, camera, campaign, garage, music, V8 and multi-touch tests plus nine Arcade checks for water continuity/budget/upward faces, two valid routes/jumps, auto throttle, independent persistence, unique pickups, failure/retry, physical flight clearance and camera isolation.
- Production build succeeds; the existing large-JavaScript-chunk advisory remains. The build/deploy verifier requires `sunset-river-v1` alongside the existing identities and hashes all 35 production files, including the original nine V8 M4As/WAVs, music and fonts.
- [Offline force simulation](route-proof.json): 120 Hz stock Arcade assists with a proportional steering test driver, no position changes or teleports. Safe: **62.02 s / $150 / two jumps / all 20 gates**. Gold Cut: **61.44 s / $275 / two jumps / all 20 gates**, with more impact damage. These validate reachability/initial tuning, not human skill or fun.
- [Production-game browser proof](browser-proof.json): native CDP touch steering with automatic throttle, standard Gamepad API driver through both complete routes, cash/results, failure, sub-second logical Retry, PB/assist/camera reload persistence, existing career bytes retained during Arcade, and manual throttle retained on returning to Racing. Actual rendered title/jump/results/settings screenshots were inspected.
- [Original Racing regression](racing-regression/browser-proof.json): throttle-first secondary steering taps, continuous throttle motion, nitrous swipes, established/pending capture loss, focused Space + Shift, nine loaded engine recordings and Audio Lab persistence still pass. A fresh Arcade-first browser visit also retained the usual single unlocked Racing river; result heading/Retry fit at both 844×390 and 568×320.
- The browser driver suppresses most GPU draws **only while accelerating its simulation clock**; physics, poses, checkpoints, pickups, finish/failure and input processing are the actual game. Screenshots enable real rendering. This is not a frame-rate benchmark or physical controller/iPhone test.

Screenshots: [title](title-landscape.png), [jump and continuous water](jump.png), [finish](results.png), [short landscape results](results-short-landscape.png), [shortcut result](shortcut-results.png), [failure](failure.png), [Camera Lab](camera-lab.png).

**Not verified:** physical iPhone Safari, actual Xbox hardware, sustained mobile FPS, subjective audio listening and a human full-course feel/playtest. Initial balance is based on automated steering; a first-time player's performance will differ. Far vegetation/terrain can still prepare progressively, while water/navigation/collision remain present. Arcade ghost recording/playback, optional drag steering, multiple Arcade courses, combat, weapons and a new economy/shop are deliberately deferred. Racing's existing replay/garage features are retained in that mode.

### Reproduce

```sh
npm ci
npm test
npm run build
node scripts/verify-arcade-route.mjs
npm run preview -- --port 4270 --strictPort --base /Jet-Sprint/
# In another terminal, with an optional Playwright/Chromium installation:
JET_SPRINT_URL=http://localhost:4270/Jet-Sprint/ node scripts/verify-arcade-browser.mjs
```

The optional browser tool accepts `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`, is separate from game dependencies, and regenerates the proof/screenshots in this folder. It uses an isolated labelled legacy QA profile and simulated standard gamepad, not player account data. The existing `scripts/verify-touch-v8-browser.mjs` remains available for original Racing throttle/nitrous/V8 regression checks.

### Manual phone/controller check

1. Open Arcade in landscape. Read the two-button instructions, start and steer with either thumb; verify the boat accelerates without throttle input. Try simultaneous LEFT/RIGHT and release each independently.
2. Follow the pale route, then retry using the gold fork. Dodge the side rocks, centre on both wide ramps, clear their logs and listen for rev-out/landing transitions. Grab edge/shortcut pickups and confirm each pays once per run.
3. Finish, inspect time/cash/best and Retry. Test R, Retry, Menu pause/resume, background/foreground and rotation. Try sustained impacts or expiry to verify failure → immediate retry; cash/health should reset without changing career resources.
4. Adjust/reset the Arcade handling/camera sliders, reload and verify persistence. Confirm Camera Lab native ranges/scrolling remain usable and touch inputs never zoom/scroll the game.
5. Return to Racing. Verify the three original rivers, owned upgrades/fuel/nitrous, manual throttle swipe, simultaneous steering, cameras, audio/music and saved settings. With a physical pad, check left-stick Arcade steering without RT, then the original RT/RB behavior in Racing.

## Exact file groups

New mode modules: `src/arcade/river-world.js`, `run.js`, `tuning.js`, `camera.js`, `scenery.js`, `water.js`, `ui.js`, `arcade.css`.

Integration/shared opt-ins: `src/main.js`, `physics.js`, `campaign-tour.js`, `campaign-scenery.js`, `campaign-presentation.js`, `river-environment.js`, `river-environment-data.js`, `river-jumps.js`. Original course definitions, audio/music/font assets and control modules are unchanged.

Checks/publication/report: `test/arcade-river.test.js`, `test/deployment-proof.test.js`, `scripts/verify-arcade-route.mjs`, `scripts/verify-arcade-browser.mjs`, `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, package version files, `index.html`, `src/settings.js`, root README and this evidence directory. Deployment status is reported separately only after verification of the actual published commit.
