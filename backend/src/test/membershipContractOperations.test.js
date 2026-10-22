import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("membership API uses MembershipContract as canonical membership state", async () => {
  const service = await source("../features/memberships/membershipService.js");
  assert.match(service, /MembershipContract/);
  assert.match(service, /MembershipPlan/);
  assert.match(service, /CollectionAttempt/);
  assert.doesNotMatch(service, /capacityPlanning\/loyalty\/Membership/);
});

test("membership collection failure uses deterministic retry policy", async () => {
  const service = await source("../features/memberships/membershipService.js");
  assert.match(service, /planMembershipCollectionRetry/);
  assert.match(service, /contract\.status = "past_due"/);
  assert.match(service, /contract\.nextCollectionAt/);
});

test("membership lifecycle exposes plan, contract, freeze, resume and collection routes", async () => {
  const routes = await source("../features/memberships/membershipRoutes.js");
  for (const fragment of [
    '"/plans"',
    '"/contracts"',
    '"/contracts/:id/freeze"',
    '"/contracts/:id/resume"',
    '"/contracts/:id/collections"',
    '"customer:read"',
    '"customer:update"',
  ]) {
    assert.ok(routes.includes(fragment), `Missing membership route contract: ${fragment}`);
  }
});

test("membership workspace is mounted as a canonical future-feature route", async () => {
  const futureRoutes = await source("../features/futureFeatureRoutes.js");
  assert.match(futureRoutes, /membershipRoutes/);
  assert.match(futureRoutes, /"\/memberships"/);
});
