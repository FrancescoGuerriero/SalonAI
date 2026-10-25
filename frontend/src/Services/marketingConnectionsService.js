import API from "../api/axios.js";

const BASE_URL = "/integration-platform/marketing-connections";

function responseData(response) {
  return response.data;
}

export function getMarketingConnectionCatalogue() {
  return API.get(`${BASE_URL}/catalogue`).then(responseData);
}

export function getMarketingAccounts() {
  return API.get(`${BASE_URL}/accounts`).then(responseData);
}

export function configureMarketingAccount(provider, payload) {
  return API.put(`${BASE_URL}/accounts/${encodeURIComponent(provider)}`, payload).then(responseData);
}

export function disconnectMarketingAccount(provider) {
  return API.post(`${BASE_URL}/accounts/${encodeURIComponent(provider)}/disconnect`).then(responseData);
}

export default {
  configureMarketingAccount,
  disconnectMarketingAccount,
  getMarketingAccounts,
  getMarketingConnectionCatalogue,
};
