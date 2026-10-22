import mongoose from "mongoose";

const { Schema } = mongoose;

const membershipPlanSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    status: {
      type: String,
      enum: ["draft", "active", "retired"],
      default: "draft",
      index: true,
    },
    billingFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "custom"],
      default: "monthly",
    },
    billingIntervalCount: {
      type: Number,
      min: 1,
      max: 36,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Membership billing interval must be an integer.",
      },
    },
    price: {
      type: Number,
      min: 0,
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "GBP",
      minlength: 3,
      maxlength: 3,
    },
    storedValueProgram: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueProgram",
      default: null,
    },
    benefits: {
      type: [
        {
          key: { type: String, trim: true, required: true, maxlength: 120 },
          allowance: { type: Number, min: 0, required: true },
          unit: {
            type: String,
            enum: ["money", "quantity", "points"],
            required: true,
          },
          rolloverEnabled: { type: Boolean, default: false },
          rolloverLimit: { type: Number, min: 0, default: 0 },
        },
      ],
      default: [],
    },
    freezePolicy: {
      allowed: { type: Boolean, default: false },
      maxDaysPerYear: { type: Number, min: 0, max: 366, default: 0 },
    },
    familySharing: {
      allowed: { type: Boolean, default: false },
      maxMembers: { type: Number, min: 1, max: 50, default: 1 },
    },
    collectionRetryDays: {
      type: [Number],
      default: [1, 3, 7],
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.every(
              (item) => Number.isInteger(item) && item >= 1 && item <= 60
            )
          );
        },
        message: "Membership retry days must contain integers between 1 and 60.",
      },
    },
  },
  {
    timestamps: true,
  }
);

membershipPlanSchema.index({ business: 1, key: 1 }, { unique: true });

export default (
  mongoose.models.MembershipPlan ||
  mongoose.model("MembershipPlan", membershipPlanSchema)
);
