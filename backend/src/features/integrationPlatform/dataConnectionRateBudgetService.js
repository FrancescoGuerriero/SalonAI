import DataConnectionApiUsageBudget from "../../models/DataConnectionApiUsageBudget.js";
import { createServiceError } from "../../shared/serviceError.js";

const DEFAULT_PER_MINUTE = 300;
const DEFAULT_PER_DAY = 5_000;
const HARD_MAX_PER_MINUTE = 10_000;
const HARD_MAX_PER_DAY = 1_000_000;

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

export function dataConnectionRateBudgetConfig() {
  return Object.freeze({
    requestsPerMinute: integer(
      process.env.AIIBP_DATA_CONNECTION_REQUESTS_PER_MINUTE,
      DEFAULT_PER_MINUTE,
      1,
      HARD_MAX_PER_MINUTE
    ),
    requestsPerDay: integer(
      process.env.AIIBP_DATA_CONNECTION_REQUESTS_PER_DAY,
      DEFAULT_PER_DAY,
      1,
      HARD_MAX_PER_DAY
    ),
  });
}

function bucket(period, date = new Date()) {
  return period === "minute" ? date.toISOString().slice(0, 16) : date.toISOString().slice(0, 10);
}

function expiry(period, date = new Date()) {
  return period === "minute"
    ? new Date(date.getTime() + 5 * 60_000)
    : new Date(date.getTime() + 2 * 86_400_000);
}

async function reserve(period, limit, now) {
  const id = bucket(period, now);
  try {
    const value = await DataConnectionApiUsageBudget.findOneAndUpdate(
      { period, bucket: id, count: { $lt: limit } },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: expiry(period, now) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    if (!value || value.count > limit) throw new Error("limit");
    return value.count;
  } catch (error) {
    if (error?.code === 11000 || error?.message === "limit") {
      throw createServiceError(
        `Managed data connection ${period} request budget is exhausted. Retry after the current ${period} window.`,
        429,
        { code: "DATA_CONNECTION_RATE_BUDGET_EXHAUSTED", period, limit }
      );
    }
    throw error;
  }
}

export async function reserveDataConnectionApiRequest({ now = new Date() } = {}) {
  const config = dataConnectionRateBudgetConfig();
  const minuteCount = await reserve("minute", config.requestsPerMinute, now);
  try {
    const dayCount = await reserve("day", config.requestsPerDay, now);
    return {
      minute: { count: minuteCount, limit: config.requestsPerMinute },
      day: { count: dayCount, limit: config.requestsPerDay },
    };
  } catch (error) {
    await DataConnectionApiUsageBudget.updateOne(
      { period: "minute", bucket: bucket("minute", now), count: { $gt: 0 } },
      { $inc: { count: -1 } }
    ).catch(() => undefined);
    throw error;
  }
}

export default { reserveDataConnectionApiRequest, dataConnectionRateBudgetConfig };
