import test from "node:test";
import assert from "node:assert/strict";

import {
  getCapabilityPack,
  registerCapabilityPack,
} from "../platform/capabilities/capabilityRegistry.js";
import {
  getVerticalPackDefinition,
} from "../platform/capabilities/verticalPackRegistry.js";
import {
  normaliseTenantProductManifest,
  resolveEffectiveTenantProductComposition,
} from "../platform/productComposition/tenantProductManifest.js";

test("Salon AI vertical pack reuses canonical vertical defaults", () => {
  const salon = getVerticalPackDefinition("salon");

  assert.equal(salon.id, "salon");
  assert.equal(salon.label, "Salon AI");
  assert.ok(salon.defaultCapabilityPackKeys.includes("appointments"));
  assert.ok(salon.defaultCapabilityPackKeys.includes("staff"));
  assert.ok(salon.defaultCapabilityPackKeys.includes("services"));
  assert.ok(salon.supportedCapabilityPackKeys.includes("memberships"));
  assert.ok(salon.supportedCapabilityPackKeys.includes("ai-receptionist"));
});

test("tenant product manifest normalises deployment and product metadata", () => {
  const manifest = normaliseTenantProductManifest({
    businessId: "business-tenant-1",
    verticalId: "SALON",
    planKey: "ai-business",
    capabilityPackKeys: ["memberships", "inventory", "memberships"],
    deploymentProfile: "shared-saas",
    themeProfile: "francesco-picardi",
    manifestRevision: "3",
  });

  assert.equal(manifest.schemaVersion, "1");
  assert.equal(manifest.verticalId, "salon");
  assert.equal(manifest.deploymentProfile, "shared-saas");
  assert.deepEqual(manifest.capabilityPackKeys, [
    "memberships",
    "inventory",
  ]);
  assert.equal(manifest.manifestRevision, "3");
});

test("Salon tenant composition combines vertical defaults with tenant packs", () => {
  const resolved = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "tenant-1",
      verticalId: "salon",
      planKey: "ai-business",
      capabilityPackKeys: [
        "memberships",
        "inventory",
        "loyalty",
        "ai-receptionist",
      ],
      status: "active",
    },
  });

  assert.equal(resolved.vertical.id, "salon");
  assert.ok(resolved.enabledCapabilityPackKeys.includes("appointments"));
  assert.ok(resolved.enabledCapabilityPackKeys.includes("memberships"));
  assert.ok(resolved.enabledCapabilityPackKeys.includes("inventory"));
  assert.ok(resolved.enabledCapabilityPackKeys.includes("ai-receptionist"));

  const membership = resolved.capabilities.find(
    ({ key }) => key === "memberships"
  );

  assert.equal(membership.selectionSource, "tenant-manifest");
  assert.equal(membership.reason, "tenant-manifest");
});

test("entitlement can make a selected capability unavailable without changing manifest", () => {
  const resolved = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "tenant-1",
      verticalId: "salon",
      capabilityPackKeys: ["memberships"],
    },
    entitledCapabilityPackKeys: [
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

  const membership = resolved.capabilities.find(
    ({ key }) => key === "memberships"
  );

  assert.equal(membership.enabled, false);
  assert.equal(membership.reason, "not-entitled");
  assert.ok(resolved.disabledCapabilityPackKeys.includes("memberships"));
});

test("dependent capability becomes unavailable when an entitled dependency is unavailable", () => {
  const resolved = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "tenant-1",
      verticalId: "salon",
      capabilityPackKeys: ["memberships"],
    },
    entitledCapabilityPackKeys: [
      "appointments",
      "staff",
      "services",
      "communications",
      "calendar",
      "analytics",
      "ai",
      "memberships",
    ],
  });

  const commerce = resolved.capabilities.find(
    ({ key }) => key === "commerce"
  );
  const membership = resolved.capabilities.find(
    ({ key }) => key === "memberships"
  );

  assert.equal(commerce.enabled, false);
  assert.equal(commerce.reason, "not-entitled");
  assert.equal(membership.enabled, false);
  assert.equal(
    membership.reason,
    "dependency-unavailable:commerce"
  );
});

test("platform safety lock wins over entitlement and feature exposure", () => {
  const resolved = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "tenant-1",
      verticalId: "salon",
      capabilityPackKeys: ["ai-receptionist"],
    },
    entitledCapabilityPackKeys: [
      "appointments",
      "staff",
      "services",
      "commerce",
      "communications",
      "calendar",
      "analytics",
      "ai",
      "ai-receptionist",
    ],
    featureFlags: {
      "ai-receptionist": true,
    },
    platformDisabledCapabilityPackKeys: [
      "ai-receptionist",
    ],
  });

  const agent = resolved.capabilities.find(
    ({ key }) => key === "ai-receptionist"
  );

  assert.equal(agent.enabled, false);
  assert.equal(agent.reason, "platform-safety-lock");
});

test("feature flag can hold back an otherwise entitled capability", () => {
  const resolved = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "tenant-1",
      verticalId: "salon",
      capabilityPackKeys: ["inventory"],
    },
    featureFlags: {
      inventory: false,
    },
  });

  const inventory = resolved.capabilities.find(
    ({ key }) => key === "inventory"
  );

  assert.equal(inventory.enabled, false);
  assert.equal(inventory.reason, "feature-flag-disabled");
});

test("unsupported vertical capability fails closed", () => {
  assert.throws(
    () =>
      resolveEffectiveTenantProductComposition({
        manifest: {
          businessId: "salon-tenant",
          verticalId: "salon",
          capabilityPackKeys: ["clinical-records"],
        },
      }),
    (error) =>
      error.code === "UNSUPPORTED_VERTICAL_CAPABILITY" &&
      error.statusCode === 400
  );
});

test("unknown capability fails closed", () => {
  assert.throws(
    () =>
      resolveEffectiveTenantProductComposition({
        manifest: {
          businessId: "tenant-1",
          verticalId: "salon",
          capabilityPackKeys: ["unknown-pack"],
        },
      }),
    (error) =>
      error.code === "UNKNOWN_CAPABILITY_PACK" &&
      error.statusCode === 400
  );
});

test("missing capability dependency fails before activation", () => {
  registerCapabilityPack({
    key: "test-dependent-pack",
    label: "Test dependent pack",
    supportedVerticals: ["fitness"],
    dependencies: ["inventory"],
  });

  assert.throws(
    () =>
      resolveEffectiveTenantProductComposition({
        manifest: {
          businessId: "fitness-tenant",
          verticalId: "fitness",
          capabilityPackKeys: ["test-dependent-pack"],
        },
      }),
    (error) =>
      error.code === "MISSING_CAPABILITY_DEPENDENCY"
  );
});

test("conflicting capability packs fail before activation", () => {
  registerCapabilityPack({
    key: "test-mode-a",
    label: "Test mode A",
    supportedVerticals: ["salon"],
    conflicts: ["test-mode-b"],
  });

  registerCapabilityPack({
    key: "test-mode-b",
    label: "Test mode B",
    supportedVerticals: ["salon"],
  });

  assert.throws(
    () =>
      resolveEffectiveTenantProductComposition({
        manifest: {
          businessId: "tenant-conflict",
          verticalId: "salon",
          capabilityPackKeys: [
            "test-mode-a",
            "test-mode-b",
          ],
        },
      }),
    (error) => error.code === "CAPABILITY_CONFLICT"
  );
});

test("two Salon AI tenants can have different products without code forks", () => {
  const tenantOne = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "salon-tenant-1",
      verticalId: "salon",
      capabilityPackKeys: [
        "memberships",
        "inventory",
        "ai-receptionist",
      ],
    },
  });

  const tenantTwo = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "salon-tenant-2",
      verticalId: "salon",
      capabilityPackKeys: ["loyalty"],
    },
  });

  assert.equal(tenantOne.vertical.id, tenantTwo.vertical.id);
  assert.ok(tenantOne.enabledCapabilityPackKeys.includes("inventory"));
  assert.equal(
    tenantTwo.enabledCapabilityPackKeys.includes("inventory"),
    false
  );
  assert.ok(tenantTwo.enabledCapabilityPackKeys.includes("loyalty"));
});

test("another registered vertical uses the same composition engine", () => {
  const spa = resolveEffectiveTenantProductComposition({
    manifest: {
      businessId: "spa-tenant-1",
      verticalId: "spa",
      capabilityPackKeys: [
        "memberships",
        "inventory",
        "ai-receptionist",
      ],
    },
  });

  assert.equal(spa.vertical.id, "spa");
  assert.equal(spa.vertical.terminology.business, "Spa");
  assert.ok(spa.enabledCapabilityPackKeys.includes("memberships"));
  assert.ok(spa.enabledCapabilityPackKeys.includes("ai-receptionist"));
  assert.equal(
    getCapabilityPack("ai-receptionist").label,
    "AI Receptionist"
  );
});

test("manifest rejects unsupported deployment profiles and schema versions", () => {
  assert.throws(
    () =>
      normaliseTenantProductManifest({
        schemaVersion: "99",
        businessId: "tenant-1",
        verticalId: "salon",
      }),
    (error) =>
      error.code === "UNSUPPORTED_TENANT_PRODUCT_MANIFEST_SCHEMA"
  );

  assert.throws(
    () =>
      normaliseTenantProductManifest({
        businessId: "tenant-1",
        verticalId: "salon",
        deploymentProfile: "tenant-code-fork",
      }),
    (error) =>
      error.code === "INVALID_TENANT_PRODUCT_MANIFEST"
  );
});
