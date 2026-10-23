import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import IntegrationApp from "../../models/IntegrationApp.js";
import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketplaceInstallation from "../../models/MarketplaceInstallation.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

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

export async function reconcilePartnerMarketplaceInstallation(
  installationId,
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  objectId(installationId, "marketplaceInstallation");
  const actor = actorId(user);

  const installation = assertFound(
    await MarketplaceInstallation.findOne({
      _id: installationId,
      business: businessId,
    }),
    "Marketplace installation not found."
  );
  if (installation.status === "uninstalled") {
    throw createServiceError(
      "An uninstalled marketplace app cannot be reconciled as connected.",
      409,
      { code: "MARKETPLACE_INSTALLATION_UNINSTALLED" }
    );
  }

  const integrationApp = assertFound(
    await IntegrationApp.findOne({
      _id: installation.integrationApp,
      business: businessId,
    }).lean(),
    "Marketplace IntegrationApp not found in the active Business."
  );

  const connection = await IntegrationConnection.findOne({
    business: businessId,
    app: integrationApp._id,
    status: "connected",
  })
    .sort({ connectedAt: -1, updatedAt: -1, _id: -1 })
    .lean();

  const previousStatus = installation.status;
  const canonicalConnectionActive =
    integrationApp.status === "active" && Boolean(connection);
  const now = new Date();
  const existingMetadata =
    installation.metadata &&
    typeof installation.metadata === "object" &&
    !Array.isArray(installation.metadata)
      ? installation.metadata
      : {};

  if (canonicalConnectionActive) {
    installation.status = "connected";
    installation.connectedAt = installation.connectedAt || now;
    installation.metadata = {
      ...existingMetadata,
      connectionAuthority: "integration_platform",
      canonicalConnectionObserved: true,
      canonicalConnectionId: String(connection._id),
      canonicalConnectionProvider: text(connection.provider),
      canonicalConnectionStatus: connection.status,
      lastReconciledAt: now,
      reconciliationReason: "canonical_connection_connected",
    };
  } else {
    if (installation.status === "connected") {
      installation.status = "suspended";
    }
    installation.metadata = {
      ...existingMetadata,
      connectionAuthority: "integration_platform",
      canonicalConnectionObserved: false,
      canonicalConnectionId: "",
      canonicalConnectionProvider: "",
      canonicalConnectionStatus: connection?.status || "",
      lastReconciledAt: now,
      reconciliationReason:
        integrationApp.status !== "active"
          ? "integration_app_not_active"
          : "connected_integration_connection_not_found",
    };
  }

  /*
   * `connectionProvisioned` deliberately remains false. The Marketplace does
   * not provision connectors; it only observes the canonical Integration
   * Platform and mirrors connected/suspended lifecycle evidence.
   */
  await installation.save();

  await AuditLog.create({
    actor,
    action: "marketplace.installation_reconciled",
    resourceType: "MarketplaceInstallation",
    resourceId: String(installation._id),
    requestId: text(requestId),
    before: {
      status: previousStatus,
    },
    after: {
      status: installation.status,
      canonicalConnectionObserved: canonicalConnectionActive,
      integrationAppStatus: integrationApp.status,
      canonicalConnectionId: connection ? String(connection._id) : "",
    },
    metadata: {
      businessId: String(businessId),
      connectionAuthority: "integration_platform",
      connectionProvisionedByMarketplace: false,
      billingExecutionEnabled: false,
    },
  });

  return {
    installation: installation.toObject(),
    connection: connection
      ? {
          id: String(connection._id),
          provider: connection.provider,
          status: connection.status,
          connectedAt: connection.connectedAt,
        }
      : null,
    integrationApp: {
      id: String(integrationApp._id),
      key: integrationApp.key,
      status: integrationApp.status,
    },
    connectionProvisionedByMarketplace: false,
  };
}

export default {
  reconcilePartnerMarketplaceInstallation,
};
