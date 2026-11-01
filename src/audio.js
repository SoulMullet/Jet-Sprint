import { defaultAudio, validateAudio } from "./audio-settings.js";
import {
  engineRecordings,
  engineRegions,
  seamlessLoop,
  loadRecording,
  layerMix,
  clamp,
  enginePlaybackRate,
} from "./engine-samples.js";
const blend = (v, target, rate, dt) =>
  v + (target - v) * (1 - Math.exp(-rate * dt));
const set = (param, value, time, tau = 0.045) =>
  param.setTargetAtTime(value, time, tau);
export class Engine {
  constructor({
    settings = defaultAudio(),
    baseURL = "./",
    fetcher = globalThis.fetch,
    createContext,
  } = {}) {
    this.settings = validateAudio(settings);
    this.baseURL = baseURL;
    this.fetcher = fetcher;
    this.createContext = createContext;
    this.muted = false;
    this.volume = 1;
    this.layers = [];
    this.recordings = {};
    this.sampleStatus = { cruise: "Not loaded", rev: "Not loaded" };
    this.backend = "Recorded V8 / Web Audio";
    this.lifecycle = 0;
    this.sourcesCreated = 0;
    this.accelerationCount = 0;
    this.reset();
  }
  reset() {
    this.rpm = this.settings.idleRPM;
    this.throttle = 0;
    this.load = 0;
    this.burble = 0;
    this.acceleration = 0;
    this.accelArmed = true;
    this.lastAcceleration = -10;
    this.stopAudition();
    this.stopAcceleration();
  }
  setSettings(settings) {
    this.settings = validateAudio(settings);
    if (this.ctx) this.tuneGraph();
  }
  start() {
    ++this.lifecycle;
    if (!this.ctx) {
      try {
        const C = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!this.createContext && !C) {
          this.warning = "Web Audio is unavailable in this browser.";
          return Promise.resolve(false);
        }
        const c = (this.ctx = this.createContext
          ? this.createContext()
          : new C());
        this.buildGraph(c);
        this.ready = this.loadSamples();
      } catch (e) {
        this.warning = "Engine audio unavailable: " + e.message;
        this.ctx?.close?.().catch(() => {});
        this.ctx = null;
        return Promise.resolve(false);
      }
    }
    this.ctx
      .resume()
      .then(() => {
        if (this.warning?.startsWith("Tap Enable")) this.warning = "";
      })
      .catch(() => {
        this.warning = "Tap Enable / resume audio to unlock engine playback.";
      });
    set(this.runningGain.gain, 1, this.ctx.currentTime, 0.025);
    return this.ready;
  }
  async loadSamples() {
    await Promise.all(
      Object.entries(engineRecordings).map(async ([id, path]) => {
        this.sampleStatus[id] = "Loading " + path;
        try {
          this.recordings[id] = await loadRecording(
            this.ctx,
            this.baseURL + path,
            this.fetcher,
          );
          this.sampleStatus[id] = "Loaded M4A";
        } catch (original) {
          // Same recording, deterministic PCM conversion; never substitute synthesis.
          try {
            this.recordings[id] = await loadRecording(
              this.ctx,
              this.baseURL + path.replace(".m4a", ".wav"),
              this.fetcher,
            );
            this.sampleStatus[id] =
              "Loaded WAV compatibility copy (M4A: " + original.message + ")";
          } catch (fallback) {
            this.sampleStatus[id] =
              "FAILED: " +
              path +
              " (" +
              original.message +
              "; WAV: " +
              fallback.message +
              ")";
          }
        }
      }),
    );
    for (const region of engineRegions) {
      const recording = this.recordings[region.recording];
      if (!recording) continue;
      try {
        const buffer = seamlessLoop(
            this.ctx,
            recording,
            region.start,
            region.end,
          ),
          source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.engineInput);
        source.start();
        this.sourcesCreated++;
        this.layers.push({
          ...region,
          source,
          gain,
          buffer,
          weight: 0,
          rate: 1,
        });
      } catch (e) {
        this.sampleStatus[region.recording] = "FAILED loop: " + e.message;
      }
    }
    this.warning =
      this.layers.length < 4
        ? "One or more engine layers unavailable. See sample diagnostics; no synthetic fallback."
        : "";
    return this.layers.length > 0;
  }
  buildGraph(c) {
    const filter = (type, hz) => {
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = 0.6;
      return f;
    };
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    this.engineInput = c.createGain();
    this.engineBus = c.createGain();
    this.engineBus.gain.value = 0;
    this.highpass = filter("highpass", 35);
    this.bassEQ = filter("lowshelf", 145);
    this.midEQ = filter("peaking", 470);
    this.trebleEQ = filter("highshelf", 2100);
    this.resonator = filter("peaking", 95);
    this.filter = filter("lowpass", 6500);
    this.drive = c.createGain();
    const shaper = c.createWaveShaper(),
      curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.1) / 1.1;
    }
    shaper.curve = curve;
    this.engineInput.connect(this.highpass);
    this.highpass.connect(this.bassEQ);
    this.bassEQ.connect(this.midEQ);
    this.midEQ.connect(this.trebleEQ);
    this.trebleEQ.connect(this.resonator);
    this.resonator.connect(this.filter);
    this.filter.connect(this.drive);
    this.drive.connect(shaper);
    const split = c.createChannelSplitter(2),
      merge = c.createChannelMerger(2);
    shaper.connect(split);
    this.stereoGains = [];
    for (let from = 0; from < 2; from++)
      for (let to = 0; to < 2; to++) {
        const g = c.createGain();
        split.connect(g, from);
        g.connect(merge, 0, to);
        this.stereoGains.push({ g, diagonal: from === to });
      }
    merge.connect(this.engineBus);
    this.runningGain = c.createGain();
    this.runningGain.gain.value = 0;
    this.engineBus.connect(this.runningGain);
    this.runningGain.connect(this.master);
    this.echo = c.createDelay(0.3);
    this.echo.delayTime.value = 0.105;
    this.wet = c.createGain();
    this.engineBus.connect(this.echo);
    this.echo.connect(this.wet);
    this.wet.connect(this.runningGain);
    const compressor = (this.compressor = c.createDynamicsCompressor());
    compressor.threshold.value = -14;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    // Safety ceiling also covers existing countdown/wildlife effects; no engine oscillator.
    const ceiling = c.createWaveShaper(),
      limit = new Float32Array(4096);
    for (let i = 0; i < limit.length; i++) {
      const x = (i / (limit.length - 1)) * 2 - 1;
      limit[i] = 0.85 * Math.tanh(x / 0.85);
    }
    ceiling.curve = limit;
    this.output = c.createGain();
    this.output.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(compressor);
    compressor.connect(ceiling);
    ceiling.connect(this.output);
    this.output.connect(c.destination);
    this.tuneGraph();
  }
  tuneGraph() {
    const s = this.settings,
      t = this.ctx.currentTime;
    set(this.drive.gain, 0.8 + s.distortion * 0.004 + s.combustion * 0.002, t);
    set(
      this.bassEQ.gain,
      -4 + s.exhaustBass * 0.055 + s.lowEmphasis * 0.045,
      t,
    );
    set(
      this.midEQ.gain,
      (s.exhaustMid - 50) * 0.05 + s.growl * 0.025 + s.mechanical * 0.008,
      t,
    );
    set(
      this.trebleEQ.gain,
      -3 +
        s.exhaustTreble * 0.055 +
        s.rasp * 0.015 +
        s.harmonics * 0.008 +
        s.crackle * 0.003,
      t,
    );
    set(this.resonator.frequency, 65 + s.resonance * 0.6, t);
    set(this.resonator.gain, s.rumble * 0.025 + s.vibration * 0.008, t);
    set(this.wet.gain, s.reflections * 0.001, t);
    for (const { g, diagonal } of this.stereoGains)
      set(g.gain, (1 + ((diagonal ? 1 : -1) * s.stereoWidth) / 100) / 2, t);
  }
  setPreferences(muted, volume) {
    this.muted = muted;
    this.volume = clamp(volume / 100);
    if (this.output)
      set(
        this.output.gain,
        muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.025,
      );
  }
  pause(immediate = false) {
    this.stopAudition();
    this.stopAcceleration();
    if (!this.ctx) return;
    const token = ++this.lifecycle;
    set(this.runningGain.gain, 0, this.ctx.currentTime, 0.018);
    const suspend = () => {
      if (token === this.lifecycle) this.ctx.suspend().catch(() => {});
    };
    if (immediate) suspend();
    else setTimeout(suspend, 100);
  }
  update(
    speed,
    pressed,
    dt = 1 / 60,
    maxSpeed = 85 / 3.6,
    revOnly = false,
    propulsionLoad = null,
    motion = null,
  ) {
    const s = this.settings;
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    const throttle =
        typeof pressed === "number" ? clamp(pressed) : Number(!!pressed),
      ratio = clamp(speed / Math.max(1, maxSpeed)),
      before = this.throttle;
    this.throttle = blend(before, throttle, 2 + s.throttleResponse * 0.16, dt);
    const waterLoad = Number.isFinite(propulsionLoad)
      ? clamp(propulsionLoad)
      : 0.8 + ratio * 0.2;
    const corner = motion
      ? clamp(
          Math.abs(motion.lateralSpeed || 0) / 12 +
            Math.abs(motion.yawRate || 0) * 0.12,
        )
      : 0;
    this.load = clamp(
      this.throttle *
        (0.4 + waterLoad * 0.5 + corner * 0.18) *
        (s.loadEffect / 100),
    );
    const span = s.maxRPM - s.idleRPM;
    const demand = revOnly
      ? this.throttle
      : clamp(
          this.throttle * (0.84 + ratio * 0.16) -
            this.load * 0.035 +
            ratio * 0.24 * (1 - this.throttle),
        );
    const target = s.idleRPM + span * demand,
      inertia = 1.65 - s.rpmInertia * 0.013;
    this.rpm = blend(
      this.rpm,
      target,
      (target > this.rpm ? 0.7 + s.rpmRise * 0.075 : 0.5 + s.rpmFall * 0.055) *
        inertia,
      dt,
    );
    this.acceleration = dt > 0 ? (this.throttle - before) / dt : 0;
    if (throttle < 0.2) this.accelArmed = true;
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    if (
      this.accelArmed &&
      this.acceleration > 0.6 &&
      this.throttle > 0.12 &&
      t - this.lastAcceleration > 2.2
    ) {
      this.triggerAcceleration();
      this.accelArmed = false;
    }
    const operating = clamp((s.operatingRPM - s.idleRPM) / span, 0.25, 0.8),
      p = clamp((this.rpm - s.idleRPM) / span);
    // Operating RPM positions the cruise anchor without changing either simulation or source calibration.
    const timbre =
      p < operating
        ? (p / operating) * 0.63
        : 0.63 + ((p - operating) / (1 - operating)) * 0.37;
    const weights = layerMix(timbre),
      tau = 0.025 + (100 - s.crossfadeSpeed) * 0.003;
    let available = this.layers.reduce(
      (sum, l) =>
        sum + weights[engineRegions.findIndex((r) => r.id === l.id)] ** 2,
      0,
    );
    if (available < 0.001 && this.layers.length) {
      const closest = this.layers.reduce((a, b) =>
        Math.abs(a.anchor - timbre) < Math.abs(b.anchor - timbre) ? a : b,
      );
      weights[engineRegions.findIndex((r) => r.id === closest.id)] = 1;
      available = 1;
    }
    const normal = available > 0.001 ? 1 / Math.sqrt(available) : 0;
    for (const layer of this.layers) {
      const i = engineRegions.findIndex((r) => r.id === layer.id),
        idle = layer.id === "idle";
      layer.weight =
        weights[i] *
        normal *
        (idle ? 0.75 + s.rumble * 0.005 : s.cruiseLayer / 100);
      layer.rate = enginePlaybackRate(
        this.rpm,
        layer.referenceRPM,
        s.pitchRange,
      );
      set(
        layer.gain.gain,
        layer.weight * (this.accelVoice?.alive ? 0.88 : 1),
        t,
        tau,
      );
      set(layer.source.playbackRate, layer.rate, t, 0.08);
    }
    const idleAmount = 1 - p,
      lope =
        1 -
        idleAmount *
          (s.camLope + s.idleInstability + s.pulseIrregularity) *
          0.00018 *
          (0.5 + 0.5 * Math.sin(t * (6 + s.pulseDuration * 0.04)));
    const gain =
      (((0.72 + this.throttle * 0.18 + this.load * 0.1) *
        (s.engineVolume / 100)) /
        (1 + s.distance * 0.015)) *
      (s.engineMute ? 0 : 1) *
      (this.auditionVoice ? 0 : 1) *
      lope *
      (0.9 + s.pulseStrength * 0.001);
    set(this.engineBus.gain, gain, t, 0.045);
    set(
      this.filter.frequency,
      clamp(
        (4000 +
          p * 5000 +
          this.load * s.waterInteraction * 9 +
          s.pulseSharpness * 10) *
          (1 - s.muffler * 0.004),
        1800,
        12000,
      ),
      t,
      0.08,
    );
    if (this.auditionVoice)
      set(
        this.auditionVoice.gain.gain,
        s.engineMute ? 0 : s.engineVolume * 0.005,
        t,
        0.04,
      );
    if (this.accelVoice?.alive) {
      set(
        this.accelVoice.gain.gain,
        (s.accelerationLayer / 100) * 0.42 * this.throttle,
        t,
        0.06,
      );
      set(
        this.accelVoice.source.playbackRate,
        clamp(0.9 + p * 0.2, 0.9, 1.1),
        t,
        0.1,
      );
    }
  }
  triggerAcceleration() {
    if (!this.recordings.rev || this.accelVoice?.alive) return;
    const c = this.ctx,
      t = c.currentTime,
      index = this.accelerationCount++ % 3,
      offset = [0.28, 0.46, 0.64][index],
      duration = [1.55, 1.45, 1.35][index];
    const source = c.createBufferSource(),
      gain = c.createGain(),
      envelope = c.createGain();
    source.buffer = this.recordings.rev;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(envelope);
    envelope.connect(this.engineInput);
    this.lastAcceleration = t;
    this.accelVoice = { source, gain, envelope, alive: true };
    this.sourcesCreated++;
    const voice = this.accelVoice;
    gain.gain.value = this.settings.accelerationLayer * 0.0042;
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(1, t + 0.08);
    // BufferSource duration is sample time; stop envelope is scheduled conservatively before earliest end.
    source.start(t, offset, duration);
    envelope.gain.setValueAtTime(1, t + duration / 1.1 - 0.18);
    envelope.gain.linearRampToValueAtTime(0, t + duration / 1.1 - 0.01);
    source.onended = () => {
      voice.alive = false;
      source.disconnect();
      gain.disconnect();
      envelope.disconnect();
      if (this.accelVoice === voice) this.accelVoice = null;
    };
  }
  stopAcceleration() {
    const voice = this.accelVoice;
    if (!voice) return;
    voice.alive = false;
    const t = this.ctx.currentTime;
    voice.envelope.gain.cancelScheduledValues(t);
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, t);
    voice.envelope.gain.linearRampToValueAtTime(0, t + 0.04);
    try {
      voice.source.stop(t + 0.05);
    } catch {}
    this.accelVoice = null;
  }
  async audition(id) {
    this.stopAudition();
    const token = this.auditionToken;
    await this.start();
    if (token !== this.auditionToken) return false;
    const buffer = this.recordings[id];
    if (!buffer) {
      this.warning = "Cannot test " + id + ": " + this.sampleStatus[id];
      return false;
    }
    const c = this.ctx,
      source = c.createBufferSource(),
      gain = c.createGain(),
      envelope = c.createGain(),
      duration = Math.min(buffer.duration, 4);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(envelope);
    envelope.connect(this.master);
    const voice = { source, gain, envelope };
    this.auditionVoice = voice;
    const t = c.currentTime;
    gain.gain.value = this.settings.engineMute
      ? 0
      : this.settings.engineVolume * 0.005;
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(1, t + 0.06);
    envelope.gain.setValueAtTime(1, t + duration - 0.12);
    envelope.gain.linearRampToValueAtTime(0, t + duration);
    source.start(t, 0, duration);
    this.sourcesCreated++;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      envelope.disconnect();
      if (this.auditionVoice === voice) this.auditionVoice = null;
    };
    return true;
  }
  stopAudition() {
    this.auditionToken = (this.auditionToken || 0) + 1;
    const v = this.auditionVoice;
    if (!v) return;
    const t = this.ctx.currentTime;
    v.envelope.gain.cancelScheduledValues(t);
    v.envelope.gain.setValueAtTime(v.envelope.gain.value, t);
    v.envelope.gain.linearRampToValueAtTime(0, t + 0.03);
    try {
      v.source.stop(t + 0.04);
    } catch {}
    this.auditionVoice = null;
  }
  inspect() {
    return {
      backend: this.backend,
      engineGain: this.engineBus?.gain.value || 0,
      engineMuted: !!this.settings.engineMute,
      sampleTest: !!this.auditionVoice,
      rpm: Math.round(this.rpm),
      throttle: Math.round(this.throttle * 100),
      load: this.load,
      context: this.ctx?.state || "not started",
      samples: { ...this.sampleStatus },
      layers: this.layers.map((l) => ({
        id: l.id,
        weight: +l.weight.toFixed(3),
        playbackRate: +l.rate.toFixed(3),
      })),
      crossfade:
        this.layers
          .filter((l) => l.weight > 0.02)
          .map((l) => l.id)
          .join(" + ") || "silent",
      acceleration: !!this.accelVoice?.alive,
      accelerationCount: this.accelerationCount,
      loopSources: this.layers.length,
      sourcesCreated: this.sourcesCreated,
      warning: this.warning || "",
    };
  }
  vocal(angry) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    o.type = "triangle";
    o.frequency.setValueAtTime(angry ? 95 : 150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.4);
    f.type = "lowpass";
    f.frequency.value = 420;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(t + 0.5);
    o.onended = () => {
      o.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  signal(kind) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const c = this.ctx,
      t = c.currentTime,
      duration = kind === "go" ? 0.65 : 0.16;
    for (const frequency of kind === "go"
      ? [880, 1320]
      : [kind === "upper" ? 660 : 990]) {
      const o = c.createOscillator(),
        gain = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(kind === "go" ? 0.12 : 0.18, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      o.connect(gain);
      gain.connect(this.master);
      o.start(t);
      o.stop(t + duration + 0.02);
      o.onended = () => {
        o.disconnect();
        gain.disconnect();
      };
    }
  }
}
