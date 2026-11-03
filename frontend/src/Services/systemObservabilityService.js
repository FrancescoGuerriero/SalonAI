import API from "../api/axios.js";

export async function getSystemObservabilityOverview() {
  const response = await API.get(
    "/system-administration/observability-health"
  );
  return response.data?.observability || null;
}

export default {
  getSystemObservabilityOverview,
};
