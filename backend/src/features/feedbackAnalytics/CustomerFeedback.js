import mongoose from "mongoose";

const { Schema } = mongoose;

const customerFeedbackSchema = new Schema(
  {
    // Transitional #309 ownership. Business is authoritative; location is
    // optional until it can be reconciled from the linked Appointment.
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
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    stylist: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral",
      index: true,
    },
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      trim: true,
      default: "manual",
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

customerFeedbackSchema.index({
  business: 1,
  location: 1,
  createdAt: -1,
});

customerFeedbackSchema.index({
  business: 1,
  sentiment: 1,
  createdAt: -1,
});

const CustomerFeedback =
  mongoose.models.CustomerFeedback ||
  mongoose.model("CustomerFeedback", customerFeedbackSchema);

export default CustomerFeedback;
