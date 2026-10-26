import Customer from "../../../models/customer.js";
import { buildCustomer360 } from "./stage7CrmService.js";
import {
  listClientTechnicalRecords,
  listRetentionQueue,
  point9AuthorityScope,
} from "./stage9CrmService.js";

function idText(value) {
  return value ? String(value?._id || value) : "";
}

function daysUntilBirthday(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date(now);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return Math.floor((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function deriveOpportunities({ customer, retention, base360, now }) {
  const opportunities = [];
  const state = retention?.retentionState || null;
  const channels = base360?.intelligence?.nextBestAction?.contactableChannels || [];

  if (["approaching_due", "due", "overdue", "dormant"].includes(state)) {
    opportunities.push({
      type: state === "dormant" ? "reactivation" : "rebooking",
      priority: state === "dormant" || state === "overdue" ? "high" : "medium",
      reason: `Customer retention state is ${state}.`,
      suggestedAction: state === "dormant" ? "review_reactivation_draft" : "review_rebooking_draft",
      contactableChannels: channels,
      executionAuthorised: false,
    });
  }

  const birthdayDays = daysUntilBirthday(customer.dateOfBirth, now);
  if (
    birthdayDays !== null &&
    birthdayDays <= 30 &&
    customer.communicationPreferences?.birthdayMessages === true
  ) {
    opportunities.push({
      type: "birthday",
      priority: birthdayDays <= 7 ? "high" : "medium",
      reason: `Birthday is in ${birthdayDays} day${birthdayDays === 1 ? "" : "s"}.`,
      suggestedAction: "review_birthday_draft",
      contactableChannels: channels,
      executionAuthorised: false,
    });
  }

  if (customer.referralCode) {
    opportunities.push({
      type: "referral",
      priority: "low",
      reason: "Customer has an active referral code available for governed referral messaging.",
      suggestedAction: "review_referral_prompt",
      contactableChannels: channels,
      executionAuthorised: false,
    });
  }

  const loyaltyPoints = Number(base360?.value?.loyaltyPoints || 0);
  if (loyaltyPoints > 0) {
    opportunities.push({
      type: "loyalty",
      priority: loyaltyPoints >= 500 ? "medium" : "low",
      reason: `Customer has ${loyaltyPoints} loyalty points recorded.`,
      suggestedAction: "review_loyalty_value",
      contactableChannels: channels,
      executionAuthorised: false,
    });
  }

  return opportunities;
}

export async function buildPoint9Customer360(
  customerId,
  { tenantContext = {}, effectiveAuthority = {}, now = new Date() } = {}
) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const base360 = await buildCustomer360(customerId, { tenantContext, now });
  const customer = await Customer.findOne({
    _id: customerId,
    business: scope.businessId,
    status: { $ne: "deleted" },
  })
    .select(
      "dateOfBirth hairProfile bookingPreferences communicationPreferences referralCode referredBy notes photo preferredStylist preferredServices"
    )
    .lean();

  if (!customer) {
    const error = new Error("Customer was not found in the active business.");
    error.statusCode = 404;
    error.code = "POINT9_CUSTOMER_NOT_FOUND";
    throw error;
  }

  const [technical, retentionQueue] = await Promise.all([
    listClientTechnicalRecords(customerId, {
      effectiveAuthority,
      limit: 100,
    }),
    listRetentionQueue({
      effectiveAuthority,
      now,
      limit: 500,
    }),
  ]);

  const retention =
    retentionQueue.queue.find((item) => idText(item.customerId) === idText(customerId)) || null;
  const opportunities = deriveOpportunities({ customer, retention, base360, now });

  return {
    ...base360,
    salonProfile: {
      hairProfile: customer.hairProfile || {},
      bookingPreferences: customer.bookingPreferences || {},
      dateOfBirth: customer.dateOfBirth || null,
      birthdayDays: daysUntilBirthday(customer.dateOfBirth, now),
      referralCode: customer.referralCode || "",
      referredBy: customer.referredBy || null,
      notes: customer.notes || "",
      photo: customer.photo || "",
      preferredStylist: customer.preferredStylist || null,
      preferredServices: customer.preferredServices || [],
    },
    technicalHistory: {
      count: technical.count,
      recent: technical.records,
      authority: technical.authority,
    },
    retention: {
      ...base360.retention,
      operational: retention,
      opportunities,
    },
    projection: {
      ...base360.projection,
      type: "customer_360",
      version: "3",
      locationAware: true,
      effectiveLocationScope: scope.allowedLocationIds,
      executionAuthorised: false,
    },
  };
}

export async function listPoint9RetentionOpportunities({
  tenantContext = {},
  effectiveAuthority = {},
  type = "",
  limit = 100,
  now = new Date(),
} = {}) {
  const scope = point9AuthorityScope(effectiveAuthority);
  const safeLimit = Math.min(250, Math.max(1, Number.parseInt(limit, 10) || 100));
  const queue = await listRetentionQueue({ effectiveAuthority, now, limit: 500 });
  const customerIds = queue.queue.map((item) => item.customerId);
  if (!customerIds.length) {
    return { opportunities: [], count: 0, deterministic: true, executionAuthorised: false };
  }

  const customers = await Customer.find({
    _id: { $in: customerIds },
    business: scope.businessId,
    status: { $ne: "deleted" },
  })
    .select(
      "firstName lastName preferredName email phone dateOfBirth communicationPreferences referralCode loyaltyPoints"
    )
    .lean();
  const customerById = new Map(customers.map((item) => [idText(item._id), item]));
  const opportunities = [];

  for (const retention of queue.queue) {
    const customer = customerById.get(idText(retention.customerId));
    if (!customer) continue;
    const contactableChannels = [];
    if (customer.email && customer.communicationPreferences?.emailUnsubscribed !== true) contactableChannels.push("email");
    if (customer.phone && customer.communicationPreferences?.smsUnsubscribed !== true) contactableChannels.push("sms");
    if (customer.phone && customer.communicationPreferences?.whatsappUnsubscribed !== true) contactableChannels.push("whatsapp");

    const base360 = {
      value: { loyaltyPoints: Number(customer.loyaltyPoints || 0) },
      intelligence: { nextBestAction: { contactableChannels } },
    };
    for (const opportunity of deriveOpportunities({ customer, retention, base360, now })) {
      if (type && opportunity.type !== type) continue;
      opportunities.push({
        customerId: retention.customerId,
        customerName:
          customer.preferredName ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" "),
        retentionState: retention.retentionState,
        dueAt: retention.dueAt,
        cadenceDays: retention.cadenceDays,
        latestLocationId: retention.latestLocationId,
        ...opportunity,
      });
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));

  return {
    opportunities: opportunities.slice(0, safeLimit),
    count: Math.min(opportunities.length, safeLimit),
    totalMatched: opportunities.length,
    deterministic: true,
    executionAuthorised: false,
  };
}
