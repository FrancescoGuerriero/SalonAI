import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentFile =
  fileURLToPath(import.meta.url);
const testDirectory =
  path.dirname(currentFile);
const appSource =
  fs.readFileSync(
    path.resolve(
      testDirectory,
      "../app.js"
    ),
    "utf8"
  );

const CANONICAL_ROUTE_IMPORTS = [
  "./features/premium/loyalty/loyaltyRoutes.js",
  "./features/premium/giftCards/giftCardRoutes.js",
  "./features/premium/referrals/referralRoutes.js",
  "./features/premium/notifications/notificationRoutes.js",
  "./features/premium/push/pushRoutes.js",
  "./features/premium/emailCampaigns/emailCampaignRoutes.js",
  "./features/premium/sms/smsRoutes.js",
  "./features/premium/whatsapp/whatsappRoutes.js",
  "./features/premium/automation/automationRoutes.js",
  "./features/premium/analytics/premiumAnalyticsRoutes.js",
];

const FORBIDDEN_COMPATIBILITY_ROUTE_IMPORTS = [
  "./features/loyalty/loyaltyRoutes.js",
  "./features/giftCards/giftCardRoutes.js",
  "./features/referrals/referralRoutes.js",
  "./features/notifications/notificationRoutes.js",
  "./features/push/pushRoutes.js",
  "./features/emailCampaigns/emailCampaignRoutes.js",
  "./features/sms/smsRoutes.js",
  "./features/whatsapp/whatsappRoutes.js",
  "./features/automation/automationRoutes.js",
  "./features/analytics/premiumAnalyticsRoutes.js",
  "./features/capacityPlanning/",
];

test(
  "application mounts premium feature routes only from canonical premium authority",
  () => {
    for (const importPath of CANONICAL_ROUTE_IMPORTS) {
      assert.ok(
        appSource.includes(
          importPath
        ),
        `app.js must import canonical route authority: ${importPath}`
      );
    }

    for (const importPath of FORBIDDEN_COMPATIBILITY_ROUTE_IMPORTS) {
      assert.equal(
        appSource.includes(
          importPath
        ),
        false,
        `app.js must not mount compatibility route authority: ${importPath}`
      );
    }
  }
);
