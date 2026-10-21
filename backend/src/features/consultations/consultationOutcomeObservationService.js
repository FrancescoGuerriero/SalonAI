import ConsultationSession from "./ConsultationSession.js";

const TERMINAL_APPOINTMENT_STATUSES = new Set([
  "completed",
  "cancelled",
  "no_show",
]);

function text(value) {
  return String(value ?? "").trim();
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return text(candidate);
}

function observedAtForAppointment(appointment, status) {
  const value =
    status === "completed"
      ? appointment?.completedAt
      : status === "cancelled"
        ? appointment?.cancelledAt
        : appointment?.noShowAt;

  const date = new Date(value || appointment?.updatedAt || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function recommendationAcceptance(appointment, consultation) {
  const recommendedService = idText(consultation?.outcome?.recommendedService);
  const recommendedStylist = idText(consultation?.outcome?.recommendedStylist);

  if (!recommendedService && !recommendedStylist) {
    return null;
  }

  const serviceAccepted =
    !recommendedService || recommendedService === idText(appointment?.service);
  const stylistAccepted =
    !recommendedStylist || recommendedStylist === idText(appointment?.stylist);

  return serviceAccepted && stylistAccepted;
}

export function buildConsultationOutcomeObservation(
  appointment,
  consultation = {}
) {
  const status = text(appointment?.status).toLowerCase();
  if (!TERMINAL_APPOINTMENT_STATUSES.has(status)) {
    return null;
  }

  const observedAt = observedAtForAppointment(appointment, status);
  const finalDecision =
    status === "completed"
      ? "service_completed"
      : status === "cancelled"
        ? "booking_cancelled"
        : "no_show";

  return Object.freeze({
    status: "closed",
    closedAt: observedAt,
    outcome: Object.freeze({
      finalDecision,
      bookingConverted: true,
      servicePerformed: status === "completed",
      customerAcceptedRecommendation: recommendationAcceptance(
        appointment,
        consultation
      ),
      observedAt,
    }),
    learning: Object.freeze({
      labelState: "labelled",
      labelledAt: observedAt,
    }),
  });
}

export async function observeConsultationOutcomeForAppointment(appointment) {
  const appointmentId = idText(appointment?._id || appointment?.id);
  const businessId = idText(appointment?.business);
  const locationId = idText(appointment?.location);
  const customerId = idText(appointment?.customer);

  if (!appointmentId || !businessId || !locationId || !customerId) {
    return Object.freeze({
      matched: 0,
      modified: 0,
      skipped: "missing_scoped_appointment_provenance",
    });
  }

  const status = text(appointment?.status).toLowerCase();
  if (!TERMINAL_APPOINTMENT_STATUSES.has(status)) {
    return Object.freeze({ matched: 0, modified: 0, skipped: "non_terminal" });
  }

  const consultation = await ConsultationSession.findOne({
    business: appointment.business,
    location: appointment.location,
    customer: appointment.customer,
    $or: [
      { appointment: appointment._id },
      { "outcome.resultingAppointment": appointment._id },
    ],
  });

  if (!consultation) {
    return Object.freeze({ matched: 0, modified: 0 });
  }

  const observation = buildConsultationOutcomeObservation(
    appointment,
    consultation
  );

  consultation.status = observation.status;
  consultation.closedAt = observation.closedAt;
  consultation.outcome.finalDecision = observation.outcome.finalDecision;
  consultation.outcome.bookingConverted = observation.outcome.bookingConverted;
  consultation.outcome.servicePerformed = observation.outcome.servicePerformed;
  consultation.outcome.customerAcceptedRecommendation =
    observation.outcome.customerAcceptedRecommendation;
  consultation.outcome.observedAt = observation.outcome.observedAt;
  consultation.learning.labelState = observation.learning.labelState;
  consultation.learning.labelledAt = observation.learning.labelledAt;

  await consultation.save();

  return Object.freeze({
    matched: 1,
    modified: 1,
    consultationId: consultation._id,
  });
}

export default {
  buildConsultationOutcomeObservation,
  observeConsultationOutcomeForAppointment,
};
