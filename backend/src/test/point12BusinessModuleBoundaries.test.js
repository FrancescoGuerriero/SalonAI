import test from "node:test";
import assert from "node:assert/strict";

import {
  getCapabilityPack,
  listAllocatableCapabilityPacks,
  listCapabilityPacks,
} from "../platform/capabilities/capabilityRegistry.js";
import {
  getVerticalPackDefinition,
  validateProductRegistryIntegrity,
} from "../platform/capabilities/verticalPackRegistry.js";

test("Point 12 capability registry has one owner per canonical business domain", () => {
  const result = validateProductRegistryIntegrity();
  assert.equal(result.valid, true);
  assert.ok(result.canonicalDomainCount > 0);

  const owners = new Map();
  for (const capability of listCapabilityPacks()) {
    if (capability.status === "retired") continue;
    for (const domain of capability.ownedDomains) {
      assert.equal(
        owners.has(domain),
        false,
        `canonical domain ${domain} must not be owned by multiple modules`
      );
      owners.set(domain, capability.key);
    }
  }
});

test("Marketing is one allocatable business module backed by distinct internal engines", () => {
  const marketing = getCapabilityPack("marketing");
  const marketingData = getCapabilityPack("marketing-data");
  const campaigns = getCapabilityPack("campaigns-attribution");
  const automation = getCapabilityPack("marketing-automation");

  assert.equal(marketing.allocatable, true);
  assert.equal(marketing.moduleClass, "bundle");
  assert.ok(marketing.dependencies.includes("marketing-automation"));
  assert.ok(marketing.dependencies.includes("integrations"));

  assert.equal(marketingData.allocatable, false);
  assert.equal(campaigns.allocatable, false);
  assert.equal(automation.allocatable, false);

  assert.deepEqual(marketingData.ownedDomains.sort(), [
    "marketing-ingestion",
    "marketing-lineage",
    "marketing-normalised-data",
  ]);
  assert.ok(campaigns.ownedDomains.includes("campaign"));
  assert.ok(campaigns.ownedDomains.includes("marketing-attribution"));
  assert.ok(automation.ownedDomains.includes("marketing-automation-run"));

  assert.equal(marketingData.ownedDomains.includes("campaign"), false);
  assert.equal(campaigns.ownedDomains.includes("marketing-automation-run"), false);
  assert.equal(automation.ownedDomains.includes("marketing-normalised-data"), false);
});

test("AI modules assist decisions without taking ownership of marketing execution", () => {
  const adviser = getCapabilityPack("ai-decision-support");
  const retention = getCapabilityPack("ai-retention");
  const stylist = getCapabilityPack("ai-stylist-copilot");

  assert.equal(adviser.decisionSupportOnly, true);
  assert.equal(retention.decisionSupportOnly, true);
  assert.equal(stylist.decisionSupportOnly, true);

  for (const capability of [adviser, retention, stylist]) {
    assert.equal(capability.moduleClass, "ai-assistant");
    assert.ok(capability.dependencies.includes("ai"));
    assert.equal(capability.ownedDomains.includes("campaign"), false);
    assert.equal(capability.ownedDomains.includes("campaign-execution"), false);
    assert.equal(capability.ownedDomains.includes("marketing-automation-run"), false);
  }
});

test("business allocation hides internal AI and marketing engines", () => {
  const allocatable = new Set(
    listAllocatableCapabilityPacks().map(({ key }) => key)
  );

  assert.ok(allocatable.has("marketing"));
  assert.ok(allocatable.has("integrations"));
  assert.ok(allocatable.has("crm"));
  assert.ok(allocatable.has("ai-decision-support"));
  assert.equal(allocatable.has("ai"), false);
  assert.equal(allocatable.has("marketing-data"), false);
  assert.equal(allocatable.has("campaigns-attribution"), false);
  assert.equal(allocatable.has("marketing-automation"), false);

  const salon = getVerticalPackDefinition("salon");
  const salonAllocatable = new Set(salon.allocatableCapabilityPackKeys);
  assert.ok(salonAllocatable.has("marketing"));
  assert.ok(salonAllocatable.has("ai-stylist-copilot"));
  assert.equal(salonAllocatable.has("marketing-data"), false);
});
