import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const dashboardClient = axios.create({
  baseURL: `${API_URL}/dashboard`,
  headers: {
    "Content-Type": "application/json",
  },
});

dashboardClient.interceptors.request.use(
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
    "Unable to retrieve dashboard data."
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

export async function getDashboardStats() {
  try {
    const response = await dashboardClient.get("/stats");
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getDashboardRevenue(days = 30) {
  try {
    const response = await dashboardClient.get("/revenue", {
      params: { days },
    });
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getTodayAppointments() {
  try {
    const response = await dashboardClient.get("/today");
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getRecentActivity(limit = 10) {
  try {
    const response = await dashboardClient.get("/activity", {
      params: { limit },
    });
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getDashboardAlerts() {
  try {
    const response = await dashboardClient.get("/alerts");
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getRevenueByService(days = 30) {
  try {
    const response = await dashboardClient.get(
      "/revenue-by-service",
      {
        params: { days },
      }
    );
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAppointmentsByStatus(days = 30) {
  try {
    const response = await dashboardClient.get(
      "/appointments-by-status",
      {
        params: { days },
      }
    );
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getTopStylists(
  days = 30,
  limit = 10
) {
  try {
    const response = await dashboardClient.get(
      "/top-stylists",
      {
        params: {
          days,
          limit,
        },
      }
    );
    return extractResponseData(response);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getDashboardData({
  revenueDays = 30,
  activityLimit = 10,
  stylistLimit = 10,
} = {}) {
  try {
    const [
      stats,
      revenue,
      appointments,
      activity,
      alerts,
      revenueByService,
      appointmentStatus,
      topStylists,
    ] = await Promise.all([
      getDashboardStats(),
      getDashboardRevenue(revenueDays),
      getTodayAppointments(),
      getRecentActivity(activityLimit),
      getDashboardAlerts(),
      getRevenueByService(revenueDays),
      getAppointmentsByStatus(revenueDays),
      getTopStylists(revenueDays, stylistLimit),
    ]);

    return {
      stats: stats ?? {},
      revenue: Array.isArray(revenue) ? revenue : [],
      appointments: Array.isArray(appointments)
        ? appointments
        : [],
      activity: Array.isArray(activity) ? activity : [],
      alerts: alerts ?? {},
      revenueByService: Array.isArray(revenueByService)
        ? revenueByService
        : [],
      appointmentStatus: Array.isArray(appointmentStatus)
        ? appointmentStatus
        : [],
      topStylists: Array.isArray(topStylists)
        ? topStylists
        : [],
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
