import test from "node:test";
import assert from "node:assert/strict";

import {
  capabilitySupportsVertical,
  registerCapabilityPack,
} from "../platform/capabilities/capabilityRegistry.js";
import {
  validateProductRegistryIntegrity,
} from "../platform/capabilities/verticalPackRegistry.js";

test("AIIBP product registries are internally consistent", () => {
  const result =
    validateProductRegistryIntegrity();

  assert.equal(
    result.valid,
    true
  );
  assert.ok(
    result.verticalCount >=
      4
  );
  assert.ok(
    result.capabilityCount >=
      14
  );
});

test("capability registry can explicitly support every vertical", () => {
  const pack =
    registerCapabilityPack({
      key:
        "test-all-verticals",
      label:
        "Test all verticals",
      supportedVerticals: [
        "*",
      ],
    });

  assert.deepEqual(
    pack.supportedVerticals,
    [
      "*",
    ]
  );

  assert.equal(
    capabilitySupportsVertical(
      "test-all-verticals",
      "salon"
    ),
    true
  );

  assert.equal(
    capabilitySupportsVertical(
      "test-all-verticals",
      "plastic-surgery"
    ),
    true
  );

  assert.equal(
    validateProductRegistryIntegrity()
      .valid,
    true
  );
});
