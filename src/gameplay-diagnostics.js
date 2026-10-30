import * as THREE from "three";
function lines(color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array(48000), 3),
  );
  g.setDrawRange(0, 0);
  const l = new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  );
  l.frustumCulled = false;
  l.renderOrder = 14;
  return l;
}
function upload(mesh, data) {
  const p = mesh.geometry.attributes.position;
  p.array.set(data.slice(0, p.array.length));
  p.needsUpdate = true;
  mesh.geometry.setDrawRange(0, Math.min(p.count, data.length / 3));
}
export class GameplayDiagnostics {
  constructor(scene, world, store) {
    this.world = world;
    this.store = store;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.banks = lines("#4dceba");
    this.normals = lines("#d9ac46");
    this.paths = lines("#4d858b");
    this.overlap = lines("#e65c28");
    this.contact = lines("#f9df8d");
    this.group.add(
      this.banks,
      this.normals,
      this.paths,
      this.overlap,
      this.contact,
    );
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.58, 40),
      new THREE.MeshBasicMaterial({
        color: "#e8d9b5",
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 15;
    this.group.add(this.ring);
    store.subscribe(() => (this.key = ""));
    this.safe = document.createElement("div");
    this.safe.id = "hudSafeZones";
    this.safe.setAttribute("aria-hidden", "true");
    document.body.append(this.safe);
    this.info = document.createElement("output");
    this.info.className = "safe-zone-summary";
    this.safe.append(this.info);
    this.route = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.route.setAttribute("width", "100%");
    this.route.setAttribute("height", "100%");
    this.route.style.position = "absolute";
    this.route.style.inset = "0";
    this.routePath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    this.routePath.setAttribute("fill", "none");
    this.routePath.setAttribute("stroke", "#e8d9b5");
    this.routePath.setAttribute("stroke-opacity", ".6");
    this.route.append(this.routePath);
    this.safe.prepend(this.route);
    this.rects = [];
    this.projection = new THREE.Vector3();
    this.clock = 0;
  }
  rebuild(b, tour) {
    const banks = [],
      normals = [],
      paths = [],
      overlap = [],
      range = tour.phase === "RIVER" ? 180 : 360;
    for (const path of this.world.network.paths)
      for (let i = 0; i < path.length - 1; i += 5) {
        const p = path[i],
          q = path[Math.min(path.length - 1, i + 5)];
        if (Math.hypot(p.x - b.x, p.z - b.z) > range) continue;
        paths.push(p.x, 0.4, p.z, q.x, 0.4, q.z);
        const dx = q.x - p.x,
          dz = q.z - p.z,
          l = Math.hypot(dx, dz) || 1,
          nx = -dz / l,
          nz = dx / l,
          width = path.waterWidth ?? 9;
        for (const side of [-1, 1]) {
          const x = p.x + nx * width * side,
            z = p.z + nz * width * side,
            n = this.world.nearest(x, z),
            distance = Math.hypot(x - n.x, z - n.z),
            internal = distance < (n.waterWidth ?? 9) - 0.15;
          const array = internal ? overlap : banks;
          array.push(x, 1, z, x + dx * 0.7, 1, z + dz * 0.7);
          if (!internal)
            normals.push(x, 1, z, x + nx * side * 2, 1, z + nz * side * 2);
        }
      }
    upload(this.banks, banks);
    upload(this.normals, normals);
    upload(this.paths, paths);
    upload(this.overlap, overlap);
    this.samples = {
      exposed: banks.length / 6,
      internalExcluded: overlap.length / 6,
    };
  }
  update(dt, b, tour, camera) {
    const d = this.store.values.debug;
    this.group.visible =
      d.geometry ||
      d.normals ||
      d.segments ||
      d.overlaps ||
      d.footprint ||
      d.contacts ||
      d.seams;
    const key =
      tour.event.id + ":" + Math.floor(b.x / 120) + ":" + Math.floor(b.z / 120);
    if (this.group.visible && key !== this.key) {
      this.key = key;
      this.rebuild(b, tour);
    }
    this.banks.visible = d.geometry;
    this.normals.visible = d.normals;
    this.paths.visible = d.segments;
    this.overlap.visible = d.overlaps || d.seams;
    this.ring.visible = d.footprint;
    this.ring.position.set(b.x, 0.9, b.z);
    this.contact.visible = d.contacts;
    if (d.contacts) {
      const points = [];
      for (const p of this.world.collisionNearest.recent)
        points.push(p.x, 1, p.z, p.x + p.nx * 4, 1, p.z + p.nz * 4);
      upload(this.contact, points);
    }
    this.safe.hidden = !d.safeZones;
    this.clock += dt;
    if (!d.safeZones || this.clock < 0.2) return;
    this.clock = 0;
    for (const r of this.rects) r.remove();
    this.rects = [];
    const boxes = [];
    for (const sel of [
      ".timing",
      "#journeyHUD",
      ".speed",
      "#navigator",
      "#arcadeControls .arcade-steering",
      "#arcadeThrottle",
    ]) {
      const e = document.querySelector(sel);
      if (
        !e ||
        !e.getClientRects().length ||
        getComputedStyle(e).visibility === "hidden"
      )
        continue;
      const r = e.getBoundingClientRect(),
        div = document.createElement("div");
      div.className = "hud-safe-box";
      Object.assign(div.style, {
        left: r.x + "px",
        top: r.y + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
      this.safe.append(div);
      this.rects.push(div);
      boxes.push(r);
    }
    let pathData = "";
    let visible = 0,
      clear = 0;
    for (const p of tour.venue.points) {
      this.projection.set(p.x, 0, p.z).project(camera);
      const x = ((this.projection.x + 1) * innerWidth) / 2,
        y = ((1 - this.projection.y) * innerHeight) / 2;
      pathData += (pathData ? " L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
      if (x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight) {
        visible++;
        if (
          !boxes.some(
            (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
          )
        )
          clear++;
      }
    }
    this.routePath.setAttribute("d", pathData + " Z");
    this.info.textContent = `TRACK IN VIEW ${Math.round((100 * visible) / tour.venue.points.length)}% · CLEAR OF HUD ${Math.round((100 * clear) / tour.venue.points.length)}% · Exposed bank samples ${this.samples?.exposed ?? 0} · Excluded internal edges ${this.samples?.internalExcluded ?? 0}`;
  }
}
