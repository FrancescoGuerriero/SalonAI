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

async function resolveManagementScope(effectiveAuthority = {}) {
  const businessId = validObjectId(effectiveAuthority.businessId, "Business authority");
  const selectedLocationId = idText(effectiveAuthority.locationId) || null;
  let locationIds = [];

  if (effectiveAuthority.locationAccessMode === "all") {
    const locations = await Location.find({
      business: businessId,
      status: { $ne: "archived" },
    })
      .select("_id")
      .lean();
    locationIds = locations.map((item) => idText(item._id)).filter(Boolean);
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
    ];
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
} = {}) {
  const scope = await resolveManagementScope(effectiveAuthority);
  const period = buildCanonicalMetricPeriod({ periodDays, asOfDate });

  const rows = await Appointment.find({
    business: scope.businessId,
    location: { $in: scope.locationIds },
    ...appointmentWindowFilter(period),
  })
    .select(`${APPOINTMENT_METRIC_PROJECTION} location`)
    .lean();

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
