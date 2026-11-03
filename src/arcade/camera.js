import * as THREE from "three";
const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// Rendering only. No writes to boat, contact, course or ordinary camera presets.
export class ArcadeCamera {
  constructor(camera, tuning, obstruction = () => 1) {
    this.camera = camera;
    this.tuning = tuning;
    this.obstruction = obstruction;
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.sample = {};
    this.next = {};
    this.reset();
  }
  reset() {
    this.ready = false;
    this.heading = 0;
  }
  resize(w, h) {
    this.camera.aspect = Math.max(0.1, w / Math.max(1, h));
    this.camera.updateProjectionMatrix();
  }
  update(b, model, tour, dt) {
    const s = this.tuning.values,
      speed = Math.hypot(b.vx, b.vz),
      ratio = Math.min(1, speed / (s.cruiseSpeed * 0.44704)),
      path = tour.level.route;
    const branch = tour.world.shortcut,
      p = path.project(
        b,
        Math.max(0, tour.routeDistance - 60),
        Math.min(path.length, tour.routeDistance + 100),
        this.sample,
      );
    let route = path,
      d = p.distance;
    if (d > branch.start && d < branch.end) {
      const q = branch.path.project(b, 0, branch.path.length, this.next);
      if (q.error < 11) {
        route = branch.path;
        d = q.distance;
      }
    }
    const ahead = route.sample(
        Math.min(route.length, d + 22 + speed * 0.3),
        this.next,
      ),
      routeHeading = Math.atan2(ahead.z - b.z, ahead.x - b.x);
    const wanted = b.angle + delta(routeHeading, b.angle) * s.anticipation;
    if (!this.ready) this.heading = wanted;
    else
      this.heading += Math.max(
        -1.7 * dt,
        Math.min(
          1.7 * dt,
          delta(wanted, this.heading) * (1 - Math.exp(-dt * 5)),
        ),
      );
    const fx = Math.cos(this.heading),
      fz = Math.sin(this.heading),
      distance = s.distance * (1 + ratio * s.pullback),
      look = 9 + speed * 0.25;
    this.focus.set(b.x + fx * look, 1.0 + tour.height * 0.65, b.z + fz * look);
    this.desired.set(
      b.x - fx * distance,
      s.height + tour.height * 0.6,
      b.z - fz * distance,
    );
    const clearance = this.obstruction(this.focus, this.desired);
    if (clearance < 1) {
      this.desired.lerpVectors(
        this.focus,
        this.desired,
        Math.max(0.55, clearance),
      );
      this.desired.y = Math.max(s.height, this.desired.y);
    }
    if (!this.ready) {
      this.position.copy(this.desired);
      this.target.copy(this.focus);
      this.ready = true;
    } else {
      const a = 1 - Math.exp(-dt * s.smoothing);
      this.position.lerp(this.desired, a);
      this.target.lerp(this.focus, a);
    }
    const c = this.camera;
    c.position.copy(this.position);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    c.fov = s.fov + ratio * 3;
    c.near = 0.5;
    c.far = 6000;
    c.layers.enable(1);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    return c;
  }
}
