import assert from "node:assert/strict";
import test from "node:test";

import LoyaltyAccount from "../features/premium/loyalty/LoyaltyAccount.js";
import GiftCard from "../features/premium/giftCards/GiftCard.js";
import Referral from "../features/premium/referrals/Referral.js";
import Notification from "../features/premium/notifications/Notification.js";
import RetentionJourney from "../features/premium/automation/RetentionJourney.js";

test("Phase 5 models are registered", () => {
  assert.equal(
    LoyaltyAccount.modelName,
    "LoyaltyAccount"
  );

  assert.equal(
    GiftCard.modelName,
    "GiftCard"
  );

  assert.equal(
    Referral.modelName,
    "Referral"
  );

  assert.equal(
    Notification.modelName,
    "Notification"
  );

  assert.equal(
    RetentionJourney.modelName,
    "RetentionJourney"
  );
});
