import mongoose from "mongoose";

import MarketingDataSource from "../../models/MarketingDataSource.js";
import MarketingNormalisedRecord from "../../models/MarketingNormalisedRecord.js";
import { createServiceError } from "../../shared/serviceError.js";
import { resolveDataConnectionFieldProfile } from "./dataConnectionFieldProfiles.js";

const MAX_RECORDS = 10_000;

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function number(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function valueFor(record, field) {
  for (const container of [record.metrics, record.dimensions, record.attributes]) {
    if (container && Object.prototype.hasOwnProperty.call(container, field)) return container[field];
  }
  return null;
}

function aggregate(records, definition) {
  const values = records
    .map((record) => valueFor(record, definition.field))
    .filter((value) => value !== null && value !== undefined && value !== "");
  if (definition.aggregate === "distinct") return new Set(values.map(String)).size;
  const numbers = values.map(number).filter((value) => value !== null);
  if (!numbers.length) return 0;
  if (definition.aggregate === "avg") {
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }
  return numbers.reduce((sum, value) => sum + value, 0);
}

export async function sellerKpiSummary(
  sourceId,
  { profileKey = "" } = {},
  { businessId, locationId } = {}
) {
  objectId(sourceId, "source");
  objectId(businessId, "business");
  objectId(locationId, "location");

  const source = await MarketingDataSource.findOne({
    _id: sourceId,
    business: businessId,
    location: locationId,
    provider: "generic",
    "sourceConfig.managedBy": "aiibp_data_connections",
  }).lean();
  if (!source) throw createServiceError("Seller source was not found for this location.", 404);

  const productKey = String(source.sourceConfig?.dataConnectionProductKey || "");
  const profile = resolveDataConnectionFieldProfile(
    productKey,
    profileKey || source.sourceConfig?.profileKey || ""
  );
  if (!profile) {
    throw createServiceError("No seller KPI profile is available for this connector.", 409, {
      code: "SELLER_PROFILE_NOT_AVAILABLE",
    });
  }

  const records = await MarketingNormalisedRecord.find({
    business: businessId,
    location: locationId,
    source: source._id,
  })
    .sort({ occurredAt: -1, _id: -1 })
    .limit(MAX_RECORDS)
    .select("metrics dimensions attributes occurredAt externalId")
    .lean();

  return {
    sourceId: source._id,
    productKey,
    profile: { key: profile.key, label: profile.label },
    recordsConsidered: records.length,
    truncated: records.length >= MAX_RECORDS,
    kpis: profile.kpis.map((definition) => ({
      key: definition.key,
      label: definition.label,
      aggregate: definition.aggregate,
      field: definition.field,
      value: aggregate(records, definition),
    })),
    lastRecordAt: records[0]?.occurredAt || null,
  };
}

export default { sellerKpiSummary };
