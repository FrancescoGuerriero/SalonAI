import API from "../api/axios.js";

const BASE_URL =
  "/future/revenue-forecast";

function clampInteger(
  value,
  minimum,
  maximum,
  fallback
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue)
  ) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      parsedValue
    )
  );
}

function normaliseSnapshotId(
  snapshotId
) {
  const value =
    String(
      snapshotId || ""
    ).trim();

  if (!value) {
    throw new Error(
      "A revenue forecast snapshot ID is required."
    );
  }

  return value;
}

async function getRevenueForecast({
  months = 12,
  forecastMonths = 6,
} = {}) {
  const response =
    await API.get(
      BASE_URL,
      {
        params: {
          months:
            clampInteger(
              months,
              3,
              24,
              12
            ),

          forecastMonths:
            clampInteger(
              forecastMonths,
              1,
              12,
              6
            ),
        },
      }
    );

  return response.data;
}

async function createRevenueForecastSnapshot({
  name = "",
  description = "",
  months = 12,
  forecastMonths = 6,
} = {}) {
  const response =
    await API.post(
      `${BASE_URL}/snapshots`,
      {
        name:
          String(
            name || ""
          ).trim(),

        description:
          String(
            description || ""
          ).trim(),

        months:
          clampInteger(
            months,
            3,
            24,
            12
          ),

        forecastMonths:
          clampInteger(
            forecastMonths,
            1,
            12,
            6
          ),
      }
    );

  return response.data;
}

async function listRevenueForecastSnapshots({
  page = 1,
  limit = 20,
} = {}) {
  const response =
    await API.get(
      `${BASE_URL}/snapshots`,
      {
        params: {
          page:
            clampInteger(
              page,
              1,
              100000,
              1
            ),

          limit:
            clampInteger(
              limit,
              1,
              100,
              20
            ),
        },
      }
    );

  return response.data;
}

async function getRevenueForecastSnapshot(
  snapshotId
) {
  const id =
    normaliseSnapshotId(
      snapshotId
    );

  const response =
    await API.get(
      `${BASE_URL}/snapshots/${encodeURIComponent(
        id
      )}`
    );

  return response.data;
}

async function deleteRevenueForecastSnapshot(
  snapshotId
) {
  const id =
    normaliseSnapshotId(
      snapshotId
    );

  const response =
    await API.delete(
      `${BASE_URL}/snapshots/${encodeURIComponent(
        id
      )}`
    );

  return response.data;
}

const revenueForecastService = {
  createRevenueForecastSnapshot,
  deleteRevenueForecastSnapshot,
  getRevenueForecast,
  getRevenueForecastSnapshot,
  listRevenueForecastSnapshots,
};

export {
  createRevenueForecastSnapshot,
  deleteRevenueForecastSnapshot,
  getRevenueForecast,
  getRevenueForecastSnapshot,
  listRevenueForecastSnapshots,
};

export default revenueForecastService;
