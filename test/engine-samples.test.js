import test from "node:test";
import assert from "node:assert/strict";
import {
  seamlessLoop,
  layerMix,
  engineRecordings,
  engineRegions,
  enginePlaybackRate,
} from "../src/engine-samples.js";
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
  });
  for (const r of engineRegions) {
    assert.ok(Number.isFinite(r.referenceRPM) && r.referenceRPM >= 900);
    assert.ok(r.start > 0 && r.end > r.start + 0.2);
    assert.ok(r.end < (r.recording === "rev" ? 4.4103 : 5.7571));
  }
});
test("equal-power sample blends cover every RPM with unit power and no range gap", () => {
  for (let x = 0; x <= 1; x += 0.001) {
    const w = layerMix(x);
    assert.ok(Math.abs(w.reduce((s, v) => s + v * v, 0) - 1) < 1e-10);
    assert.ok(w.filter((v) => v > 0.0001).length <= 2);
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
