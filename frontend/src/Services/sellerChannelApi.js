import API from "../api/axios.js";

const ROOT = "/future/seller-channels";
const scoped = (connectionId) => `${ROOT}/${encodeURIComponent(String(connectionId))}`;

export async function listSellerConnections() {
  const { data } = await API.get(`${ROOT}/connections`);
  return data?.result?.connections || [];
}

export async function diagnoseSellerConnection(connectionId) {
  const { data } = await API.post(`${scoped(connectionId)}/diagnose`, {});
  return data?.result;
}

export async function getSellerImportStatus(connectionId) {
  const { data } = await API.get(`${scoped(connectionId)}/import-status`);
  return data?.result;
}

export async function stageSellerRecords(connectionId, kind) {
  if (!["listings", "orders"].includes(kind)) throw new Error("Unsupported seller staging kind");
  const { data } = await API.post(`${scoped(connectionId)}/stage/${kind}`, {});
  return data?.result;
}

export async function listSellerLocationMappingCandidates(connectionId) {
  const { data } = await API.get(`${scoped(connectionId)}/location-mapping-proposals`, {
    params: { limit: 25 },
  });
  return data?.result;
}

export async function proposeSellerLocationMappingCandidate(connectionId, candidate) {
  const { externalListingId, commerceProductId, commerceLocationId } = candidate || {};
  const { data } = await API.post(
    `${scoped(connectionId)}/location-mapping-proposals`,
    { externalListingId, commerceProductId, commerceLocationId }
  );
  return data?.result;
}

export async function withdrawSellerLocationMappingCandidate(connectionId, externalListingId, reason) {
  if (!["operator_error", "source_changed", "commerce_moved",
    "provider_disconnected", "other"].includes(reason)) {
    throw new Error("Unsupported mapping withdrawal reason");
  }
  const { data } = await API.post(
    `${scoped(connectionId)}/location-mapping-proposals/${encodeURIComponent(externalListingId)}/withdraw`,
    { reason }
  );
  return data?.result;
}

export async function getSellerReconciliation(connectionId) {
  const { data } = await API.get(`${scoped(connectionId)}/reconciliation`, {
    params: { limit: 25 },
  });
  return data?.result;
}

export async function getSellerOrderLinks(connectionId) {
  const { data } = await API.get(`${scoped(connectionId)}/order-links`, {
    params: { limit: 25 },
  });
  return data?.result;
}

export async function getSellerOwnershipBatch(connectionId) {
  const { data } = await API.get(`${scoped(connectionId)}/order-ownership-batch`, {
    params: { limit: 10 },
  });
  return data?.result;
}

export async function proposeSellerOrderLink(connectionId, externalOrderId, commerceOrderId) {
  const { data } = await API.post(
    `${scoped(connectionId)}/order-links/${encodeURIComponent(externalOrderId)}/propose`,
    { commerceOrderId }
  );
  return data?.result;
}

export async function reviewSellerOrderLink(connectionId, externalOrderId, action, reason = "") {
  if (!["hold", "reopen"].includes(action)) throw new Error("Unsupported review action");
  const { data } = await API.post(
    `${scoped(connectionId)}/order-links/${encodeURIComponent(externalOrderId)}/review`,
    { action, reason }
  );
  return data?.result;
}
