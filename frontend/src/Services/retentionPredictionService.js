import API from "../api/axios.js";

const RETENTION_AI_ROOT =
  "/future/ai";

const RETENTION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
];

const RETENTION_SORT_OPTIONS = [
  "risk",
  "newest",
  "oldest",
];

function normaliseText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normaliseIdentifier(
  value,
  fieldName = "Identifier"
) {
  const identifier =
    value?._id
      ? normaliseText(value._id)
      : normaliseText(value);

  if (!identifier) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return identifier;
}

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

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    normaliseText(value)
      .toLowerCase()
  );
}

function normaliseNumber(
  value,
  fallback,
  {
    minimum = null,
    maximum = null,
  } = {}
) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue
    )
  ) {
    return fallback;
  }

  let result =
    parsedValue;

  if (
    minimum !== null
  ) {
    result =
      Math.max(
        minimum,
        result
      );
  }

  if (
    maximum !== null
  ) {
    result =
      Math.min(
        maximum,
        result
      );
  }

  return result;
}

function normaliseInteger(
  value,
  fallback,
  options = {}
) {
  return Math.round(
    normaliseNumber(
      value,
      fallback,
      options
    )
  );
}

function normaliseRiskLevel(
  value
) {
  const riskLevel =
    normaliseText(value)
      .toLowerCase();

  if (
    !RETENTION_RISK_LEVELS.includes(
      riskLevel
    )
  ) {
    throw new Error(
      `Risk level must be one of: ${RETENTION_RISK_LEVELS.join(
        ", "
      )}.`
    );
  }

  return riskLevel;
}

function normaliseSort(
  value
) {
  const sort =
    normaliseText(
      value || "risk"
    ).toLowerCase();

  if (
    !RETENTION_SORT_OPTIONS.includes(
      sort
    )
  ) {
    throw new Error(
      `Sort must be one of: ${RETENTION_SORT_OPTIONS.join(
        ", "
      )}.`
    );
  }

  return sort;
}

function removeEmptyValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(object).filter(
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

function createRetentionPredictionError(
  error
) {
  const responseData =
    error?.response?.data || {};

  const message =
    responseData.message ||
    responseData.error ||
    error?.message ||
    "The retention-prediction request failed.";

  const retentionError =
    new Error(message);

  retentionError.name =
    "RetentionPredictionApiError";

  retentionError.status =
    error?.response?.status ||
    responseData.statusCode ||
    responseData.status ||
    null;

  retentionError.statusCode =
    retentionError.status;

  retentionError.code =
    responseData.code ||
    error?.code ||
    "RETENTION_PREDICTION_API_ERROR";

  retentionError.details =
    responseData.details ||
    null;

  retentionError.data =
    responseData;

  retentionError.originalError =
    error;

  return retentionError;
}

async function runRequest(
  request
) {
  try {
    return await request();
  } catch (error) {
    throw createRetentionPredictionError(
      error
    );
  }
}

function extractPrediction(
  responseData
) {
  return (
    responseData?.prediction ||
    responseData?.data
      ?.prediction ||
    responseData?.data ||
    responseData ||
    null
  );
}

function extractItems(
  responseData
) {
  if (
    Array.isArray(responseData)
  ) {
    return responseData;
  }

  if (
    Array.isArray(
      responseData?.items
    )
  ) {
    return responseData.items;
  }

  if (
    Array.isArray(
      responseData?.data
        ?.items
    )
  ) {
    return responseData
      .data
      .items;
  }

  if (
    Array.isArray(
      responseData?.predictions
    )
  ) {
    return responseData
      .predictions;
  }

  return [];
}

function buildPredictionParams(
  filters = {}
) {
  const params = {
    page:
      normaliseInteger(
        filters.page,
        1,
        {
          minimum: 1,
        }
      ),

    limit:
      normaliseInteger(
        filters.limit,
        25,
        {
          minimum: 1,
          maximum: 100,
        }
      ),

    search:
      normaliseText(
        filters.search ||
          filters.q
      ),

    customer:
      normaliseText(
        filters.customer ||
          filters.customerId
      ),

    sort:
      normaliseSort(
        filters.sort
      ),

    includeExpired:
      normaliseBoolean(
        filters.includeExpired,
        false
      )
        ? "true"
        : "",
  };

  if (
    filters.label &&
    filters.label !== "all"
  ) {
    params.label =
      normaliseRiskLevel(
        filters.label
      );
  }

  if (
    filters.minScore !==
    undefined &&
    filters.minScore !== ""
  ) {
    params.minScore =
      normaliseNumber(
        filters.minScore,
        0,
        {
          minimum: 0,
          maximum: 1,
        }
      );
  }

  if (
    filters.maxScore !==
    undefined &&
    filters.maxScore !== ""
  ) {
    params.maxScore =
      normaliseNumber(
        filters.maxScore,
        1,
        {
          minimum: 0,
          maximum: 1,
        }
      );
  }

  return removeEmptyValues(
    params
  );
}

/*
|--------------------------------------------------------------------------
| Individual customer prediction
|--------------------------------------------------------------------------
*/

async function generateRetentionPrediction(
  customerId,
  {
    force = true,
  } = {}
) {
  const identifier =
    normaliseIdentifier(
      customerId,
      "Customer identifier"
    );

  return runRequest(
    async () => {
      const response =
        await API.post(
          `${RETENTION_AI_ROOT}/customers/${encodeURIComponent(
            identifier
          )}/retention`,
          {
            force:
              normaliseBoolean(
                force,
                true
              ),
          }
        );

      return extractPrediction(
        response.data
      );
    }
  );
}

async function getStoredRetentionPrediction(
  customerId
) {
  const identifier =
    normaliseIdentifier(
      customerId,
      "Customer identifier"
    );

  return runRequest(
    async () => {
      const response =
        await API.get(
          `${RETENTION_AI_ROOT}/customers/${encodeURIComponent(
            identifier
          )}/retention`
        );

      return extractPrediction(
        response.data
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Prediction ranking and reporting
|--------------------------------------------------------------------------
*/

async function getRetentionPredictions(
  filters = {}
) {
  return runRequest(
    async () => {
      const response =
        await API.get(
          `${RETENTION_AI_ROOT}/retention/predictions`,
          {
            params:
              buildPredictionParams(
                filters
              ),
          }
        );

      const items =
        extractItems(
          response.data
        );

      return {
        ...response.data,
        items,

        pagination:
          response.data
            ?.pagination ||
          response.data?.data
            ?.pagination ||
          {
            page:
              Number(
                filters.page
              ) || 1,

            limit:
              Number(
                filters.limit
              ) || 25,

            total:
              items.length,

            pages:
              items.length
                ? 1
                : 0,
          },
      };
    }
  );
}

async function getRetentionPredictionSummary() {
  return runRequest(
    async () => {
      const response =
        await API.get(
          `${RETENTION_AI_ROOT}/retention/summary`
        );

      return (
        response.data?.summary ||
        response.data?.data
          ?.summary ||
        response.data?.data ||
        response.data ||
        {}
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Batch prediction generation
|--------------------------------------------------------------------------
*/

async function generateRetentionPredictionBatch(
  payload = {}
) {
  const customerIds =
    Array.from(
      new Set(
        (
          Array.isArray(
            payload.customerIds
          )
            ? payload.customerIds
            : []
        )
          .map(
            (
              customerId
            ) =>
              normaliseText(
                customerId?._id ||
                  customerId
              )
          )
          .filter(Boolean)
      )
    );

  const requestBody = {
    customerIds,

    status:
      normaliseText(
        payload.status ||
          "active"
      ).toLowerCase(),

    limit:
      normaliseInteger(
        payload.limit,
        100,
        {
          minimum: 1,
          maximum: 500,
        }
      ),

    concurrency:
      normaliseInteger(
        payload.concurrency,
        5,
        {
          minimum: 1,
          maximum: 20,
        }
      ),

    force:
      normaliseBoolean(
        payload.force,
        false
      ),
  };

  return runRequest(
    async () => {
      const response =
        await API.post(
          `${RETENTION_AI_ROOT}/retention/batch`,
          requestBody
        );

      return {
        ...response.data,

        requested:
          Number(
            response.data
              ?.requested
          ) || 0,

        succeeded:
          Number(
            response.data
              ?.succeeded
          ) || 0,

        failed:
          Number(
            response.data
              ?.failed
          ) || 0,

        refreshed:
          Number(
            response.data
              ?.refreshed
          ) || 0,

        reused:
          Number(
            response.data
              ?.reused
          ) || 0,

        results:
          Array.isArray(
            response.data
              ?.results
          )
            ? response.data
                .results
            : [],
      };
    }
  );
}

export {
  RETENTION_AI_ROOT,
  RETENTION_RISK_LEVELS,
  RETENTION_SORT_OPTIONS,
  createRetentionPredictionError,
  generateRetentionPrediction,
  generateRetentionPredictionBatch,
  getRetentionPredictions,
  getRetentionPredictionSummary,
  getStoredRetentionPrediction,
  normaliseRiskLevel,
};

export default {
  generateRetentionPrediction,
  generateRetentionPredictionBatch,
  getRetentionPredictions,
  getRetentionPredictionSummary,
  getStoredRetentionPrediction,
};