import API from "../api/axios.js";

function removeEmptyValues(values = {}) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

function createSegmentationError(error) {
  const data = error?.response?.data || {};
  const apiError = new Error(
    data.message ||
      error?.message ||
      "The AI customer-segmentation request failed."
  );

  apiError.name = "AiCustomerSegmentationApiError";
  apiError.status = error?.response?.status || null;
  apiError.code =
    data.code ||
    error?.code ||
    "AI_CUSTOMER_SEGMENTATION_API_ERROR";
  apiError.details = data.details || null;
  apiError.data = data;

  return apiError;
}

export async function getAiCustomerSegmentation({
  limit = 250,
  lookbackDays = 730,
  thresholds = {},
} = {}) {
  try {
    const response = await API.get(
      "/ai/customer-segmentation",
      {
        params: removeEmptyValues({
          limit,
          lookbackDays,
          newCustomerDays:
            thresholds.newCustomerDays,
          loyalCompletedVisits:
            thresholds.loyalCompletedVisits,
          loyalRebookingRate:
            thresholds.loyalRebookingRate,
          highValueSpend:
            thresholds.highValueSpend,
          highValueAverageSpend:
            thresholds.highValueAverageSpend,
          inactiveDays:
            thresholds.inactiveDays,
          atRiskDays:
            thresholds.atRiskDays,
          discountUsageRate:
            thresholds.discountUsageRate,
        }),
      }
    );

    return response.data;
  } catch (error) {
    throw createSegmentationError(error);
  }
}

export default {
  getAiCustomerSegmentation,
};
