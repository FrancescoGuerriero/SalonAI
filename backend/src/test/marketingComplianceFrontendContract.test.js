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
  assert.doesNotMatch(
    footer,
    /to: "\/experience\/privacy"/
  );
});
