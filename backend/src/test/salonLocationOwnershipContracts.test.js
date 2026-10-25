import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("CRM Lead and Opportunity records require Location ownership", async () => {
  const [leadModel, opportunityModel] = await Promise.all([
    source("../models/Lead.js"),
    source("../models/Opportunity.js"),
  ]);

  for (const model of [leadModel, opportunityModel]) {
    assert.match(
      model,
      /location:\s*\{[\s\S]*?ref:\s*"Location"[\s\S]*?required:\s*true/
    );
  }
  assert.match(leadModel, /business:\s*1,\s*location:\s*1,\s*status:\s*1/);
  assert.match(leadModel, /business:\s*1,\s*location:\s*1,\s*idempotencyKey:\s*1/);
  assert.match(opportunityModel, /business:\s*1,\s*location:\s*1,\s*lead:\s*1/);
});

test("CRM route resolves trusted effective authority before lead operations", async () => {
  const routes = await source("../features/leads/leadRoutes.js");
  const controller = await source("../features/leads/leadController.js");

  assert.match(routes, /effectiveAuthorityMiddleware/);
  assert.match(routes, /router\.use\(effectiveAuthorityMiddleware\)/);
  assert.match(controller, /effectiveAuthority\?\.locationId/);
  assert.match(controller, /LOCATION_REQUIRED/);
  assert.match(controller, /locationOwnedLeadService/);
});

test("CRM location service enforces location-specific capture, list and mutation authority", async () => {
  const service = await source("../features/leads/locationOwnedLeadService.js");

  assert.match(service, /Lead\.findOne\(\{ _id: leadId, \.\.\.locationScope \}\)/);
  assert.match(service, /Opportunity\.findOne\(\{[\s\S]*\.\.\.locationScope/);
  assert.match(service, /const match = scope\(\{ businessId, locationId \}\)/);
  assert.match(service, /scopedIdempotencyKey/);
  assert.match(service, /location:\s*locationId/);
  assert.match(service, /OPPORTUNITY_LOCATION_IMMUTABLE/);
});

test("Service availability remains a reusable definition plus location-owned offering", async () => {
  const [serviceModel, offeringModel, resolver] = await Promise.all([
    source("../models/service.js"),
    source("../models/LocationServiceOffering.js"),
    source("../platform/services/effectiveServiceConfiguration.js"),
  ]);

  assert.match(serviceModel, /ref:\s*"Business"/);
  assert.match(offeringModel, /location:[\s\S]*ref:[\s\S]*"Location"[\s\S]*required:[\s\S]*true/);
  assert.match(offeringModel, /business:[\s\S]*location:[\s\S]*service:/);
  assert.match(resolver, /validateOfferingOwnership/);
  assert.match(resolver, /offeringLocationId !==[\s\S]*trustedLocationId/);
  assert.match(resolver, /"location-offering"/);
});

test("Staff identity remains singular while working-location assignments constrain operations", async () => {
  const [stylist, authority] = await Promise.all([
    source("../models/Stylist.js"),
    source("../services/workforceAuthorityService.js"),
  ]);

  assert.match(stylist, /workingLocations/);
  assert.match(stylist, /ref:\s*"Location"/);
  assert.match(authority, /workingLocations/);
});
