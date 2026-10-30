import * as THREE from "three";
// Ahead window is scoped to the NEXT ordered checkpoint, never the nearest branch.
export function guidanceWindow(campaign, boat, cue, settings) {
  if (campaign.phase === "RACE") {
    const c = campaign.venue,
      r = campaign.race,
      g = c.gates[r.next],
      prev = c.gates[(r.next + c.gates.length - 1) % c.gates.length],
      end = r.next === 0 ? c.length : g.distance;
    const p = c.project(boat, prev.distance - 8, end + 20, {});
    const d = cue?.wrong
      ? Math.max(prev.distance, end - 12)
      : Math.max(prev.distance, Math.min(end, p.distance));
    return {
      path: c,
      start: d,
      end: Math.min(d + settings.ahead, end + 18),
      closed: true,
    };
  }
  if (campaign.phase === "RIVER") {
    const w = campaign.leaf.world,
      g = w.checkpoints[campaign.checkpoint];
    if (!g) return null;
    const prev = campaign.checkpoint
        ? w.checkpoints[campaign.checkpoint - 1].distance
        : campaign.river.gateDistance,
      p = w.river.project(boat, prev - 8, g.distance + 10, {});
    const d = cue?.wrong
      ? g.distance - 12
      : Math.max(prev, Math.min(g.distance, p.distance));
    return {
      path: w.river,
      start: d,
      end: Math.min(w.river.length, d + settings.ahead, g.distance + 20),
    };
  }
  if (campaign.phase === "STAGING") {
    const path = campaign.stagingPath,
      p = path.project(boat, 0, path.length, {});
    return { path, start: p.distance, end: path.length };
  }
  if (campaign.phase === "EXIT" && !campaign.leaf.exitApproach)
    return guidanceWindow(
      { phase: "RACE", venue: campaign.venue, race: campaign.leaf.exitGuide },
      boat,
      cue,
      settings,
    );
  if (campaign.phase === "EXIT") {
    const w = campaign.leaf.world,
      p = w.river.project(boat, 0, campaign.river.gateDistance, {});
    return {
      path: w.river,
      start: p.distance,
      end: campaign.river.gateDistance + 8,
    };
  }
  return null;
}
export class WaterGuidance {
  constructor(scene, store, sampleWater) {
    this.store = store;
    this.sampleWater = sampleWater;
    this.water = { height: 0, wake: 0 };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -1, 0, -1, 0, 0, -0.25, 0, 0, 0.45, -1, 0, -0.3, 0, 0, 0.45, 0, 0,
          -0.25, 1, 0, -1, 1, 0, -0.3, 0, 0, 0.45,
        ],
        3,
      ),
    );
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
      color: store.values.color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(32), 1);
    geometry.setAttribute("navFade", this.fade);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float navFade;varying float navAlpha;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nnavAlpha=navFade;",
      );
      shader.fragmentShader =
        "varying float navAlpha;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.a*=navAlpha;",
      );
    };
    this.mesh = new THREE.InstancedMesh(geometry, material, 32);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.group.add(this.mesh);
    this.matrix = new THREE.Matrix4();
    this.scale = new THREE.Vector3();
    this.clock = 1;
    this.samples = [];
  }
  update(dt, campaign, b, cue, time, visible) {
    this.group.visible = visible;
    this.clock += dt;
    if (!visible || this.clock < 0.07) return;
    this.clock = 0;
    const s = this.store.values.arrows,
      w = guidanceWindow(campaign, b, cue, s);
    this.samples.length = 0;
    let count = 0;
    for (let i = 0; i < Math.round(s.count); i++) {
      // Anchor chevrons to route metres. They remain fixed in the water as
      // the boat passes, then fade out behind it instead of sliding with it.
      const distance = w
        ? Math.floor(
            (w.start - Math.min(s.fade, s.spacing * Math.floor(s.count / 3))) /
              s.spacing,
          ) *
            s.spacing +
          i * s.spacing
        : Infinity;
      if (!w || distance > w.end) break;
      if (distance < 0 || distance < w.start - s.fade) continue;
      const p = w.path.sample(distance),
        fade = Math.max(
          0,
          Math.min(
            1,
            (distance - w.start + s.fade) / s.fade,
            (w.end - distance) / s.fade,
          ),
        );
      this.sampleWater(p.x, p.z, time, this.water);
      this.matrix.makeRotationY(Math.PI / 2 - Math.atan2(p.tz, p.tx));
      this.scale.set(s.size, 1, s.size);
      this.matrix.scale(this.scale);
      this.matrix.setPosition(
        p.x,
        Math.max(s.height, this.water.height + this.water.wake + 0.25),
        p.z,
      );
      this.mesh.setMatrixAt(count, this.matrix);
      this.fade.setX(count, fade);
      count++;
      this.samples.push({ x: p.x, z: p.z, tx: p.tx, tz: p.tz, distance });
    }
    this.mesh.count = count;
    this.mesh.material.color
      .set(this.store.values.color)
      .multiplyScalar(s.brightness);
    this.mesh.material.opacity = s.opacity;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.fade.needsUpdate = true;
  }
  inspect() {
    return { visible: this.group.visible, arrows: this.samples };
  }
}
