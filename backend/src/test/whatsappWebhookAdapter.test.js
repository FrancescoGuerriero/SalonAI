import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  normaliseWhatsAppWebhookMessages,
  verifyMetaWebhookSubscription,
  verifyWhatsAppWebhookRequest,
} from "../providers/whatsapp/whatsappWebhookAdapter.js";

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test(
  "Meta webhook subscription verification accepts the configured token",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    const originalVerifyToken =
      process.env.META_WHATSAPP_VERIFY_TOKEN;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env.META_WHATSAPP_VERIFY_TOKEN =
        "phase-8.11A-test-token";

      const result =
        verifyMetaWebhookSubscription({
          "hub.mode": "subscribe",
          "hub.verify_token":
            "phase-8.11A-test-token",
          "hub.challenge": "123456",
        });

      assert.equal(
        result.verified,
        true
      );

      assert.equal(
        result.challenge,
        "123456"
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );

      restoreEnvironment(
        "META_WHATSAPP_VERIFY_TOKEN",
        originalVerifyToken
      );
    }
  }
);

test(
  "Meta webhook subscription verification rejects an invalid token",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    const originalVerifyToken =
      process.env.META_WHATSAPP_VERIFY_TOKEN;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env.META_WHATSAPP_VERIFY_TOKEN =
        "correct-token";

      const result =
        verifyMetaWebhookSubscription({
          "hub.mode": "subscribe",
          "hub.verify_token":
            "wrong-token",
          "hub.challenge": "123456",
        });

      assert.equal(
        result.verified,
        false
      );

      assert.equal(
        result.challenge,
        ""
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );

      restoreEnvironment(
        "META_WHATSAPP_VERIFY_TOKEN",
        originalVerifyToken
      );
    }
  }
);

test(
  "Meta webhook signature validation uses the original raw body",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    const originalSecret =
      process.env.META_WHATSAPP_APP_SECRET;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env.META_WHATSAPP_APP_SECRET =
        "test-app-secret";

      const rawBody = Buffer.from(
        JSON.stringify({
          object:
            "whatsapp_business_account",
        }),
        "utf8"
      );

      const signature =
        `sha256=${crypto
          .createHmac(
            "sha256",
            "test-app-secret"
          )
          .update(rawBody)
          .digest("hex")}`;

      const verified =
        verifyWhatsAppWebhookRequest({
          rawBody,
          body: {},
          headers: {
            "x-hub-signature-256":
              signature,
          },
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
        "META_WHATSAPP_APP_SECRET",
        originalSecret
      );
    }
  }
);

test(
  "Meta webhook signature validation rejects a changed payload",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    const originalSecret =
      process.env.META_WHATSAPP_APP_SECRET;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      process.env.META_WHATSAPP_APP_SECRET =
        "test-app-secret";

      const originalBody =
        Buffer.from(
          '{"object":"whatsapp_business_account"}',
          "utf8"
        );

      const signature =
        `sha256=${crypto
          .createHmac(
            "sha256",
            "test-app-secret"
          )
          .update(originalBody)
          .digest("hex")}`;

      const verified =
        verifyWhatsAppWebhookRequest({
          rawBody: Buffer.from(
            '{"object":"changed"}',
            "utf8"
          ),
          body: {},
          headers: {
            "x-hub-signature-256":
              signature,
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
        "META_WHATSAPP_APP_SECRET",
        originalSecret
      );
    }
  }
);

test(
  "Meta inbound text messages map to the SalonAI conversation shape",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      const messages =
        normaliseWhatsAppWebhookMessages({
          body: {
            object:
              "whatsapp_business_account",

            entry: [
              {
                changes: [
                  {
                    value: {
                      contacts: [
                        {
                          wa_id:
                            "447700900123",
                          profile: {
                            name:
                              "Alex Example",
                          },
                        },
                      ],

                      messages: [
                        {
                          from:
                            "447700900123",
                          id:
                            "wamid.phase811a",
                          type:
                            "text",
                          text: {
                            body:
                              "I would like to book",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        });

      assert.deepEqual(
        messages,
        [
          {
            phone:
              "+447700900123",
            message:
              "I would like to book",
            providerMessageId:
              "wamid.phase811a",
            displayName:
              "Alex Example",
          },
        ]
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
  "Meta delivery status events are safely ignored as inbound messages",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "meta";

      const messages =
        normaliseWhatsAppWebhookMessages({
          body: {
            entry: [
              {
                changes: [
                  {
                    value: {
                      statuses: [
                        {
                          id:
                            "wamid.status",
                          status:
                            "delivered",
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        });

      assert.deepEqual(
        messages,
        []
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
  "Twilio inbound messages remain supported by the common webhook adapter",
  () => {
    const originalProvider =
      process.env.WHATSAPP_PROVIDER;

    try {
      process.env.WHATSAPP_PROVIDER =
        "twilio";

      const messages =
        normaliseWhatsAppWebhookMessages({
          body: {
            From:
              "whatsapp:+447700900123",
            Body:
              "  Please book me in  ",
            MessageSid:
              "SM_PHASE_811A",
            ProfileName:
              "Alex Example",
          },
        });

      assert.deepEqual(
        messages,
        [
          {
            phone:
              "+447700900123",
            message:
              "Please book me in",
            providerMessageId:
              "SM_PHASE_811A",
            displayName:
              "Alex Example",
          },
        ]
      );
    } finally {
      restoreEnvironment(
        "WHATSAPP_PROVIDER",
        originalProvider
      );
    }
  }
);