// Optional Chromium validation; Playwright is a test-only external tool, not a game dependency.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const dir = fileURLToPath(new URL("../docs/multitouch-v8", import.meta.url)),
  profile = JSON.parse(
    await fs.readFile(
      new URL("../docs/multitouch-v8/qa-profile-v1.json", import.meta.url),
      "utf8",
    ),
  );
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
  const p = await browser.newPage({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript((profile) => {
    const raf = requestAnimationFrame.bind(window);
    requestAnimationFrame = (cb) => {
      if (
        /^function\s*\w*\([^)]*\)\{requestAnimationFrame\(/.test(String(cb))
      ) {
        window.gameFrame = cb;
        return 1;
      }
      return raf(cb);
    };
    window.advance = (ms = 50) => {
      window.renderTime =
        Math.max(performance.now(), window.renderTime || 0) + ms;
      gameFrame(renderTime);
    };
    window.events = [];
    for (const type of [
      "pointerdown",
      "pointerup",
      "pointercancel",
      "gotpointercapture",
      "lostpointercapture",
      "touchstart",
      "touchmove",
      "touchend",
    ])
      document.addEventListener(
        type,
        (e) => {
          queueMicrotask(() =>
            events.push({
              type,
              id: e.pointerId,
              target: e.target.id,
              prevented: e.defaultPrevented,
            }),
          );
        },
        { capture: true, passive: true },
      );
    window.captures = {};
    const cap = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = function (id) {
      captures[this.id] = id;
      return cap.call(this, id);
    };
    if (!localStorage.getItem("jet-sprint-player-profile-v1")) {
      localStorage.setItem(
        "jet-sprint-player-profile-v1",
        JSON.stringify(profile),
      );
      localStorage.setItem(
        "jet-sprint-settings",
        JSON.stringify({
          schemaVersion: 3,
          settings: { graphics: "low", countdownDuration: 2 },
        }),
      );
      localStorage.setItem(
        "jet-sprint-v8-settings",
        JSON.stringify({
          type: "jet-sprint-v8",
          schemaVersion: 1,
          preset: "custom",
          settings: { engineVolume: 42, cruiseLayerOneVolume: 63 },
        }),
      );
    }
  }, profile);
  const url = process.env.JET_SPRINT_URL || "http://127.0.0.1:4270/Jet-Sprint/";
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForSelector("#introGarage", { timeout: 120000 });
  await p.locator("#introGarage").click();
  await p.locator("#shop-tab-nitrous").click();
  await p.locator("#buyBoatUpgrade").click();
  await p.locator("#closeGarage").click();
  await p.locator("#start").click();
  await p.evaluate(() => advance(3000));
  await p.waitForFunction(
    () =>
      __JET_SPRINT_ENGINE__.inspect().loopSources === 7 &&
      Object.values(__JET_SPRINT_ENGINE__.inspect().samples).every((v) =>
        v.startsWith("Loaded"),
      ),
    {},
    { polling: 100, timeout: 30000 },
  );
  console.log("LOADED / NINE RECORDINGS");
  const cd = await p.context().newCDPSession(p),
    rect = await p.evaluate(() => {
      const read = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          top: r.top,
          bottom: r.bottom,
        };
      };
      return {
        throttle: read("arcadeThrottle"),
        left: read("steerLeft"),
        right: read("steerRight"),
      };
    });
  let throttle = { id: 1, x: rect.throttle.x, y: rect.throttle.bottom - 12 };
  const left = { id: 2, x: rect.left.x, y: rect.left.y },
    right = { id: 3, x: rect.right.x, y: rect.right.y };
  async function send(type, points) {
    await cd.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await p.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
    );
    await p.evaluate(() => advance());
  }
  async function state(thr, steer, nitro) {
    const d = await p.evaluate(() => __JET_SPRINT_INPUT__.inspect());
    assert.ok(Math.abs(d.throttle - thr) < 0.01, JSON.stringify(d));
    assert.equal(d.steering, steer);
    if (nitro !== undefined) assert.equal(d.nitrous, nitro);
  }
  await send("touchStart", [throttle]);
  throttle.y = rect.throttle.top + 12;
  await send("touchMove", [throttle]);
  await state(1, 0, false);
  // Crucially add/remove a second finger AFTER the first is dragging, not two
  // simultaneous mouse/synthetic PointerEvent presses.
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? right : left;
    await send("touchStart", [throttle, side]);
    await state(1, i % 2 ? 1 : -1, false);
    await send("touchEnd", [side]);
    await state(1, 0, false);
  }
  console.log("A / THROTTLE HELD WITH REPEATED SECOND-FINGER TAPS");
  await send("touchStart", [throttle, left]);
  throttle.y = rect.throttle.bottom - 30;
  await send("touchMove", [throttle, left]);
  let d = await p.evaluate(() => __JET_SPRINT_INPUT__.inspect());
  assert.ok(d.throttle > 0 && d.throttle < 0.4);
  assert.equal(d.steering, -1);
  throttle.y = rect.throttle.top + 12;
  await send("touchMove", [throttle, left]);
  await state(1, -1, false);
  console.log("B / DRAG WITH STEERING HELD");
  throttle.y = rect.throttle.top - 20;
  await send("touchMove", [throttle, left]);
  await state(1, -1, true);
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().nitrousActive),
    true,
  );
  await p.waitForTimeout(250);
  await p.evaluate(() => { for(let i=0;i<4;i++) advance(); });
  await p.screenshot({ path: dir + "/multitouch-nitro.png" });
  throttle.y = rect.throttle.top + 5;
  await send("touchMove", [throttle, left]);
  await state(1, -1, false);
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().nitrousActive),
    false,
  );
  console.log("C / NITRO UP AND DOWN WITH STEERING");
  left.x += 2;
  await send("touchMove", [throttle, left]);
  await p.evaluate(() =>
    document
      .querySelector("#steerLeft")
      .releasePointerCapture(captures.steerLeft),
  );
  left.x += 2;
  await send("touchMove", [throttle, left]);
  await state(1, 0, false);
  await send("touchEnd", [left]);
  await send("touchStart", [throttle, right]);
  await state(1, 1, false);
  await send("touchEnd", [throttle]);
  await state(0, 1, false);
  await send("touchEnd", []);
  await state(0, 0, false);
  await send("touchStart", [throttle, left]);
  await send("touchCancel", []);
  await state(0, 0, false);
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_PHYSICS__.inspect().nitrousActive),
    false,
  );
  assert.equal(await p.evaluate(() => visualViewport.scale), 1);
  assert.equal(await p.evaluate(() => scrollX + scrollY), 0);
  assert.equal(
    await p.evaluate(() =>
      events.some((e) => e.type.startsWith("touch") && e.prevented),
    ),
    false,
  );
  console.log("D / CAPTURE LOSS, RELEASE AND CANCEL");
  // A capture interrupted before gotpointercapture may produce no lost event.
  await send("touchStart", [throttle]);
  await send("touchStart", [throttle, left]);
  await p.evaluate(() => document.querySelector("#steerLeft").releasePointerCapture(captures.steerLeft));
  left.x += 2;
  await send("touchMove", [throttle, left]);
  await state(1, 0, false);
  await send("touchEnd", []);
  await state(0, 0, false);
  await p.locator("#arcadeThrottle").focus();
  await p.keyboard.down("Space");
  await p.keyboard.down("ShiftLeft");
  await p.evaluate(() => advance());
  assert.equal(
    await p.evaluate(() => __JET_SPRINT_INPUT__.inspect().nitrous),
    true,
  );
  await p.keyboard.up("ShiftLeft");
  await p.keyboard.up("Space");
  await p.evaluate(() => advance());
  const edits = {
    cruiseLayerTwoVolume: 41,
    cruiseCrossfadeSpeed: 60,
    cruiseVariationIntensity: 15,
    rpmPitchResponse: 80,
    highRPMLayerVolume: 82,
    highRPMThreshold: 88,
    revOutVolume: 67,
    revOutSensitivity: 70,
    airborneTransitionSpeed: 60,
  };
  await p.locator("#pauseToggle").click();
  await p.locator("#pauseSetup").click();
  await p.locator("#pit-tab-audio").click();
  for (const [k, v] of Object.entries(edits)) {
    assert.equal(await p.locator("#audio-" + k).count(), 1);
    await p.locator("#audio-" + k).evaluate((el, v) => {
      el.closest("details").open = true;
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
  }
  await p.waitForTimeout(350);
  await p.locator("#audio-cruiseLayerTwoVolume").scrollIntoViewIfNeeded();
  await p.screenshot({ path: dir + "/audio-lab.png" });
  await p.locator("#audio-revOutVolume").scrollIntoViewIfNeeded();
  await p.screenshot({ path: dir + "/airborne-lab.png" });
  await p.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForSelector("#introGarage", { timeout: 120000 });
  const saved = await p.evaluate(
    () => JSON.parse(localStorage.getItem("jet-sprint-v8-settings")).settings,
  );
  for (const [k, v] of Object.entries(edits)) assert.equal(saved[k], v);
  assert.equal(saved.engineVolume, 42);
  assert.equal(saved.cruiseLayerOneVolume, 63);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    dir + "/browser-proof.json",
    JSON.stringify(
      {
        browser:
          "Chromium 844×390 native CDP multi-touch emulation, actual production game, controlled render clock. Not physical iPhone Safari.",
        fixture:
          "Legacy schema-1 QA profile; kit purchased through real garage. Existing audio levels seeded for migration check.",
        A: "Throttle finger dragged to 100%, then a second finger repeatedly added/released on LEFT/RIGHT: throttle stayed 100%.",
        B: "Continuous steering held while throttle dragged from partial to full.",
        C: "Same throttle capture entered nitrous then returned to full normal throttle while the second finger steered.",
        D: "Established and pending steering capture loss preserved throttle; throttle release preserved steering; touchcancel cleared both. Page scale 1 and scroll 0; legacy touch events never cancelled.",
        keyboard: "Space + Left Shift works with the throttle button focused.",
        audio:
          "All nine M4A files decoded; seven persistent loops; nine real Audio Lab controls saved/restored with old volumes intact.",
        edits,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("MULTITOUCH / AUDIO LAB PASS");
} catch (e) {
  for (const p of browser.contexts().flatMap((c) => c.pages()))
    console.log(
      JSON.stringify(
        await p
          .evaluate(() => ({
            input: globalThis.__JET_SPRINT_INPUT__?.inspect(),
            events: globalThis.events?.slice(-30),
          }))
          .catch(() => ({})),
      ),
    );
  throw e;
} finally {
  await browser.close();
}
