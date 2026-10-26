import { createServiceError } from "../../shared/serviceError.js";
import { resolveProviderCredential } from "./providerCredentialService.js";

const TIMEOUT_MS = 15000;
const MIXPANEL_REGION_HOSTS = Object.freeze({
  US: "mixpanel.com",
  EU: "eu.mixpanel.com",
  IN: "in.mixpanel.com",
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

async function requestJson(url, options = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw createServiceError("Provider verification requires HTTPS.", 502, {
      code: "MARKETING_PROVIDER_UNSAFE_VERIFICATION_URL",
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(parsed, {
      ...options,
      signal: controller.signal,
      redirect: "error",
    });
    const raw = await response.text();
    let body = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = { raw: text(raw, 1000) };
      }
    }
    if (!response.ok) {
      throw createServiceError(
        `Provider account verification failed with HTTP ${response.status}.`,
        409,
        {
          code: "MARKETING_PROVIDER_VERIFICATION_FAILED",
          providerStatus: response.status,
        }
      );
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createServiceError("Provider account verification timed out.", 504, {
        code: "MARKETING_PROVIDER_VERIFICATION_TIMEOUT",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function credential(connection, role) {
  return (await resolveProviderCredential(connection, role)).secret;
}

async function verifyExchangeRates(connection) {
  const appId = await credential(connection, "api_key");
  const body = await requestJson("https://openexchangerates.org/api/latest.json?symbols=GBP,EUR,USD", {
    headers: {
      authorization: `Token ${appId}`,
      accept: "application/json",
    },
  });
  if (!body?.rates || typeof body.rates !== "object") {
    throw createServiceError(
      "Open Exchange Rates did not return current rate data for this App ID.",
      409,
      { code: "MARKETING_PROVIDER_VERIFICATION_FAILED" }
    );
  }
  return {
    accountId: "openexchangerates",
    accountName: "Open Exchange Rates",
    baseCurrency: body.base || "USD",
    rateCount: Object.keys(body.rates).length,
    publishedAt: body.timestamp ? new Date(Number(body.timestamp) * 1000).toISOString() : "",
  };
}

function mixpanelProject(body, projectId) {
  const projects = body?.results?.projects || body?.projects || null;
  if (Array.isArray(projects)) {
    return projects.find((project) => String(project?.id || project?.project_id) === String(projectId)) || null;
  }
  if (projects && typeof projects === "object") {
    return projects[String(projectId)] ||
      Object.values(projects).find((project) => String(project?.id || project?.project_id) === String(projectId)) ||
      null;
  }
  return null;
}

async function verifyMixpanel(connection) {
  const username = text(connection.metadata?.serviceAccountUsername, 500);
  const projectId = text(connection.metadata?.projectId, 100);
  const region = text(connection.metadata?.region || "US", 10).toUpperCase();
  const host = MIXPANEL_REGION_HOSTS[region];
  if (!username) {
    throw createServiceError("Mixpanel service-account username is required.", 400, {
      field: "serviceAccountUsername",
    });
  }
  if (!/^\d+$/.test(projectId)) {
    throw createServiceError("Mixpanel project ID must be numeric.", 400, {
      field: "projectId",
    });
  }
  if (!host) {
    throw createServiceError("Mixpanel region must be US, EU or IN.", 400, {
      field: "region",
    });
  }
  const secret = await credential(connection, "password");
  const authorization = Buffer.from(`${username}:${secret}`).toString("base64");
  const body = await requestJson(`https://${host}/api/app/me`, {
    headers: {
      authorization: `Basic ${authorization}`,
      accept: "application/json",
    },
  });
  const project = mixpanelProject(body, projectId);
  if (!project) {
    throw createServiceError(
      "Mixpanel authenticated the service account but did not confirm access to the configured project.",
      409,
      { code: "MARKETING_PROVIDER_PROJECT_ACCESS_NOT_VERIFIED" }
    );
  }
  return {
    accountId: projectId,
    accountName: project?.name || project?.project_name || `Mixpanel project ${projectId}`,
    region,
    serviceAccountUsername: username,
  };
}

export const MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE10 = Object.freeze({
  exchange_rates: verifyExchangeRates,
  mixpanel: verifyMixpanel,
});

export default MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE10;
