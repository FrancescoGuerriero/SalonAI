import mongoose from "mongoose";

const { Schema } = mongoose;

export const LEAD_TIMELINE_EVENT_TYPES = Object.freeze([
  "captured",
  "note",
  "status_changed",
  "assigned",
  "scored",
  "opportunity_created",
  "opportunity_updated",
  "nurture_enrolled",
  "nurture_updated",
  "customer_converted",
  "communication",
]);

const leadTimelineEventSchema = new Schema(
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
    opportunity: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: LEAD_TIMELINE_EVENT_TYPES,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    summary: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2000,
    },
    actorUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

leadTimelineEventSchema.index({ business: 1, lead: 1, occurredAt: 1, _id: 1 });

leadTimelineEventSchema.pre("save", function blockTimelineMutation() {
  if (!this.isNew) {
    const error = new Error("Lead timeline events are append-only.");
    error.code = "LEAD_TIMELINE_IMMUTABLE";
    throw error;
  }
});

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  leadTimelineEventSchema.pre(operation, function blockTimelineQueryMutation() {
    const error = new Error("Lead timeline events are append-only.");
    error.code = "LEAD_TIMELINE_IMMUTABLE";
    throw error;
  });
}

export default (
  mongoose.models.LeadTimelineEvent ||
  mongoose.model("LeadTimelineEvent", leadTimelineEventSchema)
);
