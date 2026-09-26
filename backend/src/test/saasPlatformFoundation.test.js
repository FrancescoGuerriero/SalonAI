import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Business from "../models/Business.js";
import {
  DEFAULT_VERTICAL_ID,
  getVerticalDefinition,
  isRegisteredVertical,
  listVerticalDefinitions,
} from "../platform/verticals/verticalRegistry.js";
import {
  assertTenantOwnership,
  stampTenant,
  tenantFilter,
} from "../platform/tenancy/tenantScope.js";
import {
  getRuntimePlatformConfiguration,
} from "../platform/platformConfigurationService.js";

test("AI Intelligent Business Platform registers the four current vertical products", () => {
  assert.equal(DEFAULT_VERTICAL_ID, "salon");

  const expectedVerticals = [
    ["salon", "Salon AI"],
    ["plastic-surgery", "Plastic Surgery AI"],
    ["spa", "Spa AI"],
    ["fitness", "Fitness AI"],
  ];

  for (const [id, label] of expectedVerticals) {
    assert.equal(isRegisteredVertical(id), true);
    assert.equal(getVerticalDefinition(id).label, label);
  }

  assert.equal(listVerticalDefinitions().length, 4);

  const salon = getVerticalDefinition();
  assert.equal(salon.terminology.staffMember, "Stylist");
  assert.equal(salon.terminology.booking, "Appointment");
  assert.ok(salon.capabilities.includes("ai"));

  const plasticSurgery = getVerticalDefinition("plastic-surgery");
  assert.equal(plasticSurgery.terminology.customer, "Patient");
  assert.equal(plasticSurgery.terminology.booking, "Consultation");

  const spa = getVerticalDefinition("spa");
  assert.equal(spa.terminology.staffMember, "Therapist");

  const fitness = getVerticalDefinition("fitness");
  assert.equal(fitness.terminology.customer, "Member");
});

test("unsupported business types fail closed", () => {
  assert.throws(
    () => getVerticalDefinition("not-a-real-vertical"),
    (error) =>
      error.code === "UNSUPPORTED_BUSINESS_TYPE" &&
      error.statusCode === 400
  );
});

test("tenant filters cannot silently escape or switch business scope", () => {
  const businessId = new mongoose.Types.ObjectId().toString();
  const otherBusinessId = new mongoose.Types.ObjectId().toString();

  assert.deepEqual(
    tenantFilter(businessId, { active: true }),
    {
      active: true,
      business: businessId,
    }
  );

  assert.deepEqual(
    stampTenant(businessId, { name: "Example" }),
    {
      name: "Example",
      business: businessId,
    }
  );

  assert.throws(
    () =>
      tenantFilter(businessId, {
        business: otherBusinessId,
      }),
    (error) => error.code === "TENANT_SCOPE_CONFLICT"
  );

  assert.throws(
    () =>
      stampTenant(businessId, {
        business: otherBusinessId,
      }),
    (error) => error.code === "TENANT_SCOPE_CONFLICT"
  );
});

test("tenant ownership checks return 404 semantics across tenant boundaries", () => {
  const businessId = new mongoose.Types.ObjectId().toString();
  const otherBusinessId = new mongoose.Types.ObjectId().toString();

  const record = {
    business: businessId,
  };

  assert.equal(
    assertTenantOwnership(businessId, record),
    record
  );

  assert.throws(
    () => assertTenantOwnership(otherBusinessId, record),
    (error) =>
      error.code === "TENANT_RESOURCE_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("Business model defaults to the registered Salon AI vertical", () => {
  const business = new Business({
    name: "Example Salon",
    slug: "example-salon",
  });

  assert.equal(business.businessType, "salon");
  assert.equal(business.settings.currency, "GBP");
  assert.equal(business.subscription.provider, "stripe");
  assert.equal(business.validateSync(), undefined);
});

test("Business model accepts every registered current vertical", () => {
  for (const businessType of [
    "salon",
    "plastic-surgery",
    "spa",
    "fitness",
  ]) {
    const business = new Business({
      name: `Example ${businessType}`,
      slug: `example-${businessType}`,
      businessType,
    });

    assert.equal(business.validateSync(), undefined);
  }
});

test("Business model rejects unregistered verticals before persistence", () => {
  const business = new Business({
    name: "Example Business",
    slug: "example-business",
    businessType: "unknown",
  });

  const validationError = business.validateSync();

  assert.ok(validationError);
  assert.ok(validationError.errors.businessType);
});

test("public platform configuration exposes product metadata without tenant data", () => {
  const configuration = getRuntimePlatformConfiguration({
    AI_BUSINESS_PLATFORM_VERTICAL: "spa",
  });

  assert.equal(configuration.platform, "AI Intelligent Business Platform");
  assert.equal(configuration.referenceApplication, "Salon AI");
  assert.deepEqual(configuration.availableProducts, [
    { id: "salon", label: "Salon AI" },
    { id: "plastic-surgery", label: "Plastic Surgery AI" },
    { id: "spa", label: "Spa AI" },
    { id: "fitness", label: "Fitness AI" },
  ]);
  assert.equal(configuration.businessType, "spa");
  assert.equal(configuration.verticalLabel, "Spa AI");
  assert.equal(configuration.terminology.business, "Spa");
  assert.ok(configuration.capabilities.includes("communications"));
  assert.equal("tenantId" in configuration, false);
});

test("legacy SalonAI business-type configuration remains compatible", () => {
  const configuration = getRuntimePlatformConfiguration({
    SALONAI_BUSINESS_TYPE: "fitness",
  });

  assert.equal(configuration.platform, "AI Intelligent Business Platform");
  assert.equal(configuration.businessType, "fitness");
  assert.equal(configuration.verticalLabel, "Fitness AI");
});
