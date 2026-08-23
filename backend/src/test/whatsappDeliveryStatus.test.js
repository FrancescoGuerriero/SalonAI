import assert from "node:assert/strict";
import test from "node:test";
import twilio from "twilio";

import {
  normaliseWhatsAppWebhookDeliveryStatus,
  normaliseWhatsAppWebhookMessages,
  verifyWhatsAppWebhookRequest,
} from "../providers/whatsapp/whatsappWebhookAdapter.js";

import {
  decideWhatsAppDeliveryStatusUpdate,
  persistWhatsAppDeliveryStatus,
} from "../features/premium/whatsapp/whatsappDeliveryStatusService.js";

function restoreEnvironment(
  name,
  value
) {
  if (
    value === undefined
  ) {
    delete process.env[name];
    return;
  }

  process.env[name] =
    value;
}

function fakeConversation({
  direction = "outbound",
  providerMessageId =
    "SM_PHASE_811B",
  providerStatus = "sent",
  error = "",
} = {}) {
  const message = {
    direction,
    providerMessageId,
    providerStatus,
    error,
  };

  const conversation = {
    _id:
      "conversation-phase-811b",

    messages: [
      message,
    ],

    saveCount: 0,

    async save() {
      this.saveCount += 1;
      return this;
    },
  };

  return {
    conversation,
    message,
  };
}

function fakeModel(
  conversation
) {
  return {
    async findOne() {
      return (
        conversation ||
        null
      );
    },
  };
}

test(
  "Twilio status callback signature validation accepts a correctly signed request",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    const originalToken =
      process.env
        .TWILIO_AUTH_TOKEN;

    const originalWebhookUrl =
      process.env
        .WHATSAPP_WEBHOOK_URL;

    try {
      const authToken =
        "phase-8.11b-auth-token";

      const webhookUrl =
        "https://example.test/api/whatsapp/webhook";

      const body = {
        MessageSid:
          "SM_PHASE_811B",
        MessageStatus:
          "delivered",
        ErrorCode: "0",
      };

      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      process.env
        .TWILIO_AUTH_TOKEN =
        authToken;

      process.env
        .WHATSAPP_WEBHOOK_URL =
        webhookUrl;

      const signature =
        twilio
          .getExpectedTwilioSignature(
            authToken,
            webhookUrl,
            body
          );

      const verified =
        verifyWhatsAppWebhookRequest({
          headers: {
            "x-twilio-signature":
              signature,
          },
          body,
        });

      assert.equal(
        verified,
        true
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );

      restoreEnvironment(
        "TWILIO_AUTH_TOKEN",
        originalToken
      );

      restoreEnvironment(
        "WHATSAPP_WEBHOOK_URL",
        originalWebhookUrl
      );
    }
  }
);

test(
  "Twilio status callback signature validation rejects an invalid signature",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    const originalToken =
      process.env
        .TWILIO_AUTH_TOKEN;

    const originalWebhookUrl =
      process.env
        .WHATSAPP_WEBHOOK_URL;

    try {
      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      process.env
        .TWILIO_AUTH_TOKEN =
        "phase-8.11b-auth-token";

      process.env
        .WHATSAPP_WEBHOOK_URL =
        "https://example.test/api/whatsapp/webhook";

      const verified =
        verifyWhatsAppWebhookRequest({
          headers: {
            "x-twilio-signature":
              "not-a-valid-signature",
          },
          body: {
            MessageSid:
              "SM_PHASE_811B",
            MessageStatus:
              "delivered",
          },
        });

      assert.equal(
        verified,
        false
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );

      restoreEnvironment(
        "TWILIO_AUTH_TOKEN",
        originalToken
      );

      restoreEnvironment(
        "WHATSAPP_WEBHOOK_URL",
        originalWebhookUrl
      );
    }
  }
);

test(
  "Twilio delivery callback maps MessageSid and MessageStatus",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    try {
      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      const result =
        normaliseWhatsAppWebhookDeliveryStatus({
          body: {
            MessageSid:
              "SM_PHASE_811B",
            MessageStatus:
              "delivered",
            ErrorCode: "0",
          },
        });

      assert.deepEqual(
        result,
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "delivered",
          error: "",
        }
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "Twilio WhatsApp READ event maps to read status",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    try {
      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      const result =
        normaliseWhatsAppWebhookDeliveryStatus({
          body: {
            MessageSid:
              "SM_PHASE_811B",
            MessageStatus:
              "delivered",
            EventType:
              "READ",
          },
        });

      assert.equal(
        result.providerStatus,
        "read"
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "Twilio failure callback retains error code and channel message",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    try {
      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      const result =
        normaliseWhatsAppWebhookDeliveryStatus({
          body: {
            MessageSid:
              "SM_PHASE_811B",
            MessageStatus:
              "undelivered",
            ErrorCode:
              "63016",
            ChannelStatusMessage:
              "Message failed delivery",
          },
        });

      assert.equal(
        result.providerStatus,
        "undelivered"
      );

      assert.equal(
        result.error,
        "Twilio error 63016: Message failed delivery"
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "Twilio inbound text is not mistaken for a delivery callback",
  () => {
    const originalProvider =
      process.env
        .WHATSAPP_PROVIDER;

    try {
      process.env
        .WHATSAPP_PROVIDER =
        "twilio";

      const request = {
        body: {
          From:
            "whatsapp:+447700900123",
          Body:
            "Please book me in",
          MessageSid:
            "SM_INBOUND_811B",
          SmsStatus:
            "received",
          ProfileName:
            "Alex Example",
        },
      };

      assert.equal(
        normaliseWhatsAppWebhookDeliveryStatus(
          request
        ),
        null
      );

      assert.equal(
        normaliseWhatsAppWebhookMessages(
          request
        ).length,
        1
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);

test(
  "delivery status advances from sent to delivered",
  async () => {
    const {
      conversation,
      message,
    } = fakeConversation({
      providerStatus:
        "sent",
    });

    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "delivered",
          error: "",
        },
        {
          ConversationModel:
            fakeModel(
              conversation
            ),
        }
      );

    assert.equal(
      result.updated,
      true
    );

    assert.equal(
      message.providerStatus,
      "delivered"
    );

    assert.equal(
      conversation.saveCount,
      1
    );
  }
);

test(
  "unknown Twilio MessageSid is acknowledged without creating a conversation",
  async () => {
    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_UNKNOWN_811B",
          providerStatus:
            "delivered",
        },
        {
          ConversationModel:
            fakeModel(null),
        }
      );

    assert.equal(
      result.updated,
      false
    );

    assert.equal(
      result.ignored,
      true
    );

    assert.equal(
      result.reason,
      "unknown_provider_message"
    );
  }
);

test(
  "duplicate delivery status is idempotent",
  async () => {
    const {
      conversation,
    } = fakeConversation({
      providerStatus:
        "delivered",
    });

    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "delivered",
        },
        {
          ConversationModel:
            fakeModel(
              conversation
            ),
        }
      );

    assert.equal(
      result.updated,
      false
    );

    assert.equal(
      result.duplicate,
      true
    );

    assert.equal(
      conversation.saveCount,
      0
    );
  }
);

test(
  "delivered status cannot regress to sent",
  async () => {
    const {
      conversation,
      message,
    } = fakeConversation({
      providerStatus:
        "delivered",
    });

    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "sent",
        },
        {
          ConversationModel:
            fakeModel(
              conversation
            ),
        }
      );

    assert.equal(
      result.updated,
      false
    );

    assert.equal(
      result.reason,
      "status_regression"
    );

    assert.equal(
      message.providerStatus,
      "delivered"
    );

    assert.equal(
      conversation.saveCount,
      0
    );
  }
);

test(
  "read status cannot regress to delivered",
  () => {
    const result =
      decideWhatsAppDeliveryStatusUpdate(
        "read",
        "delivered"
      );

    assert.equal(
      result.action,
      "ignore"
    );

    assert.equal(
      result.reason,
      "status_regression"
    );
  }
);

test(
  "failed callback after sent is rejected as contradictory regression",
  () => {
    const result =
      decideWhatsAppDeliveryStatusUpdate(
        "sent",
        "failed"
      );

    assert.equal(
      result.action,
      "ignore"
    );

    assert.equal(
      result.reason,
      "status_regression"
    );
  }
);

test(
  "undelivered callback stores Twilio failure information",
  async () => {
    const {
      conversation,
      message,
    } = fakeConversation({
      providerStatus:
        "sent",
    });

    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "undelivered",
          error:
            "Twilio error 63016: Message failed delivery",
        },
        {
          ConversationModel:
            fakeModel(
              conversation
            ),
        }
      );

    assert.equal(
      result.updated,
      true
    );

    assert.equal(
      message.providerStatus,
      "undelivered"
    );

    assert.equal(
      message.error,
      "Twilio error 63016: Message failed delivery"
    );
  }
);

test(
  "inbound message with matching provider SID is never modified as outbound delivery state",
  async () => {
    const {
      conversation,
      message,
    } = fakeConversation({
      direction:
        "inbound",
      providerStatus:
        "received",
    });

    const result =
      await persistWhatsAppDeliveryStatus(
        {
          providerMessageId:
            "SM_PHASE_811B",
          providerStatus:
            "delivered",
        },
        {
          ConversationModel:
            fakeModel(
              conversation
            ),
        }
      );

    assert.equal(
      result.updated,
      false
    );

    assert.equal(
      result.reason,
      "unknown_provider_message"
    );

    assert.equal(
      message.providerStatus,
      "received"
    );

    assert.equal(
      conversation.saveCount,
      0
    );
  }
);