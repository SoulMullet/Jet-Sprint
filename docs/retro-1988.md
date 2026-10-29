# Cedar Creek Invitational, summer 1988 — v0.10.0

## What is active

`index.html` loads `src/main.js`, which calls `createCourse()` from `src/course.js`, renders its network through `track.js`, and creates/updates the real `createRetroVenue()` scene. There are no downloaded assets, runtime backend calls, new packages, or inactive prototype renderers.

`track-layout.js` now holds a single closed centripetal Catmull–Rom figure-eight, approximately 300 m long, with two broad loops, two grassy islands and one flat diagonal crossover. Each graph edge samples the same parent spline, so joins retain smooth tangents. The ordered rotation is `S → W → J → R → J → S`; the two visits to J cross in distinct directions. Gates and navigator cues follow that order. A short dead-end inlet at W holds the dock and moored boat, outside the lap route. The previous Braided Meadows network is replaced, not rendered underneath.

Course ID: `cedar-creek-figure-eight`, layout version `3`; route ID: `figure-eight-1988`. A new score identity separates records without deleting old scores. The HUD and title screen show **JET SPRINT — RETRO 80s / FIGURE 8**; the console also logs the active track ID. Use **Game Settings → Figure-eight overview** for the full layout. Normal camera tracking formulas remain unchanged.

## Venue

- Warm ACES lighting, atmospheric haze, darker pine foliage, seeded natural grass, earthy banks, shoreline rocks/reeds, distant low-poly hills and richer blue-green water. Existing water modes, simulated waves, reflections, wake and rooster-tail sliders remain in place; the legacy shader's pale shoreline band is restrained.
- A weathered wood race-office cabin with pitched roof, porch/railings, emissive warm windows and porch lamp, chimney, chairs, firewood, office sign and race schedule.
- A plank dock with posts, cleats, tire bumpers, maintenance drums, a gently bobbing moored two-seat sprint boat, small post ripples and a “JET SPRINT RACING” sign.
- Three cleared spectator terraces with 24 spectators, varied tees/shorts/caps, seated and standing poses, idle arm motion and proximity-triggered cheering. Folding chairs, coolers, umbrellas, wooden fences and small radios support the viewing areas. Spectators remain on land, and the dock/parked boat are over 18 m from the prescribed route centerline.
- A square-body pickup and original fictional sponsor signs: Mossback Marine, Cascade Motor Oil and Cedar County 88.
- Restrained cream/orange/ink HUD panels, monospaced timer digits, racing typography and retro title/menu styling. No full-screen grain, bloom or expensive postprocessing is added. Every settings category and Sound Lab control remains available.

Static props are baked into 20 material batches (5,026 triangles). Crowd bodies, heads, caps, legs and arms use five instanced meshes; the 48 arms animate without skeletons or per-frame transform-object creation. Existing adaptive quality, instanced forest, shadows and particle budgets remain. Clearings keep trees and rocks out of prop/viewing areas. The player's handling, throttle-dependent jet steering, countdown, race engine, controls, sound synthesis, storage schemas/keys and default camera are unchanged.

Terrain refinement now splits shared edges consistently across neighbouring triangles. The older per-triangle subdivision could create T-junctions, which cracked when terrain heights were applied. A topology regression now rejects unmatched interior edges; the corrected terrain was visually checked.

## Prior deployment investigation

At the start, the workspace and GitHub main both referenced `4f7ca59`. That course rebuild had a successful Pages workflow, and its active entry point imported the course and V8 Sound Lab. No disconnected audio/course implementation or skipped deployment was found. Client caching cannot be diagnosed without seeing that client. The public Pages domain remains blocked by the cloud egress policy; GitHub's workflow pages are readable. Historical course documentation is retained as history, not active configuration.

## Verification

- `npm test`: **79 passed, 0 failed**, including five laps using the unchanged integrator; ordered crossover passes; wrong-route rejection/recovery; water/shoreline/terrain geometry; crowd safety/batching; simultaneous input handling; audio DSP; countdown; and stored-settings migration.
- `npm run build`: passed. Existing Vite bundle-size advisory remains; JS is approximately 193 KB compressed. Procedural scene content does not require runtime asset downloads.
- Production preview mounted at `/Jet-Sprint/` was checked in Chromium using medium graphics and legacy water. The exact figure-eight and venue were captured and visually inspected. Keyboard throttle/steering, nonzero speed, visible wake and restart were verified without JavaScript or shader errors.
- All 32 Sound Lab tuning controls remain in the production DOM. Starting the stationary engine test, changing test throttle and advancing frames left the race clock frozen; ending the test returned to the game.
- At a 390 × 844 viewport, simultaneous throttle + steering touches were dispatched through Chromium's touch emulator. Both controls activated together and released cleanly. This is not a physical iPhone test.
- Browser captures used controlled animation-frame advancement under software WebGL. No real-time FPS, sustained mobile thermal behavior, subjective sound quality, full manual five-lap race or physical iPhone Safari claim is made. Simulated-water numerics and rendering regressions also pass; this release's browser screenshots use legacy water.

[Production overhead capture](retro-1988/overview.png) · [Production driving capture](retro-1988/driving.png)

## GitHub Pages

The existing `.github/workflows/deploy.yml` runs tests/build and deploys `dist/` on pushes to `main`. Vite's relative asset base remains unchanged. Review the **Deploy GitHub Pages** run for the commit; a local commit alone is not deployment.

After that run succeeds, open `https://soulmullet.github.io/Jet-Sprint/?build=retro-1988`. Reload an already-open tab. Confirm the exact **JET SPRINT — RETRO 80s / FIGURE 8** label, then inspect **Game Settings → Figure-eight overview**. The venue should show two large connected loops, two islands, a left-side staging inlet, cabin and spectator groups, rather than the former serpentine network. Direct public-site visual verification is unavailable from this environment because its proxy denies that hostname.
