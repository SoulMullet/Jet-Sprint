# JET SPRINT: track and V8 upgrade

The game now has the Shelter Islands course and a separate, live V8 Sound Lab. Open **V8 SOUND LAB** from the title screen or during a race. Choose **Start stationary engine test** to freeze the boat, countdown and race clock, then use **Test throttle**. End the test to resume the race from the same position and velocity.

## Course

The accessible New Zealand reference was the [official Shelter View site map](https://www.v8jetsprints.co.nz/shelter-view-site-map), supported by the [operator's explanation of jetsprint rotations](https://www.v8jetsprints.co.nz/what-is-jetsprinting). Searches did not produce a verifiable jetsprint layout at Shelley Beach. Shelter Islands is an original approximate interpretation of a compact island-and-channel venue, adapted to the existing game's scale and driving behavior. No reference image, map artwork, logos or branding are bundled.

- `src/track-layout.js` holds editable outer spline points, perimeter junction fractions, the central junction and four interior branch splines. Reload after editing.
- Centripetal Catmull–Rom splines create an asymmetric perimeter and intersecting interior waterways. The ordered rotation is `S → A → J → B → C → J → D → B → C → S`.
- Shared channel geometry drives the water surface, land cutouts, banks, collision projection and fluid mask. Three bank strips rise smoothly from the water to the clipped terrain, eliminating terrain-grid shoreline squares. Sub-millimetre snapping stabilizes polygon unions across JavaScript engines, and cached unions reduce startup work.
- Water is 18 m wide; the existing 13 m driving corridor remains. A 2.5 m water margin contains the full hull at any drift angle. The bank contact integrator, throttle-dependent jet steering, handling settings, camera formulas, ordered gates, navigator and five-lap timing remain in use.
- New course/route identifiers keep the new course's scores separate from previous records. Existing stored records remain available in storage.

## Audio

`src/v8-dsp.js` generates eight combustion events per 720 crankshaft degrees, using a cross-plane firing order and two exhaust banks. Cylinder amplitudes and small timing offsets vary with camshaft lope and cycle variation. Each firing excites a shaped, decaying resonant pulse; harmonic components and noise add exhaust texture. The fixed Web Audio graph adds exhaust EQ, growl, filtered intake/mechanical/water layers, vibration, reflections, saturation, compression and a bounded output ceiling.

An AudioWorklet runs the combustion DSP away from rendering. A persistent ScriptProcessor callback supports older browsers. Continuous slider changes reuse nodes and smooth DSP controls and AudioParams. RPM rise, fall, throttle response and load follow the game or the stationary throttle. No engine sawtooth oscillator is used.

All 32 requested controls show their values and update live. Built-in presets are **Big Cam V8 Idle**, **Naturally Aspirated Race V8**, **Marine Jet Sprint V8** (default), **Open Headers V8**, and **Custom**. Moving a slider selects Custom. **Reset sound to Marine V8** restores audio defaults.

## Deep idle tuning

Start with **Marine Jet Sprint V8**, leave Test throttle at 0%, and adjust:

| Control | Suggested starting point | Audible effect |
| --- | --- | --- |
| Idle RPM | 800–950 RPM | Slower firing cadence and more space between pulses |
| Camshaft lope intensity | 70–95% | Strongest control over the rolling, uneven idle |
| Idle instability | 20–40% | Slow RPM wobble around idle |
| Pulse irregularity | 20–40% | Small timing and amplitude variations |
| Exhaust bass / low-frequency emphasis | 70–90% / 50–75% | More low exhaust energy |
| Pulse duration | 40–60 ms | Fuller, longer glugs |
| Exhaust resonance | 55–80% | More pronounced exhaust body |
| Low-frequency rumble / exhaust growl | 55–80% | Low texture beneath the firing pulses |
| Rasp / treble / distortion | Keep moderate | Higher values add edge and can obscure the deep idle |

Phone speakers cannot reproduce the lowest bass. Assess the idle on headphones or full-range speakers as well as the intended phone. The subjective match to a recorded racing V8 still benefits from listening and tuning on the target device.

## Saving and portability

Audio automatically saves to `jet-sprint-v8-settings`. Named audio presets use `jet-sprint-v8-presets`. Physics settings and their existing import/export schema keep their own keys. The Sound Lab's **Save Preset**, **Load Preset**, **Export Settings as JSON**, paste/import box and JSON file picker operate on audio only. Exports carry `type: "jet-sprint-v8"` and `schemaVersion: 1`; imports validate before changing active values, reject incompatible schemas and clamp numerical ranges. Storage errors leave live settings usable and display an export reminder. Same-name audio saves replace that named entry.

## Recorded sample extension

Once audio has started, attach an owned or licensed, normalized seamless loop through the engine API:

```js
await engine.start();
engine.setSampleLayer(audioBuffer, {
  referenceRPM: 900,
  blend: 0.35,
  loopStart: 0,
  loopEnd: audioBuffer.duration
});
engine.setSampleBlend(0.7); // 0 = synthesis, 1 = recorded exhaust
```

The sample follows RPM using a smoothed playback rate, shares exhaust processing and output protection, and crossfades when replaced. Use carefully edited seamless loops. A single loop is an integration point; a future recorded engine can use several licensed RPM/load layers with crossfades for higher fidelity across the rev range.

## Verification

Run `npm test` and `npm run build`. The regression suite covers powered jet steering, bank contact, race starts/timing, ordered navigation, rounded racing lines, wrong-route recovery, five laps with the unchanged boat integrator, channel geometry, clipped terrain, audio persistence/import validation, configurable RPM dynamics, V8 firing cadence and bounded DSP output at extreme settings.

Chromium checks verified all 32 sliders, live updates without node growth, both AudioWorklet and compatibility playback, sample replacement/blending, named presets, JSON export/import, storage separation, stationary race-clock pause/resume, and a 390 px phone layout. Offline native Web Audio rendering with maximum controls remained finite and below full scale. The production build was also checked in Chromium. Physical iPhone Safari playback and subjective engine realism require target-device listening; the compatibility path was exercised in Chromium.
