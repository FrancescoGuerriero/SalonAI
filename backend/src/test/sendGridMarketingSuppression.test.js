import assert from "node:assert/strict";
import test from "node:test";

import {
  applySendGridMarketingSuppression,
  classifySendGridMarketingConsentEvent,
} from "../integrations/messaging/emailMarketingSuppressionService.js";
import {
  processSendGridEvent,
} from "../integrations/messaging/sendGridEventWebhookService.js";
import {
  hasExplicitConsentFailure,
  isExplicitlyUnsubscribed,
} from "../services/communicationCampaignService.js";
import {
  getExplicitConsentValue,
  isCustomerUnsubscribed,
} from "../services/campaignDeliveryService.js";
import {
  emailMarketingConsentFromPreferences,
} from "../features/customerExperience/customerCommunicationPreferencesController.js";

function customerFixture(
  overrides = {}
) {
  const customer = {
    _id:
      "customer-1",
    userAccount:
      "user-1",
    email:
      "customer@example.com",
    communicationPreferences: {
      appointmentReminders:
        true,
      promotionalMessages:
        true,
      serviceUpdates:
        true,
      birthdayMessages:
        true,
      feedbackRequests:
        true,
      emailUnsubscribed:
        false,
      smsUnsubscribed:
        false,
      unsubscribed:
        false,
      consentUpdatedAt:
        null,
      consentSource:
        "",
    },
    marketing: {
      emailConsent:
        true,
      emailSuppressed:
        false,
      emailSuppressedAt:
        null,
      emailSuppressionReason:
        "",
      smsConsent:
        false,
      emailConsentUpdatedAt:
        null,
      consentSource:
        "",
    },
    saved:
      0,
    async save() {
      this.saved +=
        1;
      return this;
    },
    ...overrides,
  };

  return customer;
}

function consentModelFixture({
  existing = null,
} = {}) {
  const created = [];

  return {
    created,
    model: {
      async findOne() {
        return existing;
      },
      async create(
        record
      ) {
        created.push(
          record
        );
        return record;
      },
    },
  };
}

function eventModelFixture() {
  const records =
    new Map();

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
        const record = {
          ...data,
          _id:
            `event-${records.size + 1}`,
          delivery:
            null,
          deliveryId:
            "",
          processingStatus:
            data.processingStatus ||
            "pending",
          processingReason:
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

        records.set(
          record.eventId,
          record
        );
        return record;
      },
    },
  };
}

test(
  "SendGrid global suppression events and resubscribe evidence are classified conservatively",
  () => {
    for (
      const eventType of [
        "unsubscribe",
        "spamreport",
        "group_unsubscribe",
      ]
    ) {
      assert.equal(
        classifySendGridMarketingConsentEvent(
          eventType
        ).action,
        "suppress"
      );
    }

    assert.deepEqual(
      classifySendGridMarketingConsentEvent(
        "group_resubscribe"
      ),
      {
        action:
          "clear_provider_suppression",
        reason:
          "local_reconsent_required",
      }
    );

    assert.equal(
      classifySendGridMarketingConsentEvent(
        "click"
      ).action,
      "none"
    );
  }
);

test(
  "provider unsubscribe blocks email marketing but preserves transactional preferences",
  async () => {
    const customer =
      customerFixture();
    const consent =
      consentModelFixture();
    const CustomerModel = {
      async findById(
        id
      ) {
        assert.equal(
          id,
          "customer-1"
        );
        return customer;
      },
      async findOne() {
        return null;
      },
    };

    const result =
      await applySendGridMarketingSuppression({
        eventType:
          "unsubscribe",
        eventId:
          "sendgrid-event-1",
        occurredAt:
          new Date(
            "2026-09-19T19:00:00.000Z"
          ),
        delivery: {
          customer:
            "customer-1",
          recipient: {
            email:
              "customer@example.com",
          },
        },
        CustomerModel,
        ConsentModel:
          consent.model,
      });

    assert.equal(
      result.applied,
      true
    );
    assert.equal(
      result.matchedBy,
      "delivery_customer"
    );
    assert.equal(
      customer
        .communicationPreferences
        .emailUnsubscribed,
      false
    );
    assert.equal(
      customer
        .communicationPreferences
        .promotionalMessages,
      false
    );
    assert.equal(
      customer.marketing
        .emailConsent,
      false
    );
    assert.equal(
      customer.marketing
        .emailSuppressed,
      true
    );
    assert.equal(
      customer.marketing
        .emailSuppressionReason,
      "unsubscribe"
    );

    assert.equal(
      customer
        .communicationPreferences
        .appointmentReminders,
      true
    );
    assert.equal(
      customer
        .communicationPreferences
        .serviceUpdates,
      true
    );
    assert.equal(
      customer
        .communicationPreferences
        .unsubscribed,
      false
    );

    assert.equal(
      consent.created.length,
      1
    );
    assert.equal(
      consent.created[0]
        .purpose,
      "email_marketing"
    );
    assert.equal(
      consent.created[0]
        .granted,
      false
    );
    assert.match(
      consent.created[0]
        .source,
      /^sendgrid:unsubscribe:/
    );
  }
);

test(
  "spam report can resolve the customer from the trusted local delivery email",
  async () => {
    const customer =
      customerFixture();
    const consent =
      consentModelFixture();
    const CustomerModel = {
      async findById() {
        return null;
      },
      async findOne(
        query
      ) {
        assert.deepEqual(
          query,
          {
            email:
              "customer@example.com",
          }
        );
        return customer;
      },
    };

    const result =
      await applySendGridMarketingSuppression({
        eventType:
          "spamreport",
        eventId:
          "sendgrid-event-2",
        delivery: {
          customer:
            "different-user-id",
          recipient: {
            email:
              "CUSTOMER@example.com",
          },
        },
        CustomerModel,
        ConsentModel:
          consent.model,
      });

    assert.equal(
      result.applied,
      true
    );
    assert.equal(
      result.matchedBy,
      "delivery_recipient_email"
    );
    assert.equal(
      customer.marketing
        .emailConsent,
      false
    );
  }
);

test(
  "group resubscribe never re-grants SalonAI marketing consent automatically",
  async () => {
    const customer =
      customerFixture({
        communicationPreferences: {
          appointmentReminders:
            true,
          promotionalMessages:
            false,
          serviceUpdates:
            true,
          emailUnsubscribed:
            true,
          unsubscribed:
            false,
        },
        marketing: {
          emailConsent:
            false,
          emailSuppressed:
            true,
          emailSuppressedAt:
            new Date(
              "2026-09-19T18:00:00.000Z"
            ),
          emailSuppressionReason:
            "group_unsubscribe",
        },
      });

    const CustomerModel = {
      async findById() {
        return customer;
      },
      async findOne() {
        return null;
      },
    };

    const result =
      await applySendGridMarketingSuppression({
        eventType:
          "group_resubscribe",
        eventId:
          "sendgrid-event-3",
        delivery: {
          customer:
            "customer-1",
          recipient: {
            email:
              "customer@example.com",
          },
        },
        CustomerModel,
        ConsentModel:
          consentModelFixture()
            .model,
      });

    assert.equal(
      result.applied,
      false
    );
    assert.equal(
      result.evidenceOnly,
      true
    );
    assert.equal(
      result.reason,
      "local_reconsent_required"
    );
    assert.equal(
      customer.marketing
        .emailConsent,
      false
    );
    assert.equal(
      customer.marketing
        .emailSuppressed,
      false
    );
    assert.equal(
      result
        .providerSuppressionChanged,
      true
    );
    assert.equal(
      customer.saved,
      1
    );
  }
);

test(
  "unmatched suppression evidence never guesses a customer from provider payload data",
  async () => {
    let saved =
      false;

    const result =
      await applySendGridMarketingSuppression({
        eventType:
          "unsubscribe",
        eventId:
          "sendgrid-event-4",
        delivery:
          null,
        CustomerModel: {
          async findById() {
            saved =
              true;
            return null;
          },
          async findOne() {
            saved =
              true;
            return null;
          },
        },
        ConsentModel:
          consentModelFixture()
            .model,
      });

    assert.equal(
      result.applied,
      false
    );
    assert.equal(
      result.reason,
      "customer_not_resolved"
    );
    assert.equal(
      saved,
      false
    );
  }
);

test(
  "ConsentRecord audit is idempotent when the provider event is retried after customer persistence",
  async () => {
    const customer =
      customerFixture();
    let createCalled =
      false;

    const result =
      await applySendGridMarketingSuppression({
        eventType:
          "unsubscribe",
        eventId:
          "sendgrid-event-5",
        delivery: {
          customer:
            "customer-1",
        },
        CustomerModel: {
          async findById() {
            return customer;
          },
          async findOne() {
            return null;
          },
        },
        ConsentModel: {
          async findOne() {
            return {
              _id:
                "existing-consent",
            };
          },
          async create() {
            createCalled =
              true;
          },
        },
      });

    assert.equal(
      result.applied,
      true
    );
    assert.equal(
      result.auditRecorded,
      false
    );
    assert.equal(
      result.auditReason,
      "consent_audit_already_recorded"
    );
    assert.equal(
      createCalled,
      false
    );
  }
);

test(
  "webhook processing applies suppression once after strong delivery matching",
  async () => {
    const eventStore =
      eventModelFixture();
    const delivery = {
      _id:
        "delivery-object-1",
      deliveryId:
        "delivery-1",
      providerMessageId:
        "<message@example.com>",
      status:
        "delivered",
      __v:
        3,
    };

    let suppressionCalls =
      0;

    const dependencies = {
      EventModel:
        eventStore.model,
      DeliveryModel: {
        async findOne() {
          return delivery;
        },
      },
      async applyMarketingSuppression(
        input
      ) {
        suppressionCalls +=
          1;
        assert.equal(
          input.eventType,
          "unsubscribe"
        );
        assert.equal(
          input.delivery,
          delivery
        );
        return {
          applied:
            true,
          reason:
            "provider_marketing_suppression",
        };
      },
    };

    const source = {
      event:
        "unsubscribe",
      sg_event_id:
        "webhook-suppression-1",
      sg_message_id:
        "sendgrid-message-1",
      "smtp-id":
        "<message@example.com>",
      timestamp:
        1789848000,
    };

    const first =
      await processSendGridEvent(
        source,
        dependencies
      );

    const duplicate =
      await processSendGridEvent(
        source,
        dependencies
      );

    assert.equal(
      first
        .marketingConsentChanged,
      true
    );
    assert.equal(
      first.reason,
      "marketing_suppression_applied"
    );
    assert.equal(
      duplicate.duplicate,
      true
    );
    assert.equal(
      suppressionCalls,
      1
    );
  }
);

test(
  "campaign audience preparation separates channel unsubscribe from marketing-only consent",
  () => {
    assert.equal(
      isExplicitlyUnsubscribed(
        {
          communicationPreferences: {
            emailUnsubscribed:
              true,
          },
        },
        "email"
      ),
      true
    );

    assert.equal(
      isExplicitlyUnsubscribed(
        {
          communicationPreferences: {
            promotionalMessages:
              false,
          },
        },
        "email"
      ),
      false
    );

    const suppressed = {
      communicationPreferences: {
        promotionalMessages:
          false,
      },
      marketing: {
        emailConsent:
          false,
        emailSuppressed:
          true,
      },
    };

    assert.equal(
      hasExplicitConsentFailure(
        suppressed,
        "email",
        "promotion"
      ),
      true
    );

    assert.equal(
      hasExplicitConsentFailure(
        suppressed,
        "email",
        "appointment_reminder"
      ),
      false
    );
  }
);

test(
  "campaign delivery applies marketing consent by campaign purpose",
  () => {
    const customer = {
      communicationPreferences: {
        promotionalMessages:
          false,
        emailUnsubscribed:
          false,
      },
      marketing: {
        emailConsent:
          false,
        emailSuppressed:
          true,
      },
    };

    assert.deepEqual(
      getExplicitConsentValue(
        customer,
        "email",
        {
          campaignType:
            "promotion",
        }
      ),
      {
        found:
          true,
        granted:
          false,
        source:
          "marketing.emailSuppressed",
      }
    );

    assert.deepEqual(
      getExplicitConsentValue(
        customer,
        "email",
        {
          campaignType:
            "appointment_reminder",
        }
      ),
      {
        found:
          false,
        granted:
          false,
        source:
          "",
      }
    );

    assert.equal(
      isCustomerUnsubscribed(
        customer,
        "email"
      ),
      false
    );

    assert.equal(
      isCustomerUnsubscribed(
        {
          communicationPreferences: {
            emailUnsubscribed:
              true,
          },
        },
        "email"
      ),
      true
    );
  }
);

test(
  "customer portal requires all email marketing preferences to be enabled for local re-consent",
  () => {
    assert.equal(
      emailMarketingConsentFromPreferences({
        promotionalMessages:
          true,
        emailUnsubscribed:
          false,
        unsubscribed:
          false,
      }),
      true
    );

    assert.equal(
      emailMarketingConsentFromPreferences({
        promotionalMessages:
          false,
        emailUnsubscribed:
          false,
        unsubscribed:
          false,
      }),
      false
    );

    assert.equal(
      emailMarketingConsentFromPreferences({
        promotionalMessages:
          true,
        emailUnsubscribed:
          true,
        unsubscribed:
          false,
      }),
      false
    );
  }
);
