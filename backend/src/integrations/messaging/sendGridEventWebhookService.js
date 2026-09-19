import MessageDelivery from "../../models/MessageDelivery.js";
import {
  updateDeliveryFromProviderEvent,
} from "../../services/messageDeliveryRecordService.js";
import SendGridWebhookEvent from "./SendGridWebhookEvent.js";

const DELIVERY_EVENTS =
  new Set([
    "processed",
    "delivered",
    "deferred",
    "bounce",
    "dropped",
  ]);

const ENGAGEMENT_EVENTS =
  new Set([
    "open",
    "click",
    "spamreport",
    "unsubscribe",
    "group_unsubscribe",
    "group_resubscribe",
  ]);

const IMMUTABLE_STATUSES =
  new Set([
    "sandbox",
    "skipped",
    "cancelled",
  ]);

const PROVIDER_FAILURE_STATUSES =
  new Set([
    "failed",
    "undelivered",
  ]);

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function lower(value) {
  return text(
    value
  ).toLowerCase();
}

function boundedText(
  value,
  length
) {
  return text(
    value
  ).slice(
    0,
    length
  );
}

export function normaliseSmtpMessageId(
  value
) {
  const supplied =
    text(value);

  if (!supplied) {
    return "";
  }

  return supplied
    .replace(
      /^<|>$/g,
      ""
    )
    .trim();
}

function messageIdVariants(
  ...values
) {
  const variants =
    new Set();

  for (
    const value of
    values
  ) {
    const raw =
      text(value);
    const normalised =
      normaliseSmtpMessageId(
        value
      );

    if (raw) {
      variants.add(
        raw
      );
    }

    if (normalised) {
      variants.add(
        normalised
      );
      variants.add(
        `<${normalised}>`
      );
    }
  }

  return [
    ...variants,
  ];
}

export function normaliseSendGridEvent(
  source = {}
) {
  if (
    !source ||
    typeof source !==
      "object" ||
    Array.isArray(
      source
    )
  ) {
    return {
      valid: false,
      reason:
        "invalid_event",
    };
  }

  const eventId =
    text(
      source.sg_event_id
    );
  const eventType =
    lower(
      source.event
    );

  if (!eventId) {
    return {
      valid: false,
      reason:
        "missing_event_id",
    };
  }

  if (!eventType) {
    return {
      valid: false,
      reason:
        "missing_event_type",
      eventId,
    };
  }

  const timestamp =
    Number(
      source.timestamp
    );
  const occurredAt =
    Number.isFinite(
      timestamp
    )
      ? new Date(
          timestamp *
            1000
        )
      : null;

  return {
    valid: true,
    eventId:
      eventId.slice(
        0,
        200
      ),
    eventType,
    sendGridMessageId:
      boundedText(
        source.sg_message_id,
        500
      ),
    smtpId:
      boundedText(
        source["smtp-id"],
        500
      ),
    occurredAt:
      occurredAt &&
      !Number.isNaN(
        occurredAt.getTime()
      )
        ? occurredAt
        : null,
    evidence: {
      response:
        boundedText(
          source.response,
          2000
        ),
      reason:
        boundedText(
          source.reason,
          2000
        ),
      status:
        boundedText(
          source.status,
          100
        ),
      attempt:
        Number.isFinite(
          Number(
            source.attempt
          )
        )
          ? Math.max(
              0,
              Number(
                source.attempt
              )
            )
          : null,
      asmGroupId:
        Number.isFinite(
          Number(
            source.asm_group_id
          )
        )
          ? Number(
              source.asm_group_id
            )
          : null,
      machineOpen:
        typeof source.sg_machine_open ===
        "boolean"
          ? source.sg_machine_open
          : null,
      marketingCampaignId:
        boundedText(
          source.marketing_campaign_id,
          200
        ),
    },
    category:
      DELIVERY_EVENTS.has(
        eventType
      )
        ? "delivery"
        : ENGAGEMENT_EVENTS.has(
              eventType
            )
          ? "engagement"
          : "unsupported",
  };
}

export function decideSendGridDeliveryStatus(
  currentStatus,
  eventType
) {
  const current =
    lower(
      currentStatus
    );
  const event =
    lower(
      eventType
    );

  if (
    IMMUTABLE_STATUSES.has(
      current
    )
  ) {
    return {
      action:
        "ignore",
      reason:
        "immutable_status",
      status:
        current,
    };
  }

  if (
    event ===
    "deferred"
  ) {
    return {
      action:
        "ignore",
      reason:
        "temporary_deferral",
      status:
        current,
    };
  }

  if (
    event ===
    "processed"
  ) {
    if (
      [
        "pending",
        "processing",
      ].includes(
        current
      )
    ) {
      return {
        action:
          "update",
        reason:
          "provider_processed",
        status:
          "accepted",
      };
    }

    return {
      action:
        "ignore",
      reason:
        "status_already_advanced",
      status:
        current,
    };
  }

  if (
    event ===
    "delivered"
  ) {
    if (
      current ===
      "delivered"
    ) {
      return {
        action:
          "ignore",
        reason:
          "duplicate_delivery",
        status:
          current,
      };
    }

    if (
      PROVIDER_FAILURE_STATUSES.has(
        current
      )
    ) {
      return {
        action:
          "ignore",
        reason:
          "provider_failure_final",
        status:
          current,
      };
    }

    return {
      action:
        "update",
      reason:
        "provider_delivered",
      status:
        "delivered",
    };
  }

  if (
    event ===
    "bounce"
  ) {
    if (
      current ===
      "undelivered"
    ) {
      return {
        action:
          "ignore",
        reason:
          "duplicate_failure",
        status:
          current,
      };
    }

    return {
      action:
        "update",
      reason:
        "provider_bounce",
      status:
        "undelivered",
    };
  }

  if (
    event ===
    "dropped"
  ) {
    if (
      current ===
      "delivered"
    ) {
      return {
        action:
          "ignore",
        reason:
          "delivered_status_final",
        status:
          current,
      };
    }

    if (
      PROVIDER_FAILURE_STATUSES.has(
        current
      )
    ) {
      return {
        action:
          "ignore",
        reason:
          "duplicate_failure",
        status:
          current,
      };
    }

    return {
      action:
        "update",
      reason:
        "provider_dropped",
      status:
        "failed",
    };
  }

  return {
    action:
      "ignore",
    reason:
      "non_delivery_event",
    status:
      current,
  };
}

async function findMatchingDelivery(
  event,
  {
    DeliveryModel =
      MessageDelivery,
  } = {}
) {
  const variants =
    messageIdVariants(
      event.smtpId,
      event.sendGridMessageId
    );

  if (
    variants.length ===
    0
  ) {
    return null;
  }

  return DeliveryModel.findOne({
    channel:
      "email",
    provider:
      "sendgrid",
    $or: [
      {
        providerMessageId: {
          $in:
            variants,
        },
      },
      {
        "attempts.providerMessageId": {
          $in:
            variants,
        },
      },
    ],
  });
}

function providerEventPayload(
  event,
  delivery
) {
  return {
    providerMessageId:
      delivery.providerMessageId,
    status:
      decideSendGridDeliveryStatus(
        delivery.status,
        event.eventType
      ).status,
    errorCode:
      [
        "bounce",
        "dropped",
      ].includes(
        event.eventType
      )
        ? `SENDGRID_${event.eventType.toUpperCase()}`
        : null,
    errorMessage:
      event.evidence.reason ||
      event.evidence.response ||
      "",
    providerResponse: {
      provider:
        "sendgrid",
      eventId:
        event.eventId,
      eventType:
        event.eventType,
      sendGridMessageId:
        event.sendGridMessageId,
      smtpId:
        event.smtpId,
      occurredAt:
        event.occurredAt
          ?.toISOString() ||
        null,
      evidence:
        event.evidence,
    },
    expectedVersion:
      delivery.__v,
  };
}

async function applyDeliveryEvent(
  event,
  {
    DeliveryModel =
      MessageDelivery,
    updateDelivery =
      updateDeliveryFromProviderEvent,
  } = {}
) {
  let delivery =
    await findMatchingDelivery(
      event,
      {
        DeliveryModel,
      }
    );

  if (!delivery) {
    return {
      updated:
        false,
      ignored:
        true,
      reason:
        "unknown_provider_message",
      delivery:
        null,
    };
  }

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const decision =
      decideSendGridDeliveryStatus(
        delivery.status,
        event.eventType
      );

    if (
      decision.action !==
      "update"
    ) {
      return {
        updated:
          false,
        ignored:
          true,
        reason:
          decision.reason,
        delivery,
      };
    }

    try {
      const updated =
        await updateDelivery(
          providerEventPayload(
            event,
            delivery
          )
        );

      return {
        updated:
          true,
        ignored:
          false,
        reason:
          decision.reason,
        delivery:
          updated,
      };
    } catch (error) {
      if (
        error?.code !==
          "DELIVERY_STATUS_CONFLICT" ||
        attempt > 0
      ) {
        throw error;
      }

      delivery =
        await findMatchingDelivery(
          event,
          {
            DeliveryModel,
          }
        );

      if (!delivery) {
        return {
          updated:
            false,
          ignored:
            true,
          reason:
            "unknown_provider_message",
          delivery:
            null,
        };
      }
    }
  }

  return {
    updated:
      false,
    ignored:
      true,
    reason:
      "concurrency_exhausted",
    delivery,
  };
}

async function existingEvent(
  eventId,
  EventModel
) {
  return EventModel.findOne({
    eventId,
  });
}

async function createEventRecord(
  event,
  EventModel
) {
  try {
    return await EventModel.create({
      eventId:
        event.eventId,
      eventType:
        event.eventType,
      sendGridMessageId:
        event.sendGridMessageId,
      smtpId:
        event.smtpId,
      occurredAt:
        event.occurredAt,
      evidence:
        event.evidence,
      processingStatus:
        "pending",
      attemptCount:
        0,
    });
  } catch (error) {
    if (
      Number(
        error?.code
      ) === 11000
    ) {
      return existingEvent(
        event.eventId,
        EventModel
      );
    }

    throw error;
  }
}

export async function processSendGridEvent(
  source,
  {
    EventModel =
      SendGridWebhookEvent,
    DeliveryModel =
      MessageDelivery,
    updateDelivery =
      updateDeliveryFromProviderEvent,
  } = {}
) {
  const event =
    normaliseSendGridEvent(
      source
    );

  if (!event.valid) {
    return {
      processed:
        false,
      ignored:
        true,
      reason:
        event.reason,
      eventId:
        event.eventId ||
        "",
    };
  }

  let record =
    await existingEvent(
      event.eventId,
      EventModel
    );

  if (
    record &&
    [
      "processed",
      "ignored",
    ].includes(
      record.processingStatus
    )
  ) {
    return {
      processed:
        false,
      ignored:
        true,
      duplicate:
        true,
      reason:
        "duplicate_event",
      eventId:
        event.eventId,
      deliveryId:
        record.deliveryId ||
        "",
    };
  }

  if (!record) {
    record =
      await createEventRecord(
        event,
        EventModel
      );
  }

  record.attemptCount =
    Number(
      record.attemptCount ||
        0
    ) + 1;

  try {
    if (
      event.category ===
      "unsupported"
    ) {
      record.processingStatus =
        "ignored";
      record.processingReason =
        "unsupported_event_type";
      record.processedAt =
        new Date();
      await record.save();

      return {
        processed:
          false,
        ignored:
          true,
        reason:
          "unsupported_event_type",
        eventId:
          event.eventId,
      };
    }

    if (
      event.category ===
      "engagement"
    ) {
      const delivery =
        await findMatchingDelivery(
          event,
          {
            DeliveryModel,
          }
        );

      record.delivery =
        delivery?._id ||
        null;
      record.deliveryId =
        delivery?.deliveryId ||
        "";
      record.processingStatus =
        "processed";
      record.processingReason =
        delivery
          ? "engagement_evidence_recorded"
          : "engagement_unmatched";
      record.processedAt =
        new Date();
      await record.save();

      return {
        processed:
          true,
        ignored:
          false,
        reason:
          record.processingReason,
        eventId:
          event.eventId,
        deliveryId:
          record.deliveryId,
        statusChanged:
          false,
      };
    }

    const result =
      await applyDeliveryEvent(
        event,
        {
          DeliveryModel,
          updateDelivery,
        }
      );

    record.delivery =
      result.delivery?._id ||
      null;
    record.deliveryId =
      result.delivery
        ?.deliveryId ||
      "";
    const pendingMatch =
      result.reason ===
      "unknown_provider_message";

    record.processingStatus =
      pendingMatch
        ? "pending"
        : result.ignored
          ? "ignored"
          : "processed";
    record.processingReason =
      result.reason;
    record.processedAt =
      pendingMatch
        ? null
        : new Date();
    await record.save();

    return {
      processed:
        !result.ignored,
      ignored:
        result.ignored,
      reason:
        result.reason,
      eventId:
        event.eventId,
      deliveryId:
        record.deliveryId,
      statusChanged:
        result.updated,
    };
  } catch (error) {
    record.processingStatus =
      "failed";
    record.processingReason =
      "processing_failed";
    record.lastError = {
      code:
        text(
          error?.code
        ),
      message:
        boundedText(
          error?.message,
          2000
        ),
    };

    await record.save();
    throw error;
  }
}

export async function processSendGridEventBatch(
  events,
  dependencies = {}
) {
  if (
    !Array.isArray(
      events
    )
  ) {
    const error =
      new Error(
        "SendGrid Event Webhook body must be a JSON array."
      );
    error.statusCode =
      400;
    error.code =
      "SENDGRID_WEBHOOK_ARRAY_REQUIRED";
    throw error;
  }

  if (
    events.length >
    1000
  ) {
    const error =
      new Error(
        "SendGrid Event Webhook batch cannot exceed 1000 events."
      );
    error.statusCode =
      413;
    error.code =
      "SENDGRID_WEBHOOK_BATCH_TOO_LARGE";
    throw error;
  }

  const results = [];

  for (
    const event of events
  ) {
    results.push(
      await processSendGridEvent(
        event,
        dependencies
      )
    );
  }

  return {
    received:
      events.length,
    processed:
      results.filter(
        (item) =>
          item.processed
      ).length,
    ignored:
      results.filter(
        (item) =>
          item.ignored
      ).length,
    results,
  };
}

export default {
  decideSendGridDeliveryStatus,
  normaliseSendGridEvent,
  normaliseSmtpMessageId,
  processSendGridEvent,
  processSendGridEventBatch,
};
