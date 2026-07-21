import customerRetentionService from "../services/customerRetentionService.js";

function getPositiveInteger(
  value,
  fallback,
  maximum = 365
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

class CustomerRetentionController {
  async getSummary(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        90,
        365
      );

      const data =
        await customerRetentionService.getRetentionSummary(
          days
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNewVsReturning(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        90,
        365
      );

      const data =
        await customerRetentionService.getNewVsReturning(
          days
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDormantCustomers(req, res, next) {
    try {
      const dormantDays = getPositiveInteger(
        req.query.dormantDays,
        60,
        730
      );

      const limit = getPositiveInteger(
        req.query.limit,
        20,
        100
      );

      const data =
        await customerRetentionService.getDormantCustomers(
          dormantDays,
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

  async getTopCustomers(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        365,
        1825
      );

      const limit = getPositiveInteger(
        req.query.limit,
        10,
        50
      );

      const data =
        await customerRetentionService.getTopCustomers(
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

  async getAnalytics(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        90,
        365
      );

      const dormantDays = getPositiveInteger(
        req.query.dormantDays,
        60,
        730
      );

      const dormantLimit = getPositiveInteger(
        req.query.dormantLimit,
        20,
        100
      );

      const topCustomerLimit = getPositiveInteger(
        req.query.topCustomerLimit,
        10,
        50
      );

      const data =
        await customerRetentionService.getAnalytics({
          days,
          dormantDays,
          dormantLimit,
          topCustomerLimit,
        });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CustomerRetentionController();