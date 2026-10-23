import { createHash } from "node:crypto";
import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import AuditLog from "../../models/AuditLog.js";
import BenchmarkCohortSnapshot from "../../models/BenchmarkCohortSnapshot.js";
import BenchmarkMetricContribution from "../../models/BenchmarkMetricContribution.js";
import BenchmarkParticipation from "../../models/BenchmarkParticipation.js";
import Business from "../../models/Business.js";
import {
  BENCHMARK_METRIC_CATALOGUE_VERSION,
  BENCHMARK_METRIC_KEYS,
  BENCHMARK_PRIVACY_POLICY,
  benchmarkMetricDefinition,
  normaliseBenchmarkMetricKeys,
} from "./benchmarkMetricCatalogue.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated benchmark operator is required.", 401);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function clampMetric(key, value) {
  const definition = benchmarkMetricDefinition(key);
  if (!definition) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return round(
    Math.max(definition.minimum, Math.min(definition.maximum, number)),
    definition.decimals
  );
}

function previousUtcMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

function parseCompletedMonth(value) {
  const defaultStart = previousUtcMonth();
  const raw = text(value);
  let start = defaultStart;
  if (raw) {
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!match) {
      throw createServiceError("period must use YYYY-MM.", 400, { field: "period" });
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      throw createServiceError("period month is invalid.", 400, { field: "period" });
    }
    start = new Date(Date.UTC(year, month - 1, 1));
  }

  const currentMonth = new Date();
  const currentStart = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)
  );
  if (start >= currentStart) {
    throw createServiceError(
      "Benchmark contributions use completed calendar months only.",
      409,
      { code: "BENCHMARK_PERIOD_NOT_COMPLETE" }
    );
  }
  const oldest = new Date(
    Date.UTC(
      currentStart.getUTCFullYear(),
      currentStart.getUTCMonth() - BENCHMARK_PRIVACY_POLICY.maximumLookbackMonths,
      1
    )
  );
  if (start < oldest) {
    throw createServiceError(
      `Benchmark period must be within the last ${BENCHMARK_PRIVACY_POLICY.maximumLookbackMonths} completed months.`,
      400,
      { field: "period" }
    );
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return {
    start,
    end,
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

function cohortKey({ vertical, currency }) {
  return `v1|vertical=${String(vertical).toLowerCase()}|currency=${String(currency).toUpperCase()}`;
}

async function businessCohort(businessId) {
  objectId(businessId, "business");
  const business = assertFound(
    await Business.findOne({
      _id: businessId,
      status: { $in: ["trial", "active"] },
    })
      .select("businessType settings.currency status")
      .lean(),
    "Active Business not found for benchmarking."
  );
  const vertical = text(business.businessType).toLowerCase();
  const currency = text(business.settings?.currency || "GBP").toUpperCase();
  return Object.freeze({
    vertical,
    currency,
    cohortKey: cohortKey({ vertical, currency }),
  });
}

async function latestParticipation(businessId) {
  return BenchmarkParticipation.findOne({ business: businessId })
    .sort({ recordedAt: -1, _id: -1 })
    .lean();
}

async function requireActiveParticipation(businessId) {
  const participation = await latestParticipation(businessId);
  if (!participation || participation.granted !== true) {
    throw createServiceError(
      "This Business has not opted in to aggregate benchmark participation.",
      403,
      { code: "BENCHMARK_PARTICIPATION_REQUIRED" }
    );
  }
  return participation;
}

function participantCountBand(count) {
  if (count >= 50) return "50+";
  if (count >= 30) return "30-49";
  if (count >= 20) return "20-29";
  if (count >= 15) return "15-19";
  return "10-14";
}

function percentile(sortedValues, percentileValue) {
  if (!sortedValues.length) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(percentileValue * sortedValues.length) - 1)
  );
  return sortedValues[index];
}

function metricStatistics(key, values) {
  const definition = benchmarkMetricDefinition(key);
  const sorted = values
    .map((value) => clampMetric(key, value))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  if (sorted.length < BENCHMARK_PRIVACY_POLICY.minimumCohortTenants) return null;
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return {
    key,
    mean: round(mean, definition.decimals),
    median: round(median, definition.decimals),
    p25: round(percentile(sorted, 0.25), definition.decimals),
    p75: round(percentile(sorted, 0.75), definition.decimals),
  };
}

async function aggregateAppointmentMetrics(businessId, period) {
  const rows = await Appointment.aggregate([
    {
      $match: {
        business: new mongoose.Types.ObjectId(businessId),
        $or: [
          { startsAt: { $gte: period.start, $lt: period.end } },
          { appointmentDate: { $gte: period.start, $lt: period.end } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        noShow: {
          $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        completedValue: {
          $sum: {
            $cond: [
              { $eq: ["$status", "completed"] },
              { $ifNull: ["$finalPrice", { $ifNull: ["$totalPrice", 0] }] },
              0,
            ],
          },
        },
      },
    },
  ]);
  const row = rows[0] || {
    total: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    completedValue: 0,
  };
  const total = Number(row.total || 0);
  const completed = Number(row.completed || 0);
  return {
    sourceSampleSize: total,
    values: {
      "appointment.completion_rate_pct":
        total > 0 ? (completed / total) * 100 : 0,
      "appointment.no_show_rate_pct":
        total > 0 ? (Number(row.noShow || 0) / total) * 100 : 0,
      "appointment.cancellation_rate_pct":
        total > 0 ? (Number(row.cancelled || 0) / total) * 100 : 0,
      "appointment.average_completed_value":
        completed > 0 ? Number(row.completedValue || 0) / completed : 0,
    },
  };
}

async function audit({ user, action, resourceType, resourceId, requestId, before, after, metadata }) {
  return AuditLog.create({
    actor: actorId(user),
    action,
    resourceType,
    resourceId: String(resourceId || "benchmark"),
    requestId: text(requestId),
    before: before || null,
    after: after || null,
    metadata: metadata || {},
  });
}

export async function getBenchmarkParticipation({ businessId } = {}) {
  objectId(businessId, "business");
  const current = await latestParticipation(businessId);
  return {
    current,
    privacyPolicy: BENCHMARK_PRIVACY_POLICY,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
    availableMetrics: BENCHMARK_METRIC_KEYS.map((key) => benchmarkMetricDefinition(key)),
  };
}

export async function recordBenchmarkParticipation(
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  const granted = payload.granted === true;
  if (typeof payload.granted !== "boolean") {
    throw createServiceError("granted must be a boolean.", 400, { field: "granted" });
  }
  if (granted && payload.noticeAcknowledged !== true) {
    throw createServiceError(
      "Explicit benchmark privacy notice acknowledgement is required before opt-in.",
      400,
      { field: "noticeAcknowledged" }
    );
  }
  const policyVersion = text(payload.policyVersion);
  if (policyVersion !== BENCHMARK_PRIVACY_POLICY.version) {
    throw createServiceError(
      `policyVersion must be ${BENCHMARK_PRIVACY_POLICY.version}.`,
      409,
      { code: "BENCHMARK_PRIVACY_NOTICE_VERSION_REQUIRED" }
    );
  }
  const previous = await latestParticipation(businessId);
  const allowedMetricKeys = granted
    ? normaliseBenchmarkMetricKeys(payload.allowedMetricKeys)
    : [];
  const participation = await BenchmarkParticipation.create({
    business: businessId,
    granted,
    policyVersion,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
    allowedMetricKeys,
    purpose: "aggregate_benchmarking",
    noticeAcknowledged: granted ? true : payload.noticeAcknowledged === true,
    recordedBy: actorId(user),
    recordedAt: new Date(),
    supersedes: previous?._id || null,
    metadata: {
      trainingUseAllowed: false,
      advertisingUseAllowed: false,
      rawOperationalRowsStored: false,
      withdrawalEffect:
        "Future contributions stop; unpublished tenant contribution rows are removed. Previously published aggregate snapshots cannot identify or be reversed to a tenant.",
    },
  });

  if (!granted) {
    await BenchmarkMetricContribution.deleteMany({ business: businessId });
  }
  await audit({
    user,
    action: granted ? "benchmark.participation_granted" : "benchmark.participation_withdrawn",
    resourceType: "BenchmarkParticipation",
    resourceId: participation._id,
    requestId,
    before: previous
      ? {
          granted: previous.granted,
          policyVersion: previous.policyVersion,
          allowedMetricKeys: previous.allowedMetricKeys,
        }
      : null,
    after: {
      granted,
      policyVersion,
      allowedMetricKeys,
    },
    metadata: {
      businessId: String(businessId),
      rawDataPooled: false,
      modelTrainingUse: false,
    },
  });
  return participation.toObject();
}

export async function refreshBenchmarkContribution(
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  const participation = await requireActiveParticipation(businessId);
  const period = parseCompletedMonth(payload.period);
  const cohort = await businessCohort(businessId);
  const aggregate = await aggregateAppointmentMetrics(businessId, period);
  if (aggregate.sourceSampleSize < BENCHMARK_PRIVACY_POLICY.minimumTenantSample) {
    throw createServiceError(
      `At least ${BENCHMARK_PRIVACY_POLICY.minimumTenantSample} tenant-owned appointments are required for a monthly benchmark contribution.`,
      409,
      { code: "BENCHMARK_TENANT_SAMPLE_TOO_SMALL" }
    );
  }

  const allowedMetricKeys = normaliseBenchmarkMetricKeys(participation.allowedMetricKeys);
  const metrics = allowedMetricKeys.map((key) => ({
    key,
    value: clampMetric(key, aggregate.values[key]),
  }));
  const fingerprint = sha256(
    JSON.stringify({
      businessId: String(businessId),
      cohortKey: cohort.cohortKey,
      period: period.key,
      catalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
      sourceSampleSize: aggregate.sourceSampleSize,
      metrics,
    })
  );
  const contribution = await BenchmarkMetricContribution.findOneAndUpdate(
    {
      business: businessId,
      periodStart: period.start,
      cohortKey: cohort.cohortKey,
      metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
    },
    {
      $set: {
        participation: participation._id,
        cohortDimensions: {
          vertical: cohort.vertical,
          currency: cohort.currency,
        },
        periodEnd: period.end,
        sourceSampleSize: aggregate.sourceSampleSize,
        metrics,
        contributionFingerprint: fingerprint,
        generatedAt: new Date(),
        metadata: {
          aggregateOnly: true,
          rawOperationalRowsStored: false,
          trainingUseAllowed: false,
        },
      },
      $setOnInsert: {
        business: businessId,
        periodStart: period.start,
        cohortKey: cohort.cohortKey,
        metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );
  await audit({
    user,
    action: "benchmark.contribution_refreshed",
    resourceType: "BenchmarkMetricContribution",
    resourceId: contribution._id,
    requestId,
    after: {
      period: period.key,
      sourceSampleSize: aggregate.sourceSampleSize,
      metricKeys: metrics.map((item) => item.key),
    },
    metadata: {
      businessId: String(businessId),
      aggregateOnly: true,
      crossTenantExposure: false,
    },
  });
  return contribution.toObject();
}

export async function getOwnBenchmarkContribution(
  query = {},
  { businessId } = {}
) {
  objectId(businessId, "business");
  await requireActiveParticipation(businessId);
  const period = parseCompletedMonth(query.period);
  return BenchmarkMetricContribution.findOne({
    business: businessId,
    periodStart: period.start,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
  }).lean();
}

function publicSnapshot(snapshot, suppressedMetricKeys = []) {
  if (!snapshot) return null;
  return Object.freeze({
    cohortDimensions: snapshot.cohortDimensions,
    metricCatalogueVersion: snapshot.metricCatalogueVersion,
    privacyPolicyVersion: snapshot.privacyPolicyVersion,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    participantCountBand: snapshot.participantCountBand,
    metrics: snapshot.metrics,
    suppressedMetricKeys,
    disclosureControls: snapshot.disclosureControls,
    differentialPrivacyApplied: false,
    generatedAt: snapshot.generatedAt,
    privacyNotice:
      "Published results contain cohort statistics only. Tenant identities, raw operational rows and individual extrema are not exposed.",
  });
}

export async function getBenchmarkCohort(
  query = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(businessId, "business");
  const participation = await requireActiveParticipation(businessId);
  const period = parseCompletedMonth(query.period);
  const cohort = await businessCohort(businessId);
  const ownContribution = await BenchmarkMetricContribution.exists({
    business: businessId,
    cohortKey: cohort.cohortKey,
    periodStart: period.start,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
  });
  if (!ownContribution) {
    throw createServiceError(
      "Refresh this Business's aggregate contribution for the selected period before viewing the cohort benchmark.",
      409,
      { code: "BENCHMARK_RECIPROCITY_CONTRIBUTION_REQUIRED" }
    );
  }

  const contributions = await BenchmarkMetricContribution.find({
    cohortKey: cohort.cohortKey,
    periodStart: period.start,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
  })
    .select("-business -participation -metadata")
    .lean();

  if (contributions.length < BENCHMARK_PRIVACY_POLICY.minimumCohortTenants) {
    return {
      suppressed: true,
      reason: "minimum-cohort-size",
      minimumCohortTenants: BENCHMARK_PRIVACY_POLICY.minimumCohortTenants,
      cohortDimensions: {
        vertical: cohort.vertical,
        currency: cohort.currency,
      },
      periodStart: period.start,
      periodEnd: period.end,
      metrics: [],
      differentialPrivacyApplied: false,
    };
  }

  const allowedMetricKeys = normaliseBenchmarkMetricKeys(participation.allowedMetricKeys);
  const statistics = [];
  const suppressedMetricKeys = [];
  for (const key of allowedMetricKeys) {
    const values = contributions
      .map((contribution) =>
        (contribution.metrics || []).find((metric) => metric.key === key)?.value
      )
      .filter((value) => Number.isFinite(Number(value)));
    const statistic = metricStatistics(key, values);
    if (statistic) statistics.push(statistic);
    else suppressedMetricKeys.push(key);
  }

  const sourceFingerprint = sha256(
    contributions
      .map((item) => item.contributionFingerprint)
      .filter(Boolean)
      .sort()
      .join("|")
  );
  let snapshot = await BenchmarkCohortSnapshot.findOne({
    cohortKey: cohort.cohortKey,
    periodStart: period.start,
    metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
    sourceFingerprint,
  }).lean();
  if (!snapshot) {
    const created = await BenchmarkCohortSnapshot.create({
      cohortKey: cohort.cohortKey,
      cohortDimensions: {
        vertical: cohort.vertical,
        currency: cohort.currency,
      },
      metricCatalogueVersion: BENCHMARK_METRIC_CATALOGUE_VERSION,
      privacyPolicyVersion: BENCHMARK_PRIVACY_POLICY.version,
      periodStart: period.start,
      periodEnd: period.end,
      participantCount: contributions.length,
      participantCountBand: participantCountBand(contributions.length),
      metrics: statistics,
      sourceFingerprint,
      disclosureControls: [...BENCHMARK_PRIVACY_POLICY.disclosureControls],
      differentialPrivacyApplied: false,
      generatedAt: new Date(),
      metadata: {
        tenantIdentifiersStored: false,
        rawRowsStored: false,
        exactExtremaPublished: false,
        modelTrainingUseAllowed: false,
      },
    });
    snapshot = created.toObject();
  }

  await audit({
    user,
    action: "benchmark.cohort_accessed",
    resourceType: "BenchmarkCohortSnapshot",
    resourceId: snapshot._id,
    requestId,
    after: {
      period: period.key,
      participantCountBand: snapshot.participantCountBand,
      metricKeys: snapshot.metrics.map((item) => item.key),
    },
    metadata: {
      businessId: String(businessId),
      crossTenantIdentifiersReturned: false,
    },
  });
  return {
    suppressed: false,
    ...publicSnapshot(snapshot, suppressedMetricKeys),
  };
}

export default {
  getBenchmarkCohort,
  getBenchmarkParticipation,
  getOwnBenchmarkContribution,
  recordBenchmarkParticipation,
  refreshBenchmarkContribution,
};
