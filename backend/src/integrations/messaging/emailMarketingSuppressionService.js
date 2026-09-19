import ConsentRecord from "../../models/ConsentRecord.js";
import Customer from "../../models/customer.js";

const GLOBAL_SUPPRESSION_EVENTS =
  new Set([
    "unsubscribe",
    "spamreport",
    "group_unsubscribe",
  ]);

const LOCAL_RECONSENT_REQUIRED_EVENTS =
  new Set([
    "group_resubscribe",
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

function localRecipientEmail(
  delivery
) {
  return lower(
    delivery?.recipient
      ?.email
  );
}

export function classifySendGridMarketingConsentEvent(
  eventType
) {
  const event =
    lower(
      eventType
    );

  if (
    GLOBAL_SUPPRESSION_EVENTS.has(
      event
    )
  ) {
    return {
      action:
        "suppress",
      reason:
        event ===
        "group_unsubscribe"
          ? "conservative_group_suppression"
          : "provider_marketing_suppression",
    };
  }

  if (
    LOCAL_RECONSENT_REQUIRED_EVENTS.has(
      event
    )
  ) {
    return {
      action:
        "evidence_only",
      reason:
        "local_reconsent_required",
    };
  }

  return {
    action:
      "none",
    reason:
      "not_marketing_consent_event",
  };
}

async function resolveCustomerFromDelivery(
  delivery,
  CustomerModel
) {
  if (
    delivery?.customer
  ) {
    const linked =
      await CustomerModel.findById(
        delivery.customer
      );

    if (linked) {
      return {
        customer:
          linked,
        matchedBy:
          "delivery_customer",
      };
    }
  }

  const email =
    localRecipientEmail(
      delivery
    );

  if (!email) {
    return {
      customer:
        null,
      matchedBy:
        "",
    };
  }

  const customer =
    await CustomerModel.findOne({
      email,
    });

  return {
    customer:
      customer ||
      null,
    matchedBy:
      customer
        ? "delivery_recipient_email"
        : "",
  };
}

function ensureCustomerMarketingObjects(
  customer
) {
  if (
    !customer
      .communicationPreferences
  ) {
    customer.communicationPreferences =
      {};
  }

  if (
    !customer.marketing
  ) {
    customer.marketing =
      {};
  }
}

async function recordConsentWithdrawal({
  customer,
  eventType,
  eventId,
  occurredAt,
  ConsentModel,
}) {
  if (
    !customer?.userAccount
  ) {
    return {
      recorded:
        false,
      reason:
        "customer_has_no_user_account",
    };
  }

  const source =
    [
      "sendgrid",
      lower(
        eventType
      ),
      text(
        eventId
      ),
    ]
      .filter(Boolean)
      .join(":");

  const existing =
    await ConsentModel.findOne({
      customer:
        customer
          .userAccount,
      purpose:
        "email_marketing",
      granted:
        false,
      source,
    });

  if (existing) {
    return {
      recorded:
        false,
      duplicate:
        true,
      reason:
        "consent_audit_already_recorded",
    };
  }

  await ConsentModel.create({
    customer:
      customer.userAccount,
    purpose:
      "email_marketing",
    granted:
      false,
    source,
    recordedAt:
      occurredAt ||
      new Date(),
  });

  return {
    recorded:
      true,
    duplicate:
      false,
    reason:
      "consent_withdrawal_recorded",
  };
}

export async function applySendGridMarketingSuppression({
  eventType,
  eventId = "",
  occurredAt = null,
  delivery,
  CustomerModel =
    Customer,
  ConsentModel =
    ConsentRecord,
} = {}) {
  const classification =
    classifySendGridMarketingConsentEvent(
      eventType
    );

  if (
    classification.action ===
    "none"
  ) {
    return {
      applied:
        false,
      evidenceOnly:
        false,
      reason:
        classification.reason,
      customerId:
        "",
      matchedBy:
        "",
      auditRecorded:
        false,
    };
  }

  const resolved =
    await resolveCustomerFromDelivery(
      delivery,
      CustomerModel
    );

  if (
    !resolved.customer
  ) {
    return {
      applied:
        false,
      evidenceOnly:
        true,
      reason:
        "customer_not_resolved",
      customerId:
        "",
      matchedBy:
        "",
      auditRecorded:
        false,
    };
  }

  const customer =
    resolved.customer;

  if (
    classification.action ===
    "evidence_only"
  ) {
    return {
      applied:
        false,
      evidenceOnly:
        true,
      reason:
        classification.reason,
      customerId:
        String(
          customer._id ||
            ""
        ),
      matchedBy:
        resolved.matchedBy,
      auditRecorded:
        false,
    };
  }

  const effectiveAt =
    occurredAt instanceof Date &&
    !Number.isNaN(
      occurredAt.getTime()
    )
      ? occurredAt
      : new Date();

  const source =
    `sendgrid:${lower(eventType)}`;

  ensureCustomerMarketingObjects(
    customer
  );

  customer
    .communicationPreferences
    .emailUnsubscribed =
    true;
  customer
    .communicationPreferences
    .promotionalMessages =
    false;
  customer
    .communicationPreferences
    .consentUpdatedAt =
    effectiveAt;
  customer
    .communicationPreferences
    .consentSource =
    source;

  customer
    .marketing
    .emailConsent =
    false;
  customer
    .marketing
    .emailConsentUpdatedAt =
    effectiveAt;
  customer
    .marketing
    .consentSource =
    source;

  await customer.save();

  const audit =
    await recordConsentWithdrawal({
      customer,
      eventType,
      eventId,
      occurredAt:
        effectiveAt,
      ConsentModel,
    });

  return {
    applied:
      true,
    evidenceOnly:
      false,
    reason:
      classification.reason,
    customerId:
      String(
        customer._id ||
          ""
      ),
    matchedBy:
      resolved.matchedBy,
    auditRecorded:
      audit.recorded,
    auditReason:
      audit.reason,
  };
}

export default {
  applySendGridMarketingSuppression,
  classifySendGridMarketingConsentEvent,
};
