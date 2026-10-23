import API from "../api/axios.js";

const ROOT = "/future/integrations/marketplace";

function arrayData(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

export async function getMarketplaceCatalogue() {
  return arrayData(await API.get(`${ROOT}/catalogue`));
}

export async function getMarketplaceInstallations() {
  return arrayData(await API.get(`${ROOT}/installations`));
}

export async function prepareMarketplaceInstallation(appId) {
  const { data } = await API.post(
    `${ROOT}/apps/${encodeURIComponent(appId)}/installations`,
    {}
  );
  return data;
}

export async function reconcileMarketplaceInstallation(installationId) {
  const { data } = await API.post(
    `${ROOT}/installations/${encodeURIComponent(installationId)}/reconcile`,
    {}
  );
  return data;
}

export default {
  getMarketplaceCatalogue,
  getMarketplaceInstallations,
  prepareMarketplaceInstallation,
  reconcileMarketplaceInstallation,
};
