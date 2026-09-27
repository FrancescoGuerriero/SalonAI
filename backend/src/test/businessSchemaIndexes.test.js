import test from "node:test";
import assert from "node:assert/strict";

import Business from "../models/Business.js";

test("Business declares subscription.status index exactly once", () => {
  const matching =
    Business.schema
      .indexes()
      .filter(([keys]) =>
        Object.keys(keys).length === 1 &&
        keys["subscription.status"] === 1
      );

  assert.equal(matching.length, 1);
});
