import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import BacklinkObservation from "../models/MarketingBacklinkObservation.js";
import EditorialPlacement from "../models/MarketingEditorialPlacement.js";

const id = () => new mongoose.Types.ObjectId();

test("backlink observation requires location and evidence provenance", () => {
  const observation = new BacklinkObservation({
    business: id(),
    sourceUrl: "https://publisher.example.com/editorial",
    targetUrl: "https://salon.example.com/services",
    sourceHost: "publisher.example.com",
    observedAt: new Date(),
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
  const errors = observation.validateSync()?.errors ?? {};
  assert.ok(errors.location);
  assert.ok(errors.discoveryMethod);
  assert.equal(observation.status, "observed");
  assert.equal(observation.verificationMethod, "none");
});

test("backlink record accepts scoped provider evidence but rejects unsupported status", () => {
  const observation = new BacklinkObservation({
    business: id(),
    location: id(),
    sourceUrl: "https://publisher.example.com/story",
    targetUrl: "https://salon.example.com/",
    sourceHost: "publisher.example.com",
    discoveryMethod: "provider_import",
    observedAt: new Date(),
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    status: "guaranteed_rank_boost",
  });
  assert.ok(observation.validateSync()?.errors.status);
  observation.status = "verified";
  assert.equal(observation.validateSync(), undefined);
});

test("editorial placements are tenant/location-owned and approval-gated by default", () => {
  const placement = new EditorialPlacement({
    business: id(),
    publisherName: "Example Editorial",
    publisherWebsite: "https://publisher.example.com",
    workingTitle: "Local business research",
  });
  assert.ok(placement.validateSync()?.errors.location);
  assert.equal(placement.status, "prospect");
  assert.equal(placement.submissionMode, "none");
  assert.equal(placement.rightsConfirmed, false);
  assert.equal(placement.approvedBy, null);
});

test("editorial placement links existing ContentPage without creating a second article store", () => {
  const pageId = id();
  const placement = new EditorialPlacement({
    business: id(),
    location: id(),
    contentPage: pageId,
    publisherName: "Example Editorial",
    publisherWebsite: "https://publisher.example.com",
    workingTitle: "Research brief",
  });
  assert.equal(placement.validateSync(), undefined);
  assert.equal(String(placement.contentPage), String(pageId));
});

test("editorial transition evidence is typed and requires a named actor", () => {
  const record = new EditorialPlacement({
    business: id(),
    location: id(),
    workingTitle: "Editorial test",
    publisherName: "Example",
    publisherWebsite: "https://example.com",
    transitionHistory: [{
      fromStatus: "review",
      toStatus: "approved",
      confirmation: "rights_review",
      recordedAt: new Date(),
    }],
  });
  assert.ok(record.validateSync()?.errors["transitionHistory.0.actor"]);
  record.transitionHistory[0].actor = id();
  assert.equal(record.validateSync(), undefined);
  record.transitionHistory.push({
    fromStatus: "approved",
    toStatus: "submitted",
    actor: id(),
    confirmation: "unapproved_automatic_submission",
  });
  assert.ok(record.validateSync()?.errors["transitionHistory.1.confirmation"]);
});
