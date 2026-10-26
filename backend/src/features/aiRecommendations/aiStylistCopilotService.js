import Appointment from "../../models/Appointment.js";
import Customer from "../../models/customer.js";
import CustomerNote from "../../models/CustomerNote.js";
import Order from "../commerce/Order.js";
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
    .populate("preferredServices", "name")
    .lean()
    .exec();

  if (!customer) {
    const error = new Error("Customer context is unavailable in the authorised tenant scope.");
    error.statusCode = 404;
    throw error;
  }

  const [consultationCandidate, priorAppointments, productOrders, followUpNotes] = await Promise.all([
    ConsultationSession.findOne({
      business: businessId,
      location: appointment.location,
      customer: appointment.customer,
      $or: [{ appointment: appointment._id }, { appointment: null }],
    })
      .sort({ updatedAt: -1 })
      .select("status structuredFeatures deterministicAssessment ai review outcome governance updatedAt")
      .lean()
      .exec(),

    Appointment.find({
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
      .exec(),

    // Order has not yet been given its own Business/Location columns. The
    // query is therefore anchored to the exact Customer already proven above
    // to belong to the authorised appointment/business context.
    Order.find({
      customer: appointment.customer,
      status: { $in: ["paid", "processing", "ready", "completed"] },
      "items.itemType": "product",
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("createdAt items")
      .lean()
      .exec(),

    // Staff-visible follow-up notes are likewise anchored to the already
    // scoped Customer. Private/management-only notes never enter Copilot.
    CustomerNote.find({
      customer: appointment.customer,
      deletedAt: null,
      visibility: "staff",
      $or: [{ type: "follow_up" }, { requiresFollowUp: true }],
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("title content type requiresFollowUp followUpAt followUpCompleted createdAt")
      .lean()
      .exec(),
  ]);

  // Match the existing consultation-inference privacy invariant: consultation
  // evidence is eligible for AI processing only with explicit processing consent.
  const consultation =
    consultationCandidate?.governance?.dataProcessingConsent === true
      ? consultationCandidate
      : null;
  const consentedSensitiveContext = Boolean(consultation);

  const hairProfile = customer.hairProfile || {};
  const preferences = [
    ...(Array.isArray(customer.preferredServices)
      ? customer.preferredServices
          .map((item) => text(item?.name || item))
          .filter(Boolean)
          .map((name) => `Preferred service: ${name}`)
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

  const productHistory = productOrders.flatMap((order) =>
    (order.items || [])
      .filter((item) => item?.itemType === "product")
      .map((item) => ({
        productId: asId(item.product),
        name: text(item.name),
        quantity: Number(item.quantity) || 1,
        purchasedAt: order.createdAt || null,
      }))
  ).slice(0, 12);

  const followUp = followUpNotes.map((note) => ({
    title: text(note.title || "Follow-up"),
    summary: text(note.content).slice(0, 500),
    type: text(note.type),
    dueAt: note.followUpAt || null,
    completed: Boolean(note.followUpCompleted),
    createdAt: note.createdAt || null,
  }));

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
    productHistory,
    followUp,
    sensitiveContext,
    consent: {
      dataProcessingConsent: consentedSensitiveContext,
      sensitiveContextIncluded: consentedSensitiveContext,
      consultationIncluded: Boolean(consultation),
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
      consultationIncluded: context.consent.consultationIncluded,
      evidenceRefs: [
        `appointment:${appointmentId}`,
        `customer:${context.customer.id}`,
        ...(context.consultation ? ["consultation:latest-consented"] : []),
        ...(context.productHistory.length ? ["orders:customer-product-history"] : []),
        ...(context.followUp.length ? ["customer-notes:staff-follow-up"] : []),
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
      productHistoryCount: context.productHistory.length,
      followUpCount: context.followUp.length,
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
