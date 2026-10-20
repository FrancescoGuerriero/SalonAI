import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  communicationReferenceScopeMiddleware,
} from "../middleware/communicationReferenceScopeMiddleware.js";
import {
  buildCommunicationEffectiveScope,
  communicationAggregateAuthorityFilter,
  sanitizeCommunicationPayload,
} from "../services/communicationEffectiveAuthorityService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

function source(relativePath) {
  return fs.readFileSync(
    path.join(backendRoot, relativePath),
    "utf8"
  );
}

async function runReferenceScope(body) {
  let captured;
  await communicationReferenceScopeMiddleware(
    {
      body,
      communicationScope: {
        businessId: "64f000000000000000000001",
        scopeMode: "business-wide",
      },
    },
    {},
    (error) => {
      captured = error;
    }
  );
  return captured;
}

function assertPermissionBeforeResource(text, permission, resource, route) {
  const routeIndex = text.indexOf(`"${route}"`);
  assert.ok(routeIndex >= 0, `${route} must exist`);

  const permissionIndex = text.indexOf(permission, routeIndex);
  const resourceIndex = text.indexOf(resource, routeIndex);

  assert.ok(permissionIndex > routeIndex, `${route} must apply ${permission}`);
  assert.ok(resourceIndex > permissionIndex, `${route} must resolve ${resource} only after ${permission}`);
}

test("communications scope fails closed without trusted Business authority", () => {
  assert.throws(
    () => buildCommunicationEffectiveScope({}),
    (error) =>
      error?.code === "COMMUNICATION_AUTHORITY_REQUIRED" &&
      error?.statusCode === 403
  );
});

test("communications scope preserves business-wide and selected-location authority", () => {
  const businessWide = buildCommunicationEffectiveScope({
    businessId: "64f000000000000000000001",
    locationAccessMode: "all",
    allowedLocationIds: null,
  });

  assert.equal(businessWide.scopeMode, "business-wide");
  assert.deepEqual(
    communicationAggregateAuthorityFilter(businessWide),
    { business: "64f000000000000000000001" }
  );

  const selected = buildCommunicationEffectiveScope({
    businessId: "64f000000000000000000001",
    locationId: "64f000000000000000000011",
    locationAccessMode: "selected",
    allowedLocationIds: [
      "64f000000000000000000011",
      "64f000000000000000000012",
    ],
  });

  assert.equal(selected.scopeMode, "selected-location");
  const filter = communicationAggregateAuthorityFilter(selected);
  assert.equal(filter.business, "64f000000000000000000001");
  assert.deepEqual(filter.$or[0], {
    location: {
      $in: ["64f000000000000000000011"],
    },
  });
});

test("client supplied communications ownership cannot grant authority", () => {
  const payload = sanitizeCommunicationPayload({
    business: "attacker-business",
    businessId: "attacker-business",
    location: "attacker-location",
    locationId: "attacker-location",
    tenant: "attacker-tenant",
    tenantId: "attacker-tenant",
    name: "Campaign",
    metadata: {
      business: "nested-attacker-business",
      locationId: "nested-attacker-location",
      safe: true,
    },
  });

  assert.equal(payload.business, undefined);
  assert.equal(payload.businessId, undefined);
  assert.equal(payload.location, undefined);
  assert.equal(payload.locationId, undefined);
  assert.equal(payload.tenant, undefined);
  assert.equal(payload.tenantId, undefined);
  assert.equal(payload.name, "Campaign");
  assert.deepEqual(payload.metadata, { safe: true });
});

test("communication reference scope rejects supplied malformed identifiers instead of treating them as absent", async () => {
  for (const body of [
    { campaignId: "not-an-object-id" },
    { templateId: "" },
    { customerId: null },
    { audience: { customerIds: ["64f000000000000000000021", "bad"] } },
    { audience: { excludedCustomerIds: "64f000000000000000000022" } },
  ]) {
    const error = await runReferenceScope(body);
    assert.equal(error?.code, "COMMUNICATION_RESOURCE_NOT_FOUND");
    assert.equal(error?.statusCode, 404);
  }
});

test("communication reference scope permits genuinely absent optional references without database lookups", async () => {
  const error = await runReferenceScope({ subject: "No optional references" });
  assert.equal(error, undefined);
});

test("interactive communication routes resolve trusted tenant and effective authority before canonical permissions", () => {
  for (const relativePath of [
    "src/routes/communicationCampaignRoutes.js",
    "src/routes/communicationTemplateRoutes.js",
    "src/routes/scheduledCommunicationRoutes.js",
    "src/routes/messageDeliveryRoutes.js",
  ]) {
    const text = source(relativePath);

    assert.match(text, /workforcePublicTenantContextMiddleware/);
    assert.match(text, /trustedTenantContextMiddleware/);
    assert.match(text, /effectiveAuthorityMiddleware/);
    assert.match(text, /communicationEffectiveScopeMiddleware/);
    assert.match(text, /communications:read/);
    assert.match(text, /communications:manage/);

    assert.equal(
      text.includes("communication:tenant:read"),
      false,
      `${relativePath} must not introduce a second communications RBAC namespace`
    );
  }
});

test("communication permissions execute before request-controlled resource resolution", () => {
  const campaigns = source("src/routes/communicationCampaignRoutes.js");
  assertPermissionBeforeResource(
    campaigns,
    "manageCommunications",
    "communicationReferenceScopeMiddleware",
    "/preview"
  );
  assertPermissionBeforeResource(
    campaigns,
    "manageCommunications",
    "scopedCampaignMutationResource",
    "/:campaignId/audience/preview"
  );
  assertPermissionBeforeResource(
    campaigns,
    "readCommunications",
    "scopedCampaignResource",
    "/:campaignId/recipients"
  );

  const templates = source("src/routes/communicationTemplateRoutes.js");
  assertPermissionBeforeResource(
    templates,
    "readCommunications",
    "scopedTemplateSlugResource",
    "/slug/:slug"
  );
  assertPermissionBeforeResource(
    templates,
    "manageCommunications",
    "scopedTemplateMutationResource",
    "/:templateId/status"
  );

  const scheduled = source("src/routes/scheduledCommunicationRoutes.js");
  assertPermissionBeforeResource(
    scheduled,
    "readCommunications",
    "scopedScheduledCommunicationResource",
    "/:campaignId"
  );
  assertPermissionBeforeResource(
    scheduled,
    "manageCommunications",
    "scopedScheduledCommunicationResource",
    "/:campaignId/reschedule"
  );

  const deliveries = source("src/routes/messageDeliveryRoutes.js");
  assertPermissionBeforeResource(
    deliveries,
    "manageCommunications",
    "communicationReferenceScopeMiddleware",
    "/send"
  );
  assertPermissionBeforeResource(
    deliveries,
    "readCommunications",
    "scopedDeliveryResource",
    "/deliveries/:identifier"
  );
});

test("communications collection reads and resource mutations are data scoped", () => {
  const campaigns = source("src/routes/communicationCampaignRoutes.js");
  assert.match(campaigns, /listScopedCampaigns/);
  assert.match(campaigns, /getScopedCampaignSummary/);
  assert.match(campaigns, /scopedCampaignResource/);
  assert.match(campaigns, /scopedCampaignMutationResource/);
  assert.match(campaigns, /communicationReferenceScopeMiddleware/);

  const templates = source("src/routes/communicationTemplateRoutes.js");
  assert.match(templates, /listScopedTemplates/);
  assert.match(templates, /getScopedTemplateSummary/);
  assert.match(templates, /scopedTemplateResource/);
  assert.match(templates, /scopedTemplateSlugResource/);

  const scheduled = source("src/routes/scheduledCommunicationRoutes.js");
  assert.match(scheduled, /listScopedScheduledCommunications/);
  assert.match(scheduled, /scopedScheduledCommunicationResource/);

  const deliveries = source("src/routes/messageDeliveryRoutes.js");
  assert.match(deliveries, /listScopedDeliveries/);
  assert.match(deliveries, /scopedDeliveryResource/);
  assert.match(deliveries, /scopedProviderDeliveryResource/);
  assert.match(deliveries, /communicationReferenceScopeMiddleware/);
});

test("Twilio provider callback remains signature protected and outside staff auth", () => {
  const text = source("src/routes/messageDeliveryRoutes.js");
  const webhookIndex = text.indexOf('"/webhooks/twilio/status"');
  const signatureIndex = text.indexOf("twilioWebhookProtection", webhookIndex);
  const staffAuthIndex = text.indexOf("router.use(\n  protect");

  assert.ok(webhookIndex >= 0);
  assert.ok(signatureIndex > webhookIndex);
  assert.ok(staffAuthIndex > signatureIndex);

  const webhookSlice = text.slice(webhookIndex, staffAuthIndex);
  assert.equal(webhookSlice.includes("effectiveAuthorityMiddleware"), false);
  assert.equal(webhookSlice.includes("trustedTenantContextMiddleware"), false);
});
