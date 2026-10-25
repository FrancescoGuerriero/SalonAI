import mongoose from "mongoose";

import Appointment from "../../../models/Appointment.js";
import ConsentRecord from "../../../models/ConsentRecord.js";
import Customer from "../../../models/customer.js";
import CustomerContactLog from "../../../models/customerContactLog.js";
import AiPrediction from "../../ai/AiPrediction.js";
import AttributionTouch from "../../campaigns/AttributionTouch.js";
import CustomerExperienceProfile from "../../customerExperience/CustomerExperienceProfile.js";
import LoyaltyAccount from "../loyalty/LoyaltyAccount.js";
import RetentionJourneyEnrollment from "./RetentionJourneyEnrollment.js";
import { requireRetentionBusinessId } from "./stage7RetentionService.js";

export const CUSTOMER_LIFECYCLE_STATES = Object.freeze([
  "prospect",
  "new_customer",
  "active",
  "repeat",
  "loyal",
  "at_risk",
  "lapsed",
  "reactivated",
]);

const CONSENT_PURPOSES = Object.freeze([
  "email_marketing",
  "sms_marketing",
  "whatsapp_marketing",
  "push_marketing",
]);

function crmError(message, statusCode = 400, code = "STAGE7_CRM_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function daysBetween(earlier, later = new Date()) {
  if (!earlier) return null;
  const start = new Date(earlier);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((later.getTime() - start.getTime()) / 86400000));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function latestBy(items, keyFn) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}

export function deriveCustomerLifecycleState(customer, { now = new Date() } = {}) {
  const visits = Number(customer?.completedAppointmentCount ?? customer?.visitCount ?? 0);
  const totalSpent = Number(customer?.totalSpent ?? 0);
  const daysSinceLastVisit = daysBetween(customer?.lastVisit, now);
  const daysSinceFirstVisit = daysBetween(customer?.firstVisit, now);
  const tier = String(customer?.loyaltyTier || "standard").toLowerCase();
  const tags = new Set((customer?.tags || []).map((tag) => String(tag).toLowerCase()));

  if (tags.has("reactivated") || tags.has("recovered")) return "reactivated";
  if (visits <= 0) return "prospect";
  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 120) return "lapsed";
  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 60) return "at_risk";
  if (["gold", "platinum", "vip"].includes(tier) || visits >= 8 || totalSpent >= 1000) return "loyal";
  if (daysSinceFirstVisit !== null && daysSinceFirstVisit <= 45 && visits <= 1) return "new_customer";
  if (visits >= 2) return "repeat";
  return "active";
}

export function deriveCustomerSegments(customer, lifecycleState, { consent = null } = {}) {
  const segments = new Set([lifecycleState]);
  const visits = Number(customer?.completedAppointmentCount ?? customer?.visitCount ?? 0);
  const totalSpent = Number(customer?.totalSpent ?? 0);
  const preferences = customer?.communicationPreferences || {};
  const marketing = customer?.marketing || {};
  const consentState = consent || {};

  if (visits >= 2) segments.add("repeat_customer");
  if (visits >= 8 || totalSpent >= 1000) segments.add("high_value");
  if (customer?.membershipStatus === "active") segments.add("active_member");
  else segments.add("non_member");
  if (customer?.nextAppointment) segments.add("future_booking");
  else if (visits > 0) segments.add("rebooking_due");
  if (Number(customer?.noShowCount || 0) > 0) segments.add("prior_no_show");
  if (Number(customer?.cancelledAppointmentCount || 0) > 0) segments.add("prior_cancellation");

  const globallyEligible =
    preferences.unsubscribed !== true &&
    preferences.promotionalMessages !== false;
  const emailGranted = consentState.email_marketing?.granted ?? marketing.emailConsent;
  const smsGranted = consentState.sms_marketing?.granted ?? marketing.smsConsent;
  const whatsappGranted =
    consentState.whatsapp_marketing?.granted ??
    marketing.whatsappConsent ??
    preferences.whatsappMarketing;

  if (
    globallyEligible &&
    customer?.email &&
    preferences.emailUnsubscribed !== true &&
    emailGranted === true &&
    marketing.emailSuppressed !== true
  ) {
    segments.add("contactable_email");
  }

  if (
    globallyEligible &&
    customer?.phone &&
    preferences.smsUnsubscribed !== true &&
    smsGranted === true
  ) {
    segments.add("contactable_sms");
  }

  if (
    globallyEligible &&
    customer?.phone &&
    preferences.whatsappUnsubscribed !== true &&
    whatsappGranted === true
  ) {
    segments.add("contactable_whatsapp");
  }

  return Array.from(segments).sort();
}

async function loadOwnedCustomer(customerId, businessId) {
  if (!mongoose.isValidObjectId(customerId)) {
    throw crmError("Customer id is invalid.", 400, "CRM_CUSTOMER_ID_INVALID");
  }

  const customer = await Customer.findOne({
    _id: customerId,
    business: businessId,
    status: { $ne: "deleted" },
  }).lean();

  if (!customer) {
    throw crmError(
      "Customer was not found in the active business.",
      404,
      "CRM_CUSTOMER_NOT_FOUND"
    );
  }

  return customer;
}

async function loadConsentState(customer) {
  if (!customer?.userAccount) return {};
  const records = await ConsentRecord.find({
    customer: customer.userAccount,
    purpose: { $in: CONSENT_PURPOSES },
  })
    .sort({ recordedAt: -1, createdAt: -1, _id: -1 })
    .select("purpose granted recordedAt source channel")
    .lean();

  return Object.fromEntries(
    Array.from(latestBy(records, (record) => record.purpose).entries())
  );
}

function deriveNextBestAction({ customer, lifecycleState, predictions = [], consentState = {} }) {
  const predictionByType = latestBy(predictions, (prediction) => prediction.predictionType);
  const churn = predictionByType.get("churn_risk") || null;
  const recommendedCampaign = predictionByType.get("recommended_campaign") || null;
  const recommendedChannel = predictionByType.get("recommended_channel") || null;
  const serviceRecommendation = predictionByType.get("service_recommendation") || null;
  const contactable = deriveCustomerSegments(customer, lifecycleState, { consent: consentState }).filter(
    (segment) => segment.startsWith("contactable_")
  );

  let action = "maintain_relationship";
  let reason = "Customer is active with no urgent deterministic retention condition.";

  if (["past_due", "payment_failed"].includes(String(customer?.membershipStatus || "").toLowerCase())) {
    action = "membership_recovery";
    reason = "Membership payment state requires recovery handling through the canonical finance workflow.";
  } else if (lifecycleState === "lapsed") {
    action = "lapsed_recovery";
    reason = "Customer has crossed the deterministic lapsed threshold.";
  } else if (lifecycleState === "at_risk" || String(churn?.label || "").toLowerCase() === "high") {
    action = "retention_outreach_review";
    reason = "Lifecycle or fresh churn evidence indicates elevated retention risk.";
  } else if (!customer?.nextAppointment && Number(customer?.completedAppointmentCount ?? customer?.visitCount ?? 0) > 0) {
    action = "rebooking_review";
    reason = "Customer has visit history but no future appointment recorded.";
  } else if (lifecycleState === "new_customer") {
    action = "post_visit_nurture";
    reason = "New-customer lifecycle supports governed onboarding and follow-up.";
  }

  return {
    action,
    reason,
    executionAuthorised: false,
    contactableChannels: contactable.map((segment) => segment.replace("contactable_", "")),
    aiSignals: {
      churnRisk: churn,
      recommendedCampaign,
      recommendedChannel,
      serviceRecommendation,
    },
  };
}

export async function buildCustomer360(customerId, { tenantContext = {}, now = new Date() } = {}) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const customer = await loadOwnedCustomer(customerId, businessId);
  const consentState = await loadConsentState(customer);
  const lifecycleState = deriveCustomerLifecycleState(customer, { now });
  const segments = deriveCustomerSegments(customer, lifecycleState, { consent: consentState });

  const profileQuery = customer.userAccount
    ? CustomerExperienceProfile.findOne({ user: customer.userAccount })
        .populate("walletCards.giftCard", "codeLastFour originalValue balance currency status expiresAt transactions")
        .lean()
    : Promise.resolve(null);
  const loyaltyQuery = customer.userAccount
    ? LoyaltyAccount.findOne({ customer: customer.userAccount }).lean()
    : Promise.resolve(null);

  const [
    attributionTouches,
    journeyEnrollments,
    appointments,
    communications,
    experienceProfile,
    loyalty,
    predictions,
  ] = await Promise.all([
    AttributionTouch.find({ business: businessId, customer: customer._id })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(100)
      .select("campaign touchType channel sourceSystem medium utm occurredAt metadata")
      .lean(),
    RetentionJourneyEnrollment.find({ business: businessId, customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("journey trigger triggerReference status outcome campaign startedAt stoppedAt completedAt executionAuthorised stepEvidence createdAt")
      .lean(),
    Appointment.find({ business: businessId, customer: customer._id })
      .sort({ startsAt: -1, appointmentDate: -1, _id: -1 })
      .limit(100)
      .select("stylist service status startsAt endsAt appointmentDate appointmentTime duration price paymentStatus paymentMethod")
      .populate("service", "name category price duration")
      .populate("stylist", "name firstName lastName")
      .lean(),
    CustomerContactLog.find({ business: businessId, customer: customer._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .select("appointment campaignType channel direction subject status sentAt deliveredAt openedAt respondedAt failureReason createdAt metadata")
      .lean(),
    profileQuery,
    loyaltyQuery,
    AiPrediction.find({
      customer: customer._id,
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }, { expiresAt: { $exists: false } }],
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(20)
      .select("predictionType score label explanation modelName modelVersion expiresAt updatedAt")
      .lean(),
  ]);

  const campaignIds = Array.from(
    new Set(attributionTouches.map((touch) => touch.campaign).filter(Boolean).map(String))
  );
  const conversionTouches = attributionTouches.filter((touch) => touch.touchType === "conversion");
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const serviceHistory = completedAppointments.map((appointment) => ({
    appointmentId: appointment._id,
    service: appointment.service || null,
    stylist: appointment.stylist || null,
    occurredAt: appointment.startsAt || appointment.appointmentDate || null,
    price: Number(appointment.price || 0),
  }));
  const consultations = safeArray(experienceProfile?.consultations)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 25);
  const reviews = safeArray(experienceProfile?.reviews)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 25);
  const walletCards = safeArray(experienceProfile?.walletCards).slice(0, 25);
  const nextBestAction = deriveNextBestAction({
    customer,
    lifecycleState,
    predictions,
    consentState,
  });

  return {
    customer: {
      id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      preferredName: customer.preferredName || "",
      email: customer.email || "",
      phone: customer.phone || "",
      status: customer.status,
      source: customer.source,
      tags: customer.tags || [],
    },
    lifecycle: {
      state: lifecycleState,
      daysSinceFirstVisit: daysBetween(customer.firstVisit, now),
      daysSinceLastVisit: daysBetween(customer.lastVisit, now),
      firstVisit: customer.firstVisit || null,
      lastVisit: customer.lastVisit || null,
      nextAppointment: customer.nextAppointment || null,
    },
    segments,
    value: {
      visits: Number(customer.completedAppointmentCount ?? customer.visitCount ?? 0),
      totalSpent: Number(customer.totalSpent || 0),
      averageSpend: Number(customer.averageSpend || 0),
      loyaltyTier: customer.loyaltyTier || loyalty?.tier || "standard",
      loyaltyPoints: Number(customer.loyaltyPoints ?? loyalty?.pointsBalance ?? 0),
      lifetimePointsEarned: Number(loyalty?.lifetimePointsEarned || 0),
      lifetimePointsRedeemed: Number(loyalty?.lifetimePointsRedeemed || 0),
      membershipStatus: customer.membershipStatus || "none",
      membershipName: customer.membershipName || "",
    },
    behaviour: {
      cancelledAppointments: Number(customer.cancelledAppointmentCount || 0),
      noShows: Number(customer.noShowCount || 0),
      preferredStylist: customer.preferredStylist || null,
      preferredServices: customer.preferredServices || [],
    },
    appointments: {
      count: appointments.length,
      completedCount: completedAppointments.length,
      recent: appointments,
      serviceHistory,
    },
    consultations: {
      count: safeArray(experienceProfile?.consultations).length,
      recent: consultations,
    },
    communications: {
      count: communications.length,
      recent: communications,
    },
    loyalty: {
      account: loyalty || null,
      recentTransactions: safeArray(loyalty?.transactions)
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 25),
    },
    giftCards: {
      count: walletCards.length,
      wallet: walletCards,
    },
    reviews: {
      count: safeArray(experienceProfile?.reviews).length,
      recent: reviews,
      averageRating: reviews.length
        ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(2))
        : null,
    },
    consent: {
      communicationPreferences: customer.communicationPreferences || {},
      marketing: customer.marketing || {},
      latestEvidence: consentState,
    },
    attribution: {
      touchCount: attributionTouches.length,
      conversionTouchCount: conversionTouches.length,
      campaignCount: campaignIds.length,
      latestTouch: attributionTouches[0] || null,
      touches: attributionTouches,
    },
    retention: {
      enrolmentCount: journeyEnrollments.length,
      activeEnrolments: journeyEnrollments.filter((item) => ["pending", "active", "paused"].includes(item.status)),
      recentEnrolments: journeyEnrollments,
    },
    intelligence: {
      predictions,
      nextBestAction,
      advisoryOnly: true,
    },
    projection: {
      type: "customer_360",
      version: "2",
      businessId,
      generatedAt: now.toISOString(),
      deterministic: true,
      executionAuthorised: false,
    },
  };
}

export async function listCrmSegments({ tenantContext = {}, limit = 100, now = new Date() } = {}) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  const customers = await Customer.find({
    business: businessId,
    status: { $ne: "deleted" },
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(safeLimit)
    .select(
      "firstName lastName email phone userAccount status source tags visitCount completedAppointmentCount cancelledAppointmentCount noShowCount firstVisit lastVisit nextAppointment totalSpent averageSpend loyaltyTier loyaltyPoints membershipStatus communicationPreferences marketing"
    )
    .lean();

  const accountIds = customers.map((customer) => customer.userAccount).filter(Boolean);
  const consentRows = accountIds.length
    ? await ConsentRecord.find({
        customer: { $in: accountIds },
        purpose: { $in: CONSENT_PURPOSES },
      })
        .sort({ recordedAt: -1, createdAt: -1, _id: -1 })
        .select("customer purpose granted recordedAt")
        .lean()
    : [];
  const consentByAccount = new Map();
  for (const row of consentRows) {
    const accountKey = String(row.customer || "");
    if (!consentByAccount.has(accountKey)) consentByAccount.set(accountKey, {});
    const state = consentByAccount.get(accountKey);
    if (!state[row.purpose]) state[row.purpose] = row;
  }

  return customers.map((customer) => {
    const lifecycleState = deriveCustomerLifecycleState(customer, { now });
    const consent = consentByAccount.get(String(customer.userAccount || "")) || {};
    return {
      customerId: customer._id,
      name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
      email: customer.email || "",
      phone: customer.phone || "",
      lifecycleState,
      segments: deriveCustomerSegments(customer, lifecycleState, { consent }),
      totalSpent: Number(customer.totalSpent || 0),
      visits: Number(customer.completedAppointmentCount ?? customer.visitCount ?? 0),
      lastVisit: customer.lastVisit || null,
      nextAppointment: customer.nextAppointment || null,
    };
  });
}
