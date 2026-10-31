import test from "node:test";
import assert from "node:assert/strict";

import AiTrainingDataset from "../features/aiPlatform/AiTrainingDataset.js";
import {
  AI_TRAINING_LAYERS,
  getAiTrainingProfile,
  listAiTrainingProfiles,
} from "../features/aiPlatform/aiTrainingProfileRegistry.js";
import {
  getBuiltinAiAgentDefinition,
} from "../features/aiPlatform/aiWorkforceBuiltinAgents.js";
import {
  requireAiWorkforceTool,
} from "../features/aiPlatform/aiWorkforceToolRegistry.js";
import {
  getTenantBlueprint,
} from "../platform/productComposition/tenantBlueprintRegistry.js";

test("tenant AI profiles define general, vertical, tenant and continuous-ML layers", () => {
  assert.deepEqual(AI_TRAINING_LAYERS, [
    "general",
    "vertical",
    "tenant",
    "continuous-ml",
  ]);

  const profiles = listAiTrainingProfiles();
  assert.equal(profiles.length, 2);

  for (const profile of profiles) {
    assert.equal(profile.productionTrainingEnabled, false);
    assert.equal(profile.automaticPromotionEnabled, false);
    assert.equal(profile.automaticInferenceActivationEnabled, false);
    assert.equal(profile.crossTenantPrivateDataReuseEnabled, false);
    for (const layer of AI_TRAINING_LAYERS) {
      assert.equal(profile.layers[layer].enabled, true);
    }
  }
});

test("Stylish AI profile remains salon-scoped and tenant-specific", () => {
  const profile = getAiTrainingProfile("stylish-ai");
  const blueprint = getTenantBlueprint("stylish");

  assert.ok(profile);
  assert.ok(blueprint);
  assert.equal(profile.tenantBlueprintKey, blueprint.key);
  assert.equal(profile.verticalId, "salon");
  assert.equal(profile.layers.tenant.scopeMode, "single_business");
  assert.ok(profile.layers.tenant.knowledgeSources.includes("stylish-service-catalogue"));
  assert.ok(profile.layers["continuous-ml"].tasks.includes("no-show-risk"));
});

test("Gut Instinct AI profile remains retail-scoped and does not permit cross-tenant private training", () => {
  const profile = getAiTrainingProfile("gut-instinct-ai");
  const blueprint = getTenantBlueprint("gut-instinct");

  assert.ok(profile);
  assert.ok(blueprint);
  assert.equal(profile.tenantBlueprintKey, blueprint.key);
  assert.equal(profile.verticalId, "retail");
  assert.equal(profile.layers.vertical.scopeMode, "cross_business_deidentified");
  assert.equal(profile.layers.vertical.mayUseTenantPrivateData, false);
  assert.equal(profile.layers.tenant.scopeMode, "single_business");
  assert.equal(profile.layers["continuous-ml"].scopeMode, "single_business");
  assert.ok(profile.layers["continuous-ml"].tasks.includes("inventory-replenishment"));
  assert.ok(profile.layers["continuous-ml"].tasks.includes("marketplace-performance"));
});

test("AI training datasets expose fail-closed training context fields", () => {
  const document = new AiTrainingDataset({
    name: "contract-test",
    version: "1",
    task: "test-task",
    featureVersion: "1",
  });

  assert.equal(document.trainingContext.productionTrainingAuthorized, false);
  assert.equal(document.trainingContext.automaticPromotionAuthorized, false);
  assert.equal(document.trainingContext.automaticInferenceActivationAuthorized, false);

  const layer = AiTrainingDataset.schema.path("trainingContext.layer");
  assert.deepEqual(layer.enumValues, [
    "general",
    "vertical",
    "tenant",
    "continuous-ml",
  ]);
});

test("Retail Customer Concierge remains draft-only with A0 tenant-scoped read tools", () => {
  const concierge = getBuiltinAiAgentDefinition("retail-customer-concierge");
  const receptionist = getBuiltinAiAgentDefinition("ai-receptionist");

  assert.equal(concierge.lifecycle, "draft");
  assert.deepEqual(concierge.allowedVerticals, ["retail"]);
  assert.deepEqual(concierge.allowedTools, [
    "product.catalogue.read",
    "delivery.policy.read",
    "returns.policy.read",
  ]);
  assert.ok(concierge.plannedTools.includes("order.status.read"));
  assert.ok(concierge.plannedTools.includes("customer-support-action.propose"));
  assert.ok(concierge.activationBlockers.some((item) => item.includes("Order Business/Location ownership")));

  for (const key of concierge.allowedTools) {
    const tool = requireAiWorkforceTool(key);
    assert.equal(tool.mutation, false);
    assert.equal(tool.maximumAutonomy, "A0");
    assert.equal(tool.requiresHumanApproval, false);
  }

  assert.equal(receptionist.lifecycle, "active");
  assert.deepEqual(receptionist.allowedVerticals, ["salon"]);
  assert.ok(receptionist.allowedTools.includes("appointment.create.propose"));
  assert.equal(concierge.allowedTools.includes("appointment.create.propose"), false);
});

test("AI Business Adviser can consume generic governed metrics for Salon and Retail only", () => {
  const adviser = getBuiltinAiAgentDefinition("business-adviser");
  assert.deepEqual(adviser.allowedVerticals, ["salon", "retail"]);
  assert.deepEqual(adviser.allowedTools, ["business.metrics.read"]);
  assert.equal(adviser.autonomyCeiling, "A0");
});
