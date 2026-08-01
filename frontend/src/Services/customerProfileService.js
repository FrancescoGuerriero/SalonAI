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

const customerProfileApi =
  axios.create({
    baseURL: API_BASE_URL,

    timeout: 60000,

    withCredentials: true,

    headers: {
      Accept:
        "application/json",

      "Content-Type":
        "application/json",
    },
  });

function normaliseText(value) {
  return String(value ?? "").trim();
}

function getStoredToken() {
  return normaliseText(
    localStorage.getItem(
      TOKEN_STORAGE_KEY
    )
  );
}

function removeStoredAuthentication() {
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

function createCustomerProfileApiError(
  error
) {
  const responseData =
    error?.response?.data || {};

  const apiError = new Error(
    responseData.message ||
      error?.message ||
      "The customer-profile request failed."
  );

  apiError.name =
    "CustomerProfileApiError";

  apiError.status =
    error?.response?.status ||
    null;

  apiError.statusCode =
    error?.response?.status ||
    responseData.statusCode ||
    null;

  apiError.code =
    responseData.code ||
    error?.code ||
    "CUSTOMER_PROFILE_API_ERROR";

  apiError.field =
    responseData.field ||
    null;

  apiError.details =
    responseData.details ||
    null;

  apiError.data =
    responseData;

  apiError.originalError =
    error;

  return apiError;
}

customerProfileApi.interceptors.request.use(
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
      createCustomerProfileApiError(
        error
      )
    )
);

customerProfileApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status ===
      401
    ) {
      removeStoredAuthentication();

      dispatchAuthenticationExpiredEvent();
    }

    return Promise.reject(
      createCustomerProfileApiError(
        error
      )
    );
  }
);

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

function encodeIdentifier(
  identifier
) {
  const value =
    normaliseText(identifier);

  if (!value) {
    throw new Error(
      "A customer identifier is required."
    );
  }

  return encodeURIComponent(value);
}

/*
|--------------------------------------------------------------------------
| Customer profile collection
|--------------------------------------------------------------------------
*/

async function listCustomerProfiles(
  filters = {}
) {
  const response =
    await customerProfileApi.get(
      "/customer-profiles",
      {
        params:
          removeEmptyValues(
            filters
          ),
      }
    );

  return response.data;
}

async function createCustomerProfile(
  payload
) {
  const response =
    await customerProfileApi.post(
      "/customer-profiles",
      payload
    );

  return response.data;
}

async function getCustomerProfileStatistics() {
  const response =
    await customerProfileApi.get(
      "/customer-profiles/statistics"
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Individual customer profiles
|--------------------------------------------------------------------------
*/

async function getCustomerProfile(
  identifier,
  options = {}
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.get(
      `/customer-profiles/${safeIdentifier}`,
      {
        params:
          removeEmptyValues(
            options
          ),
      }
    );

  return response.data;
}

async function getCustomerOperations(
  identifier
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.get(
      `/customer-profiles/${safeIdentifier}/operations`
    );

  return (
    response.data?.data ||
    response.data
  );
}

async function updateCustomerProfile(
  identifier,
  payload
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.patch(
      `/customer-profiles/${safeIdentifier}`,
      payload
    );

  return response.data;
}

async function deleteCustomerProfile(
  identifier
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.delete(
      `/customer-profiles/${safeIdentifier}`
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Customer lifecycle
|--------------------------------------------------------------------------
*/

async function archiveCustomerProfile(
  identifier
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.patch(
      `/customer-profiles/${safeIdentifier}/archive`
    );

  return response.data;
}

async function restoreCustomerProfile(
  identifier
) {
  const safeIdentifier =
    encodeIdentifier(identifier);

  const response =
    await customerProfileApi.patch(
      `/customer-profiles/${safeIdentifier}/restore`
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| User-account linking
|--------------------------------------------------------------------------
*/

async function linkCustomerUserAccount(
  customerId,
  userAccountId
) {
  const safeCustomerId =
    encodeIdentifier(customerId);

  const response =
    await customerProfileApi.patch(
      `/customer-profiles/${safeCustomerId}/user-account`,
      {
        userAccountId:
          normaliseText(
            userAccountId
          ),
      }
    );

  return response.data;
}

async function unlinkCustomerUserAccount(
  customerId
) {
  const safeCustomerId =
    encodeIdentifier(customerId);

  const response =
    await customerProfileApi.delete(
      `/customer-profiles/${safeCustomerId}/user-account`
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Communication consent
|--------------------------------------------------------------------------
*/

async function updateCustomerConsent(
  customerId,
  payload
) {
  const safeCustomerId =
    encodeIdentifier(customerId);

  const response =
    await customerProfileApi.patch(
      `/customer-profiles/${safeCustomerId}/consent`,
      payload
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Customer self-service
|--------------------------------------------------------------------------
*/

async function getMyCustomerProfile() {
  const response =
    await customerProfileApi.get(
      "/customer-profiles/me"
    );

  return response.data;
}

async function updateMyCustomerProfile(
  payload
) {
  const response =
    await customerProfileApi.patch(
      "/customer-profiles/me",
      payload
    );

  return response.data;
}

async function updateMyCommunicationConsent(
  payload
) {
  const response =
    await customerProfileApi.patch(
      "/customer-profiles/me/consent",
      payload
    );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getCustomerDisplayName(
  customer
) {
  if (!customer) {
    return "Unknown customer";
  }

  const preferredName =
    normaliseText(
      customer.preferredName
    );

  if (preferredName) {
    return preferredName;
  }

  const fullName =
    normaliseText(
      customer.fullName
    );

  if (fullName) {
    return fullName;
  }

  const generatedName = [
    customer.firstName,
    customer.lastName,
  ]
    .map(normaliseText)
    .filter(Boolean)
    .join(" ");

  return (
    generatedName ||
    normaliseText(
      customer.email
    ) ||
    normaliseText(
      customer.phone
    ) ||
    "Unknown customer"
  );
}

function getCustomerInitials(
  customer
) {
  const name =
    getCustomerDisplayName(
      customer
    );

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");
}

function isCustomerMarketingEligible(
  customer
) {
  if (
    !customer ||
    customer.status !== "active"
  ) {
    return false;
  }

  const preferences =
    customer.communicationPreferences ||
    {};

  if (
    preferences.unsubscribed
  ) {
    return false;
  }

  return Boolean(
    customer.marketing
      ?.emailConsent ||
      customer.marketing
        ?.smsConsent
  );
}

function formatCustomerAddress(
  customer
) {
  const address =
    customer?.address || {};

  return [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode,
    address.country,
  ]
    .map(normaliseText)
    .filter(Boolean)
    .join(", ");
}

export {
  API_BASE_URL,
  archiveCustomerProfile,
  createCustomerProfile,
  createCustomerProfileApiError,
  customerProfileApi,
  deleteCustomerProfile,
  formatCustomerAddress,
  getCustomerDisplayName,
  getCustomerInitials,
  getCustomerOperations,
  getCustomerProfile,
  getCustomerProfileStatistics,
  getMyCustomerProfile,
  isCustomerMarketingEligible,
  linkCustomerUserAccount,
  listCustomerProfiles,
  removeStoredAuthentication,
  restoreCustomerProfile,
  unlinkCustomerUserAccount,
  updateCustomerConsent,
  updateCustomerProfile,
  updateMyCommunicationConsent,
  updateMyCustomerProfile,
};

export default {
  archiveCustomerProfile,
  createCustomerProfile,
  deleteCustomerProfile,
  formatCustomerAddress,
  getCustomerDisplayName,
  getCustomerInitials,
  getCustomerOperations,
  getCustomerProfile,
  getCustomerProfileStatistics,
  getMyCustomerProfile,
  isCustomerMarketingEligible,
  linkCustomerUserAccount,
  listCustomerProfiles,
  restoreCustomerProfile,
  unlinkCustomerUserAccount,
  updateCustomerConsent,
  updateCustomerProfile,
  updateMyCommunicationConsent,
  updateMyCustomerProfile,
};