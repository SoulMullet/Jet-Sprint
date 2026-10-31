import * as THREE from "three";
import { riverEnvironmentData } from "./river-environment-data.js";
export class RiverEnvironment {
  constructor(scene, world) {
    this.data = riverEnvironmentData(world);
    world.debris = this.data.logs;
    for (const rock of this.data.boulders)
      if (!world.rocks.some((r) => r.id === rock.id))
        world.rocks.push({ ...rock });
    this.clock = 0;
    this.nextAt = 8;
    this.active = -1;
    this.last = -1;
    this.age = 0;
    const wood = new THREE.MeshStandardMaterial({
        color: "#66513b",
        roughness: 0.93,
      }),
      stone = new THREE.MeshStandardMaterial({
        color: "#7a8174",
        roughness: 0.9,
      }),
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0),
      p = new THREE.Vector3(),
      scale = new THREE.Vector3();
    const logs = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1, 1, 1, 8),
        wood,
        this.data.logs.length,
      ),
      ends = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 8, 5),
        wood,
        this.data.logs.length * 2,
      );
    this.data.logs.forEach((l, i) => {
      q.setFromUnitVectors(up, p.set(l.tx, 0, l.tz));
      m.compose(
        p.set(l.x, l.y ?? -0.08, l.z),
        q,
        scale.set(l.radius, l.length, l.radius),
      );
      logs.setMatrixAt(i, m);
      for (const [j, end] of [l.a, l.b].entries()) {
        m.makeScale(l.radius, l.radius, l.radius);
        m.setPosition(end.x, l.y ?? -0.08, end.z);
        ends.setMatrixAt(i * 2 + j, m);
      }
    });
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      stone,
      this.data.boulders.length,
    );
    this.data.boulders.forEach((r, i) => {
      m.makeScale(r.radius, r.radius * 0.75, r.radius);
      m.setPosition(r.x, r.radius * 0.3, r.z);
      rocks.setMatrixAt(i, m);
    });
    for (const mesh of [logs, ends, rocks]) {
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    this.seals = this.data.seals.map((site) => {
      const g = new THREE.Group(),
        skin = new THREE.MeshStandardMaterial({
          color: "#4c5f62",
          roughness: 0.4,
        }),
        eye = new THREE.MeshBasicMaterial({ color: "#10191d" }),
        ball = new THREE.SphereGeometry(1, 10, 7);
      const part = (x, y, z, sx, sy, sz, mat = skin) => {
        const mesh = new THREE.Mesh(ball, mat);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        g.add(mesh);
      };
      part(0, -0.05, 0, 0.38, 0.2, 0.72);
      part(0, 0.18, 0.44, 0.23, 0.25, 0.28);
      part(0, 0.14, 0.66, 0.16, 0.1, 0.15);
      for (const side of [-1, 1]) {
        part(side * 0.16, 0.25, 0.62, 0.035, 0.035, 0.035, eye);
        part(side * 0.4, -0.06, -0.1, 0.29, 0.045, 0.16);
      }
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.68, 28),
        new THREE.MeshBasicMaterial({
          color: "#d5e5da",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.set(site.x, 0.035, site.z);
      scene.add(g, ripple);
      g.visible = ripple.visible = false;
      return { group: g, ripple, site };
    });
  }
  update(dt, boat, { wildlife = "on", drawDistance = 160 } = {}) {
    this.clock += Math.max(0, dt);
    if (wildlife === "off") {
      for (const s of this.seals) s.group.visible = s.ripple.visible = false;
      this.active = -1;
      return;
    }
    if (this.active < 0 && this.clock >= this.nextAt) {
      for (let i = 0; i < this.seals.length; i++) {
        const p = this.seals[i].site;
        if (i !== this.last && Math.hypot(p.x - boat.x, p.z - boat.z) < 85) {
          this.active = i;
          this.last = i;
          this.age = 0;
          break;
        }
      }
    }
    if (this.active < 0) return;
    this.age += Math.max(0, dt);
    const s = this.seals[this.active],
      visible = Math.hypot(s.site.x - boat.x, s.site.z - boat.z) < drawDistance,
      fade = Math.min(1, this.age, Math.max(0, 6 - this.age));
    s.group.visible = s.ripple.visible = visible;
    s.group.position.set(
      s.site.x,
      -0.65 +
        fade * fade * (3 - 2 * fade) * 0.72 +
        Math.sin(this.clock * 1.8) * 0.025,
      s.site.z,
    );
    s.group.rotation.y = Math.sin(this.age * 0.8) * 0.3;
    s.ripple.material.opacity = 0.15 * fade;
    s.ripple.scale.setScalar(1 + this.age * 0.13);
    if (this.age >= 6) {
      s.group.visible = s.ripple.visible = false;
      this.active = -1;
      this.nextAt = this.clock + 35;
    }
  }
  inspect() {
    return {
      version: this.data.version,
      logs: this.data.logs.length,
      boulders: this.data.boulders.length,
      seals: this.seals.length,
      active: this.active,
      age: this.age,
    };
  }
}
