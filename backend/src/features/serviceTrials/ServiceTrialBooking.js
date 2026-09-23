import mongoose from "mongoose";

const { Schema } = mongoose;

const serviceTrialBookingSchema = new Schema(
  {
    trial: {
      type: Schema.Types.ObjectId,
      ref: "ServiceTrial",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
      index: true,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    durationSnapshot: {
      type: Number,
      required: true,
      min: 1,
    },
    maxUsesSnapshot: {
      type: Number,
      required: true,
      min: 1,
    },
    cooldownDaysSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    conversionWindowDaysSnapshot: {
      type: Number,
      required: true,
      min: 1,
    },
    convertedAppointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: undefined,
      unique: true,
      sparse: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    conversionRecordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

serviceTrialBookingSchema.index({ trial: 1, customer: 1, createdAt: -1 });

const ServiceTrialBooking =
  mongoose.models.ServiceTrialBooking ||
  mongoose.model("ServiceTrialBooking", serviceTrialBookingSchema);

export default ServiceTrialBooking;
