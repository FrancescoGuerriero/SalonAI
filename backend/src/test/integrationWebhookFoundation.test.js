import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseDomainEvent,
  subscriptionMatchesEvent,
} from "../features/integrationPlatform/domainEventCatalogue.js";
import {
  hashIntegrationSecret,
  signWebhookPayload,
} from "../features/integrationPlatform/integrationSecrets.js";
import {
  retryDelaySeconds,
} from "../features/integrationPlatform/webhookProjectionService.js";

const BUSINESS = "507f1f77bcf86cd799439011";

test("domain event catalogue produces versioned tenant-owned envelopes", () => {
  const event = normaliseDomainEvent({
    business: BUSINESS,
    type: "appointment.created",
    version: "1",
    aggregateType: "appointment",
    aggregateId: "appointment-1",
    payload: { appointmentId: "appointment-1" },
    occurredAt: "2030-01-01T10:00:00.000Z",
  });

  assert.equal(event.businessId, BUSINESS);
  assert.equal(event.type, "appointment.created");
  assert.equal(event.version, "1");
  assert.ok(event.eventId);
});

test("webhook subscriptions match exact or wildcard event schemas", () => {
  const event = { type: "appointment.created", version: "1" };
  assert.equal(
    subscriptionMatchesEvent(
      { events: [{ type: "appointment.created", version: "1" }] },
      event
    ),
    true
  );
  assert.equal(
    subscriptionMatchesEvent(
      { events: [{ type: "*", version: "*" }] },
      event
    ),
    true
  );
});

test("webhook signatures bind timestamp, idempotency key and body", () => {
  const input = {
    secret: "test-secret",
    timestamp: "100",
    idempotencyKey: "delivery-1",
    body: '{"ok":true}',
  };
  assert.equal(signWebhookPayload(input), signWebhookPayload(input));
  assert.notEqual(
    signWebhookPayload(input),
    signWebhookPayload({ ...input, timestamp: "101" })
  );
  assert.equal(hashIntegrationSecret("abc"), hashIntegrationSecret("abc"));
});

test("webhook retry policy backs off and respects the maximum", () => {
  assert.equal(retryDelaySeconds(1, { baseDelaySeconds: 30, maxDelaySeconds: 100 }), 30);
  assert.equal(retryDelaySeconds(2, { baseDelaySeconds: 30, maxDelaySeconds: 100 }), 60);
  assert.equal(retryDelaySeconds(3, { baseDelaySeconds: 30, maxDelaySeconds: 100 }), 100);
});
