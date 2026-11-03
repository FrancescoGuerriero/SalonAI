import assert from "node:assert/strict";
import test from "node:test";

import { requireCoreAiExecutionContext } from "../platform/coreAi/coreAiExecutionContext.js";

function invoke(middleware, overrides = {}) {
  const request = {
    effectiveAuthority: {
      businessId: "business-a",
      userId: "user-a",
      locationId: "location-a",
      locationAccessMode: "selected",
      allowedLocationIds: ["location-a"],
      permissions: ["ai:use"],
    },
    commercialModuleEntitlement: {
      moduleKey: "ai-decision-support",
      businessId: "business-a",
      manifestRevision: "4",
    },
    ...overrides,
  };
  let callbackError = null;
  let called = false;
  middleware(request, {}, (error) => {
    called = true;
    callbackError = error || null;
  });
  assert.equal(called, true);
  return { request, error: callbackError };
}

const middleware = requireCoreAiExecutionContext({
  moduleKey: "ai-decision-support",
  toolKey: "business-adviser",
});

test("Core AI derives immutable execution context only from effective authority and entitlement", () => {
  const { request, error } = invoke(middleware, {
    body: { businessId: "business-b", locationId: "location-b" },
  });
  assert.equal(error, null);
  assert.equal(request.coreAiExecutionContext.businessId, "business-a");
  assert.equal(request.coreAiExecutionContext.locationId, "location-a");
  assert.equal(request.coreAiExecutionContext.moduleKey, "ai-decision-support");
  assert.equal(request.coreAiExecutionContext.toolKey, "business-adviser");
  assert.equal(request.coreAiExecutionContext.externalWritesAllowed, false);
  assert.equal(request.coreAiExecutionContext.automaticModelPromotionAllowed, false);
  assert.equal(request.coreAiExecutionContext.requiresHumanApprovalForConsequentialActions, true);
  assert.equal(Object.isFrozen(request.coreAiExecutionContext), true);
  assert.equal(Object.isFrozen(request.coreAiExecutionContext.allowedLocationIds), true);
});

test("Core AI refuses an entitlement for a different Business", () => {
  const { error, request } = invoke(middleware, {
    commercialModuleEntitlement: {
      moduleKey: "ai-decision-support",
      businessId: "business-b",
    },
  });
  assert.equal(error?.code, "CORE_AI_AUTHORITY_REQUIRED");
  assert.equal(request.coreAiExecutionContext, undefined);
});

test("Core AI refuses a different installed module", () => {
  const { error } = invoke(middleware, {
    commercialModuleEntitlement: {
      moduleKey: "ai-retention",
      businessId: "business-a",
    },
  });
  assert.equal(error?.code, "CORE_AI_AUTHORITY_REQUIRED");
});

test("Core AI refuses missing AI permission", () => {
  const { error } = invoke(middleware, {
    effectiveAuthority: {
      businessId: "business-a",
      userId: "user-a",
      locationId: "location-a",
      locationAccessMode: "selected",
      allowedLocationIds: ["location-a"],
      permissions: [],
    },
  });
  assert.equal(error?.code, "CORE_AI_PERMISSION_REQUIRED");
});

test("Core AI refuses out-of-scope selected Location", () => {
  const { error } = invoke(middleware, {
    effectiveAuthority: {
      businessId: "business-a",
      userId: "user-a",
      locationId: "location-b",
      locationAccessMode: "selected",
      allowedLocationIds: ["location-a"],
      permissions: ["ai:use"],
    },
  });
  assert.equal(error?.code, "CORE_AI_LOCATION_FORBIDDEN");
});

test("Core AI accepts explicitly all-location authority without inventing a selected Location", () => {
  const { error, request } = invoke(middleware, {
    effectiveAuthority: {
      businessId: "business-a",
      userId: "user-a",
      locationId: null,
      locationAccessMode: "all",
      allowedLocationIds: null,
      permissions: ["ai:use"],
    },
  });
  assert.equal(error, null);
  assert.equal(request.coreAiExecutionContext.locationId, null);
  assert.equal(request.coreAiExecutionContext.locationAccessMode, "all");
});

test("Core AI policy construction fails closed without explicit module/tool identifiers", () => {
  assert.throws(() => requireCoreAiExecutionContext({ moduleKey: "ai-decision-support" }), { code: "CORE_AI_POLICY_INVALID" });
});
