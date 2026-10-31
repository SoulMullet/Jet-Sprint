import * as THREE from "three";
import { CampaignScenery } from "./campaign-scenery.js";
export class TourPresentation {
  constructor(scene, world, stream) {
    this.world = world;
    this.stream = stream;
    this.legs = world.legs.map((l) => new CampaignScenery(scene, l));
    const dark = new THREE.MeshStandardMaterial({ color: "#183237" }),
      cream = new THREE.MeshStandardMaterial({ color: "#e8d9b5" }),
      gold = new THREE.MeshStandardMaterial({ color: "#d9ac46" });
    for (const course of world.courses.slice(1)) {
      const p = course.sample(0),
        group = new THREE.Group();
      group.position.set(p.x, 0.035, p.z);
      group.rotation.y = -Math.atan2(p.tz, p.tx);
      scene.add(group);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 16; j++) {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 0.025, 1),
            (i + j) % 2 ? cream : dark,
          );
          m.position.set((i - 0.5) * 0.65, 0, j - 7.5);
          group.add(m);
        }
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.2, 3.5, 8),
          gold,
        );
        pole.position.set(0, 1.8, side * (course.gates[0].halfWidth + 2));
        group.add(pole);
      }
    }
    const markerGeometry = new THREE.CylinderGeometry(0.21, 0.29, 0.65, 6),
      markerMatrix = new THREE.Matrix4(),
      markerColor = new THREE.Color();
    for (const course of world.courses.slice(1)) {
      const positions = [],
        width = world.definition.tracks.find(
          (t) => t.id === course.id,
        ).waterWidth;
      for (let d = 0; d < course.length; d += 16) {
        const p = course.sample(d);
        for (const side of [-1, 1]) {
          const x = p.x - p.tz * side * (width + 0.7),
            z = p.z + p.tx * side * (width + 0.7),
            n = world.nearest(x, z);
          if (Math.hypot(x - n.x, z - n.z) > (n.waterWidth ?? width) + 0.35)
            positions.push({ x, z });
        }
      }
      const markers = new THREE.InstancedMesh(
        markerGeometry,
        gold,
        positions.length,
      );
      positions.forEach((p, i) => {
        markerMatrix.makeTranslation(p.x, 0.3, p.z);
        markers.setMatrixAt(i, markerMatrix);
        markers.setColorAt(i, markerColor.set(i % 2 ? "#e8d9b5" : "#d9ac46"));
      });
      markers.computeBoundingSphere();
      scene.add(markers);
    }
    // Physical obstacles are always present visually, independent of decorative jobs.
    const rocks = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: "#767d78", roughness: 0.78 }),
        world.rocks.length,
      ),
      matrix = new THREE.Matrix4();
    world.rocks.forEach((r, i) => {
      matrix.makeScale(r.radius, r.radius * 0.8, r.radius);
      matrix.setPosition(r.x, r.radius * 0.38, r.z);
      rocks.setMatrixAt(i, matrix);
    });
    rocks.castShadow = rocks.receiveShadow = true;
    rocks.computeBoundingSphere();
    scene.add(rocks);
    // Procedural foam streaks/standing crests occupy only the nearby river section.
    this.foam = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: "#e0e8cd",
        transparent: true,
        opacity: 0.025,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      48,
    );
    this.foam.frustumCulled = false;
    scene.add(this.foam);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.euler = new THREE.Euler();
    this.sample = {};
  }
  update(dt, tour, boat, time) {
    this.stream.update(dt, boat, tour);
    for (let i = 0; i < this.legs.length; i++) {
      const leaf = tour.leaves[i];
      this.legs[i].update(dt, leaf, boat, time);
      this.legs[i].flow.visible =
        i === tour.index && ["EXIT", "RIVER"].includes(tour.phase);
    }
    const leg = this.world.legs.find(
      (l) => l.river.id === this.world.nearest(boat.x, boat.z).segmentId,
    );
    this.foam.visible = !!leg;
    if (!leg) return;
    const distance = leg.river.project(
        boat,
        0,
        leg.river.length,
        this.sample,
      ).distance,
      strength = leg.riverDefinition.rapids.strength;
    for (let i = 0; i < this.foam.count; i++) {
      const d = Math.max(
          0,
          Math.min(
            leg.river.length,
            distance -
              90 +
              i * 4 -
              ((time * leg.riverDefinition.current * 1.8) % 4),
          ),
        ),
        p = leg.river.sample(d, this.sample),
        offset =
          Math.sin(i * 2.399 + Math.floor(d / 4) * 1.2) *
          (leg.riverDefinition.waterWidth - 2);
      this.position.set(
        p.x - p.tz * offset,
        0.09 + strength * 0.1 * Math.sin(d * 0.3 - time * 2),
        p.z + p.tx * offset,
      );
      this.q.setFromEuler(
        this.euler.set(-Math.PI / 2, 0, -Math.atan2(p.tz, p.tx)),
      );
      this.scale.set(0.5 + strength * 0.6, 1 + strength * 2, 1);
      this.matrix.compose(this.position, this.q, this.scale);
      this.foam.setMatrixAt(i, this.matrix);
    }
    this.foam.instanceMatrix.needsUpdate = true;
  }
  inspect() {
    return this.stream.inspect();
  }
}
