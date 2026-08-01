import mongoose from "mongoose";

import Order from "../commerce/Order.js";
import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import CustomerNote from "../../models/CustomerNote.js";
import {
  getCustomerSummary,
} from "../../services/aiMicroserviceClient.js";

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);

class AiCustomerSummaryError extends Error {
  constructor(
    message,
    {
      code = "AI_CUSTOMER_SUMMARY_ERROR",
      status = 400,
      details = null,
    } = {}
  ) {
    super(message);
    this.name = "AiCustomerSummaryError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
    this.details = details;
  }
}

function text(value, maximumLength = 2000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximumLength);
}

function stringArray(value, maximumItems = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => text(item, 200))
        .filter(Boolean)
    )
  ).slice(0, maximumItems);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function identifier(value) {
  return text(value?._id || value?.id || value, 100);
}

function dateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function personName(value) {
  if (!value) {
    return "";
  }

  return (
    text(value.name, 200) ||
    [value.firstName, value.lastName]
      .map((item) => text(item, 100))
      .filter(Boolean)
      .join(" ")
  );
}

function serviceName(value) {
  if (!value) {
    return "";
  }

  return text(value.name || value, 200);
}

function appointmentDate(appointment) {
  return (
    dateValue(appointment?.startsAt) ||
    dateValue(appointment?.appointmentDate)
  );
}

function isUpcomingAppointment(appointment, now = new Date()) {
  if (!ACTIVE_APPOINTMENT_STATUSES.has(appointment?.status)) {
    return false;
  }

  const date = new Date(
    appointment?.startsAt || appointment?.appointmentDate || 0
  );

  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime();
}

function mapAppointment(appointment) {
  return {
    appointment_id: identifier(appointment),
    status: text(appointment?.status, 50),
    appointment_date: appointmentDate(appointment),
    appointment_time: text(appointment?.appointmentTime, 20),
    service_name: serviceName(appointment?.service),
    stylist_name: personName(appointment?.stylist),
    final_price: number(
      appointment?.finalPrice ?? appointment?.totalPrice
    ),
    amount_paid: number(appointment?.amountPaid),
    balance_due: number(appointment?.balanceDue),
    notes: text(appointment?.notes, 500),
  };
}

function mapNote(note) {
  return {
    note_type: text(note?.type || "general", 50),
    title: text(note?.title, 150),
    content: text(note?.content, 1200),
    pinned: Boolean(note?.pinned),
    requires_follow_up: Boolean(note?.requiresFollowUp),
    follow_up_at: dateValue(note?.followUpAt),
    follow_up_completed: Boolean(note?.followUpCompleted),
    created_at: dateValue(note?.createdAt),
  };
}

function mapOrder(order) {
  return {
    order_number: text(order?.orderNumber, 100),
    status: text(order?.status, 50),
    total: number(order?.total),
    created_at: dateValue(order?.createdAt),
    products: Array.isArray(order?.items)
      ? stringArray(
          order.items.map((item) => item?.name),
          20
        )
      : [],
  };
}

function customerDisplayName(customer) {
  return (
    text(customer?.preferredName, 200) ||
    [customer?.firstName, customer?.lastName]
      .map((item) => text(item, 100))
      .filter(Boolean)
      .join(" ") ||
    "Customer"
  );
}

function calculateMetrics(customer, appointments) {
  const completed = appointments.filter(
    (appointment) => appointment?.status === "completed"
  );
  const cancelled = appointments.filter(
    (appointment) => appointment?.status === "cancelled"
  );
  const noShows = appointments.filter(
    (appointment) => appointment?.status === "no_show"
  );

  const derivedSpend = completed.reduce(
    (total, appointment) =>
      total + number(
        appointment?.amountPaid ??
          appointment?.finalPrice ??
          appointment?.totalPrice
      ),
    0
  );

  const totalSpent = number(
    customer?.totalSpent,
    derivedSpend
  ) || derivedSpend;

  const visitCount = Math.max(
    number(customer?.visitCount),
    completed.length
  );

  return {
    visit_count: Math.round(visitCount),
    completed_appointments: Math.max(
      Math.round(number(customer?.completedAppointmentCount)),
      completed.length
    ),
    cancelled_appointments: Math.max(
      Math.round(number(customer?.cancelledAppointmentCount)),
      cancelled.length
    ),
    no_show_appointments: Math.max(
      Math.round(number(customer?.noShowCount)),
      noShows.length
    ),
    total_spent: Number(totalSpent.toFixed(2)),
    average_spend: Number(
      number(
        customer?.averageSpend,
        completed.length > 0
          ? totalSpent / completed.length
          : 0
      ).toFixed(2)
    ),
    loyalty_points: Math.round(number(customer?.loyaltyPoints)),
  };
}

export function buildCustomerSummaryPayload({
  customer,
  appointments = [],
  notes = [],
  orders = [],
  summaryStyle = "detailed",
  now = new Date(),
} = {}) {
  if (!customer) {
    throw new AiCustomerSummaryError(
      "Customer data is required to generate an AI summary.",
      {
        code: "CUSTOMER_SUMMARY_SOURCE_REQUIRED",
        status: 422,
      }
    );
  }

  const hair = customer.hairProfile || {};
  const booking = customer.bookingPreferences || {};

  const sortedUpcoming = appointments
    .filter((appointment) => isUpcomingAppointment(appointment, now))
    .sort(
      (left, right) =>
        new Date(left.startsAt || left.appointmentDate || 0) -
        new Date(right.startsAt || right.appointmentDate || 0)
    )
    .slice(0, 8);

  const recentAppointments = appointments
    .filter((appointment) => !isUpcomingAppointment(appointment, now))
    .slice(0, 20);

  return {
    customer_id: identifier(customer),
    display_name: customerDisplayName(customer),
    customer_status: text(customer.status || "active", 50),
    loyalty_tier: text(customer.loyaltyTier || "standard", 50),
    membership_status: text(customer.membershipStatus || "none", 50),
    metrics: calculateMetrics(customer, appointments),
    hair_profile: {
      hair_type: text(hair.hairType, 100),
      texture: text(hair.texture, 100),
      density: text(hair.density, 100),
      porosity: text(hair.porosity, 100),
      current_hair_colour: text(
        hair.currentHairColour || hair.hairColour,
        100
      ),
      scalp_condition: text(hair.scalpCondition, 500),
      concerns: stringArray(hair.concerns),
      allergies: stringArray(hair.allergies),
      sensitivities: stringArray(hair.sensitivities),
      preferred_products: stringArray(hair.preferredProducts),
      products_to_avoid: stringArray(hair.productsToAvoid),
      chemical_history: text(hair.chemicalHistory, 2000),
      patch_test_result: text(hair.patchTestResult, 50),
      last_patch_test_at: dateValue(hair.lastPatchTestAt),
    },
    booking_preferences: {
      preferred_days: stringArray(booking.preferredDays, 7),
      preferred_time_of_day: text(booking.preferredTimeOfDay, 50),
      preferred_reminder_channel: text(
        booking.preferredReminderChannel,
        50
      ),
      accessibility_requirements: text(
        booking.accessibilityRequirements,
        1000
      ),
      additional_requirements: text(
        booking.additionalRequirements,
        1000
      ),
    },
    preferred_services: Array.isArray(customer.preferredServices)
      ? stringArray(
          customer.preferredServices.map(serviceName),
          20
        )
      : [],
    preferred_stylist: personName(customer.preferredStylist),
    upcoming_appointments: sortedUpcoming.map(mapAppointment),
    recent_appointments: recentAppointments.map(mapAppointment),
    recent_notes: notes.slice(0, 12).map(mapNote),
    recent_orders: orders.slice(0, 10).map(mapOrder),
    summary_style:
      summaryStyle === "concise" ? "concise" : "detailed",
  };
}

function assertCustomerId(customerId) {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new AiCustomerSummaryError(
      "A valid customer ID is required.",
      {
        code: "INVALID_CUSTOMER_ID",
        status: 400,
      }
    );
  }
}

function visibleNoteTypesForRole(role) {
  return role === "admin" || role === "manager"
    ? ["staff", "management"]
    : ["staff"];
}

export async function loadCustomerSummaryContext(
  customerId,
  { actorRole = "stylist" } = {}
) {
  assertCustomerId(customerId);

  const customer = await Customer.findById(customerId)
    .select(
      [
        "firstName",
        "lastName",
        "preferredName",
        "status",
        "hairProfile",
        "bookingPreferences",
        "preferredServices",
        "preferredStylist",
        "visitCount",
        "completedAppointmentCount",
        "cancelledAppointmentCount",
        "noShowCount",
        "totalSpent",
        "averageSpend",
        "loyaltyPoints",
        "loyaltyTier",
        "membershipStatus",
      ].join(" ")
    )
    .populate("preferredServices", "name")
    .populate("preferredStylist", "name firstName lastName")
    .lean();

  if (!customer) {
    throw new AiCustomerSummaryError(
      "Customer profile not found.",
      {
        code: "CUSTOMER_NOT_FOUND",
        status: 404,
      }
    );
  }

  const [appointments, notes, orders] = await Promise.all([
    Appointment.find({
      customer: customerId,
    })
      .select(
        [
          "status",
          "appointmentDate",
          "appointmentTime",
          "startsAt",
          "service",
          "stylist",
          "finalPrice",
          "totalPrice",
          "amountPaid",
          "balanceDue",
          "notes",
        ].join(" ")
      )
      .populate("service", "name")
      .populate("stylist", "name firstName lastName")
      .sort({
        startsAt: -1,
        appointmentDate: -1,
        appointmentTime: -1,
      })
      .limit(30)
      .lean(),

    CustomerNote.find({
      customer: customerId,
      deletedAt: null,
      visibility: {
        $in: visibleNoteTypesForRole(actorRole),
      },
    })
      .select(
        [
          "type",
          "title",
          "content",
          "pinned",
          "requiresFollowUp",
          "followUpAt",
          "followUpCompleted",
          "createdAt",
        ].join(" ")
      )
      .sort({
        pinned: -1,
        createdAt: -1,
      })
      .limit(12)
      .lean(),

    Order.find({
      customer: customerId,
      status: {
        $in: [
          "paid",
          "processing",
          "ready",
          "completed",
        ],
      },
    })
      .select("orderNumber status total createdAt items")
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean(),
  ]);

  return {
    customer,
    appointments,
    notes,
    orders,
  };
}

export async function createCustomerAiSummary(
  customerId,
  {
    actorRole = "stylist",
    requestId,
    summaryStyle = "detailed",
  } = {}
) {
  const context = await loadCustomerSummaryContext(customerId, {
    actorRole,
  });

  const payload = buildCustomerSummaryPayload({
    ...context,
    summaryStyle,
  });

  const summary = await getCustomerSummary(payload, {
    requestId,
  });

  return {
    customer: {
      id: payload.customer_id,
      name: payload.display_name,
    },
    summary,
    source: {
      appointmentCount: context.appointments.length,
      noteCount: context.notes.length,
      orderCount: context.orders.length,
      privacy: {
        excludesContactDetails: true,
        excludesPrivateNotes: true,
        noteVisibility:
          visibleNoteTypesForRole(actorRole),
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

export default {
  buildCustomerSummaryPayload,
  createCustomerAiSummary,
  loadCustomerSummaryContext,
};
