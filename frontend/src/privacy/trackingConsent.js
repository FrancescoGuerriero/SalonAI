export const TRACKING_CONSENT_STORAGE_KEY =
  "salonai.trackingConsent.v1";

export const TRACKING_CONSENT_UPDATED_EVENT =
  "salonai:tracking-consent-updated";

export const TRACKING_CONSENT_OPEN_EVENT =
  "salonai:tracking-consent-open";

export const TRACKING_CATEGORIES =
  Object.freeze({
    analytics: {
      id: "analytics",
      label: "Analytics",
      description:
        "Helps SalonAI understand visits, journeys and conversions using Google Analytics.",
    },
    advertising: {
      id: "advertising",
      label: "Advertising & attribution",
      description:
        "Measures advertising performance and supports attribution using Google Ads, Meta Pixel and Microsoft Advertising.",
    },
    experience: {
      id: "experience",
      label: "Experience analytics",
      description:
        "Helps identify usability problems and improve the interface using Hotjar.",
    },
  });

function text(value) {
  return String(value ?? "").trim();
}

function positiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

export const TRACKING_CONSENT_VERSION =
  text(
    import.meta.env
      .VITE_TRACKING_CONSENT_VERSION
  ) ||
  "2026-09-23";

export const TRACKING_CONSENT_TTL_DAYS =
  positiveInteger(
    import.meta.env
      .VITE_TRACKING_CONSENT_TTL_DAYS,
    180
  );

export const trackingProviderConfig =
  Object.freeze({
    googleAnalyticsMeasurementId:
      text(
        import.meta.env
          .VITE_GOOGLE_ANALYTICS_ID
      ),
    googleAdsId:
      text(
        import.meta.env
          .VITE_GOOGLE_ADS_ID
      ),
    metaPixelId:
      text(
        import.meta.env
          .VITE_META_PIXEL_ID
      ),
    hotjarSiteId:
      text(
        import.meta.env
          .VITE_HOTJAR_SITE_ID
      ),
    microsoftAdsUetTagId:
      text(
        import.meta.env
          .VITE_MICROSOFT_ADS_UET_TAG_ID
      ),
    googleSearchConsoleVerification:
      text(
        import.meta.env
          .VITE_GOOGLE_SITE_VERIFICATION
      ),
    bingWebmasterVerification:
      text(
        import.meta.env
          .VITE_BING_SITE_VERIFICATION
      ),
  });

export const trackingProviders =
  Object.freeze([
    {
      id: "google-analytics",
      name: "Google Analytics",
      category: "analytics",
      configured:
        Boolean(
          trackingProviderConfig
            .googleAnalyticsMeasurementId
        ),
    },
    {
      id: "google-ads",
      name: "Google Ads",
      category: "advertising",
      configured:
        Boolean(
          trackingProviderConfig
            .googleAdsId
        ),
    },
    {
      id: "meta-pixel",
      name: "Meta Pixel",
      category: "advertising",
      configured:
        Boolean(
          trackingProviderConfig
            .metaPixelId
        ),
    },
    {
      id: "microsoft-advertising-uet",
      name: "Microsoft Advertising UET",
      category: "advertising",
      configured:
        Boolean(
          trackingProviderConfig
            .microsoftAdsUetTagId
        ),
    },
    {
      id: "hotjar",
      name: "Hotjar",
      category: "experience",
      configured:
        Boolean(
          trackingProviderConfig
            .hotjarSiteId
        ),
    },
  ]);

export function hasConfiguredNonEssentialTracking() {
  return trackingProviders.some(
    (provider) =>
      provider.configured
  );
}

export function configuredTrackingProviders() {
  return trackingProviders.filter(
    (provider) =>
      provider.configured
  );
}

function normaliseChoices(
  choices = {}
) {
  return {
    analytics:
      choices.analytics === true,
    advertising:
      choices.advertising === true,
    experience:
      choices.experience === true,
  };
}

function validDate(value) {
  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

export function readTrackingConsent() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        TRACKING_CONSENT_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const record =
      JSON.parse(raw);

    if (
      record?.version !==
      TRACKING_CONSENT_VERSION
    ) {
      window.localStorage.removeItem(
        TRACKING_CONSENT_STORAGE_KEY
      );
      return null;
    }

    const expiresAt =
      validDate(
        record.expiresAt
      );

    if (
      !expiresAt ||
      expiresAt.getTime() <=
        Date.now()
    ) {
      window.localStorage.removeItem(
        TRACKING_CONSENT_STORAGE_KEY
      );
      return null;
    }

    return {
      ...record,
      necessary: true,
      choices:
        normaliseChoices(
          record.choices
        ),
    };
  } catch {
    return null;
  }
}

export function writeTrackingConsent(
  choices,
  {
    source =
      "consent_banner",
  } = {}
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const updatedAt =
    new Date();
  const expiresAt =
    new Date(
      updatedAt.getTime() +
        TRACKING_CONSENT_TTL_DAYS *
          24 *
          60 *
          60 *
          1000
    );

  const record = {
    version:
      TRACKING_CONSENT_VERSION,
    necessary: true,
    choices:
      normaliseChoices(
        choices
      ),
    source:
      text(source) ||
      "consent_banner",
    updatedAt:
      updatedAt.toISOString(),
    expiresAt:
      expiresAt.toISOString(),
  };

  try {
    window.localStorage.setItem(
      TRACKING_CONSENT_STORAGE_KEY,
      JSON.stringify(
        record
      )
    );
  } catch {
    // Consent still applies to the current page even if browser storage
    // is blocked. The visitor will be asked again on a later visit.
  }

  window.dispatchEvent(
    new CustomEvent(
      TRACKING_CONSENT_UPDATED_EVENT,
      {
        detail: record,
      }
    )
  );

  return record;
}

export function rejectNonEssentialTracking(
  options = {}
) {
  return writeTrackingConsent(
    {
      analytics: false,
      advertising: false,
      experience: false,
    },
    options
  );
}

export function acceptAllTracking(
  options = {}
) {
  return writeTrackingConsent(
    {
      analytics: true,
      advertising: true,
      experience: true,
    },
    options
  );
}

export function trackingConsentAllows(
  category,
  record =
    readTrackingConsent()
) {
  return (
    record?.choices?.[
      category
    ] === true
  );
}

export function openTrackingConsentSettings() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      TRACKING_CONSENT_OPEN_EVENT
    )
  );
}

export default {
  TRACKING_CATEGORIES,
  TRACKING_CONSENT_OPEN_EVENT,
  TRACKING_CONSENT_STORAGE_KEY,
  TRACKING_CONSENT_TTL_DAYS,
  TRACKING_CONSENT_UPDATED_EVENT,
  TRACKING_CONSENT_VERSION,
  acceptAllTracking,
  configuredTrackingProviders,
  hasConfiguredNonEssentialTracking,
  openTrackingConsentSettings,
  readTrackingConsent,
  rejectNonEssentialTracking,
  trackingConsentAllows,
  trackingProviderConfig,
  trackingProviders,
  writeTrackingConsent,
};
