import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMembershipBenefitPosting,
  calculateMembershipRollover,
  membershipAccessState,
  normaliseMembershipContract,
  planMembershipCollectionRetry,
} from "../platform/memberships/membershipContract.js";

const CONTRACT = {
  businessId: "business-1",
  customerId: "customer-1",
  planId: "plan-1",
  status: "active",
  startsAt: "2030-01-01T00:00:00.000Z",
  benefitInstrumentId: "wallet-1",
  homeLocationId: "location-a",
};

test("membership contract normalisation preserves canonical ownership", () => {
  const contract = normaliseMembershipContract(CONTRACT);

  assert.equal(contract.businessId, "business-1");
  assert.equal(contract.customerId, "customer-1");
  assert.equal(contract.planId, "plan-1");
  assert.equal(contract.status, "active");
});

test("frozen and past-due memberships cannot redeem benefits", () => {
  assert.deepEqual(
    membershipAccessState(
      { ...CONTRACT, status: "frozen" },
      new Date("2030-06-01T00:00:00.000Z")
    ),
    { usable: false, reason: "frozen" }
  );

  assert.throws(
    () =>
      buildMembershipBenefitPosting({
        contract: { ...CONTRACT, status: "past_due" },
        programId: "program-1",
        eventType: "redeem",
        delta: -1,
        unit: "quantity",
        locationId: "location-a",
        sourceId: "appointment-1",
        idempotencyKey: "membership-redeem-1",
        occurredAt: "2030-06-01T00:00:00.000Z",
      }),
    { code: "MEMBERSHIP_BENEFIT_NOT_USABLE" }
  );
});

test("membership benefit redemption uses the shared stored-value ledger", () => {
  const posting = buildMembershipBenefitPosting({
    contract: CONTRACT,
    programId: "program-1",
    eventType: "redeem",
    delta: -1,
    unit: "quantity",
    locationId: "location-b",
    sourceId: "appointment-1",
    idempotencyKey: "membership-redeem-2",
    occurredAt: "2030-06-01T00:00:00.000Z",
  });

  assert.equal(posting.businessId, "business-1");
  assert.equal(posting.instrumentId, "wallet-1");
  assert.equal(posting.eventType, "redeem");
  assert.equal(posting.sourceType, "membership_contract");
  assert.equal(posting.saleLocationId, "location-a");
  assert.equal(posting.redemptionLocationId, "location-b");
});

test("collection retry policy is deterministic and bounded", () => {
  const retry = planMembershipCollectionRetry({
    attemptNumber: 2,
    failedAt: "2030-06-01T12:00:00.000Z",
    retryDays: [1, 3, 7],
  });

  assert.equal(retry.retry, true);
  assert.equal(retry.retryAfterDays, 3);
  assert.equal(retry.nextRetryAt, "2030-06-04T12:00:00.000Z");

  assert.equal(
    planMembershipCollectionRetry({
      attemptNumber: 4,
      failedAt: "2030-06-01T12:00:00.000Z",
      retryDays: [1, 3, 7],
    }).retry,
    false
  );
});

test("rollover respects plan allowance and cap", () => {
  assert.deepEqual(
    calculateMembershipRollover({
      unused: 5,
      newAllowance: 4,
      rolloverEnabled: true,
      rolloverLimit: 2,
    }),
    {
      rolled: 2,
      newAllowance: 4,
      openingBalance: 6,
    }
  );
});
