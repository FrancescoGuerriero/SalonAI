import assert from "node:assert/strict";
import test from "node:test";

import CanonicalGiftCard from "../features/premium/giftCards/GiftCard.js";
import LegacyGiftCard from "../features/giftCards/GiftCard.js";
import CapacityGiftCard from "../features/capacityPlanning/giftCards/GiftCard.js";
import * as canonicalGiftCardController from "../features/premium/giftCards/giftCardController.js";
import * as legacyGiftCardController from "../features/giftCards/giftCardController.js";
import * as capacityGiftCardController from "../features/capacityPlanning/giftCards/giftCardController.js";

import CanonicalLoyaltyAccount from "../features/premium/loyalty/LoyaltyAccount.js";
import LegacyLoyaltyAccount from "../features/loyalty/LoyaltyAccount.js";
import CapacityLoyaltyAccount from "../features/capacityPlanning/loyalty/LoyaltyAccount.js";
import * as canonicalLoyaltyController from "../features/premium/loyalty/loyaltyController.js";
import * as legacyLoyaltyController from "../features/loyalty/loyaltyController.js";
import * as capacityLoyaltyController from "../features/capacityPlanning/loyalty/loyaltyController.js";

import CanonicalEmailCampaign from "../features/premium/emailCampaigns/EmailCampaign.js";
import LegacyEmailCampaign from "../features/emailCampaigns/EmailCampaign.js";
import CapacityEmailCampaign from "../features/capacityPlanning/emailCampaigns/EmailCampaign.js";
import * as canonicalEmailCampaignController from "../features/premium/emailCampaigns/emailCampaignController.js";
import * as legacyEmailCampaignController from "../features/emailCampaigns/emailCampaignController.js";
import * as capacityEmailCampaignController from "../features/capacityPlanning/emailCampaigns/emailCampaignController.js";

function assertSameExports(canonical, compatibility, names) {
  for (const name of names) {
    assert.strictEqual(
      compatibility[name],
      canonical[name],
      `${name} must delegate to the canonical premium implementation`
    );
  }
}

test("legacy GiftCard imports resolve to canonical premium authority", () => {
  assert.strictEqual(LegacyGiftCard, CanonicalGiftCard);
  assert.strictEqual(CapacityGiftCard, CanonicalGiftCard);
  assertSameExports(canonicalGiftCardController, legacyGiftCardController, [
    "issueGiftCard",
    "listGiftCards",
    "redeemGiftCard",
  ]);
  assertSameExports(canonicalGiftCardController, capacityGiftCardController, [
    "issueGiftCard",
    "listGiftCards",
    "redeemGiftCard",
  ]);
});

test("legacy Loyalty imports resolve to canonical premium authority", () => {
  assert.strictEqual(LegacyLoyaltyAccount, CanonicalLoyaltyAccount);
  assert.strictEqual(CapacityLoyaltyAccount, CanonicalLoyaltyAccount);
  assertSameExports(canonicalLoyaltyController, legacyLoyaltyController, [
    "awardPoints",
    "getMyLoyalty",
    "listLoyaltyAccounts",
    "redeemPoints",
  ]);
  assertSameExports(canonicalLoyaltyController, capacityLoyaltyController, [
    "awardPoints",
    "getMyLoyalty",
    "listLoyaltyAccounts",
    "redeemPoints",
  ]);
});

test("legacy EmailCampaign imports resolve to canonical premium authority", () => {
  assert.strictEqual(LegacyEmailCampaign, CanonicalEmailCampaign);
  assert.strictEqual(CapacityEmailCampaign, CanonicalEmailCampaign);
  assertSameExports(canonicalEmailCampaignController, legacyEmailCampaignController, [
    "createCampaign",
    "listCampaigns",
    "scheduleCampaign",
  ]);
  assertSameExports(canonicalEmailCampaignController, capacityEmailCampaignController, [
    "createCampaign",
    "listCampaigns",
    "scheduleCampaign",
  ]);
});
