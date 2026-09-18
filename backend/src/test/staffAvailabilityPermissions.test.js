import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(
      relativePath,
      import.meta.url
    ),
    "utf8"
  );
}

test("staff availability reads require employee:read", async () => {
  const routes =
    await source(
      "../features/staff/staffRoutes.js"
    );

  for (const pattern of [
    /router\.get\(\s*"\/time-off",\s*readEmployees/s,
    /router\.get\(\s*"\/:staffId\/availability",\s*readEmployees/s,
    /router\.get\(\s*"\/:staffId\/day",\s*readEmployees/s,
  ]) {
    assert.match(
      routes,
      pattern
    );
  }

  assert.match(
    routes,
    /requirePermissions\(\s*"employee:read"\s*\)/
  );
});

test("staff availability and leave mutations require employee:schedule:update", async () => {
  const routes =
    await source(
      "../features/staff/staffRoutes.js"
    );

  for (const pattern of [
    /router\.patch\(\s*"\/time-off\/:id",\s*updateEmployeeSchedule/s,
    /router\.put\(\s*"\/:staffId\/availability",\s*updateEmployeeSchedule/s,
    /router\.post\(\s*"\/:staffId\/time-off",\s*updateEmployeeSchedule/s,
  ]) {
    assert.match(
      routes,
      pattern
    );
  }

  assert.match(
    routes,
    /requirePermissions\(\s*"employee:schedule:update"\s*\)/
  );
});

test("staff availability routes no longer rely on management role alone", async () => {
  const routes =
    await source(
      "../features/staff/staffRoutes.js"
    );

  assert.doesNotMatch(
    routes,
    /managementOnly|adminOnly/
  );
});
