# Course V2: Braided Meadows

## Diagnosis

The onboarding checkout initially remained at `543ae32`, but GitHub main had advanced to `3860905`. The remote history was fetched and fast-forwarded before this rebuild, preserving the intervening graphics, fluid, navigation, countdown, controls, settings and V8 Sound Lab changes.

The prior redesign in `3860905` was implemented and connected: `index.html` loads `src/main.js`, which calls `createCourse()` from `src/course.js`. That module used the outer spline exported through `physics.js` plus four branches in `track-layout.js`. The outline retained the older pinched perimeter silhouette, now with a central cross. There was no separate inactive renderer overriding that network. The GitHub Actions listing reports a successful Pages deployment for `3860905` (run `40630713622`). Therefore a skipped implementation or failed deployment is not supported by the evidence. Similar layout and the close follow camera are confirmed sources of ambiguity; a stale client/site cannot be ruled out without observing that client. The public Pages hostname is blocked by this environment's egress policy.

The earlier documentation discussed Shelley Beach research and used Shelter View instead. No runtime code depended on finding that reference. V2 uses no external reference, map, photo, data or network request to generate the course.

## Active implementation

`track-layout.js` now centrally defines identifier `braided-meadows-v2`, version `2`, seed `24028`, six junction nodes, ten spline edges, spline sampling spacing, the simulation extent and prescribed edge order. `course.js` builds every edge directly from this configuration using centripetal Catmull–Rom curves. The old perimeter-fraction/central-cross generator is removed. The `outerSpline`/`physics.course` compatibility export is used only by standalone loop regression fixtures; the playable venue does not import it or render a second loop.

The roughly 640 m rotation runs `S → A → B → C → D → E → S`: east hairpin, west hairpin, east hairpin, alternating flowing bends and an outer return. Four cross-cuts (`A-B-cut`, `B-C-cut`, `C-D-cut`, `C-E`) form multiple substantial irregular islands and alternate navigable junction choices. The route navigator still directs the prescribed rotation, including wrong-route recovery. Gates are generated on unambiguous cross-sections, in distance order, away from shared junction water.

The existing capsule-union/triangulation pipeline in `track.js` is reused for a single united water footprint, sloped muddy shore bands and clipped, raised grassy terrain. It removes overlapping water triangles and keeps terrain out of channels. Collision projection, fluid wet/dry mask, water material and terrain share the new spline network. Water elevation remains zero, visible width remains 18 m, and the hull-center corridor remains 13 m. The fluid domain increases from 144 m to 192 m to contain the outer return without clipping; simulation grid counts remain unchanged. The seed drives deterministic landscape decoration.

Default follow-camera formulas, boat integrator, controls, countdown, five-lap race engine, settings schemas/storage keys, wake/spray and audio modules are unchanged. A new course/route score identifier separates results without deleting old scores or settings. An optional overview is a diagnostic view; it widens fog distances only while selected. The HUD marker and console identifier distinguish the build, but geometry tests and browser images are the evidence for the replacement.

## Verification

Run `npm ci`, `npm test`, `npm run build`, then `npm run preview`. Production uses relative Vite asset URLs, retaining GitHub Pages project-directory compatibility. The existing `Deploy GitHub Pages` workflow builds and deploys pushes to `main`.

The suite covers deterministic geometry, three >135° hairpins over 40 m spans, alternating curvature in three separate sections, continuous route samples, shared junction endpoints, ordered gates, a single connected water footprint with at least four substantial curved islands, domain coverage, spawn clearance, collisions on every branch, terrain clearance, wrong-route rejection/recovery and full-width drift crossings. A binary-input test pilot completes five laps with the existing integrator. Its lookahead, cruising pace and yaw anticipation were adapted for this tighter course; it does not teleport, change handling settings or bypass race gates.

All existing audio, start sequence, touch input, fluid, settings and other regression tests remain enabled. Real iPhone Safari performance and subjective handling/audio still require physical-device testing.

### Recorded results

- `npm test`: **76 passed, 0 failed**, including five laps under the real integrator; `npm run build`: passed (the existing bundle-size advisory remains).
- Production preview mounted at `/Jet-Sprint/`: Chromium loaded the active V2 network, started the countdown/race, accepted keyboard throttle plus steering, displayed 47 km/h with visible wake, and reset speed to zero on restart. No JavaScript page errors were observed. The default follow camera and optional overview were captured and visually inspected; a 390 × 844 viewport was also inspected.
- These browser checks used low graphics/legacy water and controlled animation-frame advancement under headless software WebGL. They verify rendering and input plumbing, not real-time frame rate, full manual laps, actual touch hardware or iPhone Safari. Geometry/shoreline and fluid regressions separately exercise the new shared network.
- [Actual production overview screenshot](course-v2-overview.png). The prior deployment's successful workflow does not establish that this V2 commit has deployed. Check the new `Deploy GitHub Pages` run for the commit on main. Direct public-site verification from this environment is blocked for `soulmullet.github.io` (proxy CONNECT 403); GitHub workflow pages remain readable.
