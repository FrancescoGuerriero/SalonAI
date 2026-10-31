import API from "../api/axios.js";

const BASE_URL = "/future/memberships";

function data(response) {
  return response.data;
}

export function getMembershipPlans(params = {}) {
  return API.get(`${BASE_URL}/plans`, { params }).then(data);
}

export function createMembershipPlan(payload) {
  return API.post(`${BASE_URL}/plans`, payload).then(data);
}

export function updateMembershipPlan(planId, payload) {
  return API.patch(`${BASE_URL}/plans/${encodeURIComponent(planId)}`, payload).then(data);
}

export function getMembershipContracts(params = {}) {
  return API.get(`${BASE_URL}/contracts`, { params }).then(data);
}

export function getMembershipContract(contractId) {
  return API.get(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}`).then(data);
}

export function createMembershipContract(payload) {
  return API.post(`${BASE_URL}/contracts`, payload).then(data);
}

export function updateMembershipContract(contractId, payload) {
  return API.patch(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}`, payload).then(data);
}

export function freezeMembershipContract(contractId, payload = {}) {
  return API.post(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}/freeze`, payload).then(data);
}

export function resumeMembershipContract(contractId) {
  return API.post(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}/resume`).then(data);
}

export function recordMembershipCollection(contractId, payload) {
  return API.post(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}/collections`, payload).then(data);
}

export function getMembershipBenefits(contractId) {
  return API.get(`${BASE_URL}/contracts/${encodeURIComponent(contractId)}/benefits`).then(data);
}

export default {
  createMembershipContract,
  createMembershipPlan,
  freezeMembershipContract,
  getMembershipBenefits,
  getMembershipContract,
  getMembershipContracts,
  getMembershipPlans,
  recordMembershipCollection,
  resumeMembershipContract,
  updateMembershipContract,
  updateMembershipPlan,
};
