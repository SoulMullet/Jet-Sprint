// Pointer ownership belongs to one control, never to the first/primary touch.
// This state is shared by the DOM adapter and interruption tests.
export class ArcadePointers {
  constructor() {
    this.owners = new Map();
    this.held = { left: new Set(), right: new Set(), throttle: new Set() };
  }
  press(control, id) {
    if (
      this.owners.has(id) ||
      (control === "throttle" && this.held.throttle.size)
    )
      return false;
    this.owners.set(id, control);
    this.held[control].add(id);
    return true;
  }
  owns(control, id) {
    return this.owners.get(id) === control;
  }
  release(control, id) {
    if (!this.owns(control, id)) return false;
    this.owners.delete(id);
    this.held[control].delete(id);
    return true;
  }
  clear() {
    this.owners.clear();
    for (const held of Object.values(this.held)) held.clear();
  }
}
