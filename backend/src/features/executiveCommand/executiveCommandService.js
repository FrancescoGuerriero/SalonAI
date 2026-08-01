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

async function generateExecutiveCommandCentre({ days = 90 } = {}) {
  const selectedDays = Math.max(7, Math.min(365, Number(days) || 90));
  const now = new Date();
  const startDate = addDays(now, -selectedDays);
  const futureEnd = addDays(now, 30);

  const [appointments, upcoming, campaigns, inventory, feedback] = await Promise.all([
    Appointment.find({
      $or: [
        { startsAt: { $gte: startDate, $lte: now } },
        { appointmentDate: { $gte: startDate, $lte: now } },
      ],
    })
      .populate("service", "name price")
      .populate("customer", "name email")
      .lean(),
    Appointment.find({
      status: { $in: ["pending", "confirmed", "checked_in", "in_progress"] },
      $or: [
        { startsAt: { $gt: now, $lte: futureEnd } },
        { appointmentDate: { $gt: now, $lte: futureEnd } },
      ],
    }).lean(),
    RebookingCampaign.find({ createdAt: { $gte: startDate } }).lean(),
    InventoryItem.find({ active: true }).lean(),
    CustomerFeedback.find({ createdAt: { $gte: startDate } }).lean(),
  ]);

  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let revenue = 0;
  const customers = new Set();
  const serviceMap = new Map();

  for (const appointment of appointments) {
    const date = getAppointmentDate(appointment);
    if (!date) continue;
    const status = normaliseStatus(appointment.status);
    const customerId = String(appointment.customer?._id || appointment.customer || "");
    if (customerId) customers.add(customerId);

    if (status === "completed") {
      completed += 1;
      const value = getAppointmentValue(appointment);
      revenue += value;
      const serviceName = appointment.service?.name || "Unassigned service";
      const current = serviceMap.get(serviceName) || { name: serviceName, appointments: 0, revenue: 0 };
      current.appointments += 1;
      current.revenue += value;
      serviceMap.set(serviceName, current);
    }
    if (status === "cancelled") cancelled += 1;
    if (status === "no_show") noShow += 1;
  }

  const total = appointments.length;
  const sentCampaigns = campaigns.filter((campaign) => campaign.status === "sent");
  const campaignRecipients = campaigns.reduce(
    (totalRecipients, campaign) => totalRecipients + (campaign.recipients?.length || 0),
    0
  );
  const rebookedRecipients = campaigns.reduce(
    (totalRecipients, campaign) =>
      totalRecipients +
      (campaign.recipients || []).filter((recipient) => recipient.rebookedAppointment).length,
    0
  );
  const lowStock = inventory.filter(
    (item) => Number(item.quantityOnHand || 0) <= Number(item.reorderPoint || 0)
  );
  const averageRating =
    feedback.length > 0
      ? feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length
      : 0;
  const negativeFeedback = feedback.filter((item) => item.sentiment === "negative");
  const topServices = Array.from(serviceMap.values())
    .map((item) => ({ ...item, revenue: roundMoney(item.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    generatedAt: now.toISOString(),
    currency: "GBP",
    period: {
      days: selectedDays,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    },
    summary: {
      appointments: total,
      completedAppointments: completed,
      upcomingAppointments: upcoming.length,
      uniqueCustomers: customers.size,
      revenue: roundMoney(revenue),
      averageTicket: completed > 0 ? roundMoney(revenue / completed) : 0,
      completionRate: total > 0 ? roundNumber((completed / total) * 100, 1) : 0,
      bookingLossRate:
        total > 0 ? roundNumber(((cancelled + noShow) / total) * 100, 1) : 0,
      activeInventoryItems: inventory.length,
      lowStockItems: lowStock.length,
      feedbackCount: feedback.length,
      averageRating: roundNumber(averageRating, 2),
      negativeFeedback: negativeFeedback.length,
      campaignCount: campaigns.length,
      sentCampaigns: sentCampaigns.length,
      campaignRecipients,
      campaignConversions: rebookedRecipients,
      campaignConversionRate:
        campaignRecipients > 0
          ? roundNumber((rebookedRecipients / campaignRecipients) * 100, 1)
          : 0,
    },
    topServices,
    alerts: [
      ...(lowStock.length > 0
        ? [{ type: "inventory", severity: "high", message: `${lowStock.length} stock items require reorder review.` }]
        : []),
      ...(negativeFeedback.length > 0
        ? [{ type: "feedback", severity: "medium", message: `${negativeFeedback.length} negative feedback records were recorded.` }]
        : []),
      ...((cancelled + noShow) / Math.max(total, 1) >= 0.15
        ? [{ type: "bookings", severity: "high", message: "Booking loss is at or above 15%." }]
        : []),
    ],
  };
}

export { generateExecutiveCommandCentre };
