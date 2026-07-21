import customerContactService from "../services/customerContactService.js";

function getPositiveInteger(
  value,
  fallback,
  maximum = 100
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

class CustomerContactController {
  async createContactLog(req, res, next) {
    try {
      const data =
        await customerContactService.createContactLog(
          req.body,
          req.user
        );

      res.status(201).json({
        success: true,
        message: "Customer contact log created.",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getContactLog(req, res, next) {
    try {
      const data =
        await customerContactService.getContactLog(
          req.params.contactLogId
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listContactLogs(req, res, next) {
    try {
      const page = getPositiveInteger(
        req.query.page,
        1,
        100000
      );

      const limit = getPositiveInteger(
        req.query.limit,
        20,
        100
      );

      const data =
        await customerContactService.listContactLogs({
          page,
          limit,
          customerId: req.query.customerId,
          appointmentId: req.query.appointmentId,
          campaignType: req.query.campaignType,
          channel: req.query.channel,
          direction: req.query.direction,
          status: req.query.status,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerContactHistory(req, res, next) {
    try {
      const page = getPositiveInteger(
        req.query.page,
        1,
        100000
      );

      const limit = getPositiveInteger(
        req.query.limit,
        20,
        100
      );

      const data =
        await customerContactService.getCustomerContactHistory(
          req.params.customerId,
          {
            page,
            limit,
            channel: req.query.channel,
            status: req.query.status,
          }
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateContactLog(req, res, next) {
    try {
      const data =
        await customerContactService.updateContactLog(
          req.params.contactLogId,
          req.body,
          req.user
        );

      res.status(200).json({
        success: true,
        message: "Customer contact log updated.",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateContactStatus(req, res, next) {
    try {
      const {
        status,
        externalMessageId,
        failureReason,
        metadata,
      } = req.body ?? {};

      if (!status) {
        const error = new Error(
          "A contact status is required."
        );

        error.statusCode = 400;

        throw error;
      }

      const data =
        await customerContactService.updateContactStatus(
          req.params.contactLogId,
          status,
          {
            externalMessageId,
            failureReason,
            metadata,
          }
        );

      res.status(200).json({
        success: true,
        message: "Customer contact status updated.",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteContactLog(req, res, next) {
    try {
      const data =
        await customerContactService.deleteContactLog(
          req.params.contactLogId
        );

      res.status(200).json({
        success: true,
        message: "Customer contact log deleted.",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignSummary(req, res, next) {
    try {
      const days = getPositiveInteger(
        req.query.days,
        30,
        365
      );

      const data =
        await customerContactService.getCampaignSummary({
          days,
          campaignType: req.query.campaignType,
          channel: req.query.channel,
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

export default new CustomerContactController();