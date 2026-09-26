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
  "staff performance mutations use canonical reports manage permission",
  async () => {
    const routes = await source(
      "../features/staffPerformance/staffPerformanceRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /authorize\(|managerOrAdmin|managementOnly|adminOnly/
    );

    for (const routePattern of [
      "\\/stylists\\/:stylistId\\/plan",
      "\\/retail-orders\\/:orderId\\/assignment",
    ]) {
      assert.match(
        routes,
        new RegExp(
          `"${routePattern}"[\\s\\S]{0,180}requirePermissions\\(\\s*"reports:manage"\\s*\\)`
        )
      );
    }
  }
);

test(
  "staff performance page derives edit controls from reports manage permission",
  async () => {
    const page = await source(
      "../../../frontend/src/pages/StaffPerformancePage.jsx"
    );

    assert.match(
      page,
      /hasPermission\(user,\s*"reports:manage"\)/
    );

    assert.doesNotMatch(
      page,
      /\["admin",\s*"manager"\]\.includes\(user\?\.role\)/
    );
  }
);
