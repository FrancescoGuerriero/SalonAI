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
  "staff rota mutations use employee schedule permission instead of built-in role names",
  async () => {
    const routes = await source(
      "../features/staffRota/staffRotaRoutes.js"
    );

    assert.doesNotMatch(
      routes,
      /authorize\(|rotaManagers|managementOnly|adminOnly/
    );

    for (const routePattern of [
      "\/shifts",
      "\/shifts\/:shiftId",
      "\/weeks\/publish",
      "\/shifts\/:shiftId\/clock-in",
      "\/shifts\/:shiftId\/clock-out",
      "\/shifts\/:shiftId\/attendance",
    ]) {
      assert.match(
        routes,
        new RegExp(
          `"${routePattern}"[\\s\\S]{0,160}manageRota`
        )
      );
    }

    assert.match(
      routes,
      /const manageRota = requirePermissions\("employee:schedule:update"\)/
    );
  }
);

test(
  "staff rota UI derives management controls from employee schedule permission",
  async () => {
    const page = await source(
      "../../../frontend/src/pages/StaffRotaPage.jsx"
    );

    assert.match(
      page,
      /hasPermission\(user,\s*"employee:schedule:update"\)/
    );

    assert.doesNotMatch(
      page,
      /\["admin",\s*"manager"\]\.includes\(user\?\.role\)/
    );
  }
);
