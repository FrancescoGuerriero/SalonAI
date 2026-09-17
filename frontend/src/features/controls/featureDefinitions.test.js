import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_DEFINITIONS,
  ROADMAP_FEATURE_CONTROL,
  resolveFeatureFlags,
} from "./featureDefinitions.js";

test("feature definitions expose unique enabled-by-default controls", () => {
  assert.ok(FEATURE_DEFINITIONS.length >= 25);
  assert.equal(
    new Set(FEATURE_DEFINITIONS.map(({ id }) => id)).size,
    FEATURE_DEFINITIONS.length
  );
  assert.equal(DEFAULT_FEATURE_FLAGS["online-booking"], true);
  assert.equal(ROADMAP_FEATURE_CONTROL.consultation, "consultation");
});
test("public feature configuration only accepts known boolean values", () => {
  const resolved = resolveFeatureFlags({
    features: {
      "online-booking": false,
      "online-shop": "false",
      unknown: false,
    },
  });

  assert.equal(resolved["online-booking"], false);
  assert.equal(resolved["online-shop"], true);
  assert.equal("unknown" in resolved, false);
});
