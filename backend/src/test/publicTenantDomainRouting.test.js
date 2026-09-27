import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import BusinessDomain from "../models/BusinessDomain.js";
import {
  extractServerTrustedHost,
  normaliseTenantHost,
} from "../platform/tenancy/tenantHost.js";
import {
  createPublicTenantContextMiddleware,
  resolvePublicTenantContext,
} from "../platform/tenancy/publicTenantContext.js";

test("tenant host normalization strips port and trailing dot", () => {
  assert.equal(
    normaliseTenantHost(
      "SalonAI.FrancescoPicardi.co.uk:443"
    ),
    "salonai.francescopicardi.co.uk"
  );

  assert.equal(
    normaliseTenantHost(
      "francescopicardi.co.uk."
    ),
    "francescopicardi.co.uk"
  );
});

test("tenant host normalization rejects URLs, paths and invalid hosts", () => {
  for (const value of [
    "https://francescopicardi.co.uk",
    "francescopicardi.co.uk/path",
    "*.francescopicardi.co.uk",
    "localhost",
    "127.0.0.1",
    "",
  ]) {
    assert.throws(
      () =>
        normaliseTenantHost(
          value
        ),
      (error) =>
        error.code ===
        "INVALID_TENANT_HOST"
    );
  }
});

test("forwarded host is ignored unless explicitly trusted", () => {
  const request = {
    headers: {
      host:
        "francescopicardi.co.uk",
      "x-forwarded-host":
        "tenant-two.example.com",
    },
  };

  assert.equal(
    extractServerTrustedHost(
      request
    ),
    "francescopicardi.co.uk"
  );

  assert.equal(
    extractServerTrustedHost(
      request,
      {
        trustForwardedHost:
          true,
      }
    ),
    "tenant-two.example.com"
  );
});

test("server-trusted public host override wins without trusting raw headers", () => {
  const request = {
    trustedPublicHost:
      "salonai.francescopicardi.co.uk",
    headers: {
      host:
        "attacker.example.com",
    },
  };

  assert.equal(
    extractServerTrustedHost(
      request
    ),
    "salonai.francescopicardi.co.uk"
  );
});

test("BusinessDomain normalizes host and primary domain cannot redirect", async () => {
  const domain =
    new BusinessDomain({
      business:
        new mongoose.Types.ObjectId(),
      host:
        "FrancescoPicardi.co.uk:443",
      status: "active",
      role: "primary",
      redirectToPrimary: true,
    });

  await domain.validate();

  assert.equal(
    domain.host,
    "francescopicardi.co.uk"
  );
  assert.equal(
    domain.redirectToPrimary,
    false
  );
});

test("BusinessDomain enforces global host uniqueness and one active primary per business", () => {
  const indexes =
    BusinessDomain.schema.indexes();

  const hostUnique =
    indexes.find(
      ([fields]) =>
        fields.host === 1
    );

  assert.ok(hostUnique);
  assert.equal(
    hostUnique[1].unique,
    true
  );

  const primaryUnique =
    indexes.find(
      ([fields, options]) =>
        fields.business === 1 &&
        fields.role === 1 &&
        fields.status === 1 &&
        options.unique === true
    );

  assert.ok(primaryUnique);
  assert.deepEqual(
    primaryUnique[1]
      .partialFilterExpression,
    {
      role: "primary",
      status: "active",
    }
  );
});

test("public tenant resolver supports two Salon AI tenants independently", async () => {
  const businessOneId =
    new mongoose.Types.ObjectId().toString();
  const businessTwoId =
    new mongoose.Types.ObjectId().toString();

  const domains =
    new Map([
      [
        "francescopicardi.co.uk",
        {
          business:
            businessOneId,
          host:
            "francescopicardi.co.uk",
          status: "active",
          role: "primary",
        },
      ],
      [
        "salon-two.example.com",
        {
          business:
            businessTwoId,
          host:
            "salon-two.example.com",
          status: "active",
          role: "primary",
        },
      ],
    ]);

  const businesses =
    new Map([
      [
        businessOneId,
        {
          _id:
            businessOneId,
          name:
            "Francesco Picardi",
          slug:
            "francesco-picardi",
          businessType:
            "salon",
          status:
            "active",
        },
      ],
      [
        businessTwoId,
        {
          _id:
            businessTwoId,
          name:
            "Salon Two",
          slug:
            "salon-two",
          businessType:
            "salon",
          status:
            "active",
        },
      ],
    ]);

  const findDomain =
    async (host) =>
      domains.get(host) ||
      null;

  const findBusiness =
    async (businessId) =>
      businesses.get(
        String(businessId)
      ) || null;

  const first =
    await resolvePublicTenantContext({
      host:
        "francescopicardi.co.uk",
      findDomain,
      findBusiness,
    });

  const second =
    await resolvePublicTenantContext({
      host:
        "salon-two.example.com",
      findDomain,
      findBusiness,
    });

  assert.equal(
    first.businessId,
    businessOneId
  );
  assert.equal(
    first.verticalId,
    "salon"
  );
  assert.equal(
    second.businessId,
    businessTwoId
  );
  assert.notEqual(
    first.businessId,
    second.businessId
  );
});

test("public tenant resolver can coexist with a Spa AI tenant", async () => {
  const spaBusinessId =
    new mongoose.Types.ObjectId().toString();

  const context =
    await resolvePublicTenantContext({
      host:
        "spa-one.example.com",
      findDomain:
        async () => ({
          business:
            spaBusinessId,
          status: "active",
          role: "primary",
        }),
      findBusiness:
        async () => ({
          _id:
            spaBusinessId,
          name:
            "Spa One",
          slug:
            "spa-one",
          businessType:
            "spa",
          status:
            "active",
        }),
    });

  assert.equal(
    context.verticalId,
    "spa"
  );
});

test("pending or unknown tenant host fails closed", async () => {
  await assert.rejects(
    resolvePublicTenantContext({
      host:
        "pending.example.com",
      findDomain:
        async () => null,
      findBusiness:
        async () => null,
    }),
    (error) =>
      error.code ===
        "PUBLIC_TENANT_NOT_FOUND" &&
      error.statusCode === 404
  );
});

test("public tenant middleware stamps only server-resolved business context", async () => {
  const businessId =
    new mongoose.Types.ObjectId().toString();

  const middleware =
    createPublicTenantContextMiddleware({
      hostResolver:
        async () =>
          "francescopicardi.co.uk",
      contextResolver:
        async () =>
          Object.freeze({
            businessId,
            businessSlug:
              "francesco-picardi",
            businessName:
              "Francesco Picardi",
            verticalId:
              "salon",
            host:
              "francescopicardi.co.uk",
            domainRole:
              "primary",
          }),
    });

  const request = {
    headers: {
      "x-business-id":
        new mongoose.Types.ObjectId().toString(),
    },
    query: {
      businessId:
        new mongoose.Types.ObjectId().toString(),
    },
    body: {
      businessId:
        new mongoose.Types.ObjectId().toString(),
    },
  };

  let nextError = null;

  await middleware(
    request,
    {},
    (error) => {
      nextError =
        error || null;
    }
  );

  assert.equal(
    nextError,
    null
  );
  assert.equal(
    request.publicTenantContext
      .businessId,
    businessId
  );
  assert.equal(
    request.trustedTenantSelection
      .businessId,
    businessId
  );
});

test("public tenant middleware rejects conflicting server-trusted business context", async () => {
  const businessId =
    new mongoose.Types.ObjectId().toString();
  const otherBusinessId =
    new mongoose.Types.ObjectId().toString();

  const middleware =
    createPublicTenantContextMiddleware({
      hostResolver:
        async () =>
          "francescopicardi.co.uk",
      contextResolver:
        async () => ({
          businessId,
          businessSlug:
            "francesco-picardi",
          businessName:
            "Francesco Picardi",
          verticalId:
            "salon",
          host:
            "francescopicardi.co.uk",
          domainRole:
            "primary",
        }),
    });

  const request = {
    trustedTenantSelection: {
      businessId:
        otherBusinessId,
    },
  };

  let nextError = null;

  await middleware(
    request,
    {},
    (error) => {
      nextError =
        error || null;
    }
  );

  assert.ok(nextError);
  assert.equal(
    nextError.code,
    "PUBLIC_TENANT_NOT_FOUND"
  );
});
