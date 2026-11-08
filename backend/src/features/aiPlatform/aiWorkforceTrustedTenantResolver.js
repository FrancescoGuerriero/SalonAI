import mongoose from "mongoose";

import TenantProductManifest from "../../models/TenantProductManifest.js";
import TenantSubscription from "../../models/TenantSubscription.js";
import { resolveTenantEntitlements } from "../../platform/subscriptions/tenantSubscriptionLifecycle.js";
import {
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "../../platform/productComposition/tenantProductManifestPersistence.js";
import { listCapabilityPacks } from "../../platform/capabilities/capabilityRegistry.js";
import { assertBusinessResourceAuthority } from "../../services/effectiveAuthorityService.js";
import { invokeGovernedBusinessMetrics } from "./aiWorkforceReadOnlyMetricsInvocation.js";

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  throw error;
}

function ownRecord(record, businessId) {
  return record && String(record.business || "") === businessId;
}

function normalisedManifestRecord(record, businessId) {
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
    effectiveFrom: record.effectiveFrom ? new Date(record.effectiveFrom).toISOString() : "",
  };
}

/**
 * Server-only resolution of persisted tenant product and subscription
 * evidence. No HTTP/body supplied composition or entitlements are accepted.
 *
 * Missing, suspended, stale, foreign and corrupt records fail closed.
 * Only explicitly granted capability packs may be enabled.
 */
export async function resolveTrustedAiToolContext(
  effectiveAuthority,
  {
    manifests = TenantProductManifest,
    subscriptions = TenantSubscription,
    now = new Date(),
  } = {}
) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    fail("Trusted Business membership is required.", "AI_TRUSTED_BUSINESS_REQUIRED");
  }
  assertBusinessResourceAuthority(effectiveAuthority, businessId);
  const [manifestRecord, subscriptionRecord] = await Promise.all([
    manifests.findOne({ business: businessId, status: "active" }).lean(),
    subscriptions.findOne({ business: businessId }).lean(),
  ]);
  if (!ownRecord(manifestRecord, businessId) || !ownRecord(subscriptionRecord, businessId)) {
    fail("Active tenant product and subscription records are required.", "AI_TENANT_RECORDS_REQUIRED");
  }

  const manifest = normalisedManifestRecord(manifestRecord, businessId);
  if (!manifest.platformVersion ||
      manifestRecord.manifestHash !== calculateTenantProductManifestHash(manifest)) {
    fail("Tenant product manifest integrity check failed.", "AI_MANIFEST_INTEGRITY_FAILED");
  }
  if (manifest.effectiveFrom && new Date(manifest.effectiveFrom) > now) {
    fail("Tenant product manifest is not yet effective.", "AI_MANIFEST_NOT_EFFECTIVE");
  }

  const entitlements = resolveTenantEntitlements({
    businessId,
    planKey: subscriptionRecord.planKey,
    planVersion: subscriptionRecord.planVersion,
    status: subscriptionRecord.status,
    lifecycleRevision: subscriptionRecord.lifecycleRevision,
    entitlementGrants: subscriptionRecord.entitlementGrants || [],
  });
  if (!["trial", "active", "past_due"].includes(subscriptionRecord.status)) {
    fail("Tenant subscription is not eligible for AI tools.", "AI_SUBSCRIPTION_NOT_ACTIVE");
  }
  if (manifest.planKey && manifest.planKey !== subscriptionRecord.planKey) {
    fail("Tenant subscription and active product plan do not agree.", "AI_TENANT_PLAN_MISMATCH");
  }
  const available = new Set(entitlements);
  if (!available.has("ai")) {
    fail("AI capability is not granted by subscription.", "AI_CAPABILITY_NOT_ENTITLED");
  }

  // Entitlement grants may include feature keys such as 'ai-tools'.
  // The capability-composition resolver consumes only registered pack keys.
  const packKeys = new Set(listCapabilityPacks().map(({ key }) => key));
  const entitledCapabilityPackKeys = entitlements.filter((key) => packKeys.has(key));
  const { composition } = validateTenantProductManifestForActivation({
    manifest,
    entitledCapabilityPackKeys,
  });
  if (!composition.enabledCapabilityPackKeys.includes("ai")) {
    fail("AI capability is unavailable for the resolved tenant composition.", "AI_CAPABILITY_NOT_ENABLED");
  }

  return Object.freeze({
    composition,
    enabledEntitlements: Object.freeze([...entitlements]),
    manifestRevision: manifest.manifestRevision,
    subscriptionRevision: subscriptionRecord.lifecycleRevision,
  });
}

/**
 * Internal-only entry point. Resolves all trust-bearing inputs fresh
 * before delegating to the already audited canonical metrics invocation.
 */
export async function invokeMetricsWithResolvedTenantAuthority(
  { effectiveAuthority, user, locationId = null, periodDays = 30, requestId = "" } = {},
  dependencies = {}
) {
  const trusted = await resolveTrustedAiToolContext(effectiveAuthority, dependencies);
  return invokeGovernedBusinessMetrics(
    {
      effectiveAuthority,
      composition: trusted.composition,
      enabledEntitlements: trusted.enabledEntitlements,
      user,
      locationId,
      periodDays,
      requestId,
    },
    dependencies.invocation || {}
  );
}

export default invokeMetricsWithResolvedTenantAuthority;
