import mongoose from "mongoose";

const customerCommercePolicySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    policyType: {
      type: String,
      enum: ["delivery", "returns"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 15000,
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: null,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

customerCommercePolicySchema.index({
  business: 1,
  location: 1,
  policyType: 1,
  published: 1,
  effectiveFrom: -1,
});

const CustomerCommercePolicy =
  mongoose.models.CustomerCommercePolicy ||
  mongoose.model("CustomerCommercePolicy", customerCommercePolicySchema);

export default CustomerCommercePolicy;
