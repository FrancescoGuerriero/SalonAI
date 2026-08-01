import {
  generateMarketingInsights,
} from "./aiMarketingInsightsService.js";


function queryValue(
  request,
  key
) {
  return (
    request?.query?.[
      key
    ] ??
    request?.body?.[
      key
    ]
  );
}


function optionalNumber(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : undefined;
}


function optionalBoolean(
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
    typeof value ===
    "boolean"
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
    ].includes(
      normalised
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
      normalised
    )
  ) {
    return false;
  }

  return undefined;
}


function requestId(
  request
) {
  return (
    request?.id ||
    request?.requestId ||
    request?.headers?.[
      "x-request-id"
    ] ||
    undefined
  );
}


export function buildMarketingInsightsOptions(
  request
) {
  return {
    asOfDate:
      queryValue(
        request,
        "asOfDate"
      ),

    lookbackDays:
      optionalNumber(
        queryValue(
          request,
          "lookbackDays"
        )
      ),

    recentWindowDays:
      optionalNumber(
        queryValue(
          request,
          "recentWindowDays"
        )
      ),

    baselineWindowDays:
      optionalNumber(
        queryValue(
          request,
          "baselineWindowDays"
        )
      ),

    minimumHistoryDays:
      optionalNumber(
        queryValue(
          request,
          "minimumHistoryDays"
        )
      ),

    minimumCampaignMessages:
      optionalNumber(
        queryValue(
          request,
          "minimumCampaignMessages"
        )
      ),

    minimumChannelMessages:
      optionalNumber(
        queryValue(
          request,
          "minimumChannelMessages"
        )
      ),

    strongOpenRate:
      optionalNumber(
        queryValue(
          request,
          "strongOpenRate"
        )
      ),

    strongClickRate:
      optionalNumber(
        queryValue(
          request,
          "strongClickRate"
        )
      ),

    strongConversionRate:
      optionalNumber(
        queryValue(
          request,
          "strongConversionRate"
        )
      ),

    highUnsubscribeRate:
      optionalNumber(
        queryValue(
          request,
          "highUnsubscribeRate"
        )
      ),

    highFailureRate:
      optionalNumber(
        queryValue(
          request,
          "highFailureRate"
        )
      ),

    includeCampaignInsights:
      optionalBoolean(
        queryValue(
          request,
          "includeCampaignInsights"
        )
      ),

    includeChannelInsights:
      optionalBoolean(
        queryValue(
          request,
          "includeChannelInsights"
        )
      ),

    includeRecommendations:
      optionalBoolean(
        queryValue(
          request,
          "includeRecommendations"
        )
      ),

    requestId:
      requestId(
        request
      ),
  };
}


export async function generateAiMarketingInsights(
  request,
  response
) {
  const result =
    await generateMarketingInsights(
      buildMarketingInsightsOptions(
        request
      )
    );

  return response
    .status(200)
    .json({
      success: true,

      message:
        "AI marketing insights generated successfully.",

      ...result,
    });
}


export default {
  buildMarketingInsightsOptions,
  generateAiMarketingInsights,
};