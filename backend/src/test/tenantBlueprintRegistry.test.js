import test from "node:test";
import assert from "node:assert/strict";

import {
  getTenantBlueprint,
  listTenantBlueprints,
} from "../platform/productComposition/tenantBlueprintRegistry.js";

test("planned tenant catalogue includes Stylish salon and Gut Instinct retail", () => {
  const tenants = listTenantBlueprints();
  const keys = new Set(tenants.map(({ key }) => key));

  assert.equal(keys.has("stylish"), true);
  assert.equal(keys.has("gut-instinct"), true);
  assert.equal(getTenantBlueprint("stylish")?.verticalId, "salon");
  assert.equal(getTenantBlueprint("gut-instinct")?.verticalId, "retail");
});

test("Gut Instinct retail blueprint installs CRM, Marketing, Communications and Marketplace separately", () => {
  const tenant = getTenantBlueprint("gut-instinct");
  const selected = new Set(tenant.selectedModuleKeys);

  for (const key of [
    "crm",
    "marketing",
    "communications",
    "seller-marketplace",
    "ecommerce-store",
    "analytics",
  ]) {
    assert.equal(selected.has(key), true, `${key} must be explicitly selected for Gut Instinct`);
  }

  assert.equal(selected.has("appointments"), false);
  assert.equal(selected.has("ai-stylist-copilot"), false);
  assert.equal(selected.has("ai-receptionist"), false);
});

test("tenant AI profiles distinguish general, vertical, tenant and ongoing ML learning", () => {
  for (const tenant of listTenantBlueprints()) {
    assert.equal(tenant.aiProfile.generalTraining, true);
    assert.equal(tenant.aiProfile.verticalTraining, true);
    assert.equal(tenant.aiProfile.tenantTraining, true);
    assert.equal(tenant.aiProfile.continuousMachineLearning, true);
    assert.equal(tenant.aiProfile.knowledgeRetrieval, true);
  }
});
