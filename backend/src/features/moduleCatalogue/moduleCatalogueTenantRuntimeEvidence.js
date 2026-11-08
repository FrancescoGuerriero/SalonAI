import mongoose from "mongoose";
import TenantProductManifest from "../../models/TenantProductManifest.js";
import TenantSubscription from "../../models/TenantSubscription.js";
import {
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "../../platform/productComposition/tenantProductManifestPersistence.js";
import { resolveTenantEntitlements } from "../../platform/subscriptions/tenantSubscriptionLifecycle.js";
import { listCapabilityPacks } from "../../platform/capabilities/capabilityRegistry.js";
import { listModuleCatalogue } from "../../platform/moduleCatalogue/canonicalModuleCatalogue.js";
import {
  assertBusinessResourceAuthority,
  assertEffectivePermission,
} from "../../services/effectiveAuthorityService.js";

function deny(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function manifestSnapshot(record, businessId) {
  return {
    schemaVersion: record.schemaVersion,
    platformVersion: record.platformVersion,
    businessId,
    verticalId: record.verticalId,
    planKey: record.planKey,
    capabilityPackKeys: record.capabilityPackKeys,
    entitlementOverrides: record.entitlementOverrides,
    configurationProfile: record.configurationProfile,
    themeProfile: record.themeProfile,
    terminologyProfile: record.terminologyProfile,
    integrationBindings: record.integrationBindings,
    aiCapabilityKeys: record.aiCapabilityKeys,
    workflowPackKeys: record.workflowPackKeys,
    dataPolicyProfile: record.dataPolicyProfile,
    approvedExtensionKeys: record.approvedExtensionKeys,
    deploymentProfile: record.deploymentProfile,
    manifestRevision: String(record.manifestRevision),
    status: record.status,
    effectiveFrom: record.effectiveFrom
      ? new Date(record.effectiveFrom).toISOString() : "",
  };
}

/**
 * Read-only, tenant-scoped evidence of persisted composition and subscription.
 * Never infers deployment, provider readiness or production acceptance.
 * This endpoint is deliberately limited to all-location management authority:
 * selected-location memberships must not inspect tenant-wide subscriptions.
 */
export async function inspectTrustedTenantModuleEvidence({
  effectiveAuthority,
  now = new Date(),
} = {}, {
  manifests = TenantProductManifest,
  subscriptions = TenantSubscription,
} = {}) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    deny("Trusted business context is required.", "MODULE_EVIDENCE_TENANT_REQUIRED", 401);
  }
  assertBusinessResourceAuthority(effectiveAuthority, businessId);
  assertEffectivePermission(effectiveAuthority, "feature-control:read");
  if (effectiveAuthority.locationAccessMode !== "all") {
    deny("Business-wide module evidence requires all-location management authority.",
      "MODULE_EVIDENCE_BUSINESS_SCOPE_REQUIRED");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    deny("Module evidence inspection clock is invalid.", "MODULE_EVIDENCE_CLOCK_INVALID", 400);
  }

  const [manifestRecord, subscriptionRecord] = await Promise.all([
    manifests.findOne({ business: businessId, status: "active" }).lean(),
    subscriptions.findOne({ business: businessId }).lean(),
  ]);
  if (!manifestRecord || !subscriptionRecord) {
    return Object.freeze({
      businessId, source: "persisted-tenant-records", readOnly: true,
      integrity: "missing_source_records", manifestRevision: null,
      subscriptionRevision: null, entries: Object.freeze([]),
      deploymentVerified: null, runtimeVerified: null,
      productionAccepted: null,
    });
  }
  if (String(manifestRecord.business) !== businessId ||
      String(subscriptionRecord.business) !== businessId) {
    deny("Returned tenant evidence has foreign ownership.", "MODULE_EVIDENCE_OWNER_MISMATCH");
  }

  const manifest = manifestSnapshot(manifestRecord, businessId);
  if (!manifest.platformVersion ||
      calculateTenantProductManifestHash(manifest) !== manifestRecord.manifestHash ||
      (manifest.effectiveFrom && new Date(manifest.effectiveFrom) > now)) {
    deny("Persisted tenant manifest integrity or effective date is invalid.",
      "MODULE_EVIDENCE_MANIFEST_UNTRUSTED");
  }
  if (manifest.planKey && manifest.planKey !== subscriptionRecord.planKey) {
    deny("Tenant manifest and subscription plans disagree.", "MODULE_EVIDENCE_PLAN_MISMATCH");
  }
  const subscription = {
    businessId,
    planKey: subscriptionRecord.planKey,
    planVersion: subscriptionRecord.planVersion,
    status: subscriptionRecord.status,
    lifecycleRevision: subscriptionRecord.lifecycleRevision,
    entitlementGrants: subscriptionRecord.entitlementGrants || [],
  };
  const grants = resolveTenantEntitlements(subscription);
  const registeredKeys = new Set(listCapabilityPacks().map((pack) => pack.key));
  const entitledPacks = grants.filter((key) => registeredKeys.has(key));
  const { composition } = validateTenantProductManifestForActivation({
    manifest,
    entitledCapabilityPackKeys: entitledPacks,
  });

  // A composition calculation does NOT load platform feature flags or verify
  // provider connections. Mark those dimensions explicitly unknown.
  const effectiveEntitlements = new Set(grants);
  const states = new Map(composition.capabilities.map((item) => [item.key, item]));
  const entries = listModuleCatalogue({ includeCandidates: true })
    .filter((row) => row.capabilityPackKeys.length > 0)
    .map((row) => {
      const packs = row.capabilityPackKeys;
      const selected = packs.every((key) => states.has(key));
      const entitlement = packs.every((key) => effectiveEntitlements.has(key));
      return Object.freeze({
        moduleId: row.moduleId,
        capabilityPackKeys: packs,
        manifestSelected: selected,
        subscriptionEntitled: entitlement,
        subscriptionStatus: subscriptionRecord.status,
        // Additional platform, provider and per-location activation gates
        // remain outside this record.
        configured: null,
        providerVerified: null,
        runtimeVerified: null,
        deploymentVerified: null,
        productionAccepted: null,
        activationAuthorised: false,
      });
    });

  return Object.freeze({
    businessId,
    source: "persisted-tenant-records",
    readOnly: true,
    integrity: "verified_manifest_and_subscription",
    manifestRevision: String(manifestRecord.manifestRevision),
    subscriptionRevision: Number(subscriptionRecord.lifecycleRevision),
    verticalId: composition.vertical.id,
    deploymentVerified: null,
    runtimeVerified: null,
    productionAccepted: null,
    entries: Object.freeze(entries),
  });
}
