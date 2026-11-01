import test from "node:test";
import assert from "node:assert/strict";
import { RaceMusic, musicURLs, musicFiles } from "../src/race-music.js";
import { SettingsStore } from "../src/settings.js";
function fixture(random = () => 0) {
  const media = [],
    timers = [],
    ramps = [];
  const music = new RaceMusic({
    random,
    later: (fn) => timers.push(fn),
    createAudio: () => {
      const a = {
        paused: true,
        currentTime: 0,
        duration: 100,
        events: {},
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        addEventListener(k, fn) {
          this.events[k] = fn;
        },
      };
      media.push(a);
      return a;
    },
    createContext: () => ({
      currentTime: 0,
      resume: () => Promise.resolve(),
      destination: {},
      createMediaElementSource: () => ({ connect() {} }),
      createGain: () => ({
        connect() {},
        gain: {
          value: 0,
          cancelScheduledValues() {},
          setValueAtTime() {},
          linearRampToValueAtTime(value, time) {
            ramps.push({ value, time });
          },
        },
      }),
    }),
  });
  return { music, media, timers, ramps };
}
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
test("exact uploaded names and project-base URLs preserve capitalization and spaces", () => {
  assert.deepEqual(musicFiles, [
    "Funky Glitch Groove.mp3",
    "Turbo Racer X.mp3",
  ]);
  assert.deepEqual(musicURLs("/Jet-Sprint/"), [
    "/Jet-Sprint/audio/music/Funky%20Glitch%20Groove.mp3",
    "/Jet-Sprint/audio/music/Turbo%20Racer%20X.mp3",
  ]);
});
test("equal random split and natural ended alternation use exactly two reusable elements", async () => {
  for (const [random, index] of [
    [0.499, 0],
    [0.5, 1],
  ]) {
    const f = fixture(() => random);
    f.music.unlock();
    f.music.startRace();
    await settle();
    assert.equal(f.music.current, index);
    f.media[index].events.ended();
    await settle();
    assert.equal(f.music.current, 1 - index);
    f.media[1 - index].events.ended();
    await settle();
    assert.equal(f.music.current, index);
    for (let i = 0; i < 20; i++) f.music.unlock();
    assert.equal(f.media.length, 2);
    assert.ok(f.ramps.some((r) => r.value === 0.35 && r.time === 1.5));
  }
});
test("rapid restarts and stop/resume invalidate stale delayed fades", async () => {
  const f = fixture();
  f.music.unlock();
  f.music.startRace();
  await settle();
  f.music.startRace();
  f.music.startRace();
  f.music.stopRace();
  for (const fn of f.timers.splice(0)) fn();
  await settle();
  assert.ok(f.media.every((a) => a.paused));
  f.music.startRace();
  await settle();
  f.music.setSuspended(true);
  f.music.setSuspended(false);
  for (const fn of f.timers.splice(0)) fn();
  await settle();
  assert.equal(f.media[f.music.current].paused, false);
  assert.equal(f.media.length, 2);
});
test("a failed file falls back and repeats the working track; both failing leave gameplay alone", async () => {
  const f = fixture();
  f.music.unlock();
  f.music.startRace();
  await settle();
  f.media[0].events.error();
  await settle();
  assert.equal(f.music.current, 1);
  f.media[1].events.ended();
  await settle();
  assert.equal(f.music.current, 1);
  f.media[1].events.error();
  assert.equal(f.music.active, false);
  assert.match(f.music.status, /unavailable/);
});
test("fade-out near track end, mute and volume are independent of the engine", async () => {
  const f = fixture();
  f.music.unlock();
  f.music.startRace();
  await settle();
  f.music.setPreferences(80, false);
  assert.equal(f.ramps.at(-1).value, 0.8);
  f.media[0].currentTime = 99;
  f.media[0].events.timeupdate();
  assert.deepEqual(f.ramps.at(-1), { value: 0, time: 1 });
  f.music.setPreferences(80, true);
  assert.equal(f.ramps.at(-1).value, 0);
  f.music.stopRace(true);
  assert.ok(f.media.every((a) => a.paused));
});
test("autoplay refusal stays retryable and music preferences survive the existing settings store", async () => {
  const f = fixture();
  f.music.unlock();
  await settle();
  f.media[0].play = () =>
    Promise.reject(
      Object.assign(Error("gesture"), { name: "NotAllowedError" }),
    );
  f.music.startRace();
  await settle();
  assert.match(f.music.status, /Tap/);
  assert.equal(f.music.failed.size, 0);
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    s = new SettingsStore(storage);
  assert.equal(s.values.musicVolume, 35);
  s.set("musicVolume", 62);
  s.set("musicMute", true);
  s.flush();
  const next = new SettingsStore(storage);
  assert.equal(next.values.musicVolume, 62);
  assert.equal(next.values.musicMute, true);
});
