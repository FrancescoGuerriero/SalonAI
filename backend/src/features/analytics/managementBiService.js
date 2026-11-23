import crypto from "node:crypto";
import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import Location from "../../models/Location.js";
import {
  APPOINTMENT_METRIC_PROJECTION,
  buildCanonicalMetricPeriod,
  calculateAppointmentMetricComparison,
} from "./appointmentMetricCalculator.js";
import { APPOINTMENT_METRIC_KEYS, listMetricDefinitions } from "./metricCatalogue.js";

export const MANAGEMENT_BI_CONTRACT = "salonai.management-bi.v1";
export const MANAGEMENT_EVIDENCE_CONTRACT = "governed_management_evidence_v1";

function biError(message, statusCode = 400, code = "POINT10_BI_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function idText(value) {
  return value ? String(value?._id || value).trim() : "";
}

function validObjectId(value, label) {
  const text = idText(value);
  if (!mongoose.isValidObjectId(text)) {
    throw biError(`${label} is invalid.`, 400, "POINT10_INVALID_ID");
  }
  return text;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

async function resolveManagementScope(effectiveAuthority = {}, {
  locationModel = Location,
} = {}) {
  const businessId = validObjectId(effectiveAuthority.businessId, "Business authority");
  if (!["all", "selected"].includes(effectiveAuthority.locationAccessMode)) {
    throw biError("A trusted location access mode is required.", 403,
      "POINT10_LOCATION_AUTHORITY_REQUIRED");
  }
  const selectedLocationId = effectiveAuthority.locationId
    ? validObjectId(effectiveAuthority.locationId, "Selected location") : null;
  let locationIds = [];

  if (effectiveAuthority.locationAccessMode === "all") {
    const locations = await locationModel.find({
      business: businessId,
      status: { $ne: "archived" },
    })
      .select("_id business status")
      .lean();
    if (!Array.isArray(locations)) {
      throw biError("Management BI location evidence is unavailable.", 502,
        "POINT10_LOCATION_EVIDENCE_INVALID");
    }
    const seen = new Set();
    for (const location of locations) {
      const id = idText(location?._id);
      if (!mongoose.isValidObjectId(id) ||
          idText(location?.business) !== businessId ||
          !location?.status || location.status === "archived" ||
          seen.has(id)) {
        throw biError("Inconsistent business location evidence.", 502,
          "POINT10_LOCATION_EVIDENCE_INVALID");
      }
      seen.add(id);
    }
    locationIds = [...seen].sort();
    if (selectedLocationId && !seen.has(selectedLocationId)) {
      throw biError("Selected location is not part of the active business scope.", 403,
        "POINT10_LOCATION_AUTHORITY_REQUIRED");
    }
  } else {
    locationIds = [
      ...new Set(
        [
          selectedLocationId,
          ...(Array.isArray(effectiveAuthority.allowedLocationIds)
            ? effectiveAuthority.allowedLocationIds.map(idText)
            : []),
        ].filter(Boolean)
      ),
    ].sort();
    if (locationIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw biError("Invalid authorised location evidence.", 403,
        "POINT10_LOCATION_AUTHORITY_REQUIRED");
    }
  }

  if (!locationIds.length) {
    throw biError(
      "At least one authorised location is required for management BI.",
      403,
      "POINT10_LOCATION_AUTHORITY_REQUIRED"
    );
  }

  return Object.freeze({
    businessId,
    scopeMode:
      effectiveAuthority.locationAccessMode === "all"
        ? "business-authorised-locations"
        : "selected-authorised-locations",
    selectedLocationId,
    locationIds: Object.freeze(locationIds),
  });
}

function appointmentWindowFilter(period) {
  return {
    $or: [
      { startsAt: { $gte: period.previousStart, $lte: period.currentEnd } },
      {
        startsAt: null,
        appointmentDate: { $gte: period.previousStart, $lte: period.currentEnd },
      },
    ],
  };
}

function metricTrend(metric) {
  const current = Number(metric.value || 0);
  const previous = Number(metric.previous_value || 0);
  const delta = current - previous;
  const percentChange = previous === 0 ? (current === 0 ? 0 : null) : (delta / Math.abs(previous)) * 100;
  return {
    ...metric,
    delta,
    percentChange,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

export async function buildManagementBiSnapshot({
  effectiveAuthority = {},
  periodDays = 30,
  asOfDate = new Date(),
} = {}, {
  locationModel = Location,
  appointmentModel = Appointment,
} = {}) {
  const scope = await resolveManagementScope(effectiveAuthority, { locationModel });
  const period = buildCanonicalMetricPeriod({ periodDays, asOfDate });

  const rows = await appointmentModel.find({
    business: scope.businessId,
    location: { $in: scope.locationIds },
    ...appointmentWindowFilter(period),
  })
    .select(`${APPOINTMENT_METRIC_PROJECTION} business location`)
    .lean();

  // Database predicates alone do not constitute verifiable source evidence.
  // An inconsistent returned record must not contribute to trusted BI or AI
  // evidence, even if a mocked, stale or misconfigured query returned it.
  const authorisedLocations = new Set(scope.locationIds);
  if (!Array.isArray(rows) || rows.some((row) =>
    !row || idText(row.business) !== scope.businessId ||
    !authorisedLocations.has(idText(row.location)))) {
    throw biError("Inconsistent appointment ownership evidence.", 502,
      "POINT10_APPOINTMENT_EVIDENCE_INVALID");
  }

  const comparison = calculateAppointmentMetricComparison({ rows, period });
  const metrics = comparison.metrics.map(metricTrend);
  const generatedAt = new Date().toISOString();
  const definitions = listMetricDefinitions(APPOINTMENT_METRIC_KEYS);

  const evidenceCore = {
    contract: MANAGEMENT_EVIDENCE_CONTRACT,
    businessId: scope.businessId,
    locationIds: scope.locationIds,
    scopeMode: scope.scopeMode,
    period: {
      days: period.days,
      asOfDate: period.asOfDate,
      currentStart: period.currentStart.toISOString(),
      currentEnd: period.currentEnd.toISOString(),
      previousStart: period.previousStart.toISOString(),
      previousEnd: period.previousEnd.toISOString(),
    },
    metrics: metrics.map((item) => ({
      key: item.key,
      version: item.version,
      value: item.value,
      previousValue: item.previous_value,
      unit: item.unit,
      area: item.area,
    })),
  };
  const evidenceChecksum = checksum(evidenceCore);

  return {
    contract: MANAGEMENT_BI_CONTRACT,
    contractVersion: "1.0.0",
    generatedAt,
    deterministic: true,
    modelInferenceExecuted: false,
    executionAuthorised: false,
    externalWriteAuthorised: false,
    authority: {
      businessId: scope.businessId,
      scopeMode: scope.scopeMode,
      selectedLocationId: scope.selectedLocationId,
      locationIds: scope.locationIds,
      locationOwnedFactsOnly: true,
      ambiguousLegacyLocationExcluded: true,
    },
    period: {
      days: period.days,
      asOfDate: period.asOfDate,
      label: period.periodLabel,
      timeBasis: period.timeBasis,
      currentStart: period.currentStart.toISOString(),
      currentEnd: period.currentEnd.toISOString(),
      previousStart: period.previousStart.toISOString(),
      previousEnd: period.previousEnd.toISOString(),
    },
    metrics,
    definitions,
    evidence: {
      contract: MANAGEMENT_EVIDENCE_CONTRACT,
      evidenceId: `management-bi:${evidenceChecksum.slice(0, 24)}`,
      checksum: evidenceChecksum,
      generatedAt,
      recordsMatched: rows.length,
      sourceModel: "Appointment",
      sourceOwnership: "location",
      metricDefinitionAuthority: "backend/src/features/analytics/metricCatalogue.js",
      metricCalculatorAuthority: "backend/src/features/analytics/appointmentMetricCalculator.js",
      containsCustomerPii: false,
      pythonMayRecalculateCanonicalMetrics: false,
    },
    pythonAnalysis: {
      available: Boolean(scope.selectedLocationId && scope.locationIds.length === 1),
      mode: "deterministic-statistical-baseline",
      reason:
        scope.selectedLocationId && scope.locationIds.length === 1
          ? "A single trusted Location is selected; governed Python analysis may consume this canonical evidence through the Node orchestration boundary."
          : "Business-wide management BI is available, but Python analysis remains disabled until the invocation ledger has an explicit multi-location audit contract.",
      directFrontendAccessAllowed: false,
      modelInferenceAuthorised: false,
    },
  };
}

export default { buildManagementBiSnapshot };
