import Appointment from "../models/Appointment.js";
import DailyClose from "../models/DailyClose.js";
import Stylist from "../models/Stylist.js";
import Order from "../features/commerce/Order.js";

const REQUIRED_CHECKLIST_FIELDS = [
  "appointmentsReviewed",
  "paymentsReconciled",
  "cashCounted",
  "ordersReviewed",
  "followUpsReviewed",
  "premisesSecured",
];

const UNRESOLVED_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
];

function createServiceError(message, statusCode = 400, code = "DAILY_CLOSE_ERROR", details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;

  if (details) {
    error.details = details;
  }

  return error;
}

export function normaliseDateKey(value = new Date()) {
  const text = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00`);

    if (!Number.isNaN(date.getTime())) {
      return text;
    }
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createServiceError(
      "A valid business date is required.",
      400,
      "INVALID_BUSINESS_DATE"
    );
  }

  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());

  return localDate.toISOString().slice(0, 10);
}

function dayWindow(dateKey) {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(`${dateKey}T23:59:59.999`);

  return { start, end };
}

function roundMoney(value) {
  return Number((Number(value || 0)).toFixed(2));
}

function appointmentValue(appointment) {
  const finalPrice = Number(appointment.finalPrice);

  if (Number.isFinite(finalPrice)) {
    return finalPrice;
  }

  return Number(appointment.totalPrice) || 0;
}

function customerName(customer) {
  if (!customer) {
    return "Customer";
  }

  return (
    customer.preferredName ||
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    "Customer"
  );
}

function stylistName(stylist) {
  if (!stylist) {
    return "Unassigned";
  }

  return (
    stylist.name ||
    [stylist.firstName, stylist.lastName].filter(Boolean).join(" ") ||
    "Stylist"
  );
}

function formatAppointment(appointment) {
  return {
    id: appointment._id,
    status: appointment.status,
    startsAt: appointment.startsAt || null,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    customer: customerName(appointment.customer),
    stylist: stylistName(appointment.stylist),
    service: appointment.service?.name || "Service",
    value: roundMoney(appointmentValue(appointment)),
    amountPaid: roundMoney(appointment.amountPaid),
    balanceDue: roundMoney(appointment.balanceDue),
    paymentMethod: appointment.paymentMethod || "other",
    paymentStatus: appointment.paymentStatus || "pending",
  };
}

function checklistComplete(checklist = {}) {
  return REQUIRED_CHECKLIST_FIELDS.every((field) => checklist[field] === true);
}

function normaliseChecklist(checklist = {}) {
  return Object.fromEntries(
    REQUIRED_CHECKLIST_FIELDS.map((field) => [field, checklist[field] === true])
  );
}

function userId(user) {
  return user?._id || user?.id || null;
}

export async function calculateDailyCloseSummary(dateValue) {
  const dateKey = normaliseDateKey(dateValue);
  const { start, end } = dayWindow(dateKey);

  const [appointments, orders, activeStylists] = await Promise.all([
    Appointment.find({
      appointmentDate: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("customer", "firstName lastName preferredName name")
      .populate("stylist", "firstName lastName name")
      .populate("service", "name")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .lean(),

    Order.find({
      $or: [
        {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
        {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
        {
          completedAt: {
            $gte: start,
            $lte: end,
          },
        },
      ],
    })
      .sort({ createdAt: 1 })
      .lean(),

    Stylist.countDocuments({
      isActive: { $ne: false },
    }),
  ]);

  const statusCounts = {
    pending: 0,
    confirmed: 0,
    checked_in: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  };

  const paymentMethods = {
    cash: 0,
    card: 0,
    stripe: 0,
    bank_transfer: 0,
    gift_card: 0,
    other: 0,
  };

  let bookedValue = 0;
  let completedRevenue = 0;
  let appointmentCollected = 0;
  let outstandingBalance = 0;

  for (const appointment of appointments) {
    if (Object.hasOwn(statusCounts, appointment.status)) {
      statusCounts[appointment.status] += 1;
    }

    const value = appointmentValue(appointment);
    const amountPaid = Math.max(Number(appointment.amountPaid) || 0, 0);
    const balanceDue = Math.max(Number(appointment.balanceDue) || 0, 0);

    if (!["cancelled", "no_show"].includes(appointment.status)) {
      bookedValue += value;
      appointmentCollected += amountPaid;
      outstandingBalance += balanceDue;
    }

    if (appointment.status === "completed") {
      completedRevenue += value;
    }

    const paymentMethod = Object.hasOwn(paymentMethods, appointment.paymentMethod)
      ? appointment.paymentMethod
      : "other";

    paymentMethods[paymentMethod] += amountPaid;
  }

  const paidOrderStatuses = ["paid", "processing", "ready", "completed"];
  const paidOrders = orders.filter((order) => paidOrderStatuses.includes(order.status));
  const orderRevenue = paidOrders.reduce(
    (total, order) => total + (Number(order.total) || 0),
    0
  );

  const unresolvedAppointments = appointments
    .filter((appointment) => UNRESOLVED_STATUSES.includes(appointment.status))
    .map(formatAppointment);

  const summary = {
    dateKey,
    calculatedAt: new Date(),
    activeStylists: Number(activeStylists) || 0,
    appointments: {
      total: appointments.length,
      ...statusCounts,
      unresolved: unresolvedAppointments.length,
      bookedValue: roundMoney(bookedValue),
      completedRevenue: roundMoney(completedRevenue),
      collected: roundMoney(appointmentCollected),
      outstandingBalance: roundMoney(outstandingBalance),
      paymentMethods: Object.fromEntries(
        Object.entries(paymentMethods).map(([method, amount]) => [
          method,
          roundMoney(amount),
        ])
      ),
      unresolvedItems: unresolvedAppointments,
    },
    orders: {
      total: orders.length,
      paid: paidOrders.length,
      pending: orders.filter((order) => order.status === "pending_payment").length,
      processing: orders.filter((order) => order.status === "processing").length,
      ready: orders.filter((order) => order.status === "ready").length,
      completed: orders.filter((order) => order.status === "completed").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
      refunded: orders.filter((order) => order.status === "refunded").length,
      revenue: roundMoney(orderRevenue),
    },
  };

  summary.expectedCash = summary.appointments.paymentMethods.cash;
  summary.nonCashCollected = roundMoney(
    appointmentCollected - summary.expectedCash + orderRevenue
  );
  summary.totalCollected = roundMoney(appointmentCollected + orderRevenue);

  return summary;
}

async function findDailyClose(dateKey) {
  return DailyClose.findOne({ dateKey })
    .populate("closedBy", "name email role")
    .populate("reopenedBy", "name email role")
    .populate("updatedBy", "name email role")
    .lean();
}

export async function getDailyClose(dateValue) {
  const dateKey = normaliseDateKey(dateValue);
  const [summary, close] = await Promise.all([
    calculateDailyCloseSummary(dateKey),
    findDailyClose(dateKey),
  ]);

  return {
    dateKey,
    summary,
    close,
  };
}

export async function saveDailyCloseDraft(dateValue, payload = {}, viewer) {
  const dateKey = normaliseDateKey(dateValue);
  const existing = await DailyClose.findOne({ dateKey });

  if (existing?.status === "closed") {
    throw createServiceError(
      "This business day is already closed. Reopen it before changing the draft.",
      409,
      "DAILY_CLOSE_ALREADY_CLOSED"
    );
  }

  const summary = await calculateDailyCloseSummary(dateKey);
  const countedCash = Math.max(Number(payload.countedCash) || 0, 0);
  const checklist = normaliseChecklist(payload.checklist);
  const { start } = dayWindow(dateKey);

  const close = await DailyClose.findOneAndUpdate(
    { dateKey },
    {
      $set: {
        businessDate: start,
        status: "open",
        checklist,
        countedCash: roundMoney(countedCash),
        expectedCash: summary.expectedCash,
        cashVariance: roundMoney(countedCash - summary.expectedCash),
        notes: String(payload.notes || "").trim(),
        issueNotes: String(payload.issueNotes || "").trim(),
        snapshot: summary,
        calculatedAt: summary.calculatedAt,
        updatedBy: userId(viewer),
      },
      $setOnInsert: {
        dateKey,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  )
    .populate("closedBy", "name email role")
    .populate("reopenedBy", "name email role")
    .populate("updatedBy", "name email role");

  return {
    dateKey,
    summary,
    close: close.toObject ? close.toObject() : close,
  };
}

export async function closeDailyClose(dateValue, payload = {}, viewer) {
  const dateKey = normaliseDateKey(dateValue);
  const checklist = normaliseChecklist(payload.checklist);

  if (!checklistComplete(checklist)) {
    throw createServiceError(
      "Complete every closing checklist item before closing the day.",
      422,
      "DAILY_CLOSE_CHECKLIST_INCOMPLETE",
      {
        missing: REQUIRED_CHECKLIST_FIELDS.filter((field) => !checklist[field]),
      }
    );
  }

  const existing = await DailyClose.findOne({ dateKey });

  if (existing?.status === "closed") {
    throw createServiceError(
      "This business day is already closed.",
      409,
      "DAILY_CLOSE_ALREADY_CLOSED"
    );
  }

  const summary = await calculateDailyCloseSummary(dateKey);
  const unresolved = summary.appointments.unresolved;
  const forceClose = payload.forceClose === true;
  const overrideReason = String(payload.overrideReason || "").trim();

  if (unresolved > 0 && !forceClose) {
    throw createServiceError(
      "Resolve the remaining appointments or explicitly authorise an override.",
      409,
      "DAILY_CLOSE_UNRESOLVED_APPOINTMENTS",
      {
        unresolvedAppointments: unresolved,
      }
    );
  }

  if (unresolved > 0 && overrideReason.length < 10) {
    throw createServiceError(
      "Provide an override reason of at least 10 characters when closing with unresolved appointments.",
      422,
      "DAILY_CLOSE_OVERRIDE_REASON_REQUIRED"
    );
  }

  const countedCash = Math.max(Number(payload.countedCash) || 0, 0);
  const { start } = dayWindow(dateKey);
  const now = new Date();

  const close = await DailyClose.findOneAndUpdate(
    { dateKey },
    {
      $set: {
        businessDate: start,
        status: "closed",
        checklist,
        countedCash: roundMoney(countedCash),
        expectedCash: summary.expectedCash,
        cashVariance: roundMoney(countedCash - summary.expectedCash),
        notes: String(payload.notes || "").trim(),
        issueNotes: String(payload.issueNotes || "").trim(),
        overrideReason,
        snapshot: summary,
        calculatedAt: summary.calculatedAt,
        closedBy: userId(viewer),
        closedAt: now,
        reopenedBy: null,
        reopenedAt: null,
        reopenReason: "",
        updatedBy: userId(viewer),
      },
      $setOnInsert: {
        dateKey,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  )
    .populate("closedBy", "name email role")
    .populate("updatedBy", "name email role");

  return {
    dateKey,
    summary,
    close: close.toObject ? close.toObject() : close,
  };
}

export async function reopenDailyClose(dateValue, payload = {}, viewer) {
  const dateKey = normaliseDateKey(dateValue);
  const reason = String(payload.reason || "").trim();

  if (reason.length < 10) {
    throw createServiceError(
      "Provide a reopening reason of at least 10 characters.",
      422,
      "DAILY_CLOSE_REOPEN_REASON_REQUIRED"
    );
  }

  const close = await DailyClose.findOne({ dateKey });

  if (!close) {
    throw createServiceError(
      "No daily closing record exists for this date.",
      404,
      "DAILY_CLOSE_NOT_FOUND"
    );
  }

  if (close.status !== "closed") {
    throw createServiceError(
      "This business day is already open.",
      409,
      "DAILY_CLOSE_ALREADY_OPEN"
    );
  }

  close.status = "open";
  close.reopenedBy = userId(viewer);
  close.reopenedAt = new Date();
  close.reopenReason = reason;
  close.updatedBy = userId(viewer);

  await close.save();
  await close.populate("closedBy", "name email role");
  await close.populate("reopenedBy", "name email role");
  await close.populate("updatedBy", "name email role");

  return {
    dateKey,
    summary: await calculateDailyCloseSummary(dateKey),
    close: close.toObject ? close.toObject() : close,
  };
}

export async function listDailyCloseHistory(query = {}) {
  const toDateKey = normaliseDateKey(query.to || new Date());
  const fromFallback = new Date(`${toDateKey}T12:00:00`);
  fromFallback.setDate(fromFallback.getDate() - 30);
  const fromDateKey = normaliseDateKey(query.from || fromFallback);

  if (fromDateKey > toDateKey) {
    throw createServiceError(
      "The history start date cannot be after the end date.",
      400,
      "INVALID_DAILY_CLOSE_RANGE"
    );
  }

  return DailyClose.find({
    dateKey: {
      $gte: fromDateKey,
      $lte: toDateKey,
    },
  })
    .populate("closedBy", "name email role")
    .populate("reopenedBy", "name email role")
    .sort({ dateKey: -1 })
    .lean();
}

export default {
  calculateDailyCloseSummary,
  closeDailyClose,
  getDailyClose,
  listDailyCloseHistory,
  normaliseDateKey,
  reopenDailyClose,
  saveDailyCloseDraft,
};
