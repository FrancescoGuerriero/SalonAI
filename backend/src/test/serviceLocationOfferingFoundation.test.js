import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Service from "../models/service.js";
import LocationServiceOffering from "../models/LocationServiceOffering.js";
import {
  resolveEffectiveServiceConfiguration,
} from "../platform/services/effectiveServiceConfiguration.js";

function oid() {
  return new mongoose.Types.ObjectId();
}

function baseService({
  businessId,
  serviceId =
    oid(),
  overrides = {},
} = {}) {
  return {
    _id:
      serviceId,
    business:
      businessId,
    name:
      "Cut & Finish",
    category:
      "Hair",
    description:
      "",
    price:
      70,
    priceLabel:
      "From",
    priceOnConsultation:
      false,
    duration:
      60,
    durationEstimated:
      false,
    active:
      true,
    published:
      true,
    bookable:
      true,
    ...overrides,
  };
}

test("Service Business ownership remains additive during migration", () => {
  assert.equal(
    Service.schema.path(
      "business"
    ).options.required,
    undefined
  );

  const service =
    new Service({
      name:
        "Legacy service",
      category:
        "Hair",
      price:
        50,
      duration:
        45,
    });

  assert.equal(
    service.validateSync(),
    undefined
  );
});

test("LocationServiceOffering requires Business, Location and Service ownership and enforces one offering per tuple", () => {
  assert.equal(
    LocationServiceOffering.schema.path(
      "business"
    ).options.required,
    true
  );
  assert.equal(
    LocationServiceOffering.schema.path(
      "location"
    ).options.required,
    true
  );
  assert.equal(
    LocationServiceOffering.schema.path(
      "service"
    ).options.required,
    true
  );

  const tupleIndex =
    LocationServiceOffering.schema
      .indexes()
      .find(
        ([fields]) =>
          fields.business ===
            1 &&
          fields.location ===
            1 &&
          fields.service ===
            1
      );

  assert.ok(
    tupleIndex
  );
  assert.equal(
    tupleIndex[1].unique,
    true
  );
});

test("base Service values remain effective when no Location override exists", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const service =
    baseService({
      businessId,
    });

  const resolved =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
    });

  assert.equal(
    resolved.available,
    true
  );
  assert.equal(
    resolved.price,
    70
  );
  assert.equal(
    resolved.duration,
    60
  );
  assert.equal(
    resolved.bookable,
    true
  );
  assert.equal(
    resolved.published,
    true
  );
  assert.equal(
    resolved.provenance.price,
    "base-service"
  );
});

test("permitted Location offering overrides win with field-level provenance", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();
  const service =
    baseService({
      businessId,
      serviceId,
    });

  const resolved =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
      offering: {
        business:
          businessId,
        location:
          locationId,
        service:
          serviceId,
        status:
          "active",
        available:
          true,
        priceOverride:
          82,
        durationOverride:
          75,
        bookableOverride:
          false,
        priceLabelOverride:
          "Senior stylist",
      },
    });

  assert.equal(
    resolved.price,
    82
  );
  assert.equal(
    resolved.duration,
    75
  );
  assert.equal(
    resolved.bookable,
    false
  );
  assert.equal(
    resolved.priceLabel,
    "Senior stylist"
  );
  assert.equal(
    resolved.provenance.price,
    "location-offering"
  );
  assert.equal(
    resolved.provenance.duration,
    "location-offering"
  );
  assert.equal(
    resolved.provenance.bookable,
    "location-offering"
  );
});

test("same Service can resolve independently for two Locations without duplicating the Service", () => {
  const businessId =
    oid();
  const serviceId =
    oid();
  const locationA =
    oid();
  const locationB =
    oid();
  const service =
    baseService({
      businessId,
      serviceId,
    });

  const first =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId:
        locationA,
      offering: {
        business:
          businessId,
        location:
          locationA,
        service:
          serviceId,
        status:
          "active",
        priceOverride:
          75,
      },
    });

  const second =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId:
        locationB,
      offering: {
        business:
          businessId,
        location:
          locationB,
        service:
          serviceId,
        status:
          "active",
        priceOverride:
          95,
      },
    });

  assert.equal(
    first.serviceId,
    second.serviceId
  );
  assert.equal(
    first.price,
    75
  );
  assert.equal(
    second.price,
    95
  );
});

test("cross-Business Service or offering ownership fails closed with 404 semantics", () => {
  const businessId =
    oid();
  const otherBusinessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();

  assert.throws(
    () =>
      resolveEffectiveServiceConfiguration({
        service:
          baseService({
            businessId:
              otherBusinessId,
            serviceId,
          }),
        businessId,
        locationId,
      }),
    (error) =>
      error.code ===
        "SERVICE_NOT_FOUND" &&
      error.statusCode ===
        404
  );

  assert.throws(
    () =>
      resolveEffectiveServiceConfiguration({
        service:
          baseService({
            businessId,
            serviceId,
          }),
        businessId,
        locationId,
        offering: {
          business:
            otherBusinessId,
          location:
            locationId,
          service:
            serviceId,
          status:
            "active",
        },
      }),
    (error) =>
      error.code ===
        "SERVICE_OFFERING_NOT_FOUND" &&
      error.statusCode ===
        404
  );
});

test("cross-Location offering cannot be replayed into another trusted Location", () => {
  const businessId =
    oid();
  const serviceId =
    oid();

  assert.throws(
    () =>
      resolveEffectiveServiceConfiguration({
        service:
          baseService({
            businessId,
            serviceId,
          }),
        businessId,
        locationId:
          oid(),
        offering: {
          business:
            businessId,
          location:
            oid(),
          service:
            serviceId,
          status:
            "active",
        },
      }),
    (error) =>
      error.code ===
        "SERVICE_OFFERING_NOT_FOUND" &&
      error.statusCode ===
        404
  );
});

test("unavailable Location offering and disabled platform capability fail closed for publication and booking", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();
  const service =
    baseService({
      businessId,
      serviceId,
    });

  const unavailable =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
      offering: {
        business:
          businessId,
        location:
          locationId,
        service:
          serviceId,
        status:
          "suspended",
        available:
          true,
      },
    });

  assert.equal(
    unavailable.available,
    false
  );
  assert.equal(
    unavailable.published,
    false
  );
  assert.equal(
    unavailable.bookable,
    false
  );

  const capabilityOff =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
      capabilityAvailable:
        false,
    });

  assert.equal(
    capabilityOff.available,
    false
  );
  assert.equal(
    capabilityOff.published,
    false
  );
  assert.equal(
    capabilityOff.bookable,
    false
  );
  assert.equal(
    capabilityOff.provenance.available,
    "platform-capability"
  );
});

test("Location publication cannot elevate a globally unpublished Service unless policy explicitly permits it", () => {
  const businessId =
    oid();
  const locationId =
    oid();
  const serviceId =
    oid();
  const service =
    baseService({
      businessId,
      serviceId,
      overrides: {
        published:
          false,
      },
    });

  const restricted =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
      offering: {
        business:
          businessId,
        location:
          locationId,
        service:
          serviceId,
        publicationOverride:
          true,
      },
    });

  assert.equal(
    restricted.published,
    false
  );

  const allowed =
    resolveEffectiveServiceConfiguration({
      service,
      businessId,
      locationId,
      offering: {
        business:
          businessId,
        location:
          locationId,
        service:
          serviceId,
        publicationOverride:
          true,
      },
      allowLocationPublicationEnable:
        true,
    });

  assert.equal(
    allowed.published,
    true
  );
});
