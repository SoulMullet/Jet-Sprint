import * as THREE from "three";
// Shares the real boat's geometry/materials. One renderer/context; no boat physics.
export class GaragePreview {
  constructor(original, environment) {
    this.original = original;
    this.environment = environment;
    this.ready = false;
    this.angle = 0;
  }
  init() {
    if (this.ready) return;
    this.ready = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#122d3b");
    this.scene.environment = this.environment;
    this.scene.add(new THREE.HemisphereLight("#fff1ce", "#304d51", 1.5));
    const light = new THREE.DirectionalLight("#ffe3af", 2);
    light.position.set(6, 8, 4);
    this.scene.add(light);
    this.model = this.original.clone(true);
    this.model.visible = true;
    this.model.position.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);
    this.model.traverse((o) => {
      o.castShadow = o.receiveShadow = false;
    });
    this.scene.add(this.model);
    this.platform = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 6, 0.3, 48),
      new THREE.MeshStandardMaterial({ color: "#243f48", roughness: 0.85 }),
    );
    this.platform.position.y = -0.8;
    this.scene.add(this.platform);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.5, 0.06, 6, 64),
      new THREE.MeshBasicMaterial({ color: "#c96735" }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.63;
    this.scene.add(ring);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.layers.enable(1);
    this.camera.position.set(9, 6, 11);
    this.camera.lookAt(0, 0.2, 0);
  }
  render(renderer, rect, dt, reducedMotion) {
    this.init();
    if (!reducedMotion) {
      this.angle += dt * 0.07;
      this.model.rotation.y = this.angle;
    }
    const w = innerWidth,
      h = innerHeight;
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.setClearColor("#122d3b", 1);
    renderer.clear();
    if (rect.width > 0 && rect.height > 0) {
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      renderer.setViewport(
        rect.x,
        h - rect.y - rect.height,
        rect.width,
        rect.height,
      );
      renderer.setScissor(
        rect.x,
        h - rect.y - rect.height,
        rect.width,
        rect.height,
      );
      renderer.setScissorTest(true);
      renderer.render(this.scene, this.camera);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }
}
