import test from "node:test";
import assert from "node:assert/strict";

import { listAllocatableCapabilityPacks } from "../platform/capabilities/capabilityRegistry.js";
import {
  auditCommercialModuleInstallability,
  resolveModuleInstallationPlan,
} from "../platform/capabilities/moduleInstallationResolver.js";
import { getVerticalPackDefinition } from "../platform/capabilities/verticalPackRegistry.js";

const VERTICALS = ["salon", "spa", "fitness", "plastic-surgery"];
const NEW_COMMERCIAL_MODULES = [
  "ecommerce",
  "business-planning",
  "customer-experience",
  "seller-marketplaces",
];

test("every allocatable module can be selected independently for every supported vertical", () => {
  for (const verticalId of VERTICALS) {
    const audit = auditCommercialModuleInstallability(verticalId);
    assert.equal(
      audit.failedCount,
      0,
      `${verticalId} has non-installable modules: ${audit.results.filter(({ installable }) => !installable).map(({ key, error }) => `${key}: ${error}`).join("; ")}`
    );
    assert.equal(audit.installableCount, audit.moduleCount);
  }
});

test("new commercial modules are independently selectable and resolve only declared dependencies", () => {
  const expectedDependencies = {
    ecommerce: ["services", "commerce"],
    "business-planning": ["analytics"],
    "customer-experience": ["crm"],
    "seller-marketplaces": ["integrations", "commerce"],
  };

  const allocatable = new Set(listAllocatableCapabilityPacks().map(({ key }) => key));
  for (const key of NEW_COMMERCIAL_MODULES) {
    assert.equal(allocatable.has(key), true, `${key} must be commercially allocatable`);
    const plan = resolveModuleInstallationPlan({ selectedModuleKeys: [key], verticalId: "salon" });
    assert.deepEqual(plan.selectedModuleKeys, [key]);
    for (const dependency of expectedDependencies[key]) {
      assert.ok(plan.requiredCapabilityKeys.includes(dependency), `${key} must resolve ${dependency}`);
    }
  }
});

test("commercial modules auto-resolve internal/runtime dependencies", () => {
  const calendar = resolveModuleInstallationPlan({ selectedModuleKeys: ["calendar"], verticalId: "salon" });
  assert.deepEqual(calendar.selectedModuleKeys, ["calendar"]);
  assert.ok(calendar.requiredCapabilityKeys.includes("appointments"));
  assert.ok(calendar.internalDependencyKeys.includes("appointments"));

  const memberships = resolveModuleInstallationPlan({ selectedModuleKeys: ["memberships"], verticalId: "salon" });
  assert.ok(memberships.requiredCapabilityKeys.includes("commerce"));

  const receptionist = resolveModuleInstallationPlan({ selectedModuleKeys: ["ai-receptionist"], verticalId: "salon" });
  for (const dependency of ["ai", "communications", "appointments"]) {
    assert.ok(receptionist.requiredCapabilityKeys.includes(dependency));
  }

  const marketing = resolveModuleInstallationPlan({ selectedModuleKeys: ["marketing"], verticalId: "salon" });
  for (const dependency of ["integrations", "marketing-automation", "marketing-data", "campaigns-attribution", "crm", "communications", "analytics"]) {
    assert.ok(marketing.requiredCapabilityKeys.includes(dependency));
  }
});

test("all supported commercial modules can compose into one tenant installation plan", () => {
  for (const verticalId of VERTICALS) {
    const vertical = getVerticalPackDefinition(verticalId);
    const selectedModuleKeys = [...vertical.allocatableCapabilityPackKeys];
    const plan = resolveModuleInstallationPlan({ selectedModuleKeys, verticalId });
    assert.deepEqual([...plan.selectedModuleKeys].sort(), [...selectedModuleKeys].sort());
    assert.equal(new Set(plan.requiredCapabilityKeys).size, plan.requiredCapabilityKeys.length);
    assert.ok(plan.requiredCapabilityKeys.length >= selectedModuleKeys.length);
  }
});

test("internal capabilities cannot be sold or selected directly", () => {
  const internalKeys = ["ai", "marketing-data", "campaigns-attribution", "marketing-automation"];
  const allocatable = new Set(listAllocatableCapabilityPacks().map(({ key }) => key));
  for (const key of internalKeys) assert.equal(allocatable.has(key), false);
  assert.throws(
    () => resolveModuleInstallationPlan({ selectedModuleKeys: ["marketing-data"], verticalId: "salon" }),
    /internal and cannot be selected as a commercial module/
  );
});
