import Customer from "../../../models/customer.js";
import ConsultationSession from "../../consultations/ConsultationSession.js";
import {
  evaluateHairColourConsultation,
} from "../../consultations/hairColourConsultationRules.js";
import WhatsAppConversation from "./WhatsAppConversation.js";

const QUESTION_ORDER = Object.freeze([
  "desiredOutcome",
  "currentColour",
  "hairCondition",
  "colourHistory",
  "bleachHistory",
  "sensitivities",
]);

const QUESTIONS = Object.freeze({
  desiredOutcome:
    "What result would you like to achieve with your hair colour?",
  currentColour:
    "What is your current hair colour?",
  hairCondition:
    "How would you describe the current condition of your hair, for example healthy, dry, damaged or fragile?",
  colourHistory:
    "Has your hair been coloured before? Please briefly describe the colour history, or reply NONE.",
  bleachHistory:
    "Has your hair been bleached or lightened before? Please briefly describe it, or reply NONE.",
  sensitivities:
    "Do you have any known scalp or skin sensitivities relevant to hair colouring? Reply NONE if not.",
});

const CONSENT_WORDS = new Set([
  "consent",
  "i consent",
  "yes i consent",
  "yes, i consent",
  "agree",
  "i agree",
  "yes",
]);

const DECLINE_WORDS = new Set([
  "no",
  "decline",
  "i decline",
  "do not consent",
  "don't consent",
  "human",
  "staff",
]);

function compactText(value, maximum = 1000) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}

function normalised(value) {
  return compactText(value, 200).toLowerCase();
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value ? value._id : value;
  return compactText(candidate, 120);
}

export function consultationConsentDecision(value) {
  const answer = normalised(value);
  if (CONSENT_WORDS.has(answer)) return "accepted";
  if (DECLINE_WORDS.has(answer)) return "declined";
  return "unknown";
}

export function nextWhatsAppConsultationQuestion(features = {}) {
  const assessment = evaluateHairColourConsultation(features);
  const field = QUESTION_ORDER.find((key) =>
    assessment.missingFields.includes(key)
  );

  return field
    ? Object.freeze({ field, question: QUESTIONS[field] })
    : null;
}

function applyAssessment(session) {
  const assessment = evaluateHairColourConsultation(
    session.structuredFeatures || {}
  );
  session.deterministicAssessment = {
    ...assessment,
    evaluatedAt: new Date(),
  };
  return assessment;
}

async function loadScopedConversation(conversationId) {
  return WhatsAppConversation.findById(conversationId);
}

async function loadActiveSession(conversation) {
  if (!conversation?.activeConsultationId) return null;
  return ConsultationSession.findOne({
    _id: conversation.activeConsultationId,
    business: conversation.business,
    location: conversation.location,
    customer: conversation.customer,
  });
}

function consentPrompt() {
  return (
    "This service needs a digital colour consultation before booking. " +
    "I can collect your consultation answers for the salon team to review. " +
    "Reply CONSENT to allow SalonAI to process these consultation answers, or reply HUMAN for staff help."
  );
}

export async function startWhatsAppConsultationFromConversation({
  conversationId,
} = {}) {
  const conversation = await loadScopedConversation(conversationId);
  if (!conversation) return null;

  if (!conversation.business || !conversation.location || !conversation.customer) {
    return Object.freeze({
      started: false,
      reason: "trusted_scope_or_customer_missing",
    });
  }

  const customer = await Customer.findOne({
    _id: conversation.customer,
    business: conversation.business,
  }).select("_id business");

  if (!customer) {
    return Object.freeze({
      started: false,
      reason: "scoped_customer_not_found",
    });
  }

  let session = await loadActiveSession(conversation);
  if (
    session &&
    ["closed", "archived", "booked"].includes(session.status)
  ) {
    session = null;
    conversation.activeConsultationId = null;
  }

  if (!session) {
    session = new ConsultationSession({
      business: conversation.business,
      location: conversation.location,
      customer: customer._id,
      sourceConversation: conversation._id,
      channel: "whatsapp",
      consultationType: "hair-colour-chemical",
      definitionVersion: "1",
      status: "draft",
      responses: [],
      structuredFeatures: {},
      governance: {
        dataProcessingConsent: false,
        mediaProcessingConsent: false,
        rawTranscriptStored: false,
        createdBy: null,
        source: "whatsapp",
      },
    });
    applyAssessment(session);
    await session.save();
    conversation.activeConsultationId = session._id;
  }

  conversation.automation.mode = "consultation";
  conversation.automation.handoffRequested = false;
  conversation.automation.handoffReason = "";
  conversation.automation.lastIntent = "consultation";
  conversation.automation.lastAction = "collect_consultation_consent";
  await conversation.save();

  return Object.freeze({
    started: true,
    consultationId: session._id,
    reply: session.governance?.dataProcessingConsent
      ? nextWhatsAppConsultationQuestion(session.structuredFeatures)?.question ||
        "Your consultation answers are complete and ready for salon review."
      : consentPrompt(),
  });
}

function closeToHumanReview(conversation, session) {
  session.status = "awaiting_review";
  conversation.automation.mode = "human";
  conversation.automation.handoffRequested = true;
  conversation.automation.handoffReason = "consultation_review_required";
  conversation.automation.lastAction = "handoff_for_consultation_review";
}

export async function processActiveWhatsAppConsultationTurn(
  { conversationId, incoming } = {},
  { now = new Date() } = {}
) {
  const conversation = await loadScopedConversation(conversationId);
  if (
    !conversation ||
    conversation.automation?.mode !== "consultation" ||
    !conversation.activeConsultationId
  ) {
    return null;
  }

  const session = await loadActiveSession(conversation);
  if (!session) {
    conversation.activeConsultationId = null;
    conversation.automation.mode = "human";
    conversation.automation.handoffRequested = true;
    conversation.automation.handoffReason = "consultation_session_missing";
    await conversation.save();
    return Object.freeze({
      processed: true,
      handoff: true,
      reply: "I could not safely continue this consultation, so the salon team will help you.",
    });
  }

  const message = compactText(incoming?.message, 1000);
  if (!message) return null;

  if (session.governance?.dataProcessingConsent !== true) {
    const decision = consultationConsentDecision(message);

    if (decision === "declined") {
      session.status = "archived";
      session.closedAt = now;
      conversation.activeConsultationId = null;
      conversation.automation.mode = "human";
      conversation.automation.handoffRequested = true;
      conversation.automation.handoffReason = "consultation_consent_declined";
      conversation.automation.lastAction = "handoff";
      await session.save();
      await conversation.save();
      return Object.freeze({
        processed: true,
        handoff: true,
        reply: "No problem. I will not continue the digital consultation. The salon team can help you instead.",
      });
    }

    if (decision !== "accepted") {
      return Object.freeze({
        processed: true,
        handoff: false,
        reply: consentPrompt(),
      });
    }

    session.governance.dataProcessingConsent = true;
    session.status = "in_progress";
    applyAssessment(session);
    await session.save();
    conversation.automation.lastAction = "collect_consultation_answer";
    await conversation.save();

    const next = nextWhatsAppConsultationQuestion(session.structuredFeatures);
    return Object.freeze({
      processed: true,
      handoff: false,
      reply: next?.question || "Your consultation is ready for salon review.",
    });
  }

  const next = nextWhatsAppConsultationQuestion(session.structuredFeatures);
  if (!next) {
    closeToHumanReview(conversation, session);
    await session.save();
    await conversation.save();
    return Object.freeze({
      processed: true,
      handoff: true,
      reply: "Thanks. Your consultation answers are complete and have been sent to the salon team for professional review before booking.",
    });
  }

  session.structuredFeatures = {
    ...(session.structuredFeatures || {}),
    [next.field]: message,
  };
  session.responses.push({
    key: next.field,
    value: message,
    source: "whatsapp",
    answeredAt: now,
  });
  const assessment = applyAssessment(session);

  if (assessment.complete) {
    closeToHumanReview(conversation, session);
  } else {
    session.status = "in_progress";
    conversation.automation.lastAction = "collect_consultation_answer";
  }

  await session.save();
  await conversation.save();

  if (assessment.complete) {
    return Object.freeze({
      processed: true,
      handoff: true,
      reply: "Thanks. Your consultation answers are complete and have been sent to the salon team for professional review before booking.",
    });
  }

  return Object.freeze({
    processed: true,
    handoff: false,
    reply:
      nextWhatsAppConsultationQuestion(session.structuredFeatures)?.question ||
      "Your consultation answers are ready for review.",
  });
}

export default {
  consultationConsentDecision,
  nextWhatsAppConsultationQuestion,
  processActiveWhatsAppConsultationTurn,
  startWhatsAppConsultationFromConversation,
};
