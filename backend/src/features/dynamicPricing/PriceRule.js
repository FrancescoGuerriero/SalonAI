import mongoose from "mongoose";

const { Schema } = mongoose;

export const PRICE_RULE_STATUSES = Object.freeze([
  "draft",
  "review_ready",
  "approved_for_experiment",
  "rejected",
  "retired",
]);

const priceRuleSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
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
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: PRICE_RULE_STATUSES,
      default: "draft",
      index: true,
    },
    modifierPercent: {
      type: Number,
      min: -15,
      max: 20,
      required: true,
    },
    conditions: {
      weekdays: {
        type: [Number],
        default: [],
      },
      startHour: {
        type: Number,
        min: 0,
        max: 23,
        default: null,
      },
      endHour: {
        type: Number,
        min: 1,
        max: 24,
        default: null,
      },
      minimumDemandIndex: {
        type: Number,
        min: 0,
        max: 10,
        default: null,
      },
      maximumDemandIndex: {
        type: Number,
        min: 0,
        max: 10,
        default: null,
      },
      minimumCompletionRate: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
      },
      maximumLossRate: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
      },
    },
    transparency: {
      customerDisclosure: {
        type: String,
        trim: true,
        required: true,
        maxlength: 500,
      },
      internalRationale: {
        type: String,
        trim: true,
        required: true,
        maxlength: 1500,
      },
    },
    fairnessReview: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true,
      },
      personalisationAllowed: {
        type: Boolean,
        default: false,
      },
      productionDeploymentAllowed: {
        type: Boolean,
        default: false,
      },
      evidenceRefs: {
        type: [String],
        default: [],
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      note: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1500,
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

priceRuleSchema.index({ business: 1, status: 1, updatedAt: -1 });
priceRuleSchema.index({ business: 1, service: 1, status: 1 });

export default (
  mongoose.models.PriceRule ||
  mongoose.model("PriceRule", priceRuleSchema)
);
