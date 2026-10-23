import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import PriceRule from "../features/dynamicPricing/PriceRule.js";
import PricingExperiment from "../features/dynamicPricing/PricingExperiment.js";

const BUSINESS_ID = "507f1f77bcf86cd799439021";
const USER_ID = "507f1f77bcf86cd799439024";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("dynamic pricing research is tenant scoped and has no deployment endpoint", async () => {
  const [routes, service] = await Promise.all([
    source("../features/dynamicPricing/dynamicPricingRoutes.js"),
    source("../features/dynamicPricing/dynamicPricingService.js"),
  ]);

  assert.match(routes, /trustedTenantContextMiddleware/);
  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(service, /Appointment\.find\(\{[\s\S]*business: businessId/);
  assert.doesNotMatch(routes, /deploy|publish|activate/);
  assert.doesNotMatch(service, /Service\.(update|findOneAndUpdate|findByIdAndUpdate)|\.price\s*=/);
});

test("PriceRule caps modifier and structurally disables production deployment", async () => {
  const rule = new PriceRule({
    business: BUSINESS_ID,
    name: "Peak Saturday simulation",
    modifierPercent: 12,
    transparency: {
      customerDisclosure: "Prices may vary by appointment time and demand.",
      internalRationale: "Research peak demand response without customer personalisation.",
    },
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  await assert.doesNotReject(rule.validate());
  assert.equal(rule.fairnessReview.personalisationAllowed, false);
  assert.equal(rule.fairnessReview.productionDeploymentAllowed, false);

  rule.modifierPercent = 25;
  await assert.rejects(rule.validate());
});

test("PricingExperiment is simulation-only and cannot claim causal uplift", async () => {
  const experiment = new PricingExperiment({
    business: BUSINESS_ID,
    name: "Peak demand price sensitivity",
    hypothesis: "A bounded peak modifier may improve mechanical revenue sensitivity.",
    createdBy: USER_ID,
    updatedBy: USER_ID,
  });

  await assert.doesNotReject(experiment.validate());
  assert.equal(experiment.mode, "simulation_only");
  assert.equal(experiment.safeguards.productionDeploymentAllowed, false);
  assert.equal(experiment.safeguards.personalisationAllowed, false);
  assert.equal(experiment.safeguards.causalUpliftClaimAllowed, false);
});

test("pricing service rejects personal/customer signals and requires fairness approval", async () => {
  const service = await source(
    "../features/dynamicPricing/dynamicPricingService.js"
  );

  assert.match(service, /PRICING_PERSONALISATION_SIGNAL_PROHIBITED/);
  assert.match(service, /PROHIBITED_PERSONALISATION_KEYS/);
  assert.match(service, /approved_for_experiment/);
  assert.match(service, /fairnessReview\.status/);
  assert.match(service, /mechanical price sensitivity calculation, not causal uplift evidence/);
  assert.match(service, /No canonical Service price is changed/);
});

test("price-rule creation ignores client location authority and validates tenant-owned Service references", async () => {
  const controller = await source(
    "../features/dynamicPricing/dynamicPricingController.js"
  );

  assert.match(controller, /delete payload\.location/);
  assert.match(controller, /tenant\.locationId/);
  assert.match(controller, /Service\.exists\(\{/);
  assert.match(controller, /business:\s*tenant\.businessId/);
  assert.match(controller, /PRICING_RESEARCH_SERVICE_NOT_OWNED/);
  assert.match(controller, /tenantSafeRulePayload/);
});
