export const CANONICAL_SALON_BUSINESS_TYPE = "salon";

export const CANONICAL_TENANT_IDENTITY_ENVIRONMENT_KEYS = Object.freeze([
  "SALONAI_CANONICAL_BUSINESS_NAME",
  "SALONAI_CANONICAL_BUSINESS_SLUG",
  "SALONAI_CANONICAL_LOCATION_NAME",
  "SALONAI_CANONICAL_LOCATION_SLUG",
]);

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

export function assertExplicitCanonicalTenantIdentity(
  environment = process.env
) {
  const missing = CANONICAL_TENANT_IDENTITY_ENVIRONMENT_KEYS.filter(
    (name) => !String(environment[name] ?? "").trim()
  );

  if (missing.length > 0) {
    throw bootstrapError(
      `Canonical tenant apply requires explicit operator-approved identity configuration: ${missing.join(", ")}.`,
      "CANONICAL_TENANT_IDENTITY_REQUIRED"
    );
  }

  return true;
}

export function getCanonicalSalonTenantConfiguration(
  environment = process.env
) {
  return Object.freeze({
    business: Object.freeze({
      name: clean(
        environment.SALONAI_CANONICAL_BUSINESS_NAME,
        "Salon AI"
      ),
      slug: slug(
        environment.SALONAI_CANONICAL_BUSINESS_SLUG || "salon-ai",
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

  if (
    String(business.name || "").trim() !==
    configuration.business.name
  ) {
    throw bootstrapError(
      "The resolved canonical business does not match the configured name.",
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

  if (
    String(location.name || "").trim() !==
    configuration.location.name
  ) {
    throw bootstrapError(
      "The resolved canonical location does not match the configured name.",
      "CANONICAL_LOCATION_CONFLICT"
    );
  }

  return location;
}

export function buildCanonicalTenantBootstrapPlan({
  business = null,
  location = null,
  configuration,
}) {
  if (!configuration?.business || !configuration?.location) {
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
    writesRequired: !business || !location,
  });
}
