# Jump visibility, calm water and river variety — v0.25.0

The existing game, three river runs, garage/career, controls, saved settings, V8, cameras and world-space replays remain in place. No course spline or prescribed checkpoint route was redesigned.

## Disappearing boat: confirmed cause and fix

The live render loop added `atan2(campaign.verticalVelocity, speed)` to the hull pitch while airborne. `RiverRunTour` did not expose that property from its river leaf, so it was **undefined**. The resulting `NaN` pitch contaminated the world transform and rendering/frustum calculations. It was not a deliberate mesh hide or race teleport.

Both tour adapters now expose finite flight velocity and landing speed. `BoatPresentation` owns the complete pose, with a finite, bounded shared `flightPitch` helper; the main loop no longer increments rotation from an undefined adapter field. Replay capture uses the same helper. Root height is applied once, and each frame rebuilds a finite pose. No depth test, frustum culling, collision system, boat layer or near/far plane was disabled to fake visibility. All four comparison cameras and the primary River Follow remain available.

The original gravity-driven flight retains horizontal momentum. Launch prediction checks the whole short trajectory against bank limits and physical rocks; an unsafe approach skims/bypasses the ramp instead of being flung outside the waterway. Airborne bank contact still resolves as a collision if extreme tuning changes the trajectory. Landing applies a modest hull spring impulse and a bounded world-space droplet/foam burst, scaled by vertical impact speed. Existing throttle-dependent ground/waterjet steering is unchanged; there is no thrust-driven steering force in midair.

## Shared jumps

Rendering and launch detection share `riverJumpSites`, rather than separate ramp coordinates. Each river retains the original optional ramp at 170 m and gains two optional ramps chosen on sufficiently straight, clear sections:

| River | Ramp distances along original river path |
| --- | --- |
| River Rush 1 | 170 / approximately 728 / 1,236 m |
| River Rush 2 | 170 / approximately 1,046 / 1,776 m |
| River Rush 3 | 170 / approximately 1,482 / 2,515 m |

Ramps sit off the centerline, leave a full bypass, accept forward crossings once per visit and do not replace checkpoint validation. The additional sites predict a safe normal-speed landing. Live launch checks also consider actual lateral momentum, speed and current launch/gravity settings. Unsafe extreme approaches are deliberately not guaranteed a jump.

**HULL → River Jumps** exposes launch scale (0.6–1.6×), gravity scale (0.6–1.5×) and landing splash intensity (0–2×), with existing numeric/readout/reset components. All use the stable `jet-sprint-settings` schema-3 store. Existing fields/values remain intact. Custom launch/gravity values create a separate ghost force class; factory values retain the previous force-class identity and old replay compatibility. Mid-run changes invalidate a competitive PB in the existing way. Splash intensity is visual and does not change the force class.

## Calm water and interaction

The ambient surface now uses two slowly advected world-space noise fields, bounded to roughly 1.3 cm before the existing amplitude scale. It has no tile-sized phase reset. The lightweight CPU water sampler uses the corresponding calm field for hull rocking and spray contact. It remains an approximation of GPU floating-point/shading behavior, not a fluid readback or identical cross-platform solver.

Large repeated wind/standing-wave patterns and persistent whitewater patches are strongly reduced. Sparse standing crests remain localized but have much lower amplitude. Normal-map layers have broader scales and much weaker slopes. Depth tint blends smoothly out of the retained origin depth texture instead of switching at a hard square boundary. Dielectric Fresnel/PBR response, subtle depth color, low roughness and nearly opaque water replace the overly transparent/plastic finish. Existing transparency and wave settings remain numeric controls, with the new calmer interpretation applied consistently.

High/Ultra keep the existing obliquely clipped shoreline/sky reflection pass, now capped at 12/20 Hz. Low and Medium continue to allocate **no live reflection target by default**, using the existing procedural sky/environment instead. Existing explicit reflection-quality choices are respected. No extra full-scene pass or paid/external assets were introduced. The optional GPU shallow-water diagnostic mode remains available with its existing domain, numerical behavior and user settings; this is not a new river-wide fluid solver.

Historical V-shaped chine wake ribbons and jet churn still emit at the actual stern. Airborne rooster-tail/hull particles retain their own world velocities and gravity; steering cannot rotate old particles. Wake and foam decay through their existing bounded pools. Landing bursts reuse that same particle system and retire normally on water contact. Existing spray/wake/audio/graphics controls remain intact.

## Debris, boulders and seals

A separate deterministic dressing pass creates **30 log/driftwood pieces, 10 shoreline boulders and 6 potential seal sites** across the existing rivers. Large logs sit partly submerged by the bank; smaller pieces float just inside the shoreline. Capsule endpoints/radii used for contact match the rendered capped cylinders. Their clearance rules preserve the navigable hull corridor and avoid jumps/checkpoint approaches. Boulders use the shoreline clearance helper, including rechecking the destination against nearby channels; matching rock proxies join the existing collision registry. The previous oversized origin-scenery clearance fix remains unchanged.

Seals are lightweight procedural meshes, decorative only, outside the critical racing line. A nearby site can briefly surface/bob/look around and submerge over six seconds, with a subtle ripple and at least 35 seconds between appearances. Only one seal can be active. No wildlife collision, prize, fuel or checkpoint interaction is added. **VIDEO → Environment → Seal wildlife effects → off** immediately hides the animal/ripple and saves through the original graphics store/JSON format. Reduced scene cost comes from a few shared meshes and infrequent visibility, not a new animation dependency.

## Course consistency audit

Named course geometry was already **fixed and deterministic**: authored nodes/splines and deterministic spline-generation formulas, with stable IDs and coordinate/checkpoint fingerprints. Restarts reset progression, not topology. There is no unseeded random route regeneration to fix. Existing seeded terrain/vegetation placement is decoration; unrelated random IDs for profiles/replay files do not change a course.

The new dressing data is independent of the route, with seed **87031** and version **`river-dressing-1987-v1`**. Ramp IDs are stable per river. Wildlife timing depends on proximity and simulated presentation time, so encounters can vary without moving the racing line. Tests reconstruct worlds independently and compare full numeric routes and dressing data. Portable foundation exports include `riverDressing` and `rivers[].jumps`; profile and physics formats remain separate. No Unreal integration or shared backend was added.

## Verification and practical limits

- **264 automated tests pass on Node 22 and Node 24.** New checks drive all nine real ramp triggers through gravity/landing, finite boat poses and each camera controller; reject unsafe launches; bound calm-water amplitude/time variation; verify repeatable geometry/debris, clear lanes, capsule contact, seal surfacing/disable, bounded stronger landing bursts and ghost tuning classes. Existing full three-river input/physics/career runs, archived circuit progression, spray, wake, V8, controls, cameras, profile, settings and JS force-parity suites pass.
- [Browser jump proof](river-evolution/browser-proof.json) runs the actual main loop with explicit practice placement before each ramp, prewarms adjacent scenery tiles, then checks every flight frame in **45 combinations: 9 ramps × River Follow/Classic/Chase/Cockpit/Overhead**. Boat matrices remain finite, the real boat stays visible, and at least one real boat mesh stays in the camera frustum. No boat teleport occurs during a flight. Low/High and simulated-water shaders render without errors; jump tuning and wildlife disable survive reload.
- [Production proof](river-evolution/production-proof.json) uses the unmodified compiled project-path bundle and hashes loaded JS/CSS against its manifest. It exercises retained touch/keyboard/Gamepad snapshots, replays/import/seek, cameras, garage servicing and profile persistence. [Seal](river-evolution/seal-proof.json) and [debris](river-evolution/debris-proof.json) checks render actual seeded sites with the existing cockpit camera and High reflections. [Checks manifest](river-evolution/checks.json).
- Actual rendered screenshots were inspected: [River Follow jump](river-evolution/jump-river.png), [Chase jump](river-evolution/jump-chase.png), [Cockpit jump](river-evolution/jump-cockpit.png), [Overhead jump](river-evolution/jump-overhead.png), [glassy High water](river-evolution/glassy-high.png), [seal surfacing](river-evolution/seal-surface.png) and [shore debris](river-evolution/shore-debris.png). Jump tests suppress repeated drawing between captures and use a controlled frame clock; production regression checks retain drawing. These are functional/rendering checks, not mobile benchmarks.

The build passes with the existing large-main-chunk advisory. There is no separately configured lint/type-check command. Physical iPhone Safari, real Xbox hardware, audio listening, sustained mobile FPS/thermal performance and subjective long-session jump/economy tuning remain unverified. The visuals remain procedural stylized realism. Scenery workers can take time to prepare after explicit debug/replay relocation; the test harness waits for actual neighboring chunk readiness rather than treating a stale diagnostic status as complete. No loading screen or forced relocation was added to normal play.

## Changed files and publication

New: `src/river-jumps.js`, `src/calm-water.js`, `src/river-environment-data.js`, `src/river-environment.js`, `test/river-evolution.test.js`.

Integration/rendering: `src/campaign.js`, `src/campaign-tour.js`, `src/river-run.js`, `src/boat-presentation.js`, `src/main.js`, `src/campaign-world.js`, `src/campaign-scenery.js`, `src/campaign-presentation.js`, `src/campaign-whitewater.js`, `src/ballistic-spray.js`, `src/summer-water.js`, `src/hf-water.js`, `src/hull-motion.js`, `src/hf-reflections.js`, `src/graphics-lab.js`, `src/summer-settings.js`, `src/settings.js`, `src/settings-panel.js`, `src/physics.js`, `src/replay/course-data.js`, `src/portable-game-data.js`.

Release/proof/docs: `package.json`, `package-lock.json`, `index.html`, `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, `test/deployment-proof.test.js`, `README.md`, this report, and `docs/river-evolution/*`. The checks manifest lists individual files.

The retained Pages workflow runs tests/build/deployment, then downloads and hashes actual published files for the exact commit, including the new `glassy-jumps-v1` marker. Final task response reports the observed publication result. The cloud's network policy blocks direct Pages browsing, so live-file verification runs on GitHub Actions. Refresh an existing tab after verified deployment; do not clear saved data.
