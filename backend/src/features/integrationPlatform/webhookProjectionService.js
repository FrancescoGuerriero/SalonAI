import { randomUUID } from "node:crypto";

import ConnectorHealth from "../../models/ConnectorHealth.js";
import CredentialVersion from "../../models/CredentialVersion.js";
import DomainEvent from "../../models/DomainEvent.js";
import WebhookDelivery from "../../models/WebhookDelivery.js";
import WebhookSubscription from "../../models/WebhookSubscription.js";
import {
  normaliseDomainEvent,
  subscriptionMatchesEvent,
} from "./domainEventCatalogue.js";
import {
  decryptIntegrationSecret,
  signWebhookPayload,
} from "./integrationSecrets.js";

function retryDelaySeconds(attempt, policy = {}) {
  const base = Math.max(1, Number(policy.baseDelaySeconds) || 30);
  const maximum = Math.max(base, Number(policy.maxDelaySeconds) || 3600);
  return Math.min(maximum, base * 2 ** Math.max(0, attempt - 1));
}

function errorFor(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function updateWebhookHealth(subscription, status, details = {}) {
  return ConnectorHealth.findOneAndUpdate(
    {
      business: subscription.business,
      app: subscription.app?._id || subscription.app,
      componentKey: `webhook:${subscription._id}`,
    },
    {
      $set: {
        subscription: subscription._id,
        status,
        ...(status === "healthy"
          ? {
              lastSuccessAt: new Date(),
              lastError: "",
              retryAt: null,
            }
          : {
              lastFailureAt: new Date(),
              lastError: String(details.error || "").slice(0, 2000),
              retryAt: details.retryAt || null,
            }),
        latencyMs:
          Number.isFinite(Number(details.latencyMs))
            ? Math.max(0, Number(details.latencyMs))
            : null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();
}

async function activeSigningCredential(subscription) {
  const credential = await CredentialVersion.findOne({
    _id: subscription.signingCredential,
    business: subscription.business,
    app: subscription.app?._id || subscription.app,
    credentialType: "webhook_signing",
    status: { $in: ["active", "retiring"] },
    validFrom: { $lte: new Date() },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).select("+secretCiphertext +secretIv +secretTag");

  if (!credential) {
    throw errorFor(
      "Webhook signing credential is unavailable.",
      "WEBHOOK_SIGNING_CREDENTIAL_UNAVAILABLE",
      409
    );
  }

  return credential;
}

export async function projectDomainEvent(eventDocument, { session = null } = {}) {
  const event =
    typeof eventDocument?.toObject === "function"
      ? eventDocument.toObject()
      : eventDocument;

  let query = WebhookSubscription.find({
    business: event.business,
    status: "active",
  }).populate("app", "status scopes environment");

  if (session) query = query.session(session);
  const subscriptions = await query.lean();
  const matching = subscriptions.filter(
    (subscription) =>
      subscription.app?.status === "active" &&
      subscriptionMatchesEvent(subscription, {
        type: event.type,
        version: event.version,
      })
  );

  const deliveries = [];
  for (const subscription of matching) {
    const idempotencyKey = `${event.eventId}:${subscription._id}`;
    let deliveryQuery = WebhookDelivery.findOneAndUpdate(
      {
        business: event.business,
        subscription: subscription._id,
        idempotencyKey,
      },
      {
        $setOnInsert: {
          business: event.business,
          app: subscription.app._id,
          subscription: subscription._id,
          eventId: event.eventId,
          eventType: event.type,
          eventVersion: event.version,
          idempotencyKey,
          status: "pending",
          payload: {
            eventId: event.eventId,
            type: event.type,
            version: event.version,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt,
            data: event.payload,
            correlationId: event.correlationId,
          },
          occurredAt: event.occurredAt,
          nextAttemptAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    if (session) deliveryQuery = deliveryQuery.session(session);
    deliveries.push(await deliveryQuery.lean());
  }

  let eventUpdate = DomainEvent.updateOne(
    { _id: event._id },
    { $set: { projectedAt: new Date() } }
  );
  if (session) eventUpdate = eventUpdate.session(session);
  await eventUpdate;

  return deliveries;
}

export async function recordDomainEvent(input = {}, { session = null } = {}) {
  const event = normaliseDomainEvent(input);
  const document = {
    eventId: event.eventId,
    business: event.businessId,
    type: event.type,
    version: event.version,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload,
    occurredAt: new Date(event.occurredAt),
    source: event.source,
    correlationId: event.correlationId,
    causationId: event.causationId,
    metadata: event.metadata,
  };

  let created;
  if (session) {
    [created] = await DomainEvent.create([document], { session });
  } else {
    created = await DomainEvent.create(document);
  }

  const deliveries = await projectDomainEvent(created, { session });
  return {
    event: created.toObject(),
    deliveries,
  };
}

export async function deliverWebhook(deliveryId, { fetchImpl = globalThis.fetch } = {}) {
  const now = new Date();
  const delivery = await WebhookDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      status: { $in: ["pending", "retry_scheduled"] },
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: "delivering",
        lastAttemptAt: now,
      },
      $inc: { attemptCount: 1 },
    },
    { new: true }
  );

  if (!delivery) {
    return null;
  }

  const subscription = await WebhookSubscription.findOne({
    _id: delivery.subscription,
    business: delivery.business,
    status: "active",
  }).populate("app", "status");

  if (!subscription || subscription.app?.status !== "active") {
    delivery.status = "dead_letter";
    delivery.lastError = "Webhook subscription or integration app is inactive.";
    delivery.nextAttemptAt = null;
    await delivery.save();
    return delivery.toObject();
  }

  const policy = subscription.retryPolicy || {};
  const maxAttempts = Math.max(1, Number(policy.maxAttempts) || 8);
  const startedAt = Date.now();

  try {
    const credential = await activeSigningCredential(subscription);
    const secret = decryptIntegrationSecret({
      ciphertext: credential.secretCiphertext,
      iv: credential.secretIv,
      tag: credential.secretTag,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(delivery.payload);
    const signature = signWebhookPayload({
      secret,
      timestamp,
      idempotencyKey: delivery.idempotencyKey,
      body,
    });

    const response = await fetchImpl(subscription.endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "AIIBP-Webhooks/1.0",
        "x-aiibp-event": delivery.eventType,
        "x-aiibp-event-version": delivery.eventVersion,
        "x-aiibp-delivery-id": String(delivery._id),
        "x-aiibp-idempotency-key": delivery.idempotencyKey,
        "x-aiibp-timestamp": timestamp,
        "x-aiibp-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseText = String(await response.text()).slice(0, 2000);
    const latencyMs = Date.now() - startedAt;
    delivery.responseStatus = response.status;
    delivery.responseBodySnippet = responseText;

    if (response.ok) {
      delivery.status = "succeeded";
      delivery.deliveredAt = new Date();
      delivery.nextAttemptAt = null;
      delivery.lastError = "";
      await delivery.save();

      subscription.lastDeliveredAt = new Date();
      subscription.lastError = "";
      await subscription.save();
      credential.lastUsedAt = new Date();
      await credential.save();
      await updateWebhookHealth(subscription, "healthy", { latencyMs });
      return delivery.toObject();
    }

    throw errorFor(
      `Webhook endpoint returned HTTP ${response.status}.`,
      "WEBHOOK_HTTP_FAILURE",
      502
    );
  } catch (error) {
    const exhausted = delivery.attemptCount >= maxAttempts;
    const retryAt = exhausted
      ? null
      : new Date(
          Date.now() +
            retryDelaySeconds(delivery.attemptCount, policy) * 1000
        );

    delivery.status = exhausted ? "dead_letter" : "retry_scheduled";
    delivery.nextAttemptAt = retryAt;
    delivery.lastError = String(error.message || error).slice(0, 2000);
    await delivery.save();

    subscription.lastFailedAt = new Date();
    subscription.lastError = delivery.lastError;
    await subscription.save();
    await updateWebhookHealth(
      subscription,
      exhausted ? "error" : "degraded",
      {
        error: delivery.lastError,
        retryAt,
        latencyMs: Date.now() - startedAt,
      }
    );
    return delivery.toObject();
  }
}

export async function replayWebhookDelivery(deliveryId) {
  const original = await WebhookDelivery.findById(deliveryId).lean();
  if (!original) {
    throw errorFor("Webhook delivery not found.", "WEBHOOK_DELIVERY_NOT_FOUND", 404);
  }

  return WebhookDelivery.create({
    business: original.business,
    app: original.app,
    subscription: original.subscription,
    eventId: original.eventId,
    eventType: original.eventType,
    eventVersion: original.eventVersion,
    idempotencyKey: `${original.idempotencyKey}:replay:${randomUUID()}`,
    status: "pending",
    payload: original.payload,
    occurredAt: original.occurredAt,
    nextAttemptAt: new Date(),
    replayOf: original._id,
    metadata: {
      ...(original.metadata || {}),
      replayedAt: new Date().toISOString(),
    },
  });
}

export async function drainDueWebhookDeliveries({ limit = 50, fetchImpl = globalThis.fetch } = {}) {
  const items = await WebhookDelivery.find({
    status: { $in: ["pending", "retry_scheduled"] },
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ nextAttemptAt: 1, _id: 1 })
    .limit(Math.max(1, Math.min(200, Number(limit) || 50)))
    .select("_id")
    .lean();

  const results = [];
  for (const item of items) {
    results.push(await deliverWebhook(item._id, { fetchImpl }));
  }
  return results.filter(Boolean);
}

export { retryDelaySeconds };

export default {
  deliverWebhook,
  drainDueWebhookDeliveries,
  projectDomainEvent,
  recordDomainEvent,
  replayWebhookDelivery,
  retryDelaySeconds,
};
