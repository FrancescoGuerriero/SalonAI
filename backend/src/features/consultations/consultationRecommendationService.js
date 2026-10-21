import mongoose from "mongoose";

import LocationServiceOffering from "../../models/LocationServiceOffering.js";
import Service from "../../models/service.js";
import Stylist from "../../models/Stylist.js";
import {
  resolveEffectiveServiceConfiguration,
} from "../../platform/services/effectiveServiceConfiguration.js";
import {
  stylistOffersService,
} from "../../services/bookingAvailabilityService.js";
import {
  appointmentEligibleStylistFilter,
} from "../../services/stylistBookingEligibilityService.js";
import {
  findScopedConsultation,
} from "./consultationSessionAuthorityService.js";

const RECOMMENDABLE_STATUSES = new Set([
  "awaiting_review",
  "in_person_required",
  "approved",
  "booking_ready",
]);

function recommendationError(message, code, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = statusCode;
  error.statusCode = statusCode;
  return error;
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return String(candidate ?? "").trim();
}

function optionalObjectId(value, field) {
  const candidate = idText(value);
  if (!candidate) return null;
  if (!mongoose.isValidObjectId(candidate)) {
    throw recommendationError(
      `${field} must be a valid identifier.`,
      "INVALID_CONSULTATION_RECOMMENDATION",
      400
    );
  }
  return candidate;
}

export function normaliseConsultationRecommendation(payload = {}) {
  const hasService = Object.prototype.hasOwnProperty.call(
    payload,
    "recommendedServiceId"
  );
  const hasStylist = Object.prototype.hasOwnProperty.call(
    payload,
    "recommendedStylistId"
  );

  if (!hasService && !hasStylist) {
    throw recommendationError(
      "A service or stylist recommendation is required.",
      "CONSULTATION_RECOMMENDATION_REQUIRED",
      400
    );
  }

  return Object.freeze({
    hasService,
    hasStylist,
    serviceId: hasService
      ? optionalObjectId(payload.recommendedServiceId, "recommendedServiceId")
      : undefined,
    stylistId: hasStylist
      ? optionalObjectId(payload.recommendedStylistId, "recommendedStylistId")
      : undefined,
  });
}

async function validateService(session, serviceId) {
  if (!serviceId) return null;

  const [service, offering] = await Promise.all([
    Service.findOne({
      _id: serviceId,
      business: session.business,
    })
      .select("+onlineBookable")
      .lean(),
    LocationServiceOffering.findOne({
      business: session.business,
      location: session.location,
      service: serviceId,
    }).lean(),
  ]);

  if (!service) {
    throw recommendationError(
      "The recommended service was not found in this Business.",
      "CONSULTATION_RECOMMENDED_SERVICE_NOT_FOUND",
      404
    );
  }

  const effective = resolveEffectiveServiceConfiguration({
    service,
    offering,
    businessId: session.business,
    locationId: session.location,
    capabilityAvailable: true,
  });

  if (!effective.available) {
    throw recommendationError(
      "The recommended service is not available at this Location.",
      "CONSULTATION_RECOMMENDED_SERVICE_UNAVAILABLE"
    );
  }

  return service;
}

async function validateStylist(session, stylistId, serviceId) {
  if (!stylistId) return null;
  if (!serviceId) {
    throw recommendationError(
      "A service recommendation is required before recommending a stylist.",
      "CONSULTATION_RECOMMENDED_SERVICE_REQUIRED",
      400
    );
  }

  const stylist = await Stylist.findOne({
    _id: stylistId,
    business: session.business,
    workingLocations: session.location,
    ...appointmentEligibleStylistFilter(),
  });

  if (!stylist) {
    throw recommendationError(
      "The recommended stylist was not found or is not bookable at this Location.",
      "CONSULTATION_RECOMMENDED_STYLIST_NOT_FOUND",
      404
    );
  }

  if (!stylistOffersService(stylist, serviceId)) {
    throw recommendationError(
      "The recommended stylist does not offer the recommended service.",
      "CONSULTATION_RECOMMENDED_STYLIST_SERVICE_MISMATCH"
    );
  }

  return stylist;
}

export async function setConsultationRecommendation(
  consultationId,
  payload = {},
  request
) {
  const session = await findScopedConsultation(
    consultationId,
    request.effectiveAuthority,
    { mutation: true }
  );

  if (!RECOMMENDABLE_STATUSES.has(session.status)) {
    throw recommendationError(
      "Recommendations can only be changed during authorised human review or booking readiness.",
      "CONSULTATION_RECOMMENDATION_STATE_INVALID"
    );
  }

  if (session.outcome?.bookingConverted === true) {
    throw recommendationError(
      "Recommendations cannot be changed after booking conversion.",
      "CONSULTATION_RECOMMENDATION_ALREADY_CONVERTED"
    );
  }

  const input = normaliseConsultationRecommendation(payload);
  const serviceId = input.hasService
    ? input.serviceId
    : idText(session.outcome?.recommendedService) || null;

  if (input.hasService) {
    await validateService(session, serviceId);
  } else if (serviceId) {
    await validateService(session, serviceId);
  }

  const stylistId = input.hasStylist
    ? input.stylistId
    : input.hasService && serviceId !== idText(session.outcome?.recommendedService)
      ? null
      : idText(session.outcome?.recommendedStylist) || null;

  if (stylistId) {
    await validateStylist(session, stylistId, serviceId);
  }

  if (input.hasService) {
    session.outcome.recommendedService = serviceId;
  }
  if (input.hasStylist || (input.hasService && !stylistId)) {
    session.outcome.recommendedStylist = stylistId;
  }

  session.learning.labelState = "partial";
  session.learning.labelledAt = new Date();
  await session.save();

  return session;
}

export default {
  normaliseConsultationRecommendation,
  setConsultationRecommendation,
};
