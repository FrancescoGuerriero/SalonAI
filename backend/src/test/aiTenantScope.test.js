import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  buildAiTenantFilter,
  normaliseAiTenantScope,
} from "../features/aiPlatform/aiTenantScope.js";

const BUSINESS_ID =
  "507f1f77bcf86cd799439021";
const LOCATION_A =
  "507f1f77bcf86cd799439022";
const LOCATION_B =
  "507f1f77bcf86cd799439023";

test("AI tenant scope fails closed without trusted Business context", () => {
  assert.throws(
    () => normaliseAiTenantScope({}),
    /Trusted Business context is required/
  );
});

test("selected-location AI scope limits queries to authorised Locations", () => {
  const {
    scope,
    filter,
  } = buildAiTenantFilter({
    businessId:
      BUSINESS_ID,
    locationAccessMode:
      "selected",
    allowedLocationIds: [
      LOCATION_A,
      LOCATION_B,
    ],
  });

  assert.equal(
    scope.businessId,
    BUSINESS_ID
  );
  assert.deepEqual(
    filter,
    {
      business:
        BUSINESS_ID,
      location: {
        $in: [
          LOCATION_A,
          LOCATION_B,
        ],
      },
    }
  );
});

test("explicit selected Location must be inside trusted membership scope", () => {
  assert.throws(
    () =>
      buildAiTenantFilter({
        businessId:
          BUSINESS_ID,
        locationId:
          LOCATION_B,
        locationAccessMode:
          "selected",
        allowedLocationIds: [
          LOCATION_A,
        ],
      }),
    /outside the trusted membership scope/
  );
});

test("business-wide AI authority scopes by Business without inventing a Location filter", () => {
  const {
    filter,
  } = buildAiTenantFilter({
    businessId:
      BUSINESS_ID,
    locationAccessMode:
      "all",
  });

  assert.deepEqual(
    filter,
    {
      business:
        BUSINESS_ID,
    }
  );
});

test("no-show AI routes resolve trusted tenant and effective authority before controller execution", async () => {
  const routes =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiRecommendationRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    routes,
    /const tenantAwareAiChain = \[[\s\S]*?trustedTenantContextMiddleware[\s\S]*?effectiveAuthorityMiddleware[\s\S]*?requirePermissions\([\s\S]*?"ai:use"/
  );
  assert.match(
    routes,
    /"\/no-show-predictions"[\s\S]*?\.\.\.tenantAwareAiChain[\s\S]*?getAiNoShowPredictions/
  );
  assert.match(
    routes,
    /"\/no-show-evaluation"[\s\S]*?\.\.\.tenantAwareAiChain[\s\S]*?getAiNoShowEvaluation/
  );
});

test("no-show controller consumes server-resolved tenantContext rather than request Business selectors", async () => {
  const controller =
    await readFile(
      new URL(
        "../features/aiRecommendations/aiNoShowPredictionController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    controller,
    /request\.tenantContext/
  );
  assert.match(
    controller,
    /businessId:[\s\S]*?tenantContext\.businessId/
  );
  assert.doesNotMatch(
    controller,
    /request\.query\?\.businessId|request\.body\?\.businessId|x-business/
  );
});

test("tenant no-show evaluation query is Business-scoped before aggregation", async () => {
  const service =
    await readFile(
      new URL(
        "../features/aiPlatform/tenantScopedNoShowEvaluationService.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    service,
    /buildAiTenantFilter/
  );
  assert.match(
    service,
    /AiInferenceLog\.find\(\{[\s\S]*?\.\.\.tenantFilter[\s\S]*?NO_SHOW_INFERENCE_CAPABILITY/
  );
  assert.match(
    service,
    /tenantScoped: true/
  );
});
