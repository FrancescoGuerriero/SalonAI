import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Backlink from "../models/MarketingBacklinkObservation.js";
import Placement from "../models/MarketingEditorialPlacement.js";
import {
  canAdvanceEditorial,
  marketingScope,
  monthBounds,
  isPublishedOnPublisherDomain,
  recordManualBacklink,
  listBacklinkObservations,
  listEditorialPlacements,
} from "../features/marketing/marketingEditorialService.js";

test("marketing operations refuse missing or untrusted location scope", () => {
  assert.throws(() => marketingScope({ businessId: new mongoose.Types.ObjectId() }), /selected location/);
  assert.throws(() => marketingScope({ businessId: "not-an-id", locationId: "not-an-id" }), /Invalid business/);
  const businessId = new mongoose.Types.ObjectId();
  const locationId = new mongoose.Types.ObjectId();
  assert.deepEqual(marketingScope({ businessId, locationId }), {
    business: String(businessId),
    location: String(locationId),
  });
});

test("editorial transition graph blocks skipped approvals and external publication bypass", () => {
  assert.equal(canAdvanceEditorial("prospect", "published", {}), false);
  assert.equal(canAdvanceEditorial("draft", "submitted", {}), false);
  assert.equal(canAdvanceEditorial("review", "approved", { rightsConfirmed: false, originalityReviewed: true }), false);
  assert.equal(canAdvanceEditorial("review", "approved", { rightsConfirmed: true, originalityReviewed: true }), true);
  assert.equal(canAdvanceEditorial("approved", "submitted", {}), false);
  assert.equal(canAdvanceEditorial("approved", "submitted", { approvedBy: "user", approvedAt: new Date() }), true);
  assert.equal(canAdvanceEditorial("accepted", "published", { publishedUrl: "" }), false);
  assert.equal(canAdvanceEditorial("accepted", "published", { publishedUrl: "https://example.com/article", publishedAt: new Date() }), true);
  assert.equal(canAdvanceEditorial("withdrawn", "draft", {}), false);
});

test("monthly boundaries use UTC start inclusive and next month exclusive", () => {
  assert.deepEqual(monthBounds("2026-12"), {
    start: new Date("2026-12-01T00:00:00.000Z"),
    end: new Date("2027-01-01T00:00:00.000Z"),
  });
  assert.throws(() => monthBounds("2026-13"), /YYYY-MM/);
  assert.throws(() => monthBounds("1999-01"), /out of range/);
});

test("internal hyperlinks are not reported as external backlinks", async () => {
  const scope = { businessId: new mongoose.Types.ObjectId(), locationId: new mongoose.Types.ObjectId() };
  await assert.rejects(
    recordManualBacklink({
      sourceUrl: "https://salon.example.com/article",
      targetUrl: "https://salon.example.com/services",
    }, scope, new mongoose.Types.ObjectId()),
    /Internal links must not be recorded/
  );
});

test("manual backlink creation rejects non-HTTPS and credential-bearing URLs before persistence", async () => {
  const scope = { businessId: new mongoose.Types.ObjectId(), locationId: new mongoose.Types.ObjectId() };
  await assert.rejects(
    recordManualBacklink({ sourceUrl: "http://other.example/story", targetUrl: "https://salon.example.com" }, scope),
    /HTTPS URL/
  );
  await assert.rejects(
    recordManualBacklink({ sourceUrl: "https://user:pass@other.example/story", targetUrl: "https://salon.example.com" }, scope),
    /without credentials/
  );
});

test("published article evidence must belong to the recorded publisher domain", () => {
  assert.equal(isPublishedOnPublisherDomain("https://publisher.example", "https://publisher.example/article"), true);
  assert.equal(isPublishedOnPublisherDomain("https://www.publisher.example", "https://blog.publisher.example/article"), true);
  assert.equal(isPublishedOnPublisherDomain("https://publisher.example", "https://publisher.example.attacker.invalid/article"), false);
  assert.equal(isPublishedOnPublisherDomain("https://publisher.example", "https://other.example/article"), false);
});

test("editorial and backlink reads always apply business and location predicates", async () => {
  const scope = { businessId: new mongoose.Types.ObjectId(), locationId: new mongoose.Types.ObjectId() };
  const captured = [];
  const originalPlacementsFind = Placement.find;
  const originalBacklinksFind = Backlink.find;
  const fakeQuery = () => ({
    sort() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve([]); },
  });
  try {
    Placement.find = function(filter) { captured.push({ model: "editorial", filter }); return fakeQuery(); };
    Backlink.find = function(filter) { captured.push({ model: "backlink", filter }); return fakeQuery(); };
    await listEditorialPlacements(scope);
    await listBacklinkObservations(scope);
    assert.equal(captured.length, 2);
    for (const item of captured) {
      assert.equal(item.filter.business, String(scope.businessId));
      assert.equal(item.filter.location, String(scope.locationId));
    }
  } finally {
    Placement.find = originalPlacementsFind;
    Backlink.find = originalBacklinksFind;
  }
});
