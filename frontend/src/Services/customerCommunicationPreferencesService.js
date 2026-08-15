import API from "../api/axios.js";

const ENDPOINT = "/customer-experience/me/communications";

export function getCustomerCommunicationPreferences() {
  return API.get(ENDPOINT);
}

export function updateCustomerCommunicationPreferences(data) {
  return API.patch(ENDPOINT, data);
}

export default {
  getCustomerCommunicationPreferences,
  updateCustomerCommunicationPreferences,
};
