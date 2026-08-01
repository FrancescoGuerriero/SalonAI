import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["earn", "redeem", "adjust", "expire"],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      maxlength: 300,
      default: "",
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const loyaltyAccountSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true,
      index: true,
    },
    pointsBalance: {
      type: Number,
      default: 0,
    },
    lifetimePoints: {
      type: Number,
      default: 0,
    },
    tier: {
      type: String,
      enum: ["standard", "silver", "gold", "platinum"],
      default: "standard",
      index: true,
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const LoyaltyAccount =
  mongoose.models.LoyaltyAccount ||
  mongoose.model(
    "LoyaltyAccount",
    loyaltyAccountSchema
  );

export default LoyaltyAccount;
