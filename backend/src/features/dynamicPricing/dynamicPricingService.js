import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import Appointment from "../../models/Appointment.js";
import PriceRule, {
  PRICE_RULE_STATUSES,
} from "./PriceRule.js";
import PricingExperiment from "./PricingExperiment.js";
import {
  addUtcMonths,
  clampInteger,
  getAppointmentDate,
  getAppointmentValue,
  getEntityId,
  getEntityName,
  normaliseStatus,
  roundMoney,
  roundNumber,
  startOfUtcMonth,
} from "../shared/analyticsUtils.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const PROHIBITED_PERSONALISATION_KEYS = Object.freeze([
  "customer",
  "gender",
  "sex",
  "age",
  "dateofbirth",
  "dob",
  "race",
  "ethnicity",
  "religion",
  "disability",
  "health",
  "postcode",
  "zipcode",
  "nationality",
  "pregnancy",
  "marital",
  "sexual",
  "income",
  "loyalty",
  "membership",
  "vip",
  "lifetimevalue",
]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated pricing research operator is required.", 401);
  }
  return value;
}

function uniqueStrings(value, max = 50) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => text(item))
        .filter(Boolean)
        .slice(0, max)
    ),
  ];
}

function assertNoPersonalisationSignals(value, path = "rule") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalised = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      PROHIBITED_PERSONALISATION_KEYS.some((token) =>
        normalised.includes(token)
      )
    ) {
      throw createServiceError(
        `Dynamic pricing research cannot use personal/customer signal ${path}.${key}.`,
        422,
        {
          code: "PRICING_PERSONALISATION_SIGNAL_PROHIBITED",
          field: `${path}.${key}`,
        }
      );
    }
    if (child && typeof child === "object") {
      assertNoPersonalisationSignals(child, `${path}.${key}`);
    }
  }
}

function optionalNumber(value, field, min, max) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw createServiceError(`${field} must be between ${min} and ${max}.`, 400, {
      field,
    });
  }
  return parsed;
}

function normaliseConditions(value = {}) {
  assertNoPersonalisationSignals(value, "conditions");
  const weekdays = [
    ...new Set(
      (Array.isArray(value.weekdays) ? value.weekdays : [])
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ),
  ];
  const startHour = optionalNumber(value.startHour, "conditions.startHour", 0, 23);
  const endHour = optionalNumber(value.endHour, "conditions.endHour", 1, 24);
  if (startHour !== null && endHour !== null && endHour <= startHour) {
    throw createServiceError(
      "conditions.endHour must be later than conditions.startHour.",
      400,
      { field: "conditions.endHour" }
    );
  }
  const minimumDemandIndex = optionalNumber(
    value.minimumDemandIndex,
    "conditions.minimumDemandIndex",
    0,
    10
  );
  const maximumDemandIndex = optionalNumber(
    value.maximumDemandIndex,
    "conditions.maximumDemandIndex",
    0,
    10
  );
  if (
    minimumDemandIndex !== null &&
    maximumDemandIndex !== null &&
    maximumDemandIndex < minimumDemandIndex
  ) {
    throw createServiceError(
      "conditions.maximumDemandIndex must be at least minimumDemandIndex.",
      400
    );
  }
  return {
    weekdays,
    startHour,
    endHour,
    minimumDemandIndex,
    maximumDemandIndex,
    minimumCompletionRate: optionalNumber(
      value.minimumCompletionRate,
      "conditions.minimumCompletionRate",
      0,
      100
    ),
    maximumLossRate: optionalNumber(
      value.maximumLossRate,
      "conditions.maximumLossRate",
      0,
      100
    ),
  };
}

function createRecord(service) {
  return {
    serviceId: getEntityId(service) || "unassigned",
    name: getEntityName(service, "Unassigned service"),
    category: service?.category || "Other",
    listedPrice: Number(service?.price || 0),
    appointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    revenue: 0,
    weekdayCounts: Array(7).fill(0),
    hourCounts: Array(24).fill(0),
  };
}

function boundedModifier({ demandIndex, lossRate, completionRate }) {
  let modifier = 0;
  if (demandIndex >= 1.35 && completionRate >= 75) modifier += 15;
  else if (demandIndex >= 1.1) modifier += 8;
  else if (demandIndex <= 0.65) modifier -= 10;
  else if (demandIndex <= 0.85) modifier -= 5;
  if (lossRate >= 25) modifier -= 5;
  if (completionRate >= 90) modifier += 3;
  return Math.max(-15, Math.min(20, modifier));
}

export async function generateDynamicPricingRecommendations(
  { months = 6 } = {},
  { businessId } = {}
) {
  objectId(businessId, "business");
  const selectedMonths = clampInteger(months, 1, 24, 6);
  const now = new Date();
  const currentMonth = startOfUtcMonth(now);
  const startDate = addUtcMonths(currentMonth, -(selectedMonths - 1));
  const endDate = addUtcMonths(currentMonth, 1);

  const appointments = await Appointment.find({
    business: businessId,
    $or: [
      { startsAt: { $gte: startDate, $lt: endDate } },
      { appointmentDate: { $gte: startDate, $lt: endDate } },
    ],
  })
    .populate("service", "name title category price")
    .lean();

  const serviceMap = new Map();
  for (const appointment of appointments) {
    const date = getAppointmentDate(appointment);
    if (!date) continue;
    const serviceId = getEntityId(appointment.service) || "unassigned";
    if (!serviceMap.has(serviceId)) {
      serviceMap.set(serviceId, createRecord(appointment.service));
    }
    const record = serviceMap.get(serviceId);
    const status = normaliseStatus(appointment.status);
    record.appointments += 1;
    record.weekdayCounts[date.getDay()] += 1;
    record.hourCounts[date.getHours()] += 1;
    if (status === "completed") {
      record.completedAppointments += 1;
      record.revenue += getAppointmentValue(appointment);
    }
    if (status === "cancelled") record.cancelledAppointments += 1;
    if (status === "no_show") record.noShowAppointments += 1;
  }

  const averageDemand =
    serviceMap.size > 0
      ? [...serviceMap.values()].reduce(
          (total, record) => total + record.appointments,
          0
        ) / serviceMap.size
      : 0;

  const recommendations = [...serviceMap.values()]
    .map((record) => {
      const demandIndex = averageDemand > 0 ? record.appointments / averageDemand : 0;
      const lossCount = record.cancelledAppointments + record.noShowAppointments;
      const lossRate =
        record.appointments > 0 ? (lossCount / record.appointments) * 100 : 0;
      const completionRate =
        record.appointments > 0
          ? (record.completedAppointments / record.appointments) * 100
          : 0;
      const modifierPercent = boundedModifier({ demandIndex, lossRate, completionRate });
      const basePrice =
        record.listedPrice > 0
          ? record.listedPrice
          : record.completedAppointments > 0
            ? record.revenue / record.completedAppointments
            : 0;
      const suggestedPrice = basePrice * (1 + modifierPercent / 100);
      const peakWeekday = record.weekdayCounts.indexOf(Math.max(...record.weekdayCounts));
      const peakHour = record.hourCounts.indexOf(Math.max(...record.hourCounts));
      return {
        serviceId: record.serviceId,
        name: record.name,
        category: record.category,
        appointments: record.appointments,
        completedAppointments: record.completedAppointments,
        demandIndex: roundNumber(demandIndex, 2),
        completionRate: roundNumber(completionRate, 1),
        lossRate: roundNumber(lossRate, 1),
        basePrice: roundMoney(basePrice),
        modifierPercent,
        suggestedPrice: roundMoney(suggestedPrice),
        estimatedRevenueDifference: roundMoney(
          record.completedAppointments * (suggestedPrice - basePrice)
        ),
        peakWeekday,
        peakHour,
        recommendation:
          modifierPercent > 0
            ? "Test a controlled premium during high-demand periods."
            : modifierPercent < 0
              ? "Test a targeted off-peak incentive; do not reduce the permanent list price automatically."
              : "Maintain the current price and continue monitoring demand.",
      };
    })
    .sort((a, b) => b.demandIndex - a.demandIndex);

  return {
    generatedAt: now.toISOString(),
    currency: "GBP",
    period: {
      months: selectedMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    safeguards: {
      tenantScoped: true,
      minimumModifierPercent: -15,
      maximumModifierPercent: 20,
      automaticPriceChanges: false,
      customerPersonalisation: false,
      causalUpliftClaim: false,
    },
    summary: {
      serviceCount: recommendations.length,
      increaseRecommendations: recommendations.filter((item) => item.modifierPercent > 0).length,
      discountRecommendations: recommendations.filter((item) => item.modifierPercent < 0).length,
      maintainRecommendations: recommendations.filter((item) => item.modifierPercent === 0).length,
      estimatedRevenueDifference: roundMoney(
        recommendations.reduce(
          (total, item) => total + item.estimatedRevenueDifference,
          0
        )
      ),
    },
    recommendations,
  };
}

export async function createPriceRule(payload = {}, { businessId, user } = {}) {
  objectId(businessId, "business");
  const actor = actorId(user);
  assertNoPersonalisationSignals(payload, "rule");
  const name = text(payload.name);
  const customerDisclosure = text(payload.transparency?.customerDisclosure);
  const internalRationale = text(payload.transparency?.internalRationale);
  const modifierPercent = Number(payload.modifierPercent);
  if (!name) throw createServiceError("Price rule name is required.", 400);
  if (!Number.isFinite(modifierPercent) || modifierPercent < -15 || modifierPercent > 20) {
    throw createServiceError("modifierPercent must be between -15 and 20.", 400);
  }
  if (!customerDisclosure || !internalRationale) {
    throw createServiceError(
      "Customer disclosure and internal rationale are required for pricing research.",
      400
    );
  }

  return PriceRule.create({
    business: businessId,
    location: objectId(payload.location, "location", { optional: true }),
    service: objectId(payload.service, "service", { optional: true }),
    name,
    description: text(payload.description),
    status: payload.reviewReady === true ? "review_ready" : "draft",
    modifierPercent,
    conditions: normaliseConditions(payload.conditions || {}),
    transparency: { customerDisclosure, internalRationale },
    fairnessReview: {
      status: "pending",
      personalisationAllowed: false,
      productionDeploymentAllowed: false,
      evidenceRefs: [],
    },
    createdBy: actor,
    updatedBy: actor,
    metadata: payload.metadata || {},
  });
}

export async function listPriceRules(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) {
    const status = text(query.status).toLowerCase();
    if (!PRICE_RULE_STATUSES.includes(status)) {
      throw createServiceError("Unsupported price rule status.", 400);
    }
    match.status = status;
  }
  if (query.service) match.service = objectId(query.service, "service");
  return PriceRule.find(match)
    .populate("service", "name price category")
    .populate("fairnessReview.reviewedBy", "name email")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(200, Number(query.limit) || 50)))
    .lean();
}

export async function reviewPriceRule(
  ruleId,
  payload = {},
  { businessId, user, requestId = "" } = {}
) {
  objectId(ruleId, "priceRule");
  const actor = actorId(user);
  const rule = assertFound(
    await PriceRule.findOne({ _id: ruleId, business: businessId }),
    "Price rule not found."
  );
  if (["retired"].includes(rule.status)) {
    throw createServiceError("A retired price rule cannot be reviewed.", 409);
  }
  const decision = text(payload.decision).toLowerCase();
  if (!["approved", "rejected"].includes(decision)) {
    throw createServiceError("decision must be approved or rejected.", 400);
  }

  rule.fairnessReview.status = decision;
  rule.fairnessReview.reviewedBy = actor;
  rule.fairnessReview.reviewedAt = new Date();
  rule.fairnessReview.note = text(payload.note);
  rule.fairnessReview.evidenceRefs = uniqueStrings(payload.evidenceRefs);
  rule.fairnessReview.personalisationAllowed = false;
  rule.fairnessReview.productionDeploymentAllowed = false;
  rule.status = decision === "approved" ? "approved_for_experiment" : "rejected";
  rule.updatedBy = actor;
  await rule.save();

  await AuditLog.create({
    actor,
    action: "pricing_research.rule_fairness_reviewed",
    resourceType: "PriceRule",
    resourceId: String(rule._id),
    requestId: text(requestId),
    after: {
      status: rule.status,
      fairnessReview: rule.fairnessReview.status,
      productionDeploymentAllowed: false,
      personalisationAllowed: false,
    },
    metadata: { businessId: String(businessId) },
  });
  return rule.toObject();
}

function ruleMatchesRecommendation(rule, recommendation) {
  if (rule.service && String(rule.service) !== String(recommendation.serviceId)) return false;
  const conditions = rule.conditions || {};
  if (
    Array.isArray(conditions.weekdays) &&
    conditions.weekdays.length > 0 &&
    !conditions.weekdays.includes(recommendation.peakWeekday)
  ) return false;
  if (conditions.startHour !== null && conditions.startHour !== undefined) {
    if (recommendation.peakHour < Number(conditions.startHour)) return false;
  }
  if (conditions.endHour !== null && conditions.endHour !== undefined) {
    if (recommendation.peakHour >= Number(conditions.endHour)) return false;
  }
  if (
    conditions.minimumDemandIndex !== null &&
    conditions.minimumDemandIndex !== undefined &&
    recommendation.demandIndex < Number(conditions.minimumDemandIndex)
  ) return false;
  if (
    conditions.maximumDemandIndex !== null &&
    conditions.maximumDemandIndex !== undefined &&
    recommendation.demandIndex > Number(conditions.maximumDemandIndex)
  ) return false;
  if (
    conditions.minimumCompletionRate !== null &&
    conditions.minimumCompletionRate !== undefined &&
    recommendation.completionRate < Number(conditions.minimumCompletionRate)
  ) return false;
  if (
    conditions.maximumLossRate !== null &&
    conditions.maximumLossRate !== undefined &&
    recommendation.lossRate > Number(conditions.maximumLossRate)
  ) return false;
  return true;
}

export async function createPricingExperiment(
  payload = {},
  { businessId, locationId = null, user } = {}
) {
  objectId(businessId, "business");
  const actor = actorId(user);
  const name = text(payload.name);
  const hypothesis = text(payload.hypothesis);
  if (!name || !hypothesis) {
    throw createServiceError("Experiment name and hypothesis are required.", 400);
  }
  const ruleIds = [
    ...new Set(
      (Array.isArray(payload.priceRules) ? payload.priceRules : [])
        .map(String)
        .filter((id) => mongoose.isValidObjectId(id))
    ),
  ];
  if (ruleIds.length === 0) {
    throw createServiceError("At least one approved PriceRule is required.", 400);
  }
  const rules = await PriceRule.find({
    _id: { $in: ruleIds },
    business: businessId,
    status: "approved_for_experiment",
    "fairnessReview.status": "approved",
    "fairnessReview.productionDeploymentAllowed": false,
    "fairnessReview.personalisationAllowed": false,
  }).lean();
  if (rules.length !== ruleIds.length) {
    throw createServiceError(
      "Every experiment rule must belong to the active Business and have approved fairness review.",
      409
    );
  }

  return PricingExperiment.create({
    business: businessId,
    location: mongoose.isValidObjectId(locationId) ? locationId : null,
    name,
    hypothesis,
    status: "draft",
    mode: "simulation_only",
    priceRules: ruleIds,
    analysisMonths: clampInteger(payload.analysisMonths, 1, 24, 6),
    safeguards: {
      productionDeploymentAllowed: false,
      personalisationAllowed: false,
      causalUpliftClaimAllowed: false,
    },
    createdBy: actor,
    updatedBy: actor,
    metadata: payload.metadata || {},
  });
}

export async function listPricingExperiments(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.status) match.status = text(query.status).toLowerCase();
  return PricingExperiment.find(match)
    .populate("priceRules", "name modifierPercent status fairnessReview transparency")
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.max(1, Math.min(100, Number(query.limit) || 25)))
    .lean();
}

export async function runPricingExperiment(
  experimentId,
  { businessId, user, requestId = "" } = {}
) {
  objectId(experimentId, "pricingExperiment");
  const actor = actorId(user);
  const experiment = assertFound(
    await PricingExperiment.findOne({
      _id: experimentId,
      business: businessId,
      status: { $in: ["draft", "completed"] },
    }),
    "Pricing experiment not found or not runnable."
  );
  const rules = await PriceRule.find({
    _id: { $in: experiment.priceRules },
    business: businessId,
    status: "approved_for_experiment",
    "fairnessReview.status": "approved",
  }).lean();
  if (rules.length !== experiment.priceRules.length) {
    throw createServiceError("Experiment rules are no longer approved for research.", 409);
  }

  experiment.status = "running";
  experiment.startedAt = new Date();
  experiment.startedBy = actor;
  experiment.updatedBy = actor;
  await experiment.save();

  try {
    const analytics = await generateDynamicPricingRecommendations(
      { months: experiment.analysisMonths },
      { businessId }
    );
    let baselineRevenue = 0;
    let simulatedRevenue = 0;
    const rows = analytics.recommendations.map((recommendation) => {
      const matchingRules = rules.filter((rule) =>
        ruleMatchesRecommendation(rule, recommendation)
      );
      const combinedModifierPercent = Math.max(
        -15,
        Math.min(
          20,
          matchingRules.reduce(
            (sum, rule) => sum + Number(rule.modifierPercent || 0),
            0
          )
        )
      );
      const simulatedPrice =
        recommendation.basePrice * (1 + combinedModifierPercent / 100);
      const baseline = recommendation.completedAppointments * recommendation.basePrice;
      const simulated = recommendation.completedAppointments * simulatedPrice;
      baselineRevenue += baseline;
      simulatedRevenue += simulated;
      return {
        serviceId: recommendation.serviceId,
        serviceName: recommendation.name,
        completedAppointments: recommendation.completedAppointments,
        basePrice: recommendation.basePrice,
        matchingRuleIds: matchingRules.map((rule) => String(rule._id)),
        combinedModifierPercent,
        simulatedPrice: roundMoney(simulatedPrice),
        baselineRevenue: roundMoney(baseline),
        simulatedRevenue: roundMoney(simulated),
      };
    });

    experiment.status = "completed";
    experiment.completedAt = new Date();
    experiment.resultSnapshot = {
      generatedAt: experiment.completedAt,
      mode: "simulation_only",
      historicalPeriod: analytics.period,
      assumptions: [
        "Historical completed appointment volume is held constant.",
        "The result is a mechanical price sensitivity calculation, not causal uplift evidence.",
        "No customer-level or protected/personal attribute is used.",
        "No canonical Service price is changed by this experiment.",
      ],
      fairness: {
        personalisationUsed: false,
        customerDisclosureRequired: true,
        approvedRuleCount: rules.length,
      },
      metrics: {
        baselineRevenue: roundMoney(baselineRevenue),
        simulatedRevenue: roundMoney(simulatedRevenue),
        simulatedRevenueDifference: roundMoney(simulatedRevenue - baselineRevenue),
      },
      rows,
    };
    await experiment.save();

    await AuditLog.create({
      actor,
      action: "pricing_research.simulation_completed",
      resourceType: "PricingExperiment",
      resourceId: String(experiment._id),
      requestId: text(requestId),
      after: {
        status: experiment.status,
        mode: experiment.mode,
        productionDeploymentAllowed: false,
        metrics: experiment.resultSnapshot.metrics,
      },
      metadata: { businessId: String(businessId) },
    });
    return experiment.toObject();
  } catch (error) {
    experiment.status = "draft";
    experiment.updatedBy = actor;
    await experiment.save();
    throw error;
  }
}

export default {
  createPriceRule,
  createPricingExperiment,
  generateDynamicPricingRecommendations,
  listPriceRules,
  listPricingExperiments,
  reviewPriceRule,
  runPricingExperiment,
};
