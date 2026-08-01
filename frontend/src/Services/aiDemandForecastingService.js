import API from "../api/axios.js";


const FORECAST_ENDPOINT =
  "/ai/appointment-demand-forecast";


export class AiDemandForecastingApiError extends Error {
  constructor(
    message,
    {
      code =
        "AI_DEMAND_FORECASTING_API_ERROR",
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
      "AiDemandForecastingApiError";

    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
    this.data = data;
  }
}


function removeEmptyValues(
  values = {}
) {
  return Object.fromEntries(
    Object.entries(values).filter(
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

  const items =
    Array.isArray(value)
      ? value
      : String(value).split(",");

  const businessDays =
    Array.from(
      new Set(
        items
          .map((item) =>
            Number.parseInt(
              String(item).trim(),
              10
            )
          )
          .filter(
            (item) =>
              Number.isInteger(item) &&
              item >= 0 &&
              item <= 6
          )
      )
    ).sort(
      (left, right) =>
        left - right
    );

  return businessDays.length > 0
    ? businessDays.join(",")
    : undefined;
}


function createDemandForecastingError(
  error
) {
  if (
    error instanceof
    AiDemandForecastingApiError
  ) {
    return error;
  }

  const data =
    error?.response?.data || {};

  return new AiDemandForecastingApiError(
    data.message ||
      error?.message ||
      "The appointment-demand forecast could not be loaded.",
    {
      code:
        data.code ||
        error?.code ||
        "AI_DEMAND_FORECASTING_API_ERROR",

      status:
        error?.response?.status ||
        data.statusCode ||
        null,

      details:
        data.details ||
        error?.details ||
        null,

      data,

      cause:
        error,
    }
  );
}


export function buildDemandForecastQuery({
  asOfDate,
  lookbackDays = 180,
  horizonDays = 28,
  minimumHistoryDays = 56,
  recentWindowDays = 28,
  baselineWindowDays = 84,
  confidenceLevel = 0.9,
  targetUtilisation = 0.8,
  appointmentsPerStaffHour = 0.75,
  staffShiftHours = 8,
  businessDays,
  includeRevenueForecast = true,
} = {}) {
  return removeEmptyValues({
    asOfDate,
    lookbackDays,
    horizonDays,
    minimumHistoryDays,
    recentWindowDays,
    baselineWindowDays,
    confidenceLevel,
    targetUtilisation,
    appointmentsPerStaffHour,
    staffShiftHours,

    businessDays:
      normaliseBusinessDays(
        businessDays
      ),

    includeRevenueForecast,
  });
}


export async function getAiAppointmentDemandForecast(
  options = {}
) {
  try {
    const response =
      await API.get(
        FORECAST_ENDPOINT,
        {
          params:
            buildDemandForecastQuery(
              options
            ),

          headers: {
            "Cache-Control":
              "no-cache",
          },
        }
      );

    const payload =
      response.data;

    if (
      !payload ||
      payload.success !== true ||
      !payload.forecast ||
      !Array.isArray(
        payload.forecast.forecasts
      )
    ) {
      throw new AiDemandForecastingApiError(
        "The server returned an invalid appointment-demand forecast.",
        {
          code:
            "INVALID_DEMAND_FORECAST_RESPONSE",

          status:
            response.status,

          data:
            payload,
        }
      );
    }

    return payload;
  } catch (error) {
    throw createDemandForecastingError(
      error
    );
  }
}


export function getDemandForecastErrorMessage(
  error
) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    "The appointment-demand forecast could not be loaded."
  );
}


export default {
  buildDemandForecastQuery,
  getAiAppointmentDemandForecast,
  getDemandForecastErrorMessage,
};