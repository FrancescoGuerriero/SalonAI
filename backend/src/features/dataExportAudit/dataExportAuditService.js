import Appointment from "../../models/Appointment.js";
import RebookingCampaign from "../rebookingCampaigns/RebookingCampaign.js";
import InventoryItem from "../inventory/InventoryItem.js";
import CustomerFeedback from "../feedbackAnalytics/CustomerFeedback.js";
import FutureAuditEvent from "./FutureAuditEvent.js";

import {
  addUtcMonths,
  clampInteger,
  getAppointmentDate,
  getAppointmentValue,
  getEntityId,
  getEntityName,
  recordsToCsv,
  startOfUtcMonth,
} from "../shared/analyticsUtils.js";

function flattenAppointment(appointment) {
  return {
    id: String(appointment._id),
    startsAt: getAppointmentDate(appointment)?.toISOString() || "",
    status: appointment.status || "",
    customerId: getEntityId(appointment.customer),
    customerName: getEntityName(appointment.customer, ""),
    customerEmail: appointment.customer?.email || "",
    serviceId: getEntityId(appointment.service),
    serviceName: getEntityName(appointment.service, ""),
    stylistId: getEntityId(appointment.stylist),
    stylistName: getEntityName(appointment.stylist, ""),
    value: getAppointmentValue(appointment),
    paymentStatus: appointment.paymentStatus || "",
  };
}

async function loadDataset(dataset, { months = 12 } = {}) {
  const selectedMonths = clampInteger(months, 1, 60, 12);
  const now = new Date();
  const startDate = addUtcMonths(startOfUtcMonth(now), -(selectedMonths - 1));

  if (dataset === "appointments") {
    const records = await Appointment.find({
      $or: [
        { startsAt: { $gte: startDate } },
        { appointmentDate: { $gte: startDate } },
      ],
    })
      .populate("customer", "firstName lastName name fullName displayName email")
      .populate("service", "name title price")
      .populate("stylist", "firstName lastName name fullName displayName email")
      .sort({ startsAt: -1, appointmentDate: -1 })
      .lean();
    return records.map(flattenAppointment);
  }

  if (dataset === "campaigns") {
    const records = await RebookingCampaign.find({ createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .lean();
    return records.map((campaign) => ({
      id: String(campaign._id),
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      scheduleAt: campaign.scheduleAt || "",
      sentAt: campaign.sentAt || "",
      recipientCount: campaign.recipients?.length || 0,
      rebookedCount: (campaign.recipients || []).filter(
        (recipient) => recipient.rebookedAppointment
      ).length,
      recoveredRevenue: (campaign.recipients || []).reduce(
        (total, recipient) => total + Number(recipient.recoveredRevenue || 0),
        0
      ),
      createdAt: campaign.createdAt,
    }));
  }

  if (dataset === "inventory") {
    const records = await InventoryItem.find({}).sort({ name: 1 }).lean();
    return records.map((item) => ({
      id: String(item._id),
      sku: item.sku,
      name: item.name,
      category: item.category,
      supplier: item.supplier,
      quantityOnHand: item.quantityOnHand,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      averageDailyUsage: item.averageDailyUsage,
      leadTimeDays: item.leadTimeDays,
      unitCost: item.unitCost,
      retailPrice: item.retailPrice,
      active: item.active,
      updatedAt: item.updatedAt,
    }));
  }

  if (dataset === "feedback") {
    const records = await CustomerFeedback.find({ createdAt: { $gte: startDate } })
      .populate("customer", "firstName lastName name fullName displayName email")
      .populate("service", "name title")
      .populate("stylist", "firstName lastName name fullName displayName email")
      .sort({ createdAt: -1 })
      .lean();
    return records.map((item) => ({
      id: String(item._id),
      rating: item.rating,
      sentiment: item.sentiment,
      sentimentScore: item.sentimentScore,
      comment: item.comment,
      customerName: getEntityName(item.customer, ""),
      customerEmail: item.customer?.email || "",
      serviceName: getEntityName(item.service, ""),
      stylistName: getEntityName(item.stylist, ""),
      resolved: item.resolved,
      createdAt: item.createdAt,
    }));
  }

  const error = new Error("Unsupported export dataset.");
  error.statusCode = 400;
  throw error;
}

async function createDatasetExport({ dataset, format = "csv", months = 12, actor }) {
  const selectedFormat = format === "json" ? "json" : "csv";
  const records = await loadDataset(dataset, { months });

  await FutureAuditEvent.create({
    action: "dataset_export",
    dataset,
    format: selectedFormat,
    recordCount: records.length,
    actor,
    metadata: { months: clampInteger(months, 1, 60, 12) },
  });

  const filename = `salonai-${dataset}-${new Date().toISOString().slice(0, 10)}.${selectedFormat}`;

  return {
    filename,
    contentType:
      selectedFormat === "json"
        ? "application/json; charset=utf-8"
        : "text/csv; charset=utf-8",
    content:
      selectedFormat === "json"
        ? JSON.stringify(records, null, 2)
        : recordsToCsv(records),
    recordCount: records.length,
  };
}

async function listAuditEvents({ page = 1, limit = 50, dataset } = {}) {
  const selectedPage = clampInteger(page, 1, 100000, 1);
  const selectedLimit = clampInteger(limit, 1, 200, 50);
  const query = dataset ? { dataset } : {};
  const [events, total] = await Promise.all([
    FutureAuditEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((selectedPage - 1) * selectedLimit)
      .limit(selectedLimit)
      .lean(),
    FutureAuditEvent.countDocuments(query),
  ]);

  return {
    events,
    pagination: {
      page: selectedPage,
      limit: selectedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / selectedLimit)),
    },
  };
}

export { createDatasetExport, listAuditEvents };
