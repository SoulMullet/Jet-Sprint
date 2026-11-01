import { defaultAudio, validateAudio } from "./audio-settings.js";
import {
  engineRecordings,
  engineRegions,
  seamlessLoop,
  loadRecording,
  transientRegions,
  clamp,
  enginePlaybackRate,
} from "./engine-samples.js";
import { EngineRPMModel, engineBedMix } from "./engine-rpm.js";
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
    this.sampleStatus = Object.fromEntries(
      Object.keys(engineRecordings).map((id) => [id, "Not loaded"]),
    );
    this.transients = { rev: null, revDown: null };
    this.voices = new Set();
    this.backend = "Multi-sample V8 / Web Audio";
    this.lifecycle = 0;
    this.sourcesCreated = 0;
    this.accelerationCount = 0;
    this.reset();
  }
  get rpm() {
    return this.model.rpm;
  }
  get throttle() {
    return this.model.throttle;
  }
  get load() {
    return this.model.load;
  }
  reset() {
    this.model = new EngineRPMModel(this.settings);
    this.savedModel = null;
    this.seenUp = 0;
    this.seenDown = 0;
    this.stopAudition();
    this.stopTransients();
  }
  beginTest() {
    if (this.savedModel) return;
    this.savedModel = this.model;
    this.model = new EngineRPMModel(this.settings);
    this.seenUp = 0;
    this.seenDown = 0;
    this.stopTransients();
  }
  endTest() {
    if (!this.savedModel) return;
    this.stopAudition();
    this.stopTransients();
    this.model = this.savedModel;
    this.savedModel = null;
    this.seenUp = this.model.upSequence;
    this.seenDown = this.model.downSequence;
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
        this.installLoops(id);
      }),
    );
    this.warning =
      this.layers.length < engineRegions.length ||
      Object.keys(this.recordings).length < 6
        ? "One or more engine layers unavailable. See sample diagnostics; no synthetic fallback."
        : "";
    return this.layers.length > 0;
  }
  installLoops(id) {
    for (const region of engineRegions.filter((r) => r.recording === id)) {
      if (this.layers.some((l) => l.id === region.id)) continue;
      const recording = this.recordings[region.recording];
      if (!recording) continue;
      try {
        const buffer = seamlessLoop(
            this.ctx,
            recording,
            region.start,
            region.end,
            region.overlap,
          ),
          source = this.ctx.createBufferSource(),
          gain = this.ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.engineInput);
        source.start(0, region.id === "cruiseOne" ? buffer.duration * 0.37 : 0);
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
    this.engineMix = c.createGain();
    this.engineCompressor = c.createDynamicsCompressor();
    this.engineCompressor.knee.value = 12;
    this.engineCompressor.attack.value = 0.003;
    this.engineCompressor.release.value = 0.16;
    this.engineBus.connect(this.engineMix);
    this.engineMix.connect(this.engineCompressor);
    this.engineCompressor.connect(this.runningGain);
    this.runningGain.connect(this.master);
    this.echo = c.createDelay(0.3);
    this.echo.delayTime.value = 0.105;
    this.wet = c.createGain();
    this.engineBus.connect(this.echo);
    this.echo.connect(this.wet);
    this.wet.connect(this.engineMix);
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
    set(this.engineCompressor.threshold, -8 - s.engineCompression * 0.12, t);
    set(this.engineCompressor.ratio, 2 + s.engineCompression * 0.08, t);
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
    this.seenUp = this.model.upSequence;
    this.seenDown = this.model.downSequence;
    this.stopAudition();
    this.stopTransients();
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
    contact = null,
  ) {
    const s = this.settings,
      m = this.model;
    m.update(
      s,
      speed,
      pressed,
      dt,
      maxSpeed,
      revOnly,
      propulsionLoad,
      motion,
      contact,
    );
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    if (m.reapplied)
      this.releaseTransient("revDown", Math.min(0.18, s.revDownFade / 2000));
    if (m.upSequence !== this.seenUp && this.recordings.rev) {
      this.seenUp = m.upSequence;
      if (m.elapsed - m.upAt < 0.5) {
        this.releaseTransient("revDown", 0.09);
        this.triggerTransient("rev");
      }
    }
    if (m.downSequence !== this.seenDown && this.recordings.revDown) {
      this.seenDown = m.downSequence;
      if (m.elapsed - m.downAt < 0.5) {
        this.releaseTransient("rev", 0.09);
        this.triggerTransient("revDown");
      }
    }
    const weights = engineBedMix(m, s),
      tau = 0.025 + (100 - s.crossfadeSpeed) * 0.003;
    // Missing assets leave a continuous remaining bed, with explicit diagnostics.
    if (
      this.layers.length < engineRegions.length &&
      this.layers.length &&
      this.layers.every(
        (l) => weights[engineRegions.findIndex((r) => r.id === l.id)] < 0.001,
      )
    ) {
      const fallback =
        this.layers.find((l) => l.id === "idle") ||
        this.layers.find((l) => l.id === "cruise") ||
        this.layers[0];
      const id = engineRegions.findIndex((r) => r.id === fallback.id);
      const volume = {
        idle: s.idleSampleVolume,
        cruise: s.cruiseLayer,
        cruiseOne: s.cruiseLayerOneVolume,
        jump: s.jumpSampleVolume,
      }[fallback.id];
      weights[id] = fallback.id === "jump" && !m.airborne ? 0 : volume * 0.006;
    }
    const foreground = Object.entries(this.transients).some(
        ([role, v]) =>
          v && (role === "rev" ? s.accelerationLayer : s.revDownVolume) > 0,
      ),
      bedDuck = foreground ? 0.82 : 1;
    for (const layer of this.layers) {
      const i = engineRegions.findIndex((r) => r.id === layer.id);
      layer.weight = weights[i] * bedDuck;
      layer.rate = enginePlaybackRate(m.rpm, layer.referenceRPM, s.pitchRange);
      if (layer.id === "cruiseOne")
        layer.rate = clamp(
          layer.rate * (1 + 0.0025 * Math.sin(m.elapsed * 0.31)),
          0.72,
          1.32,
        );
      set(layer.gain.gain, layer.weight, t, tau);
      set(layer.source.playbackRate, layer.rate, t, 0.08);
    }
    const p = clamp((m.rpm - s.idleRPM) / (s.maxRPM - s.idleRPM)),
      idleAmount = 1 - p;
    const stage = clamp(motion?.engineStage || 0, 0, 4),
      boost = clamp(motion?.nitrous || 0);
    set(
      this.trebleEQ.gain,
      -3 +
        s.exhaustTreble * 0.055 +
        s.rasp * 0.015 +
        s.harmonics * 0.008 +
        s.crackle * 0.003 +
        stage * 0.25 +
        boost * 0.9,
      t,
      0.12,
    );
    const lope =
      1 -
      idleAmount *
        (s.camLope + s.idleInstability + s.pulseIrregularity) *
        0.00018 *
        (0.5 + 0.5 * Math.sin(t * (6 + s.pulseDuration * 0.04)));
    const gain =
      (((0.72 + m.throttle * 0.18 + m.load * 0.1) * (s.engineVolume / 100)) /
        (1 + s.distance * 0.015)) *
      (s.engineMute ? 0 : 1) *
      (this.auditionVoice ? 0 : 1) *
      lope *
      (0.9 + s.pulseStrength * 0.001) *
      (1 + stage * 0.02 + boost * 0.05);
    set(this.engineBus.gain, gain, t, 0.045);
    set(
      this.filter.frequency,
      clamp(
        (4000 +
          p * 5000 +
          m.load * s.waterInteraction * 9 +
          boost * 450 +
          stage * 80 +
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
    for (const [role, voice] of Object.entries(this.transients))
      if (voice) {
        const volume = role === "rev" ? s.accelerationLayer : s.revDownVolume;
        voice.weight =
          volume *
          0.0038 *
          (1 + boost * 0.12) *
          (role === "rev"
            ? 0.3 + 0.7 * m.throttle
            : 0.55 + 0.45 * (1 - m.throttle));
        voice.rate = clamp(
          enginePlaybackRate(m.rpm, voice.referenceRPM, s.pitchRange),
          0.82,
          1.18,
        );
        set(voice.gain.gain, voice.weight, t, 0.06);
        set(voice.source.playbackRate, voice.rate, t, 0.09);
      }
  }
  triggerTransient(role) {
    const spec = transientRegions[role],
      recording = this.recordings[spec.recording];
    if (!recording || this.transients[role]) return;
    const c = this.ctx,
      t = c.currentTime,
      count =
        role === "rev"
          ? this.accelerationCount++
          : (this.revDownCount = (this.revDownCount || 0) + 1),
      index = count % 3;
    const offset = spec.offsets[index],
      duration = Math.min(
        spec.durations[index],
        recording.duration - offset - 0.02,
      );
    if (duration < 0.2) return;
    const source = c.createBufferSource(),
      gain = c.createGain(),
      envelope = c.createGain();
    source.buffer = recording;
    const voice = {
      role,
      source,
      gain,
      envelope,
      referenceRPM: spec.referenceRPM,
      weight: 0,
      rate: clamp(
        enginePlaybackRate(
          this.rpm,
          spec.referenceRPM,
          this.settings.pitchRange,
        ),
        0.82,
        1.18,
      ),
      retiring: false,
    };
    source.playbackRate.value = voice.rate;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(envelope);
    envelope.connect(this.engineInput);
    const attack =
      role === "rev" ? 0.035 + this.settings.idleRevCrossfade * 0.0015 : 0.045;
    const earliestEnd = duration / 1.18,
      release =
        role === "rev"
          ? 0.08 + this.settings.revCruiseCrossfade * 0.0035
          : this.settings.revDownFade / 1000;
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(1, t + attack);
    envelope.gain.setValueAtTime(
      1,
      t + Math.max(attack, earliestEnd - release - 0.02),
    );
    envelope.gain.linearRampToValueAtTime(0, t + earliestEnd - 0.01);
    this.transients[role] = voice;
    this.voices.add(voice);
    this.sourcesCreated++;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      envelope.disconnect();
      this.voices.delete(voice);
      if (this.transients[role] === voice) this.transients[role] = null;
    };
    source.start(t, offset, duration);
  }
  fadeVoice(v, seconds) {
    v.retiring = true;
    const t = this.ctx.currentTime,
      p = v.envelope.gain;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
    }
    p.linearRampToValueAtTime(0, t + seconds);
    try {
      v.source.stop(t + seconds + 0.01);
    } catch {}
  }
  releaseTransient(role, seconds = 0.05) {
    const v = this.transients[role];
    if (!v) return;
    this.fadeVoice(v, seconds);
    this.transients[role] = null;
  }
  stopTransients() {
    if (!this.transients) return;
    for (const v of this.voices) this.fadeVoice(v, 0.04);
    for (const role of Object.keys(this.transients))
      this.transients[role] = null;
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
    const m = this.model;
    const layers = this.layers.map((l) => ({
      id: l.id,
      weight: +l.weight.toFixed(3),
      gain: l.gain.gain.value,
      playbackRate: +l.rate.toFixed(3),
    }));
    for (const v of this.voices)
      layers.push({
        id: v.role,
        weight: v.retiring ? 0 : v.weight,
        gain: v.gain.gain.value * v.envelope.gain.value,
        playbackRate: v.rate,
        retiring: v.retiring,
      });
    return {
      backend: this.backend,
      engineGain: this.engineBus?.gain.value || 0,
      engineMuted: !!this.settings.engineMute,
      sampleTest: !!this.auditionVoice,
      rpm: Math.round(m.rpm),
      rpmRate: Math.round(m.rpmRate),
      throttle: Math.round(m.throttle * 100),
      load: m.load,
      state: m.state,
      airborne: m.airborne,
      flightBlend: m.flightBlend,
      landing: m.landing,
      context: this.ctx?.state || "not started",
      samples: { ...this.sampleStatus },
      layers,
      crossfade:
        layers
          .filter((l) => l.weight > 0.02)
          .map((l) => l.id)
          .join(" + ") || "silent",
      acceleration: !!this.transients.rev,
      revDown: !!this.transients.revDown,
      accelerationCount: this.accelerationCount,
      revDownCount: this.revDownCount || 0,
      loopSources: this.layers.length,
      activeSources:
        this.layers.length + this.voices.size + Number(!!this.auditionVoice),
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
