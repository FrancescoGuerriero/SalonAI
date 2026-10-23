import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
import GrowthAttribution from "../../models/GrowthAttribution.js";
import Lead from "../../models/Lead.js";
import LeadTimelineEvent from "../../models/LeadTimelineEvent.js";
import Opportunity from "../../models/Opportunity.js";
import Payment from "../commerce/Payment.js";
import { createServiceError } from "../../shared/serviceError.js";
import { recordDomainEvent } from "../integrationPlatform/webhookProjectionService.js";
import { acquisitionSnapshotFromLead } from "./leadSourceMappingService.js";

const PAID_PAYMENT_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function objectId(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return null;
  if (!mongoose.isValidObjectId(value)) {
    throw createServiceError(`${field} must be a valid identifier.`, 400, { field });
  }
  return value;
}

function actorId(value) {
  const candidate = value?._id || value?.id || value;
  return mongoose.isValidObjectId(candidate) ? candidate : null;
}

function appointmentStart(appointment) {
  const candidate = appointment?.startsAt || appointment?.appointmentDate || null;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function paymentAmounts(payment) {
  const gross = PAID_PAYMENT_STATUSES.has(payment.status)
    ? Math.max(0, Number(payment.amount) || 0)
    : 0;
  const refunds = Math.max(0, Number(payment.refundedAmount) || 0);
  return {
    gross: roundCurrency(gross),
    refunds: roundCurrency(Math.min(gross, refunds)),
    net: roundCurrency(Math.max(0, gross - refunds)),
  };
}

async function leadForBusiness(leadId, businessId) {
  objectId(leadId, "lead");
  objectId(businessId, "business");
  const lead = await Lead.findOne({ _id: leadId, business: businessId });
  if (!lead) throw createServiceError("Lead not found.", 404);
  return lead;
}

async function appointmentForLead(appointmentId, lead, businessId) {
  objectId(appointmentId, "appointment");
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw createServiceError("Appointment not found.", 404);
  if (!lead.customer) {
    throw createServiceError("Lead must be converted or linked to a canonical customer before booking attribution.", 409, {
      code: "LEAD_CUSTOMER_REQUIRED_FOR_ATTRIBUTION",
    });
  }
  if (String(appointment.customer) !== String(lead.customer)) {
    throw createServiceError("Appointment customer does not match the lead's canonical customer.", 409, {
      code: "LEAD_APPOINTMENT_CUSTOMER_MISMATCH",
    });
  }
  if (appointment.business && String(appointment.business) !== String(businessId)) {
    throw createServiceError("Appointment belongs to another business.", 409, {
      code: "LEAD_APPOINTMENT_TENANT_MISMATCH",
    });
  }
  return appointment;
}

async function opportunityForAttribution(opportunityId, lead, businessId, appointment) {
  if (!opportunityId) return null;
  objectId(opportunityId, "opportunity");
  const opportunity = await Opportunity.findOne({
    _id: opportunityId,
    business: businessId,
    lead: lead._id,
  });
  if (!opportunity) throw createServiceError("Opportunity not found for this lead.", 404);
  if (opportunity.customer && String(opportunity.customer) !== String(lead.customer)) {
    throw createServiceError("Opportunity customer does not match the lead customer.", 409);
  }
  if (opportunity.service && String(opportunity.service) !== String(appointment.service)) {
    throw createServiceError("Opportunity service does not match the attributed appointment.", 409, {
      code: "ATTRIBUTION_OPPORTUNITY_SERVICE_MISMATCH",
    });
  }
  return opportunity;
}

async function defaultOpportunity(lead, businessId, appointment) {
  const match = {
    business: businessId,
    lead: lead._id,
    status: { $ne: "lost" },
  };
  if (appointment.service) {
    match.$or = [
      { service: appointment.service },
      { service: null },
    ];
  }
  return Opportunity.findOne(match).sort({ createdAt: -1, _id: -1 });
}

async function appendAttributionTimeline({ businessId, lead, opportunity, appointment, attribution, actorUser }) {
  await LeadTimelineEvent.create({
    business: businessId,
    lead: lead._id,
    opportunity: opportunity?._id || null,
    type: "booking_attributed",
    channel: attribution.source?.channel || "",
    summary: `Booking ${String(appointment._id)} attributed to lead acquisition source ${attribution.source?.channel || "other"}.`,
    actorUser: actorId(actorUser),
    occurredAt: new Date(),
    metadata: {
      attributionId: String(attribution._id),
      appointmentId: String(appointment._id),
      opportunityId: opportunity?._id ? String(opportunity._id) : "",
      source: attribution.source,
      method: attribution.method,
    },
  });
}

async function emitBookingAttributionEvent({ businessId, lead, attribution, appointment, opportunity }) {
  await recordDomainEvent({
    businessId: String(businessId),
    type: "lead.booking_attributed",
    version: "1",
    aggregateType: "lead",
    aggregateId: String(lead._id),
    payload: {
      leadId: String(lead._id),
      customerId: String(lead.customer),
      appointmentId: String(appointment._id),
      opportunityId: opportunity?._id ? String(opportunity._id) : "",
      attributionId: String(attribution._id),
      sourceChannel: attribution.source?.channel || "other",
      sourceSystem: attribution.source?.system || "",
      sourceCampaign: attribution.source?.campaign || "",
    },
    source: "growth-attribution",
  });
}

export async function linkLeadToAppointment(
  leadId,
  appointmentId,
  payload = {},
  { businessId, actorUser = null, method = "explicit" } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  const appointment = await appointmentForLead(appointmentId, lead, businessId);
  const existing = await GrowthAttribution.findOne({ business: businessId, appointment: appointment._id });
  if (existing) {
    if (String(existing.lead) !== String(lead._id)) {
      throw createServiceError("Appointment already has a different lead attribution.", 409, {
        code: "BOOKING_ATTRIBUTION_CONFLICT",
        attributionId: String(existing._id),
      });
    }
    return { attribution: existing.toObject(), created: false };
  }

  let opportunity = await opportunityForAttribution(
    payload.opportunity,
    lead,
    businessId,
    appointment
  );
  if (!opportunity) opportunity = await defaultOpportunity(lead, businessId, appointment);

  const attribution = await GrowthAttribution.create({
    business: businessId,
    lead: lead._id,
    opportunity: opportunity?._id || null,
    customer: lead.customer,
    appointment: appointment._id,
    method,
    source: acquisitionSnapshotFromLead(lead),
    linkedAt: new Date(),
    leadCapturedAt: lead.createdAt || null,
    leadConvertedAt: lead.convertedAt || null,
    appointmentStartsAt: appointmentStart(appointment),
    createdBy: actorId(actorUser),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  });

  await appendAttributionTimeline({
    businessId,
    lead,
    opportunity,
    appointment,
    attribution,
    actorUser,
  });
  await emitBookingAttributionEvent({ businessId, lead, attribution, appointment, opportunity });

  return { attribution: attribution.toObject(), created: true };
}

export async function reconcileLeadBookingAttribution(
  leadId,
  payload = {},
  { businessId, actorUser = null } = {}
) {
  const lead = await leadForBusiness(leadId, businessId);
  if (!lead.customer) {
    throw createServiceError("Lead must be converted before booking attribution reconciliation.", 409);
  }

  const lookbackDays = Math.max(1, Math.min(365, Number(payload.lookbackDays) || 30));
  const start = lead.createdAt ? new Date(lead.createdAt) : new Date(Date.now() - lookbackDays * 86400000);
  const maximumEnd = new Date(start.getTime() + lookbackDays * 86400000);
  const end = maximumEnd > new Date() ? new Date() : maximumEnd;
  const appointments = await Appointment.find({
    customer: lead.customer,
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ["cancelled", "no_show"] },
    $or: [
      { business: businessId },
      { business: { $exists: false } },
      { business: null },
    ],
  }).sort({ createdAt: 1, _id: 1 }).limit(50);

  const links = [];
  for (const appointment of appointments) {
    const result = await linkLeadToAppointment(
      lead._id,
      appointment._id,
      { metadata: { reconciled: true, lookbackDays } },
      { businessId, actorUser, method: "post_conversion_reconcile" }
    );
    links.push(result);
    if (payload.firstOnly !== false && result.created) break;
  }

  return {
    leadId: String(lead._id),
    customerId: String(lead.customer),
    window: { start, end, lookbackDays },
    candidates: appointments.length,
    created: links.filter((entry) => entry.created).length,
    links,
  };
}

async function paymentEvidenceForAttributions(attributions) {
  const appointmentIds = attributions.map((item) => item.appointment).filter(Boolean);
  const payments = appointmentIds.length
    ? await Payment.find({ appointment: { $in: appointmentIds } }).lean()
    : [];
  const paymentsByAppointment = new Map();
  for (const payment of payments) {
    const key = String(payment.appointment || "");
    const list = paymentsByAppointment.get(key) || [];
    list.push(payment);
    paymentsByAppointment.set(key, list);
  }

  return attributions.map((attribution) => {
    const appointmentPayments = paymentsByAppointment.get(String(attribution.appointment)) || [];
    let grossRevenue = 0;
    let refundedRevenue = 0;
    let netRevenue = 0;
    for (const payment of appointmentPayments) {
      const amounts = paymentAmounts(payment);
      grossRevenue += amounts.gross;
      refundedRevenue += amounts.refunds;
      netRevenue += amounts.net;
    }
    return {
      attribution,
      payments: appointmentPayments,
      revenue: {
        gross: roundCurrency(grossRevenue),
        refunds: roundCurrency(refundedRevenue),
        net: roundCurrency(netRevenue),
        currency: appointmentPayments.find((payment) => payment.currency)?.currency || "GBP",
      },
    };
  });
}

export async function getLeadRevenueAttribution(leadId, { businessId } = {}) {
  const lead = await leadForBusiness(leadId, businessId);
  const attributions = await GrowthAttribution.find({ business: businessId, lead: lead._id })
    .populate("opportunity", "title stage status estimatedValue currency")
    .populate("appointment", "startsAt appointmentDate status totalPrice finalPrice bookingSource service stylist")
    .sort({ appointmentStartsAt: 1, createdAt: 1 })
    .lean();
  const evidence = await paymentEvidenceForAttributions(attributions);
  const summary = evidence.reduce((accumulator, entry) => {
    accumulator.grossRevenue += entry.revenue.gross;
    accumulator.refunds += entry.revenue.refunds;
    accumulator.netRevenue += entry.revenue.net;
    accumulator.paymentCount += entry.payments.length;
    return accumulator;
  }, { grossRevenue: 0, refunds: 0, netRevenue: 0, paymentCount: 0 });

  return {
    lead: {
      _id: lead._id,
      customer: lead.customer,
      status: lead.status,
      source: lead.source,
      acquisition: lead.metadata?.acquisition || {},
      convertedAt: lead.convertedAt,
    },
    bookings: evidence,
    summary: {
      bookingCount: evidence.length,
      paymentCount: summary.paymentCount,
      grossRevenue: roundCurrency(summary.grossRevenue),
      refunds: roundCurrency(summary.refunds),
      netRevenue: roundCurrency(summary.netRevenue),
      currency: evidence.find((entry) => entry.revenue.currency)?.revenue.currency || "GBP",
    },
  };
}

export async function getGrowthAttributionSummary(query = {}, { businessId } = {}) {
  objectId(businessId, "business");
  const match = { business: businessId };
  if (query.channel) match["source.channel"] = text(query.channel, 80).toLowerCase();
  if (query.campaign) match["source.campaign"] = text(query.campaign, 180);
  if (query.from || query.to) {
    match.appointmentStartsAt = {};
    if (query.from) {
      const from = new Date(query.from);
      if (Number.isNaN(from.getTime())) throw createServiceError("from must be a valid date.", 400);
      match.appointmentStartsAt.$gte = from;
    }
    if (query.to) {
      const to = new Date(query.to);
      if (Number.isNaN(to.getTime())) throw createServiceError("to must be a valid date.", 400);
      match.appointmentStartsAt.$lte = to;
    }
  }

  const attributions = await GrowthAttribution.find(match)
    .populate("lead", "status convertedAt currentScore scoreBand")
    .populate("appointment", "startsAt status totalPrice finalPrice bookingSource")
    .sort({ appointmentStartsAt: -1, createdAt: -1 })
    .limit(1000)
    .lean();
  const evidence = await paymentEvidenceForAttributions(attributions);

  const groups = new Map();
  for (const entry of evidence) {
    const source = entry.attribution.source || {};
    const key = `${source.channel || "other"}::${source.system || ""}::${source.campaign || ""}`;
    const group = groups.get(key) || {
      channel: source.channel || "other",
      system: source.system || "",
      campaign: source.campaign || "",
      bookings: 0,
      paidBookings: 0,
      grossRevenue: 0,
      refunds: 0,
      netRevenue: 0,
    };
    group.bookings += 1;
    if (entry.revenue.gross > 0) group.paidBookings += 1;
    group.grossRevenue += entry.revenue.gross;
    group.refunds += entry.revenue.refunds;
    group.netRevenue += entry.revenue.net;
    groups.set(key, group);
  }

  const items = [...groups.values()]
    .map((group) => ({
      ...group,
      bookingToPaymentRate: group.bookings > 0
        ? Math.round((group.paidBookings / group.bookings) * 10000) / 100
        : 0,
      grossRevenue: roundCurrency(group.grossRevenue),
      refunds: roundCurrency(group.refunds),
      netRevenue: roundCurrency(group.netRevenue),
      currency: "GBP",
    }))
    .sort((left, right) => right.netRevenue - left.netRevenue || right.bookings - left.bookings);

  return {
    filters: {
      channel: query.channel || "",
      campaign: query.campaign || "",
      from: query.from || "",
      to: query.to || "",
    },
    totals: {
      attributedBookings: evidence.length,
      paidBookings: evidence.filter((entry) => entry.revenue.gross > 0).length,
      netRevenue: roundCurrency(evidence.reduce((sum, entry) => sum + entry.revenue.net, 0)),
      refunds: roundCurrency(evidence.reduce((sum, entry) => sum + entry.revenue.refunds, 0)),
      currency: "GBP",
    },
    items,
  };
}

export default {
  getGrowthAttributionSummary,
  getLeadRevenueAttribution,
  linkLeadToAppointment,
  reconcileLeadBookingAttribution,
};
