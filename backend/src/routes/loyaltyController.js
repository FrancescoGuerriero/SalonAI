import mongoose from "mongoose";

const { Schema } = mongoose;

const customerFeedbackSchema = new Schema(
  {
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

const CustomerFeedback =
  mongoose.models.CustomerFeedback ||
  mongoose.model("CustomerFeedback", customerFeedbackSchema);

export default CustomerFeedback;
