import API from "../api/axios.js";

async function getManagementCopilotBrief(params = {}) {
  const response = await API.get("/future/management-copilot", { params });
  return response.data;
}

export { getManagementCopilotBrief };
