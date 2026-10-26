import API from "../api/axios.js";

const BASE_URL = "/retention-automation/journeys";
const STAGE7_ROOT = "/retention-automation";

async function listRetentionJourneys() {
  const response = await API.get(BASE_URL);
  return {
    journeys: Array.isArray(response.data?.journeys)
      ? response.data.journeys
      : [],
  };
}

async function createRetentionJourney(payload) {
  const response = await API.post(BASE_URL, payload);
  return response.data;
}

async function previewRetentionJourney(journeyId, { limit = 50 } = {}) {
  const response = await API.get(
    BASE_URL + "/" + encodeURIComponent(journeyId) + "/preview",
    { params: { limit } }
  );
  return response.data?.preview || null;
}

async function updateRetentionJourney(journeyId, payload) {
  const response = await API.patch(
    BASE_URL + "/" + encodeURIComponent(journeyId),
    payload
  );
  return response.data;
}

async function getCustomer360(customerId) {
  const response = await API.get(
    STAGE7_ROOT + "/customers/" + encodeURIComponent(customerId) + "/360"
  );
  return response.data?.projection || null;
}

async function getPoint9Customer360(customerId) {
  const response = await API.get(
    STAGE7_ROOT + "/crm/customers/" + encodeURIComponent(customerId) + "/360"
  );
  return response.data?.projection || null;
}

async function listCrmSegments({ limit = 100 } = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/crm/segments",
    { params: { limit } }
  );
  return Array.isArray(response.data?.customers)
    ? response.data.customers
    : [];
}

async function listRetentionQueue({ limit = 250, state = "" } = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/crm/retention-queue",
    { params: { limit, ...(state ? { state } : {}) } }
  );
  return response.data || { queue: [] };
}

async function listRetentionOpportunities({ limit = 100, type = "" } = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/crm/opportunities",
    { params: { limit, ...(type ? { type } : {}) } }
  );
  return response.data || { opportunities: [] };
}

async function listCrmActionDrafts(params = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/crm/action-drafts",
    { params }
  );
  return response.data || { drafts: [] };
}

async function createCrmActionDraft(payload) {
  const response = await API.post(
    STAGE7_ROOT + "/crm/action-drafts",
    payload
  );
  return response.data?.draft || null;
}

async function updateCrmActionDraft(draftId, payload) {
  const response = await API.patch(
    STAGE7_ROOT + "/crm/action-drafts/" + encodeURIComponent(draftId),
    payload
  );
  return response.data?.draft || null;
}

async function listClientTechnicalRecords(customerId, { limit = 100 } = {}) {
  const response = await API.get(
    STAGE7_ROOT +
      "/crm/customers/" +
      encodeURIComponent(customerId) +
      "/technical-records",
    { params: { limit } }
  );
  return response.data || { records: [] };
}

async function createClientTechnicalRecord(customerId, payload) {
  const response = await API.post(
    STAGE7_ROOT +
      "/crm/customers/" +
      encodeURIComponent(customerId) +
      "/technical-records",
    payload
  );
  return response.data?.record || null;
}

async function listJourneyEnrollments(params = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/enrollments",
    { params }
  );
  return Array.isArray(response.data?.enrollments)
    ? response.data.enrollments
    : [];
}

async function createJourneyEnrollment(payload) {
  const response = await API.post(
    STAGE7_ROOT + "/enrollments",
    payload
  );
  return response.data;
}

async function recordJourneyOutcome(enrollmentId, outcome) {
  const response = await API.patch(
    STAGE7_ROOT +
      "/enrollments/" +
      encodeURIComponent(enrollmentId) +
      "/outcome",
    { outcome }
  );
  return response.data;
}

async function reconcileMembershipRecoveryJourneys({ limit = 100 } = {}) {
  const response = await API.post(
    STAGE7_ROOT + "/membership-recovery/reconcile",
    { limit }
  );
  return response.data?.result || null;
}

async function getCampaignJourneyRevenue({ campaignId = null } = {}) {
  const response = await API.get(
    STAGE7_ROOT + "/measurement/campaign-revenue",
    { params: campaignId ? { campaignId } : {} }
  );
  return Array.isArray(response.data?.rows)
    ? response.data.rows
    : [];
}

export {
  createClientTechnicalRecord,
  createCrmActionDraft,
  createJourneyEnrollment,
  createRetentionJourney,
  getCampaignJourneyRevenue,
  getCustomer360,
  getPoint9Customer360,
  listClientTechnicalRecords,
  listCrmActionDrafts,
  listCrmSegments,
  listJourneyEnrollments,
  listRetentionJourneys,
  listRetentionOpportunities,
  listRetentionQueue,
  previewRetentionJourney,
  reconcileMembershipRecoveryJourneys,
  recordJourneyOutcome,
  updateCrmActionDraft,
  updateRetentionJourney,
};

export default {
  createClientTechnicalRecord,
  createCrmActionDraft,
  createJourneyEnrollment,
  createRetentionJourney,
  getCampaignJourneyRevenue,
  getCustomer360,
  getPoint9Customer360,
  listClientTechnicalRecords,
  listCrmActionDrafts,
  listCrmSegments,
  listJourneyEnrollments,
  listRetentionJourneys,
  listRetentionOpportunities,
  listRetentionQueue,
  previewRetentionJourney,
  reconcileMembershipRecoveryJourneys,
  recordJourneyOutcome,
  updateCrmActionDraft,
  updateRetentionJourney,
};
