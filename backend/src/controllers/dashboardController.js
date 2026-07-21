import dashboardService from "../services/dashboardService.js";

function getPositiveInteger(value, fallback, maximum = 365) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

class DashboardController {
  async getStats(req, res, next) {
    try {
      const data = await dashboardService.getStats();

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRevenue(req, res, next) {
    try {
      const days = getPositiveInteger(req.query.days, 30);

      const data = await dashboardService.getRevenue(days);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTodayAppointments(req, res, next) {
    try {
      const data =
        await dashboardService.getTodayAppointments();

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentActivity(req, res, next) {
    try {
      const limit = getPositiveInteger(
        req.query.limit,
        10,
        50
      );

      const data =
        await dashboardService.getRecentActivity(limit);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req, res, next) {
    try {
      const data = await dashboardService.getAlerts();

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRevenueByService(req, res, next) {
    try {
      const days = getPositiveInteger(req.query.days, 30);

      const data =
        await dashboardService.getRevenueByService(days);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentsByStatus(req, res, next) {
    try {
      const days = getPositiveInteger(req.query.days, 30);

      const data =
        await dashboardService.getAppointmentsByStatus(days);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTopStylists(req, res, next) {
    try {
      const days = getPositiveInteger(req.query.days, 30);
      const limit = getPositiveInteger(
        req.query.limit,
        10,
        25
      );

      const data = await dashboardService.getTopStylists(
        days,
        limit
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();
