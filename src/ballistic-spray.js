import {
  createSprayFrame,
  updateSprayFrame,
  jetLaunch,
  hullLaunch,
  hullSprayRate,
} from "./spray-frame.js";
import { sprayDefaults } from "./spray-settings.js";
export const SPRAY_STEP = 1 / 120;
const flatWater = () => 0,
  allWater = () => true,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fields = [
  "x",
  "z",
  "angle",
  "vx",
  "vz",
  "pump",
  "yawRate",
  "lateralAcceleration",
];
const poseFields = ["roll", "pitch", "heave"];

/** Fixed memory, world-space semi-implicit Euler. Boat state is read only. */
export class BallisticSpray {
  constructor(
    capacity = 6144,
    { surfaceAt = flatWater, isWater = allWater, splashCapacity = 192 } = {},
  ) {
    this.capacity = capacity;
    this.limit = capacity;
    this.surfaceAt = surfaceAt;
    this.isWater = isWater;
    this.splashCapacity = splashCapacity;
    this.position = new Float32Array(capacity * 3);
    this.previous = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.births = new Float32Array(capacity * 4);
    this.launches = new Float32Array(capacity * 4);
    this.styles = new Float32Array(capacity * 4);
    this.age = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.active = new Uint32Array(capacity);
    this.slot = new Uint32Array(capacity);
    this.splashes = new Float32Array(splashCapacity * 5); // x, waterY, z, birth, intensity
    this.previousBody = {};
    this.currentBody = {};
    this.sampleBody = {};
    this.previousPose = {};
    this.currentPose = {};
    this.samplePose = {};
    this.frame = createSprayFrame();
    this.launch = {};
    this.reset();
  }
  reset() {
    this.births.fill(-1000);
    this.position.fill(-1000);
    this.previous.fill(-1000);
    this.alive.fill(0);
    this.splashes.fill(-1000);
    this.count = this.cursor = this.impactCount = this.splashCursor = 0;
    this.emission = this.accumulator = this.time = this.renderTime = 0;
    this.ready = false;
    this.seed = 87;
    this.rate = 0;
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  configure(limit) {
    this.limit = clamp(Math.round(limit), 1, this.capacity);
    for (let n = this.count - 1; n >= 0; n--)
      if (this.active[n] >= this.limit) this.retire(this.active[n]);
  }
  retire(i) {
    if (!this.alive[i]) return;
    const n = this.slot[i],
      last = this.active[--this.count];
    this.active[n] = last;
    this.slot[last] = n;
    this.alive[i] = 0;
  }
  emit(launch, life, kind = 0, size = 0.12, source = 0) {
    const i = this.cursor++ % this.limit,
      j = i * 3,
      k = i * 4;
    this.retire(i);
    this.alive[i] = 1;
    this.slot[i] = this.count;
    this.active[this.count++] = i;
    const y = Math.max(
      launch.py,
      this.surfaceAt(launch.px, launch.pz, this.time) + 0.018,
    );
    this.births[k] = this.position[j] = this.previous[j] = launch.px;
    this.births[k + 1] = this.position[j + 1] = this.previous[j + 1] = y;
    this.births[k + 2] =
      this.position[j + 2] =
      this.previous[j + 2] =
        launch.pz;
    this.births[k + 3] = this.time;
    this.velocity[j] = this.launches[k] = launch.vx;
    this.velocity[j + 1] = this.launches[k + 1] = launch.vy;
    this.velocity[j + 2] = this.launches[k + 2] = launch.vz;
    this.launches[k + 3] = source;
    this.styles[k] = life;
    this.styles[k + 1] = size;
    this.styles[k + 2] = kind;
    this.styles[k + 3] = this.random() * Math.PI * 2;
    this.age[i] = 0;
    return i;
  }
  impact(x, y, z, intensity) {
    if (intensity <= 0 || !this.isWater(x, z)) return;
    const j = (this.splashCursor++ % this.splashCapacity) * 5;
    this.splashes[j] = x;
    this.splashes[j + 1] = y;
    this.splashes[j + 2] = z;
    this.splashes[j + 3] = this.time;
    this.splashes[j + 4] = intensity;
    this.impactCount++;
  }
  integrate(h, gravity, splash) {
    for (let n = this.count - 1; n >= 0; n--) {
      const i = this.active[n],
        j = i * 3,
        k = i * 4;
      this.age[i] += h;
      if (this.age[i] >= this.styles[k]) {
        this.retire(i);
        continue;
      }
      const x = this.position[j],
        y = this.position[j + 1],
        z = this.position[j + 2];
      this.previous[j] = x;
      this.previous[j + 1] = y;
      this.previous[j + 2] = z;
      // Y is world-up in this game. Existing velocity never reads boat heading.
      this.velocity[j + 1] += gravity * h;
      this.position[j] += this.velocity[j] * h;
      this.position[j + 1] += this.velocity[j + 1] * h;
      this.position[j + 2] += this.velocity[j + 2] * h;
      if (this.velocity[j + 1] > 0) continue;
      const water = this.surfaceAt(
        this.position[j],
        this.position[j + 2],
        this.time,
      );
      if (this.velocity[j + 1] <= 0 && this.position[j + 1] <= water) {
        const f = clamp(
          (y - water) / Math.max(1e-8, y - this.position[j + 1]),
          0,
          1,
        );
        this.impact(
          x + (this.position[j] - x) * f,
          water,
          z + (this.position[j + 2] - z) * f,
          splash,
        );
        this.retire(i);
      }
    }
  }
  sample(f) {
    for (const key of fields)
      this.sampleBody[key] =
        this.previousBody[key] +
        (this.currentBody[key] - this.previousBody[key]) * f;
    const delta = Math.atan2(
      Math.sin(this.currentBody.angle - this.previousBody.angle),
      Math.cos(this.currentBody.angle - this.previousBody.angle),
    );
    this.sampleBody.angle = this.previousBody.angle + delta * f;
    for (const key of poseFields)
      this.samplePose[key] =
        this.previousPose[key] +
        (this.currentPose[key] - this.previousPose[key]) * f;
    return updateSprayFrame(this.frame, this.sampleBody, this.samplePose);
  }
  advance(
    dt,
    b,
    {
      pose = {},
      tuning = sprayDefaults,
      density = 1,
      distance = 1,
      volume = 1,
      effects = 1,
      quality = 1,
      impact = 0,
      emit = true,
    } = {},
  ) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(0.1, dt);
    for (const key of fields)
      this.currentBody[key] = Number.isFinite(b[key]) ? b[key] : 0;
    for (const key of poseFields) this.currentPose[key] = pose[key] || 0;
    if (!this.ready) {
      Object.assign(this.previousBody, this.currentBody);
      this.previousBody.x -= this.currentBody.vx * dt;
      this.previousBody.z -= this.currentBody.vz * dt;
      this.previousBody.angle -= (b.yawRate || 0) * dt;
      Object.assign(this.previousPose, this.currentPose);
      this.ready = true;
    }
    const start = this.renderTime;
    this.renderTime += dt;
    this.accumulator += dt;
    const gravity = -9.8 * (tuning.sprayGravity ?? 1),
      splash = ((tuning.spraySplash ?? 100) / 100) * volume;
    while (this.accumulator >= SPRAY_STEP - 1e-10) {
      this.time += SPRAY_STEP;
      this.accumulator = Math.max(0, this.accumulator - SPRAY_STEP);
      this.integrate(SPRAY_STEP, gravity, splash);
      const frame = this.sample(clamp((this.time - start) / dt, 0, 1)),
        speed = Math.hypot(this.sampleBody.vx, this.sampleBody.vz),
        pump = frame.pump;
      const hull = hullSprayRate(frame, speed, impact),
        jet = (100 + speed * 36) * pump;
      const ceiling =
        (this.limit / Math.max(0.3, tuning.sprayLifetime ?? 3)) * 0.95;
      this.rate =
        emit && distance > 0
          ? (Math.min(
              5000,
              ceiling,
              (jet + hull) * density * volume * effects * quality,
            ) *
              (tuning.sprayDensity ?? 100)) /
            200
          : 0;
      const carry = this.emission;
      this.emission += this.rate * SPRAY_STEP;
      const births = Math.min(this.limit, Math.floor(this.emission));
      this.emission -= births;
      for (let n = 0; n < births; n++) {
        const at = this.time - SPRAY_STEP + (1 - carry + n) / this.rate;
        const f = this.sample(clamp((at - start) / dt, 0, 1)),
          isHull = this.random() < hull / Math.max(1, jet + hull),
          r = this.random(),
          kind = isHull ? 2 : r < 0.6 ? 0 : r < 0.82 ? 1 : 2;
        if (isHull)
          hullLaunch(
            this.launch,
            f,
            speed,
            this.random(),
            0.8 + this.random() * 0.4,
          );
        else
          jetLaunch(
            this.launch,
            f,
            speed,
            distance,
            0.94 + this.random() * 0.12,
            (this.random() - 0.5) * 2,
            1,
            tuning,
          );
        this.emit(
          this.launch,
          (tuning.sprayLifetime ?? 3) * (0.9 + this.random() * 0.1),
          kind,
          kind === 0
            ? 0.1 + this.random() * 0.11
            : kind === 1
              ? 0.15 + this.random() * 0.16
              : 0.045 + this.random() * 0.065,
          Number(isHull),
        );
      }
    }
    Object.assign(this.previousBody, this.currentBody);
    Object.assign(this.previousPose, this.currentPose);
  }
  get alpha() {
    return this.accumulator / SPRAY_STEP;
  }
}
