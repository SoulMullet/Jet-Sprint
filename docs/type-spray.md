# JET SPRINT v0.15.1 / TYPE-SPRAY

## Audit before edits

Started on clean `main` at `3d12c30`, matching `origin/main`. The actual game entry remains `index.html` → `src/main.js`.

- CSS defined local aliases **Jet Display = Barlow Condensed ExtraBold Italic**, **Jet Condensed = Barlow Condensed SemiBold**, and **Jet Mono = IBM Plex Mono**. Headings, instruments, menus, buttons, sliders and results used those variables. Canvas signs in `retro-venue.js` and label sprites in `debug-views.js` separately hard-coded generic sans-serif/system/monospace fonts. Those canvas overrides also needed changing.
- The model's bow is **local +X**, nozzle is at the **local -X stern**, and physics heading `angle` maps to Three.js `rotation.y = -angle`. That convention was already consistent; globally reversing it would break correct systems.
- Active airborne rendering is `HFSpray` in `hf-effects.js`; the previous CPU pool and `RoosterCore` remain available through the developer comparison. Their launch/core calculations were separate. The historical surface wake is independent.
- The old GPU launch inherited `0.55 × boat velocity`. At 180 km/h, a minimum-speed mist particle with spray distance 0.1 could launch **+25.295 m/s forward** in world space. Even at distance 1, the same extreme could launch +5.45 m/s forward. The old nozzle-side term also had the opposite sign from the waterjet's reaction force.

## Typography fix

The active build now includes **Racing Sans One Regular (400)** and **Rajdhani SemiBold (600) / Bold (700)** as local WOFF2 files. Old active Barlow/Plex files and definitions are removed. Racing Sans One has its own designed slant; CSS requests the real regular face instead of synthesizing bold/italic. Functional UI uses the real Rajdhani weights with narrow/system fallbacks. Full OFL notices and sources are in `public/fonts/ATTRIBUTION.md`.

`src/typography.js` loads all three actual faces before scene/canvas construction. Startup font waiting is bounded to four seconds; unavailable fonts fall back gracefully, and slow successful loads repaint canvas textures. Venue sign headings use Racing Sans One, subtitles/debug instruments use Rajdhani. Headline sizing and small functional captions were adjusted to the new metrics.

Rajdhani's distributed font has proportional digits and **no `tnum` substitution**. Live speed, timers, lap and RPM therefore use reused fixed-width digit cells in Rajdhani Bold, with narrower punctuation. This prevents numerical jitter while keeping the requested family. The displayed strings and timing calculations are unchanged.

Actual glyph evidence, rather than just computed CSS or `document.fonts.check`, is recorded in [font-proof.json](type-spray/font-proof.json): Chrome's platform-font API reports `RacingSansOne-Regular`, `Rajdhani-SemiBold` and `Rajdhani-Bold`, `isCustomFont: true`, and nonzero rendered glyph counts in title/button/countdown/HUD/tuning/results nodes. Canvas draw calls also use the requested loaded families; [the full sign capture](type-spray/canvas-sign.png) shows both.

## Airborne spray fix

`src/spray-frame.js` owns reusable, allocation-free frame/launch math. Its basis matches the boat's **YXZ** render rotation, including heading, pitch, bank and heave. The jet starts at transformed local `(-2.35, 0.34, 0)`; a small waterline floor handles a submerged outlet. Positive nozzle angle sends fluid toward local +Z, opposite the physical hull reaction. Signed longitudinal/lateral velocity and stern angular velocity are accounted for. The horizontal forward component remains at most **-0.5 m/s**, including high speed, reverse motion and reduced spray distance.

Hull sheets have separate waterline chine origins behind the cockpit. Their side and strength depend on actual lateral velocity, slip angle and measured lateral acceleration; a clean turn throws water outside the turn. They do not use a fixed world direction or steering input as a substitute for hydrodynamic load.

GPU births store positions and launch velocities in world space, so already airborne particles do not rotate with subsequent heading changes. The dense core uses the same transformed stern/nozzle launch, under an identity parent transform, eliminating separate rotation/sign logic. Upward launch, 9.8 m/s² gravity and bounded lift give a falling arc. Fine mist variation follows the launch's transverse direction. The old comparison particles/core use the same helpers.

The fixed GPU pool, quality budgets, styling families and existing tuning keys remain. No physics/steering/propulsion, camera-controller, course, timing, audio-DSP, storage-schema or historical wake-direction changes were made. The gameplay leaderboard version remains unchanged; only the application release version advances.

## Verification

- Full Node suite: **123 tests pass, 0 fail**. Eight focused regressions cover nozzle/model transforms, rotational covariance, signed nozzle reaction, short-distance/high-speed GPU emission, drift/load-dependent chine spray, reverse/idle, gravity and immutable airborne/wake history. Existing five-lap physics/camera, race, controls, audio and settings tests remain enabled. The existing GPU birth test now distinguishes intentional chine births from stern jet births and checks aft velocity for both.
- Production build passes; the existing Vite large-chunk advisory remains. No dependencies were added.
- Headless Chromium/software WebGL: inspected real rendered title, countdown, HUD, all five Pit Control tabs, race results and canvas signs. Actual font glyph reporting passed for all three custom faces. No page/shader errors were reported.
- Actual keyboard driving/turning and two simultaneous touch contacts still operate the original boat physics. Nondefault top speed, drift, master volume and preferred camera survive reload under their original storage keys.
- Numeric/console layout checks passed at **320×568, 375×667, 390×844, 844×390 and 1440×1000**, including 180 km/h, long best/elapsed values and 9000 RPM. Digit widths remain equal and Close remains clickable.
- Blocked font requests still allow game initialization and start. Deliberately delayed font requests exercise bounded startup fallback, a later ready state and canvas repaint.
- Controlled browser scenarios exercise straight motion, left/right turns, sideways drift, reverse motion, powered near-stationary and unpowered idle. Chase and Overhead renders were captured for each; Classic comparison, Cockpit and a side-profile diagnostic were also rendered. CPU/GPU launch data remained aft in every powered state and idle emitted no jet. Screenshots were actually inspected.
- The controlled scenarios use a **test-only interception of the actual entry module**, holding kinematic states while invoking the existing effects/camera/renderer. These are component render fixtures, not manually driven full races; fixed positions can accumulate surface foam. The side profile uses a diagnostic camera only in the test. No fixture hook or new camera mode is shipped. The mobile driving capture uses ordinary keyboard input. Results use the real finish renderer with a completed-race fixture.

Representative evidence: [desktop title](type-spray/desktop-title.png), [phone HUD](type-spray/mobile-driving.png), [HULL](type-spray/mobile-physics.png), [VIDEO](type-spray/mobile-graphics.png), [V8](type-spray/mobile-audio.png), [VIEW](type-spray/mobile-camera.png), [RACE](type-spray/mobile-race.png), [results](type-spray/mobile-results.png), [straight stern view](type-spray/spray-straight-chase.png), [left](type-spray/spray-left-chase.png), [right](type-spray/spray-right-chase.png), [sideways](type-spray/spray-sideways-overhead.png), [reverse](type-spray/spray-reverse-overhead.png), [near-stationary powered](type-spray/spray-stationary-powered-chase.png), [idle](type-spray/spray-stationary-idle-chase.png), [side-profile lift/falloff](type-spray/spray-side-profile.png).

## Changed files and limits

`index.html`, `src/design-system.css`, `src/style.css`, `src/typography.js`, `src/interface.js`, `src/main.js`, `src/retro-venue.js`, `src/debug-views.js`, `src/spray-frame.js`, `src/hf-effects.js`, `src/wake-trail.js` (airborne comparison core only), `src/settings.js` (release metadata), package version files, local fonts/licenses/attribution, `test/spray-frame.test.js`, `test/hf-graphics.test.js`, README and these notes/captures.

Physical iPhone Safari, subjective sound quality and sustained mobile frame rate were not tested. Airborne spray remains an arcade rendering approximation, without new water/terrain particle collision or fluid simulation. The existing GitHub Pages workflow runs tests/build and deploys `main`; the release marker is **TYPE-SPRAY · v0.15.1 · commit**.

Final production-path check: the compiled game was served at `/Jet-Sprint/`. Actual custom-font glyphs, TYPE-SPRAY/v0.15.1 marker, active GPU shaders, left/right keyboard steering, all four cameras and preference reload passed with no failed resources or page/shader errors. [Production phone-sized render](type-spray/production-mobile.png) was captured and inspected. This remains desktop Chromium/software WebGL verification, not an iPhone benchmark.
