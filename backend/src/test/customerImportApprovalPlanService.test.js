import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerImportPreview,
} from "../features/customers/customerImportPreviewService.js";
import {
  buildCustomerImportApprovalPlan,
} from "../features/customers/customerImportApprovalPlanService.js";

const BUSINESS_ID = "64b000000000000000000001";
const ADMIN_ID = "64b000000000000000000002";
const EXISTING_ID = "64b000000000000000000003";

function preview(rows, options = {}) {
  return buildCustomerImportPreview(rows, {
    sourceName: "approval-plan-test",
    ...options,
  });
}

test("builds a deterministic zero-write approval plan for clean preview rows", () => {
  const staged = preview([
    {
      firstName: "Ava",
      lastName: "Stone",
      email: "ava@example.com",
    },
  ]);

  const args = {
    expectedPreviewFingerprint: staged.fingerprint,
    businessId: BUSINESS_ID,
    approvedBy: ADMIN_ID,
    approvedAt: "2026-10-22T00:30:00.000Z",
  };

  const first = buildCustomerImportApprovalPlan(staged, args);
  const second = buildCustomerImportApprovalPlan(staged, args);

  assert.equal(first.schema, "salonai.customer-import-apply-plan.v1");
  assert.equal(first.operationCount, 1);
  assert.equal(first.createCount, 1);
  assert.equal(first.operations[0].businessId, BUSINESS_ID);
  assert.equal(first.operations[0].customer.marketing.emailConsent, false);
  assert.equal(first.governance.databaseWritesAllowed, false);
  assert.equal(first.governance.separateExecutorRequired, true);
  assert.equal(first.fingerprint, second.fingerprint);
});

test("fails closed when the approved preview fingerprint no longer matches", () => {
  const staged = preview([
    { firstName: "Ava", lastName: "Stone", email: "ava@example.com" },
  ]);

  assert.throws(
    () =>
      buildCustomerImportApprovalPlan(staged, {
        expectedPreviewFingerprint: "0".repeat(64),
        businessId: BUSINESS_ID,
        approvedBy: ADMIN_ID,
      }),
    (error) => error.code === "CUSTOMER_IMPORT_PREVIEW_FINGERPRINT_MISMATCH"
  );
});

test("requires an explicit decision for warning rows", () => {
  const staged = preview([
    { firstName: "Ava", lastName: "Stone" },
  ]);

  assert.throws(
    () =>
      buildCustomerImportApprovalPlan(staged, {
        expectedPreviewFingerprint: staged.fingerprint,
        businessId: BUSINESS_ID,
        approvedBy: ADMIN_ID,
      }),
    (error) =>
      error.code === "CUSTOMER_IMPORT_APPROVAL_INCOMPLETE" &&
      error.unresolvedRows?.[0]?.reason === "warning_requires_explicit_decision"
  );
});

test("existing-customer collisions cannot be approved as create", () => {
  const staged = preview(
    [{ firstName: "Ava", lastName: "Stone", email: "ava@example.com" }],
    { existingCustomers: [{ email: "ava@example.com" }] }
  );

  assert.throws(
    () =>
      buildCustomerImportApprovalPlan(staged, {
        expectedPreviewFingerprint: staged.fingerprint,
        businessId: BUSINESS_ID,
        approvedBy: ADMIN_ID,
        decisions: { 1: { action: "create" } },
      }),
    /matches an existing customer/
  );
});

test("existing-customer collisions can only be linked with an explicit canonical customer id", () => {
  const staged = preview(
    [{ firstName: "Ava", lastName: "Stone", email: "ava@example.com" }],
    { existingCustomers: [{ email: "ava@example.com" }] }
  );

  const plan = buildCustomerImportApprovalPlan(staged, {
    expectedPreviewFingerprint: staged.fingerprint,
    businessId: BUSINESS_ID,
    approvedBy: ADMIN_ID,
    approvedAt: "2026-10-22T00:30:00.000Z",
    decisions: {
      1: { action: "match_existing", matchedCustomerId: EXISTING_ID },
    },
  });

  assert.equal(plan.matchExistingCount, 1);
  assert.equal(plan.createCount, 0);
  assert.equal(plan.operations[0].matchedCustomerId, EXISTING_ID);
  assert.equal(plan.operations[0].customer, undefined);
});

test("preview validation errors prevent approval regardless of decisions", () => {
  const staged = preview([
    { firstName: "", lastName: "Stone", email: "ava@example.com" },
  ]);

  assert.throws(
    () =>
      buildCustomerImportApprovalPlan(staged, {
        expectedPreviewFingerprint: staged.fingerprint,
        businessId: BUSINESS_ID,
        approvedBy: ADMIN_ID,
        decisions: { 1: { action: "skip" } },
      }),
    (error) => error.code === "CUSTOMER_IMPORT_APPROVAL_INCOMPLETE"
  );
});

test("tenant and administrator ownership must be explicit ObjectIds", () => {
  const staged = preview([
    { firstName: "Ava", lastName: "Stone", email: "ava@example.com" },
  ]);

  assert.throws(
    () =>
      buildCustomerImportApprovalPlan(staged, {
        expectedPreviewFingerprint: staged.fingerprint,
        businessId: "implicit",
        approvedBy: ADMIN_ID,
      }),
    /businessId must be a 24-character MongoDB ObjectId/
  );
});
