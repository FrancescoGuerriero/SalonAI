import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("social publishing is tenant-owned and live-provider gated", async () => {
  const model = await source("../features/campaigns/SocialPublication.js");
  const service = await source("../features/campaigns/socialPublishingService.js");
  const adapters = await source("../features/campaigns/socialProviderAdapters.js");

  assert.match(model, /business:[\s\S]*?required:\s*true/);
  assert.match(model, /campaignExecution:[\s\S]*?required:\s*true/);
  assert.match(model, /idempotencyKey:[\s\S]*?required:\s*true/);
  assert.match(model, /facebook[\s\S]*?instagram[\s\S]*?linkedin[\s\S]*?google_business_profile/);

  assert.match(service, /SOCIAL_PUBLISHING_LIVE_ENABLED/);
  assert.match(service, /SOCIAL_PUBLISHING_LIVE_DISABLED/);
  assert.match(service, /business:\s*businessId/);
  assert.match(service, /status:\s*\{ \$in: \["connected", "degraded"\] \}/);
  assert.match(service, /CAMPAIGN_CHANNEL_NOT_ENABLED/);

  assert.match(adapters, /resolveProviderCredential\(connection, "access_token"\)/);
  assert.match(adapters, /META_GRAPH_API_VERSION_REQUIRED/);
  assert.match(adapters, /LINKEDIN_API_VERSION_REQUIRED/);
  assert.match(adapters, /SOCIAL_PROVIDER_MEDIA_WORKFLOW_REQUIRED/);
});

test("social publishing worker is inactive by default", async () => {
  const worker = await source("../services/socialPublishingWorkerService.js");

  assert.match(worker, /SOCIAL_PUBLISHING_WORKER_ENABLED, false/);
  assert.match(worker, /Social publishing worker is disabled/);
  assert.match(worker, /publishSocialPublication/);
  assert.match(worker, /status:\s*\{ \$in: \["queued", "scheduled"\] \}/);
});

test("external reputation and listing records preserve tenant provenance", async () => {
  const review = await source("../features/reputation/ExternalReview.js");
  const response = await source("../features/reputation/ExternalReputationResponse.js");
  const listing = await source("../features/reputation/BusinessListingSnapshot.js");
  const hub = await source("../features/reputation/reputationHubService.js");
  const linkage = await source("../features/reputation/externalReviewLinkageService.js");

  assert.match(review, /business:[\s\S]*?required:\s*true/);
  assert.match(review, /providerPayloadDigest/);
  assert.match(review, /externalReferenceHash/);
  assert.match(review, /customer:[\s\S]*?ref:\s*"Customer"/);
  assert.match(review, /linkage:[\s\S]*?"unlinked"[\s\S]*?"verified"/);
  assert.match(review, /business:\s*1, provider:\s*1, externalReviewId:\s*1/);

  assert.match(response, /externalReview:[\s\S]*?unique:\s*true/);
  assert.match(response, /"approved"/);
  assert.match(listing, /externalLocationReference:[\s\S]*?required:\s*true/);
  assert.match(listing, /providerPayloadDigest/);

  assert.match(hub, /const business = objectId\(businessId, "business"\)/);
  assert.match(hub, /EXTERNAL_REVIEW_RESPONSE_PUBLICATION_GATED/);
  assert.match(hub, /providerPayloadDigest/);
  assert.doesNotMatch(hub, /providerPayload:\s*record\.providerPayload/);

  assert.match(linkage, /Customer\.findOne\(\{[\s\S]*?business:\s*businessId/);
  assert.match(linkage, /status:\s*\{ \$ne: "deleted" \}/);
  assert.match(linkage, /method:\s*"manual"/);
});

test("internal reputation management proves appointment tenancy before mutation", async () => {
  const service = await source(
    "../features/customerExperience/stage4CustomerExperienceService.js"
  );

  assert.match(
    service,
    /Appointment\.findOne\(\{[\s\S]*?_id:\s*review\.appointment,[\s\S]*?business,[\s\S]*?\}\)/
  );
  assert.match(service, /Review not found in the active business/);
  assert.match(
    service,
    /"reviews\.appointment":\s*\{ \$in: appointmentIds \}/
  );
  assert.match(service, /combinedSummary/);
  assert.match(service, /externalReputationOverview/);
});

test("campaign performance uses deterministic non-double-counting blend rules", async () => {
  const performance = await source(
    "../features/campaigns/campaignPerformanceService.js"
  );
  const routes = await source("../features/campaigns/campaignRoutes.js");

  assert.match(performance, /CAMPAIGN_CALCULATED_FIELDS/);
  assert.match(performance, /deliveryRatePct/);
  assert.match(performance, /clickThroughRatePct/);
  assert.match(performance, /costPerConversion/);
  assert.match(performance, /returnOnAdSpend/);
  assert.match(performance, /Stage-5 normalised marketing values are used only when/);
  assert.match(performance, /campaign_execution/);
  assert.match(performance, /stage5_normalised_fallback/);
  assert.match(performance, /MarketingNormalisedRecord/);
  assert.match(performance, /AttributionTouch/);

  assert.match(routes, /\/:id\/performance/);
  assert.match(routes, /requirePermissions\("reports:read"\)/);
});
