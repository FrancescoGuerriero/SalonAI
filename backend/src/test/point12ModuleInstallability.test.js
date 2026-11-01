import test from "node:test";
import assert from "node:assert/strict";

import { listAllocatableCapabilityPacks } from "../platform/capabilities/capabilityRegistry.js";
import {
  auditCommercialModuleInstallability,
  resolveModuleInstallationPlan,
} from "../platform/capabilities/moduleInstallationResolver.js";
import { getVerticalPackDefinition } from "../platform/capabilities/verticalPackRegistry.js";
import { resolveEffectiveTenantProductComposition } from "../platform/productComposition/tenantProductManifest.js";

const VERTICALS = ["salon", "spa", "fitness", "plastic-surgery", "retail"];
const EXPECTED_COMMERCIAL_MODULE_COUNTS = Object.freeze({
  salon: 21,
  spa: 20,
  fitness: 19,
  "plastic-surgery": 15,
  retail: 15,
});
const NEW_COMMERCIAL_MODULES = [
  "ecommerce-store",
  "business-planning",
  "customer-experience",
  "seller-marketplace",
];

test("Point 12 commercial portfolio exposes exactly 22 allocatable modules", () => {
  const allocatable = listAllocatableCapabilityPacks();
  assert.equal(
    allocatable.length,
    22,
    "The Point 12 commercial portfolio contract must remain synchronised with the 22-module catalogue."
  );
  assert.equal(
    new Set(allocatable.map(({ key }) => key)).size,
    22,
    "Commercial module keys must remain unique."
  );
});

test("every allocatable module can be selected independently for every supported vertical", () => {
  for (const verticalId of VERTICALS) {
    const audit = auditCommercialModuleInstallability(verticalId);
    assert.equal(
      audit.moduleCount,
      EXPECTED_COMMERCIAL_MODULE_COUNTS[verticalId],
      `${verticalId} commercial module count drifted from the Point 12 audited portfolio.`
    );
    assert.equal(
      audit.failedCount,
      0,
      `${verticalId} has non-installable modules: ${audit.results.filter(({ installable }) => !installable).map(({ key, error }) => `${key}: ${error}`).join("; ")}`
    );
    assert.equal(audit.installableCount, audit.moduleCount);
  }
});

test("Retail composition keeps CRM, Marketing and Communications as distinct commercial authorities", () => {
  const retail = getVerticalPackDefinition("retail");
  const supported = new Set(retail.allocatableCapabilityPackKeys);

  for (const key of ["crm", "marketing", "communications"]) {
    assert.equal(supported.has(key), true, `${key} must be independently allocatable for Retail`);
  }

  const marketing = resolveModuleInstallationPlan({
    selectedModuleKeys: ["marketing"],
    verticalId: "retail",
  });

  for (const dependency of [
    "crm",
    "communications",
    "analytics",
    "integrations",
    "marketing-data",
    "campaigns-attribution",
    "marketing-automation",
  ]) {
    assert.ok(marketing.requiredCapabilityKeys.includes(dependency));
  }
});

test("new commercial modules are independently selectable and resolve declared dependencies", () => {
  const expectedDependencies = {
    "ecommerce-store": ["commerce"],
    "business-planning": ["analytics", "ai-decision-support"],
    "customer-experience": ["crm", "communications", "analytics"],
    "seller-marketplace": ["integrations", "commerce", "analytics"],
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

test("disabling a shared dependency fails dependent modules closed without disabling unrelated modules", () => {
  const verticalId = "salon";
  const vertical = getVerticalPackDefinition(verticalId);
  const plan = resolveModuleInstallationPlan({
    selectedModuleKeys: [...vertical.allocatableCapabilityPackKeys],
    verticalId,
  });

  const composition = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "phase-a-disabled-module-audit",
      verticalId,
      status: "active",
      capabilityPackKeys: plan.requiredCapabilityKeys,
    },
    platformDisabledCapabilityPackKeys: ["analytics"],
  });

  const stateByKey = new Map(composition.capabilities.map((capability) => [capability.key, capability]));

  assert.equal(stateByKey.get("analytics")?.enabled, false);
  assert.equal(stateByKey.get("analytics")?.reason, "platform-safety-lock");
  assert.equal(stateByKey.get("crm")?.enabled, false);
  assert.equal(stateByKey.get("crm")?.reason, "dependency-unavailable:analytics");
  assert.equal(stateByKey.get("marketing")?.enabled, false);
  assert.match(stateByKey.get("marketing")?.reason || "", /^dependency-unavailable:/);

  for (const unrelatedKey of ["appointments", "staff", "services", "commerce", "inventory"]) {
    assert.equal(
      stateByKey.get(unrelatedKey)?.enabled,
      true,
      `${unrelatedKey} must remain usable when analytics and its dependants fail closed.`
    );
  }
});

test("removing one commercial module recomputes closure without orphaning unrelated selections", () => {
  const verticalId = "salon";
  const vertical = getVerticalPackDefinition(verticalId);
  const fullSelection = [...vertical.allocatableCapabilityPackKeys];
  const reducedSelection = fullSelection.filter((key) => key !== "ai-stylist-copilot");
  const fullPlan = resolveModuleInstallationPlan({ selectedModuleKeys: fullSelection, verticalId });
  const reducedPlan = resolveModuleInstallationPlan({ selectedModuleKeys: reducedSelection, verticalId });

  assert.equal(reducedPlan.selectedModuleKeys.includes("ai-stylist-copilot"), false);
  assert.equal(reducedPlan.requiredCapabilityKeys.includes("ai-stylist-copilot"), false);

  for (const unrelatedKey of ["appointments", "staff", "services", "commerce", "crm", "marketing"]) {
    assert.equal(reducedPlan.selectedModuleKeys.includes(unrelatedKey), true);
    assert.equal(reducedPlan.requiredCapabilityKeys.includes(unrelatedKey), true);
  }

  assert.ok(reducedPlan.requiredCapabilityKeys.length <= fullPlan.requiredCapabilityKeys.length);
  assert.equal(new Set(reducedPlan.requiredCapabilityKeys).size, reducedPlan.requiredCapabilityKeys.length);
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
