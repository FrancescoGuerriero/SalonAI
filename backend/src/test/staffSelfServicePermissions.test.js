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

test("staff self-service routes keep explicit own-scope permissions", async () => {
  const routes = await source(
    "../features/staff/staffRoutes.js"
  );

  for (const [pattern, label] of [
    [
      /"\/me\/availability",\s*readOwnSchedule,\s*asyncHandler\(\s*controller\.myWeek/s,
      "read own availability",
    ],
    [
      /"\/me\/availability",\s*updateOwnSchedule,\s*asyncHandler\(\s*controller\.setMyAvailability/s,
      "update own availability",
    ],
    [
      /"\/me\/day",\s*readOwnSchedule,\s*asyncHandler\(\s*controller\.myDay/s,
      "read own day",
    ],
    [
      /"\/me\/time-off",\s*\.\.\.workforceTenantAuthority,\s*readOwnSchedule,\s*asyncHandler\(\s*tenantScopedListMyTimeOff/s,
      "read own tenant-scoped leave",
    ],
    [
      /"\/me\/time-off",\s*\.\.\.workforceTenantAuthority,\s*requestOwnLeave,\s*asyncHandler\(\s*tenantScopedRequestMyTimeOff/s,
      "request own tenant-scoped leave",
    ],
  ]) {
    assert.match(routes, pattern, `Missing route contract: ${label}`);
  }

  assert.doesNotMatch(
    routes,
    /router\.patch\(\s*"\/me\/time-off/
  );
});

test("self-service time-off resolves the authenticated employee inside trusted workforce scope", async () => {
  const controller = await source(
    "../features/staff/staffSelfServiceTenantController.js"
  );

  assert.match(
    controller,
    /scopedWorkforceFilter\(\s*req\.effectiveAuthority,\s*\{\s*userAccount:\s*req\.user\?\._id/s
  );
  assert.match(
    controller,
    /scopedTimeOffList\(\s*\{\s*staff:\s*stylist\._id/s
  );
  assert.match(
    controller,
    /createScopedTimeOff\(\s*stylist\._id,\s*req\.body,\s*req\.effectiveAuthority/s
  );
  assert.match(
    controller,
    /scope:\s*"self-tenant"/
  );
  assert.doesNotMatch(
    controller,
    /Stylist\.findOne\(\{\s*userAccount/
  );
});

test("cross-employee schedule and leave routes require tenant authority before delegated permissions", async () => {
  const routes = await source(
    "../features/staff/staffRoutes.js"
  );

  assert.match(routes, /requirePermissions\(\s*"employee:read"\s*\)/);
  assert.match(routes, /requirePermissions\(\s*"employee:schedule:update"\s*\)/);
  assert.match(
    routes,
    /"\/:staffId\/availability",\s*\.\.\.workforceTenantAuthority,\s*updateEmployeeSchedule/s
  );
  assert.match(
    routes,
    /"\/time-off\/:id",\s*\.\.\.workforceTenantAuthority,\s*updateEmployeeSchedule/s
  );
  assert.match(
    routes,
    /"\/:staffId\/time-off",\s*\.\.\.workforceTenantAuthority,\s*updateEmployeeSchedule/s
  );
});

test("leave requests always enter requested state", async () => {
  const service = await source(
    "../features/staff/staffService.js"
  );

  assert.match(
    service,
    /StaffTimeOff\.create\(\{[\s\S]*?status:\s*"requested"/s
  );
  assert.doesNotMatch(
    service,
    /status:\s*payload\.status\s*\|\|/
  );
});

test("legacy self availability still resolves the canonical linked staff account until its tenant slice lands", async () => {
  const controller = await source(
    "../features/staff/staffController.js"
  );

  assert.match(
    controller,
    /Stylist\.findOne\(\{\s*userAccount:\s*user\._id/s
  );
});

test("self-service availability fallback remains unchanged", async () => {
  const service = await source(
    "../features/staff/staffService.js"
  );
  const controller = await source(
    "../features/staff/staffController.js"
  );

  assert.match(service, /export async function weeklyAvailabilityWithFallback/);
  assert.match(service, /source:\s*"stylist_working_hours"/);
  assert.match(
    controller,
    /weeklyAvailabilityWithFallback\(\s*stylist\._id/s
  );
});

test("schedule and leave writes retain canonical audit actions", async () => {
  const legacyController = await source(
    "../features/staff/staffController.js"
  );
  const tenantSelfController = await source(
    "../features/staff/staffSelfServiceTenantController.js"
  );

  for (const action of [
    "staff.availability_updated",
    "staff.time_off_status_updated",
  ]) {
    assert.ok(
      legacyController.includes(`"${action}"`),
      `Missing canonical audit action: ${action}`
    );
  }

  assert.ok(
    tenantSelfController.includes('"staff.time_off_requested"')
  );
  assert.match(tenantSelfController, /recordAuditEvent\(/);
});

test("frontend exposes self-service only through delegated schedule permission", async () => {
  const app = await source(
    "../../../frontend/src/App.jsx"
  );
  const navigation = await source(
    "../../../frontend/src/components/navigation/managementNavigationConfig.js"
  );
  const api = await source(
    "../../../frontend/src/Services/futureFeaturesApi.js"
  );

  assert.match(
    app,
    /path="staff\/self-service"[\s\S]*?"schedule:own:read"/
  );
  assert.match(
    navigation,
    /"\/staff\/self-service"[\s\S]{0,180}"schedule:own:read"/
  );
  assert.match(api, /get\("\/staff\/me\/availability"\)/);
  assert.match(api, /post\(\s*"\/staff\/me\/time-off"/s);
});
