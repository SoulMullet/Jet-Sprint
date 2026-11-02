// Native OfflineAudioContext rendering of the real recordings; no listening claim.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const outputDir = fileURLToPath(
  new URL("../docs/multitouch-v8", import.meta.url),
);
const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const p = await b.newPage();
  await p.route("**/multi-engine-test", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Multi V8 render</title>",
    }),
  );
  await p.goto(
    new URL(
      "multi-engine-test",
      process.env.JET_SPRINT_DEV_URL || "http://localhost:4264/",
    ).href,
  );
  const report = await p.evaluate(async () => {
    const { Engine } = await import("/src/audio.js"),
      { defaultAudio, audioControls } = await import("/src/audio-settings.js");
    const out = [];
    for (const mode of ["default", "max", "wav", "missing-new", "missing"]) {
      let time = 0,
        oscillators = 0;
      const c = new OfflineAudioContext(2, 48000 * 24, 48000),
        proxy = new Proxy(c, {
          get(o, k) {
            if (k === "currentTime") return time;
            if (k === "state") return "running";
            if (k === "resume") return () => Promise.resolve();
            if (k === "createOscillator")
              return () => {
                oscillators++;
                return o.createOscillator();
              };
            const v = o[k];
            return typeof v === "function" ? v.bind(o) : v;
          },
        });
      const settings =
        mode === "max"
          ? Object.fromEntries(
              Object.entries(audioControls).map(([k, v]) => [
                k,
                k === "engineMute" ? 0 : v.max,
              ]),
            )
          : defaultAudio();
      const fetcher =
        mode === "missing"
          ? () => Promise.reject(Error("forced unavailable"))
          : mode === "wav"
            ? (url) =>
                url.endsWith(".m4a")
                  ? Promise.resolve(
                      new Response(new Uint8Array([0, 12, 13, 99])),
                    )
                  : fetch(url)
            : mode === "missing-new"
              ? (url) =>
                  /Engine(?:CruiseLayerTwo|HighRev|RevOut)\./.test(url)
                    ? Promise.resolve(new Response("", { status: 404 }))
                    : fetch(url)
              : fetch;
      const e = new Engine({
        settings,
        baseURL: "/",
        createContext: () => proxy,
        fetcher,
      });
      await e.start();
      const frames = [],
        active = new Set();
      for (let n = 0; n < 24 * 60; n++) {
        time = n / 60;
        let throttle =
          time < 3
            ? 0
            : time < 7
              ? 0.85
              : time < 9
                ? 0.7
                : time < 10.2
                  ? 0
                  : time < 16
                    ? 0.85
                    : time < 18
                      ? 1
                      : 0;
        const contact = {
          airborne: time >= 12 && time < 14,
          landed: n === 14 * 60,
        };
        e.update(
          time < 7 ? 0 : time >= 16 && time < 18 ? 24 : 18,
          throttle,
          1 / 60,
          24,
          false,
          0.7,
          {
            planing: 0.65,
            lateralSpeed: time >= 7 && time < 9 ? 5 : 0,
            yawRate: 0.4,
            forwardAcceleration: time < 5 ? 4 : 0,
            engineStage: 4,
            nitrous: time >= 14 && time < 18 ? 1 : 0,
          },
          contact,
        );
        const d = e.inspect();
        for (const l of d.layers) if (l.weight > 0.01) active.add(l.id);
        if (
          n % 60 === 0 ||
          n === 9 * 60 ||
          n === Math.ceil(10.2 * 60) ||
          n === 12 * 60 + 12 ||
          n === 14 * 60
        )
          frames.push({ time, ...d });
      }
      const audio = await c.startRendering();
      let peak = 0,
        energy = 0,
        maxStep = 0;
      const rms = [];
      for (let ch = 0; ch < 2; ch++) {
        const d = audio.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          const v = d[i];
          if (!Number.isFinite(v)) throw Error("Nonfinite output");
          peak = Math.max(peak, Math.abs(v));
          energy += v * v;
          if (i) maxStep = Math.max(maxStep, Math.abs(v - d[i - 1]));
        }
        if (ch === 0)
          for (let sec = 0; sec < 24; sec++) {
            let energy = 0;
            for (let i = sec * 48000; i < (sec + 1) * 48000; i++)
              energy += d[i] ** 2;
            rms.push(Math.sqrt(energy / 48000));
          }
      }
      out.push({
        mode,
        peak,
        rms: Math.sqrt(energy / (audio.length * 2)),
        oneSecondRMS: rms,
        maxStep,
        oscillators,
        activeRoles: [...active],
        final: e.inspect(),
        frames,
      });
    }
    return out;
  });
  for (const r of report) {
    assert.equal(r.oscillators, 0);
    assert.ok(r.peak < 0.86);
    if (r.mode === "missing") {
      assert.equal(r.peak, 0);
      assert.equal(r.final.loopSources, 0);
    } else {
      assert.equal(r.final.loopSources, r.mode === "missing-new" ? 4 : 7);
      assert.equal(Object.keys(r.final.samples).length, 9);
      assert.ok(r.oneSecondRMS.every((x) => x > 0.0005));
      for (const role of r.mode === "missing-new"
        ? ["idle", "rev", "revDown", "cruise", "cruiseOne", "jump"]
        : [
            "idle",
            "rev",
            "revDown",
            "cruise",
            "cruiseOne",
            "jump",
            "cruiseTwo",
            "highRev",
            "revOut",
          ])
        assert.ok(r.activeRoles.includes(role), r.mode + "/" + role);
      assert.ok(r.frames.some((f) => f.airborne));
      assert.ok(r.frames.some((f) => f.state === "landing"));
      const reapplied = r.frames.find((f) => f.time === 10.2);
      assert.equal(reapplied.revDown, false);
    }
  }
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    outputDir + "/audio-proof.json",
    JSON.stringify(
      report.map((r) => ({
        ...r,
        frames: r.frames.map(
          ({
            time,
            rpm,
            load,
            airborne,
            flightBlend,
            state,
            highRPMBlend,
            loopSources,
            layers,
          }) => ({
            time,
            rpm,
            load,
            airborne,
            flightBlend,
            state,
            highRPMBlend,
            loopSources,
            layers: layers
              .filter((l) => l.weight > 0.001)
              .map(({ id, weight, playbackRate }) => ({
                id,
                weight,
                playbackRate,
              })),
          }),
        ),
      })),
      null,
      2,
    ) + "\n",
  );
  console.log(
    report.map((r) => ({
      mode: r.mode,
      peak: r.peak,
      rms: r.rms,
      roles: r.activeRoles,
      samples: r.final.samples,
    })),
  );
  console.log("RENDER PASS");
} finally {
  await b.close();
}
