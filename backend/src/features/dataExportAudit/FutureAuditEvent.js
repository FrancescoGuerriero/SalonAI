import mongoose from "mongoose";

const { Schema } = mongoose;

const futureAuditEventSchema = new Schema(
  {
    // Transitional trusted tenant provenance for report/export audit events.
    // Optional until the #309 canonical ownership migration is reviewed and
    // applied. Runtime callers must not populate these fields from request ids.
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    locationScope: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Location",
        },
      ],
      default: undefined,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dataset: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    format: {
      type: String,
      trim: true,
      default: "",
    },
    recordCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    actor: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      role: {
        type: String,
        trim: true,
        default: "",
      },
      ipAddress: {
        type: String,
        trim: true,
        default: "",
      },
      userAgent: {
        type: String,
        trim: true,
        default: "",
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

futureAuditEventSchema.index({
  business: 1,
  createdAt: -1,
});

futureAuditEventSchema.index({
  business: 1,
  location: 1,
  createdAt: -1,
});

futureAuditEventSchema.index({
  business: 1,
  dataset: 1,
  createdAt: -1,
});

const FutureAuditEvent =
  mongoose.models.FutureAuditEvent ||
  mongoose.model("FutureAuditEvent", futureAuditEventSchema);

export default FutureAuditEvent;
