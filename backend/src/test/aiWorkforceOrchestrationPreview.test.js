import assert from "node:assert/strict";
import test from "node:test";
import {
  previewAiWorkforceToolInvocation,
} from "../features/aiPlatform/aiWorkforceOrchestrationPreview.js";

const BUSINESS = "507f1f77bcf86cd799439021";
const OTHER_BUSINESS = "507f1f77bcf86cd799439099";
const LOCATION = "507f1f77bcf86cd799439022";
const OTHER_LOCATION = "507f1f77bcf86cd799439023";

const authority = {
  businessId: BUSINESS,
  locationId: LOCATION,
  locationAccessMode: "selected",
  allowedLocationIds: [LOCATION],
  permissions: ["ai:use", "appointment:read", "appointment:update"],
};
const composition = {
  manifest: { businessId: BUSINESS, status: "active" },
  vertical: { id: "salon" },
  enabledCapabilityPackKeys: ["ai", "appointments"],
};
const agent = {
  key: "business-adviser",
  version: "1",
  lifecycle: "active",
  allowedVerticals: ["salon"],
  requiredEntitlement: "",
  allowedTools: ["availability.search"],
  autonomyCeiling: "A0",
};

function preview(overrides = {}) {
  return previewAiWorkforceToolInvocation({
    agent,
    toolKey: "availability.search",
    effectiveAuthority: authority,
    composition,
    locationId: LOCATION,
    ...overrides,
  });
}

test("preflight permits only non-executing read-only planning with trusted scope", () => {
  const result = preview();
  assert.equal(result.businessId, BUSINESS);
  assert.equal(result.locationId, LOCATION);
  assert.equal(result.executionAuthorised, false);
  assert.equal(result.mutationAuthorised, false);
  assert.equal(result.decision, "authorised_for_read_only_planning");
  assert.equal(Object.isFrozen(result), true);
});

test("foreign business, suspended composition and disabled AI capability fail closed", () => {
  assert.throws(() => preview({
    composition: { ...composition, manifest: { businessId: OTHER_BUSINESS, status: "active" } },
  }), /Active composition/);
  assert.throws(() => preview({
    composition: { ...composition, manifest: { businessId: BUSINESS, status: "suspended" } },
  }), /Active composition/);
  assert.throws(() => preview({
    composition: { ...composition, enabledCapabilityPackKeys: ["appointments"] },
  }), /not enabled/);
});

test("unknown tools, agent allow-list and authority permissions are enforced", () => {
  assert.throws(() => preview({ toolKey: "database.unrestricted.write" }), /registered tools only/);
  assert.throws(() => preview({ agent: { ...agent, allowedTools: [] } }), /not granted/);
  assert.throws(() => preview({
    effectiveAuthority: { ...authority, permissions: ["ai:use"] },
  }), /permission/);
  assert.throws(() => preview({
    effectiveAuthority: { ...authority, permissions: ["appointment:read"] },
  }), /permission/);
});

test("location, vertical, entitlement and autonomy violations fail closed", () => {
  assert.throws(() => preview({ locationId: OTHER_LOCATION }), /outside the trusted membership/);
  assert.throws(() => preview({
    composition: { ...composition, vertical: { id: "fitness" } },
  }), /tenant vertical/);
  assert.throws(() => preview({
    agent: { ...agent, requiredEntitlement: "ai-tools" },
  }), /agent entitlement/);
  assert.equal(preview({
    agent: { ...agent, requiredEntitlement: "ai-tools" },
    enabledEntitlements: ["ai-tools"],
  }).executionAuthorised, false);
  assert.throws(() => preview({ requestedAutonomy: "A1" }), /read-only/);
});

test("an agent cannot request a proposal tool through an A0 preview", () => {
  assert.throws(() => preview({
    toolKey: "appointment.reschedule.propose",
    agent: { ...agent, allowedTools: ["appointment.reschedule.propose"], autonomyCeiling: "A1" },
  }), /Only registered low-risk A0 read tools/);
});
