import mongoose from "mongoose";

const { Schema } = mongoose;

const serviceTrialSchema = new Schema(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    trialPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    trialDuration: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
    },
    maxUsesPerCustomer: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    cooldownDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 3650,
    },
    conversionWindowDays: {
      type: Number,
      default: 90,
      min: 1,
      max: 3650,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
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

serviceTrialSchema.pre("validate", function validateWindow() {
  if (this.validFrom && this.validUntil && this.validUntil < this.validFrom) {
    this.invalidate("validUntil", "Trial valid-until date cannot precede valid-from date.");
  }
});

serviceTrialSchema.index({ service: 1, active: 1, published: 1 });

const ServiceTrial =
  mongoose.models.ServiceTrial ||
  mongoose.model("ServiceTrial", serviceTrialSchema);

export default ServiceTrial;
