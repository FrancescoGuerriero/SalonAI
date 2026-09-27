import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import TenantProductManifest from "../models/TenantProductManifest.js";
import {
  buildTenantProductManifestRevision,
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "../platform/productComposition/tenantProductManifestPersistence.js";

function baseManifest(
  overrides = {}
) {
  return {
    schemaVersion:
      "1",
    platformVersion:
      "3.0.0",
    businessId:
      "tenant-1",
    verticalId:
      "salon",
    capabilityPackKeys: [
      "memberships",
    ],
    manifestRevision:
      "1",
    status:
      "draft",
    deploymentProfile:
      "shared-saas",
    ...overrides,
  };
}

test("tenant product manifest hash is deterministic despite list ordering", () => {
  const left =
    calculateTenantProductManifestHash(
      baseManifest({
        capabilityPackKeys: [
          "inventory",
          "memberships",
        ],
        integrationBindings: [
          "twilio",
          "stripe",
        ],
      })
    );

  const right =
    calculateTenantProductManifestHash(
      baseManifest({
        capabilityPackKeys: [
          "memberships",
          "inventory",
        ],
        integrationBindings: [
          "stripe",
          "twilio",
        ],
      })
    );

  assert.equal(
    left,
    right
  );
  assert.equal(
    left.length,
    64
  );
});

test("manifest revision must advance by exactly one and preserve Business/vertical", () => {
  const previous =
    baseManifest({
      manifestRevision:
        "3",
    });

  const revision =
    buildTenantProductManifestRevision({
      previousManifest:
        previous,
      manifest:
        baseManifest({
          manifestRevision:
            "4",
          capabilityPackKeys: [
            "inventory",
          ],
        }),
    });

  assert.equal(
    revision.previousRevision,
    3
  );
  assert.equal(
    revision.manifest.manifestRevision,
    "4"
  );

  assert.throws(
    () =>
      buildTenantProductManifestRevision({
        previousManifest:
          previous,
        manifest:
          baseManifest({
            manifestRevision:
              "5",
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_MANIFEST_REVISION_SEQUENCE"
  );

  assert.throws(
    () =>
      buildTenantProductManifestRevision({
        previousManifest:
          previous,
        manifest:
          baseManifest({
            manifestRevision:
              "4",
            businessId:
              "tenant-2",
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_MANIFEST_BUSINESS_CONFLICT"
  );
});

test("active manifest requires platformVersion and resolves composition before activation", () => {
  assert.throws(
    () =>
      validateTenantProductManifestForActivation({
        manifest:
          baseManifest({
            status:
              "active",
            platformVersion:
              "",
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_MANIFEST_PLATFORM_VERSION_REQUIRED"
  );

  const activation =
    validateTenantProductManifestForActivation({
      manifest:
        baseManifest({
          status:
            "active",
        }),
    });

  assert.equal(
    activation.manifest.status,
    "active"
  );
  assert.equal(
    activation.manifestHash.length,
    64
  );
  assert.ok(
    activation.composition.enabledCapabilityPackKeys
      .includes(
        "memberships"
      )
  );
});

test("manifest persistence model preserves revision history and one-active-manifest contract", () => {
  const indexes =
    TenantProductManifest.schema
      .indexes();

  const revisionIndex =
    indexes.find(
      ([fields]) =>
        fields.business ===
          1 &&
        fields.manifestRevision ===
          1
    );

  assert.ok(
    revisionIndex
  );
  assert.equal(
    revisionIndex[1].unique,
    true
  );

  const activeIndex =
    indexes.find(
      ([fields, options]) =>
        fields.business ===
          1 &&
        fields.status ===
          1 &&
        options.unique ===
          true
    );

  assert.ok(
    activeIndex
  );
  assert.deepEqual(
    activeIndex[1]
      .partialFilterExpression,
    {
      status:
        "active",
    }
  );

  const record =
    new TenantProductManifest({
      business:
        new mongoose.Types.ObjectId(),
      schemaVersion:
        "1",
      platformVersion:
        "3.0.0",
      verticalId:
        "salon",
      manifestRevision:
        1,
      manifestHash:
        "a".repeat(
          64
        ),
      status:
        "draft",
    });

  assert.equal(
    record.validateSync(),
    undefined
  );
});
