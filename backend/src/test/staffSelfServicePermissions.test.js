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

test("staff self-service routes use explicit own-scope permissions", async () => {
  const routes =
    await source(
      "../features/staff/staffRoutes.js"
    );

  const expected = [
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
      /"\/me\/time-off",\s*readOwnSchedule,\s*asyncHandler\(\s*controller\.listMyTimeOff/s,
      "read own leave",
    ],
    [
      /"\/me\/time-off",\s*requestOwnLeave,\s*asyncHandler\(\s*controller\.requestMyTimeOff/s,
      "request own leave",
    ],
  ];

  for (const [
    pattern,
    label,
  ] of expected) {
    assert.match(
      routes,
      pattern,
      `Missing route contract: ${label}`
    );
  }

  assert.doesNotMatch(
    routes,
    /router\.patch\(\s*"\/me\/time-off/
  );
});

test("cross-employee schedule and leave routes remain separately delegated", async () => {
  const routes =
    await source(
      "../features/staff/staffRoutes.js"
    );

  assert.match(
    routes,
    /requirePermissions\(\s*"employee:read"\s*\)/
  );
  assert.match(
    routes,
    /requirePermissions\(\s*"employee:schedule:update"\s*\)/
  );
  assert.match(
    routes,
    /"\/:staffId\/availability",\s*updateEmployeeSchedule/s
  );
  assert.match(
    routes,
    /"\/time-off\/:id",\s*updateEmployeeSchedule/s
  );
});

test("leave requests always enter requested state", async () => {
  const service =
    await source(
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

test("self-service resolves the canonical linked staff account", async () => {
  const controller =
    await source(
      "../features/staff/staffController.js"
    );

  assert.match(
    controller,
    /Stylist\.findOne\(\{\s*userAccount:\s*user\._id/s
  );

  const ownedStart =
    controller.indexOf(
      "async function ownedStylist"
    );
  const ownedEnd =
    controller.indexOf(
      "async function auditAvailability"
    );

  assert.ok(
    ownedStart >= 0 &&
      ownedEnd >
        ownedStart
  );

  const ownedBlock =
    controller.slice(
      ownedStart,
      ownedEnd
    );

  assert.doesNotMatch(
    ownedBlock,
    /email:/
  );
});

test("self-service availability falls back to configured working hours", async () => {
  const service =
    await source(
      "../features/staff/staffService.js"
    );
  const controller =
    await source(
      "../features/staff/staffController.js"
    );

  assert.match(
    service,
    /export async function weeklyAvailabilityWithFallback/
  );
  assert.match(
    service,
    /source:\s*"stylist_working_hours"/
  );
  assert.match(
    controller,
    /weeklyAvailabilityWithFallback\(\s*stylist\._id/s
  );
});

test("schedule and leave writes emit canonical audit events", async () => {
  const controller =
    await source(
      "../features/staff/staffController.js"
    );

  for (const action of [
    "staff.availability_updated",
    "staff.time_off_requested",
    "staff.time_off_status_updated",
  ]) {
    assert.ok(
      controller.includes(
        `"${action}"`
      ),
      `Missing canonical audit action: ${action}`
    );
  }

  assert.match(
    controller,
    /recordAuditEvent\(/
  );
});

test("frontend exposes self-service only through delegated schedule permission", async () => {
  const app =
    await source(
      "../../../frontend/src/App.jsx"
    );
  const navigation =
    await source(
      "../../../frontend/src/components/navigation/ManagementNavigation.jsx"
    );
  const api =
    await source(
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

  assert.match(
    api,
    /get\("\/staff\/me\/availability"\)/
  );
  assert.match(
    api,
    /post\(\s*"\/staff\/me\/time-off"/s
  );
});
