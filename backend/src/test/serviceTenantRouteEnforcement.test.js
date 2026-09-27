import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  resolveServicePublicTenantHost,
} from "../middleware/serviceTenantMiddleware.js";
import {
  managementServiceBusinessId,
  publicServiceBusinessId,
  scopedServiceFilter,
} from "../services/serviceTenantAuthorityService.js";

test("public Service scope comes only from trusted public tenant context", () => {
  assert.equal(
    publicServiceBusinessId({
      publicTenantContext: {
        businessId:
          "business-a",
      },
      query: {
        businessId:
          "attacker-business",
      },
      body: {
        business:
          "attacker-business",
      },
    }),
    "business-a"
  );

  assert.throws(
    () =>
      publicServiceBusinessId({
        query: {
          businessId:
            "attacker-business",
        },
      }),
    (error) =>
      error.code ===
        "PUBLIC_TENANT_NOT_FOUND" &&
      error.statusCode ===
        404
  );
});

test("management Service scope comes only from effective authority", () => {
  assert.equal(
    managementServiceBusinessId({
      effectiveAuthority: {
        businessId:
          "business-a",
      },
      body: {
        business:
          "attacker-business",
      },
    }),
    "business-a"
  );

  assert.throws(
    () =>
      managementServiceBusinessId({
        user: {
          role:
            "super_admin",
        },
      }),
    (error) =>
      error.code ===
        "SERVICE_TENANT_AUTHORITY_REQUIRED" &&
      error.statusCode ===
        401
  );
});

test("Service domain filters always include trusted Business ownership", () => {
  assert.deepEqual(
    scopedServiceFilter({
      businessId:
        "business-a",
      domainFilter: {
        _id:
          "service-a",
        active:
          true,
      },
    }),
    {
      business:
        "business-a",
      _id:
        "service-a",
      active:
        true,
    }
  );
});

test("Service public tenant host ignores raw client tenant selectors", () => {
  const request = {
    headers: {
      host:
        "salonai.francescopicardi.co.uk",
      "x-forwarded-host":
        "tenant-two.example.com",
    },
    query: {
      businessId:
        "tenant-two",
    },
    body: {
      businessId:
        "tenant-two",
    },
  };

  assert.equal(
    resolveServicePublicTenantHost(
      request,
      {
        NODE_ENV:
          "production",
      }
    ),
    "salonai.francescopicardi.co.uk"
  );
});

test("local development may use only the server-configured canonical app host fallback", () => {
  assert.equal(
    resolveServicePublicTenantHost(
      {
        headers: {
          host:
            "localhost:5000",
        },
      },
      {
        NODE_ENV:
          "development",
        SALONAI_CANONICAL_APP_DOMAIN:
          "salonai.francescopicardi.co.uk",
      }
    ),
    "salonai.francescopicardi.co.uk"
  );
});

test("explicit server Service host override wins for controlled test environments", () => {
  assert.equal(
    resolveServicePublicTenantHost(
      {
        headers: {
          host:
            "attacker.example.com",
        },
      },
      {
        NODE_ENV:
          "test",
        SERVICE_PUBLIC_TENANT_HOST_OVERRIDE:
          "salonai.francescopicardi.co.uk",
      }
    ),
    "salonai.francescopicardi.co.uk"
  );
});

test("Service routes compose host, membership, effective authority and canonical permissions", async () => {
  const source =
    await readFile(
      new URL(
        "../routes/serviceRoutes.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /servicePublicTenantContextMiddleware/
  );
  assert.match(
    source,
    /trustedTenantContextMiddleware/
  );
  assert.match(
    source,
    /effectiveAuthorityMiddleware/
  );
  assert.match(
    source,
    /const protectedServiceTenantChain = \[\s*servicePublicTenantContextMiddleware,\s*protect,\s*trustedTenantContextMiddleware,\s*effectiveAuthorityMiddleware,\s*\];/
  );

  for (const permission of [
    "service:read",
    "service:create",
    "service:publish",
    "service:update",
    "service:delete",
  ]) {
    assert.match(
      source,
      new RegExp(
        permission.replace(
          ":",
          "\\:"
        )
      )
    );
  }
});

test("Service controllers stamp and scope Business ownership rather than trusting payload ids", async () => {
  const source =
    await readFile(
      new URL(
        "../controllers/serviceController.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /business:\s*businessId/
  );
  assert.match(
    source,
    /delete payload\.business;/
  );
  assert.match(
    source,
    /scopedServiceFilter\(/
  );
  assert.match(
    source,
    /publicServiceBusinessId\(/
  );
  assert.match(
    source,
    /managementServiceBusinessId\(/
  );
  assert.match(
    source,
    /delete value\.business;/
  );

  assert.doesNotMatch(
    source,
    /Service\.findByIdAndUpdate\(/
  );
  assert.doesNotMatch(
    source,
    /Service\.findByIdAndDelete\(/
  );
});
