import legacyCustomerRetentionService from "./customerRetentionService.js";
import {
  canonicalMetricEvidence,
  calculateCanonicalRatio,
} from "../features/analytics/operationalMetricCalculator.js";

function canonicaliseSummary(summary = {}) {
  return {
    ...summary,
    retentionRate: calculateCanonicalRatio(
      "retention-rate",
      summary.returningCustomers,
      summary.activeCustomers,
      { decimals: 1 }
    ),
    metricDefinitions: {
      ...(summary.metricDefinitions || {}),
      retentionRate: canonicalMetricEvidence("retention-rate"),
    },
  };
}

class CanonicalCustomerRetentionService {
  async getRetentionSummary(days = 90) {
    return canonicaliseSummary(
      await legacyCustomerRetentionService.getRetentionSummary(days)
    );
  }

  async getNewVsReturning(days = 90) {
    return legacyCustomerRetentionService.getNewVsReturning(days);
  }

  async getDormantCustomers(dormantDays = 60, limit = 20) {
    return legacyCustomerRetentionService.getDormantCustomers(
      dormantDays,
      limit
    );
  }

  async getTopCustomers(days = 365, limit = 10) {
    return legacyCustomerRetentionService.getTopCustomers(days, limit);
  }

  async getAnalytics(options = {}) {
    const analytics = await legacyCustomerRetentionService.getAnalytics(options);
    return {
      ...analytics,
      summary: canonicaliseSummary(analytics.summary),
    };
  }
}

export { canonicaliseSummary };
export default new CanonicalCustomerRetentionService();
