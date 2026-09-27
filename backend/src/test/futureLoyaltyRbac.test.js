import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test(
  "future loyalty management uses canonical loyalty permission while self-service remains authenticated",
  async () => {
    const routes = await source(
      "../features/loyalty/loyaltyRoutes.js"
    );
    const parent = await source(
      "../features/futureFeatureRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /managementOnly|adminOnly|authorize\(/
    );

    assert.match(
      routes,
      /router\.get\("\/me",\s*asyncHandler\(getMyLoyalty\)\)/
    );

    assert.match(
      routes,
      /router\.get\("\/",\s*requirePermissions\("loyalty:manage"\)/
    );
    assert.match(
      routes,
      /router\.post\("\/:customerId\/award",\s*requirePermissions\("loyalty:manage"\)/
    );
    assert.match(
      routes,
      /router\.post\("\/:customerId\/redeem",\s*requirePermissions\("loyalty:manage"\)/
    );

    assert.match(
      parent,
      /"\/loyalty"[\s\S]{0,140}requirePermissions\(\s*"loyalty:manage"\s*\)[\s\S]{0,140}loyaltyRoutes/
    );
  }
);
