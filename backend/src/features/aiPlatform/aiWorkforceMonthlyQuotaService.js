import mongoose from "mongoose";
import AiToolMonthlyUsage from "./AiToolMonthlyUsage.js";

export const A0_METRICS_QUOTA_KEY = "ai-a0-metrics-monthly";
export const A0_METRICS_TOOL_KEY = "business.metrics.read";

function reject(message, code, statusCode = 403) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

export function aiQuotaMonthStart(instant = new Date()) {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    reject("AI quota clock is invalid.", "AI_QUOTA_CLOCK_INVALID", 500);
  }
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), 1));
}

/**
 * Use a limit from the persisted subscription entitlement, never from an
 * HTTP input or a mutable AI request. Missing limits are denied rather than
 * silently granting unlimited usage.
 */
export function resolveAiMetricsMonthlyLimit(subscription) {
  const matches = subscription?.entitlementGrants?.filter(
    (grant) => grant?.key === A0_METRICS_QUOTA_KEY,
  );
  if (!Array.isArray(matches) || matches.length !== 1 ||
      !Number.isSafeInteger(matches[0].limit) ||
      matches[0].limit <= 0 || matches[0].limit > 1_000_000) {
    reject("A bounded AI monthly quota entitlement is required.",
      "AI_QUOTA_ENTITLEMENT_REQUIRED");
  }
  return matches[0].limit;
}

/**
 * Reserve one admission before creating a run or reading business data.
 * The unique business/tool/month key plus a conditional $inc prevents two
 * workers from admitting more calls than a subscription permits. The first
 * upsert is only initialization, never a free admission.
 *
 * Admission is charged even if the read subsequently fails. This is an
 * explicit, conservative anti-abuse policy, not token/model billing.
 */
export async function reserveAiMetricsMonthlyAdmission({
  businessId,
  monthlyLimit,
  now = new Date(),
} = {}, { usage = AiToolMonthlyUsage } = {}) {
  if (!mongoose.isValidObjectId(businessId) ||
      !Number.isSafeInteger(monthlyLimit) ||
      monthlyLimit < 1 || monthlyLimit > 1_000_000) {
    reject("Trusted AI quota parameters are invalid.", "AI_QUOTA_INPUT_INVALID");
  }
  const periodStart = aiQuotaMonthStart(now);
  const identity = {
    business: String(businessId),
    toolKey: A0_METRICS_TOOL_KEY,
    periodStart,
  };

  // Unique-index initialization is idempotent across concurrent requests.
  // Duplicate-key contention may mean another worker initialized the row.
  try {
    await usage.updateOne(identity, {
      $setOnInsert: { admittedCount: 0 },
    }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const result = await usage.findOneAndUpdate({
    ...identity,
    admittedCount: { $gte: 0, $lt: monthlyLimit },
  }, {
    $inc: { admittedCount: 1 },
  }, {
    new: true,
    upsert: false,
    projection: { admittedCount: 1, periodStart: 1 },
  }).lean();

  if (!result) {
    reject("Tenant AI monthly admission quota is exhausted.",
      "AI_MONTHLY_QUOTA_EXHAUSTED", 429);
  }
  if (!Number.isSafeInteger(result.admittedCount) ||
      result.admittedCount < 1 || result.admittedCount > monthlyLimit) {
    reject("AI quota admission evidence is invalid.",
      "AI_QUOTA_EVIDENCE_INVALID", 503);
  }

  return Object.freeze({
    businessId: String(businessId),
    toolKey: A0_METRICS_TOOL_KEY,
    periodStart: periodStart.toISOString(),
    admittedCount: result.admittedCount,
    monthlyLimit,
    remaining: monthlyLimit - result.admittedCount,
  });
}
