import {
  randomUUID,
} from "node:crypto";

import StripeWebhookEvent from "./StripeWebhookEvent.js";

const CLAIM_TTL_MS =
  10 * 60 * 1000;

const RETENTION_MS =
  30 * 24 * 60 * 60 * 1000;

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function duplicateKeyError(error) {
  return Number(
    error?.code
  ) === 11000;
}

function stripeObjectId(event) {
  return text(
    event?.data?.object?.id
  );
}

function claimMetadata(
  event,
  now,
  claimId
) {
  return {
    eventType:
      text(event?.type) ||
      "unknown",

    objectId:
      stripeObjectId(event),

    livemode:
      event?.livemode === true,

    status:
      "processing",

    claimId,

    processingStartedAt:
      now,

    lockExpiresAt:
      new Date(
        now.getTime() +
          CLAIM_TTL_MS
      ),

    processedAt:
      null,

    failedAt:
      null,

    lastError:
      "",

    expiresAt:
      new Date(
        now.getTime() +
          RETENTION_MS
      ),
  };
}

function inProgressError(
  eventId
) {
  const error =
    new Error(
      `Stripe webhook event ${eventId} is already being processed.`
    );

  error.statusCode = 409;
  error.code =
    "STRIPE_WEBHOOK_IN_PROGRESS";
  error.retryable = true;

  return error;
}

function claimLostError(
  eventId
) {
  const error =
    new Error(
      `Stripe webhook event ${eventId} no longer owns the active processing claim.`
    );

  error.statusCode = 409;
  error.code =
    "STRIPE_WEBHOOK_CLAIM_LOST";
  error.retryable = true;

  return error;
}

export async function claimStripeWebhookEvent(
  event
) {
  const eventId =
    text(event?.id);

  if (!eventId) {
    const error =
      new Error(
        "Stripe webhook event ID is required."
      );

    error.statusCode = 400;
    error.code =
      "STRIPE_WEBHOOK_EVENT_ID_REQUIRED";

    throw error;
  }

  const now =
    new Date();

  const claimId =
    randomUUID();

  const metadata =
    claimMetadata(
      event,
      now,
      claimId
    );

  try {
    const receipt =
      await StripeWebhookEvent.create(
        {
          eventId,
          ...metadata,
          attempts: 1,
        }
      );

    return {
      claimed: true,
      duplicate: false,
      reclaimed: false,
      claimId,
      receipt,
    };
  } catch (error) {
    if (
      !duplicateKeyError(
        error
      )
    ) {
      throw error;
    }
  }

  /*
   * A previous attempt explicitly failed.
   * Stripe may safely retry it.
   */
  let receipt =
    await StripeWebhookEvent
      .findOneAndUpdate(
        {
          eventId,
          status:
            "failed",
        },
        {
          $set:
            metadata,
          $inc: {
            attempts: 1,
          },
        },
        {
          returnDocument:
            "after",
        }
      );

  if (receipt) {
    return {
      claimed: true,
      duplicate: true,
      reclaimed: true,
      claimId,
      receipt,
    };
  }

  /*
   * A process may have terminated after
   * claiming an event. A sufficiently old
   * processing claim is therefore reclaimable.
   */
  receipt =
    await StripeWebhookEvent
      .findOneAndUpdate(
        {
          eventId,
          status:
            "processing",

          lockExpiresAt: {
            $lte: now,
          },
        },
        {
          $set:
            metadata,

          $inc: {
            attempts: 1,
          },
        },
        {
          returnDocument:
            "after",
        }
      );

  if (receipt) {
    return {
      claimed: true,
      duplicate: true,
      reclaimed: true,
      claimId,
      receipt,
    };
  }

  const existing =
    await StripeWebhookEvent
      .findOne({
        eventId,
      });

  if (
    existing?.status ===
    "processed"
  ) {
    return {
      claimed: false,
      duplicate: true,
      reclaimed: false,
      claimId: "",
      receipt:
        existing,
    };
  }

  /*
   * Do not acknowledge an event while another
   * request is actively processing it.
   *
   * Returning a non-2xx response allows Stripe
   * to retry the delivery instead of losing it.
   */
  throw inProgressError(
    eventId
  );
}

export async function markStripeWebhookEventProcessed(
  eventId,
  claimId
) {
  const now =
    new Date();

  const receipt =
    await StripeWebhookEvent
      .findOneAndUpdate(
        {
          eventId:
            text(eventId),

          claimId:
            text(claimId),

          status:
            "processing",
        },
        {
          $set: {
            status:
              "processed",

            processedAt:
              now,

            failedAt:
              null,

            lastError:
              "",

            lockExpiresAt:
              now,
          },
        },
        {
          returnDocument:
            "after",
        }
      );

  if (!receipt) {
    throw claimLostError(
      text(eventId)
    );
  }

  return receipt;
}

export async function markStripeWebhookEventFailed(
  eventId,
  claimId,
  error
) {
  const now =
    new Date();

  const message =
    text(
      error?.message ||
        error
    ).slice(
      0,
      1000
    );

  return StripeWebhookEvent
    .findOneAndUpdate(
      {
        eventId:
          text(eventId),

        claimId:
          text(claimId),

        status:
          "processing",
      },
      {
        $set: {
          status:
            "failed",

          failedAt:
            now,

          processedAt:
            null,

          lastError:
            message,

          lockExpiresAt:
            now,
        },
      },
      {
        returnDocument:
          "after",
      }
    );
}

export default {
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  markStripeWebhookEventFailed,
};