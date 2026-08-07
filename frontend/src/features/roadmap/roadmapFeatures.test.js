import assert from "node:assert/strict";
import test from "node:test";

import { roadmapFeatureMap, roadmapFeatures } from "./roadmapFeatures.js";

test("customer experience points 12 through 31 are complete and unique", () => {
  assert.equal(roadmapFeatures.length, 20);
  assert.deepEqual(roadmapFeatures.map((feature) => feature.sprint), Array.from({ length: 20 }, (_, index) => index + 12));
  assert.equal(new Set(roadmapFeatures.map((feature) => feature.id)).size, 20);
  for (const feature of roadmapFeatures) {
    assert.equal(roadmapFeatureMap[feature.id], feature);
    assert.ok(feature.title.length >= 8);
    assert.ok(feature.summary.length >= 40);
    assert.ok(feature.group);
    assert.doesNotMatch(`${feature.title} ${feature.summary}`, /prototype|sprint notes|save locally/i);
  }
});

test("developed suite covers salon trust, booking, rewards, personalisation and digital quality", () => {
  const groups = new Set(roadmapFeatures.map((feature) => feature.group));
  assert.deepEqual(groups, new Set(["Account and trust", "Personalisation", "Rewards", "Bookings", "Digital experience"]));
});
