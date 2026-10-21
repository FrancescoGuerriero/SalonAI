import mongoose from "mongoose";

import Appointment from "../../models/Appointment.js";
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
  createManagedAppointment,
} from "../appointments/appointmentManagementService.js";
import ConsultationSession from "./ConsultationSession.js";
import {
  buildConsultationMutationScope,
  consultationObjectId,
} from "./consultationSessionAuthorityService.js";

function bookingError(message, code, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = statusCode;
  error.statusCode = statusCode;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return String(candidate || "").trim();
}

function assertObjectId(value, field) {
  const candidate = text(value);
  if (!mongoose.isValidObjectId(candidate)) {
    throw bookingError(
      `${field} must be a valid identifier.`,
      "INVALID_CONSULTATION_BOOKING_INPUT",
      400
    );
  }
  return candidate;
}

function assertBookingReady(consultation) {
  if (consultation?.status !== "booking_ready") {
    throw bookingError(
      "The consultation must be approved for booking before an appointment can be created.",
      "CONSULTATION_NOT_BOOKING_READY"
    );
  }
  if (consultation?.deterministicAssessment?.bookingBlocked === true) {
    throw bookingError(
      "Deterministic consultation rules currently block booking conversion.",
      "CONSULTATION_BOOKING_BLOCKED"
    );
  }
  if (!consultation?.review?.reviewedAt || consultation?.review?.decision !== "approved") {
    throw bookingError(
      "A recorded human approval is required before booking conversion.",
      "CONSULTATION_HUMAN_APPROVAL_REQUIRED"
    );
  }
}

function appointmentStartInput(payload = {}) {
  const startsAt = text(payload.startsAt);
  const appointmentDate = text(payload.appointmentDate);
  const appointmentTime = text(payload.appointmentTime);

  if (!startsAt && (!appointmentDate || !appointmentTime)) {
    throw bookingError(
      "A booking date and time are required.",
      "CONSULTATION_BOOKING_TIME_REQUIRED",
      400
    );
  }

  return {
    ...(startsAt ? { startsAt } : {}),
    ...(!startsAt ? { appointmentDate, appointmentTime } : {}),
  };
}

function bookingPrice(payload, effectiveService) {
  if (effectiveService.priceOnConsultation === true) {
    const supplied = Number(payload?.totalPrice);
    if (!Number.isFinite(supplied) || supplied < 0) {
      throw bookingError(
        "An agreed non-negative price is required for a price-on-consultation service.",
        "CONSULTATION_BOOKING_PRICE_REQUIRED",
        400
      );
    }
    return supplied;
  }

  const price = Number(effectiveService.price);
  if (!Number.isFinite(price) || price < 0) {
    throw bookingError(
      "The selected service does not have a valid booking price.",
      "CONSULTATION_BOOKING_PRICE_INVALID"
    );
  }
  return price;
}

export function buildConsultationAppointmentInput({
  consultation,
  payload = {},
  effectiveService,
} = {}) {
  assertBookingReady(consultation);

  const service = assertObjectId(
    payload.serviceId || consultation?.outcome?.recommendedService,
    "serviceId"
  );
  const stylist = assertObjectId(
    payload.stylistId || consultation?.outcome?.recommendedStylist,
    "stylistId"
  );
  const duration = Number(effectiveService?.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw bookingError(
      "The selected service does not have a valid duration.",
      "CONSULTATION_BOOKING_DURATION_INVALID"
    );
  }

  return Object.freeze({
    customer: idText(consultation.customer),
    service,
    stylist,
    ...appointmentStartInput(payload),
    duration,
    totalPrice: bookingPrice(payload, effectiveService),
    status: "confirmed",
    notes:
      text(payload.notes).slice(0, 1000) ||
      "Appointment created from an approved consultation.",
  });
}

async function loadBookingResources({
  consultation,
  serviceId,
  stylistId,
  databaseSession,
}) {
  const businessId = idText(consultation.business);
  const locationId = idText(consultation.location);

  const [service, offering, stylist] = await Promise.all([
    Service.findOne({
      _id: serviceId,
      business: consultation.business,
    })
      .select("+onlineBookable")
      .session(databaseSession)
      .lean(),
    LocationServiceOffering.findOne({
      business: consultation.business,
      location: consultation.location,
      service: serviceId,
    })
      .session(databaseSession)
      .lean(),
    Stylist.findOne({
      _id: stylistId,
      business: consultation.business,
      workingLocations: consultation.location,
      ...appointmentEligibleStylistFilter(),
    }).session(databaseSession),
  ]);

  if (!service) {
    throw bookingError(
      "The selected service was not found in this Business.",
      "CONSULTATION_SERVICE_NOT_FOUND",
      404
    );
  }

  const effectiveService = resolveEffectiveServiceConfiguration({
    service,
    offering,
    businessId,
    locationId,
    capabilityAvailable: true,
  });

  if (!effectiveService.available || !effectiveService.bookable) {
    throw bookingError(
      "The selected service is not bookable at this Location.",
      "CONSULTATION_SERVICE_NOT_BOOKABLE"
    );
  }

  if (!stylist) {
    throw bookingError(
      "The selected stylist was not found or is not bookable at this Location.",
      "CONSULTATION_STYLIST_NOT_FOUND",
      404
    );
  }

  if (!stylistOffersService(stylist, service._id)) {
    throw bookingError(
      "The selected stylist does not offer this service.",
      "CONSULTATION_STYLIST_SERVICE_MISMATCH"
    );
  }

  return {
    service,
    stylist,
    effectiveService,
  };
}

function appointmentMatchesConsultation(appointment, consultation) {
  return Boolean(
    appointment &&
      idText(appointment.customer) === idText(consultation.customer) &&
      idText(appointment.business) === idText(consultation.business) &&
      idText(appointment.location) === idText(consultation.location)
  );
}

function recommendationAcceptance(consultation, serviceId, stylistId) {
  const recommendedService = idText(consultation?.outcome?.recommendedService);
  const recommendedStylist = idText(consultation?.outcome?.recommendedStylist);

  if (!recommendedService && !recommendedStylist) {
    return null;
  }

  return (
    (!recommendedService || recommendedService === idText(serviceId)) &&
    (!recommendedStylist || recommendedStylist === idText(stylistId))
  );
}

function applyBookingOutcome(consultation, appointment, serviceId, stylistId, now) {
  if (!consultation.appointment) {
    consultation.appointment = appointment._id;
  }

  const acceptedRecommendation = recommendationAcceptance(
    consultation,
    serviceId,
    stylistId
  );

  consultation.status = "booked";
  consultation.outcome.finalDecision = "booked";
  consultation.outcome.resultingAppointment = appointment._id;
  consultation.outcome.bookingConverted = true;
  consultation.outcome.customerAcceptedRecommendation = acceptedRecommendation;
  consultation.outcome.observedAt = now;
  if (consultation.learning?.labelState === "unlabelled") {
    consultation.learning.labelState = "partial";
  }
  consultation.learning.labelledAt = now;
}

export async function convertConsultationToBooking(
  consultationId,
  payload = {},
  request
) {
  const databaseSession = await mongoose.startSession();
  let result = null;

  try {
    await databaseSession.withTransaction(async () => {
      const _id = consultationObjectId(consultationId, "consultationId");
      const scope = buildConsultationMutationScope(request.effectiveAuthority);
      const consultation = await ConsultationSession.findOne({
        _id,
        ...scope,
      }).session(databaseSession);

      if (!consultation) {
        throw bookingError(
          "The requested consultation was not found.",
          "RESOURCE_NOT_FOUND",
          404
        );
      }

      if (
        consultation.outcome?.bookingConverted === true &&
        consultation.outcome?.resultingAppointment
      ) {
        const appointment = await Appointment.findOne({
          _id: consultation.outcome.resultingAppointment,
          business: consultation.business,
          location: consultation.location,
          customer: consultation.customer,
        }).session(databaseSession);

        if (!appointment) {
          throw bookingError(
            "The consultation booking link is inconsistent and requires staff review.",
            "CONSULTATION_BOOKING_LINK_BROKEN"
          );
        }

        result = {
          consultation: consultation.toObject({ virtuals: true }),
          appointment: appointment.toObject({ virtuals: true }),
          duplicate: true,
        };
        return;
      }

      assertBookingReady(consultation);

      const serviceId = assertObjectId(
        payload.serviceId || consultation.outcome?.recommendedService,
        "serviceId"
      );
      const stylistId = assertObjectId(
        payload.stylistId || consultation.outcome?.recommendedStylist,
        "stylistId"
      );
      const externalBookingReference = `consultation:${consultation._id}`;

      const existing = await Appointment.findOne({
        externalBookingReference,
      }).session(databaseSession);

      if (existing) {
        if (!appointmentMatchesConsultation(existing, consultation)) {
          throw bookingError(
            "The consultation booking reference is already in use by another scoped appointment.",
            "CONSULTATION_BOOKING_REFERENCE_CONFLICT"
          );
        }

        const now = new Date();
        applyBookingOutcome(consultation, existing, serviceId, stylistId, now);
        await consultation.save({ session: databaseSession });
        result = {
          consultation: consultation.toObject({ virtuals: true }),
          appointment: existing.toObject({ virtuals: true }),
          duplicate: true,
        };
        return;
      }

      const resources = await loadBookingResources({
        consultation,
        serviceId,
        stylistId,
        databaseSession,
      });
      const appointmentInput = buildConsultationAppointmentInput({
        consultation,
        payload: {
          ...payload,
          serviceId,
          stylistId,
        },
        effectiveService: resources.effectiveService,
      });

      const appointment = await createManagedAppointment(appointmentInput, {
        actor: request.user,
        session: databaseSession,
        bookingSource: "consultation",
        externalBookingReference,
        returnPopulated: false,
      });

      appointment.business = consultation.business;
      appointment.location = consultation.location;
      await appointment.save({ session: databaseSession });

      const now = new Date();
      applyBookingOutcome(consultation, appointment, serviceId, stylistId, now);
      await consultation.save({ session: databaseSession });

      result = {
        consultation: consultation.toObject({ virtuals: true }),
        appointment: appointment.toObject({ virtuals: true }),
        duplicate: false,
      };
    });

    return result;
  } finally {
    await databaseSession.endSession();
  }
}

export default {
  buildConsultationAppointmentInput,
  convertConsultationToBooking,
};
