import assert from "node:assert/strict";
import test from "node:test";

import TransactionalNotificationEvent from "../models/TransactionalNotificationEvent.js";
import {
  sendTransactionalNotification,
} from "../services/transactionalNotificationService.js";
import {
  notifyOrderPaid,
  notifyOrderRefunded,
  notifySafely,
  paidOrderFulfilmentCopy,
} from "../features/commerce/commerceNotificationService.js";

test("transactional notification service exports the omnichannel entry point", () => {
  assert.equal(typeof sendTransactionalNotification, "function");
});

test("transactional notification event schema enforces idempotent event keys", () => {
  const eventKeyPath = TransactionalNotificationEvent.schema.path("eventKey");
  const statusPath = TransactionalNotificationEvent.schema.path("status");

  assert.equal(eventKeyPath.options.required, true);
  assert.equal(eventKeyPath.options.unique, true);
  assert.deepEqual(
    statusPath.enumValues,
    ["processing", "completed", "partial", "failed"]
  );
});

test("commerce notification service exposes paid and refund event senders", () => {
  assert.equal(typeof notifyOrderPaid, "function");
  assert.equal(typeof notifyOrderRefunded, "function");
  assert.equal(typeof notifySafely, "function");
});


test("package-only paid orders activate digital service credits instead of claiming salon collection", () => {
  const copy = paidOrderFulfilmentCopy({
    fulfilmentType: "collection",
    items: [
      {
        itemType: "service_package",
      },
    ],
  });

  assert.equal(
    copy.sentence,
    "Your service-package credits are now available in your account."
  );
  assert.equal(
    copy.templateFulfilment,
    "digital service credit activation"
  );
  assert.doesNotMatch(
    copy.sentence,
    /collection|delivery/i
  );
});

test("mixed paid orders describe each fulfilment authority without losing physical delivery", () => {
  const copy = paidOrderFulfilmentCopy({
    fulfilmentType: "delivery",
    items: [
      {
        itemType: "product",
      },
      {
        itemType: "service_package",
      },
      {
        itemType: "appointment",
      },
    ],
  });

  assert.match(
    copy.sentence,
    /product order is now being prepared for delivery/i
  );
  assert.match(
    copy.sentence,
    /service-package credits are now available/i
  );
  assert.match(
    copy.sentence,
    /appointment payment has been recorded/i
  );
  assert.equal(
    copy.templateFulfilment,
    "delivery and digital service credit activation and appointment payment confirmation"
  );
});
