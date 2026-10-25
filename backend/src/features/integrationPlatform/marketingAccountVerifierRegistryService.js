import IntegrationConnection from "../../models/IntegrationConnection.js";
import { createServiceError } from "../../shared/serviceError.js";
import {
  marketingAccountVerifierAvailable as coreVerifierAvailable,
  verifyMarketingConnectedAccount as verifyCoreMarketingConnectedAccount,
} from "./marketingAccountVerificationService.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS } from "./marketingAccountVerificationExtensions.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3 } from "./marketingAccountVerificationExtensionsWave3.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4 } from "./marketingAccountVerificationExtensionsWave4.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5 } from "./marketingAccountVerificationExtensionsWave5.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE6 } from "./marketingAccountVerificationExtensionsWave6.js";
import { MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE7 } from "./marketingAccountVerificationExtensionsWave7.js";

const EXTENSION_VERIFIERS = Object.freeze({
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS,
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE3,
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE4,
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE5,
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE6,
  ...MARKETING_ACCOUNT_VERIFIER_EXTENSIONS_WAVE7,
});

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function safeSummary(value = {}) {
  const result = {};
  for (const [key, raw] of Object.entries(value || {})) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      result[key] = typeof raw === "string" ? text(raw, 500) : raw;
    }
  }
  return result;
}

export function marketingAccountVerifierAvailable(provider) {
  const key = text(provider, 100).toLowerCase();
  return coreVerifierAvailable(key) || Boolean(EXTENSION_VERIFIERS[key]);
}

export async function verifyMarketingConnectedAccount(provider, { businessId } = {}) {
  const key = text(provider, 100).toLowerCase();
  const extensionVerifier = EXTENSION_VERIFIERS[key];
  if (!extensionVerifier) {
    return verifyCoreMarketingConnectedAccount(key, { businessId });
  }

  const connection = await IntegrationConnection.findOne({ business: businessId, provider: key });
  if (!connection || ["revoked", "disconnected"].includes(connection.status)) {
    throw createServiceError("Marketing provider connection is not available for verification.", 404);
  }

  try {
    const account = safeSummary(await extensionVerifier(connection));
    const now = new Date();
    connection.status = "connected";
    connection.connectedAt = now;
    connection.metadata = {
      ...(connection.metadata?.toObject?.() || connection.metadata || {}),
      verificationStatus: "verified",
      verifiedAt: now,
      verifiedAccount: account,
      verificationErrorCode: "",
    };
    await connection.save();
    return { verified: true, provider: key, verifiedAt: now, account };
  } catch (error) {
    connection.status = "pending";
    connection.connectedAt = null;
    connection.metadata = {
      ...(connection.metadata?.toObject?.() || connection.metadata || {}),
      verificationStatus: "failed",
      verifiedAt: null,
      verificationErrorCode: text(error?.code || "MARKETING_PROVIDER_VERIFICATION_FAILED", 120),
      verifiedAccount: null,
    };
    await connection.save();
    throw error;
  }
}

export default {
  marketingAccountVerifierAvailable,
  verifyMarketingConnectedAccount,
};