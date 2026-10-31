import { riverJumpSites } from "./river-jumps.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { displayFont, interfaceFont, repaintAfterFonts } from "./typography.js";

export class CampaignScenery {
  constructor(scene, world) {
    const river1 = (this.river = world.riverDefinition);
    const destination = world.destinationDefinition,
      skin = (this.skin = destination.presentation);
    this.scene = scene;
    this.world = world;
    this.clock = 0;
    this.prepared = 0;
    this.status = "queued";
    this.maxJobMs = 0;
    this.matrix = new THREE.Matrix4();
    this.rotation = new THREE.Quaternion();
    this.axis = new THREE.Vector3(0, 1, 0);
    this.point = new THREE.Vector3();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.sample = {};
    this.color = new THREE.Color();
    this.materials = {
      cream: new THREE.MeshStandardMaterial({
        color: "#eedbb2",
        roughness: 0.8,
      }),
      teal: new THREE.MeshStandardMaterial({ color: "#427d78" }),
      wood: new THREE.MeshStandardMaterial({ color: "#a37b49" }),
      gold: new THREE.MeshStandardMaterial({ color: "#caa04d" }),
      stone: new THREE.MeshStandardMaterial({ color: "#877d63" }),
    };
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.pole = new THREE.CylinderGeometry(0.14, 0.18, 2.2, 7);
    const gate = world.gate;
    this.gate = new THREE.Group();
    this.gate.position.set(gate.x, 0.15, gate.z);
    this.gate.rotation.y = -Math.atan2(gate.tz, gate.tx);
    scene.add(this.gate);
    this.arms = [];
    for (const side of [-1, 1]) {
      this.mesh(
        this.pole,
        this.materials.wood,
        0,
        0.7,
        side * river1.waterWidth,
        1,
        1,
        1,
        this.gate,
      );
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.1, side * river1.waterWidth);
      this.gate.add(pivot);
      this.mesh(
        this.box,
        this.materials.cream,
        0,
        0,
        (-side * river1.waterWidth) / 2,
        0.32,
        0.42,
        river1.waterWidth,
        pivot,
      );
      this.mesh(
        this.box,
        this.materials.gold,
        0.18,
        0,
        (-side * river1.waterWidth) / 2,
        0.04,
        0.12,
        river1.waterWidth,
        pivot,
      );
      this.arms.push(pivot);
    }
    this.lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: "#b75449" }),
    );
    this.lamp.position.set(0, 2, river1.waterWidth);
    this.gate.add(this.lamp);
    this.sign(
      "RIVER EXIT",
      "THREE LAPS TO OPEN",
      gate.x - gate.tz * 9,
      3,
      gate.z + gate.tx * 9,
      -Math.atan2(gate.tz, gate.tx) + Math.PI / 2,
      4.4,
    );
    const n = world.checkpoints.length * 2;
    this.posts = new THREE.InstancedMesh(this.pole, this.materials.teal, n);
    this.flags = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.1, 0.55, 0.07),
      this.materials.cream,
      n,
    );
    for (const [i, g] of world.checkpoints.entries())
      for (const [j, side] of [-1, 1].entries()) {
        const x = g.x - g.tz * side * (river1.waterWidth - 0.55),
          z = g.z + g.tx * side * (river1.waterWidth - 0.55),
          k = i * 2 + j;
        this.place(this.posts, k, x, 0.7, z, 0);
        this.place(this.flags, k, x, 1.75, z, -Math.atan2(g.tz, g.tx));
        this.flags.setColorAt(k, this.color.set("#c5b997"));
      }
    scene.add(this.posts, this.flags);
    this.lastCheckpoint = -1;
    for (const j of riverJumpSites(world)) {
      const p = world.river.sample(j.distance),
        x = p.x - p.tz * j.side * j.offset,
        z = p.z + p.tx * j.side * j.offset;
      const ramp = new THREE.Group();
      ramp.position.set(x, 0.04, z);
      ramp.rotation.y = -Math.atan2(p.tz, p.tx);
      scene.add(ramp);
      // A small side ramp leaves the central channel unobstructed.
      const deck = this.mesh(
        this.box,
        this.materials.wood,
        -1,
        0.16,
        0,
        3,
        0.12,
        j.halfWidth * 2,
        ramp,
      );
      deck.rotation.z = 0.14;
      for (const side of [-1, 1])
        this.mesh(
          this.box,
          this.materials.gold,
          -1,
          0.26,
          side * j.halfWidth,
          3,
          0.07,
          0.08,
          ramp,
        ).rotation.z = 0.14;
      this.sign(
        "OPTIONAL JUMP",
        "CENTRE CHANNEL = BYPASS",
        p.x - p.tz * j.side * (river1.waterWidth + 2),
        2.4,
        p.z + p.tx * j.side * (river1.waterWidth + 2),
        -Math.atan2(p.tz, p.tx) + Math.PI / 2,
        3,
      );
    }
    const arrow = new THREE.BufferGeometry();
    arrow.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0.7, 0, 0, -0.3, 0, -0.27, -0.3, 0, 0.27],
        3,
      ),
    );
    this.flow = new THREE.InstancedMesh(
      arrow,
      new THREE.MeshBasicMaterial({
        color: "#e4edcf",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      24,
    );
    this.flow.frustumCulled = false;
    scene.add(this.flow);
    this.destination = new THREE.Group();
    this.destination.name = destination.name + " prepared destination";
    this.destination.visible = false;
    scene.add(this.destination);
    // Destination geometry/props now belong to the bounded world streamer.
    this.jobs = [];
    this.status = "ready";
  }

  mesh(g, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = this.scene) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  place(mesh, i, x, y, z, angle) {
    this.matrix.compose(
      this.point.set(x, y, z),
      this.rotation.setFromAxisAngle(this.axis, angle),
      this.scale,
    );
    mesh.setMatrixAt(i, this.matrix);
  }
  sign(title, subtitle, x, y, z, angle, width, parent = this.scene) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const c = canvas.getContext("2d");
    const draw = () => {
      c.fillStyle = "#122d3b";
      c.fillRect(0, 0, 512, 128);
      c.strokeStyle = "#d9bb7b";
      c.lineWidth = 8;
      c.strokeRect(4, 4, 504, 120);
      c.textAlign = "center";
      c.fillStyle = "#f0dfb5";
      c.font = `400 38px ${displayFont}`;
      c.fillText(title, 256, 54, 480);
      c.font = `600 21px ${interfaceFont}`;
      c.fillText(subtitle, 256, 94, 480);
    };
    draw();
    const t = new THREE.CanvasTexture(canvas);
    repaintAfterFonts(() => {
      draw();
      t.needsUpdate = true;
    });
    t.colorSpace = THREE.SRGBColorSpace;
    const o = this.mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }),
      x,
      y,
      z,
      1,
      1,
      1,
      parent,
    );
    o.rotation.y = angle;
    for (const side of [-1, 1])
      this.mesh(
        this.pole,
        this.materials.wood,
        x + Math.cos(angle) * side * width * 0.42,
        (y + 0.2) / 2,
        z - Math.sin(angle) * side * width * 0.42,
        1,
        (y - 0.2) / 2.2,
        1,
        parent,
      );
    return o;
  }
  prepareOne() {
    if (this.prepared === this.jobs.length) {
      this.status = "ready";
      return;
    }
    const start = performance.now();
    this.jobs[this.prepared++]();
    if (this.prepared === this.jobs.length) this.batchDestination();
    this.maxJobMs = Math.max(this.maxJobMs, performance.now() - start);
    this.status = this.prepared === this.jobs.length ? "ready" : "preparing";
  }
  batchDestination() {
    this.destination.updateMatrixWorld(true);
    const groups = new Map();
    for (const mesh of this.destination.children) {
      if (!groups.has(mesh.material)) groups.set(mesh.material, []);
      const g = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      groups.get(mesh.material).push(g);
      if (mesh.geometry !== this.box && mesh.geometry !== this.pole)
        mesh.geometry.dispose();
    }
    this.destination.clear();
    for (const [material, list] of groups) {
      const mesh = new THREE.Mesh(mergeGeometries(list), material);
      mesh.castShadow = mesh.receiveShadow = true;
      this.destination.add(mesh);
      for (const g of list) g.dispose();
    }
  }
  update(dt, campaign, boat, time) {
    this.arms[0].rotation.y = (campaign.gateOpen * Math.PI) / 2;
    this.arms[1].rotation.y = (-campaign.gateOpen * Math.PI) / 2;
    this.lamp.material.color.set(
      campaign.gateOpen === 1 ? "#79af92" : "#b75449",
    );
    this.clock += dt;
    if (this.clock < 0.1) return;
    this.clock = 0;
    if (campaign.phase === "RIVER" || campaign.phase === "ARRIVED")
      this.prepareOne();
    this.destination.visible =
      this.prepared > 0 &&
      Math.hypot(boat.x - this.skin.focus[0], boat.z - this.skin.focus[1]) < 85;
    if (this.lastCheckpoint !== campaign.checkpoint) {
      this.lastCheckpoint = campaign.checkpoint;
      for (let i = 0; i < this.flags.count; i++)
        this.flags.setColorAt(
          i,
          this.color.set(
            Math.floor(i / 2) < campaign.checkpoint
              ? "#4d858b"
              : Math.floor(i / 2) === campaign.checkpoint
                ? "#d9ac46"
                : "#c5b997",
          ),
        );
      this.flags.instanceColor.needsUpdate = true;
    }
    const nearby = this.world.river.project(
      boat,
      0,
      this.world.river.length,
      this.sample,
    ).distance;
    for (let i = 0; i < this.flow.count; i++) {
      this.world.river.sample(
        (nearby +
          (i - this.flow.count / 2) * 8 -
          time * this.river.current * 2 +
          100 * this.world.river.length) %
          this.world.river.length,
        this.sample,
      );
      this.place(
        this.flow,
        i,
        this.sample.x,
        0.024,
        this.sample.z,
        -Math.atan2(-this.sample.tz, -this.sample.tx),
      );
    }
    this.flow.instanceMatrix.needsUpdate = true;
  }
  inspect() {
    return {
      status: this.status,
      prepared: this.prepared,
      total: this.jobs.length,
      maxPreparationMs: this.maxJobMs,
      visible: this.destination.visible,
    };
  }
}
