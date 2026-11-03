import * as THREE from "three";
import { channelPolygons } from "../track.js";
// A few thousand triangles cover the whole river, independently of terrain jobs.
// One shared shader surface avoids rectangular tile/material seams. It never
// creates a solver plane or changes physical shores/branches.
export function arcadeWaterGeometry(world) {
  const positions = [],
    indices = [],
    fades = [],
    gradient = [];
  const paths = [world.river, world.shortcut.path];
  for (const path of paths) {
    const base = positions.length / 3,
      width = path.definition.waterWidth;
    for (let i = 0; i < path.line.length; i++) {
      const p = path.line[i],
        a = path.line[Math.max(0, i - 1)],
        b = path.line[Math.min(path.line.length - 1, i + 1)],
        l = Math.hypot(b.x - a.x, b.z - a.z),
        nx = -(b.z - a.z) / l,
        nz = (b.x - a.x) / l;
      for (const side of [-1, 0, 1]) {
        positions.push(p.x + nx * width * side, 0, p.z + nz * width * side);
        fades.push(side === 0 ? 1 : 0);
        gradient.push(0, 0);
      }
      if (i)
        for (let side = 0; side < 2; side++) {
          const n = base + i * 3 + side;
          indices.push(n - 3, n + 1, n, n - 3, n - 2, n + 1);
        }
    }
    // Round end caps remain inside the exact channel capsules.
    for (const p of [path.line[0], path.line.at(-1)]) {
      const c = positions.length / 3;
      positions.push(p.x, 0, p.z);
      fades.push(1);
      gradient.push(0, 0);
      for (let j = 0; j <= 24; j++) {
        const a = (j / 24) * Math.PI * 2;
        positions.push(p.x + Math.cos(a) * width, 0, p.z + Math.sin(a) * width);
        fades.push(0);
        gradient.push(0, 0);
        if (j) indices.push(c, c + j + 1, c + j);
      }
    }
  }
  for (const [i, course] of world.courses.entries()) {
    const centre = world.definition.tracks[i].presentation.focus;
    for (const polygon of channelPolygons(
      course.network,
      world.definition.tracks[i].waterWidth,
    )) {
      const ring = polygon[0],
        c = positions.length / 3;
      positions.push(centre[0], 0, centre[1]);
      fades.push(1);
      gradient.push(0, 0);
      for (const [x, z] of ring) {
        positions.push(x, 0, z);
        fades.push(0);
        gradient.push(0, 0);
      }
      for (let j = 0; j < ring.length - 1; j++) {
        const a = ring[j],
          b = ring[j + 1],
          up =
            (a[1] - centre[1]) * (b[0] - centre[0]) -
            (a[0] - centre[0]) * (b[1] - centre[1]);
        if (up > 0) indices.push(c, c + j + 1, c + j + 2);
        else indices.push(c, c + j + 2, c + j + 1);
      }
    }
  }
  const uv = [];
  for (let i = 0; i < positions.length; i += 3)
    uv.push(positions[i] / 250, positions[i + 2] / 250);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("shoreFade", new THREE.Float32BufferAttribute(fades, 1));
  g.setAttribute(
    "shoreGradient",
    new THREE.Float32BufferAttribute(gradient, 2),
  );
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
export function createArcadeWater(scene, world, source) {
  const material = source.clone();
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.onBeforeCompile = (shader) => source.onBeforeCompile(shader);
  material.customProgramCacheKey = () =>
    source.customProgramCacheKey() + "-arcade-continuous-water";
  const mesh = new THREE.Mesh(arcadeWaterGeometry(world), material);
  mesh.receiveShadow = true;
  mesh.name = "Arcade continuous water / shared river shader";
  scene.add(mesh);
  return mesh;
}
