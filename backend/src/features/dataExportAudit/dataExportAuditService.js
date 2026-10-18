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

function idText(value) {
  const candidate = value && typeof value === "object" && "_id" in value
    ? value._id
    : value;
  return String(candidate || "").trim();
}

export function trustedDataExportScope(authority) {
  const businessId = idText(authority?.businessId);
  if (!businessId) {
    const error = new Error("Trusted tenant authority is required for data export.");
    error.statusCode = 401;
    error.code = "DATA_EXPORT_TENANT_AUTHORITY_REQUIRED";
    throw error;
  }

  const selectedLocationId = idText(authority?.locationId) || null;
  if (authority?.locationAccessMode === "all") {
    return Object.freeze({
      businessId,
      selectedLocationId,
      locationIds: null,
      scopeMode: selectedLocationId ? "selected-location" : "business-wide",
    });
  }

  const locationIds = [
    ...new Set((authority?.allowedLocationIds || []).map(idText).filter(Boolean)),
  ];

  return Object.freeze({
    businessId,
    selectedLocationId,
    locationIds: Object.freeze(locationIds),
    scopeMode: selectedLocationId ? "selected-location" : "allowed-locations",
  });
}

function businessMatch(scope) {
  return { business: scope.businessId };
}

function locationMatch(scope, locationField = "location") {
  if (scope.selectedLocationId) {
    return {
      business: scope.businessId,
      [locationField]: scope.selectedLocationId,
    };
  }

  if (scope.locationIds === null) {
    return businessMatch(scope);
  }

  if (scope.locationIds.length === 0) {
    return { business: scope.businessId, _id: { $exists: false } };
  }

  return {
    business: scope.businessId,
    [locationField]: { $in: scope.locationIds },
  };
}

function assertBusinessWideDatasetScope(dataset, scope) {
  if (scope.selectedLocationId || scope.locationIds !== null) {
    const error = new Error(
      `${dataset} export is unavailable for location-limited authority because the dataset is Business-owned without canonical Location provenance.`
    );
    error.statusCode = 409;
    error.code = "DATA_EXPORT_LOCATION_PROVENANCE_REQUIRED";
    throw error;
  }
}

function auditOwnership(scope) {
  if (scope.selectedLocationId) {
    return {
      business: scope.businessId,
      location: scope.selectedLocationId,
      locationScope: [scope.selectedLocationId],
    };
  }

  if (scope.locationIds === null) {
    return { business: scope.businessId };
  }

  return {
    business: scope.businessId,
    locationScope: [...scope.locationIds],
  };
}

function auditMatch(scope) {
  if (scope.selectedLocationId) {
    return {
      business: scope.businessId,
      $or: [
        { location: scope.selectedLocationId },
        { locationScope: scope.selectedLocationId },
      ],
    };
  }

  if (scope.locationIds === null) {
    return businessMatch(scope);
  }

  if (scope.locationIds.length === 0) {
    return { business: scope.businessId, _id: { $exists: false } };
  }

  return {
    business: scope.businessId,
    $or: [
      { location: { $in: scope.locationIds } },
      { locationScope: { $in: scope.locationIds } },
    ],
  };
}

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

async function loadDataset(dataset, { months = 12, scope }) {
  const selectedMonths = clampInteger(months, 1, 60, 12);
  const now = new Date();
  const startDate = addUtcMonths(startOfUtcMonth(now), -(selectedMonths - 1));

  if (dataset === "appointments") {
    const records = await Appointment.find({
      ...locationMatch(scope),
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
    assertBusinessWideDatasetScope(dataset, scope);
    const records = await RebookingCampaign.find({
      ...businessMatch(scope),
      createdAt: { $gte: startDate },
    })
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
    const records = await InventoryItem.find(locationMatch(scope))
      .sort({ name: 1 })
      .lean();
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
    const records = await CustomerFeedback.find({
      ...locationMatch(scope),
      createdAt: { $gte: startDate },
    })
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

async function createDatasetExport({
  dataset,
  format = "csv",
  months = 12,
  actor,
  authority,
}) {
  const scope = trustedDataExportScope(authority);
  const selectedFormat = format === "json" ? "json" : "csv";
  const records = await loadDataset(dataset, { months, scope });

  await FutureAuditEvent.create({
    ...auditOwnership(scope),
    action: "dataset_export",
    dataset,
    format: selectedFormat,
    recordCount: records.length,
    actor,
    metadata: {
      months: clampInteger(months, 1, 60, 12),
      scopeMode: scope.scopeMode,
    },
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

async function listAuditEvents({ page = 1, limit = 50, dataset } = {}, authority) {
  const scope = trustedDataExportScope(authority);
  const selectedPage = clampInteger(page, 1, 100000, 1);
  const selectedLimit = clampInteger(limit, 1, 200, 50);
  const query = {
    ...auditMatch(scope),
    ...(dataset ? { dataset } : {}),
  };

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
