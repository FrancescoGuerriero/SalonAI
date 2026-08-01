import API from "../api/axios.js";


const DEFAULT_PARAMETERS = {
  lookbackDays: 180,
  recentWindowDays: 30,
  baselineWindowDays: 180,
  minimumHistoryDays: 90,
  minimumCampaignMessages: 20,
  minimumChannelMessages: 30,
  strongOpenRate: 0.35,
  strongClickRate: 0.08,
  strongConversionRate: 0.05,
  highUnsubscribeRate: 0.02,
  highFailureRate: 0.08,
  includeCampaignInsights: true,
  includeChannelInsights: true,
  includeRecommendations: true,
};


function asNumber(
  value,
  fallback
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function asBoolean(
  value,
  fallback
) {
  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalised =
      value
        .trim()
        .toLowerCase();

    if (
      normalised ===
      "true"
    ) {
      return true;
    }

    if (
      normalised ===
      "false"
    ) {
      return false;
    }
  }

  return fallback;
}


export function buildMarketingInsightsParameters(
  values = {}
) {
  return {
    asOfDate:
      values.asOfDate ||
      undefined,

    lookbackDays:
      Math.max(
        28,
        asNumber(
          values.lookbackDays,
          DEFAULT_PARAMETERS
            .lookbackDays
        )
      ),

    recentWindowDays:
      Math.max(
        7,
        asNumber(
          values.recentWindowDays,
          DEFAULT_PARAMETERS
            .recentWindowDays
        )
      ),

    baselineWindowDays:
      Math.max(
        28,
        asNumber(
          values.baselineWindowDays,
          DEFAULT_PARAMETERS
            .baselineWindowDays
        )
      ),

    minimumHistoryDays:
      Math.max(
        28,
        asNumber(
          values.minimumHistoryDays,
          DEFAULT_PARAMETERS
            .minimumHistoryDays
        )
      ),

    minimumCampaignMessages:
      Math.max(
        1,
        asNumber(
          values.minimumCampaignMessages,
          DEFAULT_PARAMETERS
            .minimumCampaignMessages
        )
      ),

    minimumChannelMessages:
      Math.max(
        1,
        asNumber(
          values.minimumChannelMessages,
          DEFAULT_PARAMETERS
            .minimumChannelMessages
        )
      ),

    strongOpenRate:
      Math.max(
        0,
        asNumber(
          values.strongOpenRate,
          DEFAULT_PARAMETERS
            .strongOpenRate
        )
      ),

    strongClickRate:
      Math.max(
        0,
        asNumber(
          values.strongClickRate,
          DEFAULT_PARAMETERS
            .strongClickRate
        )
      ),

    strongConversionRate:
      Math.max(
        0,
        asNumber(
          values.strongConversionRate,
          DEFAULT_PARAMETERS
            .strongConversionRate
        )
      ),

    highUnsubscribeRate:
      Math.max(
        0,
        asNumber(
          values.highUnsubscribeRate,
          DEFAULT_PARAMETERS
            .highUnsubscribeRate
        )
      ),

    highFailureRate:
      Math.max(
        0,
        asNumber(
          values.highFailureRate,
          DEFAULT_PARAMETERS
            .highFailureRate
        )
      ),

    includeCampaignInsights:
      asBoolean(
        values.includeCampaignInsights,
        DEFAULT_PARAMETERS
          .includeCampaignInsights
      ),

    includeChannelInsights:
      asBoolean(
        values.includeChannelInsights,
        DEFAULT_PARAMETERS
          .includeChannelInsights
      ),

    includeRecommendations:
      asBoolean(
        values.includeRecommendations,
        DEFAULT_PARAMETERS
          .includeRecommendations
      ),
  };
}


function cleanParameters(
  values
) {
  return Object.fromEntries(
    Object.entries(
      values
    ).filter(
      (
        [
          ,
          value,
        ]
      ) =>
        value !==
          undefined &&
        value !==
          null &&
        value !== ""
    )
  );
}


export async function getAiMarketingInsights(
  values = {}
) {
  const parameters =
    cleanParameters(
      buildMarketingInsightsParameters(
        values
      )
    );

  const response =
    await API.get(
      "/ai/marketing-insights",
      {
        params:
          parameters,
      }
    );

  return (
    response?.data ||
    response
  );
}


export async function getDefaultAiMarketingInsights() {
  return getAiMarketingInsights(
    DEFAULT_PARAMETERS
  );
}


export {
  DEFAULT_PARAMETERS as DEFAULT_MARKETING_INSIGHTS_PARAMETERS,
};


export default {
  buildMarketingInsightsParameters,
  getAiMarketingInsights,
  getDefaultAiMarketingInsights,
};