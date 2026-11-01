# Randomized race soundtrack — v0.26.0

The existing game now streams these exact user-supplied files without renaming or modifying them:

| Repository path | Bytes | Browser metadata duration |
| --- | ---: | ---: |
| `public/audio/music/Funky Glitch Groove.mp3` | 4,236,816 | 177.2 s |
| `public/audio/music/Turbo Racer X.mp3` | 3,441,560 | 154 s |

Vite copies `public` into the production root. `import.meta.env.BASE_URL` supplies the relative deployment prefix; spaces are URL-encoded. On GitHub Pages the URLs are `/Jet-Sprint/audio/music/Funky%20Glitch%20Groove.mp3` and `/Jet-Sprint/audio/music/Turbo%20Racer%20X.mp3`.

## Behavior and controls

Every start/restart independently chooses `Math.random() < 0.5`, then natural `ended` events select the other track indefinitely while the race is active. A near-end fade precedes each transition; the next song fades in. Start, pause, stop and same-track restarts use 1.5-second gain ramps. This is sequential playback, with no requirement for overlapping crossfades. Pause, Garage, replay viewing, portrait blocking, hidden pages and the engine dyno suspend playback; resume continues the same track. Results/exit stop music; page unload stops immediately.

**Pit Control → V8 → Race soundtrack** includes Music Volume (0–100%, default 35%), Music Mute, individual resets through existing controls, and Enable / resume music. Volume/mute live in the existing `jet-sprint-settings` schema-3 store; old saves acquire defaults without changing other fields. Existing presets/export/reset include the new registered settings. Master Volume and Mute all sound also affect music. Engine Volume and V8 presets remain independent.

`RaceMusic` owns exactly two reusable HTMLAudioElements feeding gain nodes in a separate Web Audio context. Elements stream MP3s rather than decoding entire files into game arrays. A pointer/keyboard gesture primes both elements, which supports subsequent automatic playlist changes. Controller-only starts may require one touch/click or the recovery button under browser autoplay policies. No playback is requested before the first gesture. Unsupported Web Audio or missing/failed files update a status message without throwing into gameplay; if only one file works it repeats. Delayed fade callbacks use generation checks so restarts cannot stop newer playback.

## Verification and limits

- `npm test`: 270 passed, zero failed (including six soundtrack tests).
- `npm run build`: production build passes; Vite retains its existing large-bundle advisory.
- Tests cover exact names/base URLs, 50/50 threshold, alternation, two-element reuse, rapid restart/stop/resume, gain ramps, mute/volume, failed files, autoplay refusal and settings persistence.
- Production publication verification now requires both exact MP3 paths and hashes every deployed asset, including both MP3s. A local source change alone is not publication evidence.
- Real browser results are recorded in [music-browser-proof.json](music-browser-proof.json).
- No physical iPhone Safari or Xbox test, subjective listening/mixing assessment or real-device performance measurement was performed. Desktop Chromium mobile emulation cannot establish those results.

## Changed files

- `src/race-music.js`: streaming playlist, gesture unlock, fades, failure handling and lifecycle controller.
- `src/main.js`: existing race/pause/results/visibility integration and Audio Lab controls.
- `src/settings.js`: registered saved volume/mute; release version.
- `test/race-music.test.js`: focused controller/settings tests.
- `scripts/build-proof.mjs`, `scripts/verify-deployment.mjs`, `test/deployment-proof.test.js`: verify exact published music assets.
- `package.json`, `package-lock.json`, `index.html`, `README.md`: release identifiers and documentation.
- `docs/RACE_MUSIC.md`, `docs/music-browser-proof.json`: implementation and browser evidence.

The MP3 uploads were already present in the repository. No boat, course, physics, steering, camera, water, race-timing or engine synthesis implementation was changed.
