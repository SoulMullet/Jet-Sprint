# Recorded V8 engine — v0.27.0

The running engine uses the two supplied recordings, without a synthesized engine fallback. Music, countdown/wildlife effects, boat simulation and game progression remain separate. The old `v8-dsp.js`/worklet remain archived reference code; they are no longer imported into the game engine.

## Source analysis and limitations

| Exact supplied path | Container duration | Decoded PCM duration | Codec / channels |
| --- | ---: | ---: | --- |
| `public/audio/Engine/EngineCruise.m4a` | 5.805 s | 5.757 s | AAC / 44.1 kHz stereo |
| `public/audio/Engine/EngineRev.m4a` | 4.458 s | 4.410 s | AAC / 44.1 kHz stereo |

FFprobe, decoded PCM level measurements and the [inspected waveform/spectrogram](recording-analysis.png) informed the region choices. Neither clip contains RPM telemetry. Strong peaks around 110–140 Hz and 310–390 Hz cannot safely be labelled a fundamental/firing frequency or converted to exact RPM. Cruise has several changing-pitch/level regions; Rev builds from its lower-energy opening to a louder sustained central section. Neither file clips at full scale (downmixed measured peaks approximately 0.556 / 0.856). The high-frequency noise bed and recording dynamics remain; there was no source separation. No listening/transcription test was available, so speech, music or other background contamination cannot be confidently excluded.

| Layer | Recording | Region (seconds) | Use |
| --- | --- | --- | --- |
| Idle | Rev | 0.16–0.76 | Lowest useful opening texture; **not a verified true-idle recording** |
| Low cruise | Cruise | 2.05–2.75 | Relatively stable low spectral region |
| Cruise | Cruise | 0.25–1.15 | Stable upper cruise texture |
| High | Rev | 1.35–3.05 | Sustained central growl |
| Acceleration | Rev | Starts 0.28 / 0.46 / 0.64; lengths 1.55 / 1.45 / 1.35 | Rotating short natural build-ups |

These short field clips limit idle realism and timbral range. Simulated RPM and relative texture anchors are uncalibrated. A longer clean stationary idle and several steady known-RPM recordings would improve future fidelity. No claim of exact source-RPM matching, subjectively click-free looping or physical-device realism is made.

## Architecture

`engine-samples.js` describes source paths and regions. `audio.js` loads/decode-caches each recording once after the existing gesture-driven engine start. Four persistent native BufferSources loop preprocessed regions, with DC removal, conservative level normalization and an 80 ms complementary raised-cosine seam splice. Equal-power adjacent gains cover every RPM range. Rate changes are smoothed and limited to 0.72–1.32×. Operating RPM sets the cruise blend anchor; Pitch Range limits relative pitch movement.

Throttle revs the engine before the hull accelerates. Smoothed throttle, separate rise/fall rates and RPM Inertia feed the estimated RPM. Existing speed, pump load, lateral speed and yaw rate are read without modifying the boat. Engine load subtly changes RPM, level and filtering. There are no gears. An armed throttle rise starts one short Rev section with separate attack/release and level envelopes. It cannot retrigger until throttle is released below 20%, the 2.2-second cooldown expires and the prior voice ends. Minor throttle fluctuations cannot repeatedly restart the rev.

The recording mix passes through bounded bass/mid/treble/resonance EQ, restrained saturation, a stereo width matrix, a small non-feedback reflection, compression and a safety ceiling. Legacy saved voicing controls now gently process the recordings rather than synthesizing combustion. Engine Volume / Mute Engine affect only the engine/preview; global Master/Mute still affect the existing engine-context effects. Music retains its own streaming elements, context, gain and store values. Music track changes cannot reset the engine.

Pause uses a short fade then suspends the engine context. Resume cancels stale pause timers. Restarts reuse the same four loop sources; transient/preview sources release and disconnect on end. Raw sample previews are bounded, replace one another, and freeze the race through the existing stationary test mode. No AudioWorklet, ScriptProcessor, oscillator or generated noise runs as the engine source.

Both exact original M4As ship. If M4A fetch/decode fails, the loader tries the matching WAV made from that same recording, explicitly reporting the compatibility path. To regenerate the committed 32 kHz stereo PCM copies:

```sh
bash scripts/convert-engine-audio.sh  # requires ffmpeg; not needed for npm ci/build
```

If both formats fail, diagnostics name the failed source; there is no synthetic fallback. If one recording is available, remaining loops provide a degraded mix. Relative Vite base paths work under `/Jet-Sprint/`. Production verification requires and SHA-256 checks both original M4As, both derived WAVs and both existing music MP3s.

## Engine Audio Lab and persistence

Open **Pit Control → V8 / Engine Audio Lab**. It includes Master Engine Volume, Idle/Operating/Maximum RPM, Idle Rumble, Bass Depth, Engine Growl, High-RPM Bite, Pitch Range, Throttle Response, RPM Inertia, Acceleration Layer, Cruise Layer, Crossfade Speed, Engine Load Effect and Stereo Width, plus retained voicing controls. Mute Engine is a toggle. Reset to Defaults, individual slider resets, named presets, JSON export/import and the existing stationary throttle test remain available.

**Engine Audio Diagnostics** shows simulated RPM, throttle, load, layers/weights/rates, crossfade, acceleration voice, context and each source load result. **Sample Playback Test** auditions either original recording for up to four seconds. Stop preview or end stationary testing to resume normal engine mixing. A tap on Enable / resume audio recovers an autoplay-blocked/suspended context.

All 39 registered values (38 ranges and one toggle) use the existing `jet-sprint-v8-settings` / `jet-sprint-v8-presets` schema-1 storage. Existing fields/keys, user presets, other labs and music settings are retained; old exports gain defaults only for newly introduced fields. Engine mute uses a validated 0/1 value in that numeric schema.

## Verification

- `npm test`: 275 tests pass. Coverage includes range coverage, seam continuity/DC/peak checks, analog throttle/RPM inertia, turning load with immutable physics inputs, legacy-save compatibility and all retained game tests.
- Production build passes (existing large-bundle advisory remains).
- [Native Web Audio render results](render-proof.json): real decoded M4As at default and maximum controls, forced same-recording WAV fallback, and forced missing-file failure. Twelve seconds per render include idle, acceleration, sustain and release; all samples are finite, no full-scale clipping, and no one-second gaps. No engine oscillator is created. This is an objective render check, not a listening judgment.
- [Compiled-game browser results](game-proof.json) and [phone-layout screenshot](lab-phone.png) document integration checks.
- No physical iPhone Safari/Xbox testing, subjective listening, or device frame-rate claim. Native browser looping removes timer dependence, but source texture and loop naturalness still need target-device listening.

Manual listening procedure: start a river from a tap, open V8, run stationary test at 0%, 25%, 60%, 100%, then release. Hold each for at least 30 seconds. Try small throttle movements versus a full release/reapply, audition both originals, test engine mute/volume alongside music, pause/resume/restart repeatedly, then race through a tight bend. On Safari, repeat after backgrounding and rotating, checking diagnostics for a running context and four loops. Adjust volume conservatively on headphones.

## Changed files

`src/audio.js`, `src/engine-samples.js`, `src/audio-settings.js`, `src/audio-panel.js`, `src/interface.js`, `src/main.js`; two derived WAVs and `scripts/convert-engine-audio.sh`; `test/engine-samples.test.js`, updated audio/settings/deployment tests; build/deployment proof scripts; release identifiers in package files, `src/settings.js`, `index.html`; README and this evidence directory. The original M4As were uploaded before this change and remain unmodified.
