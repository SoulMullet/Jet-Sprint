import * as THREE from "three";
import { BallisticSpray } from "./ballistic-spray.js";
import { sprayDefaults } from "./spray-settings.js";
import { stern } from "./wake-trail.js";

const defaultOptions = Object.freeze({
  density: 1,
  distance: 1,
  volume: 1,
  effects: 1,
  persistence: 3,
  impact: 0,
  emit: true,
  pose: undefined,
  tuning: sprayDefaults,
});

// One world-space particle pool and one brief water-impact pass. No attached core.
export class HFSpray {
  constructor(scene, water, capacity = 6144, options = {}) {
    this.water = water;
    this.simulation = new BallisticSpray(capacity, options);
    this.capacity = capacity;
    this.budget = capacity;
    this.quality = 1;
    this.origin = { x: 0, z: 0 };
    this.time = 0;
    this.stepOptions = {};
    this.births = this.simulation.births;
    this.velocities = this.simulation.launches;
    this.styles = this.simulation.styles;
    this.centers = new Float32Array(capacity * 3);
    this.motion = new Float32Array(capacity * 4);
    const quad = new THREE.PlaneGeometry(1, 1),
      g = new THREE.InstancedBufferGeometry();
    g.index = quad.index.clone();
    g.setAttribute("position", quad.attributes.position.clone());
    g.setAttribute("uv", quad.attributes.uv.clone());
    for (const [name, array, size] of [
      ["center", this.centers, 3],
      ["motion", this.motion, 4],
      ["style", this.styles, 4],
      ["birth", this.births, 4],
    ])
      g.setAttribute(
        name,
        new THREE.InstancedBufferAttribute(array, size).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
    this.uniforms = { comparison: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
   attribute vec3 center;attribute vec4 motion,style;varying vec2 st;varying float fade,kind;
   void main(){st=uv;fade=motion.w;kind=style.z;vec4 eye=viewMatrix*vec4(center,1.);
    vec2 dir=normalize((viewMatrix*vec4(motion.xyz,0.)).xy+vec2(.001));vec2 side=vec2(dir.y,-dir.x);
    eye.xy+=(side*position.x+dir*position.y*(kind<.5?1.9:1.))*style.y;
    gl_Position=projectionMatrix*eye;if(fade<.002)gl_Position=vec4(2.,2.,2.,1.);
   }`,
      fragmentShader: `uniform float comparison;varying vec2 st;varying float fade,kind;
   void main(){float r=length(st-.5)*2.;if(r>1.||fade<.002)discard;float edge=pow(1.-r*r,kind<.5?1.2:2.);
    vec3 color=mix(vec3(.82,.93,.93),vec3(.94,.98,1.),st.y*.6+comparison*.2);gl_FragColor=vec4(color,edge*fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.name = "Independent world-space ballistic water drops";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    this.impactCenters = new Float32Array(this.simulation.splashCapacity * 4);
    this.impactStyles = new Float32Array(this.simulation.splashCapacity * 2);
    const impacts = new THREE.InstancedBufferGeometry();
    impacts.index = quad.index.clone();
    impacts.setAttribute("position", quad.attributes.position.clone());
    impacts.setAttribute("uv", quad.attributes.uv.clone());
    quad.dispose();
    impacts.setAttribute(
      "contact",
      new THREE.InstancedBufferAttribute(this.impactCenters, 4).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    impacts.setAttribute(
      "splash",
      new THREE.InstancedBufferAttribute(this.impactStyles, 2).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    impacts.instanceCount = this.simulation.splashCapacity;
    this.splashMesh = new THREE.Mesh(
      impacts,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: `
   attribute vec4 contact;attribute vec2 splash;varying vec2 st;varying float fade;
   void main(){st=uv;fade=splash.y;vec3 p=contact.xyz;p.xz+=position.xy*splash.x;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);if(fade<.002)gl_Position=vec4(2.,2.,2.,1.);}
   `,
        fragmentShader: `varying vec2 st;varying float fade;void main(){float r=length(st-.5)*2.;float ring=1.-smoothstep(.025,.14,abs(r-.72));float foam=(1.-smoothstep(.15,.9,r))*.18;if(r>1.)discard;gl_FragColor=vec4(.9,.97,.95,(ring*.6+foam)*fade);}`,
      }),
    );
    this.splashMesh.name = "Short-lived water contact foam";
    this.splashMesh.frustumCulled = false;
    this.splashMesh.renderOrder = 2;
    this.mesh.add(this.splashMesh);
    this.reset();
  }
  get cursor() {
    return this.simulation.cursor;
  }
  get activeCount() {
    return this.simulation.count;
  }
  configure(limit, quality) {
    this.budget = Math.max(128, Math.min(this.capacity, Math.round(limit)));
    this.quality = quality;
    this.simulation.configure(this.budget);
    this.mesh.geometry.instanceCount = this.budget;
  }
  reset() {
    this.simulation.reset();
    this.rate = 0;
    this.wakeClock = 0;
    this.history = 0;
    this.centers.fill(-1000);
    this.motion.fill(0, 0, this.budget * 4);
    this.impactStyles.fill(0);
    for (const w of this.water.hfWake.value) w.set(0, 0, 100, 0);
    if (this.mesh) this.sync();
  }
  update(dt, b, speed, input, options = {}) {
    this.time += dt;
    const { volume = 1, persistence = 3 } = options;
    // Preserve existing surface wake history, separate from airborne trajectories.
    stern(b, this.origin);
    for (const w of this.water.hfWake.value) w.z += (dt * 5) / persistence;
    this.wakeClock += dt;
    if (speed > 1 && this.wakeClock > 0.11) {
      this.wakeClock = 0;
      this.water.hfWake.value[this.history++ % 24].set(
        this.origin.x,
        this.origin.z,
        0,
        Math.min(1.2, speed / 20) * volume,
      );
    }
    Object.assign(this.stepOptions, defaultOptions, options);
    this.stepOptions.quality = this.quality;
    this.simulation.advance(dt, b, this.stepOptions);
    this.rate = this.simulation.rate;
    this.sync();
  }
  sync() {
    const s = this.simulation,
      a = s.alpha;
    this.motion.fill(0, 0, this.budget * 4);
    for (let n = 0; n < s.count; n++) {
      const i = s.active[n],
        j = i * 3,
        k = i * 4,
        age = s.age[i],
        life = s.styles[k],
        kind = s.styles[k + 2];
      for (let axis = 0; axis < 3; axis++)
        this.centers[j + axis] =
          s.previous[j + axis] +
          (s.position[j + axis] - s.previous[j + axis]) * a;
      this.motion[k] = s.velocity[j];
      this.motion[k + 1] = s.velocity[j + 1];
      this.motion[k + 2] = s.velocity[j + 2];
      this.motion[k + 3] =
        Math.min(1, age / 0.025) *
        Math.min(1, (life - age) / 0.2) *
        (kind === 1 ? 0.18 : kind === 0 ? 0.8 : 0.9);
    }
    for (const name of ["center", "motion", "style", "birth"]) {
      if (
        (name === "style" || name === "birth") &&
        this.syncedCursor === s.cursor
      )
        continue;
      const attribute = this.mesh.geometry.attributes[name];
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.budget * attribute.itemSize);
      attribute.needsUpdate = true;
    }
    this.syncedCursor = s.cursor;
    for (let i = 0; i < s.splashCapacity; i++) {
      const j = i * 5,
        k = i * 4,
        l = i * 2,
        age = s.time - s.splashes[j + 3],
        intensity = s.splashes[j + 4],
        fade = intensity > 0 && age >= 0 ? Math.max(0, 1 - age / 0.5) : 0;
      if (fade <= 0) {
        this.impactStyles[l + 1] = 0;
        continue;
      }
      this.impactCenters[k] = s.splashes[j];
      this.impactCenters[k + 1] =
        s.surfaceAt(s.splashes[j], s.splashes[j + 2], s.time) + 0.014;
      this.impactCenters[k + 2] = s.splashes[j + 2];
      this.impactStyles[l] =
        (0.15 + Math.max(0, age) * 1.5) *
        Math.min(1.7, Math.sqrt(Math.max(0, intensity)));
      this.impactStyles[l + 1] = fade * Math.min(1.5, intensity);
    }
    for (const name of ["contact", "splash"])
      this.splashMesh.geometry.attributes[name].needsUpdate = true;
  }
  inspect() {
    return {
      model: "world-space-fixed-step",
      worldUp: "Y",
      step: 1 / 120,
      active: this.activeCount,
      budget: this.budget,
      emitted: this.cursor,
      impacts: this.simulation.impactCount,
      attachedCore: false,
      rate: this.rate,
    };
  }
  dispose() {
    this.mesh.removeFromParent();
    for (const mesh of [this.mesh, this.splashMesh]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
