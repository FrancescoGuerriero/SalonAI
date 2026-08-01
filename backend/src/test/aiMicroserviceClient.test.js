import assert from "node:assert/strict";
import test from "node:test";

import {
  AiMicroserviceError,
  getAiServiceHealth,
  getHaircareRecommendation,
} from "../services/aiMicroserviceClient.js";

const environment = {
  AI_SERVICE_URL:
    "http://127.0.0.1:8000",

  AI_SERVICE_KEY:
    "test-service-key-with-at-least-thirty-two-characters",
};

function jsonResponse(
  payload,
  status = 200
) {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

test(
  "AI health check does not send the service key",
  async () => {
    let receivedHeaders;

    const result =
      await getAiServiceHealth({
        environment,
        fetchImpl:
          async (
            _url,
            options
          ) => {
            receivedHeaders =
              options.headers;

            return jsonResponse({
              status:
                "healthy",
            });
          },
      });

    assert.equal(
      result.status,
      "healthy"
    );

    assert.equal(
      receivedHeaders[
        "X-SalonAI-Service-Key"
      ],
      undefined
    );
  }
);

test(
  "haircare requests include the configured service key",
  async () => {
    let receivedRequest;

    const result =
      await getHaircareRecommendation(
        {
          hair_type:
            "curly",
        },
        {
          environment,
          fetchImpl:
            async (
              url,
              options
            ) => {
              receivedRequest = {
                url,
                options,
              };

              return jsonResponse({
                summary:
                  "Recommendation",
              });
            },
        }
      );

    assert.equal(
      result.summary,
      "Recommendation"
    );

    assert.equal(
      receivedRequest.options
        .headers[
        "X-SalonAI-Service-Key"
      ],
      environment.AI_SERVICE_KEY
    );

    assert.equal(
      receivedRequest.options
        .method,
      "POST"
    );
  }
);

test(
  "missing service configuration fails before the network request",
  async () => {
    await assert.rejects(
      () =>
        getHaircareRecommendation(
          {
            hair_type:
              "straight",
          },
          {
            environment: {
              AI_SERVICE_URL:
                environment.AI_SERVICE_URL,
            },
            fetchImpl:
              async () => {
                throw new Error(
                  "fetch should not run"
                );
              },
          }
        ),
      (error) => {
        assert.ok(
          error instanceof
            AiMicroserviceError
        );

        assert.equal(
          error.code,
          "AI_SERVICE_CONFIGURATION_ERROR"
        );

        return true;
      }
    );
  }
);

test(
  "AI error responses preserve the upstream status and code",
  async () => {
    await assert.rejects(
      () =>
        getHaircareRecommendation(
          {
            hair_type:
              "straight",
          },
          {
            environment,
            fetchImpl:
              async () =>
                jsonResponse(
                  {
                    detail: {
                      code:
                        "INVALID_SERVICE_KEY",
                      message:
                        "Invalid key",
                    },
                  },
                  401
                ),
          }
        ),
      (error) => {
        assert.equal(
          error.status,
          401
        );

        assert.equal(
          error.code,
          "INVALID_SERVICE_KEY"
        );

        return true;
      }
    );
  }
);
