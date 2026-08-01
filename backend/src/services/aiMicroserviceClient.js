const DEFAULT_AI_SERVICE_URL =
  "http://127.0.0.1:8000";

const DEFAULT_TIMEOUT_MS = 20_000;


export class AiMicroserviceError extends Error {
  constructor(
    message,
    {
      code = "AI_MICROSERVICE_ERROR",
      status = 502,
      details = null,
      cause = null,
    } = {}
  ) {
    super(message, {
      cause,
    });

    this.name = "AiMicroserviceError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
  }
}


function normaliseBaseUrl(value) {
  return String(
    value || DEFAULT_AI_SERVICE_URL
  ).replace(/\/+$/, "");
}


function requireServiceKey(
  environment = process.env
) {
  const value = String(
    environment.AI_SERVICE_KEY || ""
  ).trim();

  if (value.length < 32) {
    throw new AiMicroserviceError(
      "AI_SERVICE_KEY must contain at least 32 characters.",
      {
        code:
          "AI_SERVICE_CONFIGURATION_ERROR",

        status: 500,
      }
    );
  }

  return value;
}


async function parseResponse(response) {
  const contentType =
    response.headers?.get?.(
      "content-type"
    ) || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response.json();
  }

  const text =
    await response.text();

  return text
    ? {
        message: text,
      }
    : {};
}


export async function requestAiMicroservice(
  path,
  {
    method = "GET",
    body,
    authenticated = true,

    timeoutMs = Number(
      process.env
        .AI_SERVICE_TIMEOUT_MS ||
        DEFAULT_TIMEOUT_MS
    ),

    fetchImpl = globalThis.fetch,
    environment = process.env,
    requestId,
  } = {}
) {
  if (
    typeof fetchImpl !== "function"
  ) {
    throw new AiMicroserviceError(
      "The Node.js Fetch API is unavailable.",
      {
        code:
          "AI_SERVICE_FETCH_UNAVAILABLE",

        status: 500,
      }
    );
  }

  const baseUrl =
    normaliseBaseUrl(
      environment.AI_SERVICE_URL
    );

  const headers = {
    Accept: "application/json",
    "Content-Type":
      "application/json",
  };

  if (authenticated) {
    headers[
      "X-SalonAI-Service-Key"
    ] = requireServiceKey(
      environment
    );
  }

  if (requestId) {
    headers[
      "X-Request-ID"
    ] = String(requestId);
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),

      Math.max(
        1_000,
        Number(timeoutMs) ||
          DEFAULT_TIMEOUT_MS
      )
    );

  timeout.unref?.();

  try {
    const response =
      await fetchImpl(
        `${baseUrl}${path}`,
        {
          method,
          headers,

          body:
            body === undefined
              ? undefined
              : JSON.stringify(
                  body
                ),

          signal:
            controller.signal,
        }
      );

    const payload =
      await parseResponse(
        response
      );

    if (!response.ok) {
      throw new AiMicroserviceError(
        payload?.message ||
          payload?.detail?.message ||
          "The AI service rejected the request.",
        {
          code:
            payload?.code ||
            payload?.detail?.code ||
            "AI_SERVICE_REQUEST_FAILED",

          status:
            response.status || 502,

          details:
            payload,
        }
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof
      AiMicroserviceError
    ) {
      throw error;
    }

    if (
      error?.name ===
      "AbortError"
    ) {
      throw new AiMicroserviceError(
        "The AI service request timed out.",
        {
          code:
            "AI_SERVICE_TIMEOUT",

          status: 504,
          cause: error,
        }
      );
    }

    throw new AiMicroserviceError(
      "Unable to connect to the SalonAI AI service.",
      {
        code:
          "AI_SERVICE_UNAVAILABLE",

        status: 503,
        cause: error,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}


export function getAiServiceHealth(
  options = {}
) {
  return requestAiMicroservice(
    "/health",
    {
      ...options,
      authenticated: false,
    }
  );
}


export function getAiServiceReadiness(
  options = {}
) {
  return requestAiMicroservice(
    "/ready",
    {
      ...options,
      authenticated: false,
    }
  );
}


export function getHaircareRecommendation(
  payload,
  options = {}
) {
  return requestAiMicroservice(
    "/api/v1/haircare/recommendations",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function getCustomerSummary(
  payload,
  options = {}
) {
  return requestAiMicroservice(
    "/api/v1/customer-summaries/generate",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function analyseCustomerSegments(
  payload,
  options = {}
) {
  return requestAiMicroservice(
    "/api/v1/customer-segmentation/analyse",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function forecastAppointmentDemand(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AiMicroserviceError(
      "A demand-forecasting payload is required.",
      {
        code:
          "DEMAND_FORECAST_PAYLOAD_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    !Array.isArray(
      payload.observations
    )
  ) {
    throw new AiMicroserviceError(
      "Demand-forecast observations must be an array.",
      {
        code:
          "DEMAND_FORECAST_OBSERVATIONS_REQUIRED",

        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/demand-forecasting/forecast",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function forecastSales(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AiMicroserviceError(
      "A sales-forecasting payload is required.",
      {
        code:
          "SALES_FORECAST_PAYLOAD_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    !Array.isArray(
      payload.observations
    )
  ) {
    throw new AiMicroserviceError(
      "Sales-forecast observations must be an array.",
      {
        code:
          "SALES_FORECAST_OBSERVATIONS_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    payload.observations.length === 0
  ) {
    throw new AiMicroserviceError(
      "At least one sales observation is required.",
      {
        code:
          "SALES_FORECAST_OBSERVATIONS_EMPTY",

        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/sales-forecasting/forecast",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}



export function analyseMarketingInsights(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AiMicroserviceError(
      "A marketing-insights payload is required.",
      {
        code:
          "MARKETING_INSIGHTS_PAYLOAD_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    !Array.isArray(
      payload.observations
    )
  ) {
    throw new AiMicroserviceError(
      "Marketing-insights observations must be an array.",
      {
        code:
          "MARKETING_INSIGHTS_OBSERVATIONS_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    payload.observations.length === 0
  ) {
    throw new AiMicroserviceError(
      "At least one marketing observation is required.",
      {
        code:
          "MARKETING_INSIGHTS_OBSERVATIONS_EMPTY",

        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/marketing-insights/analyse",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function predictNoShowRisk(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AiMicroserviceError(
      "A no-show prediction payload is required.",
      {
        code:
          "NO_SHOW_PREDICTION_PAYLOAD_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    !Array.isArray(
      payload.appointments
    )
  ) {
    throw new AiMicroserviceError(
      "No-show prediction appointments must be an array.",
      {
        code:
          "NO_SHOW_PREDICTION_APPOINTMENTS_REQUIRED",

        status: 422,
      }
    );
  }

  if (
    payload.appointments.length === 0
  ) {
    throw new AiMicroserviceError(
      "At least one appointment observation is required.",
      {
        code:
          "NO_SHOW_PREDICTION_APPOINTMENTS_EMPTY",

        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/no-show-prediction/predict",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export function generateManagementCopilotBrief(
  payload,
  options = {}
) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AiMicroserviceError(
      "A management-copilot payload is required.",
      {
        code:
          "MANAGEMENT_COPILOT_PAYLOAD_REQUIRED",

        status: 422,
      }
    );
  }

  return requestAiMicroservice(
    "/api/v1/management-copilot/brief",
    {
      ...options,
      method: "POST",
      body: payload,
      authenticated: true,
    }
  );
}


export default {
  generateManagementCopilotBrief,
  predictNoShowRisk,
  analyseCustomerSegments,
  analyseMarketingInsights,
  forecastAppointmentDemand,
  forecastSales,
  getAiServiceHealth,
  getAiServiceReadiness,
  getCustomerSummary,
  getHaircareRecommendation,
  requestAiMicroservice,
};
