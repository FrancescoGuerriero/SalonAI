import assert from "node:assert/strict";
import test from "node:test";

import twilio from "twilio";

import app from "../app.js";

import {
  decideSmsDeliveryStatusUpdate,
  normaliseSmsStatusEvent,
  processSmsStatusEvent,
  verifySmsStatusWebhookRequest,
} from "../features/premium/sms/smsStatusWebhookController.js";

function withEnvironment(
  values,
  callback
) {
  const previous =
    new Map();

  for (
    const [key, value]
    of Object.entries(
      values
    )
  ) {
    previous.set(
      key,
      process.env[key]
    );

    if (
      value === undefined
    ) {
      delete process.env[key];
    } else {
      process.env[key] =
        String(value);
    }
  }

  try {
    return callback();
  } finally {
    for (
      const [key, value]
      of previous
    ) {
      if (
        value === undefined
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
          value;
      }
    }
  }
}

async function withAsyncEnvironment(
  values,
  callback
) {
  const previous =
    new Map();

  for (
    const [key, value]
    of Object.entries(
      values
    )
  ) {
    previous.set(
      key,
      process.env[key]
    );

    if (
      value === undefined
    ) {
      delete process.env[key];
    } else {
      process.env[key] =
        String(value);
    }
  }

  try {
    return await callback();
  } finally {
    for (
      const [key, value]
      of previous
    ) {
      if (
        value === undefined
      ) {
        delete process.env[key];
      } else {
        process.env[key] =
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
    (resolve, reject) => {
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
      "Unable to resolve test HTTP server address."
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
  if (!server) {
    return;
  }

  await new Promise(
    (resolve, reject) => {
      server.close(
        (error) => {
          if (error) {
            reject(error);

            return;
          }

          resolve();
        }
      );
    }
  );
}

test(
  "normalises Twilio SMS delivery callbacks",
  () => {
    const event =
      normaliseSmsStatusEvent({
        body: {
          MessageSid:
            "SM123456789",

          MessageStatus:
            "delivered",

          ErrorCode:
            "0",

          NumSegments:
            "2",
        },
      });

    assert.equal(
      event.valid,
      true
    );

    assert.equal(
      event.providerMessageId,
      "SM123456789"
    );

    assert.equal(
      event.providerStatus,
      "delivered"
    );

    assert.equal(
      event.segments,
      2
    );
  }
);

test(
  "rejects unsupported provider statuses without throwing",
  () => {
    const event =
      normaliseSmsStatusEvent({
        body: {
          MessageSid:
            "SM123456789",

          MessageStatus:
            "something-new",
        },
      });

    assert.equal(
      event.valid,
      false
    );

    assert.equal(
      event.reason,
      "unsupported_status"
    );
  }
);

test(
  "allows forward SMS status progression",
  () => {
    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "accepted",
        "queued"
      ),
      {
        action: "update",
        reason:
          "status_advanced",
      }
    );

    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "sent",
        "delivered"
      ),
      {
        action: "update",
        reason:
          "status_advanced",
      }
    );
  }
);

test(
  "ignores duplicate and regressive SMS callbacks",
  () => {
    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "delivered",
        "delivered"
      ),
      {
        action: "ignore",
        reason:
          "duplicate",
      }
    );

    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "delivered",
        "sent"
      ),
      {
        action: "ignore",
        reason:
          "terminal_status",
      }
    );

    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "sent",
        "queued"
      ),
      {
        action: "ignore",
        reason:
          "status_regression",
      }
    );
  }
);

test(
  "allows undelivered after an attempted SMS send",
  () => {
    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "sent",
        "undelivered"
      ),
      {
        action: "update",
        reason:
          "delivery_failure",
      }
    );
  }
);

test(
  "does not allow delayed failed callback to overwrite sent",
  () => {
    assert.deepEqual(
      decideSmsDeliveryStatusUpdate(
        "sent",
        "failed"
      ),
      {
        action: "ignore",
        reason:
          "status_regression",
      }
    );
  }
);

test(
  "ignores callback for unknown Twilio message",
  async () => {
    const event = {
      valid: true,

      providerMessageId:
        "SMunknown",

      providerStatus:
        "delivered",

      errorCode: null,
      errorMessage: "",
      price: null,
      priceUnit: "",
      segments: 1,
      providerResponse: {},
    };

    const DeliveryModel = {
      async findByProviderMessageId() {
        return null;
      },
    };

    let updateCalled =
      false;

    const result =
      await processSmsStatusEvent(
        event,
        {
          DeliveryModel,

          async updateDelivery() {
            updateCalled =
              true;

            return null;
          },
        }
      );

    assert.equal(
      result.ignored,
      true
    );

    assert.equal(
      result.reason,
      "unknown_provider_message"
    );

    assert.equal(
      updateCalled,
      false
    );
  }
);

test(
  "updates matching SMS delivery record",
  async () => {
    const event = {
      valid: true,

      providerMessageId:
        "SM123",

      providerStatus:
        "delivered",

      errorCode: null,
      errorMessage: "",
      price: "-0.01",
      priceUnit: "USD",
      segments: 1,

      providerResponse: {
        messageSid:
          "SM123",

        messageStatus:
          "delivered",
      },
    };

    const DeliveryModel = {
      async findByProviderMessageId() {
        return {
          _id:
            "record-object-id",

          deliveryId:
            "salonai-delivery-1",

          channel:
            "sms",

          status:
            "sent",

          providerStatus:
            "sent",
        };
      },
    };

    let suppliedEvent =
      null;

    const result =
      await processSmsStatusEvent(
        event,
        {
          DeliveryModel,

          async updateDelivery(
            providerEvent
          ) {
            suppliedEvent =
              providerEvent;

            return {
              deliveryId:
                "salonai-delivery-1",
            };
          },
        }
      );

    assert.equal(
      result.updated,
      true
    );

    assert.equal(
      result.reason,
      "status_advanced"
    );

    assert.equal(
      suppliedEvent.status,
      "delivered"
    );

    assert.equal(
      suppliedEvent.segments,
      1
    );
  }
);

test(
  "validates real Twilio request signatures",
  () => {
    const authToken =
      "test_auth_token_123";

    const url =
      "https://example.test/api/sms/status";

    const body = {
      MessageSid:
        "SM123",

      MessageStatus:
        "delivered",
    };

    const signature =
      twilio
        .getExpectedTwilioSignature(
          authToken,
          url,
          body
        );

    withEnvironment(
      {
        NODE_ENV:
          "production",

        TWILIO_AUTH_TOKEN:
          authToken,

        TWILIO_STATUS_CALLBACK_URL:
          url,

        TWILIO_WEBHOOK_VALIDATION_ENABLED:
          "true",
      },
      () => {
        const request = {
          headers: {
            "x-twilio-signature":
              signature,
          },

          body,

          originalUrl:
            "/api/sms/status",

          protocol:
            "https",

          get(name) {
            if (
              name === "host"
            ) {
              return "example.test";
            }

            return "";
          },
        };

        assert.equal(
          verifySmsStatusWebhookRequest(
            request
          ),
          true
        );

        request.headers[
          "x-twilio-signature"
        ] =
          "invalid-signature";

        assert.equal(
          verifySmsStatusWebhookRequest(
            request
          ),
          false
        );
      }
    );
  }
);

test(
  "POST /api/sms/status is public but rejects an unsigned Twilio callback",
  async () => {
    await withAsyncEnvironment(
      {
        NODE_ENV:
          "production",

        TWILIO_AUTH_TOKEN:
          "route_test_auth_token",

        TWILIO_WEBHOOK_VALIDATION_ENABLED:
          "true",

        TWILIO_STATUS_CALLBACK_URL:
          undefined,

        TWILIO_WEBHOOK_BASE_URL:
          undefined,
      },
      async () => {
        const {
          server,
          baseUrl,
        } =
          await startTestServer();

        try {
          const response =
            await fetch(
              `${baseUrl}/api/sms/status`,
              {
                method:
                  "POST",

                headers: {
                  "content-type":
                    "application/x-www-form-urlencoded",
                },

                body:
                  new URLSearchParams({
                    MessageSid:
                      "SMroute123",

                    MessageStatus:
                      "delivered",
                  }),
              }
            );

          const payload =
            await response.json();

          /*
           * 403 proves the request reached the
           * Twilio webhook signature guard.
           *
           * If protect middleware ran first,
           * this request would return 401.
           */
          assert.equal(
            response.status,
            403
          );

          assert.equal(
            payload.success,
            false
          );

          assert.equal(
            payload.code,
            "SMS_WEBHOOK_SIGNATURE_INVALID"
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

test(
  "GET /api/sms/rules remains protected by SalonAI authentication",
  async () => {
    const {
      server,
      baseUrl,
    } =
      await startTestServer();

    try {
      const response =
        await fetch(
          `${baseUrl}/api/sms/rules`
        );

      const payload =
        await response.json();

      assert.equal(
        response.status,
        401
      );

      assert.equal(
        payload.success,
        false
      );
    } finally {
      await closeTestServer(
        server
      );
    }
  }
);
