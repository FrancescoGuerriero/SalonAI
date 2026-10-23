import API from "../api/axios.js";

const payload = (response) => response.data;

const customerExperienceService = {
  getMine: () => API.get("/customer-experience/me").then(payload),
  updateConsents: (data) => API.patch("/customer-experience/me/consents", data).then(payload),
  checkIn: (appointmentId) => API.post("/customer-experience/me/check-in", { appointmentId }).then(payload),
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

  getRelationships: () => API.get("/customer-experience/relationships/me").then(payload),
  inviteRelationship: (data) => API.post("/customer-experience/relationships/me", data).then(payload),
  respondRelationship: (id, status) => API.patch(`/customer-experience/relationships/me/${id}`, { status }).then(payload),
  revokeRelationship: (id) => API.delete(`/customer-experience/relationships/me/${id}`).then(payload),

  getManagementOverview: () => API.get("/customer-experience/management/overview").then(payload),
  getReputationOverview: () => API.get("/customer-experience/management/reputation").then(payload),
  updateReputation: (id, data) => API.patch(`/customer-experience/management/reputation/${id}`, data).then(payload),
  getBookingRecoveryMetrics: () => API.get("/customer-experience/management/booking-recovery-metrics").then(payload),
  createOffer: (data) => API.post("/customer-experience/management/offers", data).then(payload),
  updateOffer: (id, data) => API.patch(`/customer-experience/management/offers/${id}`, data).then(payload),
  resolveAppointmentRequest: (id, data) => API.patch(`/customer-experience/management/appointment-requests/${id}`, data).then(payload),
  updateReviewStatus: (id, status) => API.patch(`/customer-experience/management/reviews/${id}`, { status }).then(payload),
  updateFeedbackStatus: (id, status) => API.patch(`/customer-experience/management/feedback/${id}`, { status }).then(payload),
  updateConsultationStatus: (id, status) => API.patch(`/customer-experience/management/consultations/${id}`, { status }).then(payload),

  listContentPages: () => API.get("/customer-experience/content/management/pages").then(payload),
  createContentPage: (data) => API.post("/customer-experience/content/management/pages", data).then(payload),
  updateContentPage: (id, data) => API.patch(`/customer-experience/content/management/pages/${id}`, data).then(payload),
  previewContentPage: (id, locale) => API.get(`/customer-experience/content/management/pages/${id}/preview`, { params: { locale } }).then(payload),
  publishContentPage: (id) => API.post(`/customer-experience/content/management/pages/${id}/publish`).then(payload),
  archiveContentPage: (id) => API.post(`/customer-experience/content/management/pages/${id}/archive`).then(payload),
  getPublishedContentPage: (slug, locale) => API.get(`/customer-experience/content/pages/${encodeURIComponent(slug)}`, { params: { locale } }).then(payload),
};

export default customerExperienceService;