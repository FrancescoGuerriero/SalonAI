import Appointment from "../../models/Appointment.js";
import Stylist from "../../models/Stylist.js";
import Order from "../commerce/Order.js";
import StaffShift from "../staffRota/StaffShift.js";
import RetailSaleAttribution from "./RetailSaleAttribution.js";
import StaffCompensationPlan from "./StaffCompensationPlan.js";

const COMPLETED_STATUS = "completed";
const ACTIVE_STATUSES = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
]);
const COMMISSIONABLE_ORDER_STATUSES = new Set([
  "paid",
  "processing",
  "ready",
  "completed",
]);
const REBOOKING_WINDOW_DAYS = 90;

function createHttpError(message, statusCode, code, details = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundPercentage(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

function clampNumber(value, minimum, maximum, fallback = 0) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsedValue));
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function getEntityId(entity) {
  return String(entity?._id || entity?.id || entity || "");
}

function getStylistName(stylist) {
  const combinedName = [stylist?.firstName, stylist?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    stylist?.name ||
    stylist?.fullName ||
    stylist?.displayName ||
    combinedName ||
    stylist?.email ||
    "Unassigned stylist"
  );
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function getMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getAppointmentDate(appointment) {
  const rawDate = appointment?.startsAt || appointment?.appointmentDate;

  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getOrderDate(order) {
  const rawDate =
    order?.completedAt || order?.paidAt || order?.updatedAt || order?.createdAt;

  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createMonthBuckets({ startDate, months }) {
  return Array.from({ length: months }, (_, index) => {
    const date = addUtcMonths(startDate, index);

    return {
      month: getMonthKey(date),
      label: getMonthLabel(date),
      appointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      serviceRevenue: 0,
      collectedRevenue: 0,
      retailRevenue: 0,
      retailCommissionBasis: 0,
      serviceCommission: 0,
      retailCommission: 0,
      totalCommission: 0,
      scheduledMinutes: 0,
      productiveMinutes: 0,
      eligibleRebookings: 0,
      successfulRebookings: 0,
    };
  });
}

function normaliseTiers(tiers) {
  if (!Array.isArray(tiers)) {
    return [];
  }

  return tiers
    .map((tier) => ({
      threshold: clampNumber(tier?.threshold, 0, 10_000_000, 0),
      ratePercent: clampNumber(tier?.ratePercent, 0, 100, 0),
    }))
    .sort((first, second) => first.threshold - second.threshold);
}

function normalisePlan(plan, stylistId = "") {
  return {
    id: getEntityId(plan),
    stylistId: getEntityId(plan?.stylist) || stylistId,
    active: plan?.active !== false,
    serviceCommission: {
      enabled: Boolean(plan?.serviceCommission?.enabled),
      basis:
        plan?.serviceCommission?.basis === "collected"
          ? "collected"
          : "earned",
      ratePercent: clampNumber(
        plan?.serviceCommission?.ratePercent,
        0,
        100,
        0
      ),
      tiers: normaliseTiers(plan?.serviceCommission?.tiers),
    },
    retailCommission: {
      enabled: Boolean(plan?.retailCommission?.enabled),
      basis:
        plan?.retailCommission?.basis === "total" ? "total" : "subtotal",
      ratePercent: clampNumber(
        plan?.retailCommission?.ratePercent,
        0,
        100,
        0
      ),
      tiers: normaliseTiers(plan?.retailCommission?.tiers),
    },
    monthlyTargets: {
      serviceRevenue: clampNumber(
        plan?.monthlyTargets?.serviceRevenue,
        0,
        10_000_000,
        0
      ),
      retailRevenue: clampNumber(
        plan?.monthlyTargets?.retailRevenue,
        0,
        10_000_000,
        0
      ),
      completedAppointments: clampInteger(
        plan?.monthlyTargets?.completedAppointments,
        0,
        100_000,
        0
      ),
      rebookingRate: clampNumber(
        plan?.monthlyTargets?.rebookingRate,
        0,
        100,
        0
      ),
      productivityRate: clampNumber(
        plan?.monthlyTargets?.productivityRate,
        0,
        300,
        0
      ),
    },
    notes: String(plan?.notes || "").trim(),
    updatedAt: plan?.updatedAt || null,
  };
}

function calculateBracketRate(amount, rule) {
  if (!rule?.enabled) {
    return 0;
  }

  let rate = clampNumber(rule.ratePercent, 0, 100, 0);

  for (const tier of normaliseTiers(rule.tiers)) {
    if (Number(amount) >= tier.threshold) {
      rate = tier.ratePercent;
    }
  }

  return rate;
}

function calculateCommission(amount, rule) {
  const ratePercent = calculateBracketRate(amount, rule);

  return {
    ratePercent,
    amount: roundMoney((Number(amount) || 0) * (ratePercent / 100)),
  };
}

function calculateProgress(actual, target) {
  const numericTarget = Number(target) || 0;

  if (numericTarget <= 0) {
    return null;
  }

  return roundPercentage(((Number(actual) || 0) / numericTarget) * 100);
}

function shiftMinutes(shift) {
  const startsAt = new Date(shift?.startsAt);
  const endsAt = new Date(shift?.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000) -
      Math.max(0, Number(shift?.breakMinutes) || 0)
  );
}

function getServiceRevenue(appointment) {
  return firstFiniteNumber(
    appointment?.finalPrice,
    appointment?.totalPrice,
    appointment?.price
  );
}

function getCollectedRevenue(appointment) {
  const status = String(appointment?.paymentStatus || "").toLowerCase();

  if (["refunded", "cancelled"].includes(status)) {
    return 0;
  }

  return firstFiniteNumber(appointment?.amountPaid);
}

function getRetailRevenue(order) {
  const subtotal = firstFiniteNumber(order?.subtotal, order?.total);
  const discount = Math.max(0, Number(order?.discountTotal) || 0);
  return roundMoney(Math.max(0, subtotal - discount));
}

function getRetailCommissionBasis(order, basis) {
  if (basis === "total") {
    return firstFiniteNumber(order?.total);
  }

  return getRetailRevenue(order);
}

function hasRebooking({ appointment, allAppointments, windowDays }) {
  const appointmentDate = getAppointmentDate(appointment);
  const customerId = getEntityId(appointment?.customer);
  const stylistId = getEntityId(appointment?.stylist);

  if (!appointmentDate || !customerId || !stylistId) {
    return false;
  }

  const windowEnd = addUtcDays(appointmentDate, windowDays);

  return allAppointments.some((candidate) => {
    if (getEntityId(candidate) === getEntityId(appointment)) {
      return false;
    }

    const candidateStatus = String(candidate?.status || "").toLowerCase();

    if (["cancelled", "no_show"].includes(candidateStatus)) {
      return false;
    }

    if (
      getEntityId(candidate?.customer) !== customerId ||
      getEntityId(candidate?.stylist) !== stylistId
    ) {
      return false;
    }

    const candidateDate = getAppointmentDate(candidate);

    return (
      candidateDate &&
      candidateDate > appointmentDate &&
      candidateDate <= windowEnd
    );
  });
}

function createStaffRecord({ stylist, plan, startDate, months }) {
  const stylistId = getEntityId(stylist);

  return {
    stylistId,
    name: getStylistName(stylist),
    email: stylist?.email || "",
    profileImage: stylist?.profileImage || "",
    specialties: Array.isArray(stylist?.specialties) ? stylist.specialties : [],
    plan: normalisePlan(plan, stylistId),
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    activeAppointments: 0,
    uniqueCustomerIds: new Set(),
    serviceRevenue: 0,
    collectedRevenue: 0,
    retailRevenue: 0,
    retailOrderCount: 0,
    scheduledMinutes: 0,
    productiveMinutes: 0,
    eligibleRebookings: 0,
    successfulRebookings: 0,
    monthly: createMonthBuckets({ startDate, months }),
  };
}

function finaliseStaffRecord(record, months) {
  for (const month of record.monthly) {
    const serviceBasis =
      record.plan.serviceCommission.basis === "collected"
        ? month.collectedRevenue
        : month.serviceRevenue;

    const retailCommission = calculateCommission(
      month.retailCommissionBasis,
      record.plan.retailCommission
    );
    const serviceCommission = calculateCommission(
      serviceBasis,
      record.plan.serviceCommission
    );

    month.serviceCommission = serviceCommission.amount;
    month.retailCommission = retailCommission.amount;
    month.totalCommission = roundMoney(
      serviceCommission.amount + retailCommission.amount
    );
  }

  const serviceCommission = roundMoney(
    record.monthly.reduce((total, month) => total + month.serviceCommission, 0)
  );
  const retailCommission = roundMoney(
    record.monthly.reduce((total, month) => total + month.retailCommission, 0)
  );
  const totalCommission = roundMoney(serviceCommission + retailCommission);

  const completionRate =
    record.totalAppointments > 0
      ? (record.completedAppointments / record.totalAppointments) * 100
      : 0;
  const cancellationRate =
    record.totalAppointments > 0
      ? (record.cancelledAppointments / record.totalAppointments) * 100
      : 0;
  const noShowRate =
    record.totalAppointments > 0
      ? (record.noShowAppointments / record.totalAppointments) * 100
      : 0;
  const rebookingRate =
    record.eligibleRebookings > 0
      ? (record.successfulRebookings / record.eligibleRebookings) * 100
      : 0;
  const productivityRate =
    record.scheduledMinutes > 0
      ? (record.productiveMinutes / record.scheduledMinutes) * 100
      : 0;
  const averageTicket =
    record.completedAppointments > 0
      ? record.serviceRevenue / record.completedAppointments
      : 0;

  const targetTotals = {
    serviceRevenue: record.plan.monthlyTargets.serviceRevenue * months,
    retailRevenue: record.plan.monthlyTargets.retailRevenue * months,
    completedAppointments:
      record.plan.monthlyTargets.completedAppointments * months,
    rebookingRate: record.plan.monthlyTargets.rebookingRate,
    productivityRate: record.plan.monthlyTargets.productivityRate,
  };

  const targetProgress = {
    serviceRevenue: calculateProgress(
      record.serviceRevenue,
      targetTotals.serviceRevenue
    ),
    retailRevenue: calculateProgress(
      record.retailRevenue,
      targetTotals.retailRevenue
    ),
    completedAppointments: calculateProgress(
      record.completedAppointments,
      targetTotals.completedAppointments
    ),
    rebookingRate: calculateProgress(rebookingRate, targetTotals.rebookingRate),
    productivityRate: calculateProgress(
      productivityRate,
      targetTotals.productivityRate
    ),
  };

  const configuredProgress = Object.values(targetProgress).filter(
    (value) => value !== null
  );
  const overallTargetAttainment = configuredProgress.length
    ? roundPercentage(
        configuredProgress.reduce((total, value) => total + value, 0) /
          configuredProgress.length
      )
    : null;

  return {
    stylistId: record.stylistId,
    name: record.name,
    email: record.email,
    profileImage: record.profileImage,
    specialties: record.specialties,
    totalAppointments: record.totalAppointments,
    completedAppointments: record.completedAppointments,
    cancelledAppointments: record.cancelledAppointments,
    noShowAppointments: record.noShowAppointments,
    activeAppointments: record.activeAppointments,
    uniqueCustomers: record.uniqueCustomerIds.size,
    serviceRevenue: roundMoney(record.serviceRevenue),
    collectedRevenue: roundMoney(record.collectedRevenue),
    retailRevenue: roundMoney(record.retailRevenue),
    totalRevenue: roundMoney(record.serviceRevenue + record.retailRevenue),
    retailOrderCount: record.retailOrderCount,
    scheduledHours: roundMoney(record.scheduledMinutes / 60),
    productiveHours: roundMoney(record.productiveMinutes / 60),
    productivityRate: roundPercentage(productivityRate),
    eligibleRebookings: record.eligibleRebookings,
    successfulRebookings: record.successfulRebookings,
    rebookingRate: roundPercentage(rebookingRate),
    averageTicket: roundMoney(averageTicket),
    completionRate: roundPercentage(completionRate),
    cancellationRate: roundPercentage(cancellationRate),
    noShowRate: roundPercentage(noShowRate),
    commission: {
      service: serviceCommission,
      retail: retailCommission,
      total: totalCommission,
    },
    targetTotals,
    targetProgress: {
      ...targetProgress,
      overall: overallTargetAttainment,
    },
    plan: record.plan,
    monthly: record.monthly.map((month) => ({
      ...month,
      serviceRevenue: roundMoney(month.serviceRevenue),
      collectedRevenue: roundMoney(month.collectedRevenue),
      retailRevenue: roundMoney(month.retailRevenue),
      serviceCommission: roundMoney(month.serviceCommission),
      retailCommission: roundMoney(month.retailCommission),
      totalCommission: roundMoney(month.totalCommission),
      scheduledHours: roundMoney(month.scheduledMinutes / 60),
      productiveHours: roundMoney(month.productiveMinutes / 60),
      productivityRate:
        month.scheduledMinutes > 0
          ? roundPercentage(
              (month.productiveMinutes / month.scheduledMinutes) * 100
            )
          : 0,
      rebookingRate:
        month.eligibleRebookings > 0
          ? roundPercentage(
              (month.successfulRebookings / month.eligibleRebookings) * 100
            )
          : 0,
    })),
  };
}

function buildStaffPerformanceReport({
  stylists = [],
  plans = [],
  appointments = [],
  shifts = [],
  orders = [],
  attributions = [],
  startDate,
  endDate,
  months,
  rebookingWindowDays = REBOOKING_WINDOW_DAYS,
}) {
  const planMap = new Map(
    plans.map((plan) => [getEntityId(plan?.stylist), plan])
  );
  const staffMap = new Map();

  for (const stylist of stylists) {
    const stylistId = getEntityId(stylist);

    if (!stylistId) {
      continue;
    }

    staffMap.set(
      stylistId,
      createStaffRecord({
        stylist,
        plan: planMap.get(stylistId),
        startDate,
        months,
      })
    );
  }

  function ensureStaff(stylist) {
    const stylistId = getEntityId(stylist);

    if (!stylistId) {
      return null;
    }

    if (!staffMap.has(stylistId)) {
      staffMap.set(
        stylistId,
        createStaffRecord({
          stylist,
          plan: planMap.get(stylistId),
          startDate,
          months,
        })
      );
    }

    return staffMap.get(stylistId);
  }

  for (const appointment of appointments) {
    const appointmentDate = getAppointmentDate(appointment);

    if (!appointmentDate || appointmentDate < startDate || appointmentDate >= endDate) {
      continue;
    }

    const record = ensureStaff(appointment?.stylist);

    if (!record) {
      continue;
    }

    const month = record.monthly.find(
      (item) => item.month === getMonthKey(appointmentDate)
    );
    const status = String(appointment?.status || "pending").toLowerCase();
    const serviceRevenue = getServiceRevenue(appointment);
    const collectedRevenue = getCollectedRevenue(appointment);
    const customerId = getEntityId(appointment?.customer);

    record.totalAppointments += 1;
    month && (month.appointments += 1);

    if (customerId) {
      record.uniqueCustomerIds.add(customerId);
    }

    if (status === COMPLETED_STATUS) {
      record.completedAppointments += 1;
      record.serviceRevenue += serviceRevenue;
      record.collectedRevenue += collectedRevenue;
      record.productiveMinutes += Math.max(0, Number(appointment?.duration) || 0);
      record.eligibleRebookings += 1;

      if (month) {
        month.completedAppointments += 1;
        month.serviceRevenue += serviceRevenue;
        month.collectedRevenue += collectedRevenue;
        month.productiveMinutes += Math.max(
          0,
          Number(appointment?.duration) || 0
        );
        month.eligibleRebookings += 1;
      }

      if (
        hasRebooking({
          appointment,
          allAppointments: appointments,
          windowDays: rebookingWindowDays,
        })
      ) {
        record.successfulRebookings += 1;
        month && (month.successfulRebookings += 1);
      }
    } else {
      record.collectedRevenue += collectedRevenue;
      month && (month.collectedRevenue += collectedRevenue);
    }

    if (status === "cancelled") {
      record.cancelledAppointments += 1;
      month && (month.cancelledAppointments += 1);
    }

    if (status === "no_show") {
      record.noShowAppointments += 1;
      month && (month.noShowAppointments += 1);
    }

    if (ACTIVE_STATUSES.has(status)) {
      record.activeAppointments += 1;
    }
  }

  for (const shift of shifts) {
    const startsAt = new Date(shift?.startsAt);

    if (
      Number.isNaN(startsAt.getTime()) ||
      startsAt < startDate ||
      startsAt >= endDate ||
      String(shift?.status || "").toLowerCase() === "cancelled"
    ) {
      continue;
    }

    const record = ensureStaff(shift?.staff);

    if (!record) {
      continue;
    }

    const minutes = shiftMinutes(shift);
    record.scheduledMinutes += minutes;

    const month = record.monthly.find(
      (item) => item.month === getMonthKey(startsAt)
    );

    if (month) {
      month.scheduledMinutes += minutes;
    }
  }

  const orderMap = new Map(orders.map((order) => [getEntityId(order), order]));
  const assignedOrderIds = new Set();

  for (const attribution of attributions) {
    const orderId = getEntityId(attribution?.order);
    const stylist = attribution?.stylist;
    const order = orderMap.get(orderId);

    if (!order || !COMMISSIONABLE_ORDER_STATUSES.has(String(order.status))) {
      continue;
    }

    const orderDate = getOrderDate(order);

    if (!orderDate || orderDate < startDate || orderDate >= endDate) {
      continue;
    }

    const record = ensureStaff(stylist);

    if (!record) {
      continue;
    }

    assignedOrderIds.add(orderId);

    const retailRevenue = getRetailRevenue(order);
    const commissionBasis = getRetailCommissionBasis(
      order,
      record.plan.retailCommission.basis
    );
    record.retailRevenue += retailRevenue;
    record.retailOrderCount += 1;

    const month = record.monthly.find(
      (item) => item.month === getMonthKey(orderDate)
    );

    if (month) {
      month.retailRevenue += retailRevenue;
      month.retailCommissionBasis += commissionBasis;
    }
  }

  const staff = Array.from(staffMap.values())
    .map((record) => finaliseStaffRecord(record, months))
    .sort(
      (first, second) =>
        second.totalRevenue - first.totalRevenue ||
        second.completedAppointments - first.completedAppointments
    );

  const totalScheduledMinutes = staff.reduce(
    (total, member) => total + member.scheduledHours * 60,
    0
  );
  const totalProductiveMinutes = staff.reduce(
    (total, member) => total + member.productiveHours * 60,
    0
  );
  const totalEligibleRebookings = staff.reduce(
    (total, member) => total + member.eligibleRebookings,
    0
  );
  const totalSuccessfulRebookings = staff.reduce(
    (total, member) => total + member.successfulRebookings,
    0
  );
  const targetAttainments = staff
    .map((member) => member.targetProgress.overall)
    .filter((value) => value !== null);

  const unassignedOrders = orders
    .filter((order) => {
      const date = getOrderDate(order);
      return (
        date &&
        date >= startDate &&
        date < endDate &&
        COMMISSIONABLE_ORDER_STATUSES.has(String(order?.status || "")) &&
        !assignedOrderIds.has(getEntityId(order))
      );
    })
    .map((order) => ({
      orderId: getEntityId(order),
      orderNumber: order?.orderNumber || getEntityId(order).slice(-8),
      customerName:
        order?.contact?.name ||
        [order?.customer?.firstName, order?.customer?.lastName]
          .filter(Boolean)
          .join(" ") ||
        order?.customer?.name ||
        "Customer",
      orderDate: getOrderDate(order)?.toISOString() || null,
      status: order?.status || "",
      retailRevenue: getRetailRevenue(order),
      total: roundMoney(order?.total),
      itemCount: Array.isArray(order?.items)
        ? order.items.reduce(
            (total, item) => total + (Number(item?.quantity) || 0),
            0
          )
        : 0,
    }))
    .sort(
      (first, second) =>
        new Date(second.orderDate).getTime() - new Date(first.orderDate).getTime()
    )
    .slice(0, 50);

  const summary = {
    staffCount: staff.length,
    completedAppointments: staff.reduce(
      (total, member) => total + member.completedAppointments,
      0
    ),
    serviceRevenue: roundMoney(
      staff.reduce((total, member) => total + member.serviceRevenue, 0)
    ),
    retailRevenue: roundMoney(
      staff.reduce((total, member) => total + member.retailRevenue, 0)
    ),
    totalRevenue: roundMoney(
      staff.reduce((total, member) => total + member.totalRevenue, 0)
    ),
    serviceCommission: roundMoney(
      staff.reduce((total, member) => total + member.commission.service, 0)
    ),
    retailCommission: roundMoney(
      staff.reduce((total, member) => total + member.commission.retail, 0)
    ),
    totalCommission: roundMoney(
      staff.reduce((total, member) => total + member.commission.total, 0)
    ),
    scheduledHours: roundMoney(totalScheduledMinutes / 60),
    productiveHours: roundMoney(totalProductiveMinutes / 60),
    productivityRate:
      totalScheduledMinutes > 0
        ? roundPercentage((totalProductiveMinutes / totalScheduledMinutes) * 100)
        : 0,
    rebookingRate:
      totalEligibleRebookings > 0
        ? roundPercentage(
            (totalSuccessfulRebookings / totalEligibleRebookings) * 100
          )
        : 0,
    targetAttainment: targetAttainments.length
      ? roundPercentage(
          targetAttainments.reduce((total, value) => total + value, 0) /
            targetAttainments.length
        )
      : null,
    bestPerformer: staff[0]
      ? {
          stylistId: staff[0].stylistId,
          name: staff[0].name,
          totalRevenue: staff[0].totalRevenue,
          totalCommission: staff[0].commission.total,
        }
      : null,
  };

  return {
    summary,
    staff,
    retailOrders: {
      totalCount: orders.filter((order) =>
        COMMISSIONABLE_ORDER_STATUSES.has(String(order?.status || ""))
      ).length,
      assignedCount: assignedOrderIds.size,
      unassignedCount: unassignedOrders.length,
      unassigned: unassignedOrders,
    },
  };
}

async function generateStaffPerformance({ months = 6 } = {}) {
  const selectedMonths = clampInteger(months, 1, 24, 6);
  const currentMonth = startOfUtcMonth(new Date());
  const startDate = addUtcMonths(currentMonth, -(selectedMonths - 1));
  const endDate = addUtcMonths(currentMonth, 1);
  const rebookingEnd = addUtcDays(endDate, REBOOKING_WINDOW_DAYS);

  const [stylists, plans, appointments, shifts, orders] = await Promise.all([
    Stylist.find({ isActive: { $ne: false } })
      .sort({ firstName: 1, lastName: 1 })
      .lean(),
    StaffCompensationPlan.find({ active: { $ne: false } }).lean(),
    Appointment.find({
      $or: [
        { startsAt: { $gte: startDate, $lt: rebookingEnd } },
        { appointmentDate: { $gte: startDate, $lt: rebookingEnd } },
      ],
    })
      .populate(
        "stylist",
        "firstName lastName email profileImage specialties isActive"
      )
      .populate("customer", "firstName lastName name email")
      .lean(),
    StaffShift.find({
      startsAt: { $gte: startDate, $lt: endDate },
      status: { $in: ["published", "completed"] },
    })
      .populate(
        "staff",
        "firstName lastName email profileImage specialties isActive"
      )
      .lean(),
    Order.find({
      status: { $in: Array.from(COMMISSIONABLE_ORDER_STATUSES) },
      $or: [
        { paidAt: { $gte: startDate, $lt: endDate } },
        { completedAt: { $gte: startDate, $lt: endDate } },
        { createdAt: { $gte: startDate, $lt: endDate } },
      ],
    })
      .populate("customer", "firstName lastName name email")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const orderIds = orders.map((order) => order._id);
  const attributions = orderIds.length
    ? await RetailSaleAttribution.find({ order: { $in: orderIds } })
        .populate(
          "stylist",
          "firstName lastName email profileImage specialties isActive"
        )
        .lean()
    : [];

  const report = buildStaffPerformanceReport({
    stylists,
    plans,
    appointments,
    shifts,
    orders,
    attributions,
    startDate,
    endDate,
    months: selectedMonths,
  });

  return {
    generatedAt: new Date().toISOString(),
    currency: "GBP",
    timezone: "Europe/London",
    period: {
      months: selectedMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label:
        selectedMonths === 1
          ? getMonthLabel(currentMonth)
          : `${getMonthLabel(startDate)} to ${getMonthLabel(currentMonth)}`,
    },
    ...report,
  };
}

function sanitisePlanInput(input = {}) {
  return {
    active: input.active !== false,
    serviceCommission: {
      enabled: Boolean(input?.serviceCommission?.enabled),
      basis:
        input?.serviceCommission?.basis === "collected"
          ? "collected"
          : "earned",
      ratePercent: clampNumber(
        input?.serviceCommission?.ratePercent,
        0,
        100,
        0
      ),
      tiers: normaliseTiers(input?.serviceCommission?.tiers),
    },
    retailCommission: {
      enabled: Boolean(input?.retailCommission?.enabled),
      basis:
        input?.retailCommission?.basis === "total" ? "total" : "subtotal",
      ratePercent: clampNumber(
        input?.retailCommission?.ratePercent,
        0,
        100,
        0
      ),
      tiers: normaliseTiers(input?.retailCommission?.tiers),
    },
    monthlyTargets: {
      serviceRevenue: clampNumber(
        input?.monthlyTargets?.serviceRevenue,
        0,
        10_000_000,
        0
      ),
      retailRevenue: clampNumber(
        input?.monthlyTargets?.retailRevenue,
        0,
        10_000_000,
        0
      ),
      completedAppointments: clampInteger(
        input?.monthlyTargets?.completedAppointments,
        0,
        100_000,
        0
      ),
      rebookingRate: clampNumber(
        input?.monthlyTargets?.rebookingRate,
        0,
        100,
        0
      ),
      productivityRate: clampNumber(
        input?.monthlyTargets?.productivityRate,
        0,
        300,
        0
      ),
    },
    notes: String(input?.notes || "").trim().slice(0, 3000),
  };
}

async function upsertStaffCompensationPlan(stylistId, input, actor) {
  const stylist = await Stylist.findById(stylistId).lean();

  if (!stylist) {
    throw createHttpError(
      "The selected stylist could not be found.",
      404,
      "STAFF_MEMBER_NOT_FOUND"
    );
  }

  const payload = sanitisePlanInput(input);
  const actorId = getEntityId(actor) || null;

  const plan = await StaffCompensationPlan.findOneAndUpdate(
    { stylist: stylistId },
    {
      $set: {
        ...payload,
        updatedBy: actorId,
      },
      $setOnInsert: {
        stylist: stylistId,
        createdBy: actorId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return normalisePlan(plan, stylistId);
}

async function assignRetailOrder(orderId, stylistId, actor, notes = "") {
  const [order, stylist] = await Promise.all([
    Order.findById(orderId).lean(),
    Stylist.findById(stylistId).lean(),
  ]);

  if (!order) {
    throw createHttpError(
      "The selected retail order could not be found.",
      404,
      "RETAIL_ORDER_NOT_FOUND"
    );
  }

  if (!stylist || stylist.isActive === false) {
    throw createHttpError(
      "The selected stylist is not available.",
      404,
      "STAFF_MEMBER_NOT_FOUND"
    );
  }

  if (!COMMISSIONABLE_ORDER_STATUSES.has(String(order.status || ""))) {
    throw createHttpError(
      "Only paid or completed retail orders can be attributed.",
      409,
      "RETAIL_ORDER_NOT_COMMISSIONABLE"
    );
  }

  const attribution = await RetailSaleAttribution.findOneAndUpdate(
    { order: orderId },
    {
      $set: {
        stylist: stylistId,
        notes: String(notes || "").trim().slice(0, 1000),
        attributedBy: getEntityId(actor) || null,
        attributedAt: new Date(),
      },
      $setOnInsert: {
        order: orderId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate("stylist", "firstName lastName email")
    .populate("order", "orderNumber total subtotal discountTotal status")
    .lean();

  return attribution;
}

async function removeRetailOrderAttribution(orderId) {
  const result = await RetailSaleAttribution.deleteOne({ order: orderId });

  if (!result.deletedCount) {
    throw createHttpError(
      "No staff attribution exists for this retail order.",
      404,
      "RETAIL_ATTRIBUTION_NOT_FOUND"
    );
  }

  return { orderId, removed: true };
}

export {
  assignRetailOrder,
  buildStaffPerformanceReport,
  calculateBracketRate,
  calculateCommission,
  generateStaffPerformance,
  normalisePlan,
  removeRetailOrderAttribution,
  sanitisePlanInput,
  upsertStaffCompensationPlan,
};
