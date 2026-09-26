import {
  normaliseTenantHost,
} from "./tenantHost.js";

export const CANONICAL_SALON_BUSINESS_TYPE = "salon";

function bootstrapError(message, code = "INVALID_CANONICAL_TENANT_BOOTSTRAP") {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function slug(value, label) {
  const text = clean(value).toLowerCase();

  if (
    !text ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text) ||
    text.length < 2 ||
    text.length > 80
  ) {
    throw bootstrapError(
      `${label} must be a 2-80 character lowercase URL-safe slug.`
    );
  }

  return text;
}

function currency(value) {
  const text = clean(value, "GBP").toUpperCase();

  if (!/^[A-Z]{3}$/.test(text)) {
    throw bootstrapError(
      "Canonical tenant currency must be a three-letter code."
    );
  }

  return text;
}

function canonicalDomains(environment) {
  const domains = [
    Object.freeze({
      host: normaliseTenantHost(
        environment.SALONAI_CANONICAL_PRIMARY_DOMAIN ||
          "francescopicardi.co.uk"
      ),
      role: "primary",
      redirectToPrimary: false,
    }),
    Object.freeze({
      host: normaliseTenantHost(
        environment.SALONAI_CANONICAL_APP_DOMAIN ||
          "salonai.francescopicardi.co.uk"
      ),
      role: "app-subdomain",
      redirectToPrimary: false,
    }),
  ];

  if (domains[0].host === domains[1].host) {
    throw bootstrapError(
      "Canonical primary and app domains must be different.",
      "CANONICAL_DOMAIN_CONFLICT"
    );
  }

  return Object.freeze(domains);
}

export function getCanonicalSalonTenantConfiguration(
  environment = process.env
) {
  return Object.freeze({
    business: Object.freeze({
      name: clean(
        environment.SALONAI_CANONICAL_BUSINESS_NAME,
        "Francesco Picardi"
      ),
      slug: slug(
        environment.SALONAI_CANONICAL_BUSINESS_SLUG || "francesco-picardi",
        "Canonical business slug"
      ),
      businessType: CANONICAL_SALON_BUSINESS_TYPE,
      settings: Object.freeze({
        timezone: clean(
          environment.SALONAI_CANONICAL_TIMEZONE,
          "Europe/London"
        ),
        locale: clean(
          environment.SALONAI_CANONICAL_LOCALE,
          "en-GB"
        ),
        currency: currency(
          environment.SALONAI_CANONICAL_CURRENCY
        ),
      }),
    }),
    location: Object.freeze({
      name: clean(
        environment.SALONAI_CANONICAL_LOCATION_NAME,
        "Primary Location"
      ),
      slug: slug(
        environment.SALONAI_CANONICAL_LOCATION_SLUG || "primary-location",
        "Canonical location slug"
      ),
    }),
    domains: canonicalDomains(environment),
  });
}

export function assertCanonicalBusinessCompatible(
  business,
  configuration
) {
  if (!business) {
    return null;
  }

  if (
    String(business.businessType || "").trim().toLowerCase() !==
    CANONICAL_SALON_BUSINESS_TYPE
  ) {
    throw bootstrapError(
      "The configured canonical business slug already belongs to a non-Salon vertical.",
      "CANONICAL_BUSINESS_CONFLICT"
    );
  }

  if (
    String(business.slug || "").trim().toLowerCase() !==
    configuration.business.slug
  ) {
    throw bootstrapError(
      "The resolved canonical business does not match the configured slug.",
      "CANONICAL_BUSINESS_CONFLICT"
    );
  }

  return business;
}

export function assertCanonicalLocationCompatible({
  location,
  business,
  configuration,
}) {
  if (!location) {
    return null;
  }

  if (!business) {
    throw bootstrapError(
      "A canonical location cannot be verified without its Business.",
      "CANONICAL_LOCATION_CONFLICT"
    );
  }

  if (
    String(location.business || "") !== String(business._id || "")
  ) {
    throw bootstrapError(
      "The canonical location does not belong to the canonical Business.",
      "CANONICAL_LOCATION_CONFLICT"
    );
  }

  if (
    String(location.slug || "").trim().toLowerCase() !==
    configuration.location.slug
  ) {
    throw bootstrapError(
      "The resolved canonical location does not match the configured slug.",
      "CANONICAL_LOCATION_CONFLICT"
    );
  }

  return location;
}

export function assertCanonicalDomainCompatible({
  domain,
  business,
  expected,
}) {
  if (!domain) {
    return null;
  }

  if (!business) {
    throw bootstrapError(
      `Canonical domain ${expected.host} already exists before the canonical Business is resolved.`,
      "CANONICAL_DOMAIN_CONFLICT"
    );
  }

  if (
    String(domain.business || "") !== String(business._id || "")
  ) {
    throw bootstrapError(
      `Canonical domain ${expected.host} belongs to another Business.`,
      "CANONICAL_DOMAIN_CONFLICT"
    );
  }

  if (
    normaliseTenantHost(domain.host) !== expected.host ||
    String(domain.role || "") !== expected.role
  ) {
    throw bootstrapError(
      `Canonical domain ${expected.host} has incompatible ownership metadata.`,
      "CANONICAL_DOMAIN_CONFLICT"
    );
  }

  return domain;
}

export function buildCanonicalTenantBootstrapPlan({
  business = null,
  location = null,
  domains = [],
  configuration,
}) {
  if (
    !configuration?.business ||
    !configuration?.location ||
    !Array.isArray(configuration?.domains)
  ) {
    throw bootstrapError(
      "Canonical tenant bootstrap configuration is required."
    );
  }

  assertCanonicalBusinessCompatible(
    business,
    configuration
  );

  if (location) {
    assertCanonicalLocationCompatible({
      location,
      business,
      configuration,
    });
  }

  const existingDomains =
    new Map(
      (Array.isArray(domains) ? domains : [])
        .map((domain) => [
          normaliseTenantHost(domain.host),
          domain,
        ])
    );

  const domainPlans =
    configuration.domains.map(
      (expected) => {
        const domain =
          existingDomains.get(
            expected.host
          ) || null;

        if (domain) {
          assertCanonicalDomainCompatible({
            domain,
            business,
            expected,
          });
        }

        return Object.freeze({
          host: expected.host,
          role: expected.role,
          action: domain
            ? "reuse"
            : "create",
          id: domain
            ? String(domain._id)
            : null,
        });
      }
    );

  return Object.freeze({
    business: Object.freeze({
      action: business ? "reuse" : "create",
      id: business ? String(business._id) : null,
      slug: configuration.business.slug,
      businessType: CANONICAL_SALON_BUSINESS_TYPE,
    }),
    location: Object.freeze({
      action: location ? "reuse" : "create",
      id: location ? String(location._id) : null,
      slug: configuration.location.slug,
    }),
    domains: Object.freeze(domainPlans),
    writesRequired:
      !business ||
      !location ||
      domainPlans.some(
        (domain) =>
          domain.action === "create"
      ),
  });
}
