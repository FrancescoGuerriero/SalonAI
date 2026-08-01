import API from "../api/axios.js";

async function getMarketingAttribution(params = {}) {
  const response = await API.get("/future/marketing-attribution", { params });
  return response.data;
}

export { getMarketingAttribution };
