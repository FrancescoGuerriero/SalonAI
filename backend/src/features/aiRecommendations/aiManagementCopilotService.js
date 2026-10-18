import Appointment from "../../models/Appointment.js";
import { generateManagementCopilotBrief } from "../../services/aiMicroserviceClient.js";
import {
  APPOINTMENT_METRIC_PROJECTION,
  buildCanonicalMetricPeriod,
  calculateAppointmentMetricComparison,
} from "../analytics/appointmentMetricCalculator.js";
import {
  buildAiTenantFilter,
} from "../aiPlatform/aiTenantScope.js";

function metricValue(metrics, key) {
  return (
    metrics.find((metric) => metric.key === key)?.value ?? 0
  );
}

function toAiManagementCopilotRequest(payload) {
  return {
    as_of_date: payload.as_of_date,
    period_label: payload.period_label,
    metrics: (payload.metrics || []).map((metric) => ({
      key: metric.key,
      label: metric.label,
      value: metric.value,
      previous_value: metric.previous_value,
      unit: metric.unit,
      area: metric.area,
    })),
    issues: payload.issues || [],
    include_action_plan: payload.include_action_plan,
  };
}

export async function buildManagementCopilotPayload(
  options = {}
) {
  const {
    scope,
    filter: tenantFilter,
  } = buildAiTenantFilter(options);
  const period = buildCanonicalMetricPeriod({
    periodDays: options.periodDays,
    asOfDate: options.asOfDate,
  });

  const rows = await Appointment.find({
    ...tenantFilter,
    $or: [
      {
        startsAt: {
          $gte: period.previousStart,
          $lte: period.currentEnd,
        },
      },
      {
        appointmentDate: {
          $gte: period.previousStart,
          $lte: period.currentEnd,
        },
      },
    ],
  })
    .select(APPOINTMENT_METRIC_PROJECTION)
    .lean()
    .exec();

  const comparison = calculateAppointmentMetricComparison({
    rows,
    period,
  });
  const metrics = comparison.metrics;
  const noShowRate = metricValue(metrics, "no-show-rate");
  const cancelRate = metricValue(metrics, "cancellation-rate");
  const issues = [];

  if (noShowRate >= 8) {
    issues.push({
      key: "no-show-rate",
      title: "No-show rate above target",
      description: `The no-show rate is ${noShowRate.toFixed(1)}%.`,
      priority: noShowRate >= 15 ? "critical" : "high",
      area: "appointments",
      impact_value:
        comparison.current.noShows *
        (comparison.current.completed
          ? comparison.current.revenue /
            comparison.current.completed
          : 0),
    });
  }

  if (cancelRate >= 15) {
    issues.push({
      key: "cancellation-rate",
      title: "Cancellation rate requires attention",
      description: `The cancellation rate is ${cancelRate.toFixed(1)}%.`,
      priority: "high",
      area: "appointments",
    });
  }

  return {
    as_of_date: period.asOfDate,
    period_label: period.periodLabel,
    time_basis: period.timeBasis,
    metrics,
    issues,
    include_action_plan: options.includeActionPlan !== false,
    scope: {
      tenantScoped: true,
      businessId: scope.businessId,
      locationId: scope.locationId,
      locationAccessMode: scope.locationAccessMode,
      authorisedLocationCount:
        scope.locationAccessMode === "all"
          ? null
          : scope.allowedLocationIds.length,
    },
  };
}

export async function generateManagementCopilot(
  options = {}
) {
  const payload = await buildManagementCopilotPayload(options);

  return {
    brief: await generateManagementCopilotBrief(
      toAiManagementCopilotRequest(payload),
      {
        requestId: options.requestId,
      }
    ),
    source: {
      asOfDate: payload.as_of_date,
      periodLabel: payload.period_label,
      timeBasis: payload.time_basis,
      metricCount: payload.metrics.length,
      metricDefinitions: payload.metrics.map((metric) => ({
        key: metric.key,
        version: metric.version,
      })),
      issueCount: payload.issues.length,
      aggregateOnly: true,
      tenantScoped: true,
      scope: payload.scope,
    },
  };
}

export default {
  buildManagementCopilotPayload,
  generateManagementCopilot,
};
