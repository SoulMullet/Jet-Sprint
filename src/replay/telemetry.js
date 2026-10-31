import { S, SAMPLE_FIELDS } from "./model.js";
export const telemetryMetrics = {
  speed: ["Speed", "km/h", 3.6],
  throttle: ["Throttle", "%", 100],
  steering: ["Steering", "%", 100],
  slip: ["Drift / slip", "°", 180 / Math.PI],
  heading: ["Heading", "°", 180 / Math.PI],
  wy: ["Yaw angular velocity", "°/s", -180 / Math.PI],
  progress: ["Ordered course progress", "m", 1],
};
export function telemetryCSV(replay) {
  return (
    SAMPLE_FIELDS.join(",") +
    "\n" +
    replay.samples.map((row) => row.join(",")).join("\n") +
    "\n"
  );
}
export function graphSeries(rows, key, from, to, count = 240) {
  const selected = rows.filter((r) => r[0] >= from && r[0] <= to),
    result = [],
    factor = telemetryMetrics[key][2];
  if (!selected.length) return result;
  const stride = Math.max(1, Math.ceil(selected.length / count));
  for (let i = 0; i < selected.length; i += stride)
    result.push([selected[i][0], selected[i][S[key]] * factor]);
  const last = selected.at(-1);
  if (result.at(-1)?.[0] !== last[0])
    result.push([last[0], last[S[key]] * factor]);
  return result;
}
export class TelemetryGraph {
  constructor(parent, id) {
    this.root = document.createElement("div");
    this.root.className = "telemetry-graph";
    this.root.innerHTML = `<label>Graph channel<select id="${id}"></select></label><svg viewBox="0 0 600 160" role="img" aria-label="Recorded telemetry over race time"><path class="graph-grid" d="M35 10V135H590M35 52H590M35 94H590"/><path class="graph-reference"/><path class="graph-primary"/><path class="graph-playhead"/></svg><output></output><p class="graph-legend">SOLID / RUN · DASHED / PERSONAL BEST</p>`;
    parent.append(this.root);
    this.select = this.root.querySelector("select");
    for (const [k, v] of Object.entries(telemetryMetrics)) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = v[0];
      this.select.append(o);
    }
    this.paths = this.root.querySelectorAll("svg path");
    this.output = this.root.querySelector("output");
  }
  update(primary, reference, time, live = false) {
    if (!primary?.samples.length) {
      this.output.textContent = "Record a run to inspect telemetry.";
      for (let i = 1; i < 4; i++) this.paths[i].setAttribute("d", "");
      return;
    }
    const key = this.select.value,
      meta = telemetryMetrics[key],
      end = Math.max(0.1, live ? time : primary.official.total),
      from = live ? Math.max(0, end - 60) : 0,
      a = graphSeries(primary.samples, key, from, end),
      b = reference ? graphSeries(reference.samples, key, from, end) : [],
      values = [...a, ...b].map((p) => p[1]),
      min = Math.min(0, ...values),
      max = Math.max(min + 1, ...values),
      path = (rows) =>
        rows
          .map(
            ([t, v], i) =>
              `${i ? "L" : "M"}${(35 + ((t - from) / (end - from)) * 555).toFixed(1)},${(135 - ((v - min) / (max - min)) * 120).toFixed(1)}`,
          )
          .join(" ");
    this.paths[1].setAttribute("d", path(b));
    this.paths[2].setAttribute("d", path(a));
    const x = 35 + Math.max(0, Math.min(1, (time - from) / (end - from))) * 555;
    this.paths[3].setAttribute("d", `M${x.toFixed(1)} 10V135`);
    this.output.textContent = `${meta[0]} / ${min.toFixed(1)}–${max.toFixed(1)} ${meta[1]} · ${from.toFixed(1)}–${end.toFixed(1)} s${reference ? " · PB comparison" : " · No PB recording available"}`;
  }
}
