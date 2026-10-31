const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Two exact first-order filters. Uses actual speed, never commanded throttle.
export class SpeedFraming {
  constructor() {
    this.output = { distanceScale: 1, fovExtra: 0, normalizedSpeed: 0 };
    this.reset();
  }
  reset() {
    this.speed = 0;
    this.distance = 0;
    Object.assign(this.output, {
      distanceScale: 1,
      fovExtra: 0,
      normalizedSpeed: 0,
    });
  }
  update(speed, top, dt, settings) {
    const threshold = settings.speedThreshold / 3.6,
      target = settings.speedZoom
        ? clamp((speed - threshold) / Math.max(1, top / 3.6 - threshold), 0, 1)
        : 0,
      r =
        target > this.speed
          ? settings.pullbackResponse
          : settings.returnResponse,
      k = 1 / settings.distanceSmoothing,
      a = Math.exp(-r * Math.max(0, dt)),
      b = Math.exp(-k * Math.max(0, dt)),
      old = this.speed;
    this.speed = target + (old - target) * a;
    this.distance =
      target +
      (this.distance - target) * b +
      (old - target) *
        (Math.abs(k - r) < 1e-6 ? k * dt * b : (k * (a - b)) / (k - r));
    this.distance = clamp(this.distance, 0, 1);
    this.output.distanceScale =
      1 + (settings.speedPullback / 100) * this.distance;
    this.output.fovExtra = settings.speedFovIncrease * this.speed;
    this.output.normalizedSpeed = this.speed;
    return this.output;
  }
}
