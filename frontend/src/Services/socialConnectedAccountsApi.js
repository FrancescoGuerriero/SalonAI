import API from "../api/axios.js";

const BASE_URL = "/integration-platform/connected-accounts";

function responseData(response) {
  return response.data;
}

export function getConnectedAccounts() {
  return API.get(BASE_URL).then(responseData);
}

export function connectAccount(provider, payload) {
  return API.put(
    `${BASE_URL}/${encodeURIComponent(provider)}`,
    payload
  ).then(responseData);
}

export function disconnectAccount(provider) {
  return API.post(
    `${BASE_URL}/${encodeURIComponent(provider)}/disconnect`
  ).then(responseData);
}

export default {
  connectAccount,
  disconnectAccount,
  getConnectedAccounts,
};
