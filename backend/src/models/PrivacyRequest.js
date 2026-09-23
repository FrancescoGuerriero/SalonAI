import mongoose from "mongoose";

export const PRIVACY_REQUEST_TYPES = Object.freeze([
  "access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability",
]);

export const PRIVACY_REQUEST_STATUSES = Object.freeze([
  "received",
  "identity_verification",
  "in_review",
  "action_required",
  "completed",
  "refused",
  "withdrawn",
]);

const privacyRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    requestType: {
      type: String,
      enum: PRIVACY_REQUEST_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: PRIVACY_REQUEST_STATUSES,
      default: "received",
      index: true,
    },
    details: {
      type: String,
      trim: true,
      default: "",
      maxlength: 4000,
    },
    responseSummary: {
      type: String,
      trim: true,
      default: "",
      maxlength: 4000,
    },
    internalNotes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 4000,
      select: false,
    },
    policyVersion: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    targetResponseAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

privacyRequestSchema.index({
  requester: 1,
  createdAt: -1,
});

privacyRequestSchema.index({
  status: 1,
  targetResponseAt: 1,
});

export default (
  mongoose.models.PrivacyRequest ||
  mongoose.model(
    "PrivacyRequest",
    privacyRequestSchema
  )
);
