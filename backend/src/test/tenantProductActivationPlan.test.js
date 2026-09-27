import test from "node:test";
import assert from "node:assert/strict";

import {
  planTenantProductManifestActivation,
} from "../platform/productComposition/tenantProductActivationPlan.js";

function manifest({
  revision,
  status = "draft",
  capabilities = [],
  deploymentProfile = "shared-saas",
  overrides = {},
}) {
  return {
    schemaVersion:
      "1",
    platformVersion:
      "3.0.0",
    businessId:
      "salon-tenant-1",
    verticalId:
      "salon",
    planKey:
      "standard",
    capabilityPackKeys:
      capabilities,
    deploymentProfile,
    manifestRevision:
      String(
        revision
      ),
    status,
    ...overrides,
  };
}

test("initial tenant product activation is planned without performing writes", () => {
  const plan =
    planTenantProductManifestActivation({
      candidateManifest:
        manifest({
          revision:
            1,
        }),
    });

  assert.equal(
    plan.writesPerformed,
    false
  );
  assert.equal(
    plan.fromRevision,
    null
  );
  assert.equal(
    plan.toRevision,
    "1"
  );
  assert.equal(
    plan.persistenceOperations.length,
    1
  );
  assert.equal(
    plan.persistenceOperations[0].type,
    "activate-candidate-manifest"
  );
  assert.equal(
    plan.activationFingerprint.length,
    64
  );
  assert.equal(
    plan.approvalRequired,
    true
  );
  assert.ok(
    plan.approvalReasons.includes(
      "initial-tenant-product-activation"
    )
  );
});

test("upgrade activation archives current revision then activates next revision", () => {
  const plan =
    planTenantProductManifestActivation({
      currentActiveManifest:
        manifest({
          revision:
            1,
          status:
            "active",
        }),
      candidateManifest:
        manifest({
          revision:
            2,
          capabilities: [
            "inventory",
          ],
        }),
    });

  assert.deepEqual(
    plan.persistenceOperations.map(
      ({ type }) => type
    ),
    [
      "archive-current-manifest",
      "activate-candidate-manifest",
    ]
  );
  assert.deepEqual(
    plan.upgradePlan
      .capabilitiesToEnable,
    [
      "inventory",
    ]
  );
  assert.equal(
    plan.approvalRequired,
    true
  );
  assert.ok(
    plan.approvalReasons.includes(
      "tenant-product-change"
    )
  );
});

test("activation candidate must remain draft before approval", () => {
  assert.throws(
    () =>
      planTenantProductManifestActivation({
        candidateManifest:
          manifest({
            revision:
              1,
            status:
              "active",
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_ACTIVATION_REQUIRES_DRAFT"
  );
});

test("first tenant activation must start at revision one", () => {
  assert.throws(
    () =>
      planTenantProductManifestActivation({
        candidateManifest:
          manifest({
            revision:
              2,
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_INITIAL_REVISION_REQUIRED"
  );
});

test("dedicated deployment is surfaced for infrastructure review", () => {
  const plan =
    planTenantProductManifestActivation({
      candidateManifest:
        manifest({
          revision:
            1,
          deploymentProfile:
            "dedicated",
        }),
    });

  assert.ok(
    plan.approvalReasons.includes(
      "deployment-infrastructure-review"
    )
  );
});

test("experimental capability is surfaced for explicit approval", () => {
  const plan =
    planTenantProductManifestActivation({
      candidateManifest: {
        schemaVersion:
          "1",
        platformVersion:
          "3.0.0",
        businessId:
          "clinic-tenant-1",
        verticalId:
          "plastic-surgery",
        capabilityPackKeys: [
          "clinical-records",
        ],
        manifestRevision:
          "1",
        status:
          "draft",
        deploymentProfile:
          "shared-saas",
      },
    });

  assert.ok(
    plan.approvalReasons.includes(
      "experimental-capability"
    )
  );
  assert.ok(
    plan.enabledCapabilityPackKeys.includes(
      "clinical-records"
    )
  );
});

test("activation fingerprint is deterministic for the same reviewed candidate", () => {
  const input = {
    currentActiveManifest:
      manifest({
        revision:
          1,
        status:
          "active",
      }),
    candidateManifest:
      manifest({
        revision:
          2,
        capabilities: [
          "inventory",
          "memberships",
        ],
      }),
  };

  const left =
    planTenantProductManifestActivation(
      input
    );
  const right =
    planTenantProductManifestActivation(
      input
    );

  assert.equal(
    left.activationFingerprint,
    right.activationFingerprint
  );
});


test("platform version upgrade requires explicit platform review", () => {
  const plan =
    planTenantProductManifestActivation({
      currentActiveManifest:
        manifest({
          revision:
            1,
          status:
            "active",
        }),
      candidateManifest:
        manifest({
          revision:
            2,
          overrides: {
            platformVersion:
              "3.1.0",
          },
        }),
    });

  assert.ok(
    plan.approvalReasons.includes(
      "platform-version-upgrade-review"
    )
  );
});
