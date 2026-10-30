import * as THREE from "three";
const rad = THREE.MathUtils.degToRad,
  clamp = THREE.MathUtils.clamp;
const delta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const cameraStates = {
  flat: "FLAT_TRACK_FIXED",
  sweep: "RIVER_TRANSITION",
  river: "RIVER_FOLLOW",
};
export const easeCamera = (t, kind) =>
  kind === "cosine"
    ? (1 - Math.cos(Math.PI * t)) / 2
    : kind === "smooth"
      ? t * t * (3 - 2 * t)
      : t * t * t * (t * (t * 6 - 15) + 10);
/** Rendering-only authority. No controller, boat or progression mutation. Y is up. */
export class CampaignCameras {
  constructor(perspective, legacy, store, world, obstruction = () => 1) {
    Object.assign(this, { perspective, legacy, store, world, obstruction });
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 6000);
    this.ortho.layers.enable(1);
    perspective.layers.enable(1);
    this.target = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.flatTarget = new THREE.Vector3();
    this.flatPosition = new THREE.Vector3();
    this.followTarget = new THREE.Vector3();
    this.followPosition = new THREE.Vector3();
    this.sourcePosition = new THREE.Vector3();
    this.sourceTarget = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.corner = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.q = new THREE.Quaternion();
    this.matrix = new THREE.Matrix4();
    this.orthoProjection = new THREE.Matrix4();
    this.perspProjection = new THREE.Matrix4();
    this.sourceProjection = new THREE.Matrix4();
    this.projectionPoint = new THREE.Vector3();
    this.aspect = 1;
    this.width = 1;
    this.height = 1;
    this.ready = false;
    this.debug = false;
    this.camera = perspective;
    this.state = cameraStates.flat;
    this.transitionCount = 0;
    this.elapsed = 0;
    this.preview = false;
    this.previewHold = 0;
    this.sample = {};
    this.heading = 0;
    this.roll = 0;
    this.followReady = false;
    this.overviewCenter = legacy.overviewCenter;
  }
  resize(w, h) {
    this.width = w;
    this.height = h;
    this.aspect = Math.max(0.1, w / Math.max(1, h));
    this.legacy.resize(w, h);
    this.flatKey = "";
  }
  reset() {
    this.ready = false;
    this.followReady = false;
    this.preview = false;
    this.debug = false;
    this.legacy.reset();
  }
  fit(course) {
    const p = this.store.values.flat;
    if (
      this.fitCourse === course.id &&
      this.fitAspect === this.aspect &&
      this.fitRevision === this.store.revision
    )
      return;
    this.fitCourse = course.id;
    this.fitAspect = this.aspect;
    this.fitRevision = this.store.revision;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const q of course.points) {
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minZ = Math.min(minZ, q.z);
      maxZ = Math.max(maxZ, q.z);
    }
    const margin = (course.waterWidth ?? 9) + 4;
    minX -= margin;
    maxX += margin;
    minZ -= margin;
    maxZ += margin;
    this.bounds = { minX, maxX, minZ, maxZ };
    this.flatTarget.set(
      (minX + maxX) / 2 + p.offsetX,
      p.targetHeight,
      (minZ + maxZ) / 2 + p.offsetY,
    );
    const yaw = rad(p.yaw),
      pitch = rad(p.pitch);
    this.v.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    this.matrix.lookAt(this.v, new THREE.Vector3(), this.up); // Only when fitting/settings change.
    const right = new THREE.Vector3().setFromMatrixColumn(this.matrix, 0),
      up = new THREE.Vector3().setFromMatrixColumn(this.matrix, 1);
    let distance = 0,
      halfHeight = 0;
    const tan = Math.tan(rad(p.fov / 2));
    for (const x of [minX, maxX])
      for (const z of [minZ, maxZ])
        for (const y of [0, 5]) {
          this.corner.set(x, y, z).sub(this.flatTarget);
          const cx = Math.abs(this.corner.dot(right)) * p.padding,
            cy = Math.abs(this.corner.dot(up)) * p.padding,
            depth = this.corner.dot(this.v);
          distance = Math.max(
            distance,
            depth + cy / tan,
            depth + cx / (tan * this.aspect),
          );
          halfHeight = Math.max(halfHeight, cy, cx / this.aspect);
        }
    this.fitDistance = Math.max(p.distance, distance);
    this.flatPosition
      .copy(this.flatTarget)
      .addScaledVector(this.v, this.fitDistance);
    this.halfHeight = halfHeight * p.scale;
    this.ortho.left = -this.halfHeight * this.aspect;
    this.ortho.right = -this.ortho.left;
    this.ortho.top = this.halfHeight;
    this.ortho.bottom = -this.halfHeight;
    this.ortho.updateProjectionMatrix();
  }
  follow(b, dt, path) {
    const p = this.store.values.river,
      speed = Math.hypot(b.vx, b.vz);
    let heading = b.angle,
      ax = Math.cos(heading),
      az = Math.sin(heading);
    if (path) {
      const q = path.project(b, 0, path.length, this.sample),
        d = q.distance;
      const next = path.sample(
        Math.min(path.length, d + p.lookAhead + 16),
        this.sample,
      );
      heading += delta(Math.atan2(next.tz, next.tx), heading) * p.anticipation;
      ax = next.x - b.x;
      az = next.z - b.z;
      const l = Math.hypot(ax, az) || 1;
      ax /= l;
      az /= l;
    }
    if (!this.followReady) {
      this.heading = heading;
      this.followReady = true;
    }
    this.heading += clamp(
      delta(heading, this.heading) * (1 - Math.exp(-dt / p.rotationLag)),
      -1.5 * dt,
      1.5 * dt,
    );
    const a = this.heading + rad(p.yaw),
      zoom = 1 + (p.speedZoom ? p.speedIntensity * Math.min(1, speed / 24) : 0),
      height = (p.height * Math.tan(rad(p.pitch))) / Math.tan(rad(58));
    this.v.set(b.x + ax * p.lookAhead, p.targetHeight, b.z + az * p.lookAhead);
    this.corner.set(
      b.x - Math.cos(a) * p.distance * zoom,
      height * zoom,
      b.z - Math.sin(a) * p.distance * zoom,
    );
    // Query only the live boom, at a bounded rate, through existing scenery collision.
    this.queryClock = (this.queryClock ?? 1) + dt;
    if (this.queryClock > 0.12) {
      this.queryClock = 0;
      this.boom = this.obstruction(this.v, this.corner);
    }
    if (this.boom < 1) {
      this.corner.lerpVectors(this.v, this.corner, Math.max(0.3, this.boom));
      this.corner.y = Math.max(14, this.corner.y);
    }
    const k = this.ready ? 1 - Math.exp(-dt / p.lag) : 1;
    this.followTarget.lerp(this.v, k);
    this.followPosition.lerp(this.corner, k);
    const roll = clamp(delta(heading, b.angle), -0.7, 0.7) * p.bank;
    this.roll += (roll - this.roll) * (1 - Math.exp(-dt / p.bankLag));
  }
  startSweep(toRiver, preview = false) {
    this.sourcePosition.copy(this.camera.position);
    this.sourceTarget.copy(this.target);
    this.sourceFov = this.camera.isPerspectiveCamera
      ? this.camera.fov
      : this.store.values.flat.fov;
    this.fromOrtho = this.camera === this.ortho;
    this.sourceProjection.copy(this.camera.projectionMatrix);
    this.state = cameraStates.sweep;
    this.elapsed = 0;
    this.toRiver = toRiver;
    this.preview = preview;
    this.transitionCount++;
    this.debug = false;
  }
  testTransition() {
    this.testRequested = true;
  }
  skip() {
    if (this.state === cameraStates.sweep) {
      this.elapsed = this.store.values.transition.duration;
      this.skipRequested = true;
    }
  }
  update(b, model, ahead, dt, frame = {}) {
    dt = clamp(dt, 0, 0.25);
    const tour = frame.tour,
      course = tour.venue;
    this.store.use(course.id);
    this.fit(course);
    if (this.debug || frame.overview) {
      this.camera = this.legacy.update(b, model, ahead, dt, frame);
      this.target.copy(this.legacy.target);
      return this.camera;
    }
    const river = tour.phase === "RIVER",
      p = this.store.values,
      changed = this.course !== course.id;
    this.follow(b, dt, tour.leaf?.world.river);
    if (!this.ready) {
      this.state = river ? cameraStates.river : cameraStates.flat;
      this.ready = true;
      this.target.copy(river ? this.followTarget : this.flatTarget);
      this.position.copy(river ? this.followPosition : this.flatPosition);
    } else if (changed) {
      this.startSweep(false);
    } else if (river && !this.wasRiver && !this.preview) this.startSweep(true);
    else if (!river && this.wasRiver && !this.preview) this.startSweep(false);
    this.course = course.id;
    this.wasRiver = river;
    if (this.testRequested) {
      this.testRequested = false;
      this.startSweep(true, true);
    }
    if (this.previewHold > 0) {
      this.previewHold -= dt;
      if (this.previewHold <= 0) {
        if (!river) this.startSweep(false, true);
        else this.preview = false;
      }
    }
    let fov = p.flat.fov,
      ortho = false,
      roll = 0,
      projectionMix = null;
    if (this.state === cameraStates.sweep) {
      this.elapsed += dt;
      const u = clamp(this.elapsed / p.transition.duration, 0, 1),
        t = easeCamera(u, p.transition.easing),
        destination = this.toRiver ? this.followPosition : this.flatPosition,
        target = this.toRiver ? this.followTarget : this.flatTarget;
      this.position.lerpVectors(this.sourcePosition, destination, t);
      this.v.subVectors(destination, this.sourcePosition);
      this.v.y = 0;
      this.v.set(-this.v.z, 0, this.v.x);
      if (this.v.lengthSq() > 0) this.v.normalize();
      this.position.addScaledVector(
        this.v,
        Math.sin(Math.PI * t) * p.transition.arc * 35,
      );
      this.position.y += Math.sin(Math.PI * t) * p.transition.height;
      const rotation =
        1 -
        Math.pow(
          1 - t,
          1 + (1 - p.transition.rotation) * 3 + p.transition.focus * 2,
        );
      const takeover = easeCamera(
        clamp(
          (u - p.transition.takeover) /
            Math.max(0.1, 1 - p.transition.takeover),
          0,
          1,
        ),
        p.transition.easing,
      );
      this.corner.set(b.x, p.river.targetHeight, b.z).lerp(target, takeover);
      this.target.lerpVectors(
        this.sourceTarget,
        this.toRiver ? this.corner : target,
        rotation,
      );
      const z = easeCamera(
        clamp(u / p.transition.zoom, 0, 1),
        p.transition.easing,
      );
      fov = THREE.MathUtils.lerp(
        this.sourceFov,
        this.toRiver ? 55 : p.flat.fov,
        z,
      );
      if (
        this.fromOrtho ||
        (!this.toRiver && p.flat.projection === "orthographic")
      )
        projectionMix = this.fromOrtho ? 1 - t : t;
      if (u >= 1 || this.skipRequested) {
        this.skipRequested = false;
        this.state = this.toRiver ? cameraStates.river : cameraStates.flat;
        if (this.preview) {
          if (this.toRiver) this.previewHold = 1;
          else this.preview = false;
        }
      }
    } else if (this.state === cameraStates.river) {
      this.target.copy(this.followTarget);
      this.position.copy(this.followPosition);
      fov = 55;
      roll = this.roll;
    } else {
      this.target.copy(this.flatTarget);
      this.position.copy(this.flatPosition);
      ortho = p.flat.projection === "orthographic";
    }
    const camera = (this.camera = ortho ? this.ortho : this.perspective);
    camera.layers.enable(1);
    camera.position.copy(this.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.target);
    if (roll) {
      this.q.setFromAxisAngle(this.up.set(0, 0, 1), roll);
      camera.quaternion.multiply(this.q);
      this.up.set(0, 1, 0);
    }
    if (!ortho) {
      camera.near = 0.5;
      camera.far = 6000;
      camera.aspect = this.aspect;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      if (projectionMix !== null) {
        // Homogeneous projection blend: both matrices have w=1 on the focus plane.
        // This smoothly morphs a true orthographic endpoint without a type-switch cut.
        const d = Math.max(1, camera.position.distanceTo(this.target));
        this.perspProjection
          .copy(camera.projectionMatrix)
          .multiplyScalar(1 / d);
        const a = this.perspProjection.elements,
          o = this.ortho.projectionMatrix.elements,
          e = camera.projectionMatrix.elements;
        for (let i = 0; i < 16; i++)
          e[i] = THREE.MathUtils.lerp(a[i], o[i], projectionMix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
    }
    camera.updateMatrixWorld();
    this.projectionPoint.set(b.x, model.position.y, b.z).project(camera);
    this.boatPixels = Math.abs(
      (this.height * 5.2) /
        (ortho
          ? 2 * this.halfHeight
          : 2 *
            Math.tan(rad(fov / 2)) *
            camera.position.distanceTo(model.position)),
    );
    this.warning =
      this.boatPixels < 9
        ? "Boat below 9 px: use the visibility marker or reduce course padding."
        : "";
    return camera;
  }
  inspect() {
    return {
      state: this.state,
      course: this.course,
      transitionCount: this.transitionCount,
      transitionTime: this.elapsed,
      preview: this.preview,
      legacyComparison: this.debug,
      boatPixels: this.boatPixels,
      warning: this.warning,
      fitDistance: this.fitDistance,
      projection: this.camera === this.ortho ? "orthographic" : "perspective",
      position: this.camera.position.toArray(),
      target: this.target.toArray(),
    };
  }
}
