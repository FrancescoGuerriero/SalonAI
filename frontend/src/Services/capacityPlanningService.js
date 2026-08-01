import API from "../api/axios.js";

async function getCapacityPlan(params = {}) {
  const response = await API.get("/future/capacity-planning", { params });
  return response.data;
}

export { getCapacityPlan };
