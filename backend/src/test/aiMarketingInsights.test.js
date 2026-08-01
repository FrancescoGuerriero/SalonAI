import assert from "node:assert/strict";
import test from "node:test";

import {
  analyseMarketingInsights,
} from "../services/aiMicroserviceClient.js";

import {
  buildMarketingInsightsOptions,
} from "../features/aiRecommendations/aiMarketingInsightsController.js";

import {
  buildMarketingInsightsPayload,
  buildMarketingInsightsSettings,
  generateMarketingInsights,
} from "../features/aiRecommendations/aiMarketingInsightsService.js";


test(
  "analyseMarketingInsights rejects a missing payload",
  () => {
    assert.throws(
      () =>
        analyseMarketingInsights(
          undefined
        ),
      (error) => {
        assert.equal(
          error.code,
          "MARKETING_INSIGHTS_PAYLOAD_REQUIRED"
        );

        assert.equal(
          error.status,
          422
        );

        return true;
      }
    );
  }
);


test(
  "analyseMarketingInsights rejects missing observations",
  () => {
    assert.throws(
      () =>
        analyseMarketingInsights(
          {}
        ),
      (error) => {
        assert.equal(
          error.code,
          "MARKETING_INSIGHTS_OBSERVATIONS_REQUIRED"
        );

        assert.equal(
          error.status,
          422
        );

        return true;
      }
    );
  }
);


test(
  "analyseMarketingInsights rejects empty observations",
  () => {
    assert.throws(
      () =>
        analyseMarketingInsights({
          observations: [],
        }),
      (error) => {
        assert.equal(
          error.code,
          "MARKETING_INSIGHTS_OBSERVATIONS_EMPTY"
        );

        assert.equal(
          error.status,
          422
        );

        return true;
      }
    );
  }
);

test(
  "analyseMarketingInsights calls the correct FastAPI endpoint",
  async () => {
    let capturedUrl;
    let capturedOptions;

    const payload = {
      as_of_date:
        "2026-07-28",

      observations: [
        {
          business_date:
            "2026-07-28",

          active_customers: 1,
          new_customers: 1,
          returning_customers: 0,
          enquiries: 1,
          bookings: 1,
          completed_appointments: 1,
          cancelled_appointments: 0,
          no_show_appointments: 0,
          messages_sent: 1,
          messages_delivered: 1,
          messages_opened: 1,
          messages_clicked: 1,
          unsubscribes: 0,
          failed_deliveries: 0,
          marketing_cost: 0,
          attributed_revenue: 50,
          total_revenue: 50,
          discounts_redeemed: 0,
          refunds: 0,
          channels: [],
          campaigns: [],
        },
      ],

      settings: {
        recent_window_days: 7,
        baseline_window_days: 28,
        minimum_history_days: 28,
        minimum_campaign_messages: 20,
        minimum_channel_messages: 30,
        strong_open_rate: 0.35,
        strong_click_rate: 0.08,
        strong_conversion_rate: 0.05,
        high_unsubscribe_rate: 0.02,
        high_failure_rate: 0.08,
        include_campaign_insights: true,
        include_channel_insights: true,
        include_recommendations: true,
        currency: "GBP",
        timezone: "Europe/London",
      },
    };

    const response =
      await analyseMarketingInsights(
        payload,
        {
          environment: {
            AI_SERVICE_URL:
              "http://127.0.0.1:8000",

            AI_SERVICE_KEY:
              "12345678901234567890123456789012",

            AI_SERVICE_TIMEOUT_MS:
              "20000",
          },

          fetchImpl: async (
            url,
            options
          ) => {
            capturedUrl =
              url;

            capturedOptions =
              options;

            return {
              ok: true,
              status: 200,

              headers: {
                get() {
                  return "application/json";
                },
              },

              async json() {
                return {
                  summary: {
                    total_messages_sent:
                      1,
                  },
                };
              },
            };
          },
        }
      );

    assert.equal(
      capturedUrl,
      "http://127.0.0.1:8000/api/v1/marketing-insights/analyse"
    );

    assert.equal(
      capturedOptions.method,
      "POST"
    );

    assert.equal(
      capturedOptions.headers[
        "X-SalonAI-Service-Key"
      ],
      "12345678901234567890123456789012"
    );

    assert.deepEqual(
      JSON.parse(
        capturedOptions.body
      ),
      payload
    );

    assert.equal(
      response.summary
        .total_messages_sent,
      1
    );
  }
);


test(
  "buildMarketingInsightsSettings returns defaults",
  () => {
    const settings =
      buildMarketingInsightsSettings();

    assert.equal(
      settings.recent_window_days,
      30
    );

    assert.equal(
      settings.baseline_window_days,
      180
    );

    assert.equal(
      settings.minimum_history_days,
      90
    );

    assert.equal(
      settings.include_campaign_insights,
      true
    );

    assert.equal(
      settings.include_channel_insights,
      true
    );

    assert.equal(
      settings.include_recommendations,
      true
    );

    assert.equal(
      settings.currency,
      "GBP"
    );

    assert.equal(
      settings.timezone,
      "Europe/London"
    );
  }
);


test(
  "buildMarketingInsightsSettings constrains window values",
  () => {
    const settings =
      buildMarketingInsightsSettings({
        recentWindowDays: 500,
        baselineWindowDays: 60,
        minimumHistoryDays: 200,
      });

    assert.equal(
      settings.baseline_window_days,
      60
    );

    assert.equal(
      settings.recent_window_days,
      60
    );

    assert.equal(
      settings.minimum_history_days,
      60
    );
  }
);


test(
  "buildMarketingInsightsSettings parses booleans",
  () => {
    const settings =
      buildMarketingInsightsSettings({
        includeCampaignInsights:
          "false",

        includeChannelInsights:
          "true",

        includeRecommendations:
          "false",
      });

    assert.equal(
      settings.include_campaign_insights,
      false
    );

    assert.equal(
      settings.include_channel_insights,
      true
    );

    assert.equal(
      settings.include_recommendations,
      false
    );
  }
);


test(
  "buildMarketingInsightsOptions reads request query values",
  () => {
    const options =
      buildMarketingInsightsOptions({
        id:
          "request-47",

        query: {
          asOfDate:
            "2026-07-28",

          lookbackDays:
            "365",

          recentWindowDays:
            "45",

          baselineWindowDays:
            "240",

          minimumHistoryDays:
            "120",

          minimumCampaignMessages:
            "50",

          minimumChannelMessages:
            "75",

          strongOpenRate:
            "0.4",

          strongClickRate:
            "0.1",

          strongConversionRate:
            "0.07",

          highUnsubscribeRate:
            "0.03",

          highFailureRate:
            "0.09",

          includeCampaignInsights:
            "false",

          includeChannelInsights:
            "true",

          includeRecommendations:
            "false",
        },
      });

    assert.equal(
      options.asOfDate,
      "2026-07-28"
    );

    assert.equal(
      options.lookbackDays,
      365
    );

    assert.equal(
      options.recentWindowDays,
      45
    );

    assert.equal(
      options.baselineWindowDays,
      240
    );

    assert.equal(
      options.minimumHistoryDays,
      120
    );

    assert.equal(
      options.minimumCampaignMessages,
      50
    );

    assert.equal(
      options.minimumChannelMessages,
      75
    );

    assert.equal(
      options.strongOpenRate,
      0.4
    );

    assert.equal(
      options.strongClickRate,
      0.1
    );

    assert.equal(
      options.strongConversionRate,
      0.07
    );

    assert.equal(
      options.highUnsubscribeRate,
      0.03
    );

    assert.equal(
      options.highFailureRate,
      0.09
    );

    assert.equal(
      options.includeCampaignInsights,
      false
    );

    assert.equal(
      options.includeChannelInsights,
      true
    );

    assert.equal(
      options.includeRecommendations,
      false
    );

    assert.equal(
      options.requestId,
      "request-47"
    );
  }
);


test(
  "buildMarketingInsightsOptions falls back to body values",
  () => {
    const options =
      buildMarketingInsightsOptions({
        headers: {
          "x-request-id":
            "header-request",
        },

        body: {
          lookbackDays:
            200,

          includeRecommendations:
            false,
        },
      });

    assert.equal(
      options.lookbackDays,
      200
    );

    assert.equal(
      options.includeRecommendations,
      false
    );

    assert.equal(
      options.requestId,
      "header-request"
    );
  }
);


test(
  "buildMarketingInsightsPayload exports a function",
  () => {
    assert.equal(
      typeof buildMarketingInsightsPayload,
      "function"
    );
  }
);


test(
  "generateMarketingInsights exports a function",
  () => {
    assert.equal(
      typeof generateMarketingInsights,
      "function"
    );
  }
);


test(
  "marketing-insights service defaults to aggregate-only output",
  () => {
    const settings =
      buildMarketingInsightsSettings({
        recentWindowDays: 30,
        baselineWindowDays: 180,
      });

    assert.equal(
      settings.recent_window_days,
      30
    );

    assert.equal(
      settings.baseline_window_days,
      180
    );

    assert.equal(
      settings.currency,
      "GBP"
    );

    assert.equal(
      settings.timezone,
      "Europe/London"
    );
  }
);