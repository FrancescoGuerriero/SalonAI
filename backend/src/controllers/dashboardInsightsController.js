import dashboardInsightsService from "../services/dashboardInsightsService.js";

function getPositiveInteger(
  value,
  fallback = 30,
  maximum = 365
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

class DashboardInsightsController {
  async getInsights(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        30,
        365
      );

      const data =
        await dashboardInsightsService.getInsights(days);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardInsightsController();