import API from "../api/axios.js";

async function getDynamicPricingRecommendations(params = {}) {
  const response = await API.get("/future/dynamic-pricing", { params });
  return response.data;
}

export { getDynamicPricingRecommendations };
