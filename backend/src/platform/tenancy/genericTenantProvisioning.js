import { createHash } from "node:crypto";

import {
  normaliseTenantProductManifest,
  resolveEffectiveTenantProductComposition,
} from "../productComposition/tenantProductManifest.js";
import { getVerticalDefinition } from "../verticals/verticalRegistry.js";
import { normaliseTenantHost } from "./tenantHost.js";

export const TENANT_PROVISIONING_CONFIRMATION =
  "APPLY_GENERIC_TENANT_PROVISIONING";

const PLANNED_BUSINESS_ID = "000000000000000000000000";

function provisioningError(message, code = "INVALID_TENANT_PROVISIONING_REQUEST") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function cleanString(value) {
  return String(value || "").trim();
}

function cleanSlug(value, label) {
  const slug = cleanString(value).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 80) {
    throw provisioningError(
      `${label} must be 2-80 lowercase letters, numbers or single hyphens.`
    );
  }
  return slug;
}

function normaliseBusinessStatus(value) {
  const status = cleanString(value || "trial").toLowerCase();
  if (!["trial", "active", "suspended", "archived"].includes(status)) {
    throw provisioningError("Unsupported initial Business status.");
  }
  return status;
}

function normaliseCurrency(value) {
  const currency = cleanString(value || "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw provisioningError("Currency must be a 3-letter ISO-style code.");
  }
  return currency;
}

function normaliseOptionalObjectId(value, label) {
  const id = cleanString(value);
  if (!id) return "";
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw provisioningError(`${label} must be a valid ObjectId when supplied.`);
  }
  return id.toLowerCase();
}

export function normaliseTenantProvisioningRequest(input = {}) {
  const verticalId = cleanString(input.verticalId || "salon").toLowerCase();
  getVerticalDefinition(verticalId);

  const businessName = cleanString(input.businessName);
  if (!businessName || businessName.length > 120) {
    throw provisioningError("Business name is required and cannot exceed 120 characters.");
  }

  const businessSlug = cleanSlug(input.businessSlug, "Business slug");
  const locationName = cleanString(input.primaryLocation?.name);
  if (!locationName || locationName.length > 120) {
    throw provisioningError("Primary Location name is required and cannot exceed 120 characters.");
  }
  const locationSlug = cleanSlug(
    input.primaryLocation?.slug || `${businessSlug}-primary`,
    "Location slug"
  );
  const primaryDomain = normaliseTenantHost(input.primaryDomain);
  const appDomain = input.appDomain
    ? normaliseTenantHost(input.appDomain)
    : "";

  if (appDomain && appDomain === primaryDomain) {
    throw provisioningError(
      "App domain must differ from the primary domain.",
      "TENANT_DOMAIN_COLLISION"
    );
  }

  const ownerUserId = normaliseOptionalObjectId(
    input.ownerUserId,
    "Owner user id"
  );

  const manifestInput = normaliseTenantProductManifest({
    ...(input.productManifest || {}),
    businessId: PLANNED_BUSINESS_ID,
    verticalId,
    status: input.productManifest?.status || "draft",
    manifestRevision: input.productManifest?.manifestRevision || "1",
  });

  const composition = resolveEffectiveTenantProductComposition({
    manifest: manifestInput,
    entitledCapabilityPackKeys:
      input.entitledCapabilityPackKeys === undefined
        ? null
        : input.entitledCapabilityPackKeys,
    featureFlags: input.featureFlags || {},
    platformDisabledCapabilityPackKeys:
      input.platformDisabledCapabilityPackKeys || [],
  });

  return Object.freeze({
    verticalId,
    businessName,
    businessSlug,
    status: normaliseBusinessStatus(input.status),
    locale: cleanString(input.locale || "en-GB"),
    timezone: cleanString(input.timezone || "Europe/London"),
    currency: normaliseCurrency(input.currency),
    primaryLocation: Object.freeze({
      name: locationName,
      slug: locationSlug,
    }),
    primaryDomain,
    appDomain,
    ownerUserId,
    ownerRoleKey: cleanString(input.ownerRoleKey || "admin").toLowerCase(),
    manifest: manifestInput,
    composition,
  });
}

function stableProvisioningShape(request) {
  return {
    verticalId: request.verticalId,
    businessName: request.businessName,
    businessSlug: request.businessSlug,
    status: request.status,
    locale: request.locale,
    timezone: request.timezone,
    currency: request.currency,
    primaryLocation: request.primaryLocation,
    domains: [request.primaryDomain, request.appDomain].filter(Boolean).sort(),
    ownerUserId: request.ownerUserId,
    ownerRoleKey: request.ownerRoleKey,
    manifest: request.manifest,
  };
}

export function calculateTenantProvisioningFingerprint(request) {
  return createHash("sha256")
    .update(JSON.stringify(stableProvisioningShape(request)))
    .digest("hex");
}

function sameId(a, b) {
  return cleanString(a).toLowerCase() === cleanString(b).toLowerCase();
}

export function buildTenantProvisioningPlan({ request: input, snapshot = {} } = {}) {
  const request = normaliseTenantProvisioningRequest(input);
  const businesses = Array.isArray(snapshot.businesses) ? snapshot.businesses : [];
  const locations = Array.isArray(snapshot.locations) ? snapshot.locations : [];
  const domains = Array.isArray(snapshot.domains) ? snapshot.domains : [];
  const memberships = Array.isArray(snapshot.memberships) ? snapshot.memberships : [];
  const manifests = Array.isArray(snapshot.manifests) ? snapshot.manifests : [];
  const users = Array.isArray(snapshot.users) ? snapshot.users : [];
  const blockers = [];
  const operations = [];

  const business = businesses.find(
    (item) => cleanString(item.slug).toLowerCase() === request.businessSlug
  );

  if (business && cleanString(business.businessType).toLowerCase() !== request.verticalId) {
    blockers.push({ type: "business-slug-conflict" });
  }

  const businessId = business?._id ? cleanString(business._id) : "";

  for (const host of [request.primaryDomain, request.appDomain].filter(Boolean)) {
    const existing = domains.find(
      (item) => cleanString(item.host).toLowerCase() === host
    );
    if (existing && (!businessId || !sameId(existing.business, businessId))) {
      blockers.push({ type: "domain-collision", host });
    }
  }

  if (request.ownerUserId && !users.some((item) => sameId(item._id, request.ownerUserId))) {
    blockers.push({ type: "owner-user-not-found" });
  }

  if (!business) {
    operations.push({
      type: "create-business",
      key: request.businessSlug,
    });
  }

  const matchingLocation = businessId
    ? locations.find(
        (item) =>
          sameId(item.business, businessId) &&
          cleanString(item.slug).toLowerCase() === request.primaryLocation.slug
      )
    : null;

  if (!matchingLocation) {
    operations.push({
      type: "create-location",
      key: request.primaryLocation.slug,
    });
  }

  for (const [host, role] of [
    [request.primaryDomain, "primary"],
    [request.appDomain, "app-subdomain"],
  ]) {
    if (!host) continue;
    const existing = domains.find(
      (item) => cleanString(item.host).toLowerCase() === host
    );
    if (!existing) {
      operations.push({ type: "create-domain", key: host, role, status: "pending" });
    }
  }

  if (request.ownerUserId) {
    const membership = businessId
      ? memberships.find(
          (item) =>
            sameId(item.business, businessId) &&
            sameId(item.user, request.ownerUserId)
        )
      : null;
    if (!membership) {
      operations.push({ type: "create-owner-membership", key: request.ownerUserId });
    }
  }

  const manifestExists = businessId
    ? manifests.some((item) => sameId(item.business, businessId))
    : false;
  if (!manifestExists) {
    operations.push({ type: "create-product-manifest", key: "1" });
  }

  const fingerprint = calculateTenantProvisioningFingerprint(request);

  return Object.freeze({
    readOnly: true,
    writesPerformed: false,
    executable: blockers.length === 0,
    idempotentNoop: blockers.length === 0 && operations.length === 0,
    fingerprint,
    request,
    blockers: Object.freeze(blockers),
    operations: Object.freeze(operations),
    operationCount: operations.length,
    report: Object.freeze({
      business: business ? "reuse" : "create",
      location: matchingLocation ? "reuse" : "create",
      domainCount: [request.primaryDomain, request.appDomain].filter(Boolean).length,
      ownerMembershipRequested: Boolean(request.ownerUserId),
      manifestRequested: !manifestExists,
      dnsMutation: false,
      providerMutation: false,
      sourceCodeGeneration: false,
    }),
  });
}

export function assertTenantProvisioningApplyAuthorization({
  args = [],
  environment = {},
  actualFingerprint,
} = {}) {
  if (!Array.isArray(args) || !args.includes("--apply")) {
    throw provisioningError(
      "Generic tenant provisioning requires explicit --apply.",
      "TENANT_PROVISIONING_APPLY_REQUIRED"
    );
  }
  if (
    cleanString(environment.TENANT_PROVISIONING_CONFIRM) !==
    TENANT_PROVISIONING_CONFIRMATION
  ) {
    throw provisioningError(
      `TENANT_PROVISIONING_CONFIRM must equal ${TENANT_PROVISIONING_CONFIRMATION}.`,
      "TENANT_PROVISIONING_CONFIRMATION_REQUIRED"
    );
  }
  const supplied = cleanString(
    environment.TENANT_PROVISIONING_PLAN_FINGERPRINT
  ).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) {
    throw provisioningError(
      "TENANT_PROVISIONING_PLAN_FINGERPRINT must be the reviewed SHA-256 fingerprint.",
      "TENANT_PROVISIONING_FINGERPRINT_REQUIRED"
    );
  }
  if (supplied !== cleanString(actualFingerprint).toLowerCase()) {
    throw provisioningError(
      "Reviewed tenant provisioning fingerprint no longer matches the current plan.",
      "TENANT_PROVISIONING_FINGERPRINT_MISMATCH"
    );
  }
  return true;
}
