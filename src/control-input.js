/** Device-independent, allocation-free command pipeline. No boat forces live here. */
export const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
export function response(
  value,
  deadzone = 0,
  exponent = 1,
  sensitivity = 1,
  signed = true,
) {
  const magnitude = clamp(
    (Math.abs(clamp(value, signed ? -1 : 0, 1)) - deadzone) /
      Math.max(0.001, 1 - deadzone),
  );
  return magnitude === 0
    ? 0
    : clamp(Math.pow(magnitude, exponent) * sensitivity) *
        (signed ? Math.sign(clamp(value, -1, 1)) : 1);
}
export function filterInput(current, target, seconds, rate, dt) {
  if (dt <= 0) return current;
  const smooth =
    seconds > 0
      ? current + (target - current) * -Math.expm1(-dt / seconds)
      : target;
  const next = current + clamp(smooth - current, -rate * dt, rate * dt);
  return Math.abs(next - target) < 0.00001 ? target : next;
}
export function returnInput(
  value,
  mode,
  speed,
  strength,
  dt,
  releasedFor = 0,
  delay = 0,
) {
  if (mode === "hold" || (mode === "hybrid" && releasedFor <= delay))
    return value;
  const time =
    mode === "hybrid" ? Math.min(dt, Math.max(0, releasedFor - delay)) : dt;
  const next =
    mode === "spring"
      ? value * Math.exp(-speed * strength * time)
      : Math.sign(value) * Math.max(0, Math.abs(value) - speed * time);
  return Math.abs(next) < 0.0001 ? 0 : next;
}
const device = () => ({ steering: 0, throttle: 0, engaged: false, stamp: 0 });
const devices = ["touch", "keyboard", "gamepad"];
export class ControlInput {
  constructor(settings) {
    this.settings = settings;
    this.sources = { touch: device(), keyboard: device(), gamepad: device() };
    this.input = { steering: 0, throttle: 0, left: false, right: false };
    this.active = "none";
    this.clock = 0;
    this.rawSteering = 0;
    this.rawThrottle = 0;
    this.targetSteering = 0;
    this.targetThrottle = 0;
  }
  set(name, steering, throttle, engaged, intent = true) {
    const s = this.sources[name];
    s.steering = clamp(steering, -1, 1);
    s.throttle = clamp(throttle);
    s.engaged = !!engaged;
    if (intent) s.stamp = ++this.clock;
  }
  release() {
    for (const name of devices) {
      const s = this.sources[name];
      s.steering = s.throttle = 0;
      s.engaged = false;
      s.stamp = 0;
    }
    this.active = "none";
    this.rawSteering =
      this.rawThrottle =
      this.targetSteering =
      this.targetThrottle =
        0;
    this.input.steering = this.input.throttle = 0;
    this.input.left = this.input.right = false;
  }
  update(dt, speedRatio = 0) {
    const v = this.settings.values,
      priority = v.priority;
    let selected = "none",
      newest = -1;
    for (const name of devices) {
      const s = this.sources[name];
      if (!s.engaged || s.stamp === 0) continue;
      if (name === priority) {
        selected = name;
        break;
      }
      if (s.stamp > newest) {
        selected = name;
        newest = s.stamp;
      }
    }
    // Clear old filter state at handover; never add one device's throttle to another's steering.
    if (selected === "none" && this.active !== "none") selected = this.active;
    if (selected !== this.active) {
      const previous = this.sources[this.active];
      if (previous) {
        previous.steering = previous.throttle = previous.stamp = 0;
        previous.engaged = false;
      }
      this.input.steering = this.input.throttle = 0;
      this.active = selected;
    }
    const source = this.sources[selected];
    this.rawSteering = source?.steering ?? 0;
    this.rawThrottle = source?.throttle ?? 0;
    let steer = this.rawSteering,
      throttle = this.rawThrottle;
    if (selected === "touch" && this.arcadeTouch) {
      this.targetSteering = this.input.steering = steer;
      this.targetThrottle = this.input.throttle = throttle;
      this.input.left = steer < 0;
      this.input.right = steer > 0;
      return this.input;
    }
    if (selected === "touch") {
      // Only calibrate a live/non-zero axis: an idle released control must remain zero.
      if (steer !== 0) {
        const offset = steer - v.touchSteerCentre;
        steer = clamp(
          offset /
            (offset < 0 ? 1 + v.touchSteerCentre : 1 - v.touchSteerCentre),
          -1,
          1,
        );
      }
      throttle = clamp(
        (throttle - v.touchThrottleIdle) /
          (v.touchThrottleFull - v.touchThrottleIdle),
      );
    }
    if (selected === "gamepad") {
      steer = response(steer, v.padDeadzone, v.padCurve, v.padSensitivity);
      throttle = response(
        throttle,
        v.padTriggerDeadzone,
        v.padThrottleCurve,
        1,
        false,
      );
    }
    this.targetSteering =
      response(steer, v.steerDeadzone, v.steerCurve, v.steerSensitivity) *
      (1 - (v.speedSteering / 100) * clamp(speedRatio));
    this.targetThrottle = response(
      throttle,
      v.throttleDeadzone,
      v.throttleCurve,
      v.throttleSensitivity,
      false,
    );
    this.input.steering = filterInput(
      this.input.steering,
      this.targetSteering,
      v.steerSmoothing,
      v.steerRamp,
      dt,
    );
    this.input.throttle = filterInput(
      this.input.throttle,
      this.targetThrottle,
      v.throttleSmoothing,
      this.targetThrottle > this.input.throttle
        ? v.throttleRampUp
        : v.throttleRampDown,
      dt,
    );
    this.input.left = this.input.steering < -0.02;
    this.input.right = this.input.steering > 0.02;
    return this.input;
  }
  inspect() {
    return {
      device: this.active,
      rawSteering: this.rawSteering,
      steering: this.input.steering,
      rawThrottle: this.rawThrottle,
      throttle: this.input.throttle,
      targetSteering: this.targetSteering,
      targetThrottle: this.targetThrottle,
    };
  }
}
