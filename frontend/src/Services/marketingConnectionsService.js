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

export function verifyMarketingAccount(provider) {
  return API.post(`${BASE_URL}/accounts/${encodeURIComponent(provider)}/verify`).then(responseData);
}

export function disconnectMarketingAccount(provider) {
  return API.post(`${BASE_URL}/accounts/${encodeURIComponent(provider)}/disconnect`).then(responseData);
}

export function getWindsorCatalogue() {
  return API.get(`${BASE_URL}/windsor/catalogue`).then(responseData);
}

export function authorizeWindsorConnector(connector) {
  return API.post(`${BASE_URL}/windsor/${encodeURIComponent(connector)}/authorize`).then(responseData);
}

export function reconcileWindsorConnector(connector) {
  return API.post(`${BASE_URL}/windsor/${encodeURIComponent(connector)}/reconcile`).then(responseData);
}

export function getWindsorConnectorFields(connector) {
  return API.get(`${BASE_URL}/windsor/${encodeURIComponent(connector)}/fields`).then(responseData);
}

export function previewWindsorConnector(connector, payload) {
  return API.post(`${BASE_URL}/windsor/${encodeURIComponent(connector)}/preview`, payload).then(responseData);
}

export function unlinkWindsorAccount(connector, accountId) {
  return API.delete(
    `${BASE_URL}/windsor/${encodeURIComponent(connector)}/accounts/${encodeURIComponent(accountId)}`
  ).then(responseData);
}

export default {
  authorizeWindsorConnector,
  configureMarketingAccount,
  disconnectMarketingAccount,
  getMarketingAccounts,
  getMarketingConnectionCatalogue,
  getWindsorCatalogue,
  getWindsorConnectorFields,
  previewWindsorConnector,
  reconcileWindsorConnector,
  unlinkWindsorAccount,
  verifyMarketingAccount,
};