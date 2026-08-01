import Appointment from "../../models/Appointment.js";
import RebookingCampaign from "../rebookingCampaigns/RebookingCampaign.js";

import {
  addUtcMonths,
  clampInteger,
  getAppointmentDate,
  getAppointmentValue,
  getEntityId,
  roundMoney,
  roundNumber,
  startOfUtcMonth,
} from "../shared/analyticsUtils.js";

function getSource(appointment) {
  return String(
    appointment?.utmSource ||
      appointment?.marketingSource ||
      appointment?.acquisitionSource ||
      appointment?.source ||
      appointment?.bookingSource ||
      "direct"
  )
    .trim()
    .toLowerCase();
}

function createRecord({ key, name, type }) {
  return {
    key,
    name,
    type,
    appointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    noShowAppointments: 0,
    uniqueCustomers: new Set(),
    revenue: 0,
  };
}

function finaliseRecord(record) {
  const conversionRate =
    record.appointments > 0
      ? (record.completedAppointments / record.appointments) * 100
      : 0;

  return {
    key: record.key,
    name: record.name,
    type: record.type,
    appointments: record.appointments,
    completedAppointments: record.completedAppointments,
    cancelledAppointments: record.cancelledAppointments,
    noShowAppointments: record.noShowAppointments,
    uniqueCustomers: record.uniqueCustomers.size,
    revenue: roundMoney(record.revenue),
    conversionRate: roundNumber(conversionRate, 1),
    averageBookingValue:
      record.completedAppointments > 0
        ? roundMoney(record.revenue / record.completedAppointments)
        : 0,
  };
}

function buildCampaignRecord(campaign) {
  const record = createRecord({
    key: String(campaign._id),
    name: campaign.name || `Campaign ${String(campaign._id).slice(-6)}`,
    type: "campaign",
  });

  for (const recipient of campaign.recipients || []) {
    record.appointments += 1;

    const customerId = getEntityId(recipient.customer);
    if (customerId) {
      record.uniqueCustomers.add(customerId);
    }

    if (recipient.rebookedAppointment) {
      record.completedAppointments += 1;
      record.revenue += Number(recipient.recoveredRevenue) || 0;
    }

    if (recipient.status === "failed") {
      record.cancelledAppointments += 1;
    }
  }

  return finaliseRecord(record);
}

async function generateMarketingAttribution({ months = 12 } = {}) {
  const selectedMonths = clampInteger(months, 1, 24, 12);
  const now = new Date();
  const currentMonth = startOfUtcMonth(now);
  const startDate = addUtcMonths(currentMonth, -(selectedMonths - 1));
  const endDate = addUtcMonths(currentMonth, 1);

  const [appointments, campaigns] = await Promise.all([
    Appointment.find({
      $or: [
        { startsAt: { $gte: startDate, $lt: endDate } },
        { appointmentDate: { $gte: startDate, $lt: endDate } },
      ],
    })
      .populate("customer", "name email")
      .lean(),
    RebookingCampaign.find({
      createdAt: { $gte: startDate, $lt: endDate },
    })
      .select("name channel status recipients createdAt sentAt")
      .lean(),
  ]);

  const sourceMap = new Map();

  for (const appointment of appointments) {
    const appointmentDate = getAppointmentDate(appointment);

    if (
      !appointmentDate ||
      appointmentDate < startDate ||
      appointmentDate >= endDate
    ) {
      continue;
    }

    const status = String(appointment.status || "pending").toLowerCase();
    const revenue =
      status === "completed" ? getAppointmentValue(appointment) : 0;
    const customerId = getEntityId(appointment.customer);
    const source = getSource(appointment);

    if (!sourceMap.has(source)) {
      sourceMap.set(
        source,
        createRecord({ key: source, name: source, type: "source" })
      );
    }

    const sourceRecord = sourceMap.get(source);
    sourceRecord.appointments += 1;

    if (customerId) {
      sourceRecord.uniqueCustomers.add(customerId);
    }

    if (status === "completed") {
      sourceRecord.completedAppointments += 1;
    }

    if (status === "cancelled") {
      sourceRecord.cancelledAppointments += 1;
    }

    if (status === "no_show") {
      sourceRecord.noShowAppointments += 1;
    }

    sourceRecord.revenue += revenue;
  }

  const sources = Array.from(sourceMap.values())
    .map(finaliseRecord)
    .sort(
      (first, second) =>
        second.revenue - first.revenue ||
        second.appointments - first.appointments
    );

  const campaignRecords = campaigns
    .map(buildCampaignRecord)
    .sort(
      (first, second) =>
        second.revenue - first.revenue ||
        second.completedAppointments - first.completedAppointments
    );

  const completedAppointments = sources.reduce(
    (total, item) => total + item.completedAppointments,
    0
  );
  const attributedRevenue = sources.reduce(
    (total, item) => total + item.revenue,
    0
  );
  const attributedAppointments = sources.reduce(
    (total, item) => total + item.appointments,
    0
  );

  const campaignRecipients = campaignRecords.reduce(
    (total, item) => total + item.appointments,
    0
  );
  const campaignConversions = campaignRecords.reduce(
    (total, item) => total + item.completedAppointments,
    0
  );
  const campaignRevenue = campaignRecords.reduce(
    (total, item) => total + item.revenue,
    0
  );

  return {
    generatedAt: now.toISOString(),
    currency: "GBP",
    period: {
      months: selectedMonths,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    summary: {
      sourceCount: sources.length,
      campaignCount: campaignRecords.length,
      attributedAppointments,
      completedAppointments,
      attributedRevenue: roundMoney(attributedRevenue),
      overallConversionRate:
        attributedAppointments > 0
          ? roundNumber(
              (completedAppointments / attributedAppointments) * 100,
              1
            )
          : 0,
      campaignRecipients,
      campaignConversions,
      campaignRevenue: roundMoney(campaignRevenue),
      campaignConversionRate:
        campaignRecipients > 0
          ? roundNumber((campaignConversions / campaignRecipients) * 100, 1)
          : 0,
      bestSource: sources[0] || null,
      bestCampaign: campaignRecords[0] || null,
    },
    sources,
    campaigns: campaignRecords,
  };
}

export { generateMarketingAttribution };
