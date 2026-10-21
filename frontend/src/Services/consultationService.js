import API from "../api/axios.js";

const BASE = "/consultations";

export async function listConsultations(params = {}) {
  const response = await API.get(BASE, { params });
  return response.data;
}

export async function getConsultation(consultationId) {
  const response = await API.get(`${BASE}/${consultationId}`);
  return response.data?.consultation;
}

export async function requestConsultationAssistance(consultationId) {
  const response = await API.post(`${BASE}/${consultationId}/assist`);
  return response.data?.consultation;
}

export async function reviewConsultation(consultationId, payload) {
  const response = await API.post(`${BASE}/${consultationId}/review`, payload);
  return response.data?.consultation;
}

export async function approveConsultation(consultationId, payload = {}) {
  const response = await API.post(`${BASE}/${consultationId}/approve`, payload);
  return response.data?.consultation;
}

export async function bookConsultation(consultationId, payload) {
  const response = await API.post(`${BASE}/${consultationId}/book`, payload);
  return response.data;
}

export async function assignConsultationReviewer(consultationId, reviewerId) {
  const response = await API.post(`${BASE}/${consultationId}/assign`, {
    reviewerId,
  });
  return response.data?.consultation;
}

export async function updateConsultation(consultationId, payload) {
  const response = await API.patch(`${BASE}/${consultationId}`, payload);
  return response.data?.consultation;
}

export default {
  approveConsultation,
  assignConsultationReviewer,
  bookConsultation,
  getConsultation,
  listConsultations,
  requestConsultationAssistance,
  reviewConsultation,
  updateConsultation,
};
