import * as THREE from "three";
import { CampaignCameras } from "../racing-camera-manager.js";
import { RacingCameraSettings } from "../racing-camera-settings.js";
export function suspendVisuals(objects) {
  const previous = objects.map((object) => [object, object.visible]);
  for (const [object] of previous) object.visible = false;
  return () => {
    for (const [object, visible] of previous) object.visible = visible;
  };
}
export class GhostVisual {
  constructor(scene, original) {
    this.model = original.clone(true);
    this.model.name = "Recorded ghost / visual only";
    this.model.userData = { replayVisual: true };
    this.material = new THREE.MeshBasicMaterial({
      color: "#4dcbbb",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      toneMapped: false,
    });
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.material = this.material;
        o.castShadow = false;
        o.receiveShadow = false;
        o.layers.set(0);
        o.raycast = () => {};
      }
    });
    this.model.visible = false;
    scene.add(this.model);
  }
  update(pose, settings, viewer = false) {
    this.model.visible = !!pose;
    if (!pose) return;
    this.model.position.set(pose.x, pose.y, pose.z);
    this.model.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
    this.material.opacity = viewer ? 0.9 : settings.opacity;
    this.material.color.set(settings.color);
  }
}
/** Separate instance of the existing cameras; cannot change live camera tuning/state. */
export class ReplayCameras {
  constructor(world, cameraSettings, obstruction) {
    this.world = world;
    this.source = cameraSettings;
    this.obstruction = obstruction;
    this.mode = "fixed";
    this.b = { x: 0, z: 0, vx: 0, vz: 0, angle: 0 };
    this.clip = new THREE.Matrix4();
  }
  load(replay) {
    this.replay = replay;
    const c = replay.meta.course,
      index = c.index,
      path =
        c.kind === "race"
          ? this.world.courses[index]
          : this.world.legs[index].river,
      definition =
        c.kind === "race"
          ? this.world.definition.tracks[index]
          : this.world.definition.rivers[index];
    const store = new RacingCameraSettings({
      getItem: () => this.source.export(),
      setItem() {},
    });
    store.use(
      c.kind === "race" || this.world.riverRunLevels?.some((l) => l.id === c.id)
        ? c.id
        : this.world.courses[index].id,
    );
    store.autoFit();
    const legacy = { overviewCenter: { x: 0, z: 0 }, resize() {}, reset() {} };
    this.manager = new CampaignCameras(
      new THREE.PerspectiveCamera(43, 1, 0.5, 6000),
      legacy,
      store,
      this.world,
      this.obstruction,
    );
    this.localPoints = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ];
    this.tour = {
      venue: { ...path, id: c.id, waterWidth: definition.waterWidth },
      phase: "RACE",
      leaf: c.kind === "river" ? { world: this.world.legs[index] } : null,
    };
    this.mode = c.kind === "river" ? "follow" : "fixed";
    this.size = "";
  }
  reset() {
    this.manager?.reset();
  }
  setMode(mode) {
    this.mode = mode;
    this.reset();
  }
  update(
    pose,
    model,
    dt,
    width,
    height,
    frame = { left: 0, top: 0, right: width, bottom: height },
  ) {
    const w = Math.max(80, frame.right - frame.left),
      h = Math.max(60, frame.bottom - frame.top),
      key = w + ":" + h;
    if (this.size !== key) {
      this.size = key;
      this.manager.resize(w, h);
    }
    Object.assign(this.b, {
      x: pose.x,
      z: pose.z,
      vx: pose.vx,
      vz: pose.vz,
      angle: pose.heading,
    });
    this.tour.phase = this.mode === "follow" ? "RIVER" : "RACE";
    if (this.replay.meta.course.kind === "river") {
      for (let i = 0; i < 4; i++) {
        this.localPoints[i].x = pose.x + (i < 2 ? -70 : 70);
        this.localPoints[i].z = pose.z + (i % 2 ? -70 : 70);
      }
      this.tour.venue.points = this.localPoints;
      this.manager.fitRevision = -1;
    }
    const camera = this.manager.update(this.b, model, this.b, dt, {
      playing: true,
      top: this.replay.meta.tuning.top || 85,
      tour: this.tour,
    });
    // Map the existing projection into the clear area between tape-deck panels.
    // Both projections keep the recorded boat/course clear of transport controls.
    this.clip.set(
      w / width,
      0,
      0,
      (frame.left + frame.right) / width - 1,
      0,
      h / height,
      0,
      1 - (frame.top + frame.bottom) / height,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    );
    camera.updateProjectionMatrix();
    camera.projectionMatrix.premultiply(this.clip);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return camera;
  }
  get target() {
    return this.manager.target;
  }
}
