import API from "../api/axios.js";

function data(response) {
  return response.data;
}

function encode(value, label) {
  const candidate = String(
    value || ""
  ).trim();

  if (!candidate) {
    throw new Error(
      `${label} is required.`
    );
  }

  return encodeURIComponent(
    candidate
  );
}

export const servicePackageService = {
  listCatalogue: () =>
    API.get(
      "/service-packages"
    ).then(data),

  listMine: (
    params = {}
  ) =>
    API.get(
      "/service-packages/mine",
      {
        params,
      }
    ).then(data),

  listManagement: (
    params = {}
  ) =>
    API.get(
      "/future/service-packages",
      {
        params,
      }
    ).then(data),

  create: (payload) =>
    API.post(
      "/future/service-packages",
      payload
    ).then(data),

  update: (
    id,
    payload
  ) =>
    API.patch(
      `/future/service-packages/${encode(
        id,
        "Service package ID"
      )}`,
      payload
    ).then(data),

  grant: (
    id,
    payload
  ) =>
    API.post(
      `/future/service-packages/${encode(
        id,
        "Service package ID"
      )}/entitlements`,
      payload
    ).then(data),

  listCustomerEntitlements: (
    customerId,
    params = {}
  ) =>
    API.get(
      `/future/service-packages/customers/${encode(
        customerId,
        "Customer ID"
      )}`,
      {
        params,
      }
    ).then(data),

  listRedemptions: (
    entitlementId
  ) =>
    API.get(
      `/future/service-packages/entitlements/${encode(
        entitlementId,
        "Entitlement ID"
      )}/redemptions`
    ).then(data),

  redeem: (
    entitlementId,
    payload
  ) =>
    API.post(
      `/future/service-packages/entitlements/${encode(
        entitlementId,
        "Entitlement ID"
      )}/redeem`,
      payload
    ).then(data),

  reverse: (
    redemptionId,
    payload
  ) =>
    API.post(
      `/future/service-packages/redemptions/${encode(
        redemptionId,
        "Redemption ID"
      )}/reverse`,
      payload
    ).then(data),
};

export default servicePackageService;
