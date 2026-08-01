import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "trial",
        "active",
        "paused",
        "cancelled",
        "expired",
      ],
      default: "active",
      index: true,
    },
    billingFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "annual"],
      default: "monthly",
    },
    price: {
      type: Number,
      min: 0,
      required: true,
    },
    benefits: {
      type: [String],
      default: [],
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    renewsAt: Date,
    endsAt: Date,
    paymentProviderSubscriptionId: String,
  },
  {
    timestamps: true,
  }
);

const Membership =
  mongoose.models.Membership ||
  mongoose.model("Membership", membershipSchema);

export default Membership;
