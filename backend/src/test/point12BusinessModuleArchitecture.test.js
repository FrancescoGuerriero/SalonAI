import test from "node:test";
import assert from "node:assert/strict";

import {
  getCapabilityPack,
  listCapabilityPacks,
} from "../platform/capabilities/capabilityRegistry.js";
import {
  getBusinessModule,
  listBusinessModules,
  resolveBusinessModuleAllocation,
  validateBusinessModuleRegistry,
} from "../platform/modules/businessModuleRegistry.js";

const requiredPoint12Packs = [
  "integrations",
  "crm",
  "marketing-automation",
  "ai-decision-support",
];

test("Point 12 registers distinct allocatable capability packs", () => {
  const keys = new Set(listCapabilityPacks().map(({ key }) => key));
  for (const key of requiredPoint12Packs) {
    assert.equal(keys.has(key), true, `${key} should be registered`);
    assert.equal(getCapabilityPack(key).status, "active");
  }
});

test("business module registry has no duplicated primary responsibility", () => {
  const validation = validateBusinessModuleRegistry();
  assert.equal(validation.valid, true);
  assert.ok(validation.moduleCount >= 10);

  const owners = new Map();
  for (const module of listBusinessModules()) {
    for (const responsibility of module.primaryResponsibilities) {
      assert.equal(
        owners.has(responsibility),
        false,
        `${responsibility} must have only one primary module owner`
      );
      owners.set(responsibility, module.key);
    }
  }
});

test("Integration Hub owns provider connectivity but not campaign execution", () => {
  const integrations = getBusinessModule("integration-hub");
  assert.equal(integrations.connectsExternalPlatforms, true);
  assert.ok(integrations.primaryResponsibilities.includes("provider-account-connections"));
  assert.ok(integrations.primaryResponsibilities.includes("provider-credential-governance"));
  assert.equal(integrations.primaryResponsibilities.includes("campaign-definition-and-orchestration"), false);
});

test("Marketing Automation orchestrates campaigns but consumes other module authorities", () => {
  const marketing = getBusinessModule("marketing-automation");
  assert.equal(marketing.executionAuthority, "human-approved-automation");
  assert.deepEqual(
    new Set(marketing.dependsOnModules),
    new Set([
      "crm-customer-intelligence",
      "communications",
      "integration-hub",
      "analytics-bi",
    ])
  );
  assert.ok(marketing.primaryResponsibilities.includes("campaign-definition-and-orchestration"));
  assert.ok(marketing.primaryResponsibilities.includes("journey-definition-and-enrolment"));
  assert.equal(marketing.connectsExternalPlatforms, false);
});

test("AI Decision Support remains advisory and distinct from marketing execution", () => {
  const ai = getBusinessModule("ai-decision-support");
  const marketing = getBusinessModule("marketing-automation");
  assert.equal(ai.executionAuthority, "advisory-only");
  assert.ok(ai.primaryResponsibilities.includes("management-copilot"));
  assert.ok(ai.primaryResponsibilities.includes("professional-copilot"));
  for (const responsibility of ai.primaryResponsibilities) {
    assert.equal(marketing.primaryResponsibilities.includes(responsibility), false);
  }
});

test("module allocation resolves from tenant capability entitlements", () => {
  const allocated = resolveBusinessModuleAllocation([
    "integrations",
    "crm",
    "communications",
    "analytics",
    "marketing-automation",
  ]);

  const marketing = allocated.find(({ key }) => key === "marketing-automation");
  const ai = allocated.find(({ key }) => key === "ai-decision-support");

  assert.equal(marketing.allocated, true);
  assert.deepEqual(marketing.missingCapabilityPacks, []);
  assert.equal(ai.allocated, false);
  assert.ok(ai.missingCapabilityPacks.includes("ai"));
  assert.ok(ai.missingCapabilityPacks.includes("ai-decision-support"));
});
