import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Stage 4 Content Studio supports governed versioned publication", () => {
  const model = source("../features/content/ContentPage.js");
  const service = source("../features/content/contentService.js");
  const routes = source("../features/content/contentRoutes.js");

  assert.match(model, /currentVersion/);
  assert.match(model, /versions/);
  assert.match(model, /publishedVersion/);
  assert.match(model, /publishedSnapshot/);
  assert.match(model, /hasUnpublishedChanges/);
  assert.match(model, /defaultLocale/);
  assert.match(model, /seoDescription/);
  assert.match(model, /variants/);
  assert.match(service, /Image blocks require a URL and meaningful alternative text/);
  assert.match(service, /page\.publishedSnapshot = snapshot\(page\)/);
  assert.match(service, /"publishedSnapshot\.slug"/);
  assert.match(service, /page\.hasUnpublishedChanges = true/);
  assert.match(service, /page\.hasUnpublishedChanges = false/);
  assert.match(service, /publishContentPage/);
  assert.match(service, /previewContentPage/);
  assert.match(routes, /customer-experience:manage/);
  assert.match(routes, /\/pages\/:slug/);
});

test("Stage 4 check-in reuses canonical appointment status authority", () => {
  const service = source("../features/customerExperience/stage4CustomerExperienceService.js");
  assert.match(service, /changeAppointmentStatus/);
  assert.match(service, /"checked_in"/);
  assert.doesNotMatch(service, /appointment\.status\s*=\s*["']checked_in["']/);
  assert.doesNotMatch(service, /Appointment\.findByIdAndUpdate/);
});

test("Stage 4 abandonment measurement covers end-to-end recovery states", () => {
  const service = source("../features/customerExperience/stage4CustomerExperienceService.js");
  assert.match(service, /bookingRecoveryMetrics/);
  assert.match(service, /resumeRate/);
  assert.match(service, /conversionRate/);
  assert.match(service, /counts\.converted/);
});

test("Stage 4 reputation responses are human-governed", () => {
  const model = source("../features/reputation/ReputationResponse.js");
  const service = source("../features/customerExperience/stage4CustomerExperienceService.js");
  assert.match(model, /responseStatus/);
  assert.match(model, /moderatedBy/);
  assert.match(model, /respondedBy/);
  assert.match(service, /A business response can be published only for a published review/);
  assert.doesNotMatch(service, /openai|generateResponse|sentimentModel/i);
});

test("Stage 4 household relationships fail closed on private-data sharing", () => {
  const model = source("../features/customerRelationships/CustomerRelationship.js");
  const service = source("../features/customerRelationships/customerRelationshipService.js");
  assert.match(model, /appointments:\s*\{ type: Boolean, default: false \}/);
  assert.match(model, /loyalty:\s*\{ type: Boolean, default: false \}/);
  assert.match(model, /wallet:\s*\{ type: Boolean, default: false \}/);
  assert.match(service, /sharing: \{ appointments: false, loyalty: false, wallet: false, communications: false \}/);
  assert.match(service, /same business context/);
});

test("Stage 4 customer-experience router consolidates new domains", () => {
  const routes = source("../features/customerExperience/customerExperienceRoutes.js");
  assert.match(routes, /router\.use\("\/content", contentRoutes\)/);
  assert.match(routes, /router\.use\("\/relationships", customerRelationshipRoutes\)/);
  assert.match(routes, /\/me\/check-in/);
  assert.match(routes, /\/management\/reputation/);
  assert.match(routes, /\/management\/booking-recovery-metrics/);
});
