import mongoose from "mongoose";

const { Schema } = mongoose;

const RETENTION_ENROLLMENT_STATUSES = Object.freeze([
  "pending",
  "active",
  "paused",
  "completed",
  "stopped",
  "blocked",
  "cancelled",
]);

const RETENTION_ENROLLMENT_OUTCOMES = Object.freeze([
  "none",
  "appointment_booked",
  "purchase_completed",
  "customer_opted_out",
  "membership_payment_recovered",
  "expired",
  "manual_stop",
]);

const stepEvidenceSchema = new Schema(
  {
    stepOrder: { type: Number, required: true, min: 1, max: 10 },
    channel: { type: String, trim: true, lowercase: true, required: true },
    status: {
      type: String,
      enum: ["pending", "ready", "blocked", "skipped", "sent", "failed"],
      default: "pending",
    },
    reason: { type: String, trim: true, default: "", maxlength: 240 },
    occurredAt: { type: Date, default: null },
    providerReference: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { _id: false }
);

const retentionJourneyEnrollmentSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    journey: {
      type: Schema.Types.ObjectId,
      ref: "RetentionJourney",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    trigger: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },
    triggerReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: RETENTION_ENROLLMENT_STATUSES,
      default: "pending",
      index: true,
    },
    outcome: {
      type: String,
      enum: RETENTION_ENROLLMENT_OUTCOMES,
      default: "none",
      index: true,
    },
    lifecycleStateAtEnrollment: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    segmentsAtEnrollment: {
      type: [String],
      default: [],
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      index: true,
    },
    startedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    executionAuthorised: {
      type: Boolean,
      default: false,
    },
    stepEvidence: {
      type: [stepEvidenceSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

retentionJourneyEnrollmentSchema.index(
  { business: 1, idempotencyKey: 1 },
  { unique: true }
);
retentionJourneyEnrollmentSchema.index({ business: 1, customer: 1, createdAt: -1 });
retentionJourneyEnrollmentSchema.index({ business: 1, journey: 1, status: 1, createdAt: -1 });

const RetentionJourneyEnrollment =
  mongoose.models.RetentionJourneyEnrollment ||
  mongoose.model("RetentionJourneyEnrollment", retentionJourneyEnrollmentSchema);

export {
  RETENTION_ENROLLMENT_OUTCOMES,
  RETENTION_ENROLLMENT_STATUSES,
};

export default RetentionJourneyEnrollment;
