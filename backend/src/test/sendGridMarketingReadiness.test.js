import assert from "node:assert/strict";
import test from "node:test";

import {
  getSendGridMarketingReadiness,
} from "../config/messageDeliveryConfig.js";
import {
  assertLiveMarketingCampaignReady,
  getLiveMarketingCampaignReadiness,
} from "../services/campaignDeliveryService.js";
import {
  buildProviderHeaders,
  buildSendGridSmtpApiHeader,
} from "../services/emailDeliveryService.js";

function liveSendGridConfig(
  overrides = {}
) {
  const config = {
    mode: "live",
    email: {
      enabled: true,
      provider: "sendgrid",
      sendgrid: {
        apiKey: "SG.test-key",
        marketing: {
          enabled: true,
          senderVerified: true,
          domainAuthenticated: true,
          acceptanceConfirmed: true,
        },
        eventWebhook: {
          enabled: true,
          publicKey: "test-public-key",
        },
      },
    },
  };

  return {
    ...config,
    ...overrides,
    email: {
      ...config.email,
      ...(overrides.email || {}),
      sendgrid: {
        ...config.email.sendgrid,
        ...(overrides.email?.sendgrid || {}),
        marketing: {
          ...config.email.sendgrid.marketing,
          ...(overrides.email?.sendgrid?.marketing || {}),
        },
        eventWebhook: {
          ...config.email.sendgrid.eventWebhook,
          ...(overrides.email?.sendgrid?.eventWebhook || {}),
        },
      },
    },
  };
}

function marketingCampaign(
  overrides = {}
) {
  return {
    channel: "email",
    campaignType: "promotion",
    options: {
      sendGridSuppressionGroupId: 42,
    },
    ...overrides,
  };
}

test(
  "SendGrid marketing readiness requires every live activation attestation",
  () => {
    const ready =
      getSendGridMarketingReadiness(
        liveSendGridConfig()
      );

    assert.equal(
      ready.ready,
      true
    );
    assert.deepEqual(
      ready.blockers,
      []
    );

    const incomplete =
      getSendGridMarketingReadiness(
        liveSendGridConfig({
          email: {
            sendgrid: {
              marketing: {
                senderVerified:
                  false,
                domainAuthenticated:
                  false,
                acceptanceConfirmed:
                  false,
              },
              eventWebhook: {
                enabled:
                  false,
                publicKey:
                  "",
              },
            },
          },
        })
      );

    assert.equal(
      incomplete.ready,
      false
    );
    assert.ok(
      incomplete.blockers.includes(
        "signedEventWebhook"
      )
    );
    assert.ok(
      incomplete.blockers.includes(
        "senderVerified"
      )
    );
    assert.ok(
      incomplete.blockers.includes(
        "domainAuthenticated"
      )
    );
    assert.ok(
      incomplete.blockers.includes(
        "acceptanceConfirmed"
      )
    );
  }
);

test(
  "live marketing campaign fails closed without an ASM suppression group",
  () => {
    const campaign =
      marketingCampaign({
        options: {},
      });

    const readiness =
      getLiveMarketingCampaignReadiness(
        campaign,
        liveSendGridConfig()
      );

    assert.equal(
      readiness.required,
      true
    );
    assert.equal(
      readiness.ready,
      false
    );
    assert.ok(
      readiness.blockers.includes(
        "campaignSuppressionGroupId"
      )
    );

    assert.throws(
      () =>
        assertLiveMarketingCampaignReady(
          campaign,
          liveSendGridConfig()
        ),
      (error) => {
        assert.equal(
          error.code,
          "SENDGRID_MARKETING_NOT_READY"
        );
        assert.equal(
          error.statusCode,
          503
        );
        return true;
      }
    );
  }
);

test(
  "sandbox campaigns and transactional appointment reminders stay independent of live marketing activation",
  () => {
    const sandbox =
      getLiveMarketingCampaignReadiness(
        marketingCampaign({
          options: {},
        }),
        {
          ...liveSendGridConfig(),
          mode: "sandbox",
        }
      );

    assert.equal(
      sandbox.ready,
      true
    );
    assert.equal(
      sandbox.required,
      false
    );

    const reminder =
      getLiveMarketingCampaignReadiness(
        marketingCampaign({
          campaignType:
            "appointment_reminder",
          options: {},
        }),
        liveSendGridConfig({
          email: {
            sendgrid: {
              marketing: {
                enabled:
                  false,
                senderVerified:
                  false,
                domainAuthenticated:
                  false,
                acceptanceConfirmed:
                  false,
              },
              eventWebhook: {
                enabled:
                  false,
                publicKey:
                  "",
              },
            },
          },
        })
      );

    assert.equal(
      reminder.ready,
      true
    );
    assert.equal(
      reminder.required,
      false
    );
  }
);

test(
  "SendGrid SMTP header uses only the trusted campaign suppression-group metadata",
  () => {
    const message = {
      headers: {
        "X-SMTPAPI":
          JSON.stringify({
            filters: {
              bypass_list_management: {
                settings: {
                  enable: 1,
                },
              },
            },
          }),
        "X-Custom-Test":
          "kept",
      },
      metadata: {
        sendGridSuppressionGroupId:
          42,
      },
    };

    const emailConfig = {
      provider:
        "sendgrid",
    };

    assert.equal(
      buildSendGridSmtpApiHeader(
        message,
        emailConfig
      ),
      JSON.stringify({
        asm_group_id: 42,
      })
    );

    const headers =
      buildProviderHeaders(
        message,
        emailConfig
      );

    assert.equal(
      headers[
        "X-Custom-Test"
      ],
      "kept"
    );
    assert.deepEqual(
      JSON.parse(
        headers[
          "X-SMTPAPI"
        ]
      ),
      {
        asm_group_id:
          42,
      }
    );
  }
);

test(
  "SendGrid strips caller-supplied X-SMTPAPI when no trusted group is present",
  () => {
    const headers =
      buildProviderHeaders(
        {
          headers: {
            "x-smtpapi":
              "{\"bypass\":true}",
            "X-Custom-Test":
              "kept",
          },
          metadata: {},
        },
        {
          provider:
            "sendgrid",
        }
      );

    assert.equal(
      headers[
        "X-Custom-Test"
      ],
      "kept"
    );
    assert.equal(
      Object.keys(headers)
        .some(
          (key) =>
            key.toLowerCase() ===
            "x-smtpapi"
        ),
      false
    );
  }
);
