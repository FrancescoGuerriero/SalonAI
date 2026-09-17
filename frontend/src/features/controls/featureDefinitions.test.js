import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_DEFINITIONS,
  ROADMAP_FEATURE_CONTROL,
  resolveFeatureFlags,
} from "./featureDefinitions.js";

test("feature definitions expose unique enabled-by-default controls", () => {
  assert.ok(FEATURE_DEFINITIONS.length >= 25);
  assert.equal(
    new Set(FEATURE_DEFINITIONS.map(({ id }) => id)).size,
    FEATURE_DEFINITIONS.length
  );
  assert.equal(DEFAULT_FEATURE_FLAGS["online-booking"], true);
  assert.equal(ROADMAP_FEATURE_CONTROL.consultation, "consultation");
});

test("public feature configuration only accepts known boolean values", () => {
  const resolved = resolveFeatureFlags({
    features: {
      "online-booking": false,
      "online-shop": "false",
      unknown: false,
    },
  });

  assert.equal(resolved["online-booking"], false);
  assert.equal(resolved["online-shop"], true);
  assert.equal("unknown" in resolved, false);
});

test("public navigation consistently hides administrator-disabled actions", async () => {
  const [navbar, footer] = await Promise.all([
    readFile(
      new URL("../../components/Navbar.jsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../../components/Footer.jsx", import.meta.url),
      "utf8"
    ),
  ]);

  const whatsappGuards = navbar.match(
    /whatsappUrl\s*&&\s*isFeatureEnabled\("whatsapp-booking"\)/g
  ) || [];

  assert.equal(
    whatsappGuards.length,
    2,
    "Desktop and mobile WhatsApp actions must both honour the feature control."
  );
  assert.match(
    footer,
    /appDownloadLinks\.length\s*>\s*0\s*&&\s*isFeatureEnabled\("pwa"\)/,
    "App download links must honour the installable-app feature control."
  );
  assert.match(
    footer,
    /whatsappUrl\s*&&\s*whatsappBookingEnabled/,
    "Footer WhatsApp visibility must honour the feature control."
  );
});

test("customer experience dashboard applies independent feature selections", async () => {
  const suite = await readFile(
    new URL("../../pages/CustomerExperienceSuitePage.jsx", import.meta.url),
    "utf8"
  );

  assert.match(suite, /consultationEnabled\s*=\s*isFeatureEnabled\("consultation"\)/);
  assert.match(suite, /onlineBookingEnabled\s*=\s*isFeatureEnabled\("online-booking"\)/);
  assert.match(suite, /salonChatbotEnabled\s*=\s*isFeatureEnabled\("salon-chatbot"\)/);
  assert.match(suite, /featureId:\s*"wallet"/);
  assert.match(suite, /featureId:\s*"loyalty"/);
  assert.match(suite, /featureId:\s*"offers"/);
  assert.match(suite, /featureId:\s*"referrals"/);
});

test("homepage follows public feature visibility selections", async () => {
  const home = await readFile(
    new URL("../../pages/Home.jsx", import.meta.url),
    "utf8"
  );

  assert.match(home, /onlineBookingEnabled\s*=\s*isFeatureEnabled\("online-booking"\)/);
  assert.match(home, /onlineShopEnabled\s*=\s*isFeatureEnabled\("online-shop"\)/);
  assert.match(home, /loyaltyEnabled\s*=\s*isFeatureEnabled\("loyalty"\)/);
  assert.match(home, /reviewsEnabled\s*=\s*isFeatureEnabled\("reviews"\)/);
});

test("service cards hide booking actions when their features are disabled", async () => {
  const serviceCard = await readFile(
    new URL("../../components/customer/ServiceCard.jsx", import.meta.url),
    "utf8"
  );

  assert.match(serviceCard, /onlineBookingEnabled\s*=\s*isFeatureEnabled\("online-booking"\)/);
  assert.match(serviceCard, /whatsappBookingEnabled\s*=\s*isFeatureEnabled\("whatsapp-booking"\)/);
  assert.match(serviceCard, /consultationOnly\s*&&\s*whatsappBookingEnabled/);
  assert.match(serviceCard, /!consultationOnly\s*&&\s*onlineBookingEnabled/);
});
