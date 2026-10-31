import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  simulateParityCase,
  parityFields,
} from "../scripts/export-physics-parity.mjs";
import {
  PHYSICS_STEP,
  BOAT_MASS,
  REFERENCE_YAW_INERTIA,
} from "../src/physics.js";
import { handlingDefaults } from "../src/handling.js";
test("portable force-parity golden fixtures reproduce straight, drift, damaged and reserve-power responses", async () => {
  const pack = JSON.parse(
    await readFile(
      new URL("../docs/fixtures/physics-parity-v1.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(pack.fixedStep, PHYSICS_STEP);
  assert.equal(pack.massKg, BOAT_MASS);
  assert.equal(pack.referenceYawInertiaKgM2, REFERENCE_YAW_INERTIA);
  assert.deepEqual(pack.handling, handlingDefaults);
  assert.deepEqual(pack.fields, parityFields);
  assert.equal(pack.cases.length, 4);
  for (const c of pack.cases) {
    const actual = simulateParityCase(c);
    assert.equal(actual.length, c.samples.length);
    for (let i = 0; i < actual.length; i++)
      for (let field = 0; field < parityFields.length; field++)
        assert.ok(
          Math.abs(actual[i].state[field] - c.samples[i].state[field]) <=
            pack.tolerances.javascriptAbsolute,
          `${c.id} / step ${actual[i].step} / ${parityFields[field]}`,
        );
  }
});
