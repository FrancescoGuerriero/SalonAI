import mongoose from "mongoose";

import MarketingNormalisedRecord from "../../models/MarketingNormalisedRecord.js";
import Campaign from "./Campaign.js";
import CampaignExecution from "./CampaignExecution.js";
import AttributionTouch from "./AttributionTouch.js";
import { createServiceError } from "../../shared/serviceError.js";

export const CAMPAIGN_CALCULATED_FIELDS = Object.freeze({
  deliveryRatePct: Object.freeze({
    formula: "delivered / attempted * 100",
    numerator: "delivered",
    denominator: "attempted",
    unit: "percent",
  }),
  clickThroughRatePct: Object.freeze({
    formula: "clicks / delivered * 100",
    numerator: "clicks",
    denominator: "delivered",
    unit: "percent",
  }),
  providerConversionRatePct: Object.freeze({
    formula: "conversions / clicks * 100",
    numerator: "conversions",
    denominator: "clicks",
    unit: "percent",
  }),
  costPerConversion: Object.freeze({
    formula: "spend / conversions",
    numerator: "spend",
    denominator: "conversions",
    unit: "currency",
  }),
  returnOnAdSpend: Object.freeze({
    formula: "revenue / spend",
    numerator: "revenue",
    denominator: "spend",
    unit: "ratio",
  }),
  attributedLeadConversionRatePct: Object.freeze({
    formula: "conversion_touches / distinct_touched_leads * 100",
    numerator: "conversionTouches",
    denominator: "distinctTouchedLeads",
    unit: "percent",
  }),
});

const NUMERIC_METRICS = Object.freeze([
  "attempted",
  "delivered",
  "failed",
  "opens",
  "clicks",
  "conversions",
  "spend",
  "revenue",
  "impressions",
  "sessions",
  "activeUsers",
]);

const IMPORTED_METRIC_ALIASES = Object.freeze({
  impressions: ["impressions"],
  clicks: ["clicks", "linkClicks"],
  conversions: ["conversions", "keyEvents", "purchases"],
  spend: ["spend", "cost", "adCost"],
  revenue: ["revenue", "purchaseRevenue", "totalRevenue"],
  sessions: ["sessions"],
  activeUsers: ["activeUsers", "users"],
});

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function objectId(value, field) {
  const candidate = value?._id || value?.id || value;
  if (!mongoose.isValidObjectId(candidate)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return candidate;
}

function locationAuthority(businessId, locationId) {
  objectId(businessId, "business");
  objectId(locationId, "location");
  return { business: businessId, location: locationId };
}

function safeDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(`${field} must be a valid date.`, 400, { field });
  }
  return parsed;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function rounded(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

function ratio(numerator, denominator, multiplier = 1) {
  const top = finite(numerator);
  const bottom = finite(denominator);
  return bottom > 0 ? rounded((top / bottom) * multiplier) : null;
}

function emptyMetrics() {
  return Object.fromEntries(NUMERIC_METRICS.map((key) => [key, 0]));
}

function addMetrics(target, source = {}) {
  for (const key of NUMERIC_METRICS) {
    target[key] += finite(source[key]);
  }
  return target;
}

function importedValue(metrics = {}, aliases = []) {
  for (const key of aliases) {
    const number = Number(metrics?.[key]);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function campaignAliases(campaign) {
  return [
    campaign.campaignKey,
    campaign.name,
    campaign.utm?.campaign,
  ]
    .map(text)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

async function campaignForBusiness(campaignId, businessId) {
  objectId(campaignId, "campaign");
  objectId(businessId, "business");
  const campaign = await Campaign.findOne({
    _id: campaignId,
    business: businessId,
  }).lean();
  if (!campaign) {
    throw createServiceError("Campaign not found in the active business.", 404);
  }
  return campaign;
}

async function importedMarketingRecords(campaign, businessId, locationId, query = {}) {
  const aliases = campaignAliases(campaign);
  if (!aliases.length) return [];

  const match = {
    business: businessId,
    location: locationId,
    $or: [
      { "dimensions.utmCampaign": { $in: aliases } },
      { "dimensions.campaign": { $in: aliases } },
      { "dimensions.campaignName": { $in: aliases } },
      { "dimensions.sessionCampaignName": { $in: aliases } },
      { "attributes.utmCampaign": { $in: aliases } },
      { "attributes.campaign": { $in: aliases } },
      { "attributes.campaignName": { $in: aliases } },
    ],
  };

  const from = safeDate(query.from, "from") || safeDate(campaign.startsAt, "startsAt");
  const to = safeDate(query.to, "to") || safeDate(campaign.endsAt, "endsAt");
  if (from || to) {
    match.occurredAt = {};
    if (from) match.occurredAt.$gte = from;
    if (to) match.occurredAt.$lte = to;
  }

  return MarketingNormalisedRecord.find(match)
    .select("metrics lineage occurredAt dimensions attributes")
    .sort({ occurredAt: 1, _id: 1 })
    .limit(Math.max(1, Math.min(10000, Number(query.marketingRecordLimit) || 5000)))
    .lean();
}

function groupExecutions(executions) {
  const byProvider = new Map();
  for (const execution of executions) {
    const provider = lower(execution.provider || "unknown");
    const current = byProvider.get(provider) || {
      provider,
      channels: new Set(),
      executions: 0,
      metrics: emptyMetrics(),
    };
    current.channels.add(lower(execution.channel || "other"));
    current.executions += 1;
    addMetrics(current.metrics, execution.metrics || {});
    byProvider.set(provider, current);
  }
  return byProvider;
}

function groupImportedRecords(records) {
  const byProvider = new Map();
  for (const record of records) {
    const provider = lower(record.lineage?.provider || "unknown");
    const current = byProvider.get(provider) || {
      provider,
      records: 0,
      metrics: emptyMetrics(),
    };
    current.records += 1;
    for (const [metric, aliases] of Object.entries(IMPORTED_METRIC_ALIASES)) {
      current.metrics[metric] += importedValue(record.metrics || {}, aliases);
    }
    byProvider.set(provider, current);
  }
  return byProvider;
}

function blendProviders(executionGroups, importedGroups) {
  const providers = new Set([
    ...executionGroups.keys(),
    ...importedGroups.keys(),
  ]);
  const rows = [];
  const totals = emptyMetrics();

  for (const provider of providers) {
    const execution = executionGroups.get(provider);
    const imported = importedGroups.get(provider);
    const metrics = emptyMetrics();
    const sourceByMetric = {};

    for (const metric of NUMERIC_METRICS) {
      const primary = finite(execution?.metrics?.[metric]);
      const supplemental = finite(imported?.metrics?.[metric]);
      if (primary !== 0 || !imported) {
        metrics[metric] = primary;
        sourceByMetric[metric] = execution ? "campaign_execution" : "none";
      } else {
        metrics[metric] = supplemental;
        sourceByMetric[metric] = supplemental !== 0
          ? "stage5_normalised_fallback"
          : "none";
      }
    }

    addMetrics(totals, metrics);
    rows.push({
      provider,
      channels: execution ? [...execution.channels].sort() : [],
      executionCount: execution?.executions || 0,
      normalisedRecordCount: imported?.records || 0,
      metrics,
      sourceByMetric,
    });
  }

  rows.sort((a, b) => a.provider.localeCompare(b.provider));
  return { rows, totals };
}

function attributionSummary(touches) {
  const leads = new Set();
  const customers = new Set();
  const opportunities = new Set();
  let conversionTouches = 0;
  const byChannel = {};

  for (const touch of touches) {
    if (touch.lead) leads.add(String(touch.lead));
    if (touch.customer) customers.add(String(touch.customer));
    if (touch.opportunity) opportunities.add(String(touch.opportunity));
    if (touch.touchType === "conversion") conversionTouches += 1;
    const channel = lower(touch.channel || "other");
    byChannel[channel] = (byChannel[channel] || 0) + 1;
  }

  return {
    touchCount: touches.length,
    distinctTouchedLeads: leads.size,
    distinctCustomers: customers.size,
    distinctOpportunities: opportunities.size,
    conversionTouches,
    byChannel,
  };
}

function calculatedFields(metrics, attribution) {
  return {
    deliveryRatePct: ratio(metrics.delivered, metrics.attempted, 100),
    clickThroughRatePct: ratio(metrics.clicks, metrics.delivered, 100),
    providerConversionRatePct: ratio(metrics.conversions, metrics.clicks, 100),
    costPerConversion: ratio(metrics.spend, metrics.conversions),
    returnOnAdSpend: ratio(metrics.revenue, metrics.spend),
    attributedLeadConversionRatePct: ratio(
      attribution.conversionTouches,
      attribution.distinctTouchedLeads,
      100
    ),
  };
}

export async function campaignPerformance(
  campaignId,
  query = {},
  {
    businessId,
    locationId,
  } = {}
) {
  locationAuthority(businessId, locationId);
  const campaign = await campaignForBusiness(campaignId, businessId);
  const [executions, touches, marketingRecords] = await Promise.all([
    CampaignExecution.find({
      business: businessId,
      location: locationId,
      campaign: campaign._id,
    })
      .select("location channel provider status metrics scheduledFor startedAt completedAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
    AttributionTouch.find({
      business: businessId,
      location: locationId,
      campaign: campaign._id,
    })
      .select("location lead customer opportunity touchType channel occurredAt")
      .sort({ occurredAt: 1, _id: 1 })
      .lean(),
    importedMarketingRecords(campaign, businessId, locationId, query),
  ]);

  const executionGroups = groupExecutions(executions);
  const importedGroups = groupImportedRecords(marketingRecords);
  const blended = blendProviders(executionGroups, importedGroups);
  const attribution = attributionSummary(touches);

  return {
    locationId: String(locationId),
    campaign: {
      id: campaign._id,
      campaignKey: campaign.campaignKey,
      name: campaign.name,
      objective: campaign.objective,
      primaryChannel: campaign.channel,
      channels: campaign.channels || [],
      utm: campaign.utm || {},
      status: campaign.status,
    },
    blendPolicy: {
      version: "1.1.0-location-owned",
      rule:
        "For the selected location, canonical CampaignExecution values are primary per provider and metric. Location-owned Stage-5 normalised marketing values are used only when that provider has no non-zero primary value for the metric; sources are never blindly summed within the same provider metric.",
      importedCampaignAliases: campaignAliases(campaign),
    },
    blended: {
      totals: blended.totals,
      providers: blended.rows,
      executionCount: executions.length,
      normalisedRecordCount: marketingRecords.length,
    },
    attribution,
    calculatedFields: calculatedFields(blended.totals, attribution),
    calculatedFieldDefinitions: CAMPAIGN_CALCULATED_FIELDS,
    lineage: {
      locationOwnershipRequired: true,
      campaignExecutionModel: "CampaignExecution",
      attributionModel: "AttributionTouch",
      importedMarketingModel: "MarketingNormalisedRecord",
    },
  };
}

export default {
  CAMPAIGN_CALCULATED_FIELDS,
  campaignPerformance,
};
