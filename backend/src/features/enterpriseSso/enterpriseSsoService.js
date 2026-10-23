import mongoose from "mongoose";

import AuditLog from "../../models/AuditLog.js";
import EnterpriseSsoConnection, {
  ENTERPRISE_SSO_PROTOCOLS,
} from "../../models/EnterpriseSsoConnection.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";

const FORBIDDEN_SECRET_KEYS = Object.freeze([
  "secret",
  "privatekey",
  "password",
  "accesstoken",
  "refreshtoken",
]);

function text(value) {
  return String(value ?? "").trim();
}

function objectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(user) {
  const value = user?._id || user?.id || null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError("An authenticated federation administrator is required.", 401);
  }
  return value;
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function assertNoSecrets(value, path = "configuration") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalised = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_SECRET_KEYS.some((token) => normalised.includes(token))) {
      throw createServiceError(
        `Enterprise SSO secrets cannot be supplied in application configuration (${path}.${key}).`,
        422,
        {
          code: "ENTERPRISE_SSO_SECRET_INPUT_PROHIBITED",
          field: `${path}.${key}`,
        }
      );
    }
    if (child && typeof child === "object") {
      assertNoSecrets(child, `${path}.${key}`);
    }
  }
}

function httpsUrl(value, field, { optional = false } = {}) {
  const candidate = text(value);
  if (!candidate && optional) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error("https required");
    return url.toString();
  } catch {
    throw createServiceError(`${field} must be a valid HTTPS URL.`, 400, { field });
  }
}

function domains(value) {
  const items = [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => text(item).toLowerCase())
        .filter(Boolean)
    ),
  ];
  for (const domain of items) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      throw createServiceError(`Invalid enterprise SSO domain: ${domain}.`, 400, {
        field: "domains",
      });
    }
  }
  return items;
}

function protocol(value) {
  const selected = text(value).toLowerCase();
  if (!ENTERPRISE_SSO_PROTOCOLS.includes(selected)) {
    throw createServiceError("protocol must be oidc or saml.", 400, {
      field: "protocol",
    });
  }
  return selected;
}

function oidcScopes(value, { supplied = false } = {}) {
  if (supplied && !Array.isArray(value)) {
    throw createServiceError("oidc.scopes must be an array.", 400, {
      field: "oidc.scopes",
    });
  }

  const requested = Array.isArray(value)
    ? value.map((item) => text(item)).filter(Boolean)
    : ["profile", "email"];

  return [...new Set(["openid", ...requested])];
}

function normalisePublicConfiguration(payload = {}, selectedProtocol) {
  assertNoSecrets(payload);
  if (selectedProtocol === "oidc") {
    return {
      oidc: {
        issuerUrl: httpsUrl(payload.oidc?.issuerUrl, "oidc.issuerUrl"),
        clientId: text(payload.oidc?.clientId),
        scopes: oidcScopes(payload.oidc?.scopes, {
          supplied: Object.prototype.hasOwnProperty.call(payload.oidc || {}, "scopes"),
        }),
      },
      saml: undefined,
    };
  }

  return {
    oidc: undefined,
    saml: {
      entryPoint: httpsUrl(payload.saml?.entryPoint, "saml.entryPoint"),
      idpIssuer: text(payload.saml?.idpIssuer),
      idpSigningCertificate: text(payload.saml?.idpSigningCertificate),
      serviceProviderEntityId: text(payload.saml?.serviceProviderEntityId),
    },
  };
}

function readinessFor(connection) {
  const issues = [];
  if (!Array.isArray(connection.domains) || connection.domains.length === 0) {
    issues.push("At least one enterprise email domain must be configured and externally verified before activation.");
  }

  if (connection.protocol === "oidc") {
    if (!text(connection.oidc?.issuerUrl)) issues.push("OIDC issuer URL is missing.");
    if (!text(connection.oidc?.clientId)) issues.push("OIDC client ID is missing.");
    issues.push(
      "OIDC runtime/credential integration is not installed; use a vetted OIDC client and governed credential store before activation."
    );
  } else {
    if (!text(connection.saml?.entryPoint)) issues.push("SAML IdP entry point is missing.");
    if (!text(connection.saml?.idpIssuer)) issues.push("SAML IdP issuer is missing.");
    if (!text(connection.saml?.idpSigningCertificate)) {
      issues.push("SAML IdP signing certificate is missing.");
    }
    if (!text(connection.saml?.serviceProviderEntityId)) {
      issues.push("SAML service-provider entity ID is missing.");
    }
    issues.push(
      "SAML runtime/SP signing-key integration is not installed; assertion validation must use a vetted SAML library before activation."
    );
  }

  const staticConfigurationValid =
    issues.filter((issue) => !issue.includes("runtime/")).length === 0;

  return {
    staticConfigurationValid,
    runtimeAvailable: false,
    providerAccepted: false,
    activationAllowed: false,
    checkedAt: new Date(),
    issues,
  };
}

function serialise(connection) {
  const value =
    typeof connection?.toObject === "function"
      ? connection.toObject()
      : { ...(connection || {}) };
  if (value.saml) {
    const certificateConfigured = Boolean(
      connection?.saml?.idpSigningCertificate || value.saml?.idpSigningCertificate
    );
    delete value.saml.idpSigningCertificate;
    value.saml.idpSigningCertificateConfigured = certificateConfigured;
  }
  return value;
}

export async function listEnterpriseSsoConnections({ businessId } = {}) {
  objectId(businessId, "business");
  const items = await EnterpriseSsoConnection.find({ business: businessId })
    .select("+saml.idpSigningCertificate")
    .sort({ displayName: 1, _id: 1 });
  return items.map(serialise);
}

export async function createEnterpriseSsoConnection(
  payload = {},
  { businessId, user } = {}
) {
  objectId(businessId, "business");
  const actor = actorId(user);
  const selectedProtocol = protocol(payload.protocol);
  const displayName = text(payload.displayName);
  const key = slug(payload.key || displayName);
  if (!displayName || !key) {
    throw createServiceError("Enterprise SSO displayName is required.", 400);
  }

  const publicConfig = normalisePublicConfiguration(payload, selectedProtocol);
  const connection = await EnterpriseSsoConnection.create({
    business: businessId,
    key,
    displayName,
    protocol: selectedProtocol,
    status: "draft",
    domains: domains(payload.domains),
    ...publicConfig,
    readiness: {
      staticConfigurationValid: false,
      runtimeAvailable: false,
      providerAccepted: false,
      activationAllowed: false,
      issues: ["Readiness has not yet been evaluated."],
    },
    runtimeEnabled: false,
    createdBy: actor,
    updatedBy: actor,
    metadata: payload.metadata || {},
  });
  return serialise(connection);
}

export async function updateEnterpriseSsoConnection(
  connectionId,
  payload = {},
  { businessId, user } = {}
) {
  objectId(connectionId, "enterpriseSsoConnection");
  const actor = actorId(user);
  const connection = assertFound(
    await EnterpriseSsoConnection.findOne({
      _id: connectionId,
      business: businessId,
    }).select("+saml.idpSigningCertificate"),
    "Enterprise SSO connection not found."
  );
  assertNoSecrets(payload);

  if (payload.protocol && protocol(payload.protocol) !== connection.protocol) {
    throw createServiceError(
      "Enterprise SSO protocol cannot be changed in place; create a new connection.",
      409
    );
  }
  if (payload.displayName !== undefined) connection.displayName = text(payload.displayName);
  if (payload.domains !== undefined) connection.domains = domains(payload.domains);

  if (connection.protocol === "oidc" && payload.oidc) {
    if (payload.oidc.issuerUrl !== undefined) {
      connection.oidc.issuerUrl = httpsUrl(payload.oidc.issuerUrl, "oidc.issuerUrl");
    }
    if (payload.oidc.clientId !== undefined) connection.oidc.clientId = text(payload.oidc.clientId);
    if (payload.oidc.scopes !== undefined) {
      connection.oidc.scopes = oidcScopes(payload.oidc.scopes, { supplied: true });
    }
  }
  if (connection.protocol === "saml" && payload.saml) {
    if (payload.saml.entryPoint !== undefined) {
      connection.saml.entryPoint = httpsUrl(payload.saml.entryPoint, "saml.entryPoint");
    }
    if (payload.saml.idpIssuer !== undefined) connection.saml.idpIssuer = text(payload.saml.idpIssuer);
    if (payload.saml.idpSigningCertificate !== undefined) {
      connection.saml.idpSigningCertificate = text(payload.saml.idpSigningCertificate);
    }
    if (payload.saml.serviceProviderEntityId !== undefined) {
      connection.saml.serviceProviderEntityId = text(payload.saml.serviceProviderEntityId);
    }
  }

  connection.status = "draft";
  connection.runtimeEnabled = false;
  connection.readiness = {
    staticConfigurationValid: false,
    runtimeAvailable: false,
    providerAccepted: false,
    activationAllowed: false,
    checkedAt: null,
    issues: ["Configuration changed; readiness must be evaluated again."],
  };
  connection.updatedBy = actor;
  await connection.save();
  return serialise(connection);
}

export async function checkEnterpriseSsoReadiness(
  connectionId,
  { businessId, user, requestId = "" } = {}
) {
  objectId(connectionId, "enterpriseSsoConnection");
  const actor = actorId(user);
  const connection = assertFound(
    await EnterpriseSsoConnection.findOne({
      _id: connectionId,
      business: businessId,
    }).select("+saml.idpSigningCertificate"),
    "Enterprise SSO connection not found."
  );

  const readiness = readinessFor(connection);
  connection.readiness = readiness;
  connection.status = readiness.staticConfigurationValid ? "validated" : "draft";
  connection.runtimeEnabled = false;
  connection.updatedBy = actor;
  await connection.save();

  await AuditLog.create({
    actor,
    action: "enterprise_sso.readiness_checked",
    resourceType: "EnterpriseSsoConnection",
    resourceId: String(connection._id),
    requestId: text(requestId),
    after: {
      protocol: connection.protocol,
      status: connection.status,
      staticConfigurationValid: readiness.staticConfigurationValid,
      runtimeAvailable: false,
      activationAllowed: false,
    },
    metadata: { businessId: String(businessId) },
  });

  return serialise(connection);
}

export default {
  checkEnterpriseSsoReadiness,
  createEnterpriseSsoConnection,
  listEnterpriseSsoConnections,
  updateEnterpriseSsoConnection,
};
