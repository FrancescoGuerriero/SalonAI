import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("8B campaign operational records require location ownership", async () => {
  const execution = await source("../features/campaigns/CampaignExecution.js");
  const publication = await source("../features/campaigns/SocialPublication.js");
  const attribution = await source("../features/campaigns/AttributionTouch.js");
  const locationState = await source("../features/campaigns/CampaignLocationState.js");

  for (const model of [execution, publication, attribution, locationState]) {
    assert.match(model, /location:[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/);
    assert.match(model, /business:\s*1,\s*location:\s*1/);
  }

  assert.match(execution, /business:\s*1,\s*location:\s*1,\s*idempotencyKey:\s*1/);
  assert.match(publication, /business:\s*1,\s*location:\s*1,\s*idempotencyKey:\s*1/);
  assert.match(attribution, /business:\s*1,\s*location:\s*1,\s*sourceKey:\s*1/);
  assert.match(locationState, /business:\s*1,\s*location:\s*1,\s*campaign:\s*1/);
});

test("8B campaign APIs derive location only from trusted authority", async () => {
  const controller = await source("../features/campaigns/campaignController.js");
  const growth = await source("../features/campaigns/growthCampaignService.js");
  const social = await source("../features/campaigns/socialPublishingService.js");

  assert.match(controller, /effectiveAuthority\?\.locationId/);
  assert.match(controller, /tenantContext\?\.locationId/);
  assert.match(controller, /LOCATION_REQUIRED/);
  assert.match(controller, /campaignAuthority\(req\)/);

  assert.match(growth, /locationAuthority\(businessId, locationId\)/);
  assert.match(growth, /location:\s*locationId/);
  assert.match(growth, /ATTRIBUTION_LOCATION_MISMATCH/);
  assert.match(growth, /Lead\.findOne\(\{[\s\S]*?\.\.\.authority/);
  assert.match(growth, /Opportunity\.findOne\(\{[\s\S]*?\.\.\.authority/);

  assert.match(social, /locationAuthority\(businessId, locationId\)/);
  assert.match(social, /business:\s*businessId,\s*location:\s*locationId/);
  assert.match(social, /createCampaignExecution\([\s\S]*?\{ businessId, locationId, actorUser \}/);
});

test("8B master campaign definition is separated from per-location delivery state", async () => {
  const service = await source("../features/campaigns/campaignService.js");
  const state = await source("../features/campaigns/CampaignLocationState.js");

  assert.match(service, /CampaignLocationState/);
  assert.match(service, /ScheduledCommunication\.deleteMany\(\{[\s\S]*?location:\s*tenantLocationId/);
  assert.match(service, /CampaignLocationState\.findOneAndUpdate/);
  assert.match(service, /status:\s*"scheduled"/);
  assert.match(service, /status:\s*"cancelled"/);
  assert.doesNotMatch(service, /campaign\.status\s*=\s*"scheduled"/);
  assert.doesNotMatch(service, /campaign\.status\s*=\s*"cancelled"/);
  assert.match(state, /unique:\s*true/);
});

test("8B performance blends only records from the selected location", async () => {
  const performance = await source("../features/campaigns/campaignPerformanceService.js");

  assert.match(performance, /locationAuthority\(businessId, locationId\)/);
  assert.match(performance, /CampaignExecution\.find\(\{[\s\S]*?location:\s*locationId/);
  assert.match(performance, /AttributionTouch\.find\(\{[\s\S]*?location:\s*locationId/);
  assert.match(performance, /MarketingNormalisedRecord\.find\(match\)/);
  assert.match(performance, /business:\s*businessId,\s*location:\s*locationId/);
  assert.match(performance, /locationOwnershipRequired:\s*true/);
});

test("8B reputation hub requires location ownership end to end", async () => {
  const review = await source("../features/reputation/ExternalReview.js");
  const listing = await source("../features/reputation/BusinessListingSnapshot.js");
  const hub = await source("../features/reputation/reputationHubService.js");
  const customerExperience = await source("../features/customerExperience/stage4CustomerExperienceService.js");

  assert.match(review, /location:[\s\S]*?required:\s*true/);
  assert.match(listing, /location:[\s\S]*?required:\s*true/);
  assert.match(review, /business:\s*1,\s*location:\s*1,\s*provider:\s*1,\s*externalReviewId:\s*1/);

  assert.match(hub, /const location = objectId\(locationId, "location"\)/);
  assert.match(hub, /const match = \{ business, location \}/);
  assert.match(hub, /const listingMatch = \{ business, location \}/);
  assert.match(hub, /business,[\s\S]*?location,[\s\S]*?provider/);

  assert.match(customerExperience, /function activeLocationId/);
  assert.match(customerExperience, /reputationAuthority/);
  assert.match(customerExperience, /Appointment\.find\(\{ business, location \}\)/);
  assert.match(customerExperience, /Review not found in the selected location/);
});

test("8B background social execution fails closed without location", async () => {
  const worker = await source("../services/socialPublishingWorkerService.js");

  assert.match(worker, /SOCIAL_PUBLICATION_LOCATION_REQUIRED/);
  assert.match(worker, /locationId:\s*publication\.location/);
  assert.match(worker, /cannot be executed automatically/);
});
