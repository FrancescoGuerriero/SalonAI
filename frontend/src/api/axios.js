import axios from "axios";

const configuredApiBaseUrl =
  String(
    import.meta.env
      .VITE_API_URL ||
      ""
  ).trim();

/*
|--------------------------------------------------------------------------
| API origin strategy
|--------------------------------------------------------------------------
| During Vite development always use the same-origin /api path. Vite proxies
| /api to the local backend (127.0.0.1:5000), which prevents localhost vs
| 127.0.0.1 CORS mismatches.
|
| In production an explicit VITE_API_URL can still be supplied. If it is not,
| /api is used so the deployed frontend can use the same public origin/edge.
*/
const API_BASE_URL =
  import.meta.env.DEV
    ? "/api"
    : configuredApiBaseUrl ||
      "/api";

const TOKEN_KEY =
  "salonai_token";
const USER_KEY =
  "salonai_user";
const LEGACY_TOKEN_KEY =
  "token";

export const SESSION_EXPIRED_EVENT =
  "salonai:session-expired";
export const TOKEN_REFRESHED_EVENT =
  "salonai:token-refreshed";

const API = axios.create({
  baseURL:
    API_BASE_URL,
  withCredentials:
    true,
  headers: {
    "Content-Type":
      "application/json",
  },
});

const refreshClient =
  axios.create({
    baseURL:
      API_BASE_URL,
    withCredentials:
      true,
    headers: {
      "Content-Type":
        "application/json",
    },
  });

let refreshPromise =
  null;

function readStoredToken() {
  return (
    localStorage.getItem(
      TOKEN_KEY
    ) ||
    localStorage.getItem(
      LEGACY_TOKEN_KEY
    )
  );
}

function storeAccessToken(
  token
) {
  localStorage.setItem(
    TOKEN_KEY,
    token
  );
  localStorage.removeItem(
    LEGACY_TOKEN_KEY
  );
}

function clearStoredSession() {
  localStorage.removeItem(
    TOKEN_KEY
  );
  localStorage.removeItem(
    USER_KEY
  );
  localStorage.removeItem(
    LEGACY_TOKEN_KEY
  );
}

function dispatchBrowserEvent(
  name,
  detail = undefined
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail,
      }
    )
  );
}

function shouldSkipRefresh(
  config
) {
  if (
    config?._skipAuthRefresh
  ) {
    return true;
  }

  const url =
    String(
      config?.url ||
        ""
    );

  return [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
  ].some((path) =>
    url.includes(path)
  );
}

async function getRefreshedAccessToken() {
  if (!refreshPromise) {
    refreshPromise =
      refreshClient
        .post(
          "/auth/refresh",
          {}
        )
        .then(
          (response) => {
            const token =
              response.data
                ?.token ||
              response.data
                ?.accessToken ||
              response.data
                ?.jwt;

            if (!token) {
              throw new Error(
                "The refresh response did not include an access token."
              );
            }

            storeAccessToken(
              token
            );

            dispatchBrowserEvent(
              TOKEN_REFRESHED_EVENT,
              {
                token,
                user:
                  response
                    .data
                    ?.user ||
                  null,
              }
            );

            return token;
          }
        )
        .catch(
          (error) => {
            clearStoredSession();

            dispatchBrowserEvent(
              SESSION_EXPIRED_EVENT
            );

            throw error;
          }
        )
        .finally(
          () => {
            refreshPromise =
              null;
          }
        );
  }

  return refreshPromise;
}

API.interceptors.request.use(
  (config) => {
    const token =
      readStoredToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) =>
    Promise.reject(
      error
    )
);

API.interceptors.response.use(
  (response) =>
    response,
  async (error) => {
    const status =
      error.response
        ?.status;
    const originalRequest =
      error.config;

    if (
      status !== 401 ||
      !originalRequest ||
      shouldSkipRefresh(
        originalRequest
      )
    ) {
      return Promise.reject(
        error
      );
    }

    if (
      originalRequest._retry
    ) {
      clearStoredSession();

      dispatchBrowserEvent(
        SESSION_EXPIRED_EVENT
      );

      return Promise.reject(
        error
      );
    }

    originalRequest._retry =
      true;

    try {
      const token =
        await getRefreshedAccessToken();

      originalRequest.headers =
        originalRequest.headers ||
        {};

      originalRequest.headers.Authorization =
        `Bearer ${token}`;

      return API(
        originalRequest
      );
    } catch {
      return Promise.reject(
        error
      );
    }
  }
);

export default API;
