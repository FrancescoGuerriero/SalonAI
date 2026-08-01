import {
  createAiCustomerSegmentation,
} from "./aiCustomerSegmentationService.js";

function requestId(request) {
  return (
    request.headers["x-request-id"] ||
    request.headers["x-correlation-id"] ||
    undefined
  );
}

function queryThresholds(query = {}) {
  return {
    new_customer_days: query.newCustomerDays,
    loyal_completed_visits: query.loyalCompletedVisits,
    loyal_rebooking_rate: query.loyalRebookingRate,
    high_value_spend: query.highValueSpend,
    high_value_average_spend: query.highValueAverageSpend,
    inactive_days: query.inactiveDays,
    at_risk_days: query.atRiskDays,
    discount_usage_rate: query.discountUsageRate,
  };
}

export async function analyseCustomerSegmentation(
  request,
  response
) {
  const result = await createAiCustomerSegmentation({
    limit: request.query.limit,
    lookbackDays: request.query.lookbackDays,
    thresholds: queryThresholds(request.query),
    requestId: requestId(request),
  });

  return response.status(200).json({
    success: true,
    message:
      "AI customer segmentation generated successfully.",
    ...result,
  });
}

export default {
  analyseCustomerSegmentation,
};
