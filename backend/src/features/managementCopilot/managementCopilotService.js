import Appointment from "../../models/Appointment.js";
import InventoryItem from "../inventory/InventoryItem.js";
import CustomerFeedback from "../feedbackAnalytics/CustomerFeedback.js";
import RebookingCampaign from "../rebookingCampaigns/RebookingCampaign.js";

import {
  addDays,
  getAppointmentDate,
  getAppointmentValue,
  normaliseStatus,
  roundMoney,
  roundNumber,
} from "../shared/analyticsUtils.js";

function insight({ id, severity, title, explanation, action, metric }) {
  return { id, severity, title, explanation, action, metric };
}

async function generateManagementCopilotBrief({ lookbackDays = 90 } = {}) {
  const selectedLookbackDays = Math.max(7, Math.min(365, Number(lookbackDays) || 90));
  const now = new Date();
  const pastStart = addDays(now, -selectedLookbackDays);
  const futureEnd = addDays(now, 30);

  const [pastAppointments, futureAppointments, inventoryItems, feedback, campaigns] =
    await Promise.all([
      Appointment.find({
        $or: [
          { startsAt: { $gte: pastStart, $lte: now } },
          { appointmentDate: { $gte: pastStart, $lte: now } },
        ],
      })
        .populate("service", "name price duration")
        .populate("stylist", "firstName lastName name fullName displayName email")
        .lean(),
      Appointment.find({
        status: { $in: ["pending", "confirmed", "checked_in", "in_progress"] },
        $or: [
          { startsAt: { $gt: now, $lte: futureEnd } },
          { appointmentDate: { $gt: now, $lte: futureEnd } },
        ],
      }).lean(),
      InventoryItem.find({ active: true }).lean(),
      CustomerFeedback.find({ createdAt: { $gte: pastStart } })
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      RebookingCampaign.find({ createdAt: { $gte: pastStart } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let revenue = 0;
  const weekdayCounts = Array(7).fill(0);

  for (const appointment of pastAppointments) {
    const status = normaliseStatus(appointment.status);
    const date = getAppointmentDate(appointment);
    if (date) weekdayCounts[date.getDay()] += 1;
    if (status === "completed") {
      completed += 1;
      revenue += getAppointmentValue(appointment);
    }
    if (status === "cancelled") cancelled += 1;
    if (status === "no_show") noShow += 1;
  }

  const total = pastAppointments.length;
  const lossCount = cancelled + noShow;
  const lossRate = total > 0 ? (lossCount / total) * 100 : 0;
  const averageTicket = completed > 0 ? revenue / completed : 0;
  const lowStock = inventoryItems.filter((item) => {
    const quantity = Number(item.quantityOnHand || 0);
    const reorderPoint = Number(item.reorderPoint || 0);
    const usage = Number(item.averageDailyUsage || 0);
    const cover = usage > 0 ? quantity / usage : Number.POSITIVE_INFINITY;
    return quantity <= reorderPoint || cover <= Number(item.leadTimeDays || 0) + 3;
  });
  const negativeFeedback = feedback.filter(
    (item) => item.sentiment === "negative" && !item.resolved
  );
  const pendingCampaigns = campaigns.filter((campaign) =>
    ["draft", "scheduled", "queued"].includes(campaign.status)
  );
  const insights = [];

  if (lossRate >= 20) {
    insights.push(
      insight({
        id: "booking-loss-high",
        severity: "high",
        title: "Booking loss requires immediate attention",
        explanation: `${roundNumber(lossRate, 1)}% of appointments were cancelled or missed in the selected period.`,
        action: "Review reminders, deposits and rebooking outreach for high-risk customers.",
        metric: `${lossCount} lost bookings`,
      })
    );
  } else if (lossRate >= 10) {
    insights.push(
      insight({
        id: "booking-loss-watch",
        severity: "medium",
        title: "Booking loss is above the preferred range",
        explanation: `${roundNumber(lossRate, 1)}% of appointments were cancelled or missed.`,
        action: "Prioritise no-show reminders and confirm upcoming high-value bookings.",
        metric: `${lossCount} lost bookings`,
      })
    );
  }

  if (lowStock.length > 0) {
    insights.push(
      insight({
        id: "inventory-reorder",
        severity: lowStock.some((item) => Number(item.quantityOnHand || 0) <= 0)
          ? "high"
          : "medium",
        title: "Inventory reorder action is required",
        explanation: `${lowStock.length} active stock items are at or near their reorder threshold.`,
        action: "Open Inventory Forecasting and place supplier orders for the most urgent items.",
        metric: `${lowStock.length} items`,
      })
    );
  }

  if (negativeFeedback.length > 0) {
    insights.push(
      insight({
        id: "negative-feedback",
        severity: negativeFeedback.length >= 3 ? "high" : "medium",
        title: "Unresolved negative customer feedback",
        explanation: `${negativeFeedback.length} negative feedback records remain unresolved.`,
        action: "Contact affected customers, document the response and close resolved cases.",
        metric: `${negativeFeedback.length} unresolved`,
      })
    );
  }

  if (pendingCampaigns.length > 0) {
    insights.push(
      insight({
        id: "campaign-backlog",
        severity: "low",
        title: "Rebooking campaign backlog",
        explanation: `${pendingCampaigns.length} campaigns are still drafts, scheduled or queued.`,
        action: "Review delivery readiness and run results tracking for recently sent campaigns.",
        metric: `${pendingCampaigns.length} campaigns`,
      })
    );
  }

  if (futureAppointments.length < Math.max(5, completed * (30 / selectedLookbackDays) * 0.5)) {
    insights.push(
      insight({
        id: "future-demand-soft",
        severity: "medium",
        title: "Forward booking demand appears soft",
        explanation: `Only ${futureAppointments.length} active appointments are booked for the next 30 days.`,
        action: "Launch targeted rebooking and lapsed-customer campaigns before capacity becomes idle.",
        metric: `${futureAppointments.length} upcoming`,
      })
    );
  }

  if (insights.length === 0) {
    insights.push(
      insight({
        id: "operations-stable",
        severity: "low",
        title: "Operations are within the monitored thresholds",
        explanation: "No urgent threshold breaches were detected from appointments, stock, campaigns or feedback.",
        action: "Continue monitoring weekly and compare trends over longer reporting periods.",
        metric: "Stable",
      })
    );
  }

  const severityOrder = { high: 3, medium: 2, low: 1 };
  insights.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  return {
    generatedAt: now.toISOString(),
    parameters: { lookbackDays: selectedLookbackDays },
    summary: {
      appointmentCount: total,
      completedAppointments: completed,
      upcomingAppointments: futureAppointments.length,
      revenue: roundMoney(revenue),
      averageTicket: roundMoney(averageTicket),
      bookingLossRate: roundNumber(lossRate, 1),
      lowStockItems: lowStock.length,
      unresolvedNegativeFeedback: negativeFeedback.length,
      pendingCampaigns: pendingCampaigns.length,
      urgentInsights: insights.filter((item) => item.severity === "high").length,
    },
    insights,
  };
}

export { generateManagementCopilotBrief };
