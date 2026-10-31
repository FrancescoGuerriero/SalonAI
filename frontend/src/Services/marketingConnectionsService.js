import API from "../api/axios.js";

const BASE_URL = "/integration-platform/marketing-connections";
const DATA_CONNECTIONS_URL = `${BASE_URL}/data-connections`;

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

export function getManagedDataConnectionCatalogue() {
  return API.get(`${DATA_CONNECTIONS_URL}/catalogue`).then(responseData);
}

export function authorizeManagedDataConnection(connector) {
  return API.post(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/authorize`).then(responseData);
}

export function reconcileManagedDataConnection(connector) {
  return API.post(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/reconcile`).then(responseData);
}

export function getManagedDataConnectionFields(connector) {
  return API.get(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/fields`).then(responseData);
}

export function getManagedDataConnectionProfiles(connector) {
  return API.get(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/profiles`).then(responseData);
}

export function previewManagedDataConnection(connector, payload) {
  return API.post(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/preview`, payload).then(responseData);
}

export function importManagedDataConnection(connector, payload) {
  return API.post(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/import`, payload).then(responseData);
}

export function backfillManagedDataConnection(connector, payload) {
  return API.post(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/backfill`, payload).then(responseData);
}

export function getManagedSellerKpis(connector, { sourceId, profile } = {}) {
  return API.get(`${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/seller-kpis`, {
    params: { sourceId, profile },
  }).then(responseData);
}

export function unlinkManagedDataAccount(connector, accountId) {
  return API.delete(
    `${DATA_CONNECTIONS_URL}/${encodeURIComponent(connector)}/accounts/${encodeURIComponent(accountId)}`
  ).then(responseData);
}

export default {
  authorizeManagedDataConnection,
  backfillManagedDataConnection,
  configureMarketingAccount,
  disconnectMarketingAccount,
  getManagedDataConnectionCatalogue,
  getManagedDataConnectionFields,
  getManagedDataConnectionProfiles,
  getManagedSellerKpis,
  getMarketingAccounts,
  getMarketingConnectionCatalogue,
  importManagedDataConnection,
  previewManagedDataConnection,
  reconcileManagedDataConnection,
  unlinkManagedDataAccount,
  verifyMarketingAccount,
};
