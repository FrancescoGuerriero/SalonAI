import API from "../api/axios.js";

function extractData(response) {
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

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load today's salon operations."
  );
}

export async function getDashboardOperations() {
  try {
    const response = await API.get(
      "/dashboard/operations"
    );

    return extractData(response);
  } catch (error) {
    throw new Error(
      errorMessage(error)
    );
  }
}

const dashboardOperationsApi = {
  getSnapshot:
    getDashboardOperations,
};

export default dashboardOperationsApi;