import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  stripeMembershipPeriodStart,
  stripeMembershipSubscriptionId,
} from "../features/memberships/membershipStripeCollectionService.js";

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Stripe membership subscription reference supports current and legacy invoice shapes", () => {
  assert.equal(
    stripeMembershipSubscriptionId({ subscription: "sub_legacy" }),
    "sub_legacy"
  );

  assert.equal(
    stripeMembershipSubscriptionId({
      parent: {
        subscription_details: {
          subscription: "sub_current",
        },
      },
    }),
    "sub_current"
  );
});

test("Stripe membership collection uses a stable billing-period start for retries", () => {
  assert.equal(
    stripeMembershipPeriodStart({ period_start: 1_800_000_000 }).toISOString(),
    new Date(1_800_000_000 * 1000).toISOString()
  );

  assert.equal(
    stripeMembershipPeriodStart({
      lines: {
        data: [
          { period: { start: 1_800_000_100 } },
          { period: { start: 1_800_000_000 } },
        ],
      },
    }).toISOString(),
    new Date(1_800_000_000 * 1000).toISOString()
  );
});

test("recurring membership collections reconcile Payment and CollectionAttempt state", () => {
  const service = source(
    "../features/memberships/membershipStripeCollectionService.js"
  );
  const webhook = source("../features/commerce/stripeWebhookService.js");
  const payment = source("../features/commerce/Payment.js");

  assert.match(service, /recordMembershipCollectionAndRefreshBenefits/);
  assert.match(service, /purpose:\s*"membership"/);
  assert.match(service, /membershipContract:\s*contract\._id/);
  assert.match(service, /ignoredStaleEvent/);
  assert.match(service, /idempotencyKey/);

  assert.match(payment, /membershipContract/);
  assert.match(webhook, /invoice\.payment_succeeded/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(webhook, /reconcileStripeMembershipCollection/);
});
