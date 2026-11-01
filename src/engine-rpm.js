import { clamp } from "./engine-samples.js";
export const approach = (v, target, rate, dt) =>
  v + (target - v) * (1 - Math.exp(-rate * dt));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Audio-only state. All motion/contact inputs are read; no hull or campaign writes.
export class EngineRPMModel {
  constructor(settings) {
    this.reset(settings);
  }
  reset(s) {
    Object.assign(this, {
      rpm: s.idleRPM,
      rpmRate: 0,
      throttle: 0,
      throttleRate: 0,
      command: 0,
      load: 0,
      elapsed: 0,
      airborne: false,
      airTime: 0,
      waterTime: 0,
      flightBlend: 0,
      landing: 0,
      upSequence: 0,
      downSequence: 0,
      upAt: -10,
      downAt: -10,
      accelArmed: true,
      releaseArmed: false,
      releasePeak: 0,
      releaseLow: 0,
      reapplied: false,
      state: "idle",
      cruiseShare: 0,
    });
  }
  update(
    s,
    speed,
    command,
    dt,
    maxSpeed,
    revOnly,
    propulsionLoad,
    motion,
    contact,
  ) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this.elapsed += dt;
    command = clamp(
      typeof command === "number" && Number.isFinite(command)
        ? command
        : Number(command === true),
    );
    const previousCommand = this.command,
      before = this.throttle,
      oldRPM = this.rpm;
    this.command = command;
    this.throttle = approach(
      before,
      command,
      2 + s.throttleResponse * 0.16,
      dt,
    );
    this.throttleRate = dt ? (this.throttle - before) / dt : 0;
    const physicalAir = !!contact?.airborne,
      wasAir = this.airborne;
    if (physicalAir) {
      this.airTime += dt;
      this.waterTime = 0;
      if (this.airTime >= s.airborneDelay / 1000) this.airborne = true;
    } else {
      this.airTime = 0;
      this.waterTime += dt;
      if (contact?.landed || this.waterTime >= s.airborneHysteresis / 1000)
        this.airborne = false;
    }
    if (wasAir && !this.airborne) this.landing = 1;
    this.landing = approach(
      this.landing,
      0,
      4 / Math.max(0.1, s.landingTransition / 1000),
      dt,
    );
    const flightTau = this.airborne
      ? 0.1
      : Math.max(0.08, (s.landingTransition / 1000) * 0.35);
    this.flightBlend = approach(
      this.flightBlend,
      Number(this.airborne),
      1 / flightTau,
      dt,
    );
    const ratio = clamp(speed / Math.max(1, maxSpeed)),
      water = Number.isFinite(propulsionLoad)
        ? clamp(propulsionLoad)
        : 0.8 + ratio * 0.2;
    const corner = clamp(
      Math.abs(motion?.lateralSpeed || 0) / 12 +
        Math.abs(motion?.yawRate || 0) * 0.12,
    );
    const hullDrag = clamp(1 - (motion?.planing ?? ratio)) * 0.05;
    const acceleration = clamp((motion?.forwardAcceleration || 0) / 25, -1, 1);
    this.load = clamp(
      this.throttle *
        (0.4 +
          water * 0.5 +
          corner * 0.18 +
          hullDrag +
          Math.max(0, acceleration) * 0.04) *
        (s.loadEffect / 100) *
        (1 - this.flightBlend * 0.93) +
        this.landing * 0.18 * this.throttle,
    );
    const span = s.maxRPM - s.idleRPM,
      wetDemand = revOnly
        ? this.throttle
        : clamp(
            this.throttle * (0.84 + ratio * 0.16) -
              this.load * 0.035 +
              ratio * 0.24 * (1 - this.throttle) +
              acceleration * this.throttle * 0.015,
          );
    const airDemand = this.throttle;
    const demand =
      wetDemand +
      ((airDemand - wetDemand) * this.flightBlend * s.airborneResponse) / 100;
    const target = s.idleRPM + span * clamp(demand),
      inertia = 1.65 - s.rpmInertia * 0.013;
    const rise =
      (0.7 + s.rpmRise * 0.075) *
      (1 + this.flightBlend * s.airborneResponse * 0.008);
    this.rpm = clamp(
      approach(
        this.rpm,
        target,
        (target > this.rpm ? rise : 0.5 + s.rpmFall * 0.055) * inertia,
        dt,
      ),
      s.idleRPM,
      s.maxRPM,
    );
    this.rpmRate = dt ? (this.rpm - oldRPM) / dt : 0;
    if (command < 0.2 || previousCommand - command > 0.25)
      this.accelArmed = true;
    if (
      this.accelArmed &&
      this.throttleRate > 0.6 &&
      this.throttle > 0.12 &&
      this.elapsed - this.upAt > s.accelerationCooldown / 1000
    ) {
      this.upSequence++;
      this.upAt = this.elapsed;
      this.accelArmed = false;
    }
    this.reapplied =
      command - previousCommand > 0.08 || this.throttleRate > 0.6;
    if (command > 0.35 && command >= previousCommand) {
      this.releasePeak = Math.max(this.releasePeak, command);
      if (command - this.releaseLow > 0.12) this.releaseArmed = true;
    }
    this.releaseLow = Math.min(this.releaseLow, command);
    if (
      this.releaseArmed &&
      this.releasePeak - command >= s.revDownThreshold / 100 &&
      this.throttle > 0.15 &&
      this.rpm > s.idleRPM + span * 0.08 &&
      this.elapsed - this.downAt > s.revDownCooldown / 1000
    ) {
      this.downSequence++;
      this.downAt = this.elapsed;
      this.releaseArmed = false;
      this.releasePeak = command;
      this.releaseLow = command;
    }
    const p = clamp((this.rpm - s.idleRPM) / span);
    this.state = this.airborne
      ? "airborne"
      : this.landing > 0.05
        ? "landing"
        : this.throttleRate < -0.12 || this.rpmRate < -150
          ? "decelerating"
          : this.throttleRate > 0.12 || this.rpmRate > 150
            ? "accelerating"
            : p < 0.06
              ? "idle"
              : "cruising";
    const targetShare = clamp(
      (s.cruiseBlend / 100) *
        (0.35 +
          0.4 * this.load +
          0.25 * p +
          0.025 * Math.sin(this.elapsed * 0.23)),
      0,
      0.75,
    );
    this.cruiseShare = approach(this.cruiseShare, targetShare, 1.4, dt);
  }
}
// Unit-power bed before independent user layer levels. Never stack duplicate WAVs.
export function engineBedMix(model, s) {
  const p = clamp((model.rpm - s.idleRPM) / (s.maxRPM - s.idleRPM));
  const operating = clamp(
    (s.operatingRPM - s.idleRPM) / (s.maxRPM - s.idleRPM),
    0.25,
    0.8,
  );
  const progress = smooth(
    0.015,
    Math.min(0.9, operating * (0.45 + s.idleRevCrossfade * 0.009)),
    p,
  );
  const idle = Math.cos((progress * Math.PI) / 2),
    cruise = Math.sin((progress * Math.PI) / 2),
    share = model.cruiseShare;
  const wet = Math.cos((model.flightBlend * 0.72 * Math.PI) / 2),
    jump =
      Math.sin((model.flightBlend * Math.PI) / 2) *
      (0.18 + 0.82 * model.throttle);
  const main = cruise * Math.cos((share * Math.PI) / 2) * wet,
    secondary = cruise * Math.sin((share * Math.PI) / 2) * wet;
  const normal = 1 / Math.max(1, Math.hypot(idle, main, secondary, jump));
  return [
    ((idle * normal * s.idleSampleVolume) / 100) * (0.75 + s.rumble * 0.005),
    (main * normal * s.cruiseLayer) / 100,
    (secondary * normal * s.cruiseLayerOneVolume) / 100,
    (((jump * normal * s.jumpSampleVolume) / 100) * s.jumpBlend) / 100,
  ];
}
