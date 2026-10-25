import mongoose from "mongoose";

import Customer from "../../../models/customer.js";
import AttributionTouch from "../../campaigns/AttributionTouch.js";
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

export function deriveCustomerLifecycleState(customer, { now = new Date() } = {}) {
  const visits = Number(customer?.completedAppointmentCount ?? customer?.visitCount ?? 0);
  const totalSpent = Number(customer?.totalSpent ?? 0);
  const daysSinceLastVisit = daysBetween(customer?.lastVisit, now);
  const daysSinceFirstVisit = daysBetween(customer?.firstVisit, now);
  const tier = String(customer?.loyaltyTier || "standard").toLowerCase();
  const tags = new Set((customer?.tags || []).map((tag) => String(tag).toLowerCase()));

  if (tags.has("reactivated")) return "reactivated";
  if (visits <= 0) return "prospect";
  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 120) return "lapsed";
  if (daysSinceLastVisit !== null && daysSinceLastVisit >= 60) return "at_risk";
  if (["gold", "platinum"].includes(tier) || visits >= 8 || totalSpent >= 1000) return "loyal";
  if (daysSinceFirstVisit !== null && daysSinceFirstVisit <= 45 && visits <= 1) return "new_customer";
  if (visits >= 2) return "repeat";
  return "active";
}

export function deriveCustomerSegments(customer, lifecycleState) {
  const segments = new Set([lifecycleState]);
  const visits = Number(customer?.completedAppointmentCount ?? customer?.visitCount ?? 0);
  const totalSpent = Number(customer?.totalSpent ?? 0);
  const preferences = customer?.communicationPreferences || {};
  const marketing = customer?.marketing || {};

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

  if (
    globallyEligible &&
    customer?.email &&
    preferences.emailUnsubscribed !== true &&
    marketing.emailConsent === true &&
    marketing.emailSuppressed !== true
  ) {
    segments.add("contactable_email");
  }

  if (
    globallyEligible &&
    customer?.phone &&
    preferences.smsUnsubscribed !== true &&
    marketing.smsConsent === true
  ) {
    segments.add("contactable_sms");
  }

  if (
    globallyEligible &&
    customer?.phone &&
    preferences.whatsappUnsubscribed !== true &&
    (marketing.whatsappConsent === true || preferences.whatsappMarketing === true)
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

export async function buildCustomer360(customerId, { tenantContext = {}, now = new Date() } = {}) {
  const businessId = requireRetentionBusinessId(tenantContext);
  const customer = await loadOwnedCustomer(customerId, businessId);
  const lifecycleState = deriveCustomerLifecycleState(customer, { now });
  const segments = deriveCustomerSegments(customer, lifecycleState);

  const [attributionTouches, journeyEnrollments] = await Promise.all([
    AttributionTouch.find({ business: businessId, customer: customer._id })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(100)
      .select("campaign touchType channel sourceSystem medium utm occurredAt metadata")
      .lean(),
    RetentionJourneyEnrollment.find({ business: businessId, customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("journey trigger status outcome campaign startedAt stoppedAt completedAt executionAuthorised createdAt")
      .lean(),
  ]);

  const campaignIds = Array.from(
    new Set(
      attributionTouches
        .map((touch) => touch.campaign)
        .filter(Boolean)
        .map(String)
    )
  );

  const conversionTouches = attributionTouches.filter(
    (touch) => touch.touchType === "conversion"
  );

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
      loyaltyTier: customer.loyaltyTier || "standard",
      loyaltyPoints: Number(customer.loyaltyPoints || 0),
      membershipStatus: customer.membershipStatus || "none",
      membershipName: customer.membershipName || "",
    },
    behaviour: {
      cancelledAppointments: Number(customer.cancelledAppointmentCount || 0),
      noShows: Number(customer.noShowCount || 0),
      preferredStylist: customer.preferredStylist || null,
      preferredServices: customer.preferredServices || [],
    },
    consent: {
      communicationPreferences: customer.communicationPreferences || {},
      marketing: customer.marketing || {},
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
    projection: {
      type: "customer_360",
      version: "1",
      businessId,
      generatedAt: now.toISOString(),
      deterministic: true,
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
      "firstName lastName email phone status source tags visitCount completedAppointmentCount cancelledAppointmentCount noShowCount firstVisit lastVisit nextAppointment totalSpent averageSpend loyaltyTier loyaltyPoints membershipStatus communicationPreferences marketing"
    )
    .lean();

  return customers.map((customer) => {
    const lifecycleState = deriveCustomerLifecycleState(customer, { now });
    return {
      customerId: customer._id,
      name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
      lifecycleState,
      segments: deriveCustomerSegments(customer, lifecycleState),
      totalSpent: Number(customer.totalSpent || 0),
      visits: Number(customer.completedAppointmentCount ?? customer.visitCount ?? 0),
      lastVisit: customer.lastVisit || null,
      nextAppointment: customer.nextAppointment || null,
    };
  });
}
