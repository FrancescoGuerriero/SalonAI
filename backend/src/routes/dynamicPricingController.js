import mongoose from "mongoose";

const { Schema } = mongoose;

const futureAuditEventSchema = new Schema(
  {
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

const FutureAuditEvent =
  mongoose.models.FutureAuditEvent ||
  mongoose.model("FutureAuditEvent", futureAuditEventSchema);

export default FutureAuditEvent;
