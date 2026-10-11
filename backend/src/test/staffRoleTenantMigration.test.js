import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffRoleOwnershipReadiness,
  planStaffRoleOwnershipBackfill,
} from "../platform/tenancy/staffRoleOwnershipMigration.js";
import {
  assertStaffRoleReadOnlyArguments,
  sanitiseStaffRoleReadiness,
} from "../../scripts/checkStaffRoleTenantReadiness.js";

const BUSINESS_A = "507f1f77bcf86cd799439011";
const BUSINESS_B = "507f1f77bcf86cd799439012";
const ROLE_A = "507f1f77bcf86cd799439021";
const ROLE_B = "507f1f77bcf86cd799439022";

function role(_id, key, business = null, active = true) {
  return {
    _id,
    key,
    business,
    active,
  };
}

test("StaffRole ownership readiness allows deterministic canonical single-Business attribution", () => {
  const readiness = buildStaffRoleOwnershipReadiness({
    businesses: [{ _id: BUSINESS_A }],
    staffRoles: [
      role(ROLE_A, "manager"),
      role(ROLE_B, "colour_specialist"),
    ],
    businessId: BUSINESS_A,
  });

  assert.equal(readiness.safeForBusinessBackfill, true);
  assert.equal(readiness.summary.unowned, 2);
  assert.equal(readiness.summary.builtInOverrides, 1);
  assert.equal(readiness.summary.customRoles, 1);
  assert.deepEqual(readiness.blockers, []);
});

test("StaffRole ownership readiness fails closed when Business attribution is ambiguous", () => {
  const readiness = buildStaffRoleOwnershipReadiness({
    businesses: [
      { _id: BUSINESS_A },
      { _id: BUSINESS_B },
    ],
    staffRoles: [role(ROLE_A, "manager")],
    businessId: BUSINESS_A,
  });

  assert.equal(readiness.safeForBusinessBackfill, false);
  assert.equal(
    readiness.blockers.some(
      (item) => item.blocker === "ambiguous-business-attribution"
    ),
    true
  );
});

test("StaffRole ownership readiness blocks records already owned by another Business", () => {
  const readiness = buildStaffRoleOwnershipReadiness({
    businesses: [{ _id: BUSINESS_A }],
    staffRoles: [
      role(ROLE_A, "manager", BUSINESS_B),
    ],
    businessId: BUSINESS_A,
  });

  assert.equal(readiness.safeForBusinessBackfill, false);
  assert.equal(readiness.summary.foreignOwned, 1);
});

test("StaffRole zero-write plan is stable and proposes only unowned records", () => {
  const input = {
    businesses: [{ _id: BUSINESS_A }],
    staffRoles: [
      role(ROLE_B, "colour_specialist"),
      role(ROLE_A, "manager", BUSINESS_A),
    ],
    businessId: BUSINESS_A,
  };

  const first = planStaffRoleOwnershipBackfill(input);
  const second = planStaffRoleOwnershipBackfill({
    ...input,
    staffRoles: [...input.staffRoles].reverse(),
  });

  assert.equal(first.writesPerformed, false);
  assert.equal(first.operationCount, 1);
  assert.equal(first.rollbackCount, 1);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.operations[0].roleId, ROLE_B);
  assert.equal(first.operations[0].businessId, BUSINESS_A);
  assert.equal(first.operations[0].classification, "custom-role");
});

test("StaffRole readiness command rejects write-like flags and sanitises output", () => {
  assert.equal(assertStaffRoleReadOnlyArguments([]), true);

  for (const argument of [
    "--apply",
    "--write=true",
    "--backfill",
    "--migrate=1",
  ]) {
    assert.throws(
      () => assertStaffRoleReadOnlyArguments([argument]),
      /read-only/
    );
  }

  const sanitised = sanitiseStaffRoleReadiness({
    safeForBusinessBackfill: false,
    scope: {
      businessCount: 2,
      staffRoleCount: 1,
    },
    summary: {
      unowned: 1,
    },
    blockers: [
      { blocker: "ambiguous-business-attribution" },
    ],
  });

  assert.equal(sanitised.databaseWrites, false);
  assert.equal(sanitised.identifiersIncluded, false);
  assert.equal(sanitised.permissionsIncluded, false);
  assert.equal(
    sanitised.summary.blockerTypes[
      "ambiguous-business-attribution"
    ],
    1
  );
});
