import mongoose from "mongoose";

const { Schema } = mongoose;

export const OPPORTUNITY_STAGES = Object.freeze([
  "new",
  "qualified",
  "consultation",
  "proposal",
  "booking_ready",
  "won",
  "lost",
]);

const opportunitySchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
      index: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    ownerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 220,
    },
    status: {
      type: String,
      enum: ["open", "won", "lost"],
      default: "open",
      index: true,
    },
    stage: {
      type: String,
      enum: OPPORTUNITY_STAGES,
      default: "new",
      index: true,
    },
    estimatedValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "GBP",
      minlength: 3,
      maxlength: 3,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    expectedCloseAt: {
      type: Date,
      default: null,
      index: true,
    },
    wonAt: {
      type: Date,
      default: null,
    },
    lostAt: {
      type: Date,
      default: null,
    },
    lostReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

opportunitySchema.index({ business: 1, lead: 1, status: 1, createdAt: -1 });
opportunitySchema.index({ business: 1, stage: 1, expectedCloseAt: 1 });

export default (
  mongoose.models.Opportunity ||
  mongoose.model("Opportunity", opportunitySchema)
);
