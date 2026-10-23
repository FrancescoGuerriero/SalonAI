import { createServiceError } from "../../shared/serviceError.js";
import {
  getGrowthAttributionSummary,
  getLeadRevenueAttribution,
  linkLeadToAppointment,
  reconcileLeadBookingAttribution,
} from "./growthAttributionService.js";

function businessId(request) {
  const value = request.effectiveAuthority?.businessId || request.tenantContext?.businessId || null;
  if (!value) {
    throw createServiceError("A trusted active business is required for growth attribution.", 400);
  }
  return value;
}

function actorUser(request) {
  return request.user?._id || request.user?.id || null;
}

function body(request) {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body
    : {};
}

export async function summary(request, response) {
  response.json(await getGrowthAttributionSummary(request.query || {}, {
    businessId: businessId(request),
  }));
}

export async function leadAttribution(request, response) {
  response.json(await getLeadRevenueAttribution(request.params.leadId, {
    businessId: businessId(request),
  }));
}

export async function linkAppointment(request, response) {
  response.status(201).json(await linkLeadToAppointment(
    request.params.leadId,
    request.params.appointmentId,
    body(request),
    {
      businessId: businessId(request),
      actorUser: actorUser(request),
      method: "explicit",
    }
  ));
}

export async function reconcile(request, response) {
  response.status(201).json(await reconcileLeadBookingAttribution(
    request.params.leadId,
    body(request),
    {
      businessId: businessId(request),
      actorUser: actorUser(request),
    }
  ));
}

export default {
  leadAttribution,
  linkAppointment,
  reconcile,
  summary,
};
