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

  assert.match(
    navbar,
    /superAdminPreview\s*\|\|\s*isFeatureEnabled\(\s*featureId\s*\)/,
    "Feature visibility must continue to honour administrator feature controls while allowing Super Admin preview."
  );

  const whatsappGuards = navbar.match(
    /whatsappUrl\s*&&\s*featureVisible\("whatsapp-booking"\)/g
  ) || [];

  assert.equal(
    whatsappGuards.length,
    2,
    "Desktop and mobile WhatsApp actions must both use the governed feature-visibility helper."
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
