import assert from "node:assert/strict";
import test from "node:test";

import { requireCoreAiExecutionContext, assertCoreAiModuleExecutionContext } from "../platform/coreAi/coreAiExecutionContext.js";

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

test("internal Stylist Copilot rejects missing, mismatched or cross-tenant Core AI module context", async () => {
  const scopedMiddleware = requireCoreAiExecutionContext({
    moduleKey: "ai-stylist-copilot",
    toolKey: "stylist-copilot",
  });
  const { request, error } = invoke(scopedMiddleware, {
    commercialModuleEntitlement: {
      moduleKey: "ai-stylist-copilot",
      businessId: "business-a",
      manifestRevision: "9",
    },
  });
  assert.equal(error, null);
  const args = {
    context: request.coreAiExecutionContext,
    moduleKey: "ai-stylist-copilot",
    toolKey: "stylist-copilot",
    businessId: "business-a",
    locationId: "location-a",
    allowedLocationIds: ["location-a"],
    actorUserId: "user-a",
  };
  assert.equal(assertCoreAiModuleExecutionContext(args), args.context);
  for (const invalid of [
    { context: null },
    { businessId: "business-b" },
    { locationId: "location-b" },
    { allowedLocationIds: ["location-b"] },
    { moduleKey: "ai-decision-support" },
    { toolKey: "unregistered-copilot" },
    { actorUserId: "user-b" },
    { context: { ...args.context } },
  ]) {
    assert.throws(
      () => assertCoreAiModuleExecutionContext({ ...args, ...invalid }),
      { code: "CORE_AI_MODULE_EXECUTION_SCOPE_REQUIRED" }
    );
  }
});

test("internal Core AI service fails closed on selected Location scope without any allowed Location", () => {
  const context = Object.freeze({
    businessId: "business-a",
    locationId: null,
    locationAccessMode: "selected",
    allowedLocationIds: Object.freeze([]),
    userId: "user-a",
    moduleKey: "ai-stylist-copilot",
    toolKey: "stylist-copilot",
    externalWritesAllowed: false,
    automaticModelPromotionAllowed: false,
    requiresHumanApprovalForConsequentialActions: true,
  });
  assert.throws(() => assertCoreAiModuleExecutionContext({
    context, businessId: "business-a", actorUserId: "user-a",
    locationId: null, allowedLocationIds: [], moduleKey: "ai-stylist-copilot",
    toolKey: "stylist-copilot",
  }), { code: "CORE_AI_MODULE_EXECUTION_SCOPE_REQUIRED" });
});

test("Stylist controller passes the trusted Core AI context and service checks it before evidence reads", async () => {
  const { readFile } = await import("node:fs/promises");
  const [controller, service] = await Promise.all([
    readFile(new URL("../features/aiRecommendations/aiStylistCopilotController.js", import.meta.url), "utf8"),
    readFile(new URL("../features/aiRecommendations/aiStylistCopilotService.js", import.meta.url), "utf8"),
  ]);
  assert.match(controller, /coreAiExecutionContext: executionContext/);
  assert.match(service, /const authorised = assertCoreAiModuleExecutionContext\(/);
  assert.ok(service.indexOf("assertCoreAiModuleExecutionContext({") < service.indexOf("await buildStylistCopilotContext({"));
  assert.match(service, /manifestRevision: authorised\.manifestRevision/);
});
