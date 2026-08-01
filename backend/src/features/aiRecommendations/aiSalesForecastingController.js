import {
  createAiSalesForecast,
} from "./aiSalesForecastingService.js";


function getRequestId(request) {
  return (
    request.headers[
      "x-request-id"
    ] ||
    request.headers[
      "x-correlation-id"
    ] ||
    request.requestId ||
    request.id ||
    undefined
  );
}


function optionalText(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const text =
    String(value).trim();

  return text || undefined;
}


function optionalBoolean(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalised =
    String(value)
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
    ].includes(normalised)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
    ].includes(normalised)
  ) {
    return false;
  }

  return undefined;
}


function optionalBusinessDays(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const values =
    Array.isArray(value)
      ? value
      : String(value).split(",");

  const businessDays =
    Array.from(
      new Set(
        values
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
    ? businessDays
    : undefined;
}


function salesForecastOptions(
  query = {}
) {
  return {
    asOfDate:
      optionalText(
        query.asOfDate
      ),

    lookbackDays:
      query.lookbackDays,

    horizonDays:
      query.horizonDays,

    minimumHistoryDays:
      query.minimumHistoryDays,

    recentWindowDays:
      query.recentWindowDays,

    baselineWindowDays:
      query.baselineWindowDays,

    confidenceLevel:
      query.confidenceLevel,

    weekdaySeasonalityWeight:
      query.weekdaySeasonalityWeight,

    recentTrendWeight:
      query.recentTrendWeight,

    scenarioAdjustment:
      query.scenarioAdjustment,

    businessDays:
      optionalBusinessDays(
        query.businessDays
      ),

    includeProfitForecast:
      optionalBoolean(
        query.includeProfitForecast
      ),

    includeCategoryForecast:
      optionalBoolean(
        query.includeCategoryForecast
      ),
  };
}


export async function generateAiSalesForecast(
  request,
  response
) {
  const result =
    await createAiSalesForecast({
      ...salesForecastOptions(
        request.query
      ),

      requestId:
        getRequestId(request),
    });

  response.set(
    "Cache-Control",
    "no-store"
  );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "AI sales forecast generated successfully.",

      ...result,
    });
}


export default {
  generateAiSalesForecast,
};