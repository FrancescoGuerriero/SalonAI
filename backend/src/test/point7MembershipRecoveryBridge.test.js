import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Point 7 membership recovery bridge consumes canonical recovery cases only", async () => {
  const bridge = await source(
    "../features/premium/automation/stage7MembershipRecoveryBridge.js"
  );

  assert.match(bridge, /MembershipRecoveryCase/);
  assert.match(bridge, /membership_payment_failed/);
  assert.match(bridge, /membership_payment_recovered/);
  assert.match(bridge, /createJourneyEnrollment/);
  assert.match(bridge, /executionAuthorised:\s*false/);
  assert.match(bridge, /financialStateMutated:\s*false/);
  assert.doesNotMatch(
    bridge,
    /CollectionAttempt\.findOneAndUpdate|MembershipContract\.findOneAndUpdate|retryPayment|chargeCard|createPaymentIntent|capturePayment/
  );
});

test("Point 7 membership recovery reconciliation is tenant scoped and idempotent", async () => {
  const bridge = await source(
    "../features/premium/automation/stage7MembershipRecoveryBridge.js"
  );
  const routes = await source(
    "../features/premium/automation/automationRoutes.js"
  );

  assert.match(bridge, /requireRetentionBusinessId/);
  assert.match(bridge, /business:\s*businessId/);
  assert.match(bridge, /membership-recovery:\$\{String\(recoveryCaseId\)\}/);
  assert.match(routes, /\/membership-recovery\/reconcile/);
  assert.match(routes, /retention-automation:manage/);
});
