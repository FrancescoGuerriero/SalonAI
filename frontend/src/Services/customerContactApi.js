import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const customerContactClient = axios.create({
  baseURL: `${API_URL}/customer-contacts`,
  headers: {
    "Content-Type": "application/json",
  },
});

customerContactClient.interceptors.request.use(
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
  const validationErrors =
    error.response?.data?.errors;

  if (
    Array.isArray(validationErrors) &&
    validationErrors.length > 0
  ) {
    return validationErrors
      .map(
        (validationError) =>
          validationError.message ||
          validationError.msg
      )
      .filter(Boolean)
      .join(", ");
  }

  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    "Unable to complete the customer contact request."
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

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function removeEmptyParameters(parameters = {}) {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
}

export async function createCustomerContactLog(
  contactData
) {
  try {
    const response =
      await customerContactClient.post(
        "/",
        contactData
      );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCustomerContactLogs({
  page = 1,
  limit = 20,
  customerId,
  appointmentId,
  campaignType,
  channel,
  direction,
  status,
  startDate,
  endDate,
} = {}) {
  try {
    const safePage = normalizePositiveInteger(
      page,
      1,
      100000
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      20,
      100
    );

    const response =
      await customerContactClient.get("/", {
        params: removeEmptyParameters({
          page: safePage,
          limit: safeLimit,
          customerId,
          appointmentId,
          campaignType,
          channel,
          direction,
          status,
          startDate,
          endDate,
        }),
      });

    const data = extractResponseData(response);

    return {
      contactLogs: Array.isArray(
        data?.contactLogs
      )
        ? data.contactLogs
        : [],

      pagination: {
        page:
          Number(data?.pagination?.page) ||
          safePage,

        limit:
          Number(data?.pagination?.limit) ||
          safeLimit,

        total:
          Number(data?.pagination?.total) ||
          0,

        pages:
          Number(data?.pagination?.pages) ||
          1,
      },
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCustomerContactLog(
  contactLogId
) {
  try {
    if (!contactLogId) {
      throw new Error(
        "A customer contact log ID is required."
      );
    }

    const response =
      await customerContactClient.get(
        `/${contactLogId}`
      );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCustomerContactHistory(
  customerId,
  {
    page = 1,
    limit = 20,
    channel,
    status,
  } = {}
) {
  try {
    if (!customerId) {
      throw new Error(
        "A customer ID is required."
      );
    }

    const safePage = normalizePositiveInteger(
      page,
      1,
      100000
    );

    const safeLimit = normalizePositiveInteger(
      limit,
      20,
      100
    );

    const response =
      await customerContactClient.get(
        `/customer/${customerId}`,
        {
          params: removeEmptyParameters({
            page: safePage,
            limit: safeLimit,
            channel,
            status,
          }),
        }
      );

    const data = extractResponseData(response);

    return {
      contactLogs: Array.isArray(
        data?.contactLogs
      )
        ? data.contactLogs
        : [],

      pagination: {
        page:
          Number(data?.pagination?.page) ||
          safePage,

        limit:
          Number(data?.pagination?.limit) ||
          safeLimit,

        total:
          Number(data?.pagination?.total) ||
          0,

        pages:
          Number(data?.pagination?.pages) ||
          1,
      },
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateCustomerContactLog(
  contactLogId,
  contactData
) {
  try {
    if (!contactLogId) {
      throw new Error(
        "A customer contact log ID is required."
      );
    }

    const response =
      await customerContactClient.patch(
        `/${contactLogId}`,
        contactData
      );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function updateCustomerContactStatus(
  contactLogId,
  {
    status,
    externalMessageId,
    failureReason,
    metadata,
  }
) {
  try {
    if (!contactLogId) {
      throw new Error(
        "A customer contact log ID is required."
      );
    }

    if (!status) {
      throw new Error(
        "A customer contact status is required."
      );
    }

    const response =
      await customerContactClient.patch(
        `/${contactLogId}/status`,
        {
          status,
          externalMessageId,
          failureReason,
          metadata,
        }
      );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteCustomerContactLog(
  contactLogId
) {
  try {
    if (!contactLogId) {
      throw new Error(
        "A customer contact log ID is required."
      );
    }

    const response =
      await customerContactClient.delete(
        `/${contactLogId}`
      );

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getCustomerContactCampaignSummary({
  days = 30,
  campaignType,
  channel,
} = {}) {
  try {
    const safeDays = normalizePositiveInteger(
      days,
      30,
      365
    );

    const response =
      await customerContactClient.get(
        "/campaign-summary",
        {
          params: removeEmptyParameters({
            days: safeDays,
            campaignType,
            channel,
          }),
        }
      );

    const data = extractResponseData(response);

    return {
      period: data?.period ?? {
        days: safeDays,
      },

      campaignType:
        data?.campaignType ??
        campaignType ??
        "all",

      channel:
        data?.channel ??
        channel ??
        "all",

      summary: {
        total:
          Number(data?.summary?.total) ||
          0,

        drafts:
          Number(data?.summary?.drafts) ||
          0,

        queued:
          Number(data?.summary?.queued) ||
          0,

        sent:
          Number(data?.summary?.sent) ||
          0,

        delivered:
          Number(data?.summary?.delivered) ||
          0,

        opened:
          Number(data?.summary?.opened) ||
          0,

        responded:
          Number(data?.summary?.responded) ||
          0,

        failed:
          Number(data?.summary?.failed) ||
          0,

        uniqueCustomers:
          Number(
            data?.summary?.uniqueCustomers
          ) || 0,

        deliveryRate:
          Number(
            data?.summary?.deliveryRate
          ) || 0,

        openRate:
          Number(data?.summary?.openRate) ||
          0,

        responseRate:
          Number(
            data?.summary?.responseRate
          ) || 0,
      },
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}