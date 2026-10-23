import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import MarketplaceApp, {
  MARKETPLACE_BILLING_MODELS,
} from "../../models/MarketplaceApp.js";
import MarketplaceInstallation from "../../models/MarketplaceInstallation.js";
import TenantSubscription from "../../models/TenantSubscription.js";
import {
  resolveTenantEntitlements,
} from "../../platform/subscriptions/tenantSubscriptionLifecycle.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const FORBIDDEN_SECRET_KEYS = Object.freeze([
  "secret",
  "password",
  "token",
  "credential",
  "privatekey",
]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, {
      field,
    });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated marketplace operator is required.", 401);
  }
  return value;
}

function slug(value) {
  const result = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  if (!result) {
    throw createServiceError("Marketplace app key is required.", 400, {
      field: "key",
    });
  }
  return result;
}

function uniqueStrings(values = [], maximum = 100) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => text(value))
        .filter(Boolean)
        .slice(0, maximum)
    ),
  ];
}

function assertNoSecrets(value, path = "submission") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalised = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_SECRET_KEYS.some((token) => normalised.includes(token))) {
      throw createServiceError(
        `Marketplace submissions cannot contain secrets (${path}.${key}).`,
        422,
        {
          code: "MARKETPLACE_SECRET_INPUT_PROHIBITED",
          field: `${path}.${key}`,
        }
      );
    }
    if (child && typeof child === "object") {
      assertNoSecrets(child, `${path}.${key}`);
    }
  }
}

function httpsUrl(value, field) {
  const candidate = text(value);
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw createServiceError(`${field} must be a valid HTTPS URL.`, 400, {
      field,
    });
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw createServiceError(
      `${field} must be a credential-free HTTPS URL without a fragment.`,
      400,
      { field }
    );
  }
  return parsed.toString();
}

function urlList(values, field) {
  return uniqueStrings(values, 50).map((value, index) =>
    httpsUrl(value, `${field}[${index}]`)
  );
}

function commercialTerms(value = {}) {
  const billingModel = text(value.billingModel || "free")
    .toLowerCase()
    .replaceAll("-", "_");
  if (!MARKETPLACE_BILLING_MODELS.includes(billingModel)) {
    throw createServiceError("Unsupported marketplace billing model.", 400, {
      field: "commercialTerms.billingModel",
    });
  }
  const currency = text(value.currency || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw createServiceError("commercialTerms.currency must be a three-letter code.", 400);
  }
  const monthlyAmount = Number(value.monthlyAmount || 0);
  const revenueSharePercent = Number(value.revenueSharePercent || 0);
  if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    throw createServiceError("commercialTerms.monthlyAmount must be non-negative.", 400);
  }
  if (
    !Number.isFinite(revenueSharePercent) ||
    revenueSharePercent < 0 ||
    revenueSharePercent > 100
  ) {
    throw createServiceError(
      "commercialTerms.revenueSharePercent must be between 0 and 100.",
      400
    );
  }
  if (billingModel !== "revenue_share" && revenueSharePercent !== 0) {
    throw createServiceError(
      "Revenue-share percentage is only valid for revenue_share marketplace apps.",
      400
    );
  }
  return {
    billingModel,
    currency,
    monthlyAmount,
    revenueSharePercent,
  };
}

function integrationProfile(value = {}) {
  const requests = Math.max(
    1,
    Math.min(1000000, Number(value.ratePolicy?.requests) || 600)
  );
  const windowSeconds = Math.max(
    1,
    Math.min(86400, Number(value.ratePolicy?.windowSeconds) || 60)
  );
  return {
    redirectUris: urlList(value.redirectUris, "integrationProfile.redirectUris"),
    allowedOrigins: urlList(value.allowedOrigins, "integrationProfile.allowedOrigins"),
    ratePolicy: { requests, windowSeconds },
  };
}

function subscriptionSnapshot(subscription) {
  return {
    businessId: String(subscription.business),
    planKey: subscription.planKey,
    planVersion: subscription.planVersion,
    status: subscription.status,
    entitlementGrants: subscription.entitlementGrants || [],
    lifecycleRevision: subscription.lifecycleRevision,
  };
}

function appView(app) {
  const value = typeof app?.toObject === "function" ? app.toObject() : app;
  return {
    ...value,
    billingExecutionEnabled: false,
  };
}

export async function submitPartnerMarketplaceApp(
  payload = {},
  { user, requestId = "" } = {}
) {
  const actor = actorId(user);
  assertNoSecrets(payload);
  for (const field of [
    "status",
    "approvedScopes",
    "reviewedBy",
    "reviewedAt",
    "billingExecutionEnabled",
  ]) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      throw createServiceError(
        `Marketplace review field ${field} is server-controlled.`,
        400,
        { code: "MARKETPLACE_REVIEW_FIELD_SERVER_CONTROLLED", field }
      );
    }
  }

  const name = text(payload.name);
  const partnerName = text(payload.partnerName);
  const requestedScopes = uniqueStrings(payload.requestedScopes);
  if (!name || !partnerName) {
    throw createServiceError("Marketplace app name and partnerName are required.", 400);
  }
  if (!requestedScopes.length) {
    throw createServiceError("At least one requested integration scope is required.", 400, {
      field: "requestedScopes",
    });
  }

  const app = await MarketplaceApp.create({
    key: slug(payload.key || name),
    name,
    partnerName,
    description: text(payload.description),
    status: "submitted",
    requestedScopes,
    approvedScopes: [],
    requiredEntitlements: uniqueStrings(payload.requiredEntitlements),
    integrationProfile: integrationProfile(payload.integrationProfile || {}),
    commercialTerms: commercialTerms(payload.commercialTerms || {}),
    billingExecutionEnabled: false,
    submittedBy: actor,
    submittedAt: new Date(),
    metadata:
      payload.metadata &&
      typeof payload.metadata === "object" &&
      !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  });

  await AuditLog.create({
    actor,
    action: "marketplace.app_submitted",
    resourceType: "MarketplaceApp",
    resourceId: String(app._id),
    requestId: text(requestId),
    after: {
      key: app.key,
      status: app.status,
      requestedScopes: app.requestedScopes,
      requiredEntitlements: app.requiredEntitlements,
    },
    metadata: {
      partnerName: app.partnerName,
      billingExecutionEnabled: false,
    },
  });
  return appView(app);
}

export async function listPartnerMarketplaceApps(
  query = {},
  { platformReview = false } = {}
) {
  const match = platformReview ? {} : { status: "approved" };
  if (query.status && platformReview) {
    match.status = text(query.status).toLowerCase();
  }
  const items = await MarketplaceApp.find(match)
    .sort({ name: 1, _id: 1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 100)))
    .lean();
  return items.map(appView);
}

export async function reviewPartnerMarketplaceApp(
  appId,
  payload = {},
  { user, requestId = "" } = {}
) {
  objectId(appId, "marketplaceApp");
  const actor = actorId(user);
  const app = assertFound(
    await MarketplaceApp.findById(appId),
    "Marketplace app submission not found."
  );
  const decision = text(payload.decision).toLowerCase();
  if (!["approved", "rejected", "suspended"].includes(decision)) {
    throw createServiceError("decision must be approved, rejected or suspended.", 400);
  }

  let approvedScopes = [];
  if (decision === "approved") {
    approvedScopes = uniqueStrings(
      payload.approvedScopes?.length ? payload.approvedScopes : app.requestedScopes
    );
    const requested = new Set(app.requestedScopes || []);
    if (!approvedScopes.length || approvedScopes.some((scope) => !requested.has(scope))) {
      throw createServiceError(
        "Approved marketplace scopes must be a non-empty subset of requestedScopes.",
        409,
        { code: "MARKETPLACE_APPROVED_SCOPE_INVALID" }
      );
    }
  }

  app.status = decision;
  app.approvedScopes = approvedScopes;
  app.reviewedBy = actor;
  app.reviewedAt = new Date();
  app.reviewNote = text(payload.note);
  await app.save();

  await AuditLog.create({
    actor,
    action: `marketplace.app_${decision}`,
    resourceType: "MarketplaceApp",
    resourceId: String(app._id),
    requestId: text(requestId),
    after: {
      status: app.status,
      approvedScopes: app.approvedScopes,
    },
    metadata: {
      billingExecutionEnabled: false,
      tenantInstallRequiresEntitlements: app.requiredEntitlements,
    },
  });
  return appView(app);
}

export async function preparePartnerMarketplaceInstallation(
  appId,
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  objectId(appId, "marketplaceApp");
  const actor = actorId(user);
  if (Object.prototype.hasOwnProperty.call(payload, "business")) {
    throw createServiceError(
      "Marketplace installation tenant ownership is server-controlled.",
      400,
      { code: "MARKETPLACE_CLIENT_TENANT_FORBIDDEN" }
    );
  }

  const app = assertFound(
    await MarketplaceApp.findOne({ _id: appId, status: "approved" }).lean(),
    "Approved marketplace app not found."
  );
  const subscription = assertFound(
    await TenantSubscription.findOne({ business: businessId }).lean(),
    "Active tenant subscription is required for marketplace installation."
  );
  if (!["trial", "active", "past_due"].includes(subscription.status)) {
    throw createServiceError(
      "Marketplace installation is unavailable while the tenant subscription is inactive.",
      403,
      { code: "MARKETPLACE_SUBSCRIPTION_INACTIVE" }
    );
  }
  const entitlements = resolveTenantEntitlements(
    subscriptionSnapshot(subscription)
  );
  const entitlementSet = new Set(entitlements);
  const missingEntitlements = (app.requiredEntitlements || []).filter(
    (key) => !entitlementSet.has(key)
  );
  if (missingEntitlements.length) {
    throw createServiceError(
      "The tenant subscription does not include all entitlements required by this marketplace app.",
      403,
      {
        code: "MARKETPLACE_ENTITLEMENTS_REQUIRED",
        entitlements: missingEntitlements,
      }
    );
  }

  const approvedScopeSet = new Set(app.approvedScopes || []);
  const grantedScopes = uniqueStrings(
    payload.scopes?.length ? payload.scopes : app.approvedScopes
  );
  if (
    !grantedScopes.length ||
    grantedScopes.some((scope) => !approvedScopeSet.has(scope))
  ) {
    throw createServiceError(
      "Installation scopes must be a non-empty subset of approved marketplace scopes.",
      409,
      { code: "MARKETPLACE_INSTALL_SCOPE_INVALID" }
    );
  }

  const integrationKey = `marketplace-${app.key}`.slice(0, 100);
  const integrationApp = await IntegrationApp.findOneAndUpdate(
    { business: businessId, key: integrationKey },
    {
      $setOnInsert: {
        business: businessId,
        key: integrationKey,
        name: app.name,
        description: app.description || "",
        ownerUser: actor,
        environment: "production",
        status: "draft",
        scopes: grantedScopes,
        redirectUris: app.integrationProfile?.redirectUris || [],
        allowedOrigins: app.integrationProfile?.allowedOrigins || [],
        ratePolicy: app.integrationProfile?.ratePolicy || {
          requests: 600,
          windowSeconds: 60,
        },
        metadata: {
          marketplaceAppId: String(app._id),
          marketplaceKey: app.key,
          installationPrepared: true,
          credentialsProvisioned: false,
          externalConnectionProvisioned: false,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (
    String(integrationApp.metadata?.marketplaceAppId || "") !== String(app._id)
  ) {
    throw createServiceError(
      "The tenant already has an IntegrationApp using the marketplace integration key.",
      409,
      { code: "MARKETPLACE_INTEGRATION_KEY_CONFLICT" }
    );
  }
  if (integrationApp.status !== "draft") {
    throw createServiceError(
      "Marketplace preparation cannot take over an already activated IntegrationApp.",
      409,
      { code: "MARKETPLACE_INTEGRATION_ALREADY_ACTIVATED" }
    );
  }

  const installation = await MarketplaceInstallation.findOneAndUpdate(
    { business: businessId, marketplaceApp: app._id },
    {
      $set: {
        integrationApp: integrationApp._id,
        status: "prepared",
        grantedScopes,
        entitlementSnapshot: entitlements,
        commercialSnapshot: {
          billingModel: app.commercialTerms?.billingModel || "free",
          currency: app.commercialTerms?.currency || "GBP",
          monthlyAmount: Number(app.commercialTerms?.monthlyAmount || 0),
          revenueSharePercent: Number(
            app.commercialTerms?.revenueSharePercent || 0
          ),
        },
        billingExecutionEnabled: false,
        connectionProvisioned: false,
        preparedBy: actor,
        preparedAt: new Date(),
        connectedAt: null,
        metadata: {
          credentialsProvisioned: false,
          externalConnectionProvisioned: false,
          activationRequiresIntegrationPlatform: true,
        },
      },
      $setOnInsert: {
        business: businessId,
        marketplaceApp: app._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await AuditLog.create({
    actor,
    action: "marketplace.installation_prepared",
    resourceType: "MarketplaceInstallation",
    resourceId: String(installation._id),
    requestId: text(requestId),
    after: {
      businessId: String(businessId),
      marketplaceAppId: String(app._id),
      integrationAppId: String(integrationApp._id),
      status: installation.status,
      grantedScopes,
    },
    metadata: {
      billingExecutionEnabled: false,
      connectionProvisioned: false,
      credentialsProvisioned: false,
    },
  });

  return {
    installation: installation.toObject(),
    integrationApp: integrationApp.toObject(),
    nextStep:
      "Configure credentials/connections through the existing Integration Platform; marketplace preparation does not activate external access or billing.",
  };
}

export async function listPartnerMarketplaceInstallations(
  query = {},
  { businessId } = {}
) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) match.status = text(query.status).toLowerCase();
  return MarketplaceInstallation.find(match)
    .populate("marketplaceApp", "key name partnerName status approvedScopes requiredEntitlements commercialTerms")
    .populate("integrationApp", "key name environment status scopes")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 100)))
    .lean();
}

export default {
  listPartnerMarketplaceApps,
  listPartnerMarketplaceInstallations,
  preparePartnerMarketplaceInstallation,
  reviewPartnerMarketplaceApp,
  submitPartnerMarketplaceApp,
};
