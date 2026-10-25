import mongoose from "mongoose";

import IntegrationConnection from "../../models/IntegrationConnection.js";
import MarketingDataSource from "../../models/MarketingDataSource.js";
import { createServiceError } from "../../shared/serviceError.js";
import { marketingConnectorDefinition } from "./marketingConnectorCatalogue.js";

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  return value;
}

function actorId(actor) {
  const value = actor?._id || actor?.id || actor;
  return mongoose.isValidObjectId(value) ? value : null;
}

function sourceFields(definition) {
  return (definition.defaultFields || []).map((item) => ({
    sourceField: item.sourceField,
    label: item.label || "",
    dataType: item.dataType || "string",
    role: item.role || "attribute",
    normalisedField: item.normalisedField || "",
    required: Boolean(item.required),
    description: item.description || "",
  }));
}

export async function ensureMarketingSourceForConnection(provider, connectionId, { businessId, actor = null } = {}) {
  objectId(businessId, "business");
  objectId(connectionId, "connection");
  const connection = await IntegrationConnection.findOne({ _id: connectionId, business: businessId, provider });
  if (!connection) throw createServiceError("Marketing connection not found for source provisioning.", 404);
  if (connection.status !== "connected") throw createServiceError("Marketing source provisioning requires a configured connection.", 409);
  const definition = marketingConnectorDefinition(provider);
  const key = `marketing-${provider}`;
  const values = {
    app: connection.app,
    connection: connection._id,
    name: definition.label,
    provider,
    providerSchemaVersion: definition.schemaVersion,
    status: "ready",
    syncMode: "manual",
    schedule: { cadence: "manual", timezone: "Europe/London", nextRunAt: null },
    fieldCatalogue: sourceFields(definition),
    sourceConfig: { managedBy: "marketing_connections_ui", liveProviderExecution: false },
    normalisationConfig: { mappingVersion: "1.0.0" },
    updatedBy: actorId(actor),
  };
  return MarketingDataSource.findOneAndUpdate(
    { business: businessId, key },
    { $set: values, $setOnInsert: { business: businessId, key, createdBy: actorId(actor) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function pauseMarketingSourceForProvider(provider, { businessId, actor = null } = {}) {
  objectId(businessId, "business");
  return MarketingDataSource.findOneAndUpdate(
    { business: businessId, provider, key: `marketing-${provider}` },
    { $set: { status: "paused", updatedBy: actorId(actor), lastError: "Provider account disconnected; live execution remains disabled." } },
    { new: true }
  );
}

export default { ensureMarketingSourceForConnection, pauseMarketingSourceForProvider };
