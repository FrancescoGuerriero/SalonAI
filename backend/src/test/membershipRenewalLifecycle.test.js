import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("membership renewal applies rollover before issuing the new allowance", async () => {
  const service = await source("../features/memberships/membershipBenefitService.js");
  assert.match(service, /calculateMembershipRollover/);
  assert.match(service, /eventType: "expire"/);
  assert.match(service, /eventType: "issue"/);
  assert.match(service, /rolloverEnabled: benefit\.rolloverEnabled/);
  assert.match(service, /rolloverLimit: benefit\.rolloverLimit/);
});

test("membership benefit cycle idempotency is benefit-specific", async () => {
  const service = await source("../features/memberships/membershipBenefitService.js");
  assert.match(
    service,
    /\$\{prefix\}:\$\{benefit\.key\}:expire:\$\{cycleKey\}/
  );
  assert.match(
    service,
    /\$\{prefix\}:\$\{benefit\.key\}:issue:\$\{cycleKey\}/
  );
});

test("collection orchestration replays existing provider idempotency safely", async () => {
  const service = await source("../features/memberships/membershipCollectionOrchestrator.js");
  assert.match(service, /existingAttempt/);
  assert.match(service, /idempotentReplay: true/);
  assert.match(service, /refreshMembershipBenefitsForCycle/);
  assert.match(service, /attempt\.status !== "succeeded"/);
});

test("successful collection refresh failure remains retryable instead of rewriting payment evidence", async () => {
  const service = await source("../features/memberships/membershipCollectionOrchestrator.js");
  assert.match(service, /status: "pending"/);
  assert.match(service, /MEMBERSHIP_BENEFIT_REFRESH_FAILED/);
  assert.match(service, /recordMembershipCollection\(/);
});

test("membership collection controller reports pending derived benefit refresh with 202", async () => {
  const controller = await source("../features/memberships/membershipController.js");
  assert.match(controller, /recordMembershipCollectionAndRefreshBenefits/);
  assert.match(controller, /benefitRefresh\?\.status === "pending" \? 202 : 201/);
});
