import Order from "../commerce/Order.js";
import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import {
  analyseCustomerSegments,
} from "../../services/aiMicroserviceClient.js";

const DAY_MS = 86_400_000;
const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);
const COMPLETED_ORDER_STATUSES = [
  "paid",
  "processing",
  "ready",
  "completed",
];

export const DEFAULT_SEGMENTATION_THRESHOLDS = Object.freeze({
  new_customer_days: 45,
  loyal_completed_visits: 6,
  loyal_rebooking_rate: 0.6,
  high_value_spend: 750,
  high_value_average_spend: 120,
  inactive_days: 180,
  at_risk_days: 90,
  discount_usage_rate: 0.5,
});

class AiCustomerSegmentationError extends Error {
  constructor(
    message,
    {
      code = "AI_CUSTOMER_SEGMENTATION_ERROR",
      status = 400,
      details = null,
    } = {}
  ) {
    super(message);
    this.name = "AiCustomerSegmentationError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback = 0) {
  return Math.max(0, number(value, fallback));
}

function ratio(numerator, denominator) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, numerator / denominator)
  );
}

function date(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(earlier, later) {
  const first = date(earlier);
  const second = date(later);

  if (!first || !second) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((second.getTime() - first.getTime()) / DAY_MS)
  );
}

function appointmentDateValue(appointment) {
  return date(
    appointment?.startsAt ||
      appointment?.appointmentDate
  );
}

function displayName(customer) {
  return (
    String(customer?.preferredName || "").trim() ||
    [customer?.firstName, customer?.lastName]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" ") ||
    "Unnamed customer"
  );
}

function identifier(value) {
  return String(value?._id || value?.id || value || "").trim();
}

function groupByCustomer(records = []) {
  const grouped = new Map();

  for (const record of records) {
    const key = identifier(record?.customer);

    if (!key) {
      continue;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(record);
  }

  return grouped;
}

function calculateRebookingRate(
  completedAppointments,
  upcomingAppointments
) {
  if (completedAppointments.length === 0) {
    return 0;
  }

  const completedDates = completedAppointments
    .map(appointmentDateValue)
    .filter(Boolean)
    .sort((left, right) => left - right);

  const futureDates = upcomingAppointments
    .map(appointmentDateValue)
    .filter(Boolean)
    .sort((left, right) => left - right);

  let rebooked = 0;

  for (let index = 0; index < completedDates.length; index += 1) {
    const current = completedDates[index];
    const nextCompleted = completedDates[index + 1] || null;
    const nextFuture = futureDates.find((item) => item > current) || null;
    const next = nextCompleted || nextFuture;

    if (!next) {
      continue;
    }

    const interval = daysBetween(current, next);

    if (interval !== null && interval <= 120) {
      rebooked += 1;
    }
  }

  return ratio(rebooked, completedDates.length);
}

function marketingConsent(customer) {
  const preferences = customer?.communicationPreferences || {};
  const legacy = customer?.marketing || {};

  if (
    preferences.unsubscribed ||
    preferences.promotionalMessages === false
  ) {
    return false;
  }

  return Boolean(
    legacy.emailConsent ||
      legacy.smsConsent ||
      preferences.promotionalMessages
  );
}

function preferredChannel(customer) {
  const preferences = customer?.communicationPreferences || {};
  const selected = String(
    preferences.preferredChannel || ""
  ).trim();

  if (selected && selected !== "none") {
    return selected;
  }

  if (customer?.marketing?.emailConsent) {
    return "email";
  }

  if (customer?.marketing?.smsConsent) {
    return "sms";
  }

  return "none";
}

function contactMetrics(contacts = []) {
  const eligible = contacts.filter((item) =>
    ["sent", "delivered", "opened", "responded"].includes(
      item?.status
    )
  );

  const engaged = eligible.filter((item) =>
    ["opened", "responded"].includes(item?.status)
  );

  return {
    attempts: eligible.length,
    engagementRate: ratio(engaged.length, eligible.length),
  };
}

export function buildCustomerSegmentationFeature({
  customer,
  appointments = [],
  orders = [],
  contacts = [],
  now = new Date(),
} = {}) {
  if (!customer) {
    throw new AiCustomerSegmentationError(
      "Customer data is required for segmentation.",
      {
        code: "SEGMENTATION_CUSTOMER_REQUIRED",
        status: 422,
      }
    );
  }

  const completed = appointments.filter(
    (item) => item?.status === "completed"
  );
  const cancelled = appointments.filter(
    (item) => item?.status === "cancelled"
  );
  const noShows = appointments.filter(
    (item) => item?.status === "no_show"
  );
  const upcoming = appointments.filter((item) => {
    const startsAt = appointmentDateValue(item);
    return (
      ACTIVE_APPOINTMENT_STATUSES.has(item?.status) &&
      startsAt &&
      startsAt >= now
    );
  });

  const serviceSpend = completed.reduce(
    (sum, item) =>
      sum +
      positiveNumber(
        item?.finalPrice ??
          item?.amountPaid ??
          item?.totalPrice
      ),
    0
  );
  const discountTotal = completed.reduce(
    (sum, item) => sum + positiveNumber(item?.discount),
    0
  );
  const discountedAppointments = completed.filter(
    (item) => positiveNumber(item?.discount) > 0
  ).length;
  const retailSpend = orders.reduce(
    (sum, item) => sum + positiveNumber(item?.total),
    0
  );

  const completedDates = completed
    .map(appointmentDateValue)
    .filter(Boolean)
    .sort((left, right) => right - left);
  const nextDates = upcoming
    .map(appointmentDateValue)
    .filter(Boolean)
    .sort((left, right) => left - right);

  const lastVisit =
    completedDates[0] || date(customer?.lastVisit);
  const nextVisit =
    nextDates[0] || date(customer?.nextAppointment);
  const contact = contactMetrics(contacts);

  return {
    customer_ref: identifier(customer),
    account_age_days:
      daysBetween(customer?.createdAt, now) || 0,
    completed_appointments: Math.max(
      completed.length,
      Math.round(
        positiveNumber(customer?.completedAppointmentCount)
      )
    ),
    cancelled_appointments: Math.max(
      cancelled.length,
      Math.round(
        positiveNumber(customer?.cancelledAppointmentCount)
      )
    ),
    no_show_appointments: Math.max(
      noShows.length,
      Math.round(positiveNumber(customer?.noShowCount))
    ),
    upcoming_appointments: upcoming.length,
    days_since_last_visit: lastVisit
      ? daysBetween(lastVisit, now)
      : null,
    days_until_next_appointment: nextVisit
      ? daysBetween(now, nextVisit)
      : null,
    service_spend: Number(
      Math.max(
        serviceSpend,
        positiveNumber(customer?.totalSpent)
      ).toFixed(2)
    ),
    retail_spend: Number(retailSpend.toFixed(2)),
    average_service_spend: Number(
      positiveNumber(
        customer?.averageSpend,
        completed.length > 0
          ? serviceSpend / completed.length
          : 0
      ).toFixed(2)
    ),
    discount_total: Number(discountTotal.toFixed(2)),
    discount_usage_rate: Number(
      ratio(discountedAppointments, completed.length).toFixed(3)
    ),
    rebooking_rate: Number(
      calculateRebookingRate(completed, upcoming).toFixed(3)
    ),
    marketing_engagement_rate: Number(
      contact.engagementRate.toFixed(3)
    ),
    contact_attempts: contact.attempts,
    product_orders: orders.length,
    loyalty_points: Math.round(
      positiveNumber(customer?.loyaltyPoints)
    ),
    has_marketing_consent: marketingConsent(customer),
    preferred_channel: preferredChannel(customer),
  };
}

export function normaliseSegmentationThresholds(
  values = {}
) {
  const result = {
    ...DEFAULT_SEGMENTATION_THRESHOLDS,
  };

  for (const key of Object.keys(result)) {
    if (
      values[key] !== undefined &&
      values[key] !== null &&
      values[key] !== ""
    ) {
      result[key] = positiveNumber(values[key], result[key]);
    }
  }

  result.loyal_rebooking_rate = Math.min(
    1,
    result.loyal_rebooking_rate
  );
  result.discount_usage_rate = Math.min(
    1,
    result.discount_usage_rate
  );

  return result;
}

export function buildCustomerSegmentationPayload({
  customers = [],
  appointments = [],
  orders = [],
  contacts = [],
  thresholds = {},
  now = new Date(),
} = {}) {
  const appointmentsByCustomer = groupByCustomer(appointments);
  const ordersByCustomer = groupByCustomer(orders);
  const contactsByCustomer = groupByCustomer(contacts);

  return {
    customers: customers.map((customer) => {
      const key = identifier(customer);

      return buildCustomerSegmentationFeature({
        customer,
        appointments: appointmentsByCustomer.get(key) || [],
        orders: ordersByCustomer.get(key) || [],
        contacts: contactsByCustomer.get(key) || [],
        now,
      });
    }),
    thresholds: normaliseSegmentationThresholds(thresholds),
  };
}

export async function loadCustomerSegmentationContext({
  limit = 250,
  lookbackDays = 730,
  now = new Date(),
} = {}) {
  const safeLimit = Math.min(
    500,
    Math.max(1, Math.round(number(limit, 250)))
  );
  const safeLookbackDays = Math.min(
    3650,
    Math.max(180, Math.round(number(lookbackDays, 730)))
  );
  const lookbackDate = new Date(
    now.getTime() - safeLookbackDays * DAY_MS
  );

  const customers = await Customer.find({
    status: {
      $nin: ["deleted"],
    },
  })
    .select(
      [
        "firstName",
        "lastName",
        "preferredName",
        "status",
        "createdAt",
        "lastVisit",
        "nextAppointment",
        "completedAppointmentCount",
        "cancelledAppointmentCount",
        "noShowCount",
        "totalSpent",
        "averageSpend",
        "loyaltyPoints",
        "loyaltyTier",
        "communicationPreferences",
        "marketing",
      ].join(" ")
    )
    .sort({
      updatedAt: -1,
      createdAt: -1,
    })
    .limit(safeLimit)
    .lean();

  const customerIds = customers.map((item) => item._id);

  if (customerIds.length === 0) {
    return {
      customers,
      appointments: [],
      orders: [],
      contacts: [],
      safeLimit,
      safeLookbackDays,
    };
  }

  const [appointments, orders, contacts] = await Promise.all([
    Appointment.find({
      customer: {
        $in: customerIds,
      },
      $or: [
        {
          appointmentDate: {
            $gte: lookbackDate,
          },
        },
        {
          startsAt: {
            $gte: lookbackDate,
          },
        },
      ],
    })
      .select(
        "customer status appointmentDate startsAt finalPrice amountPaid totalPrice discount"
      )
      .sort({
        appointmentDate: 1,
        startsAt: 1,
      })
      .lean(),

    Order.find({
      customer: {
        $in: customerIds,
      },
      status: {
        $in: COMPLETED_ORDER_STATUSES,
      },
      createdAt: {
        $gte: lookbackDate,
      },
    })
      .select("customer total status createdAt")
      .lean(),

    CustomerContactLog.find({
      customer: {
        $in: customerIds,
      },
      createdAt: {
        $gte: lookbackDate,
      },
    })
      .select("customer status channel createdAt")
      .lean(),
  ]);

  return {
    customers,
    appointments,
    orders,
    contacts,
    safeLimit,
    safeLookbackDays,
  };
}

export async function createAiCustomerSegmentation({
  limit = 250,
  lookbackDays = 730,
  thresholds = {},
  requestId,
  now = new Date(),
} = {}) {
  const context = await loadCustomerSegmentationContext({
    limit,
    lookbackDays,
    now,
  });

  if (context.customers.length === 0) {
    return {
      customers: [],
      overview: {},
      thresholds: normaliseSegmentationThresholds(thresholds),
      generatedAt: now.toISOString(),
      source: {
        customerCount: 0,
        appointmentCount: 0,
        orderCount: 0,
        contactCount: 0,
        privacy: {
          contactDetailsSentToAi: false,
          customerNamesSentToAi: false,
        },
      },
    };
  }

  const payload = buildCustomerSegmentationPayload({
    ...context,
    thresholds,
    now,
  });

  const analysis = await analyseCustomerSegments(payload, {
    requestId,
  });
  const analysisByCustomer = new Map(
    (analysis?.customers || []).map((item) => [
      String(item.customer_ref),
      item,
    ])
  );

  const customerRows = context.customers.map((customer) => {
    const key = identifier(customer);
    const feature = payload.customers.find(
      (item) => item.customer_ref === key
    );

    return {
      customerId: key,
      displayName: displayName(customer),
      customerStatus: customer.status || "active",
      loyaltyTier: customer.loyaltyTier || "standard",
      preferredChannel: feature?.preferred_channel || "none",
      hasMarketingConsent: Boolean(
        feature?.has_marketing_consent
      ),
      metrics: {
        completedAppointments:
          feature?.completed_appointments || 0,
        upcomingAppointments:
          feature?.upcoming_appointments || 0,
        daysSinceLastVisit:
          feature?.days_since_last_visit ?? null,
        serviceSpend: feature?.service_spend || 0,
        retailSpend: feature?.retail_spend || 0,
        averageServiceSpend:
          feature?.average_service_spend || 0,
        discountUsageRate:
          feature?.discount_usage_rate || 0,
        rebookingRate: feature?.rebooking_rate || 0,
        marketingEngagementRate:
          feature?.marketing_engagement_rate || 0,
        noShowAppointments:
          feature?.no_show_appointments || 0,
        cancelledAppointments:
          feature?.cancelled_appointments || 0,
      },
      analysis:
        analysisByCustomer.get(key) || null,
    };
  });

  const overview = Object.fromEntries(
    (analysis?.segment_counts || []).map((item) => [
      item.key,
      item.count,
    ])
  );

  return {
    customers: customerRows,
    overview,
    thresholds:
      analysis?.thresholds || payload.thresholds,
    metadata: analysis?.metadata || null,
    generatedAt: now.toISOString(),
    source: {
      customerCount: context.customers.length,
      appointmentCount: context.appointments.length,
      orderCount: context.orders.length,
      contactCount: context.contacts.length,
      lookbackDays: context.safeLookbackDays,
      privacy: {
        contactDetailsSentToAi: false,
        customerNamesSentToAi: false,
        postalAddressesSentToAi: false,
        freeTextNotesSentToAi: false,
      },
    },
  };
}

export default {
  buildCustomerSegmentationFeature,
  buildCustomerSegmentationPayload,
  createAiCustomerSegmentation,
  loadCustomerSegmentationContext,
  normaliseSegmentationThresholds,
};
