function text(value) {
  return String(value ?? "").trim();
}

function frontendBaseUrl(environment = process.env) {
  return (
    text(environment.FRONTEND_URL) ||
    text(environment.APPLICATION_BASE_URL) ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value).toLowerCase());
}

export function getLegalComplianceConfig(
  environment = process.env
) {
  const baseUrl = frontendBaseUrl(environment);

  return {
    businessName:
      text(environment.LEGAL_BUSINESS_NAME) ||
      text(environment.APPLICATION_NAME) ||
      "SalonAI",
    tradingName:
      text(environment.LEGAL_TRADING_NAME) ||
      "SalonAI",
    companyNumber:
      text(environment.LEGAL_COMPANY_NUMBER),
    registeredJurisdiction:
      text(environment.LEGAL_REGISTERED_JURISDICTION) ||
      "United Kingdom",
    postalAddress:
      text(environment.LEGAL_POSTAL_ADDRESS),
    privacyEmail:
      text(environment.PRIVACY_CONTACT_EMAIL).toLowerCase(),
    privacyPolicyVersion:
      text(environment.PRIVACY_POLICY_VERSION) ||
      "2026-09",
    privacyPolicyUrl:
      text(environment.PRIVACY_POLICY_URL) ||
      `${baseUrl}/privacy`,
    preferenceCenterUrl:
      text(environment.MARKETING_PREFERENCE_URL) ||
      `${baseUrl}/communication-preferences`,
    marketingPreferenceTokenSecret:
      text(environment.MARKETING_PREFERENCE_TOKEN_SECRET) ||
      text(environment.JWT_SECRET),
  };
}

export function getMarketingComplianceReadiness(
  environment = process.env
) {
  const config =
    getLegalComplianceConfig(environment);

  const checks = {
    businessName:
      Boolean(config.businessName),
    postalAddress:
      Boolean(config.postalAddress),
    privacyEmail:
      isEmail(config.privacyEmail),
    privacyPolicyUrl:
      /^https?:\/\//i.test(config.privacyPolicyUrl),
    preferenceCenterUrl:
      /^https?:\/\//i.test(config.preferenceCenterUrl),
    preferenceTokenSecret:
      config.marketingPreferenceTokenSecret.length >= 32,
  };

  const blockers =
    Object.entries(checks)
      .filter(([, ready]) => ready !== true)
      .map(([name]) => name);

  return {
    ready: blockers.length === 0,
    checks,
    blockers,
    publicIdentity: {
      businessName: config.businessName,
      tradingName: config.tradingName,
      companyNumber: config.companyNumber,
      registeredJurisdiction: config.registeredJurisdiction,
      postalAddress: config.postalAddress,
      privacyEmail: config.privacyEmail,
      privacyPolicyVersion: config.privacyPolicyVersion,
      privacyPolicyUrl: config.privacyPolicyUrl,
      preferenceCenterUrl: config.preferenceCenterUrl,
    },
  };
}

export function getPublicLegalIdentity(
  environment = process.env
) {
  return getMarketingComplianceReadiness(environment)
    .publicIdentity;
}

export default {
  getLegalComplianceConfig,
  getMarketingComplianceReadiness,
  getPublicLegalIdentity,
};
