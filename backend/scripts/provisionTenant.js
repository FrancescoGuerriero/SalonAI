import "dotenv/config";

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import Business from "../src/models/Business.js";
import BusinessDomain from "../src/models/BusinessDomain.js";
import BusinessMembership from "../src/models/BusinessMembership.js";
import Location from "../src/models/Location.js";
import TenantProductManifest from "../src/models/TenantProductManifest.js";
import User from "../src/models/user.js";
import {
  assertTenantProvisioningApplyAuthorization,
  buildTenantProvisioningPlan,
} from "../src/platform/tenancy/genericTenantProvisioning.js";

function mongoUri(environment = process.env) {
  const uri = String(environment.MONGODB_URI || environment.MONGO_URI || "").trim();
  if (!uri) throw new Error("MONGODB_URI is required for tenant provisioning.");
  return uri;
}

function requestFromEnvironment(environment = process.env) {
  const raw = String(environment.TENANT_PROVISIONING_REQUEST_JSON || "").trim();
  if (!raw) {
    throw new Error(
      "TENANT_PROVISIONING_REQUEST_JSON is required. Supply the reviewed provisioning request as JSON."
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TENANT_PROVISIONING_REQUEST_JSON must contain valid JSON.");
  }
  return parsed;
}

async function queryWithSession(query, session) {
  return session ? query.session(session).lean() : query.lean();
}

async function loadSnapshot(request, session = null) {
  const hosts = [request.primaryDomain, request.appDomain].filter(Boolean);
  const ownerIds = request.ownerUserId ? [request.ownerUserId] : [];

  const businesses = await queryWithSession(
    Business.find({ slug: request.businessSlug }).select("_id name slug businessType status"),
    session
  );
  const businessIds = businesses.map((item) => item._id);

  const [locations, domains, memberships, manifests, users] = await Promise.all([
    queryWithSession(
      Location.find({
        $or: [
          ...(businessIds.length ? [{ business: { $in: businessIds } }] : []),
          { slug: request.primaryLocation.slug },
        ],
      }).select("_id business name slug status"),
      session
    ),
    queryWithSession(
      BusinessDomain.find({ host: { $in: hosts } }).select(
        "_id business host role status"
      ),
      session
    ),
    ownerIds.length
      ? queryWithSession(
          BusinessMembership.find({
            user: { $in: ownerIds },
            ...(businessIds.length ? { business: { $in: businessIds } } : {}),
          }).select("_id business user roleKey status locationAccessMode"),
          session
        )
      : [],
    businessIds.length
      ? queryWithSession(
          TenantProductManifest.find({ business: { $in: businessIds } })
            .sort({ manifestRevision: -1 })
            .select("_id business verticalId manifestRevision status manifestHash"),
          session
        )
      : [],
    ownerIds.length
      ? queryWithSession(User.find({ _id: { $in: ownerIds } }).select("_id"), session)
      : [],
  ]);

  return { businesses, locations, domains, memberships, manifests, users };
}

function sanitisedPlan(plan) {
  return {
    readOnly: true,
    writesPerformed: false,
    executable: plan.executable,
    idempotentNoop: plan.idempotentNoop,
    fingerprint: plan.fingerprint,
    operationCount: plan.operationCount,
    operationTypes: plan.operations.map((item) => item.type),
    blockerTypes: plan.blockers.map((item) => item.type),
    report: plan.report,
    identifiersIncluded: false,
    secretsIncluded: false,
  };
}

async function createManifest({ business, request, session }) {
  const manifest = request.manifest;
  const [created] = await TenantProductManifest.create(
    [
      {
        business: business._id,
        schemaVersion: manifest.schemaVersion,
        platformVersion: manifest.platformVersion,
        verticalId: request.verticalId,
        planKey: manifest.planKey,
        capabilityPackKeys: [...manifest.capabilityPackKeys],
        entitlementOverrides: [...manifest.entitlementOverrides],
        configurationProfile: manifest.configurationProfile,
        themeProfile: manifest.themeProfile,
        terminologyProfile: manifest.terminologyProfile,
        integrationBindings: [...manifest.integrationBindings],
        aiCapabilityKeys: [...manifest.aiCapabilityKeys],
        workflowPackKeys: [...manifest.workflowPackKeys],
        dataPolicyProfile: manifest.dataPolicyProfile,
        approvedExtensionKeys: [...manifest.approvedExtensionKeys],
        deploymentProfile: manifest.deploymentProfile,
        manifestRevision: Number(manifest.manifestRevision),
        status: manifest.status,
        effectiveFrom: manifest.effectiveFrom ? new Date(manifest.effectiveFrom) : null,
      },
    ],
    { session }
  );
  return created;
}

async function applyProvisioning({ request, reviewedPlan, session }) {
  const currentSnapshot = await loadSnapshot(request, session);
  const currentPlan = buildTenantProvisioningPlan({ request, snapshot: currentSnapshot });

  if (!currentPlan.executable) {
    throw new Error("Tenant provisioning became blocked before apply. Transaction aborted.");
  }
  if (currentPlan.fingerprint !== reviewedPlan.fingerprint) {
    throw new Error(
      "Tenant provisioning state changed after plan review. Transaction aborted; generate a new plan fingerprint."
    );
  }

  let business = currentSnapshot.businesses[0] || null;
  if (!business) {
    [business] = await Business.create(
      [
        {
          name: request.businessName,
          slug: request.businessSlug,
          businessType: request.verticalId,
          status: request.status,
          settings: {
            locale: request.locale,
            timezone: request.timezone,
            currency: request.currency,
          },
        },
      ],
      { session }
    );
  }

  let location = await queryWithSession(
    Location.findOne({
      business: business._id,
      slug: request.primaryLocation.slug,
    }).select("_id business name slug"),
    session
  );
  if (!location) {
    [location] = await Location.create(
      [
        {
          business: business._id,
          name: request.primaryLocation.name,
          slug: request.primaryLocation.slug,
          status: "active",
        },
      ],
      { session }
    );
  }

  for (const [host, role] of [
    [request.primaryDomain, "primary"],
    [request.appDomain, "app-subdomain"],
  ]) {
    if (!host) continue;
    const existing = await queryWithSession(
      BusinessDomain.findOne({ host }).select("_id business host role status"),
      session
    );
    if (!existing) {
      await BusinessDomain.create(
        [
          {
            business: business._id,
            host,
            role,
            status: "pending",
            verification: { method: "manual" },
          },
        ],
        { session }
      );
    }
  }

  if (request.ownerUserId) {
    const membership = await queryWithSession(
      BusinessMembership.findOne({
        user: request.ownerUserId,
        business: business._id,
      }).select("_id"),
      session
    );
    if (!membership) {
      await BusinessMembership.create(
        [
          {
            user: request.ownerUserId,
            business: business._id,
            status: "active",
            roleKey: request.ownerRoleKey,
            locationAccessMode: "all",
            locations: [],
            isDefault: false,
          },
        ],
        { session }
      );
    }
  }

  const manifest = await queryWithSession(
    TenantProductManifest.findOne({ business: business._id })
      .sort({ manifestRevision: -1 })
      .select("_id"),
    session
  );
  if (!manifest) {
    await createManifest({ business, request, session });
  }

  const postSnapshot = await loadSnapshot(request, session);
  const postPlan = buildTenantProvisioningPlan({ request, snapshot: postSnapshot });
  if (!postPlan.executable || !postPlan.idempotentNoop) {
    throw new Error(
      "Tenant provisioning postflight did not converge to an idempotent no-op. Transaction aborted."
    );
  }

  return {
    businessId: String(business._id),
    locationId: String(location._id),
    postflightNoop: true,
  };
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const rawRequest = requestFromEnvironment(environment);

  await mongoose.connect(mongoUri(environment), {
    serverSelectionTimeoutMS: 15000,
  });

  const initialRequest = buildTenantProvisioningPlan({
    request: rawRequest,
    snapshot: await loadSnapshot(
      // build once to normalize/validate before querying tenant-shaped records
      // without trusting any request Business id
      (await import("../src/platform/tenancy/genericTenantProvisioning.js")).normaliseTenantProvisioningRequest(rawRequest)
    ),
  });

  if (!args.includes("--apply")) {
    console.log(JSON.stringify(sanitisedPlan(initialRequest), null, 2));
    return;
  }

  if (!initialRequest.executable) {
    throw new Error("Tenant provisioning plan contains blockers and cannot be applied.");
  }

  assertTenantProvisioningApplyAuthorization({
    args,
    environment,
    actualFingerprint: initialRequest.fingerprint,
  });

  const session = await mongoose.startSession();
  let applied;
  try {
    await session.withTransaction(async () => {
      applied = await applyProvisioning({
        request: initialRequest.request,
        reviewedPlan: initialRequest,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        reviewedFingerprint: initialRequest.fingerprint,
        ...applied,
        domainsPendingVerification: true,
        dnsMutation: false,
        providerMutation: false,
        secretsIncluded: false,
      },
      null,
      2
    )
  );
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main()
    .catch((error) => {
      console.error("[FAIL] Generic tenant provisioning:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => {});
    });
}
