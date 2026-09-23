import mongoose from "mongoose";

const { Schema } = mongoose;

const serviceTrialEligibilitySchema = new Schema(
  {
    trial: {
      type: Schema.Types.ObjectId,
      ref: "ServiceTrial",
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    bookingsClaimed: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastBookedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

serviceTrialEligibilitySchema.index(
  { trial: 1, customer: 1 },
  { unique: true }
);

const ServiceTrialEligibility =
  mongoose.models.ServiceTrialEligibility ||
  mongoose.model("ServiceTrialEligibility", serviceTrialEligibilitySchema);

export default ServiceTrialEligibility;
