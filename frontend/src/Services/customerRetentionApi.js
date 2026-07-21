import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const customerRetentionClient = axios.create({
  baseURL: `${API_URL}/dashboard/customer-retention`,
  headers: {
    "Content-Type": "application/json",
  },
});

customerRetentionClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    "Unable to retrieve customer retention analytics."
  );
}

function extractResponseData(response) {
  if (
    response?.data &&
    typeof response.data === "object" &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      "data"
    )
  ) {
    return response.data.data;
  }

  return response?.data;
}

function normalizePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

export async function getCustomerRetentionSummary(
  days = 90
) {
  try {
    const safeDays = normalizePositiveInteger(
      days,
      90,
      365
    );

    const response = await customerRetentionClient.get(
      "/summary",
      {
        params: {
          days: safeDays,
        },
      }
    );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getNewVsReturningCustomers(
  days = 90
) {
  try {
    const safeDays = normalizePositiveInteger(
      days,
      90,
      365
    );

    const response = await customerRetentionClient.get(
      "/new-vs-returning",
      {
        params: {
          days: safeDays,
        },
      }
    );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getDormantCustomers({
  dormantDays = 60,
  limit = 20,
} = {}) {
  try {
    const safeDormantDays = normalizePositiveInteger(
      dormantDays,
      60,
      730
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      20,
      100
    );

    const response = await customerRetentionClient.get(
      "/dormant",
      {
        params: {
          dormantDays: safeDormantDays,
          limit: safeLimit,
        },
      }
    );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getTopCustomers({
  days = 365,
  limit = 10,
} = {}) {
  try {
    const safeDays = normalizePositiveInteger(
      days,
      365,
      1825
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      10,
      50
    );

    const response = await customerRetentionClient.get(
      "/top-customers",
      {
        params: {
          days: safeDays,
          limit: safeLimit,
        },
      }
    );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCustomerRetentionAnalytics({
  days = 90,
  dormantDays = 60,
  dormantLimit = 20,
  topCustomerLimit = 10,
} = {}) {
  try {
    const safeDays = normalizePositiveInteger(
      days,
      90,
      365
    );

    const safeDormantDays = normalizePositiveInteger(
      dormantDays,
      60,
      730
    );

    const safeDormantLimit = normalizePositiveInteger(
      dormantLimit,
      20,
      100
    );

    const safeTopCustomerLimit =
      normalizePositiveInteger(
        topCustomerLimit,
        10,
        50
      );

    const response = await customerRetentionClient.get(
      "/",
      {
        params: {
          days: safeDays,
          dormantDays: safeDormantDays,
          dormantLimit: safeDormantLimit,
          topCustomerLimit: safeTopCustomerLimit,
        },
      }
    );

    const data = extractResponseData(response);

    return {
      summary: data?.summary ?? {},
      newVsReturning: Array.isArray(
        data?.newVsReturning
      )
        ? data.newVsReturning
        : [],
      dormantCustomers: Array.isArray(
        data?.dormantCustomers
      )
        ? data.dormantCustomers
        : [],
      topCustomers: Array.isArray(data?.topCustomers)
        ? data.topCustomers
        : [],
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}