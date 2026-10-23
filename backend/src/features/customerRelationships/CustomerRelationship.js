import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    sourceCustomer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    targetCustomer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: ["partner", "spouse", "parent", "child", "guardian", "dependent", "family", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "declined", "revoked"],
      default: "pending",
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    sharing: {
      appointments: { type: Boolean, default: false },
      loyalty: { type: Boolean, default: false },
      wallet: { type: Boolean, default: false },
      communications: { type: Boolean, default: false },
    },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index(
  { sourceCustomer: 1, targetCustomer: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "active"] } } }
);
schema.index({ targetCustomer: 1, status: 1, createdAt: -1 });

export default mongoose.models.CustomerRelationship ||
  mongoose.model("CustomerRelationship", schema);
