import test from "node:test";
import assert from "node:assert/strict";
import {
  seamlessLoop,
  engineRecordings,
  engineRegions,
  enginePlaybackRate,
} from "../src/engine-samples.js";
import { EngineRPMModel, engineBedMix } from "../src/engine-rpm.js";
import { Engine } from "../src/audio.js";
import {
  AudioSettings,
  AUDIO_KEY,
  defaultAudio,
} from "../src/audio-settings.js";
function buffer(channels, length, rate) {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    length,
    sampleRate: rate,
    numberOfChannels: channels,
    duration: length / rate,
    getChannelData: (c) => data[c],
  };
}
test("recording paths retain exact case and all loop regions fit the real decoded files", () => {
  assert.deepEqual(engineRecordings, {
    cruise: "audio/Engine/EngineCruise.m4a",
    rev: "audio/Engine/EngineRev.m4a",
    idle: "audio/Engine/EngineIdle.m4a",
    revDown: "audio/Engine/EngineRevDown.m4a",
    cruiseOne: "audio/Engine/EngineCruiseLayerOne.m4a",
    jump: "audio/Engine/EngineJump.m4a",
    cruiseTwo: "audio/Engine/EngineCruiseLayerTwo.m4a",
    highRev: "audio/Engine/EngineHighRev.m4a",
    revOut: "audio/Engine/EngineRevOut.m4a",
  });
  for (const r of engineRegions) {
    assert.ok(Number.isFinite(r.referenceRPM) && r.referenceRPM >= 900);
    assert.ok(r.start > 0 && r.end > r.start + 0.2);
    assert.ok(
      r.end <
        {
          idle: 7.916,
          cruise: 5.7571,
          cruiseOne: 3.296,
          jump: 0.881,
          cruiseTwo: 5.8267,
          highRev: 2.158,
          revOut: 1.647,
        }[r.recording],
    );
  }
});
test("normalized beds remain continuous through RPM/flight ranges, and individual mutes are respected", () => {
  const s = {
    ...defaultAudio(),
    idleSampleVolume: 100,
    rumble: 50,
    cruiseLayer: 100,
    cruiseLayerOneVolume: 100,
    jumpSampleVolume: 100,
    jumpBlend: 100,
  };
  for (let p = 0; p <= 1; p += 0.01)
    for (const flightBlend of [0, 0.5, 1])
      for (const throttle of [0, 1]) {
        const m = {
          rpm: s.idleRPM + p * (s.maxRPM - s.idleRPM),
          flightBlend,
          throttle,
          cruiseShare: 0.4,
        };
        const w = engineBedMix(m, s);
        const power = w.reduce((a, b) => a + b * b, 0);
        assert.ok(power > 0.12 && power <= 1.001);
        assert.deepEqual(
          engineBedMix(m, {
            ...s,
            idleSampleVolume: 0,
            cruiseLayer: 0,
            cruiseLayerOneVolume: 0,
            jumpSampleVolume: 0,
            cruiseLayerTwoVolume: 0,
            highRPMLayerVolume: 0,
            revOutVolume: 0,
          }),
          [0, 0, 0, 0, 0, 0, 0],
        );
      }
});
test("loop splice is continuous at the wrap, removes DC, and bounds normalized peaks", () => {
  const input = buffer(2, 32000, 32000);
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < input.length; i++)
      input.getChannelData(c)[i] = 0.2 + 0.2 * Math.sin(i * 0.025 + c * 0.1);
  const out = seamlessLoop({ createBuffer: buffer }, input, 0.1, 0.9);
  for (let c = 0; c < 2; c++) {
    const d = out.getChannelData(c);
    assert.ok(Math.abs(d.at(-1) - d[0]) < 0.01);
    assert.ok(Math.max(...d.map(Math.abs)) <= 0.75);
    assert.ok(Math.abs(d.reduce((s, v) => s + v, 0) / d.length) < 0.005);
  }
  assert.throws(() => seamlessLoop({ createBuffer: buffer }, input, 0, 2));
});
test("RPM is throttle-driven with inertia, independent of speed; turning increases load without mutating physics", () => {
  const e = new Engine(),
    boat = { yawRate: 2, lateralSpeed: 8 },
    before = JSON.stringify(boat);
  for (let i = 0; i < 120; i++) e.update(0, 1, 1 / 60, 24, false, 0.6, boat);
  assert.ok(e.rpm > 4500);
  const rpm = e.rpm,
    load = e.load;
  e.update(12, 1, 1 / 60, 24, false, 0.6, { yawRate: 0, lateralSpeed: 0 });
  assert.ok(e.load < load);
  assert.equal(JSON.stringify(boat), before);
  e.update(0, 0, 1 / 60);
  assert.ok(e.rpm > rpm * 0.9);
  for (let i = 0; i < 600; i++) e.update(0, 0, 1 / 60);
  assert.ok(Math.abs(e.rpm - e.settings.idleRPM) < 2);
  const a = new Engine(),
    b = new Engine();
  a.setSettings({ ...a.settings, rpmInertia: 100 });
  b.setSettings({ ...b.settings, rpmInertia: 0 });
  for (let i = 0; i < 30; i++) {
    a.update(0, 1, 1 / 60);
    b.update(0, 1, 1 / 60);
  }
  assert.ok(b.rpm > a.rpm + 1000);
});
test("old schema-1 audio saves and presets retain their values and gain the new controls", () => {
  const map = new Map([
      [
        AUDIO_KEY,
        JSON.stringify({
          type: "jet-sprint-v8",
          schemaVersion: 1,
          preset: "custom",
          settings: { engineVolume: 42, camLope: 81, idleRPM: 830 },
        }),
      ],
    ]),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const store = new AudioSettings(storage);
  assert.equal(store.values.engineVolume, 42);
  assert.equal(store.values.camLope, 81);
  assert.equal(store.values.pitchRange, 35);
  for (const k of [
    "operatingRPM",
    "rpmInertia",
    "pitchRange",
    "accelerationLayer",
    "cruiseLayer",
    "crossfadeSpeed",
    "engineMute",
  ])
    store.set(k, k === "engineMute" ? 1 : defaultAudio()[k] + 1);
  store.flush();
  const next = new AudioSettings(storage);
  assert.deepEqual(next.values, store.values);
  assert.equal(next.values.engineMute, 1);
});

test("idle and redline tuning change absolute sample pitch while rate limits prevent cartoon shifts", () => {
  assert.equal(enginePlaybackRate(900, 900, 35), 1);
  assert.ok(enginePlaybackRate(600, 900, 35) < 1);
  assert.ok(enginePlaybackRate(1300, 900, 35) > 1);
  assert.ok(enginePlaybackRate(4500, 6800, 35) < 1);
  assert.ok(enginePlaybackRate(9000, 6800, 35) > 1);
  assert.equal(enginePlaybackRate(9000, 6800, 0), 1);
  for (const rpm of [600, 900, 4500, 9000])
    for (const ref of [900, 2800, 4200, 6800]) {
      const v = enginePlaybackRate(rpm, ref, 75);
      assert.ok(v >= 0.72 && v <= 1.32);
    }
});
