// Optional Playwright/Chromium QA. The game has no dependency on this driver.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createArcadeWorld } from "../src/arcade/river-world.js";
import { ControlSettings } from "../src/control-settings.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const output =
  process.env.ARCADE_QA_OUTPUT ||
  fileURLToPath(new URL("../docs/arcade-river", import.meta.url));
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
async function verifyRampApproaches(p, url) {
  const results = [];
  const ramps = await p.evaluate(() => __JET_SPRINT_ARCADE__.inspect().ramps);
  const cd = await p.context().newCDPSession(p);
  const source = await p.evaluate(() => String(gameFrame)),
    boatName = /Math\.hypot\((\w+)\.vx,\1\.vz\)/.exec(source)?.[1];
  assert.ok(
    boatName,
    "Actual game frame exposes its boat in the debugger scope",
  );
  const tourName = new RegExp(
    "(\\w+)\\.beforePhysics\\(" + boatName + ",",
  ).exec(source)?.[1];
  assert.ok(tourName);
  const fn = (await cd.send("Runtime.evaluate", { expression: "gameFrame" }))
    .result.objectId;
  try {
    for (const [index, ramp] of ramps.entries())
      for (const lane of [-0.9, 0, 0.9]) {
        await p.keyboard.press("r");
        await p.evaluate(() => {
          syncClock();
          skipDraws = true;
          pads = [];
          advance(1000);
          advance();
        });
        const at = world.river.sample(ramp.distance),
          offset = (lane * ramp.width) / 2,
          initial = {
            x: at.x - at.tx * 14 - at.tz * offset,
            z: at.z - at.tz * 14 + at.tx * offset,
            angle: Math.atan2(at.tz, at.tx),
            vx: at.tx * 32,
            vz: at.tz * 32,
            pump: 1,
            nozzle: 0,
            yawRate: 0,
            collisionImpulse: 0,
          };
        // Read the real frame's live module scope through DevTools. The production
        // game ships no teleport/test setter. Only approach preconditions change;
        // launch, collision, water contact and landing still run in the actual frame.
        const fnProps = await cd.send("Runtime.getProperties", {
            objectId: fn,
            ownProperties: true,
          }),
          scopesId = fnProps.internalProperties.find(
            (p) => p.name === "[[Scopes]]",
          ).value.objectId,
          scopes = await cd.send("Runtime.getProperties", {
            objectId: scopesId,
            ownProperties: true,
          });
        let variables;
        for (const entry of scopes.result.filter((p) => /^\d+$/.test(p.name))) {
          const props = await cd.send("Runtime.getProperties", {
            objectId: entry.value.objectId,
            ownProperties: true,
          });
          if (props.result.some((p) => p.name === boatName)) {
            variables = props.result;
            break;
          }
        }
        assert.ok(
          variables,
          "Live game module scope available to the QA debugger",
        );
        const boatId = variables.find((p) => p.name === boatName).value
            .objectId,
          tourId = variables.find((p) => p.name === tourName).value.objectId;
        const setup = await cd.send("Runtime.callFunctionOn", {
          objectId: boatId,
          functionDeclaration: "function(p){Object.assign(this,p);return true}",
          arguments: [{ value: initial }],
          returnByValue: true,
        });
        assert.equal(setup.result.value, true, JSON.stringify(setup));
        await cd.send("Runtime.callFunctionOn", {
          objectId: tourId,
          functionDeclaration:
            "function(d){this.routeDistance=d;this.practice=true;this.leaf.practice=true;}",
          arguments: [{ value: ramp.distance - 14 }],
        });
        const result = await p.evaluate(() => {
          let launched = false,
            landed = false,
            maxHeight = 0,
            minAfterLanding = Infinity,
            impact = 0;
          for (let i = 0; i < 270; i++) {
            advance(10);
            const c = __JET_SPRINT_CAMPAIGN__.inspect(),
              b = __JET_SPRINT_PHYSICS__.inspect().boat;
            launched ||= c.airborne;
            landed ||= launched && !c.airborne;
            maxHeight = Math.max(maxHeight, c.height);
            impact = Math.max(impact, b.collisionImpulse || 0);
            if (landed)
              minAfterLanding = Math.min(
                minAfterLanding,
                Math.hypot(b.vx, b.vz),
              );
          }
          return {
            launched,
            landed,
            maxHeight,
            minAfterLanding,
            impact,
            throttle: __JET_SPRINT_PHYSICS__.inspect().boat.throttle,
          };
        });
        console.log("SEEDED RAMP", index, lane, JSON.stringify(result));
        assert.equal(result.launched, true);
        assert.equal(result.landed, true);
        assert.equal(result.impact, 0);
        assert.ok(result.minAfterLanding > 25);
        results.push({ ramp: ramp.id, lane, offset, ...result });
      }
  } finally {
    await cd.detach();
    await p.evaluate(() => {
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
    });
  }
  return results;
}
async function verifyDeveloperDrag(p, url) {
  const devURL = new URL(url);
  devURL.searchParams.set("dev", "1");
  await p.goto(devURL.href, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => globalThis.__JET_SPRINT_INPUT__);
  await p.locator("#start").click();
  await p.evaluate(() => {
    syncClock();
    skipDraws = true;
    advance(1000);
    advance();
  });
  const cd = await p.context().newCDPSession(p),
    finger = { id: 5, x: 410, y: 290 };
  const send = async (type, points) => {
    await cd.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await p.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
  };
  await send("touchStart", [finger]);
  finger.x = 550;
  await send("touchMove", [finger]);
  await p.evaluate(() => {
    for (let i = 0; i < 30; i++) advance(10);
    skipDraws = false;
    advance(0);
  });
  assert.ok(await p.locator("#arcadeSteeringDebug").isVisible());
  assert.match(
    await p.locator("#arcadeSteeringDebug").innerText(),
    /0\.31\.1.*STEER 1\.000/,
  );
  await p.screenshot({ path: output + "/drag-debug.png" });
  await p.evaluate(() =>
    document
      .querySelector("#game canvas")
      .releasePointerCapture(__JET_SPRINT_INPUT__.inspect().drag.pointer),
  );
  await p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  await p.evaluate(() => {
    skipDraws = true;
    advance(10);
  });
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_INPUT__.inspect().steering),
    0,
  );
  await send("touchEnd", []);
  const geometry = await p.evaluate(() => ({
    touchAction: getComputedStyle(document.querySelector("#game canvas"))
      .touchAction,
    scale: visualViewport.scale,
    scrollX,
    scrollY,
    selection: String(getSelection()),
  }));
  assert.equal(geometry.touchAction, "none");
  assert.equal(geometry.scale, 1);
  assert.equal(geometry.scrollX, 0);
  assert.equal(geometry.scrollY, 0);
  assert.equal(geometry.selection, "");
  console.log("DEVELOPER DRAG / NATIVE CAPTURE LOSS PASS");
  return {
    indicatorOnlyWithDevFlag: true,
    nativeCaptureLossClears: true,
    ...geometry,
  };
}
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
        approachIndex: 0,

        laneProof: [],
        flightSeen: false,
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
          const nearRamp = status.ramps.find(
            (r) => d > r.distance - 130 && d < r.distance + 70,
          );
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
          if (c.airborne && !qa.flightSeen) {
            const actual = __JET_SPRINT_PHYSICS__.inspect().boat,
              jump = status.ramps.reduce((a, r) =>
                Math.abs(r.distance - d) < Math.abs(a.distance - d) ? r : a,
              ),
              at = sample(qa.route, jump.distance),
              offset = -(actual.x - at.x) * at.tz + (actual.z - at.z) * at.tx;
            qa.laneProof.push({
              ramp: jump.id,
              offset,
              fraction: offset / (jump.width / 2),
              takeoffSpeed: Math.hypot(actual.vx, actual.vz),
              maxHeight: c.height,
              landed: false,
            });
          }
          const flight = qa.laneProof.at(-1);
          if (c.airborne && flight)
            flight.maxHeight = Math.max(flight.maxHeight, c.height);
          if (qa.flightSeen && !c.airborne && flight) {
            const actual = __JET_SPRINT_PHYSICS__.inspect().boat;
            flight.landed = true;
            flight.landingSpeed = Math.hypot(actual.vx, actual.vz);
          }
          qa.flightSeen = c.airborne;
          const ramp = __JET_SPRINT_ARCADE__.inspect().ramps[qa.approachIndex];
          if (!qa.cut && ramp && d > ramp.distance - 29) {
            qa.approachIndex++;
            return {
              ...__JET_SPRINT_ARCADE__.inspect(),
              screenshotRamp: qa.approachIndex,
            };
          }
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
    skipDraws = true;
    syncClock();
    advance(1000);
    advance();
  });
  assert.equal(await p.locator("#arcadeControls").count(), 0);
  const cd = await p.context().newCDPSession(p),
    finger = { id: 1, x: 410, y: 275 };
  const touch = async (type, points) => {
    await cd.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    // Chromium coalesces pointermove to its next native display frame. Let that
    // event reach the real canvas adapter before advancing the QA clock.
    await p.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
  };
  const live = () =>
    p.evaluate(() => ({
      input: __JET_SPRINT_INPUT__.inspect(),
      boat: __JET_SPRINT_PHYSICS__.inspect().boat,
    }));
  const advance = (n) =>
    p.evaluate((n) => {
      for (let i = 0; i < n; i++) window.advance(10);
    }, n);
  await touch("touchStart", [finger]);
  await advance(5);
  assert.equal((await live()).input.steering, 0);
  finger.y = 220;
  await touch("touchMove", [finger]);
  await advance(5);
  assert.equal((await live()).input.steering, 0);
  finger.x = 320;
  await touch("touchMove", [finger]);
  await advance(20);
  const left = await live();
  assert.ok(left.input.steering < -0.99, JSON.stringify(left));
  assert.equal(left.boat.throttle, 1);
  const second = { id: 2, x: 550, y: 270 };
  await touch("touchStart", [finger, second]);
  second.x = 650;
  await touch("touchMove", [finger, second]);
  await advance(5);
  assert.ok((await live()).input.steering < -0.99);
  await touch("touchEnd", [second]);
  await advance(5);
  assert.ok((await live()).input.steering < -0.99);
  finger.x = 500;
  await touch("touchMove", [finger]);
  await advance(30);
  const right = await live();
  assert.ok(right.input.steering > 0.99);
  assert.equal(right.boat.throttle, 1);
  await advance(20);
  assert.ok((await live()).input.steering > 0.99);
  await touch("touchEnd", []);
  await advance(10);
  const halfway = await live();
  assert.ok(halfway.input.steering > 0.45 && halfway.input.steering < 0.55);
  await advance(11);
  assert.equal((await live()).input.steering, 0);
  assert.equal((await live()).boat.throttle, 1);
  // Same actual pointer path through cancellation and the real pause button.
  finger.x = 410;
  finger.y = 275;
  await touch("touchStart", [finger]);
  finger.x = 320;
  await touch("touchMove", [finger]);
  await advance(20);
  await touch("touchCancel", []);
  await advance(1);
  assert.equal((await live()).input.steering, 0);
  finger.x = 410;
  await touch("touchStart", [finger]);
  finger.x = 500;
  await touch("touchMove", [finger]);
  await advance(20);
  await p.locator("#pauseToggle").click();
  await advance(1);
  assert.equal((await live()).input.steering, 0);
  assert.equal((await live()).input.drag.pointer, null);
  await touch("touchEnd", []);
  await p.locator("#resumeRace").click();
  assert.equal(await p.locator("#arcadeSteeringDebug").count(), 0);
  const rampDefinitions = await p.evaluate(
    () => __JET_SPRINT_ARCADE__.inspect().ramps,
  );
  for (const [i, r] of rampDefinitions.entries()) {
    assert.ok(Math.abs(r.visibleWidth - r.collisionWidth) < 0.00001);
    assert.ok(
      Math.abs(r.width / r.usableWidth - (i === 0 ? 0.85 : 0.75)) < 1e-8,
    );
  }
  const dragProof = {
    left: left.input.steering,
    right: right.input.steering,
    releaseAt100ms: halfway.input.steering,
    releaseAt210ms: 0,
    autoThrottle: 1,
    verticalNeutral: true,
    secondaryIgnored: true,
    cancelCleared: true,
    pauseButton: true,
  };
  console.log("DRAG", JSON.stringify(dragProof));
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
        qa.laneProof = [];
        qa.flightSeen = false;
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
      if (state.screenshotRamp) {
        await p.evaluate(() => {
          skipDraws = false;
          advance(0);
        });
        await p.screenshot({
          path:
            output +
            (state.screenshotRamp === 1
              ? "/after-ramp.png"
              : "/second-ramp.png"),
        });
        if (state.screenshotRamp === 1)
          await fs.writeFile(
            output + "/after.json",
            JSON.stringify(
              await p.evaluate(() => ({
                arcade: __JET_SPRINT_ARCADE__.inspect(),
                boat: __JET_SPRINT_PHYSICS__.inspect().boat,
              })),
              null,
              2,
            ),
          );
        await p.evaluate(() => (skipDraws = true));
      }
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
    runs.push({ ...state, lanes: await p.evaluate(() => qa.laneProof) });
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
  const seededRampRuns = await verifyRampApproaches(p, url);
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
  await p.locator("#control-arcadeDragDistance").evaluate((el) => {
    el.value = 110;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await p.locator("#control-arcadeDragReturn").evaluate((el) => {
    el.value = 0.23;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const dragDistance = p.locator("#control-arcadeDragDistance");
  await dragDistance.scrollIntoViewIfNeeded();
  await dragDistance.focus();
  await dragDistance.press("ArrowRight");
  await dragDistance.press("ArrowLeft");
  assert.equal(await dragDistance.inputValue(), "110");
  await p.screenshot({ path: output + "/control-lab.png" });
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
  const restoredControls = await p.evaluate(
    () => JSON.parse(localStorage.getItem("jet-sprint-controls-v1")).settings,
  );
  assert.equal(restoredControls.arcadeDragDistance, 110);
  assert.equal(restoredControls.arcadeDragReturn, 0.23);
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
  const developer = await verifyDeveloperDrag(p, url);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    output + "/browser-proof.json",
    JSON.stringify(
      {
        method:
          "Production build in Chromium 844×390 touch emulation. Full safe/shortcut races use native CDP drag and standard Gamepad API inputs without pose, physics, gate, result or timer injection. Six separate practice approach checks seed initial boat pose/velocity at left/centre/right via DevTools live scope, then run the actual unmodified launch/contact/landing simulation. Most GPU draws suppressed during accelerated checks; screenshots render normally. Not physical device/FPS/subjective-feel testing.",
        runs,
        seededRampRuns,
        failure: failed,
        autoThrottleAndTouch: true,
        drag: dragProof,
        developer,
        ramps: rampDefinitions,
        controlLabReload: {
          distance: restoredControls.arcadeDragDistance,
          return: restoredControls.arcadeDragReturn,
        },
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
