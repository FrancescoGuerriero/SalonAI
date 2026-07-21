import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error(
        "Unable to connect to the SalonAI backend."
      );

      return Promise.reject(error);
    }

    const status = error.response.status;

    if (status === 401) {
      const isLoginRequest =
        error.config?.url?.includes("/auth/login");

      if (!isLoginRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    if (status === 403) {
      console.warn(
        error.response.data?.message ||
          "You do not have permission to perform this action."
      );
    }

    if (status >= 500) {
      console.error(
        error.response.data?.message ||
          "The SalonAI server encountered an error."
      );
    }

    return Promise.reject(error);
  }
);

export default api;