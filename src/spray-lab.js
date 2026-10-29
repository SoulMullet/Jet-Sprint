import { sprayControls } from "./spray-settings.js";
export function mountSprayLab(store, legacy) {
  const root = document.createElement("section");
  root.id = "sprayLab";
  root.setAttribute("aria-label", "Rooster Tail Laboratory");
  const intro = document.createElement("p");
  intro.textContent =
    "Build your rooster tail. Launch settings affect new drops; gravity and splashes respond immediately.";
  intro.className = "panel-description";
  root.append(intro);
  for (const [id, s] of Object.entries(sprayControls)) {
    const input = document.getElementById(id),
      label = input.closest("label"),
      note = document.createElement("small");
    note.textContent = s.description;
    label.append(note);
    root.append(label);
  }
  const reset = document.createElement("button");
  reset.id = "resetSpray";
  reset.type = "button";
  reset.textContent = "Reset spray defaults";
  reset.onclick = () => store.resetSpray();
  root.append(reset);
  const extra = document.createElement("details"),
    summary = document.createElement("summary");
  summary.textContent = "Existing water & spray controls";
  extra.append(summary);
  for (const id of ["effects", "sprayDistance", "waterVolume"])
    extra.append(document.getElementById(id).closest("label"));
  root.append(extra);
  const status = document.createElement("p");
  status.role = "status";
  status.id = "sprayStatus";
  root.append(status);
  store.subscribe((ids, notes = []) => {
    if (notes.length) status.textContent = notes.join(" ");
    else if (ids.some((id) => id.startsWith("spray")))
      status.textContent = "Changes apply live • Autosave enabled.";
  });
  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.textContent = "Open Spray Lab";
  shortcut.onclick = () => document.getElementById("pit-tab-spray").click();
  legacy.append(shortcut);
  document.body.append(root);
  return root;
}
