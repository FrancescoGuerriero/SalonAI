import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("privacy and marketing preference routes are public", async () => {
  const app =
    await readFile(
      new URL(
        "../../../frontend/src/App.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    app,
    /path="privacy"[\s\S]{0,160}element=\{<PrivacyPolicyPage \/>\}/
  );

  assert.match(
    app,
    /path="communication-preferences\/:token"[\s\S]{0,180}element=\{<MarketingPreferencesPage \/>\}/
  );

  assert.match(
    app,
    /path="cookies"[\s\S]{0,160}element=\{<CookiePolicyPage \/>\}/
  );

  assert.match(
    app,
    /path="account\/privacy-rights"[\s\S]{0,220}PrivacyRightsPage/
  );

  assert.match(
    app,
    /path="admin\/privacy-requests"[\s\S]{0,220}AdminPrivacyRequestsPage/
  );
});

test("customer settings use separate opt-in marketing channels", async () => {
  const settings =
    await readFile(
      new URL(
        "../../../frontend/src/pages/CustomerSettingsPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  for (const field of [
    "emailMarketing",
    "smsMarketing",
    "whatsappMarketing",
  ]) {
    assert.match(
      settings,
      new RegExp(
        `${field}: false`
      )
    );
  }

  assert.match(
    settings,
    /Marketing is optional and separate from booking/
  );
});

test("footer exposes the public privacy notice", async () => {
  const footer =
    await readFile(
      new URL(
        "../../../frontend/src/components/Footer.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    footer,
    /to: "\/privacy"/
  );
  assert.match(
    footer,
    /to: "\/cookies"/
  );
  assert.match(
    footer,
    /to: "\/account\/privacy-rights"/
  );
  assert.doesNotMatch(
    footer,
    /to: "\/experience\/privacy"/
  );
});


test("registration presents just-in-time privacy information without marketing opt-in", async () => {
  const registration =
    await readFile(
      new URL(
        "../../../frontend/src/pages/Register.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    registration,
    /Privacy Notice/
  );
  assert.match(
    registration,
    /Cookie &amp; storage notice/
  );
  assert.match(
    registration,
    /does not opt you in to marketing/
  );
});

test("management navigation exposes the administrator privacy request queue", async () => {
  const navigation =
    await readFile(
      new URL(
        "../../../frontend/src/components/navigation/managementNavigationConfig.js",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    navigation,
    /\/admin\/privacy-requests/
  );
  assert.match(
    navigation,
    /Privacy requests/
  );
});


test("tracking integrations remain behind the consent boundary", async () => {
  const consent =
    await readFile(
      new URL(
        "../../../frontend/src/privacy/trackingConsent.js",
        import.meta.url
      ),
      "utf8"
    );

  const integrations =
    await readFile(
      new URL(
        "../../../frontend/src/privacy/trackingIntegrations.js",
        import.meta.url
      ),
      "utf8"
    );

  const layout =
    await readFile(
      new URL(
        "../../../frontend/src/components/MainLayout.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    consent,
    /VITE_GOOGLE_ANALYTICS_ID/
  );
  assert.match(
    consent,
    /VITE_GOOGLE_ADS_ID/
  );
  assert.match(
    consent,
    /VITE_META_PIXEL_ID/
  );
  assert.match(
    consent,
    /VITE_HOTJAR_SITE_ID/
  );
  assert.match(
    consent,
    /VITE_MICROSOFT_ADS_UET_TAG_ID/
  );

  for (const category of [
    "analytics",
    "advertising",
    "experience",
  ]) {
    assert.match(
      consent,
      new RegExp(
        `${category}:\\s*false`
      )
    );
  }

  assert.match(
    integrations,
    /setGoogleConsentDefaults/
  );
  assert.match(
    integrations,
    /analytics_storage:[\s\S]{0,80}"denied"/
  );
  assert.match(
    integrations,
    /ad_storage:[\s\S]{0,80}"denied"/
  );
  assert.match(
    integrations,
    /choices\.advertising/
  );
  assert.match(
    integrations,
    /choices\.experience/
  );
  assert.match(
    layout,
    /<TrackingConsentBanner \/>/
  );
});

test("search verification is separated from behavioural tracking", async () => {
  const seo =
    await readFile(
      new URL(
        "../../../frontend/src/components/Seo.jsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    seo,
    /VITE_GOOGLE_SITE_VERIFICATION/
  );
  assert.match(
    seo,
    /google-site-verification/
  );
  assert.match(
    seo,
    /VITE_BING_SITE_VERIFICATION/
  );
  assert.match(
    seo,
    /msvalidate\.01/
  );
});

test("cookie notice names the planned first-party measurement providers", async () => {
  const notice =
    await readFile(
      new URL(
        "../../../frontend/src/pages/CookiePolicyPage.jsx",
        import.meta.url
      ),
      "utf8"
    );

  for (const provider of [
    "Google Analytics",
    "Google Ads",
    "Meta Pixel",
    "Microsoft Advertising UET",
    "Hotjar",
    "Google Search Console",
    "Bing Webmaster",
  ]) {
    assert.match(
      notice,
      new RegExp(provider)
    );
  }

  assert.match(
    notice,
    /default to[\s\S]{0,40}denied/
  );
});
