import * as aiService from "./aiService.js";

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  const normalisedValue =
    String(value)
      .trim()
      .toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
    ].includes(
      normalisedValue
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
    ].includes(
      normalisedValue
    )
  ) {
    return false;
  }

  return fallback;
}

/*
|--------------------------------------------------------------------------
| Individual customer retention prediction
|--------------------------------------------------------------------------
*/

export async function retention(
  request,
  response
) {
  const force =
    normaliseBoolean(
      request.body?.force ??
        request.query?.force,
      true
    );

  const result =
    await aiService.predictRetention(
      request.params.customerId,
      {
        force,
      }
    );

  return response
    .status(200)
    .json({
      success: true,
      prediction: result,
    });
}

/*
|--------------------------------------------------------------------------
| Retrieve the customer's stored prediction
|--------------------------------------------------------------------------
*/

export async function storedRetention(
  request,
  response
) {
  const prediction =
    await aiService.getStoredRetentionPrediction(
      request.params.customerId
    );

  if (!prediction) {
    const error =
      new Error(
        "No stored retention prediction was found for this customer."
      );

    error.statusCode = 404;
    error.status = 404;

    throw error;
  }

  return response
    .status(200)
    .json({
      success: true,
      prediction,
    });
}

/*
|--------------------------------------------------------------------------
| Generate predictions for multiple customers
|--------------------------------------------------------------------------
*/

export async function retentionBatch(
  request,
  response
) {
  const payload = {
    ...request.body,

    force:
      normaliseBoolean(
        request.body?.force,
        false
      ),
  };

  const result =
    await aiService.predictRetentionBatch(
      payload
    );

  return response
    .status(200)
    .json({
      success:
        result.failed === 0,

      message:
        `${result.succeeded} customer retention prediction${
          result.succeeded === 1
            ? ""
            : "s"
        } completed.`,

      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| List and rank stored retention predictions
|--------------------------------------------------------------------------
*/

export async function retentionPredictions(
  request,
  response
) {
  const result =
    await aiService.listRetentionPredictions(
      request.query
    );

  return response
    .status(200)
    .json({
      success: true,
      ...result,
    });
}

/*
|--------------------------------------------------------------------------
| Retention prediction summary
|--------------------------------------------------------------------------
*/

export async function retentionSummary(
  request,
  response
) {
  const summary =
    await aiService.getRetentionSummary();

  return response
    .status(200)
    .json({
      success: true,
      summary,
    });
}

/*
|--------------------------------------------------------------------------
| AI campaign copy
|--------------------------------------------------------------------------
*/

export async function copy(
  request,
  response
) {
  const result =
    await aiService.generateCampaignCopy(
      request.body || {}
    );

  return response
    .status(200)
    .json({
      success: true,
      copy: result,
    });
}

/*
|--------------------------------------------------------------------------
| Revenue forecast
|--------------------------------------------------------------------------
*/

export async function forecast(
  request,
  response
) {
  const result =
    await aiService.generateRevenueForecast(
      request.body || {}
    );

  return response
    .status(201)
    .json({
      success: true,
      forecast: result,
    });
}

export async function latestForecast(
  request,
  response
) {
  const forecast =
    await aiService.latestForecast();

  if (!forecast) {
    return response
      .status(200)
      .json({
        success: true,
        forecast: null,
        message:
          "No revenue forecast has been generated yet.",
      });
  }

  return response
    .status(200)
    .json({
      success: true,
      forecast,
    });
}

export default {
  copy,
  forecast,
  latestForecast,
  retention,
  retentionBatch,
  retentionPredictions,
  retentionSummary,
  storedRetention,
};