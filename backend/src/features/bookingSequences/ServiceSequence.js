import mongoose from "mongoose";

const { Schema } = mongoose;

export const RESOURCE_KINDS = Object.freeze([
  "chair",
  "room",
  "equipment",
]);

const resourceRequirementSchema = new Schema(
  {
    kind: {
      type: String,
      enum: RESOURCE_KINDS,
      required: true,
      trim: true,
    },
    resourceKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
      validate: {
        validator: Number.isInteger,
        message: "Resource requirement quantity must be an integer.",
      },
    },
    exclusive: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

const sequenceStepSchema = new Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Service sequence step order must be an integer.",
      },
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      validate: {
        validator: Number.isInteger,
        message: "Service sequence step duration must be an integer.",
      },
    },
    providerRequired: {
      type: Boolean,
      default: true,
    },
    processingGapAfterMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 1440,
      validate: {
        validator: Number.isInteger,
        message: "Processing gap must be an integer.",
      },
    },
    holdResourcesDuringGap: {
      type: Boolean,
      default: false,
    },
    resourceRequirements: {
      type: [resourceRequirementSchema],
      default: [],
    },
  },
  {
    _id: true,
  }
);

const serviceSequenceSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    primaryService: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    steps: {
      type: [sequenceStepSchema],
      required: true,
      validate: [
        {
          validator(value) {
            return Array.isArray(value) && value.length > 0;
          },
          message: "A service sequence requires at least one step.",
        },
        {
          validator(value) {
            if (!Array.isArray(value)) return false;
            const orders = value.map((step) => Number(step.order));
            return new Set(orders).size === orders.length;
          },
          message: "Service sequence step order values must be unique.",
        },
      ],
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

serviceSequenceSchema.pre("validate", function normaliseStepOrder() {
  if (Array.isArray(this.steps)) {
    this.steps.sort((left, right) => Number(left.order) - Number(right.order));
  }
});

serviceSequenceSchema.virtual("totalDurationMinutes").get(function totalDurationMinutes() {
  return (this.steps || []).reduce(
    (total, step) =>
      total +
      Number(step.durationMinutes || 0) +
      Number(step.processingGapAfterMinutes || 0),
    0
  );
});

serviceSequenceSchema.index({
  business: 1,
  primaryService: 1,
  active: 1,
  name: 1,
});

export default (
  mongoose.models.ServiceSequence ||
  mongoose.model("ServiceSequence", serviceSequenceSchema)
);
