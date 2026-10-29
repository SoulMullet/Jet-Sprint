# JET SPRINT / ARCADE-GUI / v0.15.0

## Inspection and scope

Started from clean `main` at `7e2546c`, matching `origin/main`. The active entry is `index.html` → `src/main.js`. The old CSS contained successive overlapping themes, and independently fixed Game Settings, Sound Lab, Physics Lab and camera launchers. `mountSettings`, `mountPhysicsLab`, `mountGraphicsLab`, `mountSoundLab` and `mountCameraPanel` already owned the working inputs and their stores. They are retained. No new gameplay controller, renderer, pause system or persistence layer was introduced.

## Identity and screens

- Original condensed italic JET SPRINT marquee, orange/gold/teal speed stripes, course entry plate, vector course motif and favicon. The title screen is a responsive racing poster over the existing live game scene.
- Graphite `#11191D`, warm ivory `#E8D9B5`, racing orange `#E65C28`, vintage gold `#D9AC46`, instrument teal `#4D858B`. Typography, spacing, borders, shadows, motion and states are centralized in `src/design-system.css`.
- Locally served Barlow Condensed ExtraBold Italic / SemiBold and IBM Plex Mono Regular. Full OFL licenses and source attribution are in `public/fonts`; 120,304 bytes of WOFF2 fonts total, no external font service or package dependency.
- Racing HUD: ivory speed face, live engine RPM/segmented tachometer, lap/elapsed/best instruments, SVG navigation arrows, horizontal race-control starting lamps, compact camera/setup/restart toolbar and large physical steering/throttle controls.
- **Pit Control**: one nonmodal shell with RACE, HULL, VIDEO, V8 and VIEW tabs. It reparents the existing live-bound DOM panels without copying inputs, replacing event handlers or changing stored values. The RACE tab retains water/spray/general settings, overview, debug tools and full-game presets. HULL retains all six physics categories and physics-only presets. VIDEO retains quality controls/comparison/JSON. V8 retains the dyno and all sound controls/presets. VIEW retains all four cameras and per-mode tuning.
- Shared custom button, slider/readout/reset, toggle, select, tab, disclosure, status, tooltip and modal styles. Every slider gets an individual default action using its owning store. Camera resets follow the current mode. A native range's keyboard/touch semantics are retained beneath its custom appearance.
- Results: classification slip, five lap rows, name/save/leaderboard and Race Again. The existing result data and scoring logic are unchanged. Full-game preset overwrite/delete/reset confirmations now use the shared styled dialog.
- Fast transitions and tachometer movement respect reduced-motion preferences. Tab arrows/Home/End, Escape/focus restoration, dialog focus containment, visible focus and disabled/pressed states are included. Minimum 44 px normal control targets; existing large steering targets are retained.

## Preservation and corrections

The track, race gates/version, physics/handling, hull motion, touch bindings, camera calculations, effects, audio synthesis, countdown logic, scoring and all storage schemas/keys remain unchanged. The HUD reads the existing engine RPM rather than estimating revs from speed. `GAME_VERSION`/package version is 0.15.0; the gameplay scoring version remains unchanged so this visual update does not split leaderboards.

The console releases held inputs on opening, as the prior tuning panels did. Closing it, or switching away from V8, ends an active stationary dyno test; this prevents an invisible test from freezing the race. Normal tuning still runs live without pausing.

Browser checks exposed a pre-existing representation mismatch: the graphics water-transparency slider had a 0.05 step but a 0.12 default. Its UI step is now 0.01; the default, renderer value and saved settings are unchanged. The route cue's short animation now respects reduced motion and avoids a fixed transform that conflicted with responsive positioning.

## Verification

- `npm test`: **115 pass, 0 fail**. Existing tests include controls, physics, water, cameras, all three handling presets' five-lap completion, countdown, race scoring and settings migration. No tests were disabled or rewritten for this UI change.
- `npm run build`: passes. The existing Vite large-chunk advisory remains (main JS about 806 KB / 232 KB gzip). No dependencies were added.
- Headless Chromium with software WebGL, using the actual Vite entry: **102 initially mounted numeric sliders** were changed through their original handlers and individually reset. Each has a numeric output. Additional mode-specific camera sliders/reset defaults were checked in all four modes.
- Exercised all registry toggles/dropdowns, all three handling presets and six category resets, physics custom save/update/load/rename/delete, four graphics presets/quality options/comparison/toggles, four V8 presets and dyno throttle/reset, full-game save/overwrite/rename/load/delete/reset cancellation, JSON export/import and file imports for game/physics/audio, and graphics JSON import/export.
- A real reload retains handling, master volume, camera mode/zoom, audio preset and graphics choices in their original storage keys. Mounting retains pre-existing nondefault tuning. No duplicate IDs were found.
- Phone touch emulation: actual touch drag on the custom-styled range changes the bound value; reset restores it. Two simultaneous touch contacts activate steering and throttle and drive the original boat physics; release clears both. Keyboard acceleration/restart remain functional.
- Layout/hit checks at **320×568, 375×667, 390×844, 667×375, 844×390 and 1920×1080**, plus 1440×1000 screen captures. All five departments scroll within the console; Close remains above the content and clickable; the console ends above throttle; timing fits after a best-lap value appears; no document overflow was found. Compact landscape uses available space above its tabs while retaining steering/throttle clearance.
- Results were exercised by a **test-only browser response interception** that calls the real finish/render path with a completed five-lap fixture. Verified all lap rows, driver name, local save/leaderboard, disabled Save and restart. No results hook is shipped. This is not a claim of a manually driven full race.
- Tested keyboard tab navigation, Escape/focus restoration, confirmation focus trap/cancel, dyno tab/close transitions, audio unlock/RPM response and page/shader error capture. Browser runs reported no application/shader errors.
- Production subdirectory/font loading and final smoke results are recorded below. Representative screenshots are in `docs/arcade-ui/`; these are browser renders, not image mockups.

## Changed files

`index.html` (screen markup/SVG identity); `src/design-system.css` (tokens/components); `src/style.css` (responsive composition); `src/interface.js` (console/adapters); `src/ui-components.js` (range, tooltip, confirmation and focus primitives); `src/main.js` (UI mounting, RPM and keyboard form scope); `src/settings-panel.js` (styled confirmations); `src/graphics-lab.js` (units/slider precision); `src/navigation.js` (reduced motion); `src/settings.js`, `package.json`, `package-lock.json` (release version); `public/identity.svg`, `public/fonts/*` (original symbol and licensed fonts); `README.md`, this document and screenshots.

## Limits

No physical iPhone Safari, sustained frame-rate/thermal benchmark, screen-reader audit or subjective audio assessment was performed. Chromium touch emulation does not establish those results. Native select/file/share/clipboard pickers retain platform behavior; clipboard/share fallbacks remain available. There was no existing pause screen, and none was added. Public GitHub Pages visual access may be blocked by this workspace's outbound network policy; local production rendering and the GitHub Actions deployment result are checked separately.

## Final production check

Served the production output at `/Jet-Sprint/`, including the three local WOFF2 fonts, favicon, script, stylesheet and audio worklet. Verified the ARCADE-GUI/v0.15.0 marker, camera cycling, keyboard driving/restart, live overview, water/debug action buttons, all clipboard paste controls, JSON download/share fallback, confirmed full-game reset, explicit audio unlock, dyno-close behavior, tooltips and mobile rendering. No failed resource requests or application/shader errors were reported. The existing GitHub Pages Actions workflow remains unchanged and deploys pushes to `main`.
