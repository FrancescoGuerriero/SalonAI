import {
  createHash,
} from "node:crypto";

import MessageDelivery from "../../models/MessageDelivery.js";
import {
  updateDeliveryFromProviderEvent,
} from "../../services/messageDeliveryRecordService.js";
import {
  persistWhatsAppDeliveryStatus,
} from "../../features/premium/whatsapp/whatsappDeliveryStatusService.js";
import TwilioStatusWebhookEvent from "./TwilioStatusWebhookEvent.js";

const SUPPORTED_STATUSES =
  new Set([
    "scheduled",
    "accepted",
    "queued",
    "sending",
    "sent",
    "delivered",
    "read",
    "failed",
    "undelivered",
    "canceled",
    "cancelled",
  ]);

const FAILURE_STATUSES =
  new Set([
    "failed",
    "undelivered",
    "canceled",
    "cancelled",
  ]);

const IMMUTABLE_LOCAL_STATUSES =
  new Set([
    "sandbox",
    "skipped",
    "cancelled",
  ]);

const PROVIDER_STATUS_ORDER =
  new Map([
    ["scheduled", 5],
    ["accepted", 10],
    ["queued", 20],
    ["sending", 30],
    ["sent", 40],
    ["delivered", 50],
    ["read", 60],
  ]);

const LOCAL_STATUS_ORDER =
  new Map([
    ["pending", 0],
    ["accepted", 10],
    ["queued", 20],
    ["processing", 30],
    ["sent", 40],
    ["delivered", 50],
    ["partially_delivered", 50],
  ]);

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function lower(
  value
) {
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

function stablePayload(
  source
) {
  if (
    !source ||
    typeof source !==
      "object" ||
    Array.isArray(source)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map(
        (key) => {
          const value =
            source[key];

          return [
            key,
            Array.isArray(value)
              ? value.map(
                  (item) =>
                    String(
                      item ?? ""
                    )
                )
              : String(
                  value ?? ""
                ),
          ];
        }
      )
  );
}

function eventKeyFor(
  source
) {
  return createHash(
    "sha256"
  )
    .update(
      JSON.stringify(
        stablePayload(
          source
        )
      )
    )
    .digest(
      "hex"
    );
}

function normaliseChannel(
  source
) {
  const explicit =
    lower(
      source
        ?.ChannelPrefix ||
      source
        ?.Channel ||
      source
        ?.channel
    );

  if (
    explicit.includes(
      "whatsapp"
    )
  ) {
    return "whatsapp";
  }

  if (
    explicit === "sms"
  ) {
    return "sms";
  }

  const addresses = [
    source?.From,
    source?.To,
    source?.from,
    source?.to,
  ]
    .map(lower)
    .filter(Boolean);

  if (
    addresses.some(
      (value) =>
        value.startsWith(
          "whatsapp:"
        )
    )
  ) {
    return "whatsapp";
  }

  if (
    addresses.length >
    0
  ) {
    return "sms";
  }

  return "unknown";
}

export function normaliseTwilioStatusEvent(
  source = {}
) {
  if (
    !source ||
    typeof source !==
      "object" ||
    Array.isArray(source)
  ) {
    return {
      valid: false,
      reason:
        "invalid_event",
    };
  }

  const providerMessageId =
    boundedText(
      source.MessageSid ||
      source.SmsSid ||
      source.messageSid,
      100
    );

  const providerStatus =
    lower(
      source.MessageStatus ||
      source.SmsStatus ||
      source.status
    );

  if (!providerMessageId) {
    return {
      valid: false,
      reason:
        "missing_message_sid",
    };
  }

  if (!providerStatus) {
    return {
      valid: false,
      reason:
        "missing_status",
      providerMessageId,
    };
  }

  const segments =
    Number(
      source.NumSegments
    );

  return {
    valid: true,
    eventKey:
      eventKeyFor(
        source
      ),
    providerMessageId,
    providerStatus,
    channel:
      normaliseChannel(
        source
      ),
    supported:
      SUPPORTED_STATUSES.has(
        providerStatus
      ),
    evidence: {
      errorCode:
        boundedText(
          source.ErrorCode,
          100
        ),
      errorMessage:
        boundedText(
          source.ErrorMessage,
          1000
        ),
      price:
        boundedText(
          source.Price,
          100
        ),
      priceUnit:
        boundedText(
          source.PriceUnit,
          20
        ),
      numSegments:
        Number.isFinite(
          segments
        )
          ? Math.max(
              0,
              segments
            )
          : null,
      apiVersion:
        boundedText(
          source.ApiVersion,
          50
        ),
    },
  };
}

function currentSuccessRank(
  delivery
) {
  const providerRank =
    PROVIDER_STATUS_ORDER.get(
      lower(
        delivery
          ?.providerStatus
      )
    ) ?? -1;

  const localRank =
    LOCAL_STATUS_ORDER.get(
      lower(
        delivery?.status
      )
    ) ?? -1;

  return Math.max(
    providerRank,
    localRank
  );
}

export function decideTwilioDeliveryStatusUpdate(
  delivery,
  incomingStatus
) {
  const incoming =
    lower(
      incomingStatus
    );
  const local =
    lower(
      delivery?.status
    );
  const provider =
    lower(
      delivery
        ?.providerStatus
    );

  if (
    !SUPPORTED_STATUSES.has(
      incoming
    )
  ) {
    return {
      action: "ignore",
      reason:
        "unsupported_status",
    };
  }

  if (
    provider ===
    incoming
  ) {
    return {
      action: "ignore",
      reason:
        "duplicate_status",
    };
  }

  if (
    IMMUTABLE_LOCAL_STATUSES.has(
      local
    )
  ) {
    return {
      action: "ignore",
      reason:
        "immutable_status",
    };
  }

  if (
    FAILURE_STATUSES.has(
      local
    ) ||
    FAILURE_STATUSES.has(
      provider
    )
  ) {
    return {
      action: "ignore",
      reason:
        "terminal_failure",
    };
  }

  const currentRank =
    currentSuccessRank(
      delivery
    );

  if (
    FAILURE_STATUSES.has(
      incoming
    )
  ) {
    if (
      currentRank >=
      (
        PROVIDER_STATUS_ORDER.get(
          "delivered"
        ) ?? 50
      )
    ) {
      return {
        action: "ignore",
        reason:
          "delivered_status_final",
      };
    }

    return {
      action: "update",
      reason:
        "provider_failure",
    };
  }

  const incomingRank =
    PROVIDER_STATUS_ORDER.get(
      incoming
    ) ?? -1;

  if (
    incomingRank <=
    currentRank
  ) {
    return {
      action: "ignore",
      reason:
        "status_regression",
    };
  }

  return {
    action: "update",
    reason:
      incoming === "read"
        ? "provider_read"
        : "status_advanced",
  };
}

async function findSmsDelivery(
  providerMessageId,
  DeliveryModel
) {
  if (
    typeof DeliveryModel
      ?.findByProviderMessageId ===
    "function"
  ) {
    return DeliveryModel
      .findByProviderMessageId(
        providerMessageId
      );
  }

  return DeliveryModel.findOne({
    providerMessageId,
  });
}

async function applySmsStatus(
  event,
  {
    DeliveryModel =
      MessageDelivery,
    updateDelivery =
      updateDeliveryFromProviderEvent,
  } = {}
) {
  let delivery =
    await findSmsDelivery(
      event.providerMessageId,
      DeliveryModel
    );

  if (!delivery) {
    return {
      matched: false,
      updated: false,
      ignored: false,
      reason:
        "unknown_provider_message",
      delivery: null,
    };
  }

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const decision =
      decideTwilioDeliveryStatusUpdate(
        delivery,
        event.providerStatus
      );

    if (
      decision.action !==
      "update"
    ) {
      return {
        matched: true,
        updated: false,
        ignored: true,
        reason:
          decision.reason,
        delivery,
      };
    }

    try {
      const updated =
        await updateDelivery({
          providerMessageId:
            event.providerMessageId,
          status:
            event.providerStatus,
          errorCode:
            event.evidence
              .errorCode ||
            null,
          errorMessage:
            event.evidence
              .errorMessage,
          price:
            event.evidence
              .price ||
            null,
          priceUnit:
            event.evidence
              .priceUnit,
          segments:
            event.evidence
              .numSegments,
          providerResponse: {
            provider:
              "twilio",
            eventKey:
              event.eventKey,
            providerStatus:
              event.providerStatus,
            channel:
              event.channel,
            receivedAt:
              event.receivedAt
                ?.toISOString?.() ||
              null,
            evidence:
              event.evidence,
          },
          expectedVersion:
            delivery.__v,
        });

      return {
        matched: true,
        updated: true,
        ignored: false,
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
        await findSmsDelivery(
          event.providerMessageId,
          DeliveryModel
        );

      if (!delivery) {
        return {
          matched: false,
          updated: false,
          ignored: false,
          reason:
            "unknown_provider_message",
          delivery: null,
        };
      }
    }
  }

  return {
    matched: true,
    updated: false,
    ignored: true,
    reason:
      "concurrency_exhausted",
    delivery,
  };
}

async function applyWhatsAppStatus(
  event,
  {
    persistWhatsApp =
      persistWhatsAppDeliveryStatus,
  } = {}
) {
  const result =
    await persistWhatsApp(
      {
        providerMessageId:
          event.providerMessageId,
        providerStatus:
          event.providerStatus,
        error:
          event.evidence
            .errorMessage ||
          event.evidence
            .errorCode,
      }
    );

  return {
    matched:
      Boolean(
        result?.matched
      ),
    updated:
      Boolean(
        result?.updated
      ),
    ignored:
      Boolean(
        result?.ignored
      ),
    reason:
      result?.reason ||
      "unknown_provider_message",
    conversationId:
      result?.conversationId ||
      null,
  };
}

async function applyEvent(
  event,
  dependencies = {}
) {
  if (
    !event.supported
  ) {
    return {
      matched: false,
      updated: false,
      ignored: true,
      reason:
        "unsupported_status",
    };
  }

  if (
    event.channel ===
    "whatsapp"
  ) {
    return applyWhatsAppStatus(
      event,
      dependencies
    );
  }

  if (
    event.channel ===
    "sms"
  ) {
    return applySmsStatus(
      event,
      dependencies
    );
  }

  const sms =
    await applySmsStatus(
      event,
      dependencies
    );

  if (sms.matched) {
    return sms;
  }

  return applyWhatsAppStatus(
    event,
    dependencies
  );
}

function eventFromRecord(
  record
) {
  return {
    valid: true,
    supported:
      SUPPORTED_STATUSES.has(
        lower(
          record
            .providerStatus
        )
      ),
    eventKey:
      record.eventKey,
    providerMessageId:
      record.providerMessageId,
    providerStatus:
      lower(
        record.providerStatus
      ),
    channel:
      record.channel ||
      "unknown",
    evidence:
      record.evidence ||
      {},
    receivedAt:
      record.receivedAt ||
      new Date(),
  };
}

async function createEventRecord(
  event,
  EventModel
) {
  try {
    return await EventModel
      .create({
        eventKey:
          event.eventKey,
        providerMessageId:
          event.providerMessageId,
        providerStatus:
          event.providerStatus,
        channel:
          event.channel,
        evidence:
          event.evidence,
        processingStatus:
          "pending",
        attemptCount:
          0,
        receivedAt:
          event.receivedAt ||
          new Date(),
      });
  } catch (error) {
    if (
      Number(
        error?.code
      ) === 11000
    ) {
      return EventModel.findOne({
        eventKey:
          event.eventKey,
      });
    }

    throw error;
  }
}

async function processPersistedEvent(
  record,
  event,
  dependencies = {}
) {
  record.attemptCount =
    Number(
      record.attemptCount ||
        0
    ) + 1;

  try {
    const result =
      await applyEvent(
        event,
        dependencies
      );

    record.delivery =
      result.delivery?._id ||
      null;
    record.deliveryId =
      result.delivery
        ?.deliveryId ||
      "";
    record.whatsappConversation =
      result.conversationId ||
      null;

    if (
      !result.matched &&
      result.reason ===
        "unknown_provider_message"
    ) {
      record.processingStatus =
        "pending";
      record.processingReason =
        "provider_message_not_yet_persisted";
      record.processedAt =
        null;
    } else if (
      result.updated
    ) {
      record.processingStatus =
        "processed";
      record.processingReason =
        result.reason;
      record.processedAt =
        new Date();
    } else {
      record.processingStatus =
        "ignored";
      record.processingReason =
        result.reason;
      record.processedAt =
        new Date();
    }

    record.lastError = {
      code: "",
      message: "",
    };

    await record.save();

    return {
      processed:
        result.updated,
      pending:
        record.processingStatus ===
        "pending",
      ignored:
        record.processingStatus ===
        "ignored",
      duplicate: false,
      reason:
        record.processingReason,
      eventKey:
        record.eventKey,
      providerMessageId:
        record.providerMessageId,
      providerStatus:
        record.providerStatus,
      channel:
        record.channel,
      deliveryId:
        record.deliveryId,
      conversationId:
        result.conversationId ||
        null,
      status:
        result.delivery
          ?.status ||
        null,
    };
  } catch (error) {
    record.processingStatus =
      "failed";
    record.processingReason =
      "processing_failed";
    record.lastError = {
      code:
        boundedText(
          error?.code,
          200
        ),
      message:
        boundedText(
          error?.message,
          1000
        ),
    };
    await record.save();
    throw error;
  }
}

export async function processTwilioStatusEvent(
  source,
  {
    EventModel =
      TwilioStatusWebhookEvent,
    ...dependencies
  } = {}
) {
  const event =
    normaliseTwilioStatusEvent(
      source
    );

  if (!event.valid) {
    return {
      processed: false,
      pending: false,
      ignored: true,
      duplicate: false,
      reason:
        event.reason,
      providerMessageId:
        event.providerMessageId ||
        "",
    };
  }

  event.receivedAt =
    new Date();

  let record =
    await EventModel.findOne({
      eventKey:
        event.eventKey,
    });

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
      processed: false,
      pending: false,
      ignored: true,
      duplicate: true,
      reason:
        "duplicate_event",
      eventKey:
        event.eventKey,
      providerMessageId:
        event.providerMessageId,
      providerStatus:
        event.providerStatus,
      channel:
        event.channel,
      deliveryId:
        record.deliveryId ||
        "",
      conversationId:
        record
          .whatsappConversation ||
        null,
    };
  }

  if (!record) {
    record =
      await createEventRecord(
        event,
        EventModel
      );
  }

  return processPersistedEvent(
    record,
    event,
    dependencies
  );
}

export async function reconcilePendingTwilioStatusEvents(
  providerMessageId,
  {
    EventModel =
      TwilioStatusWebhookEvent,
    ...dependencies
  } = {}
) {
  const messageId =
    text(
      providerMessageId
    );

  if (!messageId) {
    return {
      processed: 0,
      ignored: 0,
      pending: 0,
      failed: 0,
      results: [],
    };
  }

  const records =
    await EventModel
      .find({
        providerMessageId:
          messageId,
        processingStatus:
          "pending",
      })
      .sort({
        receivedAt: 1,
        createdAt: 1,
      });

  const results = [];

  for (
    const record of
    records
  ) {
    try {
      results.push(
        await processPersistedEvent(
          record,
          eventFromRecord(
            record
          ),
          dependencies
        )
      );
    } catch (error) {
      results.push({
        processed: false,
        pending: false,
        ignored: false,
        failed: true,
        reason:
          "processing_failed",
        eventKey:
          record.eventKey,
        providerMessageId:
          record.providerMessageId,
        errorCode:
          boundedText(
            error?.code,
            200
          ),
      });
    }
  }

  return {
    processed:
      results.filter(
        (result) =>
          result.processed
      ).length,
    ignored:
      results.filter(
        (result) =>
          result.ignored
      ).length,
    pending:
      results.filter(
        (result) =>
          result.pending
      ).length,
    failed:
      results.filter(
        (result) =>
          result.failed
      ).length,
    results,
  };
}

export async function listTwilioStatusEvents(
  {
    providerMessageId = "",
    processingStatus = "",
    channel = "",
    limit = 50,
  } = {},
  {
    EventModel =
      TwilioStatusWebhookEvent,
  } = {}
) {
  const query = {};

  const messageId =
    text(
      providerMessageId
    );
  const status =
    lower(
      processingStatus
    );
  const resolvedChannel =
    lower(
      channel
    );

  if (messageId) {
    query.providerMessageId =
      messageId;
  }

  if (
    [
      "pending",
      "processed",
      "ignored",
      "failed",
    ].includes(
      status
    )
  ) {
    query.processingStatus =
      status;
  }

  if (
    [
      "sms",
      "whatsapp",
      "unknown",
    ].includes(
      resolvedChannel
    )
  ) {
    query.channel =
      resolvedChannel;
  }

  const safeLimit =
    Math.min(
      200,
      Math.max(
        1,
        Number.parseInt(
          limit,
          10
        ) || 50
      )
    );

  return EventModel
    .find(query)
    .sort({
      receivedAt: -1,
      createdAt: -1,
    })
    .limit(
      safeLimit
    )
    .lean();
}

export default {
  decideTwilioDeliveryStatusUpdate,
  listTwilioStatusEvents,
  normaliseTwilioStatusEvent,
  processTwilioStatusEvent,
  reconcilePendingTwilioStatusEvents,
};
