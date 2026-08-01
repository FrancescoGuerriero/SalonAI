import API from "../api/axios.js";

export async function getPremiumFeatureData(endpoint, params = {}) {
  const response = await API.get(endpoint, { params });
  return response.data;
}

export async function createPremiumFeatureRecord(endpoint, payload) {
  const response = await API.post(endpoint, payload);
  return response.data;
}
