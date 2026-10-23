import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("failed membership collections create idempotent recovery cases", async () => {
  const model = await source(
    "../features/memberships/MembershipRecoveryCase.js"
  );
  const service = await source(
    "../features/memberships/membershipRecoveryService.js"
  );

  assert.match(model, /collectionAttempt[\s\S]*?unique:\s*true/);
  assert.match(model, /status[\s\S]*?"open"[\s\S]*?"recovered"/);
  assert.match(service, /collectionAttempt\.status === "failed"/);
  assert.match(service, /\$setOnInsert/);
  assert.match(service, /nextActionAt:\s*collectionAttempt\.nextRetryAt/);
});

test("successful membership collection resolves outstanding recovery cases", async () => {
  const service = await source(
    "../features/memberships/membershipRecoveryService.js"
  );
  const orchestrator = await source(
    "../features/memberships/membershipCollectionOrchestrator.js"
  );

  assert.match(service, /collectionAttempt\.status === "succeeded"/);
  assert.match(service, /status:\s*\{ \$in: \["open", "escalated"\] \}/);
  assert.match(service, /status:\s*"recovered"/);
  assert.match(service, /resolvedByCollectionAttempt/);
  assert.match(orchestrator, /reconcileMembershipRecovery/);
  assert.match(orchestrator, /idempotentReplay:\s*true[\s\S]*?recovery/);
});
