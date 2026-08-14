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
