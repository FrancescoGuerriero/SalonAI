import Appointment from "../../models/Appointment.js";

import {
  addUtcMonths,
  clampInteger,
  getAppointmentDate,
  getAppointmentValue,
  getEntityId,
  getEntityName,
  normaliseStatus,
  roundMoney,
  roundNumber,
  startOfUtcMonth,
} from "../shared/analyticsUtils.js";

function createRecord(service) {
  return {
    serviceId: getEntityId(service) || "unassigned",
    name: getEntityName(service, "Unassigned service"),
    category: service?.category || "Other",
    listedPrice: Number(service?.price || 0),
    appointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    revenue: 0,
    weekdayCounts: Array(7).fill(0),
    hourCounts: Array(24).fill(0),
  };
}

function boundedModifier({ demandIndex, lossRate, completionRate }) {
  let modifier = 0;

  if (demandIndex >= 1.35 && completionRate >= 75) modifier += 15;
  else if (demandIndex >= 1.1) modifier += 8;
  else if (demandIndex <= 0.65) modifier -= 10;
  else if (demandIndex <= 0.85) modifier -= 5;

  if (lossRate >= 25) modifier -= 5;
  if (completionRate >= 90) modifier += 3;

  return Math.max(-15, Math.min(20, modifier));
}

async function generateDynamicPricingRecommendations({ months = 6 } = {}) {
  const selectedMonths = clampInteger(months, 1, 24, 6);
  const now = new Date();
  const currentMonth = startOfUtcMonth(now);
  const startDate = addUtcMonths(currentMonth, -(selectedMonths - 1));
  const endDate = addUtcMonths(currentMonth, 1);

  const appointments = await Appointment.find({
    $or: [
      { startsAt: { $gte: startDate, $lt: endDate } },
      { appointmentDate: { $gte: startDate, $lt: endDate } },
    ],
  })
    .populate("service", "name title category price")
    .lean();

  const serviceMap = new Map();

  for (const appointment of appointments) {
    const date = getAppointmentDate(appointment);
    if (!date) continue;

    const serviceId = getEntityId(appointment.service) || "unassigned";
    if (!serviceMap.has(serviceId)) {
      serviceMap.set(serviceId, createRecord(appointment.service));
    }

    const record = serviceMap.get(serviceId);
    const status = normaliseStatus(appointment.status);
    record.appointments += 1;
    record.weekdayCounts[date.getDay()] += 1;
    record.hourCounts[date.getHours()] += 1;

    if (status === "completed") {
      record.completedAppointments += 1;
      record.revenue += getAppointmentValue(appointment);
    }
    if (status === "cancelled") record.cancelledAppointments += 1;
    if (status === "no_show") record.noShowAppointments += 1;
  }

  const averageDemand =
    serviceMap.size > 0
      ? Array.from(serviceMap.values()).reduce(
          (total, record) => total + record.appointments,
          0
        ) / serviceMap.size
      : 0;

  const recommendations = Array.from(serviceMap.values())
    .map((record) => {
      const demandIndex = averageDemand > 0 ? record.appointments / averageDemand : 0;
      const lossCount = record.cancelledAppointments + record.noShowAppointments;
      const lossRate =
        record.appointments > 0 ? (lossCount / record.appointments) * 100 : 0;
      const completionRate =
        record.appointments > 0
          ? (record.completedAppointments / record.appointments) * 100
          : 0;
      const modifierPercent = boundedModifier({ demandIndex, lossRate, completionRate });
      const basePrice =
        record.listedPrice > 0
          ? record.listedPrice
          : record.completedAppointments > 0
            ? record.revenue / record.completedAppointments
            : 0;
      const suggestedPrice = basePrice * (1 + modifierPercent / 100);
      const peakWeekday = record.weekdayCounts.indexOf(Math.max(...record.weekdayCounts));
      const peakHour = record.hourCounts.indexOf(Math.max(...record.hourCounts));

      return {
        serviceId: record.serviceId,
        name: record.name,
        category: record.category,
        appointments: record.appointments,
        completedAppointments: record.completedAppointments,
        demandIndex: roundNumber(demandIndex, 2),
        completionRate: roundNumber(completionRate, 1),
        lossRate: roundNumber(lossRate, 1),
        basePrice: roundMoney(basePrice),
        modifierPercent,
        suggestedPrice: roundMoney(suggestedPrice),
        estimatedRevenueDifference: roundMoney(
          record.completedAppointments * (suggestedPrice - basePrice)
        ),
        peakWeekday,
        peakHour,
        recommendation:
          modifierPercent > 0
            ? "Test a controlled premium during high-demand periods."
            : modifierPercent < 0
              ? "Test a targeted off-peak incentive; do not reduce the permanent list price automatically."
              : "Maintain the current price and continue monitoring demand.",
      };
    })
    .sort((a, b) => b.demandIndex - a.demandIndex);

  return {
    generatedAt: now.toISOString(),
    currency: "GBP",
    period: {
      months: selectedMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    safeguards: {
      minimumModifierPercent: -15,
      maximumModifierPercent: 20,
      automaticPriceChanges: false,
    },
    summary: {
      serviceCount: recommendations.length,
      increaseRecommendations: recommendations.filter((item) => item.modifierPercent > 0)
        .length,
      discountRecommendations: recommendations.filter((item) => item.modifierPercent < 0)
        .length,
      maintainRecommendations: recommendations.filter((item) => item.modifierPercent === 0)
        .length,
      estimatedRevenueDifference: roundMoney(
        recommendations.reduce(
          (total, item) => total + item.estimatedRevenueDifference,
          0
        )
      ),
    },
    recommendations,
  };
}

export { generateDynamicPricingRecommendations };
