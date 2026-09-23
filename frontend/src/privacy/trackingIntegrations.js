import {
  NONESSENTIAL_TRACKING_ENABLED,
  readTrackingConsent,
  trackingProviderConfig,
} from "./trackingConsent.js";

const loadedScripts =
  new Set();

function appendScriptOnce(
  id,
  src,
  onLoad
) {
  if (
    !id ||
    !src ||
    typeof document ===
      "undefined"
  ) {
    return;
  }

  if (
    loadedScripts.has(id) ||
    document.getElementById(id)
  ) {
    onLoad?.();
    return;
  }

  const script =
    document.createElement(
      "script"
    );

  script.id = id;
  script.async = true;
  script.src = src;

  if (onLoad) {
    script.addEventListener(
      "load",
      onLoad,
      {
        once: true,
      }
    );
  }

  loadedScripts.add(id);
  document.head.appendChild(
    script
  );
}

function ensureGoogleQueue() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  window.dataLayer =
    window.dataLayer || [];

  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(
        arguments
      );
    };

  return window.gtag;
}

export function setGoogleConsentDefaults() {
  const gtag =
    ensureGoogleQueue();

  if (!gtag) return;

  gtag(
    "consent",
    "default",
    {
      analytics_storage:
        "denied",
      ad_storage:
        "denied",
      ad_user_data:
        "denied",
      ad_personalization:
        "denied",
      wait_for_update:
        500,
    }
  );
}

function updateGoogleConsent(
  choices
) {
  const gtag =
    ensureGoogleQueue();

  if (!gtag) return;

  gtag(
    "consent",
    "update",
    {
      analytics_storage:
        choices.analytics
          ? "granted"
          : "denied",
      ad_storage:
        choices.advertising
          ? "granted"
          : "denied",
      ad_user_data:
        choices.advertising
          ? "granted"
          : "denied",
      ad_personalization:
        choices.advertising
          ? "granted"
          : "denied",
    }
  );
}

function loadGoogle(
  choices
) {
  const analyticsId =
    trackingProviderConfig
      .googleAnalyticsMeasurementId;
  const adsId =
    trackingProviderConfig
      .googleAdsId;

  const shouldLoad =
    (
      choices.analytics &&
      analyticsId
    ) ||
    (
      choices.advertising &&
      adsId
    );

  updateGoogleConsent(
    choices
  );

  if (!shouldLoad) {
    return;
  }

  const primaryId =
    choices.analytics &&
    analyticsId
      ? analyticsId
      : adsId;

  appendScriptOnce(
    "salonai-google-tag",
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`,
    () => {
      const gtag =
        ensureGoogleQueue();

      gtag?.(
        "js",
        new Date()
      );

      updateGoogleConsent(
        choices
      );

      if (
        choices.analytics &&
        analyticsId
      ) {
        gtag?.(
          "config",
          analyticsId,
          {
            send_page_view:
              false,
          }
        );
      }

      if (
        choices.advertising &&
        adsId
      ) {
        gtag?.(
          "config",
          adsId
        );
      }
    }
  );
}

function ensureMetaQueue() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  if (!window.fbq) {
    const fbq =
      function fbq() {
        fbq.callMethod
          ? fbq.callMethod.apply(
              fbq,
              arguments
            )
          : fbq.queue.push(
              arguments
            );
      };

    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];

    window.fbq = fbq;
    window._fbq = fbq;
  }

  return window.fbq;
}

function loadMetaPixel(
  choices
) {
  const pixelId =
    trackingProviderConfig
      .metaPixelId;

  if (
    !pixelId
  ) {
    return;
  }

  const fbq =
    ensureMetaQueue();

  if (
    !choices.advertising
  ) {
    fbq?.(
      "consent",
      "revoke"
    );
    return;
  }

  fbq?.(
    "consent",
    "grant"
  );

  appendScriptOnce(
    "salonai-meta-pixel",
    "https://connect.facebook.net/en_US/fbevents.js",
    () => {
      const queue =
        ensureMetaQueue();

      queue?.(
        "consent",
        "grant"
      );
      queue?.(
        "init",
        pixelId
      );
      queue?.(
        "track",
        "PageView"
      );
    }
  );
}

function loadHotjar(
  choices
) {
  const siteId =
    trackingProviderConfig
      .hotjarSiteId;

  if (
    !siteId ||
    !choices.experience ||
    typeof window ===
      "undefined"
  ) {
    return;
  }

  window.hj =
    window.hj ||
    function hj() {
      (
        window.hj.q =
          window.hj.q || []
      ).push(
        arguments
      );
    };

  window._hjSettings = {
    hjid:
      Number(siteId),
    hjsv:
      6,
  };

  appendScriptOnce(
    "salonai-hotjar",
    `https://static.hotjar.com/c/hotjar-${encodeURIComponent(siteId)}.js?sv=6`
  );
}

function ensureMicrosoftConsentQueue() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  window.uetq =
    window.uetq || [];

  return window.uetq;
}

export function setMicrosoftConsentDefaults() {
  const queue =
    ensureMicrosoftConsentQueue();

  queue?.push(
    "consent",
    "default",
    {
      ad_storage:
        "denied",
    }
  );
}

function updateMicrosoftConsent(
  choices
) {
  const queue =
    ensureMicrosoftConsentQueue();

  queue?.push(
    "consent",
    "update",
    {
      ad_storage:
        choices.advertising
          ? "granted"
          : "denied",
    }
  );
}

function loadMicrosoftUet(
  choices
) {
  const tagId =
    trackingProviderConfig
      .microsoftAdsUetTagId;

  if (!tagId) {
    return;
  }

  updateMicrosoftConsent(
    choices
  );

  if (
    !choices.advertising
  ) {
    return;
  }

  appendScriptOnce(
    "salonai-microsoft-uet",
    "https://bat.bing.com/bat.js",
    () => {
      if (
        typeof window ===
          "undefined" ||
        typeof window.UET !==
          "function"
      ) {
        return;
      }

      const priorQueue =
        Array.isArray(
          window.uetq
        )
          ? window.uetq
          : [];

      const instance =
        new window.UET({
          ti:
            tagId,
          enableAutoSpaTracking:
            true,
          q:
            priorQueue,
        });

      window.uetq =
        instance;

      instance.push(
        "consent",
        "update",
        {
          ad_storage:
            "granted",
        }
      );

      instance.push(
        "pageLoad"
      );
    }
  );
}

export function trackVirtualPageView(
  pathname
) {
  if (!NONESSENTIAL_TRACKING_ENABLED) {
    return;
  }

  const consent =
    readTrackingConsent();

  if (!consent) {
    return;
  }

  const path =
    String(pathname || "/");

  if (
    consent.choices
      ?.analytics === true &&
    trackingProviderConfig
      .googleAnalyticsMeasurementId
  ) {
    const gtag =
      ensureGoogleQueue();

    gtag?.(
      "event",
      "page_view",
      {
        page_path:
          path,
        page_location:
          typeof window !==
          "undefined"
            ? window.location.href
            : "",
      }
    );
  }

  if (
    consent.choices
      ?.advertising === true &&
    trackingProviderConfig
      .metaPixelId &&
    typeof window !==
      "undefined" &&
    typeof window.fbq ===
      "function"
  ) {
    window.fbq(
      "track",
      "PageView"
    );
  }

  if (
    consent.choices
      ?.experience === true &&
    trackingProviderConfig
      .hotjarSiteId &&
    typeof window !==
      "undefined" &&
    typeof window.hj ===
      "function"
  ) {
    window.hj(
      "stateChange",
      path
    );
  }
}

export function initialiseTrackingConsentBoundary() {
  setGoogleConsentDefaults();
  setMicrosoftConsentDefaults();
}

export function applyTrackingIntegrations(
  consent
) {
  if (!NONESSENTIAL_TRACKING_ENABLED) {
    updateGoogleConsent({
      analytics: false,
      advertising: false,
      experience: false,
    });
    updateMicrosoftConsent({
      analytics: false,
      advertising: false,
      experience: false,
    });
    return;
  }

  const choices = {
    analytics:
      consent?.choices
        ?.analytics === true,
    advertising:
      consent?.choices
        ?.advertising === true,
    experience:
      consent?.choices
        ?.experience === true,
  };

  updateGoogleConsent(
    choices
  );
  updateMicrosoftConsent(
    choices
  );

  loadGoogle(
    choices
  );
  loadMetaPixel(
    choices
  );
  loadHotjar(
    choices
  );
  loadMicrosoftUet(
    choices
  );
}

export default {
  applyTrackingIntegrations,
  initialiseTrackingConsentBoundary,
  setGoogleConsentDefaults,
  setMicrosoftConsentDefaults,
  trackVirtualPageView,
};
