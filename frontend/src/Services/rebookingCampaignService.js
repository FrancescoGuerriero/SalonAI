import API from "../api/axios.js";

const BASE_URL = "/future/rebooking-campaigns";

async function listRebookingCampaigns(params = {}) {
  const response = await API.get(BASE_URL, { params });
  return response.data;
}

async function createRebookingCampaign(payload) {
  const response = await API.post(BASE_URL, payload);
  return response.data;
}

async function scheduleRebookingCampaign(campaignId, scheduleAt) {
  const response = await API.post(`${BASE_URL}/${campaignId}/schedule`, { scheduleAt });
  return response.data;
}

async function sendRebookingCampaign(campaignId) {
  const response = await API.post(`${BASE_URL}/${campaignId}/send`);
  return response.data;
}

async function cancelRebookingCampaign(campaignId) {
  const response = await API.post(`${BASE_URL}/${campaignId}/cancel`);
  return response.data;
}

async function getRebookingCampaignResults(campaignId) {
  const response = await API.get(`${BASE_URL}/${campaignId}/results`);
  return response.data;
}

export {
  cancelRebookingCampaign,
  createRebookingCampaign,
  getRebookingCampaignResults,
  listRebookingCampaigns,
  scheduleRebookingCampaign,
  sendRebookingCampaign,
};
