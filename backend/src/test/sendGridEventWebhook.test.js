import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";

import app from "../app.js";
import {
  decideSendGridDeliveryStatus,
  normaliseSendGridEvent,
  processSendGridEvent,
} from "../integrations/messaging/sendGridEventWebhookService.js";
import {
  verifySendGridEventWebhookSignature,
} from "../integrations/messaging/sendGridEventWebhookSecurity.js";

const ENVIRONMENT_MISSING =
  Symbol(
    "environment-missing"
  );

async function withEnvironment(
  values,
  callback
) {
  const previous =
    new Map();

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values
    )
  ) {
    previous.set(
      key,
      Object.prototype.hasOwnProperty.call(
        process.env,
        key
      )
        ? process.env[
            key
          ]
        : ENVIRONMENT_MISSING
    );

    if (
      value === null ||
      value ===
        undefined
    ) {
      delete process.env[
        key
      ];
    } else {
      process.env[
        key
      ] =
        String(
          value
        );
    }
  }

  try {
    return await callback();
  } finally {
    for (
      const [
        key,
        value,
      ] of previous
    ) {
      if (
        value ===
        ENVIRONMENT_MISSING
      ) {
        delete process.env[
          key
        ];
      } else {
        process.env[
          key
        ] =
          value;
      }
    }
  }
}

async function startTestServer() {
  const server =
    app.listen(
      0,
      "127.0.0.1"
    );

  await new Promise(
    (
      resolve,
      reject
    ) => {
      server.once(
        "listening",
        resolve
      );
      server.once(
        "error",
        reject
      );
    }
  );

  const address =
    server.address();

  if (
    !address ||
    typeof address ===
      "string"
  ) {
    server.close();
    throw new Error(
      "Unable to resolve test server address."
    );
  }

  return {
    server,
    baseUrl:
      `http://127.0.0.1:${address.port}`,
  };
}

async function closeTestServer(
  server
) {
  await new Promise(
    (
      resolve,
      reject
    ) => {
      server.close(
        (error) => {
          if (error) {
            reject(
              error
            );
            return;
          }

          resolve();
        }
      );
    }
  );
}

function signingFixture(
  payload
) {
  const {
    publicKey,
    privateKey,
  } =
    generateKeyPairSync(
      "ec",
      {
        namedCurve:
          "prime256v1",
      }
    );

  const timestamp =
    "1789848000";
  const rawBody =
    Buffer.from(
      payload,
      "utf8"
    );
  const signed =
    Buffer.concat([
      Buffer.from(
        timestamp,
        "utf8"
      ),
      rawBody,
    ]);

  const signature =
    sign(
      "sha256",
      signed,
      privateKey
    ).toString(
      "base64"
    );

  const publicKeyBase64 =
    publicKey
      .export({
        type:
          "spki",
        format:
          "der",
      })
      .toString(
        "base64"
      );

  return {
    rawBody,
    timestamp,
    signature,
    publicKeyBase64,
  };
}

function createEventModel() {
  const records =
    new Map();

  function createRecord(
    data
  ) {
    return {
      ...data,
      _id:
        `event-${records.size + 1}`,
      delivery:
        data.delivery ||
        null,
      deliveryId:
        data.deliveryId ||
        "",
      processingStatus:
        data.processingStatus ||
        "pending",
      processingReason:
        data.processingReason ||
        "",
      attemptCount:
        data.attemptCount ||
        0,
      lastError: {
        code:
          "",
        message:
          "",
      },
      async save() {
        records.set(
          this.eventId,
          this
        );
        return this;
      },
    };
  }

  return {
    records,
    model: {
      async findOne({
        eventId,
      }) {
        return (
          records.get(
            eventId
          ) ||
          null
        );
      },
      async create(
        data
      ) {
        if (
          records.has(
            data.eventId
          )
        ) {
          const error =
            new Error(
              "Duplicate"
            );
          error.code =
            11000;
          throw error;
        }

        const record =
          createRecord(
            data
          );

        records.set(
          data.eventId,
          record
        );

        return record;
      },
    },
  };
}

test(
  "SendGrid signature verification uses timestamp plus unchanged raw body",
  () => {
    const fixture =
      signingFixture(
        '[{"event":"delivered"}]\r\n'
      );

    assert.equal(
      verifySendGridEventWebhookSignature({
        publicKey:
          fixture.publicKeyBase64,
        rawBody:
          fixture.rawBody,
        signature:
          fixture.signature,
        timestamp:
          fixture.timestamp,
      }),
      true
    );

    assert.equal(
      verifySendGridEventWebhookSignature({
        publicKey:
          fixture.publicKeyBase64,
        rawBody:
          Buffer.from(
            '[{"event":"delivered"}]'
          ),
        signature:
          fixture.signature,
        timestamp:
          fixture.timestamp,
      }),
      false
    );
  }
);

test(
  "normalises SendGrid delivery evidence without retaining recipient PII",
  () => {
    const event =
      normaliseSendGridEvent({
        email:
          "customer@example.com",
        event:
          "delivered",
        sg_event_id:
          "event-1",
        sg_message_id:
          "sendgrid-message-1",
        "smtp-id":
          "<smtp-message-1@example.com>",
        timestamp:
          1789848000,
        response:
          "250 OK",
      });

    assert.equal(
      event.valid,
      true
    );
    assert.equal(
      event.category,
      "delivery"
    );
    assert.equal(
      event.smtpId,
      "<smtp-message-1@example.com>"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        event,
        "email"
      ),
      false
    );
  }
);

test(
  "SendGrid status decisions preserve temporary deferrals and allow final provider evidence",
  () => {
    assert.deepEqual(
      decideSendGridDeliveryStatus(
        "sent",
        "deferred"
      ),
      {
        action:
          "ignore",
        reason:
          "temporary_deferral",
        status:
          "sent",
      }
    );

    assert.equal(
      decideSendGridDeliveryStatus(
        "sent",
        "delivered"
      ).status,
      "delivered"
    );

    assert.equal(
      decideSendGridDeliveryStatus(
        "delivered",
        "bounce"
      ).status,
      "undelivered"
    );

    assert.equal(
      decideSendGridDeliveryStatus(
        "undelivered",
        "delivered"
      ).action,
      "ignore"
    );
  }
);

test(
  "delivery events reconcile by SMTP message id and duplicate event IDs are idempotent",
  async () => {
    const {
      model:
        EventModel,
    } =
      createEventModel();

    const delivery = {
      _id:
        "delivery-object-id",
      deliveryId:
        "salonai-delivery-1",
      channel:
        "email",
      provider:
        "sendgrid",
      providerMessageId:
        "<smtp-message-1@example.com>",
      status:
        "sent",
      __v:
        4,
    };

    const DeliveryModel = {
      async findOne(
        query
      ) {
        const variants =
          query.$or[0]
            .providerMessageId
            .$in;

        return variants.includes(
          delivery
            .providerMessageId
        )
          ? delivery
          : null;
      },
    };

    let updates =
      0;

    const updateDelivery =
      async (
        providerEvent
      ) => {
        updates +=
          1;
        assert.equal(
          providerEvent.status,
          "delivered"
        );
        assert.equal(
          providerEvent
            .expectedVersion,
          4
        );

        return {
          ...delivery,
          status:
            "delivered",
        };
      };

    const event = {
      event:
        "delivered",
      sg_event_id:
        "sendgrid-event-1",
      sg_message_id:
        "sendgrid-message-1",
      "smtp-id":
        "<smtp-message-1@example.com>",
      timestamp:
        1789848000,
    };

    const first =
      await processSendGridEvent(
        event,
        {
          EventModel,
          DeliveryModel,
          updateDelivery,
        }
      );

    const second =
      await processSendGridEvent(
        event,
        {
          EventModel,
          DeliveryModel,
          updateDelivery,
        }
      );

    assert.equal(
      first.statusChanged,
      true
    );
    assert.equal(
      second.duplicate,
      true
    );
    assert.equal(
      updates,
      1
    );
  }
);

test(
  "engagement events are durable evidence but never mutate delivery status",
  async () => {
    const {
      model:
        EventModel,
      records,
    } =
      createEventModel();

    const DeliveryModel = {
      async findOne() {
        return {
          _id:
            "delivery-object-id",
          deliveryId:
            "salonai-delivery-2",
          status:
            "delivered",
        };
      },
    };

    let updateCalled =
      false;

    const result =
      await processSendGridEvent(
        {
          event:
            "click",
          sg_event_id:
            "click-event-1",
          sg_message_id:
            "sendgrid-message-2",
          "smtp-id":
            "<smtp-message-2@example.com>",
          timestamp:
            1789848000,
          email:
            "customer@example.com",
          url:
            "https://example.com/private-link",
        },
        {
          EventModel,
          DeliveryModel,
          async updateDelivery() {
            updateCalled =
              true;
          },
        }
      );

    assert.equal(
      result.statusChanged,
      false
    );
    assert.equal(
      updateCalled,
      false
    );

    const stored =
      records.get(
        "click-event-1"
      );

    assert.equal(
      stored.deliveryId,
      "salonai-delivery-2"
    );
    assert.equal(
      JSON.stringify(
        stored
      ).includes(
        "customer@example.com"
      ),
      false
    );
    assert.equal(
      JSON.stringify(
        stored
      ).includes(
        "private-link"
      ),
      false
    );
  }
);

test(
  "public SendGrid webhook validates its signature before SalonAI authentication",
  async () => {
    const payload =
      "[]";
    const fixture =
      signingFixture(
        payload
      );

    await withEnvironment(
      {
        SENDGRID_EVENT_WEBHOOK_ENABLED:
          "true",
        SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY:
          fixture.publicKeyBase64,
      },
      async () => {
        const {
          server,
          baseUrl,
        } =
          await startTestServer();

        try {
          const valid =
            await fetch(
              `${baseUrl}/api/message-delivery/webhooks/sendgrid/events`,
              {
                method:
                  "POST",
                headers: {
                  "content-type":
                    "application/json",
                  "x-twilio-email-event-webhook-signature":
                    fixture.signature,
                  "x-twilio-email-event-webhook-timestamp":
                    fixture.timestamp,
                },
                body:
                  payload,
              }
            );

          assert.equal(
            valid.status,
            204
          );

          const invalid =
            await fetch(
              `${baseUrl}/api/message-delivery/webhooks/sendgrid/events`,
              {
                method:
                  "POST",
                headers: {
                  "content-type":
                    "application/json",
                  "x-twilio-email-event-webhook-signature":
                    "invalid",
                  "x-twilio-email-event-webhook-timestamp":
                    fixture.timestamp,
                },
                body:
                  payload,
              }
            );

          const error =
            await invalid.json();

          assert.equal(
            invalid.status,
            403
          );
          assert.equal(
            error.code,
            "SENDGRID_WEBHOOK_SIGNATURE_INVALID"
          );
        } finally {
          await closeTestServer(
            server
          );
        }
      }
    );
  }
);
