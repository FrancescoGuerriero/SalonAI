import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(
    new URL(relativePath, import.meta.url),
    "utf8"
  );
}

test("staff self-service workforce-only routes use tenant authority before own-scope permissions", async () => {
  const routes = await source(
    "../features/staff/staffRoutes.js"
  );

  for (const [pattern, label] of [
    [
      /"\/me\/availability",\s*\.\.\.workforceTenantAuthority,\s*readOwnSchedule,\s*asyncHandler\(\s*tenantScopedMyWeek/s,
      "read own tenant-scoped availability",
    ],
    [
      /"\/me\/availability",\s*\.\.\.workforceTenantAuthority,\s*updateOwnSchedule,\s*asyncHandler\(\s*tenantScopedSetMyAvailability/s,
      "update own tenant-scoped availability",
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

  assert.match(
    routes,
    /"\/me\/day",\s*readOwnSchedule,\s*asyncHandler\(\s*controller\.myDay/s
  );
  assert.doesNotMatch(
    routes,
    /"\/me\/day",\s*\.\.\.workforceTenantAuthority/s
  );
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
  assert.doesNotMatch(
    controller,
    /Stylist\.findOne\(\{\s*userAccount/
  );
});

test("self-service availability requires trusted location ownership and preserves seven-day fallback", async () => {
  const service = await source(
    "../services/staffSelfAvailabilityService.js"
  );
  const controller = await source(
    "../features/staff/staffSelfServiceTenantController.js"
  );

  assert.match(
    service,
    /staffScheduleCreationOwnership\(authority\)/
  );
  assert.match(
    service,
    /scopedWorkforceFilter\(\s*authority,\s*\{\s*userAccount:\s*userId,\s*workingLocations:\s*ownership\.locationId/s
  );
  assert.match(
    service,
    /StaffAvailability\.find\(\{\s*business:\s*ownership\.businessId,\s*location:\s*ownership\.locationId,\s*staff:\s*stylist\._id/s
  );
  assert.match(service, /Array\.from\(\s*\{ length: 7 \}/s);
  assert.match(service, /source:\s*"configured_availability"/);
  assert.match(service, /source:\s*"stylist_working_hours"/);
  assert.match(
    service,
    /setScopedWeeklyAvailability\(\s*stylist\._id,\s*payload,\s*authority/s
  );
  assert.match(
    controller,
    /scopedSelfWeeklyAvailability\(\s*req\.user\?\._id,\s*req\.effectiveAuthority/s
  );
  assert.match(
    controller,
    /setScopedSelfWeeklyAvailability\(\s*req\.user\?\._id,\s*req\.body,\s*req\.effectiveAuthority/s
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

test("Appointment-backed self day remains isolated from the workforce-only tenant activation", async () => {
  const legacyController = await source(
    "../features/staff/staffController.js"
  );
  const legacyService = await source(
    "../features/staff/staffService.js"
  );

  assert.match(
    legacyController,
    /export async function myDay/
  );
  assert.match(
    legacyController,
    /service\.dayAvailability\(\s*stylist\._id/s
  );
  assert.match(
    legacyService,
    /Appointment\.find\(/
  );
});

test("tenant self-service writes retain canonical audit actions", async () => {
  const controller = await source(
    "../features/staff/staffSelfServiceTenantController.js"
  );

  assert.ok(controller.includes('"staff.availability_updated"'));
  assert.ok(controller.includes('"staff.time_off_requested"'));
  assert.match(controller, /scope:\s*"self-tenant"/);
  assert.match(controller, /recordAuditEvent\(/);
});

test("frontend exposes self-service through delegated schedule permission", async () => {
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
