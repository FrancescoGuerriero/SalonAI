import WindsorApiUsageBudget from "../../models/WindsorApiUsageBudget.js";
import { createServiceError } from "../../shared/serviceError.js";

const DOCUMENTED_PER_MINUTE = 600;
const DOCUMENTED_PER_DAY = 10_000;
const DEFAULT_PER_MINUTE = 540;
const DEFAULT_PER_DAY = 9_000;

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}

export function windsorRateBudgetConfig() {
  return Object.freeze({
    requestsPerMinute: integer(process.env.WINDSOR_REQUESTS_PER_MINUTE, DEFAULT_PER_MINUTE, 1, DOCUMENTED_PER_MINUTE),
    requestsPerDay: integer(process.env.WINDSOR_REQUESTS_PER_DAY, DEFAULT_PER_DAY, 1, DOCUMENTED_PER_DAY),
    documented: Object.freeze({ requestsPerMinute: DOCUMENTED_PER_MINUTE, requestsPerDay: DOCUMENTED_PER_DAY }),
  });
}

function bucket(period, date = new Date()) {
  if (period === "minute") return date.toISOString().slice(0, 16);
  return date.toISOString().slice(0, 10);
}

function expiry(period, date = new Date()) {
  if (period === "minute") return new Date(date.getTime() + 5 * 60_000);
  return new Date(date.getTime() + 2 * 86_400_000);
}

async function reserve(period, limit, now) {
  const id = bucket(period, now);
  try {
    const value = await WindsorApiUsageBudget.findOneAndUpdate(
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
        `Windsor ${period} request budget is exhausted. Retry after the current ${period} window.`,
        429,
        { code: "WINDSOR_RATE_BUDGET_EXHAUSTED", period, limit }
      );
    }
    throw error;
  }
}

export async function reserveWindsorApiRequest({ now = new Date() } = {}) {
  const config = windsorRateBudgetConfig();
  const minuteCount = await reserve("minute", config.requestsPerMinute, now);
  try {
    const dayCount = await reserve("day", config.requestsPerDay, now);
    return {
      minute: { count: minuteCount, limit: config.requestsPerMinute },
      day: { count: dayCount, limit: config.requestsPerDay },
    };
  } catch (error) {
    await WindsorApiUsageBudget.updateOne(
      { period: "minute", bucket: bucket("minute", now), count: { $gt: 0 } },
      { $inc: { count: -1 } }
    ).catch(() => undefined);
    throw error;
  }
}

export default { reserveWindsorApiRequest, windsorRateBudgetConfig };
