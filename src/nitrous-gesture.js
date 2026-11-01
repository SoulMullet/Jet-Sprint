// Pure captured-pointer gesture; no extra boost hit target or velocity changes.
export class NitrousGesture {
  constructor() {
    this.clear();
  }
  clear() {
    this.throttle = 0;
    this.nitrous = false;
  }
  move(
    y,
    rect,
    { installed = false, fill = 0, activation = 28, hysteresis = 12 } = {},
  ) {
    hysteresis=Math.min(hysteresis,Math.max(2,activation-4));
    const full = rect.top + 12,
      bottom = rect.bottom - 8;
    this.throttle = Math.max(
      0,
      Math.min(1, (bottom - y) / Math.max(1, bottom - full)),
    );
    if (!installed || fill <= 0) this.nitrous = false;
    else if (this.nitrous) this.nitrous = y < full - activation + hysteresis;
    else this.nitrous = y <= full - activation;
    if (this.nitrous) this.throttle = 1;
    return this;
  }
}
