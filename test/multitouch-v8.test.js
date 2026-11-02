import test from "node:test";
import assert from "node:assert/strict";
import { ArcadePointers } from "../src/arcade-pointers.js";
import { NitrousGesture } from "../src/nitrous-gesture.js";
import { EngineRPMModel, engineBedMix } from "../src/engine-rpm.js";
import {
  AudioSettings,
  AUDIO_KEY,
  defaultAudio,
} from "../src/audio-settings.js";
const s = defaultAudio();
function advance(m, seconds, throttle = 1, contact = {}, tuning = s) {
  for (let n = 0; n < Math.round(seconds * 120); n++)
    m.update(
      tuning,
      18,
      throttle,
      1 / 120,
      42,
      false,
      0.7,
      { planing: 0.8 },
      contact,
    );
}
test("throttle capture survives repeated independent steering presses, movement and nitrous with unrelated cancellation ignored", () => {
  const p = new ArcadePointers(),
    g = new NitrousGesture(),
    rect = { top: 200, bottom: 322 },
    kit = { installed: true, fill: 100 };
  assert.equal(p.press("throttle", 10), true);
  for (let i = 0; i < 20; i++) {
    g.move(212, rect, kit);
    const side = i % 2 ? "left" : "right",
      id = 20 + i;
    assert.equal(p.press(side, id), true);
    assert.equal(g.throttle, 1);
    assert.equal(p.owns("throttle", 10), true);
    g.move(180, rect, kit);
    assert.equal(g.nitrous, true);
    assert.equal(p.held[side].size, 1);
    assert.equal(p.release("throttle", id), false);
    assert.equal(p.release(side, id), true);
    assert.equal(g.throttle, 1);
    g.move(208, rect, kit);
    assert.equal(g.nitrous, false);
    assert.equal(g.throttle, 1);
  }
  assert.equal(p.press("throttle", 99), false);
  assert.equal(p.press("left", 10), false);
  assert.equal(p.press("left", 100), true);
  assert.equal(p.release("throttle", 10), true);
  g.clear();
  assert.equal(g.throttle, 0);
  assert.equal(p.held.left.size, 1);
  p.clear();
  assert.equal(p.owners.size, 0);
  assert.ok(Object.values(p.held).every((v) => v.size === 0));
});
test("three cruise weights change continuously with RPM/load and bounded slow variation, with separate level controls", () => {
  const m = new EngineRPMModel(s),
    out = [];
  advance(m, 5, 0.65);
  const w = engineBedMix(m, s, out);
  assert.equal(w, out);
  for (const i of [1, 2, 4]) assert.ok(w[i] > 0.03);
  assert.equal(engineBedMix(m, { ...s, cruiseLayerTwoVolume: 0 })[4], 0);
  const old = m.cruiseTwoShare;
  advance(m, 4, 1);
  assert.ok(m.cruiseTwoShare > old);
  let last = engineBedMix(m, s).slice();
  for (let i = 0; i < 1200; i++) {
    advance(m, 1 / 120, 0.72);
    const next = engineBedMix(m, s);
    assert.ok(
      next.every((v, j) => Number.isFinite(v) && Math.abs(v - last[j]) < 0.06),
    );
    last = next;
  }
});
test("high-RPM entry has hysteresis and smoothly yields back to cruise without threshold chatter", () => {
  const m = new EngineRPMModel(s);
  advance(m, 5, 0.6);
  assert.equal(m.highRPMActive, false);
  assert.ok(engineBedMix(m, s)[5] < 0.001);
  advance(m, 6, 1);
  assert.equal(m.highRPMActive, true);
  assert.ok(engineBedMix(m, s)[5] > 0.35);
  assert.equal(engineBedMix(m, { ...s, highRPMLayerVolume: 0 })[5], 0);
  for (let i = 0; i < 20; i++) {
    m.rpm = s.maxRPM * (s.highRPMThreshold / 100 - 0.01);
    m.update(s, 18, 1, 0, 42, false, 0.7, null, {});
    assert.equal(m.highRPMActive, true);
  }
  advance(m, 7, 0);
  assert.equal(m.highRPMActive, false);
  assert.ok(m.highRPMBlend < 0.001);
});
test("rev-out requires debounced true contact loss; bank/spray and wave-contact chatter cannot trigger it", () => {
  const m = new EngineRPMModel(s);
  advance(m, 4, 0.8);
  for (let i = 0; i < 30; i++) {
    advance(m, 0.025, 0.8, { airborne: true });
    advance(m, 0.025, 0.8, { airborne: false });
  }
  assert.equal(m.airborne, false);
  assert.equal(engineBedMix(m, s)[6], 0);
  advance(m, 1, 0.8, { airborne: true });
  assert.equal(m.airborne, true);
  assert.ok(engineBedMix(m, s)[6] > 0.4);
  assert.equal(engineBedMix(m, { ...s, revOutVolume: 0 })[6], 0);
  advance(m, 0.02, 0.8, { airborne: false, landed: true });
  assert.equal(m.airborne, false);
  assert.ok(m.flightBlend > 0); // The persistent loop fades; no truncated one-shot.
  advance(m, 2, 0.8, {});
  assert.ok(engineBedMix(m, s)[6] < 0.001);
  const sensitive = new EngineRPMModel(s),
    conservative = new EngineRPMModel(s);
  advance(
    sensitive,
    0.05,
    1,
    { airborne: true },
    { ...s, revOutSensitivity: 100 },
  );
  advance(
    conservative,
    0.05,
    1,
    { airborne: true },
    { ...s, revOutSensitivity: 0 },
  );
  assert.equal(sensitive.airborne, true);
  assert.equal(conservative.airborne, false);
});
test("missing new layers redistribute cruise/redline/flight energy into original recordings", () => {
  const m = new EngineRPMModel(s),
    old = { idle: true, cruise: true, cruiseOne: true, jump: true };
  advance(m, 5, 1);
  let w = engineBedMix(m, s, [], old);
  assert.ok(w[1] > 0.3 && w[2] > 0.1);
  assert.equal(w[4] + w[5], 0);
  advance(m, 1, 1, { airborne: true });
  w = engineBedMix(m, s, [], old);
  assert.ok(w[3] > 0.3);
  assert.equal(w[6], 0);
});
test("nine new Audio Lab settings preserve old values and round-trip through the existing key/preset mechanism", () => {
  const map = new Map([
      [
        AUDIO_KEY,
        JSON.stringify({
          type: "jet-sprint-v8",
          schemaVersion: 1,
          preset: "custom",
          settings: { engineVolume: 42, cruiseLayerOneVolume: 63 },
        }),
      ],
    ]),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    a = new AudioSettings(storage);
  assert.equal(a.values.engineVolume, 42);
  assert.equal(a.values.cruiseLayerOneVolume, 63);
  const edits = {
    cruiseLayerTwoVolume: 41,
    cruiseCrossfadeSpeed: 60,
    cruiseVariationIntensity: 15,
    rpmPitchResponse: 80,
    highRPMLayerVolume: 82,
    highRPMThreshold: 88,
    revOutVolume: 67,
    revOutSensitivity: 70,
    airborneTransitionSpeed: 60,
  };
  for (const [k, v] of Object.entries(edits)) a.set(k, v);
  a.flush();
  a.save("New V8 layers");
  a.reset();
  a.load("New V8 layers");
  a.flush();
  const b = new AudioSettings(storage);
  for (const [k, v] of Object.entries(edits)) assert.equal(b.values[k], v);
  assert.equal(b.values.engineVolume, 42);
  assert.equal(b.values.cruiseLayerOneVolume, 63);
});
