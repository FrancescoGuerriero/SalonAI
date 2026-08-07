import API from "../api/axios.js";

const payload = (response) => response.data;

const customerExperienceService = {
  getMine: () => API.get("/customer-experience/me").then(payload),
  updateConsents: (data) => API.patch("/customer-experience/me/consents", data).then(payload),
  addReview: (data) => API.post("/customer-experience/me/reviews", data).then(payload),
  addFavourite: (data) => API.post("/customer-experience/me/favourites", data).then(payload),
  removeFavourite: (id) => API.delete(`/customer-experience/me/favourites/${id}`).then(payload),
  claimOffer: (code) => API.post("/customer-experience/me/offers/claim", { code }).then(payload),
  addWalletCard: (data) => API.post("/customer-experience/me/wallet", data).then(payload),
  removeWalletCard: (id) => API.delete(`/customer-experience/me/wallet/${id}`).then(payload),
  createAppointmentRequest: (data) => API.post("/customer-experience/me/appointment-requests", data).then(payload),
  updateDiscovery: (data) => API.patch("/customer-experience/me/discovery", data).then(payload),
  addConsultation: (data) => API.post("/customer-experience/me/consultations", data).then(payload),
  addInspiration: (data) => API.post("/customer-experience/me/inspiration", data).then(payload),
  removeInspiration: (id) => API.delete(`/customer-experience/me/inspiration/${id}`).then(payload),
  addFeedback: (data) => API.post("/customer-experience/me/feedback", data).then(payload),
  markInboxRead: (id) => API.patch(`/customer-experience/me/inbox/${id}/read`).then(payload),
  createReferral: (data) => API.post("/referrals", data).then(payload),
  getManagementOverview: () => API.get("/customer-experience/management/overview").then(payload),
  createOffer: (data) => API.post("/customer-experience/management/offers", data).then(payload),
  updateOffer: (id, data) => API.patch(`/customer-experience/management/offers/${id}`, data).then(payload),
  resolveAppointmentRequest: (id, data) => API.patch(`/customer-experience/management/appointment-requests/${id}`, data).then(payload),
  updateReviewStatus: (id, status) => API.patch(`/customer-experience/management/reviews/${id}`, { status }).then(payload),
  updateFeedbackStatus: (id, status) => API.patch(`/customer-experience/management/feedback/${id}`, { status }).then(payload),
  updateConsultationStatus: (id, status) => API.patch(`/customer-experience/management/consultations/${id}`, { status }).then(payload),
};

export default customerExperienceService;
