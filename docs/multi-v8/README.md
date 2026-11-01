# Six-recording procedural V8 — v0.28.0

The actual game `Engine` now mixes six recordings under one continuous audio-only RPM model. No physics, track, camera, controls, music playlist or progression system was replaced. The previous two-recording implementation is documented historically in [engine-audio](../engine-audio/README.md).

## Recordings and analysis

All supplied originals remain unchanged in the case-sensitive `public/audio/Engine/` directory.

| Original | Duration | Stereo RMS / peak (linear) | Live role |
| --- | ---: | ---: | --- |
| `EngineIdle.m4a` | 7.964 s | 0.163 / 0.718 | Continuous idle bed, 0.35–4.95 s |
| `EngineRev.m4a` | 4.458 s | 0.225 / 1.021 | Three acceleration regions, starts 0.28/0.46/0.64 s, lengths 1.55/1.45/1.35 s |
| `EngineRevDown.m4a` | 3.413 s | 0.143 / 0.492 | Three release regions, starts 0.18/0.26/0.34 s, lengths 2.85/2.70/2.60 s |
| `EngineCruise.m4a` | 5.805 s | 0.172 / 0.598 | Main cruise loop, 0.25–1.20 s |
| `EngineCruiseLayerOne.m4a` | 3.344 s | 0.115 / 0.474 | Secondary cruise loop, 0.25–2.20 s |
| `EngineJump.m4a` | 0.929 s | 0.110 / 0.504 | Airborne loop, 0.09–0.80 s |
| `EngineCruise.wav` | 5.757 s | 0.155 / 0.539 | Cruise compatibility alternative; never another simultaneous layer |
| `EngineRev.wav` | 4.410 s | 0.203 / 0.919 | Rev compatibility alternative; never another simultaneous layer |

The M4As are AAC, 44.1 kHz stereo. Existing WAVs are 32 kHz stereo PCM. Levels above were measured in decoded stereo float PCM at 32 kHz for comparison; container/decoded durations differ slightly because of AAC padding. Rev has a very small decoded codec overshoot above full scale. Loop peak normalization, compression and a safety ceiling provide playback headroom.

[Waveforms and spectrograms](source-analysis.png) were inspected. [Full source measurements, hashes, quiet-edge windows and spectral evolution](source-analysis.json) are reproducible using `python3 scripts/analyze-engine-audio.py` (optional ffmpeg/ffprobe, NumPy, SciPy and matplotlib; no game/build dependency).

Idle has a comparatively steady low-frequency pattern, especially before approximately 5 seconds. Main cruise has a stable early section; the secondary cruise has a different noise/harmonic pattern and slower texture evolution. The selected regions avoid leading ramps, the short jump recording's quiet tail and abrupt file ends. Rev builds through a louder middle section. RevDown is a field recording with changing timbre rather than a calibrated, strictly monotonic RPM sweep; the model's falling playback rate and envelope guide its release behavior.

The existing WAVs correlate above 0.999999999 with their M4As after resampling, with approximately 0.9 gain. They are alternate representations, not additional engine recordings. The complete secondary cruise against the main clip has a maximum aligned correlation of approximately 0.076, so it is not an identical excerpt. This comparison does not establish perceptual absence of phasing or beating.

There is no RPM telemetry. All reference RPMs are artistic timbre anchors, not measured source calibration. The recordings contain a broadband field-noise bed. No listening/transcription/source-separation service was available, so music, speech or other contamination cannot be confidently excluded. Subjective loop naturalness, timbral matching, phase interaction and “one engine” realism still require listening.

Four new same-recording WAV compatibility copies were generated for Idle, RevDown, CruiseLayerOne and Jump. Existing originals and both existing WAVs were not overwritten. The converter skips existing outputs:

```sh
bash scripts/convert-engine-audio.sh
```

Conversion uses 32 kHz stereo PCM16 and 0.9 gain to preserve headroom for codec/resampling overshoot. The loader prefers original M4A decoding and tries the matching WAV on failure, explicitly reporting the chosen format. It never layers both representations. A failed asset does not stop the race or silently invoke synthesis. Other available bed loops provide a labelled degraded mix where possible. Fetches are bounded; loops install independently as their files finish loading.

## One controller and one RPM model

`src/engine-rpm.js` owns only audio state. It reads throttle, throttle change, speed, engine/pump load, planing, forward acceleration, slip/yaw, and authoritative campaign airborne/landing contact. Exponential responses give separate throttle response, rising/falling RPM and inertia. Throttle can rev the engine before the hull accelerates; RPM never directly equals boat speed. No forces or boat fields are written, and no transmission/gears were introduced.

Takeoff requires continuous airborne contact for the saved detection delay (80 ms default). Brief contact jitter is rejected. Flight reduces water load, allows RPM to rise more freely in proportion to throttle, blends the jump recording in and reduces the water-loaded cruise bed. Near-zero throttle retains idle instead of a full-power flight sound. Contact hysteresis and the actual landing event restore water load through a saved landing envelope. `main.js` retains the landing flag across physics substeps so it is not lost before the audio update.

Four reusable BufferSources provide idle, main cruise, secondary cruise and jump. Loops have DC removal, conservative RMS/peak normalization and precomputed complementary raised-cosine seam splices (60–100 ms). Relative loop lengths and a secondary start offset prevent identical repetition. Main/secondary gains share an equal-power cruise budget; secondary prominence varies slowly with RPM and load, with at most 0.25% additional playback-rate variation. The entire bed is normalized before independent user volume controls. User mutes do not get normalized back up.

Rev and RevDown are bounded one-shot foreground voices over that continuous bed, with separate level and scheduled attack/release envelopes. Three regions rotate per role. Meaningful throttle rises arm acceleration, with a 1.6-second default cooldown. RevDown requires a cumulative drop (25 percentage points default), sufficient RPM and an 850 ms default cooldown. Small throttle fluctuations cannot repeatedly retrigger it. Reapplication fades RevDown out immediately and allows the accelerating bed/rev to take over. Retiring sources disconnect on end; reset/pause also release already-retiring voices.

The same simulated RPM drives all playback rates. Approximate anchors are 900 RPM idle, 4200/4400 cruise, 6400 jump and 4800 for the transient starting timbre. Loop rates are smoothed and bounded to 0.72–1.32×; transients stay within 0.82–1.18×. Idle/redline tuning changes audible steady pitch. No engine oscillators, generated engine noise, AudioWorklet or per-sample JavaScript processor is used.

All engine layers feed shared EQ, restrained saturation and stereo width. Engine volume/mute, reflections and an adjustable engine-only compressor feed the existing safety output. Music keeps its own context/gain and is never compressed or ducked by this engine compressor. Existing countdown/wildlife effects keep their paths. Restarts reuse the same loop buffers/sources and context. Pause fades and suspends; resume invalidates stale suspension timers. Page hide stops/suspends appropriately.

## Lab controls and persistence

Open **Pit Control → V8 / Engine Audio Lab**. There are 56 registered values: 55 ranges and Engine Mute. The 39 previous keys remain intact; 17 fields were added. Existing keys were relabelled where their requested role already existed, avoiding duplicate settings:

| Purpose | Existing saved key |
| --- | --- |
| Rev Sample Volume | `accelerationLayer` |
| Cruise Sample Volume | `cruiseLayer` |
| Engine Inertia | `rpmInertia` |
| RPM Rise/Fall Rate | `rpmRise` / `rpmFall` |
| Engine Load Influence | `loadEffect` |
| Overall Crossfade Smoothing | `crossfadeSpeed` |
| Pitch Variation | `pitchRange` |
| V8 Growl / High-RPM Aggression | `growl` / `exhaustTreble` |

New controls cover the other four sample levels, both transition crossfades, dual-cruise participation, release threshold/cooldown/fade, acceleration cooldown, airborne response/delay/contact hysteresis, jump blend, landing duration and engine compression. All update the existing graph or future trigger decisions live. Retained bass/rumble/voicing/spatial controls still process the recordings.

The canonical stores remain `jet-sprint-v8-settings` and `jet-sprint-v8-presets`, schema 1. Old settings and named presets gain defaults only for new fields. Individual resets, Reset to Defaults, save/load and JSON remain functional. Music/physics/camera/graphics stores are untouched; a same-origin deployment keeps them.

Diagnostics display RPM, RPM change, throttle, load, engine state, airborne gate, actual layer gains/rates, crossfade state, active sources, context and all six loading results. Every recording has an independent dry preview, up to four seconds, respecting master engine volume/mute. Dry previews intentionally bypass the character/blending controls so the source can be inspected.

Stationary mode has a simulated throttle and **Simulate jump / landing**. One press simulates 1.25 seconds airborne; a second press lands early. A separate audio model runs during testing, while the live boat and campaign clock remain frozen. On exit the previous live RPM/load model is restored. This does not teleport or launch the boat, apply forces, advance checkpoints or change rewards.

## Verification and limits

- `npm test`: **282 passing tests**. New coverage includes release hysteresis/cooldown, reapplication, flight/contact jitter, unloaded RPM, landing, dual-cruise levels, all 56 saved controls, isolated preview state, and all nine actual campaign ramps with unchanged boat state.
- Production build passes; its existing large-bundle advisory remains. The deployed manifest requires and hashes all six M4As and all six WAV representations, plus music and other assets.
- [Native Web Audio renders](render-proof.json): 24 seconds per case at default/max controls, forced WAV fallback and forced missing assets. All six roles were exercised, reapplication releases RevDown, and flight/landing transitions are connected. Output remains finite and below full scale with no empty one-second windows when assets are available; no engine oscillator is created. This is an objective render check, not a listening claim.
- [Compiled-game Chromium checks](game-proof.json): actual M4A requests/decoding/playback, all 56 bindings and persistence, resets, all six previews, simulated flight/landing without boat/clock changes, eight rapid restarts, two contexts total (engine/music), four remaining loop sources after cleanup, and music track changes without resetting the engine. [Inspected phone layout](lab-phone.png) uses 844×390 touch emulation and a controlled game render clock.
- Physical iPhone Safari, controller hardware, subjective listening and mobile frame rate were **not** tested. The short Jump recording and varying field textures particularly need headphone/device listening for repetitive or phase-related artifacts. No claim of exact source RPM calibration or perceptually seamless sound is made.

Manual procedure: tap Start, set music to 35%, then use the stationary test. Hold 0/25/60/100% throttle for 30 seconds each. Release fully, reapply quickly, then make small throttle changes and check that rev-down does not flutter. Trigger takeoff/early landing at 80% and again at 0%. Compare the six dry previews, adjust the two cruise levels/blend, test mute/reset/presets, reload and check saved values. Exit preview, race through an optional ramp, then pause/background/resume. On Safari inspect context state and load warnings. Listen for seam clicks, beating, dual-engine character and clipping; those judgments cannot be established by the cloud render checks.

## Changed files

Runtime: `src/audio.js`, new `src/engine-rpm.js`, `src/engine-samples.js`, `src/audio-settings.js`, `src/audio-panel.js`, `src/main.js`. Persistence keys and the physics implementation were not changed.

Assets/tools: four new WAV alternatives, `scripts/convert-engine-audio.sh`, new optional `scripts/analyze-engine-audio.py`; updated `scripts/build-proof.mjs` and `scripts/verify-deployment.mjs`.

Checks: new `test/engine-rpm.test.js`, updated `test/engine-samples.test.js`, `test/audio-settings.test.js`, `test/deployment-proof.test.js`.

Release/report: package files, `src/settings.js`, `index.html`, README and `docs/multi-v8/` evidence.
