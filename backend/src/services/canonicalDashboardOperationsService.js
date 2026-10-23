import legacyDashboardOperationsService from "./dashboardOperationsService.js";
import {
  canonicalMetricEvidence,
  calculateCanonicalRatio,
} from "../features/analytics/operationalMetricCalculator.js";

class CanonicalDashboardOperationsService {
  async getSnapshot() {
    const snapshot = await legacyDashboardOperationsService.getSnapshot();

    return {
      ...snapshot,
      utilisationPercent: calculateCanonicalRatio(
        "utilisation-rate",
        snapshot.bookedMinutes,
        snapshot.scheduledMinutes,
        { decimals: 1 }
      ),
      metricDefinitions: {
        ...(snapshot.metricDefinitions || {}),
        utilisationPercent: canonicalMetricEvidence("utilisation-rate"),
      },
    };
  }
}

export default new CanonicalDashboardOperationsService();
