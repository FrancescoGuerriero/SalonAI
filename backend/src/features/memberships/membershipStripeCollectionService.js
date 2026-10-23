import MembershipContract from "../../models/MembershipContract.js";
import Payment from "../commerce/Payment.js";
import {
  recordMembershipCollectionAndRefreshBenefits,
} from "./membershipCollectionOrchestrator.js";

function text(value) {
  return String(value ?? "").trim();
}

function providerId(value) {
  if (typeof value === "string") return text(value);
  return text(value?.id);
}

function timestamp(value, fallback = new Date()) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000);
  }
  return fallback;
}

function moneyFromMinor(value) {
  const minor = Number(value || 0);
  return Number((Number.isFinite(minor) ? minor / 100 : 0).toFixed(2));
}

export function stripeMembershipSubscriptionId(invoice = {}) {
  return (
    providerId(invoice.subscription) ||
    providerId(invoice.parent?.subscription_details?.subscription) ||
    text(invoice.metadata?.subscriptionId) ||
    text(invoice.metadata?.membershipSubscriptionId)
  );
}

export function stripeMembershipPeriodStart(invoice = {}, fallback = new Date()) {
  const direct = Number(invoice.period_start);
  if (Number.isFinite(direct) && direct > 0) {
    return timestamp(direct, fallback);
  }

  const lineStarts = (invoice.lines?.data || [])
    .map((line) => Number(line?.period?.start))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (lineStarts.length > 0) {
    return timestamp(Math.min(...lineStarts), fallback);
  }

  return timestamp(invoice.created, fallback);
}

function stripeMembershipIntentId(invoice = {}) {
  return (
    providerId(invoice.payment_intent) ||
    providerId(invoice.confirmation_secret?.payment_intent)
  );
}

function invoiceAmount(invoice, succeeded) {
  return moneyFromMinor(
    succeeded
      ? invoice.amount_paid ?? invoice.amount_due ?? invoice.total
      : invoice.amount_due ?? invoice.total
  );
}

async function membershipPayment(contract, invoice, event, succeeded) {
  const providerPaymentId = text(invoice.id);
  let payment = providerPaymentId
    ? await Payment.findOne({
        purpose: "membership",
        provider: "stripe",
        providerPaymentId,
        membershipContract: contract._id,
      })
    : null;

  if (!payment) {
    payment = new Payment({
      customer: contract.customer,
      membershipContract: contract._id,
      purpose: "membership",
      amount: invoiceAmount(invoice, succeeded),
      currency: text(invoice.currency || "GBP").toUpperCase(),
      provider: "stripe",
      providerPaymentId,
      providerIntentId: stripeMembershipIntentId(invoice),
      status: succeeded ? "paid" : "failed",
      rawStatus: text(event.type),
      paidAt: succeeded ? timestamp(event.created) : null,
      failureReason: succeeded
        ? ""
        : "Stripe recurring membership collection failed.",
      metadata: {
        stripeInvoiceId: providerPaymentId,
        stripeSubscriptionId: stripeMembershipSubscriptionId(invoice),
        stripeEventId: text(event.id),
      },
    });
  }

  return payment;
}

export async function reconcileStripeMembershipCollection(event = {}) {
  const invoice = event.data?.object || {};
  const eventType = text(event.type);
  const succeeded = eventType === "invoice.payment_succeeded";
  const failed = eventType === "invoice.payment_failed";

  if (!succeeded && !failed) {
    return {
      reconciled: false,
      reason: "unsupported_membership_collection_event",
    };
  }

  const subscriptionId = stripeMembershipSubscriptionId(invoice);
  if (!subscriptionId) {
    return {
      reconciled: false,
      reason: "missing_subscription_reference",
    };
  }

  const contract = await MembershipContract.findOne({
    paymentProvider: "stripe",
    paymentProviderSubscriptionId: subscriptionId,
  });

  if (!contract) {
    return {
      reconciled: false,
      reason: "unknown_membership_subscription",
      subscriptionId,
    };
  }

  const payment = await membershipPayment(contract, invoice, event, succeeded);

  // Stripe webhook delivery is not ordered. Never let a late failure event
  // downgrade an invoice that has already been reconciled as paid.
  if (failed && payment.status === "paid") {
    return {
      reconciled: true,
      ignoredStaleEvent: true,
      membershipContractId: String(contract._id),
      paymentId: String(payment._id),
      subscriptionId,
      providerInvoiceId: text(invoice.id),
    };
  }

  const attemptedAt = timestamp(event.created);
  const dueAt = stripeMembershipPeriodStart(invoice, attemptedAt);
  const amount = invoiceAmount(invoice, succeeded);
  const idempotencyKey = `stripe:${text(event.id) || text(invoice.id)}:${eventType}`;
  const failureCode = failed
    ? text(
        invoice.last_finalization_error?.code ||
          invoice.payment_intent?.last_payment_error?.code
      )
    : "";

  const collection = await recordMembershipCollectionAndRefreshBenefits(
    contract._id,
    {
      status: succeeded ? "succeeded" : "failed",
      dueAt,
      attemptedAt,
      amount,
      provider: "stripe",
      providerReference: text(invoice.id),
      failureCode,
      idempotencyKey,
    },
    {
      businessId: contract.business,
      actor: "stripe-webhook",
    }
  );

  payment.customer = contract.customer;
  payment.membershipContract = contract._id;
  payment.amount = amount;
  payment.currency = text(invoice.currency || payment.currency || "GBP").toUpperCase();
  payment.providerPaymentId = text(invoice.id) || payment.providerPaymentId;
  payment.providerIntentId =
    stripeMembershipIntentId(invoice) || payment.providerIntentId || "";
  payment.rawStatus = eventType;
  payment.metadata = {
    ...(payment.metadata || {}),
    stripeInvoiceId: text(invoice.id),
    stripeSubscriptionId: subscriptionId,
    stripeEventId: text(event.id),
    collectionAttemptId: collection.collectionAttempt?._id
      ? String(collection.collectionAttempt._id)
      : "",
  };

  if (succeeded) {
    payment.status = "paid";
    payment.paidAt = attemptedAt;
    payment.failureReason = "";
  } else if (payment.status !== "paid") {
    payment.status = "failed";
    payment.failureReason = "Stripe recurring membership collection failed.";
  }

  await payment.save();

  return {
    reconciled: true,
    membershipContractId: String(contract._id),
    paymentId: String(payment._id),
    collectionAttemptId: collection.collectionAttempt?._id
      ? String(collection.collectionAttempt._id)
      : null,
    subscriptionId,
    providerInvoiceId: text(invoice.id),
    status: succeeded ? "succeeded" : "failed",
    idempotentReplay: collection.idempotentReplay === true,
    benefitRefresh: collection.benefitRefresh?.status || "not_required",
  };
}

export default {
  reconcileStripeMembershipCollection,
  stripeMembershipPeriodStart,
  stripeMembershipSubscriptionId,
};
