import { clamp } from "./control-input.js";
/** Standard Gamepad layout, exported so additional profiles can extend it. LT intentionally unmapped: no reverse/brake physics exists. */
export const gamepadMapping = Object.freeze({
  steeringAxis: 0,
  throttleButton: 7,
  confirm: 0,
  pause: 9,
  view: 8,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  back: 1,
});
const actions = [
  "confirm",
  "pause",
  "view",
  "up",
  "down",
  "left",
  "right",
  "back",
];
const repeating = new Set(["up", "down", "left", "right"]);
export function buttonValue(button) {
  return clamp(
    typeof button === "number"
      ? button
      : Number.isFinite(button?.value)
        ? button.value
        : button?.pressed
          ? 1
          : 0,
  );
}
export function readGamepad(pad, settings, out) {
  out.supported = settings.padMapping !== "auto" || pad.mapping === "standard";
  out.steering = out.supported
    ? clamp(pad.axes?.[gamepadMapping.steeringAxis], -1, 1)
    : 0;
  if (!out.supported) out.throttle = 0;
  else if (settings.padMapping === "axis-triggers") {
    const axis = pad.axes?.[settings.padRightAxis];
    out.throttle = Number.isFinite(axis)
      ? clamp(settings.padTriggerRest === "negative" ? (axis + 1) * 0.5 : axis)
      : 0;
  } else
    out.throttle = buttonValue(pad.buttons?.[gamepadMapping.throttleButton]);
  return out;
}
export class GamepadSource {
  constructor(settings, { onAction = () => {}, onLost = () => {} } = {}) {
    this.settings = settings;
    this.onAction = onAction;
    this.onLost = onLost;
    this.state = {
      steering: 0,
      throttle: 0,
      supported: false,
      engaged: false,
      intent: false,
    };
    this.connected = false;
    this.id = "";
    this.index = -1;
    this.armed = false;
    this.available = true;
    this.rawSteering = this.rawThrottle = 0;
    this.previous = new Float64Array(17);
    this.repeat = new Float64Array(17);
    this.time = 0;
  }
  release() {
    this.armed = false;
    this.state.steering = this.state.throttle = 0;
    this.rawSteering = this.rawThrottle = 0;
    this.state.engaged = this.state.intent = false;
    this.previous.fill(1);
    this.repeat.fill(0);
  }
  poll(pads, dt, enabled = true, driving = true) {
    this.time += dt;
    const oldSteer = this.state.steering,
      oldThrottle = this.state.throttle;
    let pad = this.index >= 0 ? pads?.[this.index] : null;
    if (!pad || pad.connected === false || pad.id !== this.id) {
      if (this.connected) {
        this.connected = false;
        this.release();
        this.onLost();
      }
      pad = null;
      for (let i = 0; i < (pads?.length ?? 0); i++)
        if (pads[i]?.connected !== false && pads[i]) {
          pad = pads[i];
          break;
        }
      if (pad) {
        this.connected = true;
        this.index = pad.index;
        this.id = pad.id;
        this.release();
      } else {
        this.index = -1;
        this.id = "";
        return this.state;
      }
    }
    readGamepad(pad, this.settings.values, this.state);
    this.rawSteering = this.state.steering;
    this.rawThrottle = this.state.throttle;
    const v = this.settings.values,
      neutral =
        Math.abs(this.state.steering) <= v.padDeadzone &&
        this.state.throttle <= v.padTriggerDeadzone;
    if (!enabled || !driving) this.armed = false;
    else if (!this.armed && neutral) this.armed = true;
    const buttons = pad.buttons;
    for (const action of actions) {
      const i = gamepadMapping[action],
        down = buttonValue(buttons?.[i]) > 0.5;
      if (
        enabled &&
        down &&
        (!this.previous[i] ||
          (repeating.has(action) && this.time >= this.repeat[i]))
      ) {
        this.onAction(action);
        this.repeat[i] = this.time + (this.previous[i] ? 0.13 : 0.4);
      }
      this.previous[i] = Number(down);
    }
    if (!enabled || !driving || !this.armed) {
      this.state.steering = this.state.throttle = 0;
    }
    this.state.engaged = enabled && this.armed && !neutral;
    this.state.intent =
      this.state.engaged &&
      (Math.abs(oldSteer - this.state.steering) > 0.012 ||
        Math.abs(oldThrottle - this.state.throttle) > 0.012);
    return this.state;
  }
  haptic() {
    if (!this.settings.values.haptics) return;
    try {
      const pad = navigator.getGamepads?.()[this.index],
        actuator = pad?.vibrationActuator;
      actuator
        ?.playEffect?.("dual-rumble", {
          duration: 25,
          strongMagnitude: 0.08,
          weakMagnitude: 0.14,
        })
        ?.catch?.(() => {});
    } catch {
      /* Optional capability. */
    }
  }
  inspect() {
    return {
      connected: this.connected,
      id: this.id,
      index: this.index,
      supported: this.state.supported,
      armed: this.armed,
      apiAvailable: this.available,
      rawSteering: this.rawSteering,
      rawThrottle: this.rawThrottle,
    };
  }
}
