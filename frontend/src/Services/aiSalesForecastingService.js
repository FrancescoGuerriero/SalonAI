import API from "../api/axios.js";


const SALES_FORECAST_ENDPOINT =
  "/ai/sales-forecast";


export class AiSalesForecastApiError extends Error {
  constructor(
    message,
    {
      code =
        "AI_SALES_FORECAST_API_ERROR",
      status = null,
      details = null,
      data = null,
      cause = null,
    } = {}
  ) {
    super(message, {
      cause,
    });

    this.name =
      "AiSalesForecastApiError";

    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
    this.data = data;
  }
}


function cleanParameters(
  parameters = {}
) {
  return Object.fromEntries(
    Object.entries(
      parameters
    ).filter(
      ([, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === ""
        ) {
          return false;
        }

        if (
          Array.isArray(value) &&
          value.length === 0
        ) {
          return false;
        }

        return true;
      }
    )
  );
}


function normaliseBusinessDays(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    Array.isArray(value)
  ) {
    return value.join(",");
  }

  return String(value);
}


function createApiError(
  error
) {
  if (
    error instanceof
    AiSalesForecastApiError
  ) {
    return error;
  }

  const responseData =
    error?.response?.data ||
    {};

  const detail =
    responseData?.detail;

  const message =
    responseData?.message ||
    detail?.message ||
    error?.message ||
    "Unable to retrieve the AI sales forecast.";

  return new AiSalesForecastApiError(
    message,
    {
      code:
        responseData?.code ||
        detail?.code ||
        error?.code ||
        "AI_SALES_FORECAST_API_ERROR",

      status:
        error?.response?.status ||
        responseData?.statusCode ||
        null,

      details:
        responseData?.details ||
        detail?.details ||
        detail ||
        null,

      data:
        responseData,

      cause:
        error,
    }
  );
}


export function buildSalesForecastParameters({
  asOfDate,
  lookbackDays,
  horizonDays,
  minimumHistoryDays,
  recentWindowDays,
  baselineWindowDays,
  confidenceLevel,
  weekdaySeasonalityWeight,
  recentTrendWeight,
  scenarioAdjustment,
  businessDays,
  includeProfitForecast,
  includeCategoryForecast,
} = {}) {
  return cleanParameters({
    asOfDate,
    lookbackDays,
    horizonDays,
    minimumHistoryDays,
    recentWindowDays,
    baselineWindowDays,
    confidenceLevel,
    weekdaySeasonalityWeight,
    recentTrendWeight,
    scenarioAdjustment,

    businessDays:
      normaliseBusinessDays(
        businessDays
      ),

    includeProfitForecast,
    includeCategoryForecast,
  });
}


export async function getAiSalesForecast(
  options = {}
) {
  try {
    const response =
      await API.get(
        SALES_FORECAST_ENDPOINT,
        {
          params:
            buildSalesForecastParameters(
              options
            ),

          headers: {
            Accept:
              "application/json",

            "Cache-Control":
              "no-store",
          },
        }
      );

    const data =
      response?.data;

    if (
      !data ||
      data.success !== true ||
      !data.forecast
    ) {
      throw new AiSalesForecastApiError(
        "The server returned an invalid sales-forecast response.",
        {
          code:
            "INVALID_AI_SALES_FORECAST_RESPONSE",

          status:
            response?.status ||
            null,

          data,
        }
      );
    }

    return data;
  } catch (error) {
    throw createApiError(
      error
    );
  }
}


export async function getDefaultAiSalesForecast() {
  return getAiSalesForecast({
    lookbackDays: 365,
    horizonDays: 90,
    minimumHistoryDays: 90,
    recentWindowDays: 30,
    baselineWindowDays: 180,
    confidenceLevel: 0.9,
    weekdaySeasonalityWeight: 0.55,
    recentTrendWeight: 0.45,
    scenarioAdjustment: 0,
    businessDays: [
      0,
      1,
      2,
      3,
      4,
      5,
    ],
    includeProfitForecast: true,
    includeCategoryForecast: true,
  });
}


export default {
  buildSalesForecastParameters,
  getAiSalesForecast,
  getDefaultAiSalesForecast,
};