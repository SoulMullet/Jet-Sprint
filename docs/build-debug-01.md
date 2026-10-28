# BUILD DEBUG 01 — Entry point and deployment audit

## Repository and running application

The audit began on local branch `work`, clean, at `39cf08849b5321e61a053429f81ef6be2b7354e2`. `origin/main` matched after fetching. The repository is `SoulMullet/Jet-Sprint`; its default/deployment branch is `main`.

The source entry point is root `index.html`, which imports `/src/main.js` as a module. `src/main.js` creates the Three.js renderer in `#game`, imports `createCourse` from `src/course.js`, generates the water/banks from `venue.network` using `src/track.js`, and mounts the settings panel. Vite compiles that entry to `dist/index.html` plus content-hashed files under `dist/assets/`. There is no separate frontend project or alternate entry point in this repository.

## What exists, and what does not

The interconnected course exists and is integrated. It was introduced in commit `b7b6774`, and contains nine waterway segments, including four interior segments through junction J. Its prescribed route is approximately 570 m long. The original outer loop and starting straight were deliberately retained. Commit `39cf088` corrected checkpoint/navigation validation; it did not redesign the waterway geometry again. Therefore the starting view remains similar, while the interior junctions differ.

A search of all tracked files, available branches and Git history found no V8 Sound Lab component, panel or integration. `src/audio.js` contains the procedural `Engine` synthesizer, and the settings registry contains mute/master volume controls. Those are not a Sound Lab. The feature cannot appear through a refresh because its implementation is absent. This debugging patch does not invent or implement it.

## Deployment evidence

The workflow `.github/workflows/deploy.yml` runs on pushes to `main`: checkout, Node 22, `npm ci`, tests, Vite build, upload `dist`, and deploy the Pages artifact. `vite.config.js` uses `base: './'`, suitable for the project URL. `dist/` is intentionally ignored by Git; Actions builds it from source. No workflow or build configuration fault was found in this audit.

Both recent commits have successful build and deployment runs. For `39cf088`, [workflow run 40598679346](https://github.com/SoulMullet/Jet-Sprint/actions/runs/40598679346) reports successful build and deploy jobs and the destination `https://soulmullet.github.io/Jet-Sprint/`.

The actual `github-pages` ZIP artifact for that run was downloaded and inspected (artifact ID `12777303743`). Its SHA-256 matches GitHub's reported digest: `5d13e52a2a8541b9d3e8e68294f13c326b36c13f61fc87c4096210370c191ab2`. It contains:

- `index.html` identifying v0.7.1 and loading `./assets/index-BUqF6jAA.js`.
- A compiled bundle containing `emerald-network`, `crosswater-1`, Navigation Debug and Bigfoot Debug.
- No Sound Lab implementation.

This is evidence that the network-course implementation reached the deployed artifact. It does not prove what a particular user's browser currently displays.

## Cache and URL diagnosis

No service-worker registration, Cache Storage logic or PWA cache is implemented in the repository. Asset names are content-hashed. An old open tab, cached document, different preview URL or different site may still explain a user's older view, but that is not confirmed without the exact URL and visible build marker. The unchanged starting area is also not evidence of a stale build by itself.

Direct access to the live Pages host is blocked from this execution environment: the proxy rejects the HTTPS CONNECT to `soulmullet.github.io` with 403. The web reader also cannot open that host. This is an environment access restriction, not evidence that the public site returns 403. GitHub's workflow status and deployment artifact were accessible. Live-page freshness cannot be claimed from these checks.

## Minimal change and visible verification

This patch adds exactly `JET SPRINT — BUILD DEBUG 01` to the start screen and racing HUD, with high-contrast styling. Game version, course, camera, physics, engine audio, controls, saved settings and leaderboard logic are unchanged.

`npm test` passes all 16 discovered test files. `npm run build` passes, with the existing large-chunk advisory. The production build was served under `/Jet-Sprint/` using Vite preview's `--base /Jet-Sprint/` option. Chromium with mobile viewport/touch emulation verified the exact marker on the visible intro screen and racing HUD, a rendered 390 × 844 canvas, a running race timer, project-relative asset loading, portrait/landscape layouts and no page errors. Screenshots were captured and visually inspected. This was local production-build verification, not live Pages or physical-iPhone verification.

## Viewing the fix

After the new commit's Deploy GitHub Pages workflow succeeds, open:

`https://soulmullet.github.io/Jet-Sprint/?build=debug-01`

Confirm the exact green build marker before evaluating any other visual difference. For the existing track changes, enable **Game Settings → Debug Tools → Navigation Debug** to see the interior course route and gates. No Sound Lab panel should be expected from this repository state.

Local reproduction:

```sh
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --base /Jet-Sprint/
```

Then open `http://127.0.0.1:4174/Jet-Sprint/?build=debug-01`. A plain preview without `--base /Jet-Sprint/` instead serves at `/`; manually adding the project prefix to that server's URL does not emulate GitHub Pages hosting.

Exact files changed by this patch: `index.html`, `src/style.css`, `docs/build-debug-01.md`.
