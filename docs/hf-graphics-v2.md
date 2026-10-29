# HF-GRAPHICS-V2 · v0.13.0

## Audit and activation

The starting checkout was `main` at `4d4b1fe`; `git fetch origin` confirmed `origin/main` matched and the working tree was clean. Its Pages workflow was already present. The entry point is `index.html` → `src/main.js`; there is one active Three.js scene/renderer, not a separate graphics demo. Vite injects package version and the CI `GITHUB_SHA` prefix. The visible label is now **HF-GRAPHICS-V2 · v0.13.0 · commit**; local captures display `local`.

The actual previous rendering architecture and its limits:

| System | Starting implementation | V2 active implementation |
| --- | --- | --- |
| Water | `visuals.js` physical material, `summer-water.js` two wind waves/analytic ripples/depth/foam; `fluid/surface.js` optional shallow-water display | Same exact clipped mesh and optional solver, extended by `hf-water.js`: layered mipmapped directional normal fields, 2–6 additional wave components, IOR 1.333, Fresnel, absorption/depth color, shore foam and local wake turbulence/displacement |
| Reflections | Generated gradient PMREM only; no scene reflections | Physical sky PMREM plus `hf-reflections.js` obliquely clipped planar scenery/boat reflections on High/Ultra; perspective and orthographic support |
| Spray | `main.js` CPU-updated 1,200-point pool + `wake-trail.js` thin spray sheet | `hf-effects.js` fixed 6,144-slot GPU ballistic instanced quad pool; one draw for dense directional jet streaks, softer mist and larger droplets |
| Wake | One historical two-vertex foam ribbon | `hf-wake.js` three historical foam bands plus shared water-shader wake displacement/foam field |
| Lighting | Directional/hemisphere lights, generated gradient sky/environment, ACES | Shared atmospheric Sky and PMREM sun direction, directional/hemisphere lighting, closer shadow bias/contact grounding, ACES and linear HDR post output |
| Boat | Batched original hull/cage/crew, basic PBR clearcoat and engine vibration | Same bounds/root/seat contract; smoother bevels, wet fiberglass/striping, padded seats/harnesses, rounder crew, dashboard dials, wheel spokes, braces, fasteners and engine plumbing |
| Environment | Smooth solid pine tiers, small grass texture, batched venue primitives | Instanced cutout branch/needle firs with near/far geometry, matching alpha-tested shadow material, wind, bank grass/reeds/rocks, ground detail and weathered prop shaders; cabin trim/dock nails/truck grille/mirrors |
| Post | Optional small bloom/saturation/output pass | Same compact pipeline, with a 12-sample depth contact-occlusion option on Ultra; no extra scene/normal render for occlusion |
| Quality | Mobile/High/Ultra labels layered on a maximum High render budget; no water complexity/reflection quality control | Low/Medium/High/Ultra with actual independent wave/reflection/post budgets and corrected resolution application during budget changes |

Dependencies remain Vite, Three.js 0.180 and polygon-clipping. No art, textures, models, shader package or paid service was downloaded. Generated normal/needle/gauge textures are created once and reused. The old water/spray remain connected only for the developer comparison.

## Rendering details

`finishHFWater()` composes with the existing Summer shader and optional fluid display. Normal textures are seamless seeded periodic noise with mipmaps, sampled at different scales, rotations and flow directions. Analytic wave heights stay small and pin to the existing shore fade; this is enclosed freshwater, not a new ocean mesh. Shallow bed transmission transitions into deeper green/cyan absorption. Physical sun specular and dielectric Fresnel vary with the camera angle. Shore noise, the historical wake field and a small surface displacement give turbulent water without changing any boat force. The water animates while stationary. Existing fluid debug colors are retained.

Planar reflections render above-water scene geometry into a 512² (High) or 1024² (Ultra) target, at at most 20/30 Hz. Water and all spray/foam meshes are excluded to avoid recursion and reflection overdraw. Shadows are reused. The clip plane works with both game projections; its bias is expressed in world units to avoid orthographic clipping errors. Reflection intensity follows dielectric Fresnel and the live strength control. Float render targets are used when supported, otherwise byte targets; incomplete targets/errors disable planar rendering and retain sky reflection. Reflection targets are released when disabled or resized. This is a single flat-water reflection, not SSR or ray tracing.

The GPU spray pool uploads launch position, velocity, birth/lifetime, size and family only for new births, using bounded buffer update ranges. Vertex shaders integrate drag/gravity and billboard streaks; fragments soften mist and round droplets. A small volumetric filament core supplies the dense near-outlet arch in one additional draw. The rear outlet is 2.35 m aft in hull coordinates. Pump/throttle, speed, positive acceleration, lateral slip, nozzle and yaw rate influence density/trajectory/asymmetry. Idle/very slow boats generate no giant plume. Old particles keep their world trajectory as the hull turns. Shader clipping ends droplets at the water; the coordinated surface field/ribbons supply whitewater rather than spawning individual impact objects. Per-droplet ripples are not simulated.

The foam mesh records 192 fixed-capacity rows at the stern. A central churn band and separated chine bands widen and fade in world space. The shared water field uses at most 24 historical samples, with fewer shader iterations on lower budgets. All new effects are rendering-only. No reverse input was added; tests cover reverse/lateral velocities because collisions/drift can produce them.

Boat additions are merged into the existing material batches. Engine vibration composes with the paint shader once per shared material, including cockpit visibility batches. Geometry/root/collision dimensions and the flat jetsprint silhouette are retained. Tree branches use alpha testing rather than transparent blending; near/far instance lists and grass density are refreshed at a lower rate. Original cabin/dock/vehicle/spectator placements are retained; shoreline detail stays outside the playable corridor. The track, route, physics, handling, navigation, race, camera and audio implementations are unchanged.

## Presets and saved settings

Open **Game Settings → Graphics Quality Lab**. Presets set real values:

| Budget | Resolution × DPR cap | Shadows | Wave detail | Live reflections | GPU spray slots | Vegetation / distance | Post |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Low | 0.80 × 1.0 | Off | 2 HF waves / 2 normal layers | Off; sky remains | 768 | Reduced / 95 m | Off |
| Medium | 0.90 × 1.35 | 512² | 3 HF waves / 2 normal layers | Off; sky remains | 1,920 | Reduced / 125 m | Off |
| High | 1.0 × 1.7 | 1024² | 5 HF waves / 3 normal layers | 512², ≤20 Hz | 2,688 | Detailed / 160 m | Subtle bloom/grade |
| Ultra | 1.0 × 2.0 | 2048² | 6 HF waves / 3 normal layers | 1024², ≤30 Hz | 6,000 | Full / 220 m | Bloom/grade + depth contact occlusion |

Actual DPR also respects the display DPR and render budget. The two retained base wind components coexist with HF waves. Spray slots derive from the retained base particle setting and render budget; `particleQuality` also changes emission. Shadow size can be capped by the render budget; Low releases its shadow target. Draw distance culls tree/detail instances and conservatively culls batched props; it is not per-object occlusion culling.

New desktop sessions choose High. Coarse-pointer devices choose Low conservatively, or Medium when reported device memory exceeds 4 GB. Safari may omit memory information; manual Medium remains available. Existing graphics data (including Auto) wins, and legacy Mobile profiles/JSON still import. Missing new fields inherit an old preset's budget so an old Mobile setting does not accidentally enable expensive reflections. Graphics keep schema/key `jet-sprint-summer-graphics-v1`; handling, audio, cameras, race records and named gameplay presets retain their existing data. The legacy Graphics selector and Lab render budget remain linked, now including Ultra.

The Lab retains all earlier knobs/JSON/reset/FPS features and adds water detail, live-reflection quality and postprocessing quality. No rendering knob changes physics. **Developer comparison: previous water & spray** temporarily disables HF water/reflections and switches to the previous particles/sheet/ribbon in the same scene. Current lighting/boat/scenery remain. The checkbox intentionally does not persist. Console `__JET_SPRINT_GRAPHICS__.inspect()` reports actual applied budgets, reflection frames, particle emission, scenery counts, camera pose and race state; `compare(true/false)` controls the developer comparison only.

## Before/after evidence

The baseline was served from an isolated checkout of **4d4b1fe**. Matched captures use 1280 × 800, DPR 1, High, the same stationary boat/start position, default Classic/Chase/full-course cameras, sun elevation 35°, warmth 0.65, exposure 1.05, ambient 1.25, controlled frame times and completed countdown. The sky/material system itself changes as part of the upgrade; this is not a different time-of-day comparison. Captures are rendered browser output, not mockups.

| View | Previous commit | HF-GRAPHICS-V2 |
| --- | --- | --- |
| Classic Arcade | [Before](hf-graphics-v2/before-classic.png) | [After High](hf-graphics-v2/after-classic.png) |
| Chase | [Before](hf-graphics-v2/before-chase.png) | [After High](hf-graphics-v2/after-chase.png) |
| Course overview | [Before](hf-graphics-v2/before-overview.png) | [After High](hf-graphics-v2/after-overview.png) |

Additional production captures: [Ultra drift/spray](hf-graphics-v2/drift.png), [Classic stern jet and historical wake](hf-graphics-v2/signature-classic.png), [cockpit](hf-graphics-v2/cockpit.png), [orthographic](hf-graphics-v2/overhead.png), [Low phone viewport](hf-graphics-v2/mobile.png), [retained simulated water](hf-graphics-v2/simulated.png).

## Validation and limits

- `npm test`: 102 passing. Nine new tests cover periodic normal data, perspective/orthographic clipping, render-state restoration/fallback/resource disposal, bounded aft GPU births and three families, historical foam under reverse/lateral motion, distinct persistent quality budgets/old JSON, finite foliage LOD/matched trunk culling, and composition of shared boat shaders. Existing full-race/camera, drift/bank, touch, countdown, settings, navigation, audio DSP and fluid tests remain enabled.
- `npm run build`: passes, with the normal Vite >500 KB chunk advisory (about 223 KB gzip). No new dependencies.
- Production served under `/Jet-Sprint/` in Chromium/SwiftShader: actual Low/Medium/High/Ultra budgets, both water paths, all four cameras, moving/drifting spray/wake, restart, resizing, two simultaneous touch contacts and release, reload persistence, retained top-speed setting and JSON round trip were checked. Console/page errors are monitored, including shader compilation failures. Captures show the active rendering systems.

Controlled animation steps under software WebGL are **not a frame-rate benchmark**. No physical iPhone Safari, sustained mobile FPS/thermal test, subjective audio review or human full-race playtest is claimed. Existing automated races exercise collisions, reversal/lateral velocity, restarting and transitions; browser captures exercise a shorter driving sequence. Full manual races and actual iPhone testing remain necessary.

The scene remains procedural game art; this release does not claim photogrammetry or bespoke production models. Reflections are one planar pass plus sky IBL, without SSR/ray tracing. Contact occlusion is a compact depth approximation, not baked GI. Spray uses analytical GPU motion and coordinated surface foam, without a two-way jet/fluid simulation or individual impact ripples. No new asset-import UI, backend or unrelated gameplay feature is added.

## Deployment verification

The retained `.github/workflows/deploy.yml` runs tests/build on main, uploads `dist`, and deploys through official Pages actions. A commit alone does not establish deployment. Verify that the release commit's **Deploy GitHub Pages** run succeeds, then open `https://soulmullet.github.io/Jet-Sprint/?build=COMMIT` and confirm **HF-GRAPHICS-V2 · v0.13.0 · COMMIT** in the HUD. Reload an old tab; confirm the label before judging the visuals. If an older saved profile is active, choose High/Ultra in the Lab, then use Chase to inspect reflections or Classic to inspect the wake. Use Low/Medium on a phone.

This environment permits GitHub source/Actions access but blocks direct access to `soulmullet.github.io`. Local production rendering can therefore be verified here; public Pages visual output cannot. The release report separately records the actual commit and workflow result.

## Changed source/configuration files

- New: `src/hf-water.js`, `hf-reflections.js`, `hf-effects.js`, `hf-wake.js`, `hf-scenery.js`, `hf-boat-details.js`, `hf-venue-materials.js`, `test/hf-graphics.test.js`.
- Integration: `src/main.js`, `visuals.js`, `summer-water.js`, `boat-presentation.js`, `retro-venue.js`, `graphics-lab.js`, `summer-post.js`, `summer-settings.js`, `graphics.js`, `settings.js`, `fluid/system.js`.
- Version/HUD/documentation: `index.html`, `package.json`, `package-lock.json`, `README.md`, this document and its capture directory. The existing Pages workflow and Vite build-ID injection remain in use.
