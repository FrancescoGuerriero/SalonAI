import ConsentRecord from "../../models/ConsentRecord.js";
import Customer from "../../models/customer.js";

const GLOBAL_SUPPRESSION_EVENTS =
  new Set([
    "unsubscribe",
    "spamreport",
  ]);

const GROUP_SUPPRESSION_EVENTS =
  new Set([
    "group_unsubscribe",
  ]);

const GROUP_RESUBSCRIBE_EVENTS =
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
        "suppress_global",
      reason:
        "provider_marketing_suppression",
    };
  }

  if (
    GROUP_SUPPRESSION_EVENTS.has(
      event
    )
  ) {
    return {
      action:
        "suppress_group",
      reason:
        "provider_group_suppression",
    };
  }

  if (
    GROUP_RESUBSCRIBE_EVENTS.has(
      event
    )
  ) {
    return {
      action:
        "clear_group",
      reason:
        "provider_group_resubscribe",
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

function normaliseGroupId(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function currentSuppressionGroups(
  customer
) {
  const groups =
    customer?.marketing
      ?.emailSuppressionGroups;

  if (!Array.isArray(groups)) {
    return [];
  }

  return Array.from(
    new Set(
      groups
        .map(
          normaliseGroupId
        )
        .filter(Boolean)
    )
  );
}

export async function applySendGridMarketingSuppression({
  eventType,
  eventId = "",
  occurredAt = null,
  asmGroupId = null,
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
      providerSuppressionChanged:
        false,
    };
  }

  if (
    !delivery?.campaign
  ) {
    return {
      applied:
        false,
      evidenceOnly:
        true,
      reason:
        "transactional_delivery_not_marketing",
      customerId:
        "",
      matchedBy:
        "",
      auditRecorded:
        false,
      providerSuppressionChanged:
        false,
    };
  }

  const groupId =
    normaliseGroupId(
      asmGroupId
    );

  if (
    [
      "suppress_group",
      "clear_group",
    ].includes(
      classification.action
    ) &&
    !groupId
  ) {
    return {
      applied:
        false,
      evidenceOnly:
        true,
      reason:
        "marketing_group_id_missing",
      customerId:
        "",
      matchedBy:
        "",
      auditRecorded:
        false,
      providerSuppressionChanged:
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
    [
      "suppress_group",
      "clear_group",
    ].includes(
      classification.action
    )
  ) {
    ensureCustomerMarketingObjects(
      customer
    );

    const existingGroups =
      currentSuppressionGroups(
        customer
      );
    const hasGroup =
      existingGroups.includes(
        groupId
      );

    const nextGroups =
      classification.action ===
        "suppress_group"
        ? Array.from(
            new Set([
              ...existingGroups,
              groupId,
            ])
          )
        : existingGroups.filter(
            (value) =>
              value !==
              groupId
          );

    const providerSuppressionChanged =
      classification.action ===
        "suppress_group"
        ? !hasGroup
        : hasGroup;

    if (
      providerSuppressionChanged
    ) {
      customer.marketing
        .emailSuppressionGroups =
        nextGroups;
      customer.marketing
        .emailSuppressionGroupsUpdatedAt =
        new Date();
      await customer.save();
    }

    return {
      applied:
        providerSuppressionChanged,
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
        false,
      providerSuppressionChanged,
      suppressionScope:
        "group",
      asmGroupId:
        groupId,
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
    .emailSuppressed =
    true;
  customer
    .marketing
    .emailSuppressedAt =
    effectiveAt;
  customer
    .marketing
    .emailSuppressionReason =
    lower(
      eventType
    );
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
    providerSuppressionChanged:
      true,
    suppressionScope:
      "global",
    asmGroupId:
      null,
  };
}

export default {
  applySendGridMarketingSuppression,
  classifySendGridMarketingConsentEvent,
};
