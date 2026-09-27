import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  buildServiceCatalogueReadiness,
} from "../platform/tenancy/serviceCatalogueMigration.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

test("single canonical Business can plan legacy unowned Service ownership", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            oid(),
        },
        {
          _id:
            oid(),
          business:
            businessId,
        },
      ],
      offerings: [],
    });

  assert.equal(
    readiness.safeForBusinessBackfill,
    true
  );
  assert.equal(
    readiness.summary.services,
    2
  );
  assert.equal(
    readiness.summary.businessAssignments,
    1
  );
  assert.equal(
    readiness.summary.alreadyBusinessOwned,
    1
  );
});

test("second Business blocks global unowned Service assignment", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
        {
          _id:
            oid(),
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            oid(),
        },
      ],
    });

  assert.equal(
    readiness.safeForBusinessBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "global-unowned-service-scope-not-single-tenant"
    )
  );
});

test("Service already owned by another Business blocks readiness", () => {
  const businessId =
    oid();
  const locationId =
    oid();

  const readiness =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            oid(),
          business:
            oid(),
        },
      ],
    });

  assert.equal(
    readiness.safeForBusinessBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "service-owned-by-other-business"
    )
  );
});

test("offering must reference same-Business Location and Service", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();

  const readiness =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            serviceId,
          business:
            businessId,
        },
      ],
      offerings: [
        {
          _id:
            oid(),
          business:
            businessId,
          location:
            locationId,
          service:
            serviceId,
        },
      ],
    });

  assert.equal(
    readiness.safeForBusinessBackfill,
    true
  );
  assert.equal(
    readiness.summary.offerings,
    1
  );

  const broken =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            serviceId,
          business:
            businessId,
        },
      ],
      offerings: [
        {
          _id:
            oid(),
          business:
            oid(),
          location:
            locationId,
          service:
            serviceId,
        },
      ],
    });

  assert.equal(
    broken.safeForBusinessBackfill,
    false
  );
  assert.ok(
    broken.blockers.some(
      (item) =>
        item.blocker ===
        "offering-owned-by-other-business"
    )
  );
});

test("duplicate Business/Location/Service offering tuples block readiness", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();

  const offering = {
    business:
      businessId,
    location:
      locationId,
    service:
      serviceId,
  };

  const readiness =
    buildServiceCatalogueReadiness({
      businessId,
      primaryLocationId:
        locationId,
      businesses: [
        {
          _id:
            businessId,
        },
      ],
      locations: [
        {
          _id:
            locationId,
          business:
            businessId,
        },
      ],
      services: [
        {
          _id:
            serviceId,
          business:
            businessId,
        },
      ],
      offerings: [
        {
          _id:
            oid(),
          ...offering,
        },
        {
          _id:
            oid(),
          ...offering,
        },
      ],
    });

  assert.equal(
    readiness.safeForBusinessBackfill,
    false
  );
  assert.ok(
    readiness.blockers.some(
      (item) =>
        item.blocker ===
        "duplicate-business-location-service-offering"
    )
  );
});
