import * as THREE from "three";
import { displayFont } from "../typography.js";
import { createArcadeWater } from "./water.js";
const waterStyleKeys = [
  "roughness",
  "metalness",
  "clearcoat",
  "clearcoatRoughness",
  "envMapIntensity",
];
export class ArcadeScenery {
  constructor(scene, world, waterMaterial) {
    this.water = createArcadeWater(scene, world, waterMaterial);
    this.waterSource = waterMaterial;
    this.world = world;
    this.matrix = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.euler = new THREE.Euler();
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#d9ac46";
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "#183237";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `34px ${displayFont}`;
    ctx.fillText("$25", 64, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cash = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.1, 1.05, 0.16),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.65,
        emissive: "#7a5526",
        emissiveIntensity: 0.3,
      }),
      world.pickups.length,
    );
    this.cash.frustumCulled = false;
    scene.add(this.cash);
    // A short gold arrow chain makes the tighter optional fork readable.
    const path = world.shortcut.path,
      shape = new THREE.BufferGeometry();
    shape.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [1.4, 0, 0, -1, 0, -0.8, -0.4, 0, 0, -1, 0, 0.8, -0.4, 0, 0, 1.4, 0, 0],
        3,
      ),
    );
    const branchArrows = Math.ceil(path.length / 20);
    this.arrows = new THREE.InstancedMesh(
      shape,
      new THREE.MeshBasicMaterial({ color: "#d9ac46", side: THREE.DoubleSide }),
      branchArrows + world.legs[0].jumpSites.length * 3,
    );
    for (let i = 0; i < branchArrows; i++) {
      const p = path.sample(i * 20);
      this.matrix.makeRotationY(-Math.atan2(p.tz, p.tx));
      this.matrix.setPosition(p.x, 0.11, p.z);
      this.arrows.setMatrixAt(i, this.matrix);
    }
    let index = branchArrows;
    for (const jump of world.legs[0].jumpSites) {
      const p = world.river.sample(jump.distance);
      this.q.setFromEuler(this.euler.set(0, -Math.atan2(p.tz, p.tx), 0.07));
      this.scale.setScalar(1.6);
      for (const fraction of [-.7, 0, .7]) {
        const side = fraction * jump.halfWidth;
        this.position.set(
          p.x - p.tx * 4 - p.tz * side,
          0.37,
          p.z - p.tz * 4 + p.tx * side,
        );
        this.matrix.compose(this.position, this.q, this.scale);
        this.arrows.setMatrixAt(index++, this.matrix);
      }
    }
    scene.add(this.arrows);
  }
  update(time, tour) {
    const source = this.waterSource,
      target = this.water.material;
    target.color.copy(source.color);
    for (const k of waterStyleKeys) target[k] = source[k];
    for (let i = 0; i < this.world.pickups.length; i++) {
      const p = this.world.pickups[i];
      this.position.set(p.x, 1.3 + Math.sin(time * 2 + i) * 0.18, p.z);
      this.q.setFromEuler(this.euler.set(0, time * 0.5 + i * 0.6, 0));
      this.scale.setScalar(tour.collected.has(p.id) ? 0 : 1);
      this.matrix.compose(this.position, this.q, this.scale);
      this.cash.setMatrixAt(i, this.matrix);
    }
    this.cash.instanceMatrix.needsUpdate = true;
  }
}
