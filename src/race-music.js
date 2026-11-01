export const musicFiles = ["Funky Glitch Groove.mp3", "Turbo Racer X.mp3"];
export const musicURLs = (base = "./") =>
  musicFiles.map((file) => base + "audio/music/" + encodeURIComponent(file));
const FADE = 1.5;
// Streaming elements and a separate Web Audio mix; never decode whole MP3s in memory.
export class RaceMusic {
  constructor({
    urls = musicURLs(),
    createAudio = () => new Audio(),
    createContext = () =>
      new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
    random = Math.random,
    later = (callback, delay) => setTimeout(callback, delay),
  } = {}) {
    Object.assign(this, { urls, createAudio, createContext, random, later });
    this.elements = [];
    this.unlocked = [false, false];
    this.gains = [];
    this.failed = new Set();
    this.epoch = 0;
    this.active = false;
    this.suspended = false;
    this.current = -1;
    this.volume = 0.35;
    this.muted = false;
    this.status = "Music starts after a tap or key press.";
  }
  init() {
    if (this.context) return;
    try {
      this.context = this.createContext();
      for (let i = 0; i < 2; i++) {
        const audio = this.createAudio();
        audio.preload = "metadata";
        audio.src = this.urls[i];
        audio.loop = false;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        this.context.createMediaElementSource(audio).connect(gain);
        gain.connect(this.context.destination);
        audio.addEventListener("ended", () => {
          if (
            this.active &&
            !this.suspended &&
            !this.pendingRestart &&
            this.current === i
          )
            this.change(1 - i);
        });
        audio.addEventListener("timeupdate", () => {
          const remaining = audio.duration - audio.currentTime;
          if (
            this.active &&
            !this.suspended &&
            this.current === i &&
            remaining > 0 &&
            remaining <= FADE
          )
            this.ramp(i, 0, remaining);
        });
        audio.addEventListener("error", () => this.fileFailed(i));
        this.elements.push(audio);
        this.gains.push(gain);
      }
    } catch {
      this.status = "Music unavailable; engine and gameplay are unaffected.";
    }
  }
  ramp(i, value, seconds = FADE) {
    const gain = this.gains[i]?.gain;
    if (!gain) return;
    const now = this.context.currentTime;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
    }
    gain.linearRampToValueAtTime(value, now + seconds);
  }
  get level() {
    return this.muted ? 0 : this.volume;
  }
  unlock() {
    this.init();
    if (!this.context || this.elements.length !== 2) return;
    try {
      const resume = this.context.resume();
      resume?.catch(() => {
        this.status = "Tap Enable / resume music to allow playback.";
      });
    } catch {}
    // Both elements receive a play request within this gesture, silently if idle.
    // Reuse them for subsequent Safari playlist transitions.
    for (let i = 0; i < 2; i++) {
      if (this.failed.has(i)) continue;
      if (
        !this.unlocked[i] ||
        (this.active &&
          !this.suspended &&
          this.current === i &&
          this.elements[i].paused)
      )
        this.play(i);
    }
  }
  play(i) {
    const audio = this.elements[i];
    if (!audio) return;
    let request;
    try {
      request = audio.play();
    } catch (e) {
      this.playFailure(i, e);
      return;
    }
    Promise.resolve(request)
      .then(() => {
        this.unlocked[i] = true;
        if (!this.active || this.suspended || this.current !== i) {
          audio.pause();
          return;
        }
        if (!this.pendingRestart) {
          this.ramp(i, this.level);
          this.status = "Playing " + musicFiles[i];
        }
      })
      .catch((e) => this.playFailure(i, e));
  }
  playFailure(i, error) {
    if (error?.name === "AbortError") return;
    if (error?.name === "NotAllowedError") {
      this.status = "Tap Enable / resume music to allow playback.";
      return;
    }
    this.fileFailed(i);
  }
  fileFailed(i) {
    if (this.failed.has(i)) return;
    this.failed.add(i);
    this.ramp(i, 0, 0.05);
    this.elements[i]?.pause();
    if (this.active && i === this.current) {
      if (this.failed.size < 2) this.change(1 - i);
      else {
        this.stopRace();
        this.status =
          "Music files unavailable; racing and engine audio continue.";
      }
    }
  }
  startRace() {
    this.active = true;
    this.suspended = false;
    this.failed.clear();
    this.change(this.random() < 0.5 ? 0 : 1, true);
  }
  change(index, restart = false) {
    if (this.failed.has(index)) index = 1 - index;
    if (this.failed.has(index)) {
      this.stopRace();
      return;
    }
    const epoch = ++this.epoch,
      previous = this.current;
    this.current = index;
    this.pendingRestart = false;
    if (!this.context || this.elements.length !== 2) {
      this.status = "Tap Enable / resume music to allow playback.";
      return;
    }
    for (let i = 0; i < 2; i++)
      if (i !== index) {
        this.ramp(i, 0);
        this.later(() => {
          if (this.epoch === epoch && this.current !== i)
            this.elements[i].pause();
        }, FADE * 1000);
      }
    const begin = () => {
      if (epoch !== this.epoch || !this.active || this.suspended) return;
      this.pendingRestart = false;
      const audio = this.elements[index];
      try {
        audio.currentTime = 0;
      } catch {}
      this.ramp(index, 0, 0);
      this.play(index);
    };
    if (restart && previous === index && !this.elements[index].paused) {
      this.pendingRestart = true;
      this.ramp(index, 0);
      this.later(begin, FADE * 1000);
    } else begin();
  }
  setPreferences(volume, mute, master = 100, allMuted = false) {
    this.volume =
      ((Math.max(0, Math.min(100, volume)) / 100) *
        Math.max(0, Math.min(100, master))) /
      100;
    this.muted = !!mute || !!allMuted;
    if (this.active && !this.suspended && this.current >= 0)
      this.ramp(this.current, this.level);
  }
  setSuspended(on) {
    on = !!on;
    if (on === this.suspended) return;
    this.suspended = on;
    if (!this.active) return;
    const epoch = ++this.epoch;
    if (on) {
      for (let i = 0; i < 2; i++) {
        this.ramp(i, 0);
        this.later(() => {
          if (this.epoch === epoch) this.elements[i]?.pause();
        }, FADE * 1000);
      }
    } else if (this.active && this.current >= 0) {
      if (this.pendingRestart) {
        this.elements[this.current].currentTime = 0;
        this.pendingRestart = false;
      }
      this.play(this.current);
    }
  }
  stopRace(immediate = false) {
    this.active = false;
    const epoch = ++this.epoch;
    for (let i = 0; i < 2; i++) {
      this.ramp(i, 0, immediate ? 0 : FADE);
      const stop = () => {
        if (this.epoch === epoch) this.elements[i]?.pause();
      };
      if (immediate) stop();
      else this.later(stop, FADE * 1000);
    }
    this.status = "Race music stopped.";
  }
  inspect() {
    return {
      active: this.active,
      suspended: this.suspended,
      current: this.current >= 0 ? musicFiles[this.current] : null,
      instances: this.elements.length,
      gains: this.gains.map((g) => g.gain.value),
      failed: [...this.failed],
      status: this.status,
      context: this.context?.state || "locked",
    };
  }
}
