# SUMMER 1987 — v0.12.0

## Audit and active scene

The starting checkout and GitHub main were both `1aee193`. The figure-eight course, ordered five-lap race, V8 Sound Lab and all four saved racing cameras were present and connected to `src/main.js`. The existing `.github/workflows/deploy.yml` builds/tests main and publishes `dist/`; Vite keeps its relative asset base for the project directory. No disconnected prototype, missing audio feature or replaced course was found. The former course/audio deployment had succeeded; there is no evidence that those modules were skipped. Direct access to the public Pages hostname remains blocked by this cloud environment's network policy.

The actual playable HUD now displays **SUMMER 1987 · v0.12.0 · build-id**. In GitHub Actions, Vite injects the actual `GITHUB_SHA` prefix; local builds display `local`. The course ID, route, physics, handling defaults, race rules, navigator, touch controls and audio modules remain unchanged. Existing saved gameplay, audio and camera data are retained.

## Water and spray

Both water modes share the new Summer finish: shoreline-pinned animated wind waves, small surface ripples, depth-based turquoise/green color, darker channel centers, environment reflections, Fresnel/PBR specular response, soft shoreline foam and a shallow riverbed beneath transparent water. The procedural renderer uses the existing exact clipped/tessellated channel, without a rectangular water plane or a new fluid simulation.

New sessions default to this lighter procedural renderer. Existing saved water-mode choices win. The previous GPU shallow-water solver remains selectable; it is now created on demand and released on return to procedural water. Summer appearance controls also apply to its surface; wave intensity combines with the retained visual-height setting, and wave speed scales the optional solver clock without changing the race clock, and the existing height/debug/reset controls remain available. Unsupported solver capabilities retain the procedural fallback. Diagnostic waves default off for fresh settings; saved diagnostic preferences are respected. Diagnostic ripples are distinct from the boat wake.

The old expanding wake rings are replaced by a fixed-capacity foam ribbon following recorded stern positions. Every new row starts 2.35 m behind the hull center; older rows stay in world space and dissipate over the selected lifetime. The wake can be encountered again after turning around, as real historical wake can. It is not emitted ahead of the hull. GPU noise breaks up the foam without repeated chevron stamps. A small curved GPU spray sheet gives the white rooster tail its dense core; pooled ballistic droplets and secondary splashes provide mist. Throttle/pump strength, speed, nozzle steering and lateral slip affect spray. Existing spray distance, water volume and effects controls still apply. Particle count has a fixed 1,200-point allocation and a live draw limit, not repeated buffer reallocations.

## Lighting, venue and boat

Warm adjustable late-afternoon directional sunlight, hemisphere fill, soft dynamic shadows, atmospheric haze, a gradient sky and generated environment lighting set the palette. The optional compact post pipeline combines highlight bloom and saturation, followed by tone/color output. It operates on scene pixels only; HUD/input controls stay crisp. Mobile's neutral grade and zero bloom bypass the post pipeline entirely. Disabled effects release their render targets, and resolution/shadow resources update only when needed.

The figure-eight and shorelines remain intact. The venue now has smoother irregular pine canopies, rounded distant hills/rocks/shrubs, fine procedural grass/bump detail, an access path shaded directly onto existing terrain, a timing booth and parked trailer. The weathered cabin, porch, dock, launch/staging inlet, pickup, fences, chairs, coolers, umbrellas, radios, racing signs and original fictional sponsors are retained. Four spectators now form a small dockside group on tested land. Twenty-four spectators remain available at full density, using smoother instanced torsos/limbs/heads, summer clothing, sitting/standing poses, idle motion and cheering.

The original two-crew boat is retained, with clear-coated fiberglass, metallic engine reflections and its working cockpit/camera visibility. `BoatPresentation` adds small visual pitch/roll and RPM-driven engine vibration without writing any boat physics values. Its tested `replaceVisual(resolvedModel)` attachment API normalizes an X-forward future model to the hull contract. No imported AI asset, file picker or GLTF-loading UI is claimed in this release.

## Graphics Quality Lab

Open **Game Settings → Graphics Quality Lab**. All controls are connected to the active renderer/effect pools:

| Group | Controls |
| --- | --- |
| Water | Wave intensity, speed, reflections, transparency, foam, rooster density, particle limit, wake persistence |
| Lighting | Sun elevation/warmth, shadow quality, ambient brightness, haze, bloom, exposure, saturation |
| Environment | Vegetation density, spectator density, object draw distance, particle quality |
| Performance | Resolution scale, pixel-ratio cap, shadow resolution, adaptive graphics preset, FPS display |

**Mobile / High / Ultra** presets, **Reset graphics defaults**, **Copy settings JSON**, **Paste JSON** and **Import JSON** are implemented. Clipboard restrictions fall back to the visible JSON box. Profiles and settings use their own `jet-sprint-summer-graphics-v1` key/schema; gameplay/audio/camera records and presets are not reset. The Lab's adaptive graphics selection is linked to the existing Graphics selector. The diagnostic full-course overview extends haze distances for readability. Device DPR and adaptive quality cap the effective resolution/shadow size; FPS/readout reports actual canvas dimensions and animation-frame rate. It is not a promised device benchmark.

Vegetation uses instancing and density/distance culling. Spectator count changes the active instanced population. Draw distance also culls static material batches conservatively by their bounds and controls haze. Most world props remain batched, avoiding one draw call per plank. Wave controls update shared uniforms; opacity/reflections update actual materials; particle limits update the actual draw range. A read-only console diagnostic, `__JET_SPRINT_GRAPHICS__.inspect()`, exposes applied renderer/uniform/pool state for troubleshooting, without a mutation API.

## Validation

- `npm test`: **93 passed, 0 failed**; includes all prior camera, five-lap integrator/navigation, countdown, settings, audio DSP, collision, terrain and fluid regressions. New checks cover independent graphics persistence/JSON validation, aft wake origins, finite outward-facing pine normals, visual-only boat motion and solver-free procedural startup.
- `npm run build`: passed. Existing Vite bundle-size advisory remains; there are no new package dependencies or downloaded runtime art assets.
- Production served under `/Jet-Sprint/` was checked in Chromium with actual WebGL shader compilation. Classic/Chase/overview and phone-sized captures show the active scene. The graphics binding checks changed real water uniforms/materials, shadow maps, sun/ambient/exposure/haze, bloom/saturation, tree/spectator counts, particle draw range, canvas resolution and FPS visibility.
- Graphics settings survived reload. JSON export/import round-tripped. Mobile disabled postprocessing/shadows; High restored the detailed path. Existing top-speed tuning remained intact. The retained solver compiled and rendered at **128² GPU float32**, and returning to procedural water released its surface/solver.
- Throttle produced motion and a visible stern wake/spray. Restart and simultaneous simulated steering/throttle at 390 × 844 passed without JavaScript or shader errors.

Captures: [Classic](summer-1987/classic.png), [Chase](summer-1987/chase.png), [overview](summer-1987/overview.png), [simulated water](summer-1987/simulated.png), [Mobile](summer-1987/mobile.png).

## Explicit limits and deferred work

The 60/30 FPS figures are targets, not verified results. Browser captures use controlled animation-frame advancement under software WebGL. Physical iPhone Safari thermal behavior, sustained frame rate, subjective handling/sound, and full manual races require device testing. The existing automated five-lap tests are not human playtesting.

Reflections use generated environment/sky lighting; there is no live planar reflection or screen-space reflection pass. Screen-space ambient occlusion is deferred in favor of ambient fill and dynamic contact/cast shadows. A full imported GLB/GLTF asset pipeline and model-selection UI are deferred; the visual attachment contract is ready. No claim is made that the procedural venue matches bespoke production art.

The Pages workflow result must be checked for the release commit; saving or committing source alone does not deploy it. After that run succeeds, open `https://soulmullet.github.io/Jet-Sprint/?build=summer-1987`, reload an existing tab, and confirm the version/commit label. Use the figure-eight overview and the Lab to verify that this is the intended scene. Direct public-site visual verification remains network-blocked from this environment.
