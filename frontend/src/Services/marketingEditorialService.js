import API from "../api/axios.js";

const BASE = "/marketing-editorial";
const unwrap = (response) => response.data;

export const listPlacements = (params = {}) =>
  API.get(`${BASE}/editorial-placements`, { params }).then(unwrap);
export const createPlacement = (payload) =>
  API.post(`${BASE}/editorial-placements`, payload).then(unwrap);
export const transitionPlacement = (id, payload) =>
  API.post(`${BASE}/editorial-placements/${encodeURIComponent(id)}/transition`, payload).then(unwrap);
export const listBacklinks = (params = {}) =>
  API.get(`${BASE}/backlinks`, { params }).then(unwrap);
export const addManualBacklink = (payload) =>
  API.post(`${BASE}/backlinks/manual`, payload).then(unwrap);
export const getMonthlyBacklinks = (month) =>
  API.get(`${BASE}/backlinks/monthly`, { params: { month } }).then(unwrap);
