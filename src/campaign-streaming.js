import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sliceCampaignNetwork } from "./campaign-world.js";
import { channelGeometry, shorelineGeometry, landGeometry } from "./track.js";
import { renderGeometry } from "./fluid/render-geometry.js";

export const TILE_SIZE = 160;
export const originBounds = { minX: -160, maxX: 160, minZ: -160, maxZ: 160 };
export const tileKey = (x, z) => `${x},${z}`;
export function tileBounds(x, z) {
  return {
    minX: x * TILE_SIZE,
    maxX: (x + 1) * TILE_SIZE,
    minZ: z * TILE_SIZE,
    maxZ: (z + 1) * TILE_SIZE,
  };
}
const originTile = (x, z) => [-1, 0].includes(x) && [-1, 0].includes(z);

/** Bounded lifecycle queue, independent from race/progression and rendering. */
export class ChunkQueue {
  constructor({ create, dispose, fallback = () => null, maxChunks = 49 }) {
    Object.assign(this, { create, dispose, fallback, maxChunks });
    this.chunks = new Map();
    this.requested = new Map();
    this.builds = 0;
    this.disposals = 0;
    this.failures = 0;
    this.maxJobMs = 0;
  }
  request(entries) {
    this.requested = new Map(entries.map((e) => [e.key, e]));
    for (const entry of entries)
      if (!this.chunks.has(entry.key))
        this.chunks.set(entry.key, {
          ...entry,
          status: "queued",
          phase: 0,
          value: null,
          error: "",
        });
  }
  step() {
    const job = [...this.chunks.values()]
      .filter(
        (c) =>
          this.requested.has(c.key) &&
          !c.pending &&
          !["ready", "fallback"].includes(c.status),
      )
      .sort(
        (a, b) =>
          this.requested.get(a.key).priority -
          this.requested.get(b.key).priority,
      )[0];
    if (!job) return;
    const start = performance.now();
    const complete = (value) => {
      job.value = value;
      job.phase++;
      job.status = job.phase >= 3 ? "ready" : "building";
      job.pending = false;
      this.builds++;
    };
    const fail = (error) => {
      this.failures++;
      job.error = String(error.message || error);
      this.dispose(job.value);
      job.value = this.fallback(job);
      job.status = "fallback";
      job.pending = false;
    };
    try {
      const result = this.create(job, job.value);
      if (result?.then) {
        job.pending = true;
        job.status = "building";
        result.then(complete, fail);
      } else complete(result);
    } catch (error) {
      fail(error);
    }
    this.maxJobMs = Math.max(this.maxJobMs, performance.now() - start);
  }
  evict(canRemove) {
    const candidates = [...this.chunks.values()]
      .filter((c) => !this.requested.has(c.key) && !c.pending && canRemove(c))
      .sort((a, b) => b.priority - a.priority);
    for (const c of candidates) {
      this.dispose(c.value);
      this.chunks.delete(c.key);
      this.disposals++;
    }
  }
  retry() {
    for (const c of this.chunks.values())
      if (c.status === "fallback") {
        this.dispose(c.value);
        c.value = null;
        c.phase = 0;
        c.status = "queued";
        c.error = "";
      }
  }
  inspect() {
    const counts = { queued: 0, building: 0, ready: 0, fallback: 0 };
    for (const c of this.chunks.values()) counts[c.status]++;
    return {
      ...counts,
      resident: this.chunks.size,
      limit: this.maxChunks,
      builds: this.builds,
      disposals: this.disposals,
      failures: this.failures,
      maxJobMs: this.maxJobMs,
    };
  }
}
function seeded(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
}
export class CampaignStreamer {
  constructor(scene, world, { water, ground, bank }) {
    Object.assign(this, { scene, world, water, ground, bank });
    this.busy = false;
    this.workerSerial = 0;
    this.workerRequests = new Map();
    this.worker = null;
    this.openWorker();
    this.look = { vegetation: 1, spectators: 1, detail: 1, drawDistance: 160 };
    this.waterMeshes = [];
    this.clock = 1;
    this.nextStatus = "not requested";
    this.obstacles = [];
    this.materials = {
      trunk: new THREE.MeshStandardMaterial({
        color: "#604d38",
        roughness: 0.92,
      }),
      leaves: new THREE.MeshStandardMaterial({
        color: "#557957",
        roughness: 0.9,
      }),
      rock: new THREE.MeshStandardMaterial({
        color: "#777c75",
        roughness: 0.84,
      }),
      wood: new THREE.MeshStandardMaterial({
        color: "#ac8153",
        roughness: 0.85,
      }),
      cream: new THREE.MeshStandardMaterial({ color: "#e8d9b5" }),
      red: new THREE.MeshStandardMaterial({ color: "#aa5644" }),
    };
    const cones = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.ConeGeometry(2.2 - i * 0.48, 3.8, 7);
      g.translate(0, 4 + i * 1.8, 0);
      cones.push(g);
    }
    this.pine = mergeGeometries(cones);
    cones.forEach((g) => g.dispose());
    this.trunk = new THREE.CylinderGeometry(0.16, 0.28, 7, 6);
    this.rock = new THREE.IcosahedronGeometry(1, 1);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.outcrop = new THREE.IcosahedronGeometry(1, 2);
    const torso = this.box.clone();
    torso.scale(0.45, 0.85, 0.28);
    torso.translate(0, 1.1, 0);
    const head = new THREE.SphereGeometry(0.23, 6, 4);
    head.translate(0, 1.72, 0);
    const legs = this.box.clone();
    legs.scale(0.42, 0.7, 0.27);
    legs.translate(0, 0.35, 0);
    this.person = mergeGeometries([torso, head, legs]);
    torso.dispose();
    head.dispose();
    legs.dispose();
    this.matrix = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.axis = new THREE.Vector3(0, 1, 0);
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.queue = new ChunkQueue({
      create: (c, v) => this.build(c, v),
      dispose: (v) => this.disposeTile(v),
      fallback: (c) => this.fallback(c),
    });
    if (typeof window !== "undefined")
      window.addEventListener(
        "pagehide",
        () => {
          this.worker?.terminate();
          for (const p of this.workerRequests.values()) clearTimeout(p.timer);
          this.workerRequests.clear();
        },
        { once: true },
      );
  }
  openWorker() {
    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(
          new URL("./campaign-chunk-worker.js", import.meta.url),
          { type: "module" },
        );
        const worker = this.worker;
        this.worker.onmessage = ({ data }) => {
          const p = this.workerRequests.get(data.id);
          if (!p || this.worker !== worker) return;
          clearTimeout(p.timer);
          this.workerRequests.delete(data.id);
          this.busy = false;
          if (p)
            data.error ? p.reject(Error(data.error)) : p.resolve(data.result);
        };
        this.worker.onerror = () => {
          if (this.worker !== worker) return;
          this.worker?.terminate();
          this.worker = null;
          this.busy = false;
          for (const p of this.workerRequests.values()) {
            clearTimeout(p.timer);
            p.reject(Error("Background geometry failed"));
          }
          this.workerRequests.clear();
        };
      } catch {
        this.worker = null;
      }
    }
  }
  retry() {
    if (!this.worker) this.openWorker();
    this.queue.retry();
  }
  configure(values, quality) {
    this.look = {
      vegetation: values.vegetation,
      spectators: values.spectators,
      detail: quality.detail,
      drawDistance: values.drawDistance,
    };
    this.queue.maxChunks = quality.detail >= 0.9 ? 64 : 49;
    for (const c of this.queue.chunks.values())
      c.value?.traverse((o) => this.styleObject(o));
  }
  courseStatus(index) {
    if (index === 0) return "ready";
    const start = this.world.courses[index]?.points[0];
    if (!start) return "final venue";
    const x = Math.floor(start.x / TILE_SIZE),
      z = Math.floor(start.z / TILE_SIZE);
    let ready = true,
      fallback = false;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (originTile(x + dx, z + dz)) continue;
        const status = this.queue.chunks.get(tileKey(x + dx, z + dz))?.status;
        ready &&= status === "ready";
        fallback ||= status === "fallback";
      }
    return fallback ? "fallback" : ready ? "ready" : "preparing";
  }
  appendObstacles(out, x, z) {
    for (const c of this.queue.chunks.values()) {
      if (!c.value) continue;
      const b = tileBounds(c.x, c.z),
        d = Math.hypot(
          Math.max(b.minX - x, 0, x - b.maxX),
          Math.max(b.minZ - z, 0, z - b.maxZ),
        );
      if (d > 75) continue;
      for (const mesh of c.value.children)
        if (mesh.isMesh && mesh.material !== this.water) out.push(mesh);
    }
  }
  styleObject(o) {
    if (o.userData.forest)
      o.count = Math.floor(
        o.userData.capacity *
          Math.min(1, this.look.vegetation * this.look.detail),
      );
    if (o.userData.decor)
      o.count = Math.floor(
        o.userData.capacity * Math.min(1, 0.3 + this.look.detail * 0.7),
      );
    if (o.userData.spectator)
      o.visible =
        o.userData.spectatorIndex <
        Math.ceil(o.userData.spectatorTotal * this.look.spectators);
  }

  entries(b, next = null) {
    const out = [];
    const add = (x, z, priority) => {
      if (originTile(x, z)) return;
      const key = tileKey(x, z);
      if (!out.some((e) => e.key === key)) out.push({ key, x, z, priority });
    };
    const cx = Math.floor(b.x / TILE_SIZE),
      cz = Math.floor(b.z / TILE_SIZE);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        add(cx + dx, cz + dz, Math.hypot(dx, dz) * 100);
    // Start preparing the next venue during the current three-lap race, so its
    // heavier intersection meshes never compete with urgent river geometry.
    if (next) {
      const x = Math.floor(next.x / TILE_SIZE),
        z = Math.floor(next.z / TILE_SIZE);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          add(x + dx, z + dz, 400 + Math.hypot(dx, dz));
    }
    return out;
  }
  prime(b) {
    this.queue.request(this.entries(b));
    let guard = 0;
    while (!this.busy && guard++ < 12) this.queue.step();
  }
  make(group, geometry, material) {
    const m = new THREE.Mesh(geometry, material);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  build(c, tile) {
    const bounds = tileBounds(c.x, c.z);
    if (!tile) {
      tile = new THREE.Group();
      tile.name = `Campaign chunk ${c.key}`;
      tile.userData.owned = [];
      tile.userData.shared = new Set([
        this.pine,
        this.trunk,
        this.rock,
        this.box,
      ]);
      this.scene.add(tile);
      c.value = tile;
    }
    if (c.phase === 0) {
      const network = sliceCampaignNetwork(this.world.network, bounds);
      tile.userData.network = network;
      if (!network.paths.length) {
        const g = new THREE.PlaneGeometry(160, 160);
        g.rotateX(-Math.PI / 2);
        g.translate(bounds.minX + 80, 0.35, bounds.minZ + 80);
        const pos = g.attributes.position,
          uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++)
          uv.setXY(i, (pos.getX(i) + 125) / 250, (110 - pos.getZ(i)) / 220);
        this.make(tile, g, this.ground);
        return tile;
      }
      if (!this.worker)
        throw Error(
          "Background geometry unavailable; safe scenery fallback active",
        );
      this.busy = true;
      const id = ++this.workerSerial;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.worker?.terminate();
          this.worker = null;
          this.busy = false;
          for (const p of this.workerRequests.values()) {
            clearTimeout(p.timer);
            p.reject(Error("Scenery preparation timed out; retry available"));
          }
          this.workerRequests.clear();
        }, 45000);
        this.workerRequests.set(id, { resolve, reject, timer });
        this.worker.postMessage({
          id,
          bounds,
          paths: network.paths.map((p) => ({
            id: p.id,
            width: p.waterWidth,
            points: p.map((q) => [q.x, q.z]),
          })),
        });
      }).then((result) => {
        const unpack = (part) => {
          const g = new THREE.BufferGeometry();
          for (const [name, a] of Object.entries(part.attributes))
            g.setAttribute(
              name,
              new THREE.BufferAttribute(a.array, a.itemSize),
            );
          if (part.index) g.setIndex(new THREE.BufferAttribute(part.index, 1));
          g.computeBoundingSphere();
          return g;
        };
        this.make(tile, unpack(result.land), this.ground);
        if (result.water) {
          const w = this.make(tile, unpack(result.water), this.water);
          w.name = "streamed water";
          this.waterMeshes.push(w);
          this.make(tile, unpack(result.bank), this.bank);
        }
        return tile;
      });
    } else if (c.phase === 1) {
      const random = seeded(((c.x * 73856093) ^ (c.z * 19349663)) >>> 0),
        trees = [];
      for (const path of tile.userData.network.paths)
        for (let i = 2; i < path.length - 1; i += 12) {
          const p = path[i],
            q = path[i + 1],
            length = Math.hypot(q.x - p.x, q.z - p.z) || 1;
          for (const side of [-1, 1]) {
            const offset = (path.waterWidth ?? 9) + 7 + random() * 6,
              x = p.x - ((q.z - p.z) / length) * side * offset,
              z = p.z + ((q.x - p.x) / length) * side * offset;
            if (
              x < bounds.minX ||
              x >= bounds.maxX ||
              z < bounds.minZ ||
              z >= bounds.maxZ
            )
              continue;
            const n = this.world.nearest(x, z);
            if (Math.hypot(x - n.x, z - n.z) > (n.waterWidth ?? 9) + 3)
              trees.push({
                x,
                z,
                size: 0.8 + random() * 0.7,
                angle: random() * 6.28,
              });
          }
        }
      for (let i = 0; i < 125; i++) {
        const x = bounds.minX + random() * 160,
          z = bounds.minZ + random() * 160,
          n = this.world.nearest(x, z),
          d = Math.hypot(x - n.x, z - n.z);
        if (d > (n.waterWidth ?? 9) + 3 && d < 75)
          trees.push({
            x,
            z,
            size: 0.7 + random() * 0.9,
            angle: random() * 6.28,
          });
      }
      for (const [g, m, trunk] of [
        [this.pine, this.materials.leaves, false],
        [this.trunk, this.materials.trunk, true],
      ]) {
        const mesh = new THREE.InstancedMesh(g, m, trees.length);
        for (const [p, i] of trees.map((p, i) => [p, i])) {
          this.matrix.compose(
            this.position.set(p.x, trunk ? 3.5 * p.size : 0.35, p.z),
            this.q.setFromAxisAngle(this.axis, p.angle),
            this.scale.setScalar(p.size),
          );
          mesh.setMatrixAt(i, this.matrix);
        }
        mesh.userData.forest = true;
        mesh.userData.capacity = trees.length;
        this.styleObject(mesh);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        tile.add(mesh);
      }
    } else {
      const nearTrack = this.world.courses.findIndex((course) => {
        const p = course.points[0];
        return (
          p.x >= bounds.minX - 120 &&
          p.x <= bounds.maxX + 120 &&
          p.z >= bounds.minZ - 120 &&
          p.z <= bounds.maxZ + 120
        );
      });
      const mid = this.world.nearest(bounds.minX + 80, bounds.minZ + 80),
        riverNumber =
          this.world.legs.find((l) => l.river.id === mid.segmentId)
            ?.riverDefinition.number ?? 0;
      const random = seeded(((c.x * 2833) ^ (c.z * 1777)) >>> 0),
        count =
          nearTrack === 3
            ? 35
            : nearTrack >= 1
              ? 15
              : riverNumber === 3
                ? 18
                : riverNumber === 2
                  ? 12
                  : 6;
      const mesh = new THREE.InstancedMesh(
        this.rock,
        this.materials.rock,
        count,
      );
      for (let i = 0; i < count; i++) {
        let x = bounds.minX + random() * 160,
          z = bounds.minZ + random() * 160,
          n = this.world.nearest(x, z);
        const size =
            nearTrack === 2 || riverNumber === 3
              ? 1.5 + random() * 4
              : 0.5 + random() * 2,
          dx = x - n.x,
          dz = z - n.z,
          d = Math.hypot(dx, dz) || 1,
          minimum = (n.waterWidth ?? 9) + size + 2;
        if (d < minimum) {
          x = n.x + (dx / d) * minimum;
          z = n.z + (dz / d) * minimum;
        }
        this.matrix.compose(
          this.position.set(x, size * 0.35, z),
          this.q.setFromAxisAngle(this.axis, random() * 6.28),
          this.scale.set(size, size * 0.8, size),
        );
        mesh.setMatrixAt(i, this.matrix);
      }
      mesh.userData.decor = true;
      mesh.userData.capacity = count;
      this.styleObject(mesh);
      mesh.receiveShadow = mesh.castShadow = true;
      mesh.computeBoundingSphere();
      tile.add(mesh);
      // Receding bank-side outcrops frame the later valleys without touching
      // navigable water. Shared low-detail meshes keep the extra drama bounded.
      const formations = [];
      for (const path of tile.userData.network.paths) {
        const stage =
          this.world.legs.find((l) => l.river.id === path.id)?.riverDefinition
            .number ?? 0;
        if (stage < 2) continue;
        for (let i = 3; i < path.length - 1; i += 14) {
          const p = path[i],
            q = path[i + 1],
            len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
          for (const side of [-1, 1]) {
            const radius = stage === 3 ? 9 + random() * 6 : 5 + random() * 5,
              offset = (path.waterWidth ?? 9) + radius + 4,
              x = p.x - ((q.z - p.z) / len) * offset * side,
              z = p.z + ((q.x - p.x) / len) * offset * side;
            if (
              x < bounds.minX ||
              x >= bounds.maxX ||
              z < bounds.minZ ||
              z >= bounds.maxZ
            )
              continue;
            const n = this.world.nearest(x, z);
            if (Math.hypot(x - n.x, z - n.z) < (n.waterWidth ?? 9) + radius + 2)
              continue;
            formations.push({
              x,
              z,
              radius,
              height: stage === 3 ? 12 + random() * 9 : 6 + random() * 8,
            });
          }
        }
      }
      if (formations.length) {
        const m = new THREE.InstancedMesh(
          this.outcrop,
          this.materials.rock,
          formations.length,
        );
        formations.forEach((p, i) => {
          this.matrix.compose(
            this.position.set(p.x, -2, p.z),
            this.q.setFromAxisAngle(this.axis, random() * 6.28),
            this.scale.set(p.radius, p.height, p.radius * 0.8),
          );
          m.setMatrixAt(i, this.matrix);
        });
        m.userData.decor = true;
        m.userData.capacity = formations.length;
        this.styleObject(m);
        m.castShadow = m.receiveShadow = true;
        m.computeBoundingSphere();
        tile.add(m);
      }
      // Bank-side timber huts, docks and small spectator stands use shared hardware.
      for (const [index, course] of this.world.courses.entries()) {
        if (index === 0) continue;
        const p = course.points[0];
        let hub = null;
        for (const d of [28, 38, 50, 62])
          for (const side of [-1, 1]) {
            const x = p.x - p.tz * d * side,
              z = p.z + p.tx * d * side,
              n = this.world.nearest(x, z);
            if (!hub && Math.hypot(x - n.x, z - n.z) > (n.waterWidth ?? 9) + 8)
              hub = { x, z };
          }
        if (!hub) continue;
        const { x, z } = hub;
        if (
          x < bounds.minX ||
          x >= bounds.maxX ||
          z < bounds.minZ ||
          z >= bounds.maxZ
        )
          continue;
        const hut = this.make(tile, this.box, this.materials.wood);
        hut.position.set(x, 2, z);
        hut.scale.set(5, 3, 4);
        const roof = this.make(tile, this.box, this.materials.red);
        roof.position.set(x, 3.7, z);
        roof.scale.set(6, 0.5, 5);
        const total = index === 3 ? 30 : index === 2 ? 10 : 14;
        for (let i = 0; i < total; i++) {
          const o = this.make(
            tile,
            this.person,
            i % 2 ? this.materials.cream : this.materials.red,
          );
          o.position.set(x + 8 + (i % 6), 0.35, z + Math.floor(i / 6) * 1.4);
          Object.assign(o.userData, {
            spectator: true,
            spectatorIndex: i,
            spectatorTotal: total,
          });
          this.styleObject(o);
        }
        const dock = this.make(tile, this.box, this.materials.wood);
        dock.position.set(x - 4, 0.55, z);
        dock.scale.set(2.5, 0.3, 7);
        const banner = this.make(tile, this.box, this.materials.cream);
        banner.position.set(x, 5.3, z);
        banner.scale.set(7, 0.7, 0.15);
      }
    }
    return tile;
  }
  fallback(c) {
    // A failed scenery job never resets the scene or progresses the campaign.
    // Keep a cheap continuous water strip and announce degraded scenery explicitly.
    const group = new THREE.Group(),
      b = tileBounds(c.x, c.z),
      network = sliceCampaignNetwork(this.world.network, b),
      positions = [];
    for (const path of network.paths)
      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i],
          q = path[i + 1],
          l = Math.hypot(q.x - p.x, q.z - p.z) || 1,
          nx = (-(q.z - p.z) / l) * (path.waterWidth ?? 9),
          nz = ((q.x - p.x) / l) * (path.waterWidth ?? 9);
        positions.push(
          p.x + nx,
          0,
          p.z + nz,
          p.x - nx,
          0,
          p.z - nz,
          q.x + nx,
          0,
          q.z + nz,
          q.x + nx,
          0,
          q.z + nz,
          p.x - nx,
          0,
          p.z - nz,
          q.x - nx,
          0,
          q.z - nz,
        );
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: "#2d8a82",
      side: THREE.DoubleSide,
    });
    group.userData.fallbackMaterial = material;
    this.make(group, g, material);
    this.scene.add(group);
    return group;
  }
  disposeTile(tile) {
    if (!tile) return;
    tile.removeFromParent();
    tile.traverse((o) => {
      if (!o.isMesh) return;
      const i = this.waterMeshes.indexOf(o);
      if (i >= 0) this.waterMeshes.splice(i, 1);
      if (
        ![
          this.pine,
          this.trunk,
          this.rock,
          this.box,
          this.outcrop,
          this.person,
        ].includes(o.geometry)
      )
        o.geometry.dispose();
      o.dispose?.();
    });
    tile.userData.fallbackMaterial?.dispose();
  }
  update(dt, b, tour) {
    this.clock += dt;
    if (this.clock > 0.2) {
      this.clock = 0;
      const nextIndex = this.previewVenue ?? tour.index + 1;
      const path = this.world.staging[nextIndex],
        next = path ? path.sample(path.length) : null;
      this.queue.request(this.entries(b, next));
      this.queue.evict((c) => {
        const bounds = tileBounds(c.x, c.z),
          distance = Math.hypot(
            Math.max(bounds.minX - b.x, 0, b.x - bounds.maxX),
            Math.max(bounds.minZ - b.z, 0, b.z - bounds.maxZ),
          );
        return (
          distance > 520 ||
          (this.queue.chunks.size > this.queue.maxChunks &&
            distance > Math.max(300, this.look.drawDistance + 100))
        );
      });
      this.nextStatus = this.courseStatus(nextIndex);
      const x = Math.floor(b.x / TILE_SIZE),
        z = Math.floor(b.z / TILE_SIZE);
      this.localStatus = originTile(x, z)
        ? "ready"
        : (this.queue.chunks.get(tileKey(x, z))?.status ?? "queued");
    }
    if (!this.busy) this.queue.step();
  }
  inspect() {
    return {
      ...this.queue.inspect(),
      nextVenue: this.nextStatus,
      waterMeshes: this.waterMeshes.length,
      venues: this.world.courses.map((_, i) => this.courseStatus(i)),
      local: this.localStatus ?? "ready",
      worker: !!this.worker,
      geometryBusy: this.busy,
      warning: this.queue.inspect().fallback
        ? "Scenery fallback active · navigation/collision retained"
        : "",
    };
  }
}
