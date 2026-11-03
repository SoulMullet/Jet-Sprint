// Optional Playwright/Chromium QA. The game has no dependency on this driver.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createArcadeWorld } from "../src/arcade/river-world.js";
import { ControlSettings } from "../src/control-settings.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const output = fileURLToPath(new URL("../docs/arcade-river", import.meta.url));
await fs.mkdir(output, { recursive: true });
const { world } = createArcadeWorld(),
  controls = new ControlSettings({
    getItem() {
      return null;
    },
    setItem() {},
  }).values;
const careerRaw = await fs.readFile(
  new URL("../docs/multitouch-v8/qa-profile-v1.json", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const p = await browser.newPage({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    }),
    errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("ERROR", e.message);
  });
  p.on("console", (m) => {
    if (
      m.type() === "error" &&
      /WebGLProgram|ERROR: 0:|invalid shader/i.test(m.text())
    )
      errors.push(m.text());
  });
  await p.addInitScript(
    ({ careerRaw, controls, route, branch, branchStart, branchEnd }) => {
      const raf = requestAnimationFrame.bind(window);
      requestAnimationFrame = (fn) => {
        if (
          /^function\s*\w*\([^)]*\)\{requestAnimationFrame\(/.test(String(fn))
        ) {
          window.gameFrame = fn;
          return 1;
        }
        return raf(fn);
      };
      window.syncClock = () => (window.qaClock = performance.now());
      window.advance = (ms = 50) => {
        qaClock += ms;
        gameFrame(qaClock);
      };
      // Suppress draw calls only during accelerated simulation. Actual rendered
      // screenshots turn this off; no forces, positions, gates or timers are mocked.
      for (const C of [
        globalThis.WebGLRenderingContext,
        globalThis.WebGL2RenderingContext,
      ])
        if (C)
          for (const k of [
            "drawArrays",
            "drawElements",
            "drawArraysInstanced",
            "drawElementsInstanced",
          ]) {
            const original = C.prototype[k];
            if (original)
              C.prototype[k] = function (...args) {
                if (!window.skipDraws) return original.apply(this, args);
              };
          }
      window.pads = [];
      Object.defineProperty(navigator, "getGamepads", { value: () => pads });
      if (!localStorage.getItem("jet-sprint-player-profile-v1")) {
        localStorage.setItem("jet-sprint-player-profile-v1", careerRaw);
        localStorage.setItem(
          "jet-sprint-settings",
          JSON.stringify({
            schemaVersion: 3,
            settings: { graphics: "low", musicVolume: 31 },
          }),
        );
        localStorage.setItem(
          "jet-sprint-v8-settings",
          JSON.stringify({
            type: "jet-sprint-v8",
            schemaVersion: 1,
            preset: "custom",
            settings: { engineVolume: 42 },
          }),
        );
      }
      window.qa = {
        route,
        branch,
        branchStart,
        branchEnd,
        controls,
        jumpSeen: false,
        failDrive: false,
        cut: false,
        frames: 0,
      };
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const project = (line, b) => {
        let best = Infinity,
          d = 0;
        for (let i = 0; i < line.length - 1; i++) {
          const p = line[i],
            q = line[i + 1],
            x = q.x - p.x,
            z = q.z - p.z,
            t = clamp(
              ((b.x - p.x) * x + (b.z - p.z) * z) / (x * x + z * z),
              0,
              1,
            ),
            e = (p.x + x * t - b.x) ** 2 + (p.z + z * t - b.z) ** 2;
          if (e < best) {
            best = e;
            d = p.distance + (q.distance - p.distance) * t;
          }
        }
        return d;
      };
      const sample = (line, d) => {
        let i = 0;
        while (i < line.length - 2 && line[i + 1].distance < d) i++;
        const p = line[i],
          q = line[i + 1],
          n = q.distance - p.distance,
          t = clamp((d - p.distance) / n, 0, 1);
        return {
          x: p.x + (q.x - p.x) * t,
          z: p.z + (q.z - p.z) * t,
          tx: (q.x - p.x) / n,
          tz: (q.z - p.z) / n,
        };
      };
      window.driveChunk = async (count = 160) => {
        for (let n = 0; n < count; n++) {
          const status = __JET_SPRINT_ARCADE__.inspect();
          if (["FINISHED", "FAILED"].includes(status.state)) return status;
          const b = __JET_SPRINT_PHYSICS__.inspect().boat,
            speed = Math.hypot(b.vx, b.vz),
            d = project(qa.route, b);
          let line = qa.route,
            distance = d;
          if (qa.cut && d > qa.branchStart - 30 && d < qa.branchEnd - 12) {
            line = qa.branch;
            distance = project(line, b);
          }
          const target = sample(line, distance + 12 + speed * 0.5);
          if (line === qa.branch) {
            target.x += target.tz * 3;
            target.z -= target.tx * 3;
          }
          const a = Math.atan2(target.z - b.z, target.x - b.x) - b.angle,
            angle = Math.atan2(Math.sin(a), Math.cos(a)),
            desired = qa.failDrive
              ? -1
              : clamp(angle * 2.2 - b.yawRate * 0.75, -1, 1),
            v = qa.controls,
            sign = Math.sign(desired);
          const inner =
            clamp(
              Math.abs(desired) /
                Math.max(
                  0.1,
                  v.steerSensitivity *
                    (1 -
                      (v.speedSteering / 100) *
                        Math.min(1, speed / (78 * 0.44704))),
                ),
              0,
              1,
            ) **
              (1 / v.steerCurve) *
              (1 - v.steerDeadzone) +
            v.steerDeadzone;
          const raw =
            sign *
            (clamp(inner / v.padSensitivity, 0, 1) ** (1 / v.padCurve) *
              (1 - v.padDeadzone) +
              v.padDeadzone);
          pads[0].axes[0] = raw;
          advance();
          qa.frames++;
          if (n % 15 === 0) await new Promise((r) => setTimeout(r, 0));
          const c = __JET_SPRINT_CAMPAIGN__.inspect();
          if (!qa.jumpSeen && c.airborne && c.height > 2) {
            qa.jumpSeen = true;
            return { ...__JET_SPRINT_ARCADE__.inspect(), screenshotJump: true };
          }
        }
        return __JET_SPRINT_ARCADE__.inspect();
      };
    },
    {
      careerRaw,
      controls,
      route: world.river.line,
      branch: world.shortcut.path.line,
      branchStart: world.shortcut.start,
      branchEnd: world.shortcut.end,
    },
  );
  const base =
      process.env.JET_SPRINT_URL || "http://localhost:4270/Jet-Sprint/",
    url = new URL(base);
  url.searchParams.set("mode", "arcade-river");
  await p.goto(url.href, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(
    () => globalThis.__JET_SPRINT_ARCADE__,
    {},
    { timeout: 90000 },
  );
  await p.evaluate(() => {
    syncClock();
    advance();
  });
  for (const a of await p.locator(".mode-selector a").all()) {
    const r = await a.boundingBox();
    assert.ok(r.y >= 0 && r.y + r.height <= 390);
  }
  await p.screenshot({ path: output + "/title-landscape.png" });
  await p.locator("#start").click();
  await p.evaluate(() => {
    syncClock();
    advance(1000);
    advance();
  });
  assert.equal(await p.locator("#arcadeThrottle").isVisible(), false);
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().boat.throttle),
    1,
  );
  const cd = await p.context().newCDPSession(p),
    rect = await p.locator("#steerLeft").boundingBox(),
    finger = { id: 1, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger],
  });
  await p.evaluate(() => advance());
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_INPUT__.inspect().steering),
    -1,
  );
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.evaluate(() => advance());
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().boat.throttle),
    1,
  );
  await p.keyboard.press("r");
  await p.evaluate(() => {
    syncClock();
    advance(1000);
    advance();
    pads = [
      {
        index: 0,
        id: "Standard QA gamepad",
        mapping: "standard",
        connected: true,
        axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
      },
    ];
    advance();
    skipDraws = true;
  });
  const runs = [];
  for (const cut of [false, true]) {
    if (cut) {
      await p.locator("#raceRestart").click();
      await p.evaluate(() => {
        syncClock();
        qa.cut = true;
        qa.jumpSeen = true;
        pads[0].axes[0] = 0;
        advance(1000);
        advance();
        advance();
        skipDraws = true;
      });
    }
    let state;
    for (let i = 0; i < 24; i++) {
      state = await p.evaluate(() => driveChunk());
      console.log(
        "RUN",
        cut ? "cut" : "safe",
        Math.round(state.time),
        state.state,
        state.cash,
      );
      if (state.screenshotJump) {
        await p.evaluate(() => {
          skipDraws = false;
          advance(0);
        });
        await p.screenshot({ path: output + "/jump.png" });
        await p.evaluate(() => (skipDraws = true));
      }
      if (["FINISHED", "FAILED"].includes(state.state)) break;
    }
    assert.equal(state.state, "FINISHED", JSON.stringify(state));
    assert.equal(state.jumps, 2);
    assert.ok(state.time >= 55 && state.time < 100);
    runs.push(state);
    await p.evaluate(() => {
      skipDraws = false;
      advance(0);
    });
    await p.screenshot({
      path: output + (cut ? "/shortcut-results.png" : "/results.png"),
    });
    assert.equal(await p.locator("#results").isVisible(), true);
    assert.match(await p.locator("#resultStats").innerText(), /CASH/);
    for (const id of ["resultTitle", "raceRestart"]) {
      const r = await p.locator("#" + id).boundingBox();
      assert.ok(r.y >= 0 && r.y + r.height <= 390, id + " fits");
    }
    if (!cut) {
      await p.setViewportSize({ width: 568, height: 320 });
      await p.evaluate(() => advance(0));
      for (const id of ["resultTitle", "raceRestart"]) {
        const r = await p.locator("#" + id).boundingBox();
        assert.ok(
          r.y >= 0 && r.y + r.height <= 320,
          id + " fits short landscape",
        );
      }
      await p.screenshot({ path: output + "/results-short-landscape.png" });
      await p.setViewportSize({ width: 844, height: 390 });
      await p.evaluate(() => advance(0));
    }
  }
  const saved = await p.evaluate(() =>
    localStorage.getItem("jet-sprint-arcade-river-records-v1"),
  );
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("jet-sprint-player-profile-v1"),
    ),
    careerRaw,
  );
  await p.keyboard.press("r");
  await p.evaluate(() => {
    syncClock();
    qa.failDrive = true;
    qa.jumpSeen = true;
    pads[0].axes[0] = 0;
    advance(1000);
    advance();
    advance();
    skipDraws = true;
  });
  let failed;
  for (let i = 0; i < 22; i++) {
    failed = await p.evaluate(() => driveChunk());
    if (failed.state === "FAILED") break;
  }
  assert.equal(failed.state, "FAILED");
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("jet-sprint-arcade-river-records-v1"),
    ),
    saved,
  );
  await p.evaluate(() => {
    skipDraws = false;
    advance(0);
  });
  await p.screenshot({ path: output + "/failure.png" });
  await p.locator("#raceRestart").click();
  await p.evaluate(() => {
    syncClock();
    advance(700);
    advance();
  });
  assert.equal(await p.locator("#results").isVisible(), false);
  assert.equal(await p.evaluate(() => __JET_SPRINT_ARCADE__.inspect().cash), 0);
  await p.locator("#pauseToggle").click();
  await p.locator("#pauseSetup").click();
  await p.locator("#pit-tab-physics").click();
  await p.locator(".arcade-tuning>summary").first().click();
  await p.locator("#arcade-impactRecovery").evaluate((el) => {
    el.value = 0.75;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.locator("#pit-tab-camera").click();
  await p.locator(".arcade-tuning>summary").last().click();
  await p.locator("#arcade-distance").evaluate((el) => {
    el.value = 27;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.screenshot({ path: output + "/camera-lab.png" });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => globalThis.__JET_SPRINT_ARCADE__);
  const restored = await p.evaluate(() => __JET_SPRINT_ARCADE__.inspect());
  assert.equal(restored.settings.distance, 27);
  assert.equal(restored.settings.impactRecovery, 0.75);
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("jet-sprint-arcade-river-records-v1"),
    ),
    saved,
  );
  assert.equal(
    await p.evaluate(() =>
      localStorage.getItem("jet-sprint-player-profile-v1"),
    ),
    careerRaw,
  );
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => globalThis.__JET_SPRINT_GARAGE__);
  assert.equal(await p.locator("#introGarage").isVisible(), true);
  await p.locator("#start").click();
  await p.evaluate(() => {
    syncClock();
    advance(7000);
    advance();
  });
  assert.equal(await p.locator("#arcadeThrottle").isVisible(), true);
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().boat.throttle),
    0,
  );
  const fresh = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  fresh.on("pageerror", (e) => errors.push(e.message));
  await fresh.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await fresh.goto(url.href, { waitUntil: "domcontentloaded" });
  await fresh.waitForFunction(
    () => globalThis.__JET_SPRINT_ARCADE__,
    {},
    { timeout: 90000 },
  );
  const freshCareer = await fresh.evaluate(() =>
    JSON.parse(localStorage.getItem("jet-sprint-player-profile-v1")),
  );
  assert.equal(freshCareer.cash, 600);
  assert.equal(freshCareer.career.unlockedCourses.length, 1);
  await fresh.goto(base, { waitUntil: "domcontentloaded" });
  await fresh.waitForFunction(() => globalThis.__JET_SPRINT_GARAGE__);
  assert.equal(
    await fresh.evaluate(
      () =>
        __JET_SPRINT_GARAGE__.inspect().profile.career.unlockedCourses.length,
    ),
    1,
  );
  await fresh.close();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    output + "/browser-proof.json",
    JSON.stringify(
      {
        method:
          "Production build in Chromium 844×390 touch emulation; native CDP steering and standard Gamepad API test driver. Most GPU draws suppressed during accelerated runs; screenshots use real rendering. No boat poses, physics, gates, results or timers injected. Not physical device/FPS/subjective-feel testing.",
        runs,
        failure: failed,
        autoThrottleAndTouch: true,
        retryUnderOneLogicalSecond: true,
        persistence: true,
        careerUntouchedInArcade: true,
        originalRacingManualThrottle: true,
        firstArcadeVisitPreservesRacingUnlocks: true,
        shortLandscapeResults: true,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("ARCADE BROWSER PASS");
} finally {
  await browser.close();
}
