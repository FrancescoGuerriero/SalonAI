import assert from "node:assert/strict";
import test from "node:test";

import {
  decideTwilioDeliveryStatusUpdate,
  normaliseTwilioStatusEvent,
  processTwilioStatusEvent,
  reconcilePendingTwilioStatusEvents,
} from "../integrations/messaging/twilioStatusWebhookService.js";

function eventModelFixture() {
  const records = [];

  function attachSave(
    source
  ) {
    return {
      ...source,
      async save() {
        return this;
      },
    };
  }

  return {
    records,

    model: {
      async findOne(
        query
      ) {
        return (
          records.find(
            (record) =>
              !query.eventKey ||
              record.eventKey ===
                query.eventKey
          ) ||
          null
        );
      },

      async create(
        data
      ) {
        const record =
          attachSave({
            ...data,
            _id:
              `event-${records.length + 1}`,
            delivery:
              null,
            deliveryId:
              "",
            whatsappConversation:
              null,
            processingReason:
              "",
            processedAt:
              null,
            lastError: {
              code: "",
              message: "",
            },
            createdAt:
              new Date(
                "2026-09-19T20:00:00.000Z"
              ),
          });

        records.push(
          record
        );

        return record;
      },

      find(
        query
      ) {
        return {
          async sort() {
            return records
              .filter(
                (record) =>
                  record
                    .providerMessageId ===
                    query
                      .providerMessageId &&
                  record
                    .processingStatus ===
                    query
                      .processingStatus
              )
              .sort(
                (left, right) =>
                  new Date(
                    left.receivedAt
                  ) -
                  new Date(
                    right.receivedAt
                  )
              );
          },
        };
      },
    },
  };
}

function smsSource(
  status = "delivered",
  overrides = {}
) {
  return {
    MessageSid:
      "SM123",
    MessageStatus:
      status,
    From:
      "+442000000001",
    To:
      "+447700900001",
    ...overrides,
  };
}

test(
  "Twilio event normalization is deterministic and distinguishes WhatsApp",
  () => {
    const first =
      normaliseTwilioStatusEvent({
        MessageSid:
          "SM123",
        MessageStatus:
          "delivered",
        From:
          "whatsapp:+14155238886",
        To:
          "whatsapp:+447700900001",
        ErrorCode:
          "",
      });

    const reordered =
      normaliseTwilioStatusEvent({
        ErrorCode:
          "",
        To:
          "whatsapp:+447700900001",
        From:
          "whatsapp:+14155238886",
        MessageStatus:
          "delivered",
        MessageSid:
          "SM123",
      });

    assert.equal(
      first.valid,
      true
    );
    assert.equal(
      first.channel,
      "whatsapp"
    );
    assert.equal(
      first.eventKey,
      reordered.eventKey
    );
    assert.equal(
      Object.prototype
        .hasOwnProperty.call(
          first.evidence,
          "To"
        ),
      false
    );
  }
);

test(
  "Twilio SMS status decisions prevent regressions while allowing read advancement",
  () => {
    assert.deepEqual(
      decideTwilioDeliveryStatusUpdate(
        {
          status:
            "delivered",
          providerStatus:
            "delivered",
        },
        "sent"
      ),
      {
        action:
          "ignore",
        reason:
          "status_regression",
      }
    );

    assert.deepEqual(
      decideTwilioDeliveryStatusUpdate(
        {
          status:
            "delivered",
          providerStatus:
            "delivered",
        },
        "read"
      ),
      {
        action:
          "update",
        reason:
          "provider_read",
      }
    );

    assert.deepEqual(
      decideTwilioDeliveryStatusUpdate(
        {
          status:
            "delivered",
          providerStatus:
            "delivered",
        },
        "undelivered"
      ),
      {
        action:
          "ignore",
        reason:
          "delivered_status_final",
      }
    );

    assert.deepEqual(
      decideTwilioDeliveryStatusUpdate(
        {
          status:
            "sent",
          providerStatus:
            "sent",
        },
        "undelivered"
      ),
      {
        action:
          "update",
        reason:
          "provider_failure",
      }
    );
  }
);

test(
  "signed Twilio callback is retained pending when the local SMS provider id has not been persisted yet",
  async () => {
    const events =
      eventModelFixture();

    const result =
      await processTwilioStatusEvent(
        smsSource(),
        {
          EventModel:
            events.model,
          DeliveryModel: {
            async findByProviderMessageId() {
              return null;
            },
          },
          async updateDelivery() {
            throw new Error(
              "update should not run"
            );
          },
          async persistWhatsApp() {
            throw new Error(
              "WhatsApp should not run"
            );
          },
        }
      );

    assert.equal(
      result.processed,
      false
    );
    assert.equal(
      result.pending,
      true
    );
    assert.equal(
      result.reason,
      "provider_message_not_yet_persisted"
    );
    assert.equal(
      events.records.length,
      1
    );
    assert.equal(
      events.records[0]
        .processingStatus,
      "pending"
    );
  }
);

test(
  "pending SMS callback reconciles after the MessageDelivery provider id appears",
  async () => {
    const events =
      eventModelFixture();
    let delivery =
      null;

    const dependencies = {
      EventModel:
        events.model,

      DeliveryModel: {
        async findByProviderMessageId() {
          return delivery;
        },
      },

      async updateDelivery(
        payload
      ) {
        assert.equal(
          payload
            .providerMessageId,
          "SM123"
        );
        assert.equal(
          payload.status,
          "delivered"
        );

        delivery.status =
          "delivered";
        delivery.providerStatus =
          "delivered";
        delivery.__v +=
          1;

        return delivery;
      },

      async persistWhatsApp() {
        throw new Error(
          "WhatsApp should not run"
        );
      },
    };

    const pending =
      await processTwilioStatusEvent(
        smsSource(),
        dependencies
      );

    assert.equal(
      pending.pending,
      true
    );

    delivery = {
      _id:
        "delivery-object-id",
      deliveryId:
        "delivery-1",
      providerMessageId:
        "SM123",
      providerStatus:
        "sent",
      status:
        "sent",
      __v:
        2,
    };

    const replay =
      await reconcilePendingTwilioStatusEvents(
        "SM123",
        dependencies
      );

    assert.equal(
      replay.processed,
      1
    );
    assert.equal(
      replay.pending,
      0
    );
    assert.equal(
      delivery.status,
      "delivered"
    );
    assert.equal(
      events.records[0]
        .processingStatus,
      "processed"
    );
    assert.equal(
      events.records[0]
        .deliveryId,
      "delivery-1"
    );
  }
);

test(
  "Twilio WhatsApp callback dispatches to the conversation status engine",
  async () => {
    const events =
      eventModelFixture();
    let whatsappCalls =
      0;

    const result =
      await processTwilioStatusEvent(
        {
          MessageSid:
            "SM-WA-1",
          MessageStatus:
            "read",
          From:
            "whatsapp:+14155238886",
          To:
            "whatsapp:+447700900001",
        },
        {
          EventModel:
            events.model,

          DeliveryModel: {
            async findByProviderMessageId() {
              throw new Error(
                "SMS lookup should not run"
              );
            },
          },

          async persistWhatsApp(
            event
          ) {
            whatsappCalls +=
              1;

            assert.equal(
              event
                .providerStatus,
              "read"
            );

            return {
              matched:
                true,
              updated:
                true,
              ignored:
                false,
              duplicate:
                false,
              reason:
                "status_advanced",
              conversationId:
                "507f1f77bcf86cd799439011",
            };
          },
        }
      );

    assert.equal(
      whatsappCalls,
      1
    );
    assert.equal(
      result.processed,
      true
    );
    assert.equal(
      result.pending,
      false
    );
    assert.equal(
      result.channel,
      "whatsapp"
    );
    assert.equal(
      events.records[0]
        .processingStatus,
      "processed"
    );
  }
);

test(
  "identical Twilio callback is idempotent after successful processing",
  async () => {
    const events =
      eventModelFixture();
    const delivery = {
      _id:
        "delivery-object-id",
      deliveryId:
        "delivery-2",
      providerMessageId:
        "SM123",
      providerStatus:
        "sent",
      status:
        "sent",
      __v:
        1,
    };
    let updates =
      0;

    const dependencies = {
      EventModel:
        events.model,

      DeliveryModel: {
        async findByProviderMessageId() {
          return delivery;
        },
      },

      async updateDelivery() {
        updates +=
          1;
        delivery.status =
          "delivered";
        delivery.providerStatus =
          "delivered";
        return delivery;
      },

      async persistWhatsApp() {
        throw new Error(
          "WhatsApp should not run"
        );
      },
    };

    const source =
      smsSource();

    const first =
      await processTwilioStatusEvent(
        source,
        dependencies
      );

    const duplicate =
      await processTwilioStatusEvent(
        source,
        dependencies
      );

    assert.equal(
      first.processed,
      true
    );
    assert.equal(
      duplicate.duplicate,
      true
    );
    assert.equal(
      updates,
      1
    );
    assert.equal(
      events.records.length,
      1
    );
  }
);

test(
  "stale Twilio callback is durably acknowledged without regressing delivery state",
  async () => {
    const events =
      eventModelFixture();
    const delivery = {
      _id:
        "delivery-object-id",
      deliveryId:
        "delivery-3",
      providerMessageId:
        "SM123",
      providerStatus:
        "delivered",
      status:
        "delivered",
      __v:
        4,
    };
    let updates =
      0;

    const result =
      await processTwilioStatusEvent(
        smsSource(
          "queued"
        ),
        {
          EventModel:
            events.model,

          DeliveryModel: {
            async findByProviderMessageId() {
              return delivery;
            },
          },

          async updateDelivery() {
            updates +=
              1;
          },

          async persistWhatsApp() {
            throw new Error(
              "WhatsApp should not run"
            );
          },
        }
      );

    assert.equal(
      result.processed,
      false
    );
    assert.equal(
      result.ignored,
      true
    );
    assert.equal(
      result.reason,
      "status_regression"
    );
    assert.equal(
      updates,
      0
    );
    assert.equal(
      delivery.status,
      "delivered"
    );
    assert.equal(
      events.records[0]
        .processingStatus,
      "ignored"
    );
  }
);
