export function restoreNitrousProjection(applied) {
  if (!applied) return;
  const { camera, before, after } = applied,
    key = camera.isPerspectiveCamera ? "fov" : "zoom";
  if (Math.abs(camera[key] - after) < 1e-6) {
    camera[key] = before;
    camera.updateProjectionMatrix();
  }
}
// One presentation layer; restore projection before the existing camera system updates.
export class NitrousEffects {
  constructor() {
    this.amount = 0;
    this.applied = null;
    this.overlay = document.createElement("div");
    this.overlay.id = "nitroStreaks";
    this.overlay.setAttribute("aria-hidden", "true");
    this.overlay.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 16 8 23 M0 40 6 42 M0 75 10 68 M100 15 93 22 M100 42 95 44 M100 78 90 70"/></svg>';
    document.body.append(this.overlay);
  }
  restore() {
    if (!this.applied) return;
    restoreNitrousProjection(this.applied);
    this.applied = null;
  }
  update(camera, dt, active, intensity = 0.6, allowed = true) {
    this.amount +=
      (Number(active && allowed) - this.amount) * (1 - Math.exp(-dt * 7));
    const a = this.amount * intensity;
    this.overlay.style.opacity = String(a * 0.3);
    document.body.classList.toggle("nitro-active", this.amount > 0.1);
    if (!allowed || a < 0.001) return;
    const fov = a * 2.2,
      zoom = 1 - a * 0.018;
    const before = camera.isPerspectiveCamera ? camera.fov : camera.zoom;
    if (camera.isPerspectiveCamera) camera.fov += fov;
    else camera.zoom *= zoom;
    camera.updateProjectionMatrix();
    this.applied = {
      camera,
      before,
      after: camera.isPerspectiveCamera ? camera.fov : camera.zoom,
    };
  }
}
