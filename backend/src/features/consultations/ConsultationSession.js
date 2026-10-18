import mongoose from "mongoose";

const { Schema } = mongoose;

const responseSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: Schema.Types.Mixed, default: null },
    source: {
      type: String,
      enum: ["customer", "staff", "whatsapp", "system", "import"],
      default: "customer",
    },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const flagSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, maxlength: 120 },
    severity: {
      type: String,
      enum: ["info", "attention", "blocking"],
      default: "attention",
    },
    label: { type: String, required: true, trim: true, maxlength: 240 },
    source: {
      type: String,
      enum: ["rule", "ai", "staff"],
      default: "rule",
    },
  },
  { _id: false }
);

const correctionSchema = new Schema(
  {
    field: { type: String, required: true, trim: true, maxlength: 120 },
    previousValue: { type: Schema.Types.Mixed, default: null },
    correctedValue: { type: Schema.Types.Mixed, default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    correctedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    correctedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const consultationSessionSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
      immutable: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
      immutable: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
      immutable: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    sourceConversation: {
      type: Schema.Types.ObjectId,
      ref: "WhatsAppConversation",
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: ["web", "mobile", "whatsapp", "staff"],
      required: true,
      default: "web",
      index: true,
    },
    consultationType: {
      type: String,
      required: true,
      trim: true,
      default: "hair-colour-chemical",
      index: true,
    },
    definitionVersion: {
      type: String,
      required: true,
      trim: true,
      default: "1",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "in_progress",
        "awaiting_review",
        "more_information_required",
        "in_person_required",
        "approved",
        "booking_ready",
        "booked",
        "closed",
        "archived",
      ],
      default: "draft",
      index: true,
    },
    responses: { type: [responseSchema], default: [] },
    structuredFeatures: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deterministicAssessment: {
      rulesetVersion: { type: String, trim: true, default: "" },
      evaluatedAt: { type: Date, default: null },
      complete: { type: Boolean, default: false },
      missingFields: { type: [String], default: [] },
      requiredHumanReview: { type: Boolean, default: true },
      bookingBlocked: { type: Boolean, default: true },
      flags: { type: [flagSchema], default: [] },
    },
    ai: {
      state: {
        type: String,
        enum: ["not_requested", "pending", "completed", "failed", "superseded"],
        default: "not_requested",
      },
      capability: { type: String, trim: true, default: "consultation_assistance" },
      modelName: { type: String, trim: true, default: "" },
      modelVersion: { type: String, trim: true, default: "" },
      promptVersion: { type: String, trim: true, default: "" },
      featureVersion: { type: String, trim: true, default: "" },
      datasetVersion: { type: String, trim: true, default: "" },
      inferenceLog: { type: Schema.Types.ObjectId, ref: "AiInferenceLog", default: null },
      requestedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      confidence: { type: Number, min: 0, max: 1, default: null },
      recommendation: { type: Schema.Types.Mixed, default: null },
      rationale: { type: [String], default: [] },
      incompleteFields: { type: [String], default: [] },
      errorCode: { type: String, trim: true, default: "" },
    },
    review: {
      required: { type: Boolean, default: true },
      reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null },
      decision: {
        type: String,
        enum: [
          "",
          "approved",
          "modified",
          "more_information_required",
          "in_person_required",
          "declined",
        ],
        default: "",
      },
      notes: { type: String, trim: true, maxlength: 3000, default: "" },
      reviewedAt: { type: Date, default: null },
      corrections: { type: [correctionSchema], default: [] },
    },
    outcome: {
      finalDecision: { type: String, trim: true, maxlength: 120, default: "" },
      recommendedService: { type: Schema.Types.ObjectId, ref: "Service", default: null },
      recommendedStylist: { type: Schema.Types.ObjectId, ref: "Stylist", default: null },
      resultingAppointment: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },
      bookingConverted: { type: Boolean, default: false },
      servicePerformed: { type: Boolean, default: null },
      customerAcceptedRecommendation: { type: Boolean, default: null },
      observedAt: { type: Date, default: null },
    },
    learning: {
      eligibility: {
        type: String,
        enum: ["pending", "eligible", "excluded"],
        default: "pending",
        index: true,
      },
      exclusionReasons: { type: [String], default: [] },
      labelState: {
        type: String,
        enum: ["unlabelled", "partial", "labelled"],
        default: "unlabelled",
      },
      snapshotVersion: { type: String, trim: true, default: "" },
      labelledAt: { type: Date, default: null },
    },
    governance: {
      dataProcessingConsent: { type: Boolean, required: true, default: false },
      mediaProcessingConsent: { type: Boolean, default: false },
      rawTranscriptStored: { type: Boolean, default: false },
      createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      source: { type: String, trim: true, default: "customer" },
    },
    completedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

consultationSessionSchema.index({ business: 1, status: 1, updatedAt: -1 });
consultationSessionSchema.index({ business: 1, location: 1, status: 1, updatedAt: -1 });
consultationSessionSchema.index({ business: 1, customer: 1, createdAt: -1 });
consultationSessionSchema.index({ business: 1, "learning.eligibility": 1, updatedAt: -1 });

const ConsultationSession =
  mongoose.models.ConsultationSession ||
  mongoose.model("ConsultationSession", consultationSessionSchema);

export default ConsultationSession;
