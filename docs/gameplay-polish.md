# v0.21.0 — Gameplay visibility, track integrity and touch gestures

This extends the existing four-track campaign and dual-camera controller. No course geometry, checkpoint directions, hull tune, thrust/steering equations, controller mapping, audio, spray, water renderer or prize rules were replaced.

## Playing and tuning

- **Pit Control → VIEW → Flat track:** Auto-Fit Active Track uses the occupied, prescribed racing contour plus shoreline clearance. River tiles, inactive courses and scenery do not enter the fit. Zoom spans 0.35–5×. Editing camera distance selects **Manual Framing**; automatic fitting cannot raise that distance behind the user's back. Yaw, pitch, target offsets, padding, projection and the existing tuning remain available. Auto-Fit explicitly restores automatic framing. Each course retains its own saved tune. River follow and the gate sweep remain; a sweep captures the current camera position, projection and quaternion.
- **RACE → Navigation Lab:** one instanced draw renders up to 32 cream motorsport chevrons above the sampled water/wake surface. Their positions are anchored to route metres, follow the next required checkpoint visit through junctions, and fade across the ahead/behind window. Size, spacing, opacity, brightness, color, height, look-ahead, fade and count save automatically. Count is a rendering budget; dense fades can shorten the visible window. Reset restores the numeric values and color. The HUD navigator remains secondary; the large floating NEXT GATE billboard is now a checkpoint-debug aid.
- **RACE → HUD / visibility:** scale, opacity and margin offsets adjust compact instruments. Countdown lamps animate away after green rather than occupying the racing view. Results moves into the toolbar after finishing. Touch buttons retain their hold/release behavior and placement.
- **RACE → Collision Debug Lab:** opt-in exposed shoreline samples, normals, segment centerlines, excluded internal boundaries, circular boat footprint, recent contacts, seam candidates, checkpoint numbers/forward vectors, and projected track/HUD safe-zone overlay. These are sampled diagnostic lines, not additional colliders. The overlay reports the fraction of route samples in view and clear of the measured HUD rectangles. **Validate all courses now** prints a detailed report to the panel and developer console.

## Shoreline investigation

Previously, collision selected the nearest waterway and inset that waterway by the hull radius. Insetting each channel before combining them leaves false banks inside merged visible water. At Rookie Run **(-107, 8)**, the old nearest-center query rejects a stationary hull even though its full footprint fits in the combined water area.

`shore-contact.js` instead checks the footprint against the water union near ambiguous banks. Interior water uses the fast existing query; ordinary exposed banks and solid land keep their existing response. Near merges, conservative radial hull support samples determine penetration/contact without imposing the internal branch boundary. The boat integrator accepts that contact separately from the nearest-channel information used elsewhere. Restitution, bank damping, thrust, drift, steering and water/current calculations retain their previous values.

The hull approximation remains circular with a 2.5 m radius. Sixteen conservative support directions add up to approximately 5 cm clearance near ambiguous joins. This is not a general polygon rigid-body solver. The debug lines approximate the sampled shoreline; excluded overlap lines identify candidate seams rather than actual blocking obstacles.

## Checkpoint findings

The current Course 1 definitions contain **17 forward-facing, ordered gates**. I could not reproduce a reversed gate vector in those definitions. No checkpoint vector was arbitrarily flipped and direction validation remains enabled. Tests cross every gate on all four courses backwards and forwards: reverse crossings do not advance, forward crossings do. Water chevrons use the ordered route rather than the nearest geometric branch.

The reusable validator checks gate order, edge references, forward vectors, duplicate samples, route transitions, connected endpoints, chevron direction and false collision constraints at sampled junctions. It reports problems rather than rewriting intentional geometry. Deep validation currently passes all four authored courses and excludes 7 / 1 / 5 / 6 sampled internal boundaries respectively.

## iPhone gesture fix

The old Safari fallback covered the canvas and archived analog rails, leaving the active arcade buttons uncovered. `protectGameplayGestures()` is now attached to the canvas container and the actual arcade controls. Non-passive fallback listeners cancel browser touch/gesture defaults only on those dedicated gameplay surfaces, alongside `touch-action: none`, selection/callout suppression and overscroll containment. Pointer events still track each held finger independently.

There is no document-wide gesture cancellation, `user-scalable=no`, or maximum-scale restriction. Viewport sizing retains device width and safe-area support. Developer menus keep their own scrolling and range interactions; Camera Lab zoom changes the game projection independently of browser page scale. Xbox input code and settings are unchanged.

## Verification and evidence

**Results:** all 204 tests pass on Node 22.23.4 (the CI major) and Node 24.19.0. `npm run build` passes; the existing deployment verifier checks all 14 files of the locally served project-subdirectory build. [Recorded commands/results](gameplay-polish/checks.json).

The automated suite includes forward/reverse gates on every course, deliberately invalid route data, navigation through a shared junction, false-bank rejection versus real-land collision, continuous contact across a merge, manual camera persistence, scoped Safari fallback events and actual chevron instance transforms/height/route anchoring.

The continuous campaign driver uses the same processed analog commands and new contact query as gameplay, completes all four three-lap races and three bonus rivers without relocating the boat, and checks gate progression, prizes, unlocks and river-duration targets. Its test-only pilot now searches a little farther behind to rejoin its channel and turns back into open water when pinned on a real bank, using ordinary throttle and steering. No collision is disabled for that test.

Browser checks use rendered Chromium with touch/mobile emulation and reduced motion. The development fixture controls the frame clock and suppresses repeated draws; screenshots explicitly render frames. The separate production fixture loads the unmodified compiled bundle under `/Jet-Sprint/`, with a manual clock, real CDP touch events and injected Gamepad API snapshots. Loaded JavaScript/CSS response hashes match the final build manifest. These do not establish real-device performance.

- Five double-tap gestures each on LEFT, RIGHT and THROTTLE, plus rapid alternating steering taps: page scale stays 1, scroll remains (0,0), selection stays empty.
- Simultaneous steering/throttle, partial finger release and cancellation retain independent responsive commands.
- Camera Lab range events remain uncancelled; 1.8× zoom moves the camera substantially closer; manual distance remains stable over subsequent frames. Auto-Fit and the sweep preview/skip work.
- Countdown panel disappears after green; water chevrons render; deep validation and debug toggles work.
- Portrait prompt holds boat and logical clock; landscape returns at scale 1.
- Navigation, per-course camera and existing hull/audio settings survive reload.
- Measured HUD, toolbar and touch controls fit 568×320, 667×375, 844×390 and 1024×768 viewports.

Evidence: [rendered race](gameplay-polish/race-navigation.png), [safe zones/checkpoints](gameplay-polish/safe-zones.png), [browser assertions](gameplay-polish/browser-proof.json), [layout rectangles](gameplay-polish/layout-proof.json), [compiled-build screenshot](gameplay-polish/production-landscape.png), [compiled-build assertions](gameplay-polish/production-proof.json).

Physical iPhone Safari, real Xbox hardware, sustained phone FPS and thermal behavior remain unverified. Safari's nine requested device checks still need an actual iPhone: repeated/alternating taps, simultaneous inputs, responsiveness, Camera Lab, rotation, scrolling and selection. The connected river outlet can still enter the edge of the rendered flat-course view; its geometry no longer affects Auto-Fit. It was not hidden with a visual mask that would misrepresent connected navigable water. HUD obstruction measurements sample the route; they do not guarantee every boat position stays clear at every custom zoom/offset.

The production build retains the existing large-bundle advisory. No dependencies were added. GitHub Pages uses the existing push-to-main workflow, Node 22 tests/build, and a post-deploy verifier that checks the exact commit plus hashes of every published file/font. See the release response for this commit's actual deployment status; a successful local build alone does not establish publication.

## Exact changed-file inventory

- Camera: `src/racing-camera-manager.js`, `src/racing-camera-settings.js`, `src/racing-camera-lab.js`.
- Gameplay wiring and HUD: `src/main.js`, `src/campaign-ui.js`, `src/debug-views.js`, new `src/water-guidance.js`, `src/gameplay-settings.js`, `src/gameplay-labs.js`, `src/gameplay-diagnostics.js`, `src/gameplay-polish.css`.
- Touch gesture handling: new `src/gameplay-gestures.js`, `src/arcade-touch.js`.
- Collision and validation: new `src/shore-contact.js`, `src/course-validation.js`; `src/track.js`, `src/campaign-world.js`, `src/campaign-tour.js`, `src/physics.js`.
- Tests: new `test/gameplay-polish.test.js`; `test/campaign-series-drive.test.js`.
- Version/documentation: `package.json`, `package-lock.json`, `index.html`, `src/settings.js`, `README.md`, this report.
- QA artifacts: `docs/gameplay-polish/browser-proof.json`, `checks.json`, `layout-proof.json`, `production-proof.json`, `race-navigation.png`, `safe-zones.png`, `production-landscape.png`.
