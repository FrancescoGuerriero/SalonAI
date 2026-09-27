import test from "node:test";
import assert from "node:assert/strict";

import {
  planTenantProductUpgrade,
} from "../platform/productComposition/tenantProductUpgradePlan.js";

function manifest({
  revision,
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
    status:
      "active",
    ...overrides,
  };
}

test("tenant upgrade plan explains a newly enabled module without performing writes", () => {
  const plan =
    planTenantProductUpgrade({
      currentManifest:
        manifest({
          revision:
            1,
        }),
      nextManifest:
        manifest({
          revision:
            2,
          capabilities: [
            "inventory",
          ],
        }),
    });

  assert.equal(
    plan.writesPerformed,
    false
  );
  assert.equal(
    plan.requiresTenantAcceptance,
    true
  );
  assert.deepEqual(
    plan.capabilitiesToEnable,
    [
      "inventory",
    ]
  );
  assert.equal(
    plan.capabilitiesToDisable.length,
    0
  );
  assert.equal(
    plan.upgradeFingerprint.length,
    64
  );

  const transition =
    plan.capabilityTransitions.find(
      ({ key }) =>
        key ===
        "inventory"
    );

  assert.equal(
    transition.fromEnabled,
    false
  );
  assert.equal(
    transition.toEnabled,
    true
  );
  assert.equal(
    transition.toReason,
    "tenant-manifest"
  );
});

test("entitlement removal is represented as capability disablement rather than manifest mutation", () => {
  const current =
    manifest({
      revision:
        1,
      capabilities: [
        "memberships",
      ],
    });
  const next =
    manifest({
      revision:
        2,
      capabilities: [
        "memberships",
      ],
    });

  const plan =
    planTenantProductUpgrade({
      currentManifest:
        current,
      nextManifest:
        next,
      currentEntitledCapabilityPackKeys: [
        "appointments",
        "staff",
        "services",
        "commerce",
        "communications",
        "calendar",
        "analytics",
        "ai",
        "memberships",
      ],
      nextEntitledCapabilityPackKeys: [
        "appointments",
        "staff",
        "services",
        "commerce",
        "communications",
        "calendar",
        "analytics",
        "ai",
      ],
    });

  assert.ok(
    plan.capabilitiesToDisable.includes(
      "memberships"
    )
  );

  const membership =
    plan.capabilityTransitions.find(
      ({ key }) =>
        key ===
        "memberships"
    );

  assert.equal(
    membership.toReason,
    "not-entitled"
  );
});

test("shared SaaS to dedicated deployment requires infrastructure review", () => {
  const plan =
    planTenantProductUpgrade({
      currentManifest:
        manifest({
          revision:
            1,
        }),
      nextManifest:
        manifest({
          revision:
            2,
          deploymentProfile:
            "dedicated",
        }),
    });

  assert.equal(
    plan.requiresInfrastructureReview,
    true
  );
  assert.ok(
    plan.profileChanges.some(
      (change) =>
        change.field ===
        "deploymentProfile"
    )
  );
});

test("upgrade fingerprint is deterministic for equivalent list ordering", () => {
  const left =
    planTenantProductUpgrade({
      currentManifest:
        manifest({
          revision:
            1,
        }),
      nextManifest:
        manifest({
          revision:
            2,
          capabilities: [
            "inventory",
            "memberships",
          ],
          overrides: {
            integrationBindings: [
              "twilio",
              "stripe",
            ],
          },
        }),
    });

  const right =
    planTenantProductUpgrade({
      currentManifest:
        manifest({
          revision:
            1,
        }),
      nextManifest:
        manifest({
          revision:
            2,
          capabilities: [
            "memberships",
            "inventory",
          ],
          overrides: {
            integrationBindings: [
              "stripe",
              "twilio",
            ],
          },
        }),
    });

  assert.equal(
    left.upgradeFingerprint,
    right.upgradeFingerprint
  );
});

test("ordinary tenant upgrade cannot switch verticals", () => {
  assert.throws(
    () =>
      planTenantProductUpgrade({
        currentManifest:
          manifest({
            revision:
              1,
          }),
        nextManifest:
          manifest({
            revision:
              2,
            overrides: {
              verticalId:
                "spa",
            },
          }),
      }),
    (error) =>
      error.code ===
      "TENANT_PRODUCT_MANIFEST_VERTICAL_CONFLICT"
  );
});
