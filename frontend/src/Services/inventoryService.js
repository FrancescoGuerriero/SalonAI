import API from "../api/axios.js";

const BASE_URL = "/future/inventory";

async function getInventoryForecast(params = {}) {
  const response = await API.get(BASE_URL, { params });
  return response.data;
}

async function createInventoryItem(payload) {
  const response = await API.post(BASE_URL, payload);
  return response.data;
}

async function updateInventoryItem(itemId, payload) {
  const response = await API.patch(`${BASE_URL}/${itemId}`, payload);
  return response.data;
}

async function deleteInventoryItem(itemId) {
  const response = await API.delete(`${BASE_URL}/${itemId}`);
  return response.data;
}

export {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryForecast,
  updateInventoryItem,
};
