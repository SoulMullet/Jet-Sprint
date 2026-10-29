import { setInstrumentText } from "./typography.js";
const polar = (r, degrees) => {
  const a = (degrees * Math.PI) / 180;
  return [80 + Math.cos(a) * r, 80 + Math.sin(a) * r];
};
export function mountInstrumentGauge(root) {
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const a = -210 + i * 10,
      p = polar(i % 2 ? 60 : 57, a),
      q = polar(65, a);
    return `<path d="M${p}L${q}" class="${i > 19 ? "dial-red" : "dial-tick"}"/>`;
  }).join("");
  const labels = [0, 1, 2, 3]
    .map((i) => {
      const p = polar(48, -210 + i * 80);
      return `<text id="dial-number-${i}" x="${p[0]}" y="${p[1] + 3}">${i * 40}</text>`;
    })
    .join("");
  root.innerHTML = `<div class="dial-bezel"><svg class="dial-face" viewBox="0 0 160 160" aria-hidden="true"><circle class="dial-paper" cx="80" cy="80" r="73"/><circle class="dial-rim" cx="80" cy="80" r="67"/>${ticks}${labels}<path id="rev" class="dial-revs" d="M30 111 A59 59 0 1 1 130 111" pathLength="100"/><g id="speedNeedle" class="dial-needle"><path d="M77 82 80 24 83 82Z"/><circle cx="80" cy="80" r="6"/></g><text class="dial-brand" x="80" y="55">MARINE</text></svg><div class="dial-digital"><strong id="speed">0</strong><span>KM/H</span></div><div class="dial-rpm"><output id="hudRPM">900</output><span>RPM</span></div></div>`;
  const rpm = root.querySelector("#hudRPM"),
    arc = root.querySelector("#rev"),
    needle = root.querySelector("#speedNeedle"),
    labelsNodes = [0, 1, 2, 3].map((i) =>
      root.querySelector("#dial-number-" + i),
    );
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  let clock = 1,
    lastMax = 0,
    shown = 0;
  return {
    update(dt, engineRPM, maxRPM, speed = 0, top = 85) {
      shown = reduced?.matches
        ? speed
        : shown + (speed - shown) * (1 - Math.exp(-dt * 12));
      clock += dt;
      if (clock < 0.05) return;
      clock = 0;
      const dialMax = Math.ceil(top / 60) * 60;
      if (dialMax !== lastMax) {
        lastMax = dialMax;
        labelsNodes.forEach(
          (n, i) => (n.textContent = Math.round((dialMax * i) / 3)),
        );
      }
      needle.setAttribute(
        "transform",
        `rotate(${-120 + Math.min(1, Math.max(0, shown / dialMax)) * 240} 80 80)`,
      );
      arc.style.strokeDasharray = `${Math.min(100, Math.max(0, (engineRPM / maxRPM) * 100))} 100`;
      setInstrumentText(rpm, Math.max(0, Math.round(engineRPM || 0)));
      root.classList.toggle("redline", engineRPM >= maxRPM * 0.95);
    },
  };
}
