import mongoose from "mongoose";

const { Schema } = mongoose;

const domainEventSchema = new Schema(
  {
    eventId: { type: String, required: true, trim: true, maxlength: 100, unique: true, index: true },
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    type: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    version: { type: String, required: true, trim: true, default: "1", maxlength: 32 },
    aggregateType: { type: String, trim: true, lowercase: true, default: "", maxlength: 100 },
    aggregateId: { type: String, trim: true, default: "", maxlength: 160, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: true, index: true },
    source: { type: String, trim: true, default: "platform", maxlength: 100 },
    correlationId: { type: String, trim: true, default: "", maxlength: 160, index: true },
    causationId: { type: String, trim: true, default: "", maxlength: 160 },
    projectedAt: { type: Date, default: null, index: true },
    workflowDispatchedAt: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

domainEventSchema.index({ business: 1, occurredAt: 1, _id: 1 });
domainEventSchema.index({ business: 1, type: 1, version: 1, occurredAt: 1 });
domainEventSchema.index({ workflowDispatchedAt: 1, occurredAt: 1, _id: 1 });

export default (
  mongoose.models.DomainEvent ||
  mongoose.model("DomainEvent", domainEventSchema)
);
