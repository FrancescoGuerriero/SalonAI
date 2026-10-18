import ExcelJS from "exceljs";

import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import Campaign from "../campaigns/Campaign.js";
import { dateRange } from "../../shared/dateUtils.js";

function idText(value) {
  const candidate = value && typeof value === "object" && "_id" in value
    ? value._id
    : value;
  return String(candidate || "").trim();
}

export function trustedReportScope(authority) {
  const businessId = idText(authority?.businessId);
  if (!businessId) {
    const error = new Error("Trusted tenant authority is required for reports.");
    error.statusCode = 401;
    error.code = "REPORT_TENANT_AUTHORITY_REQUIRED";
    throw error;
  }

  if (authority?.locationAccessMode === "all") {
    return Object.freeze({ businessId, locationIds: null });
  }

  const locationIds = [
    ...new Set((authority?.allowedLocationIds || []).map(idText).filter(Boolean)),
  ];

  return Object.freeze({ businessId, locationIds: Object.freeze(locationIds) });
}

function businessMatch(scope) {
  return { business: scope.businessId };
}

function locationMatch(scope, locationField = "location") {
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

function customerName(customer = {}) {
  return (
    customer.fullName ||
    customer.name ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ")
  );
}

function stylistName(stylist = {}) {
  return (
    stylist.name ||
    stylist.fullName ||
    [stylist.firstName, stylist.lastName].filter(Boolean).join(" ")
  );
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function appointmentRows(filters = {}, authority) {
  const scope = trustedReportScope(authority);
  const match = locationMatch(scope);
  const range = dateRange(filters.startDate, filters.endDate);

  if (range) match.appointmentDate = range;
  if (filters.status) match.status = filters.status;

  return Appointment.find(match)
    .populate("customer", "firstName lastName fullName name email")
    .populate("service", "name price duration")
    .populate("stylist", "name firstName lastName email")
    .sort({ appointmentDate: 1, appointmentTime: 1 })
    .lean();
}

export async function appointmentsCsv(filters, authority) {
  const items = await appointmentRows(filters, authority);
  return toCsv([
    ["Date", "Time", "Customer", "Email", "Service", "Stylist", "Status", "Value"],
    ...items.map((item) => [
      item.appointmentDate,
      item.appointmentTime,
      customerName(item.customer),
      item.customer?.email,
      item.service?.name,
      stylistName(item.stylist),
      item.status,
      item.totalPrice || item.price || item.service?.price || 0,
    ]),
  ]);
}

export async function communicationsCsv(filters = {}, authority) {
  const scope = trustedReportScope(authority);
  const match = locationMatch(scope);
  const range = dateRange(filters.startDate, filters.endDate);
  if (range) match.createdAt = range;

  const items = await CustomerContactLog.find(match)
    .populate("customer", "firstName lastName fullName name email")
    .sort({ createdAt: -1 })
    .lean();

  return toCsv([
    ["Created", "Customer", "Channel", "Campaign Type", "Status", "Recipient", "Subject", "Message"],
    ...items.map((item) => [
      item.createdAt,
      customerName(item.customer),
      item.channel,
      item.campaignType,
      item.status,
      item.recipient,
      item.subject,
      item.message,
    ]),
  ]);
}

export async function reportSummary(filters = {}, authority) {
  const scope = trustedReportScope(authority);
  const appointmentMatch = locationMatch(scope);
  const contactMatch = locationMatch(scope);
  const campaignMatch = businessMatch(scope);
  const customerMatch = businessMatch(scope);
  const range = dateRange(filters.startDate, filters.endDate);

  if (range) {
    appointmentMatch.appointmentDate = range;
    contactMatch.createdAt = range;
    campaignMatch.createdAt = range;
  }

  const [customers, appointments, contacts, campaigns, revenueRows] = await Promise.all([
    Customer.countDocuments(customerMatch),
    Appointment.countDocuments(appointmentMatch),
    CustomerContactLog.countDocuments(contactMatch),
    Campaign.countDocuments(campaignMatch),
    Appointment.aggregate([
      { $match: { ...appointmentMatch, status: "completed" } },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: {
              $ifNull: ["$totalPrice", { $ifNull: ["$price", 0] }],
            },
          },
        },
      },
    ]),
  ]);

  return {
    customers,
    appointments,
    contacts,
    campaigns,
    revenue: revenueRows[0]?.revenue || 0,
    generatedAt: new Date(),
  };
}

export async function managementWorkbook(filters, authority) {
  const [appointments, summary] = await Promise.all([
    appointmentRows(filters, authority),
    reportSummary(filters, authority),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SalonAI";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 20 },
  ];
  for (const [metric, value] of Object.entries(summary)) {
    summarySheet.addRow({ metric, value });
  }

  const appointmentSheet = workbook.addWorksheet("Appointments");
  appointmentSheet.columns = [
    { header: "Date", key: "date", width: 16 },
    { header: "Time", key: "time", width: 12 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Service", key: "service", width: 24 },
    { header: "Stylist", key: "stylist", width: 24 },
    { header: "Status", key: "status", width: 16 },
    { header: "Value", key: "value", width: 14 },
  ];

  for (const item of appointments) {
    appointmentSheet.addRow({
      date: item.appointmentDate,
      time: item.appointmentTime,
      customer: customerName(item.customer),
      service: item.service?.name,
      stylist: stylistName(item.stylist),
      status: item.status,
      value: item.totalPrice || item.price || item.service?.price || 0,
    });
  }

  return workbook.xlsx.writeBuffer();
}
