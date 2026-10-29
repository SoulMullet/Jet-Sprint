import { BallisticSpray } from "../src/ballistic-spray.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createSprayFrame,
  updateSprayFrame,
  localSprayPoint,
  jetLaunch,
  hullLaunch,
  hullSprayRate,
} from "../src/spray-frame.js";
import { HFSpray } from "../src/hf-effects.js";
import { hfWaterUniforms } from "../src/hf-water.js";
import { stern } from "../src/wake-trail.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const boat = (angle = 0, forward = 24, lateral = 0) => ({
  x: 5,
  z: 9,
  angle,
  vx: Math.cos(angle) * forward - Math.sin(angle) * lateral,
  vz: Math.sin(angle) * forward + Math.cos(angle) * lateral,
  pump: 1,
  nozzle: 0,
  yawRate: 0,
});

test("spray nozzle origin matches the model YXZ transform, including pitch and bank", () => {
  for (const angle of [0, 0.7, Math.PI / 2, Math.PI, -1.9])
    for (const roll of [-0.4, 0, 0.4])
      for (const pitch of [-0.1, 0, 0.15]) {
        const b = boat(angle),
          pose = { roll, pitch, heave: 0.06 },
          frame = updateSprayFrame(createSprayFrame(), b, pose),
          mesh = new THREE.Object3D();
        mesh.rotation.order = "YXZ";
        mesh.rotation.set(roll, -angle, pitch);
        mesh.position.set(b.x, -0.12 + pose.heave, b.z);
        mesh.updateMatrixWorld();
        const p = new THREE.Vector3(-2.35, 0.34, 0).applyMatrix4(
          mesh.matrixWorld,
        );
        close(frame.sternX, p.x);
        close(frame.sternY, Math.max(0.035, p.y));
        close(frame.sternZ, p.z);
      }
});

test("jet and hull launches rotate covariantly, including drift, nozzle and reverse motion", () => {
  for (const forward of [-15, 0.05, 24, 50])
    for (const lateral of [-12, 0, 12]) {
      const original = {
          ...boat(0, forward, lateral),
          yawRate: 0.7,
          nozzle: 0.4,
          lateralAcceleration: 7,
        },
        pose = { roll: 0.15, pitch: 0.07, heave: 0.02 },
        a = updateSprayFrame(createSprayFrame(), original, pose);
      for (const angle of [Math.PI / 2, Math.PI, -1.2]) {
        const b = {
            ...boat(angle, forward, lateral),
            yawRate: 0.7,
            nozzle: 0.4,
            lateralAcceleration: 7,
          },
          before = { ...b },
          f = updateSprayFrame(createSprayFrame(), b, pose);
        for (const emit of [jetLaunch, hullLaunch]) {
          const x = emit({}, a, Math.hypot(forward, lateral), 0.5),
            y = emit({}, f, Math.hypot(forward, lateral), 0.5),
            c = Math.cos(angle),
            s = Math.sin(angle);
          close(y.px - b.x, (x.px - original.x) * c - (x.pz - original.z) * s);
          close(y.pz - b.z, (x.px - original.x) * s + (x.pz - original.z) * c);
          close(y.vx, x.vx * c - x.vz * s);
          close(y.vz, x.vx * s + x.vz * c);
          close(y.vy, x.vy);
          close(y.py, x.py);
        }
        assert.deepEqual(b, before);
      }
    }
});

test("airborne jet cannot point forward at high speed or reduced spray distance", () => {
  for (const forward of [-50, -5, 0.05, 24, 50, 80])
    for (const angle of [0, 0.9, Math.PI, -2])
      for (const distance of [0.01, 0.05, 0.25, 1, 2])
        for (const nozzle of [-Math.PI / 4, 0, Math.PI / 4]) {
          const b = { ...boat(angle, forward, 12), nozzle, yawRate: 2 },
            f = updateSprayFrame(createSprayFrame(), b, {
              pitch: 0.17,
              roll: 0.4,
            }),
            v = jetLaunch(
              {},
              f,
              Math.hypot(forward, 12),
              distance,
              0.525,
              -2,
              0.65,
            );
          assert.ok(
            v.vx * Math.cos(angle) + v.vz * Math.sin(angle) <= -0.499999,
          );
          assert.ok(Number.isFinite(v.vy));
          assert.ok(Object.values(v).every(Number.isFinite));
        }
});

test("jet centerline remains rearward regardless of steering nozzle angle", () => {
  const baseline = jetLaunch(
    {},
    updateSprayFrame(createSprayFrame(), boat()),
    24,
    1,
  );
  for (const nozzle of [-Math.PI / 4, Math.PI / 4]) {
    const v = jetLaunch(
      {},
      updateSprayFrame(createSprayFrame(), { ...boat(), nozzle, yawRate: 2 }),
      24,
      1,
    );
    close(v.vx, baseline.vx);
    close(v.vz, baseline.vz);
    assert.ok(v.vx < 0);
  }
});

test("chine spray follows slip and measured cornering load, rather than steering input", () => {
  for (const sign of [-1, 1]) {
    const f = updateSprayFrame(createSprayFrame(), {
        ...boat(0, 20, sign * 9),
        lateralAcceleration: 0,
      }),
      v = hullLaunch({}, f, 22, 0.5);
    assert.equal(Math.sign(v.pz - f.z), sign);
    assert.equal(Math.sign(v.vz), sign);
    assert.ok(hullSprayRate(f, 22) > 0);
    const turning = updateSprayFrame(createSprayFrame(), {
      ...boat(0, 20, 0),
      lateralAcceleration: sign * 10,
    });
    assert.equal(Math.sign(hullLaunch({}, turning, 20).vz), -sign);
    assert.ok(hullSprayRate(turning, 20) > 0);
  }
  const still = updateSprayFrame(createSprayFrame(), {
    ...boat(0, 0, 0),
    pump: 0,
    nozzle: 0.5,
    yawRate: 0,
    lateralAcceleration: 0,
  });
  assert.equal(hullSprayRate(still, 0), 0);
});

test("gravity advances world Y and turns upward velocity downward", () => {
  const p = new BallisticSpray(32);
  p.emit({ px: 0, py: 1, pz: 0, vx: -12, vy: 5, vz: 0 }, 5);
  for (let i = 0; i < 30; i++) p.integrate(1 / 120, -9.8, 1);
  close(p.velocity[0], -12);
  close(p.velocity[2], 0);
  assert.ok(p.velocity[1] < 5 && p.velocity[1] > 0);
  assert.ok(p.position[1] > 1);
  for (let i = 0; i < 240; i++) p.integrate(1 / 120, -9.8, 1);
  assert.equal(p.count, 0);
  assert.equal(p.impactCount, 1);
});

test("GPU launch directions, history and fixed buffers survive left/right drift, reverse and idle", () => {
  const u = hfWaterUniforms(),
    spray = new HFSpray(new THREE.Scene(), u, 1024);
  spray.configure(1024, 0.8);
  for (const b of [
    boat(0),
    { ...boat(1, 24, -8), yawRate: 0.6, nozzle: 0.4 },
    { ...boat(-1, 24, 8), yawRate: -0.6, nozzle: -0.4 },
    boat(2, -12, 0),
    boat(0.4, 0.05, 0),
  ]) {
    spray.reset();
    const before = { ...b };
    for (let i = 0; i < 12; i++)
      spray.update(1 / 60, b, Math.hypot(b.vx, b.vz), {});
    assert.ok(spray.cursor > 0);
    assert.ok(spray.activeCount > 0);
    assert.equal(spray.inspect().attachedCore, false);
    assert.deepEqual(b, before);
    for (let i = 0; i < Math.min(spray.cursor, spray.budget); i++) {
      const j = i * 4;
      assert.ok(
        spray.velocities[j] * Math.cos(b.angle) +
          spray.velocities[j + 2] * Math.sin(b.angle) <
          0,
      );
    }
    const first = Array.from(spray.births.slice(0, 4)),
      velocity = Array.from(spray.velocities.slice(0, 4)),
      idle = {
        ...b,
        pump: 0,
        jetPower: 0,
        vx: 0,
        vz: 0,
        yawRate: 0,
        lateralAcceleration: 0,
      };
    spray.update(0.02, idle, 0, {}, { emit: false });
    assert.equal(spray.rate, 0);
    assert.ok(spray.activeCount > 0);
    assert.deepEqual(Array.from(spray.births.slice(0, 4)), first);
    assert.deepEqual(Array.from(spray.velocities.slice(0, 4)), velocity);
    const expected = stern(b, {}),
      stamp = u.hfWake.value.find((w) => w.w > 0);
    if (stamp) {
      close(stamp.x, expected.x);
      close(stamp.y, expected.z);
    }
  }
  spray.dispose();
  u.hfNormal.value.dispose();
});

test("active GPU emitter remains aft at 180 km/h with short spray distance and signed nozzle", () => {
  for (const angle of [0, 0.8, Math.PI])
    for (const nozzle of [-0.4, 0.4]) {
      const u = hfWaterUniforms(),
        spray = new HFSpray(new THREE.Scene(), u, 1024);
      spray.configure(1024, 1);
      const b = { ...boat(angle, 50), nozzle, lateralAcceleration: 0 };
      spray.update(
        0.05,
        b,
        50,
        {},
        { distance: 0.1, tuning: { spraySpread: 0 } },
      );
      assert.ok(spray.cursor > 0);
      for (let i = 0; i < spray.cursor; i++) {
        const j = i * 4,
          vx = spray.velocities[j],
          vz = spray.velocities[j + 2];
        assert.ok(vx * Math.cos(angle) + vz * Math.sin(angle) <= -0.499999);
        close(-vx * Math.sin(angle) + vz * Math.cos(angle), 0);
      }
      assert.deepEqual(spray.mesh.position.toArray(), [0, 0, 0]);
      assert.equal(spray.inspect().attachedCore, false);
      spray.dispose();
      u.hfNormal.value.dispose();
    }
});
