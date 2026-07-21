import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const dashboardInsightsClient = axios.create({
  baseURL: `${API_URL}/dashboard/insights`,
  headers: {
    "Content-Type": "application/json",
  },
});

dashboardInsightsClient.interceptors.request.use(
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
    "Unable to retrieve dashboard insights."
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

export async function getDashboardInsights(days = 30) {
  try {
    const response =
      await dashboardInsightsClient.get("/", {
        params: {
          days,
        },
      });

    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}