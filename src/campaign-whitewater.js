import * as THREE from "three";
// The mean water plane stays at Y=0. Local standing crests extend the retained
// procedural surface; the original X/Z hull force integrator is unchanged.
export class RiverSurface {
  constructor(world, water) {
    this.world = world;
    this.water = water;
    this.point = {};
    this.uniforms = {
      riverCrests: {
        value: Array.from({ length: 4 }, () => new THREE.Vector4()),
      },
      riverPower: { value: 0 },
    };
    Object.assign(water.uniforms, this.uniforms);
    const material = water.material,
      previous = material.onBeforeCompile,
      key = material.customProgramCacheKey;
    material.onBeforeCompile = (shader) => {
      previous(shader);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader =
        "uniform vec4 riverCrests[4];uniform float riverPower;varying float riverSurface;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `riverSurface=0.;for(int i=0;i<4;i++){vec4 c=riverCrests[i];vec2 d=position.xz-c.xy;float s=dot(d,c.zw),l=dot(d,vec2(-c.w,c.z));riverSurface+=sin(s*.8)*exp(-s*s/110.-l*l/170.)*riverPower;}transformed.y+=riverSurface*shoreFade;\n#include <project_vertex>`,
      );
      shader.fragmentShader =
        "varying float riverSurface;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight=mix(outgoingLight,vec3(.78,.86,.78),smoothstep(.10,.42,riverSurface)*.55);\n#include <opaque_fragment>",
      );
    };
    material.customProgramCacheKey = () =>
      key.call(material) + "-river-crests-v1";
  }
  update(b, dt) {
    const n = this.world.nearest(b.x, b.z),
      leg = this.world.legs.find((l) => l.river.id === n.segmentId),
      power = leg
        ? leg.riverDefinition.rapids.strength *
          0.75 *
          this.water.uniforms.summerWaves.value
        : 0;
    this.uniforms.riverPower.value +=
      (power - this.uniforms.riverPower.value) * (1 - Math.exp(-dt * 4));
    if (!leg) return;
    const d = leg.river.project(b, 0, leg.river.length, this.point).distance,
      band = Math.floor(d / 48);
    for (let i = 0; i < 4; i++) {
      const p = leg.river.sample(
        Math.max(0, Math.min(leg.river.length, (band + i - 1) * 48)),
        this.point,
      );
      this.uniforms.riverCrests.value[i].set(p.x, p.z, p.tx, p.tz);
    }
  }
  height(x, z) {
    const power = this.uniforms.riverPower.value;
    if (power < 0.0001) return 0;
    let h = 0;
    for (const c of this.uniforms.riverCrests.value) {
      const dx = x - c.x,
        dz = z - c.y,
        s = dx * c.z + dz * c.w,
        l = -dx * c.w + dz * c.z;
      h += Math.sin(s * 0.8) * Math.exp((-s * s) / 110 - (l * l) / 170) * power;
    }
    return h;
  }
  wrapSampler(sample) {
    return (x, z, time, out) => {
      sample(x, z, time, out);
      out.height += this.height(x, z);
      return out;
    };
  }
}
