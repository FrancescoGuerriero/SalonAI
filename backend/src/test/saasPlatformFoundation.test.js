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

test("SaaS foundation registers SalonAI as the default vertical", () => {
  assert.equal(DEFAULT_VERTICAL_ID, "salon");
  assert.equal(isRegisteredVertical("salon"), true);

  const vertical = getVerticalDefinition();
  assert.equal(vertical.id, "salon");
  assert.equal(vertical.terminology.staffMember, "Stylist");
  assert.equal(vertical.terminology.booking, "Appointment");
  assert.ok(vertical.capabilities.includes("ai"));
  assert.equal(listVerticalDefinitions().length >= 1, true);
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

test("Business model defaults to the registered salon vertical", () => {
  const business = new Business({
    name: "Example Salon",
    slug: "example-salon",
  });

  assert.equal(business.businessType, "salon");
  assert.equal(business.settings.currency, "GBP");
  assert.equal(business.subscription.provider, "stripe");
  assert.equal(business.validateSync(), undefined);
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

test("public platform configuration exposes vertical metadata without tenant data", () => {
  const configuration = getRuntimePlatformConfiguration({
    SALONAI_BUSINESS_TYPE: "salon",
  });

  assert.equal(configuration.platform, "SalonAI");
  assert.equal(configuration.businessType, "salon");
  assert.equal(configuration.terminology.business, "Salon");
  assert.ok(configuration.capabilities.includes("communications"));
  assert.equal("tenantId" in configuration, false);
});
