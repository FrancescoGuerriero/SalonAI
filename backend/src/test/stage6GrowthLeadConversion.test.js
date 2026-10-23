import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GROWTH_METRIC_KEYS,
  getMetricDefinition,
} from "../features/analytics/metricCatalogue.js";
import {
  domainEventDefinition,
} from "../features/integrationPlatform/domainEventCatalogue.js";
import {
  GOOGLE_BUSINESS_PROFILE_ENDPOINTS,
} from "../features/integrationPlatform/googleBusinessProfileService.js";
import {
  growthChannelCatalogue,
} from "../features/integrationPlatform/growthChannelCatalogue.js";
import {
  normaliseLeadAcquisitionPayload,
} from "../features/leads/leadSourceMappingService.js";

const source = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("Stage 6 source mapping normalises Google, Meta and UTM acquisition evidence", () => {
  const google = normaliseLeadAcquisitionPayload({
    email: "prospect@example.com",
    gclid: "gclid-123",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "spring-colour",
    utm_term: "balayage london",
    landingPage: "https://example.test/book",
  });
  assert.equal(google.source.channel, "google");
  assert.equal(google.source.system, "google_ads");
  assert.equal(google.source.medium, "cpc");
  assert.equal(google.source.campaign, "spring-colour");
  assert.equal(google.metadata.acquisition.googleClickId, "gclid-123");
  assert.equal(google.metadata.acquisition.term, "balayage london");

  const meta = normaliseLeadAcquisitionPayload({
    fbclid: "fb-click-1",
    utm_source: "instagram",
    utm_medium: "paid_social",
  });
  assert.equal(meta.source.channel, "social");
  assert.equal(meta.source.system, "meta_ads");
  assert.equal(meta.metadata.acquisition.metaClickId, "fb-click-1");
});

test("Stage 6 booking attribution event is registered in the versioned event catalogue", () => {
  assert.deepEqual(domainEventDefinition("lead.booking_attributed", "1"), {
    type: "lead.booking_attributed",
    version: "1",
  });
});

test("Stage 6 canonical metrics span lead to customer, booking and payment revenue", () => {
  assert.deepEqual(GROWTH_METRIC_KEYS, [
    "lead-to-customer-conversion-rate",
    "lead-to-booking-conversion-rate",
    "booking-to-payment-conversion-rate",
    "attributed-net-revenue",
  ]);
  for (const key of GROWTH_METRIC_KEYS) {
    const definition = getMetricDefinition(key);
    assert.equal(definition.version, "2.2.0");
    assert.equal(definition.domain, "growth");
    assert.ok(definition.formula);
  }
  assert.match(getMetricDefinition("attributed-net-revenue").evidence.sourceModel, /Payment/);
});

test("Lead to Customer conversion remains duplicate-safe and tenant fail-closed", async () => {
  const leadService = await source("../features/leads/leadService.js");
  assert.match(leadService, /CUSTOMER_IDENTITY_CONFLICT/);
  assert.match(leadService, /CUSTOMER_BUSINESS_UNRESOLVED/);
  assert.match(leadService, /CUSTOMER_TENANT_CONFLICT/);
  assert.match(leadService, /existingCustomers\.length > 1/);
  assert.match(leadService, /session\.withTransaction/);
  assert.match(leadService, /lead\.customer = customer\._id/);
});

test("Stage 6 attribution is immutable and refuses customer or tenant mismatches", async () => {
  const [model, service] = await Promise.all([
    source("../models/GrowthAttribution.js"),
    source("../features/leads/growthAttributionService.js"),
  ]);
  assert.match(model, /Growth attribution records are immutable evidence/);
  assert.match(model, /business: 1, appointment: 1/);
  assert.match(service, /LEAD_APPOINTMENT_CUSTOMER_MISMATCH/);
  assert.match(service, /LEAD_APPOINTMENT_TENANT_MISMATCH/);
  assert.match(service, /BOOKING_ATTRIBUTION_CONFLICT/);
  assert.match(service, /Payment\.find\(\{ appointment: \{ \$in: appointmentIds \} \}\)/);
  assert.match(service, /refundedAmount/);
  assert.match(service, /lead\.booking_attributed/);
});

test("Stage 6 nurture remains a primitive over the existing Lead authority", async () => {
  const [leadModel, leadService, routes] = await Promise.all([
    source("../models/Lead.js"),
    source("../features/leads/leadService.js"),
    source("../features/leads/leadRoutes.js"),
  ]);
  assert.match(leadModel, /workflowKey/);
  assert.match(leadModel, /nextActionAt/);
  assert.match(leadService, /setLeadNurture/);
  assert.match(leadService, /nurture_enrolled|nurture_updated/);
  assert.match(routes, /\/\:leadId\/nurture/);
  assert.match(routes, /communications:manage/);
});

test("Growth channel catalogue keeps provider writes human or explicitly activated", () => {
  const catalogue = growthChannelCatalogue();
  assert.equal(catalogue.version, "1.0.0");
  const google = catalogue.connectors.find((item) => item.key === "google_business_profile");
  const meta = catalogue.connectors.find((item) => item.key === "meta_social_leads");
  const ads = catalogue.connectors.find((item) => item.key === "google_ads_attribution");
  assert.equal(google.writeControls.reviewReplyRequiresHumanApproval, true);
  assert.equal(google.writeControls.automaticReviewReply, false);
  assert.equal(meta.writeControls.automaticOutboundWrite, false);
  assert.equal(ads.writeControls.conversionUploadRequiresExplicitActivation, true);
});

test("Google Business Profile review integration uses the documented fixed service endpoint and approval gate", async () => {
  assert.equal(GOOGLE_BUSINESS_PROFILE_ENDPOINTS.reviews, "https://mybusiness.googleapis.com/v4");
  assert.equal(GOOGLE_BUSINESS_PROFILE_ENDPOINTS.oauthToken, "https://oauth2.googleapis.com/token");
  const [googleService, responseModel] = await Promise.all([
    source("../features/integrationPlatform/googleBusinessProfileService.js"),
    source("../features/integrationPlatform/ExternalReputationResponse.js"),
  ]);
  assert.match(googleService, /method: "PUT"/);
  assert.match(googleService, /\/reply/);
  assert.match(googleService, /response\.status !== "approved"/);
  assert.match(responseModel, /explicit human approval/);
  assert.match(responseModel, /publishedBy/);
});

test("Stage 6 API and workspace expose attribution without creating parallel booking or payment engines", async () => {
  const [leadRoutes, integrationRoutes, workspace, navigation] = await Promise.all([
    source("../features/leads/leadRoutes.js"),
    source("../features/integrationPlatform/integrationPlatformRoutes.js"),
    source("../../frontend/src/pages/GrowthLeadConversionPage.jsx"),
    source("../../frontend/src/components/navigation/managementNavigationConfig.js"),
  ]);
  assert.match(leadRoutes, /\/attribution\/summary/);
  assert.match(leadRoutes, /\/attribution\/appointments\/\:appointmentId/);
  assert.match(integrationRoutes, /\/growth-channels/);
  assert.match(workspace, /Lead acquisition →|lead → booking → payment|lead-to-booking-to-payment/i);
  assert.match(navigation, /\/growth\/leads/);
});
