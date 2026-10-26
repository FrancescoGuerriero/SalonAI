import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import ConsultationSession from "../consultations/ConsultationSession.js";
import AiInferenceLog from "../aiPlatform/AiInferenceLog.js";
import { generateStylistCopilotBrief } from "./stylistCopilotAiClient.js";

function text(value) {
  return String(value ?? "").trim();
}

function asId(value) {
  return value ? String(value) : null;
}

function buildScopeFilter({ businessId, locationId, allowedLocationIds = [] }) {
  const filter = { business: businessId };
  if (locationId) {
    filter.location = locationId;
  } else if (allowedLocationIds.length > 0) {
    filter.location = { $in: allowedLocationIds };
  }
  return filter;
}

export async function buildStylistCopilotContext({
  appointmentId,
  user,
  businessId,
  locationId = null,
  allowedLocationIds = [],
}) {
  if (!appointmentId || !businessId) {
    const error = new Error("Appointment and trusted business context are required.");
    error.statusCode = 422;
    throw error;
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    ...buildScopeFilter({ businessId, locationId, allowedLocationIds }),
  })
    .select("business location customer stylist service appointmentDate appointmentTime startsAt endsAt status notes bookingSource")
    .populate("service", "name description duration price")
    .populate("stylist", "name firstName lastName")
    .lean()
    .exec();

  if (!appointment) {
    const error = new Error("Appointment is unavailable in the authorised tenant/location scope.");
    error.statusCode = 404;
    error.code = "STYLIST_COPILOT_APPOINTMENT_NOT_FOUND";
    throw error;
  }

  const customer = await Customer.findOne({
    _id: appointment.customer,
    $or: [{ business: businessId }, { business: { $exists: false } }],
  })
    .select("firstName lastName preferredName preferredStylist preferredServices hairProfile bookingPreferences")
    .lean()
    .exec();

  if (!customer) {
    const error = new Error("Customer context is unavailable in the authorised tenant scope.");
    error.statusCode = 404;
    throw error;
  }

  const consultation = await ConsultationSession.findOne({
    business: businessId,
    location: appointment.location,
    customer: appointment.customer,
    $or: [{ appointment: appointment._id }, { appointment: null }],
  })
    .sort({ updatedAt: -1 })
    .select("status structuredFeatures deterministicAssessment ai review outcome governance updatedAt")
    .lean()
    .exec();

  const priorAppointments = await Appointment.find({
    customer: appointment.customer,
    _id: { $ne: appointment._id },
    status: "completed",
    ...buildScopeFilter({ businessId, locationId, allowedLocationIds }),
  })
    .sort({ startsAt: -1, appointmentDate: -1 })
    .limit(8)
    .select("service stylist startsAt appointmentDate status notes")
    .populate("service", "name")
    .populate("stylist", "name firstName lastName")
    .lean()
    .exec();

  const consentedSensitiveContext = Boolean(
    consultation?.governance?.dataProcessingConsent
  );

  const hairProfile = customer.hairProfile || {};
  const preferences = [
    ...(Array.isArray(customer.preferredServices)
      ? customer.preferredServices.map((item) => `Preferred service: ${item}`)
      : []),
    hairProfile.preferredProducts?.length
      ? `Preferred products: ${hairProfile.preferredProducts.join(", ")}`
      : "",
    hairProfile.productsToAvoid?.length
      ? `Products to avoid: ${hairProfile.productsToAvoid.join(", ")}`
      : "",
  ].filter(Boolean);

  const sensitiveContext = consentedSensitiveContext
    ? {
        allergies: hairProfile.allergies || [],
        sensitivities: hairProfile.sensitivities || [],
        scalpCondition: text(hairProfile.scalpCondition),
        chemicalHistory: text(hairProfile.chemicalHistory),
        consultationNotes: text(hairProfile.consultationNotes),
        patchTestResult: text(hairProfile.patchTestResult),
        lastPatchTestAt: hairProfile.lastPatchTestAt || null,
      }
    : {};

  return {
    capability: "stylist_copilot",
    tenantContext: {
      businessId: asId(appointment.business || businessId),
      locationId: asId(appointment.location),
    },
    actor: {
      userId: asId(user?._id),
      role: text(user?.role),
      professionalDecisionOwner: true,
    },
    appointment: {
      id: asId(appointment._id),
      status: appointment.status,
      startsAt: appointment.startsAt || appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      bookingSource: appointment.bookingSource,
      notes: text(appointment.notes),
      service: appointment.service
        ? {
            id: asId(appointment.service._id),
            name: text(appointment.service.name),
            description: text(appointment.service.description),
          }
        : null,
      stylist: appointment.stylist
        ? {
            id: asId(appointment.stylist._id),
            name: text(
              appointment.stylist.name ||
                `${appointment.stylist.firstName || ""} ${appointment.stylist.lastName || ""}`
            ),
          }
        : null,
    },
    customer: {
      id: asId(customer._id),
      displayName: text(customer.preferredName || `${customer.firstName} ${customer.lastName}`),
      preferences,
      hairProfile: {
        hairType: text(hairProfile.hairType),
        naturalHairColour: text(hairProfile.naturalHairColour),
        currentHairColour: text(hairProfile.currentHairColour || hairProfile.hairColour),
        hairLength: text(hairProfile.hairLength),
        texture: text(hairProfile.texture),
        density: text(hairProfile.density),
        porosity: text(hairProfile.porosity),
        concerns: hairProfile.concerns || [],
      },
    },
    consultation: consultation
      ? {
          status: consultation.status,
          structuredFeatures: consultation.structuredFeatures || {},
          deterministicAssessment: consultation.deterministicAssessment || {},
          ai: consultation.ai || {},
          review: consultation.review || {},
          outcome: consultation.outcome || {},
          updatedAt: consultation.updatedAt,
        }
      : null,
    history: priorAppointments.map((item) => ({
      appointmentId: asId(item._id),
      service: text(item.service?.name),
      stylist: text(
        item.stylist?.name ||
          `${item.stylist?.firstName || ""} ${item.stylist?.lastName || ""}`
      ),
      startsAt: item.startsAt || item.appointmentDate,
      notes: text(item.notes),
    })),
    sensitiveContext,
    consent: {
      dataProcessingConsent: consentedSensitiveContext,
      sensitiveContextIncluded: consentedSensitiveContext,
    },
    constraints: {
      humanReviewRequired: true,
      canonicalWritesAllowed: false,
      autonomousCustomerMessagingAllowed: false,
      medicalDiagnosisAllowed: false,
      safetyRuleOverrideAllowed: false,
    },
  };
}

export async function generateStylistCopilot({
  appointmentId,
  user,
  requestId = "",
  businessId,
  locationId = null,
  allowedLocationIds = [],
}) {
  const startedAt = Date.now();
  const context = await buildStylistCopilotContext({
    appointmentId,
    user,
    businessId,
    locationId,
    allowedLocationIds,
  });

  const brief = await generateStylistCopilotBrief(context, { requestId });

  const inference = await AiInferenceLog.create({
    business: businessId,
    location: context.tenantContext.locationId,
    capability: "stylist-copilot",
    modelName: brief?.provenance?.modelName || "salonai-stylist-copilot",
    modelVersion: brief?.provenance?.modelVersion || "v1",
    entityType: "appointment",
    entityKey: appointmentId,
    latencyMs: Date.now() - startedAt,
    prediction: brief,
    explanation: {
      advisoryOnly: true,
      humanReviewRequired: true,
      sensitiveContextIncluded: context.consent.sensitiveContextIncluded,
      evidenceRefs: [
        `appointment:${appointmentId}`,
        `customer:${context.customer.id}`,
        ...(context.consultation ? ["consultation:latest-authorised"] : []),
      ],
    },
    context: {
      requestId: text(requestId),
      actorRole: text(user?.role),
      actorUserId: user?._id,
      source: "ai-stylist-copilot",
    },
  });

  return {
    brief,
    source: {
      appointmentId,
      customerId: context.customer.id,
      consultationIncluded: Boolean(context.consultation),
      historyCount: context.history.length,
      sensitiveContextIncluded: context.consent.sensitiveContextIncluded,
      tenantScoped: true,
    },
    inferenceId: String(inference._id),
  };
}

export default {
  buildStylistCopilotContext,
  generateStylistCopilot,
};
