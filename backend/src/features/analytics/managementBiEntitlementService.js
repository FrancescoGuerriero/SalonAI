import mongoose from "mongoose";

import TenantProductManifest from "../../models/TenantProductManifest.js";
import TenantSubscription from "../../models/TenantSubscription.js";
import { listCapabilityPacks } from "../../platform/capabilities/capabilityRegistry.js";
import {
  calculateTenantProductManifestHash,
  validateTenantProductManifestForActivation,
} from "../../platform/productComposition/tenantProductManifestPersistence.js";
import { resolveTenantEntitlements } from "../../platform/subscriptions/tenantSubscriptionLifecycle.js";
import { assertBusinessResourceAuthority } from "../../services/effectiveAuthorityService.js";

const ANALYTICS_PACK = "analytics";

function deny(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
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
 * Runtime read-only entitlement boundary for Module 16.
 *
 * Uses the same persisted manifest hash, canonical subscription lifecycle and
 * capability-composition rules as the AIIBP module catalogue. This is distinct
 * from the operator-only catalogue inspection API: restricted-location BI
 * readers must not require feature-control:read or all-location authority.
 *
 * The global premium-analytics administrator switch is checked separately by
 * the existing app.js requireFeature middleware.
 */
export async function assertManagementBiEntitlement(effectiveAuthority, {
  manifests = TenantProductManifest,
  subscriptions = TenantSubscription,
  now = new Date(),
} = {}) {
  const businessId = String(effectiveAuthority?.businessId || "");
  if (!mongoose.isValidObjectId(businessId)) {
    deny("BI_TENANT_REQUIRED", "Verified tenant context is required.");
  }
  assertBusinessResourceAuthority(effectiveAuthority, businessId);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    deny("BI_ENTITLEMENT_CLOCK_INVALID", "An authoritative verification date is required.");
  }

  const [manifestRecord, subscriptionRecord] = await Promise.all([
    manifests.findOne({ business: businessId, status: "active" }).lean(),
    subscriptions.findOne({ business: businessId }).lean(),
  ]);
  if (!manifestRecord || !subscriptionRecord ||
      String(manifestRecord.business || "") !== businessId ||
      String(subscriptionRecord.business || "") !== businessId) {
    deny("BI_TENANT_RECORDS_REQUIRED", "Verified tenant product and subscription records are required.");
  }

  let manifest;
  try {
    manifest = manifestSnapshot(manifestRecord, businessId);
    if (!manifest.platformVersion ||
        manifestRecord.manifestHash !== calculateTenantProductManifestHash(manifest) ||
        (manifest.effectiveFrom && new Date(manifest.effectiveFrom) > now)) {
      deny("BI_MANIFEST_UNTRUSTED", "Tenant product manifest integrity or effective date is invalid.");
    }
    if (manifest.planKey && manifest.planKey !== subscriptionRecord.planKey) {
      deny("BI_TENANT_PLAN_MISMATCH", "Tenant product and subscription plans disagree.");
    }
  } catch (error) {
    if (error.code?.startsWith("BI_")) throw error;
    deny("BI_MANIFEST_UNTRUSTED", "Tenant product manifest cannot be verified.");
  }

  if (!["trial", "active", "past_due"].includes(subscriptionRecord.status)) {
    deny("BI_SUBSCRIPTION_INACTIVE", "The tenant subscription is not eligible for analytics.");
  }

  try {
    const granted = resolveTenantEntitlements({
      businessId,
      planKey: subscriptionRecord.planKey,
      planVersion: subscriptionRecord.planVersion,
      status: subscriptionRecord.status,
      lifecycleRevision: subscriptionRecord.lifecycleRevision,
      entitlementGrants: subscriptionRecord.entitlementGrants || [],
    });
    if (!granted.includes(ANALYTICS_PACK)) {
      deny("BI_CAPABILITY_NOT_ENTITLED", "Analytics is not granted by this tenant subscription.");
    }
    const registered = new Set(listCapabilityPacks().map((pack) => pack.key));
    const { composition } = validateTenantProductManifestForActivation({
      manifest,
      entitledCapabilityPackKeys: granted.filter((key) => registered.has(key)),
    });
    if (!composition.enabledCapabilityPackKeys.includes(ANALYTICS_PACK)) {
      deny("BI_CAPABILITY_NOT_ENABLED", "Analytics is not enabled in the verified tenant composition.");
    }
  } catch (error) {
    if (error.code?.startsWith("BI_")) throw error;
    deny("BI_TENANT_COMPOSITION_INVALID", "Tenant analytics composition could not be verified.");
  }

  return Object.freeze({
    businessId,
    capabilityPackKey: ANALYTICS_PACK,
    manifestRevision: String(manifestRecord.manifestRevision),
    subscriptionRevision: Number(subscriptionRecord.lifecycleRevision),
    entitled: true,
    readOnly: true,
    deploymentVerified: null,
    productionAccepted: null,
  });
}

export function createRequireManagementBiEntitlement(
  checker = assertManagementBiEntitlement
) {
  if (typeof checker !== "function") {
    throw new TypeError("BI entitlement checker must be a function.");
  }
  return async function requireManagementBiEntitlement(req, _res, next) {
    try {
      req.managementBiEntitlement = await checker(req.effectiveAuthority);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireManagementBiEntitlement = createRequireManagementBiEntitlement();
