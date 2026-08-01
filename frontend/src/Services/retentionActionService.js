import axios from "axios";

const TOKEN_STORAGE_KEY =
  "salonai_token";

const USER_STORAGE_KEY =
  "salonai_user";

const DEFAULT_API_URL =
  "http://localhost:5000/api";

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL ||
    DEFAULT_API_URL
).replace(/\/+$/, "");

const retentionActionApi =
  axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000,
    withCredentials: true,

    headers: {
      Accept: "application/json",
      "Content-Type":
        "application/json",
    },
  });

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseNumber(
  value,
  fallback,
  minimum = null,
  maximum = null
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
    result = Math.max(
      minimum,
      result
    );
  }

  if (
    maximum !== null
  ) {
    result = Math.min(
      maximum,
      result
    );
  }

  return result;
}

function getStoredToken() {
  return normaliseText(
    localStorage.getItem(
      TOKEN_STORAGE_KEY
    )
  );
}

function clearStoredAuthentication() {
  localStorage.removeItem(
    TOKEN_STORAGE_KEY
  );

  localStorage.removeItem(
    USER_STORAGE_KEY
  );
}

function dispatchAuthenticationExpiredEvent() {
  window.dispatchEvent(
    new CustomEvent(
      "salonai:authentication-expired"
    )
  );
}

function createRetentionActionError(
  error
) {
  const responseData =
    error?.response?.data || {};

  const retentionError =
    new Error(
      responseData.message ||
        error?.message ||
        "The customer-retention request failed."
    );

  retentionError.name =
    "RetentionActionApiError";

  retentionError.status =
    error?.response?.status ||
    null;

  retentionError.statusCode =
    error?.response?.status ||
    responseData.statusCode ||
    null;

  retentionError.code =
    responseData.code ||
    error?.code ||
    "RETENTION_ACTION_API_ERROR";

  retentionError.details =
    responseData.details ||
    null;

  retentionError.data =
    responseData;

  retentionError.originalError =
    error;

  return retentionError;
}

retentionActionApi.interceptors.request.use(
  (config) => {
    const token =
      getStoredToken();

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(
      createRetentionActionError(
        error
      )
    )
);

retentionActionApi.interceptors.response.use(
  (response) =>
    response,

  (error) => {
    if (
      error?.response?.status ===
      401
    ) {
      clearStoredAuthentication();

      dispatchAuthenticationExpiredEvent();
    }

    return Promise.reject(
      createRetentionActionError(
        error
      )
    );
  }
);

function removeEmptyValues(
  object = {}
) {
  return Object.fromEntries(
    Object.entries(
      object
    ).filter(([, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return false;
      }

      return true;
    })
  );
}

function normaliseChannel(
  value
) {
  const channel =
    normaliseText(
      value
    ).toLowerCase();

  return [
    "email",
    "sms",
  ].includes(channel)
    ? channel
    : "email";
}

function normaliseScheduledFor(
  value
) {
  if (!value) {
    return new Date()
      .toISOString();
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "The scheduled date is invalid."
    );
  }

  return date.toISOString();
}

/*
|--------------------------------------------------------------------------
| Dormant customers
|--------------------------------------------------------------------------
*/

async function getDormantCustomers(
  filters = {}
) {
  const params =
    removeEmptyValues({
      dormantDays:
        normaliseNumber(
          filters.dormantDays,
          60,
          1,
          3650
        ),

      limit:
        normaliseNumber(
          filters.limit,
          100,
          1,
          1000
        ),
    });

  const response =
    await retentionActionApi.get(
      "/future/retention-actions/dormant",
      {
        params,
      }
    );

  return {
    ...response.data,

    items:
      Array.isArray(
        response.data?.items
      )
        ? response.data.items
        : [],
  };
}

/*
|--------------------------------------------------------------------------
| Dormant-customer outreach
|--------------------------------------------------------------------------
*/

async function queueDormantOutreach(
  payload = {}
) {
  const requestBody = {
    dormantDays:
      normaliseNumber(
        payload.dormantDays,
        60,
        1,
        3650
      ),

    channel:
      normaliseChannel(
        payload.channel
      ),

    scheduledFor:
      normaliseScheduledFor(
        payload.scheduledFor
      ),

    subject:
      normaliseText(
        payload.subject
      ) ||
      "We miss you, {{customer.firstName}}",

    message:
      normaliseText(
        payload.message
      ) ||
      "Hi {{customer.firstName}}, we would love to welcome you back to {{salon.name}}. Reply to arrange your next appointment.",
  };

  const response =
    await retentionActionApi.post(
      "/future/retention-actions/dormant/queue",
      requestBody
    );

  return {
    ...response.data,

    queued:
      Number(
        response.data?.queued
      ) || 0,

    items:
      Array.isArray(
        response.data?.items
      )
        ? response.data.items
        : [],
  };
}

/*
|--------------------------------------------------------------------------
| Post-appointment follow-ups
|--------------------------------------------------------------------------
*/

async function queuePostAppointmentFollowUps(
  payload = {}
) {
  const requestBody = {
    daysAfter:
      normaliseNumber(
        payload.daysAfter,
        1,
        0,
        365
      ),

    channel:
      normaliseChannel(
        payload.channel
      ),
  };

  const response =
    await retentionActionApi.post(
      "/future/retention-actions/follow-ups/queue",
      requestBody
    );

  return {
    ...response.data,

    queued:
      Number(
        response.data?.queued
      ) || 0,

    items:
      Array.isArray(
        response.data?.items
      )
        ? response.data.items
        : [],
  };
}

/*
|--------------------------------------------------------------------------
| Display helpers
|--------------------------------------------------------------------------
*/

function getCustomerName(
  customer
) {
  const firstName =
    normaliseText(
      customer?.firstName
    );

  const lastName =
    normaliseText(
      customer?.lastName
    );

  return (
    normaliseText(
      customer?.fullName ||
        customer?.name ||
        `${firstName} ${lastName}`
    ) ||
    "Unnamed customer"
  );
}

function getCustomerContact(
  customer,
  channel = "email"
) {
  if (
    normaliseChannel(
      channel
    ) === "sms"
  ) {
    return (
      normaliseText(
        customer?.phone
      ) ||
      normaliseText(
        customer?.phoneNumber
      ) ||
      normaliseText(
        customer?.mobile
      ) ||
      "No phone number"
    );
  }

  return (
    normaliseText(
      customer?.email
    ) ||
    "No email address"
  );
}

function getCustomerIdentifier(
  customer
) {
  return normaliseText(
    customer?._id ||
      customer?.id
  );
}

export {
  API_BASE_URL,
  clearStoredAuthentication,
  createRetentionActionError,
  getCustomerContact,
  getCustomerIdentifier,
  getCustomerName,
  getDormantCustomers,
  queueDormantOutreach,
  queuePostAppointmentFollowUps,
  retentionActionApi,
};

export default {
  getCustomerContact,
  getCustomerIdentifier,
  getCustomerName,
  getDormantCustomers,
  queueDormantOutreach,
  queuePostAppointmentFollowUps,
};