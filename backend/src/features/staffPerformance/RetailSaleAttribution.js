import mongoose from "mongoose";

const retailSaleAttributionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    attributedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    attributedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

retailSaleAttributionSchema.index({
  stylist: 1,
  attributedAt: -1,
});

const RetailSaleAttribution =
  mongoose.models.RetailSaleAttribution ||
  mongoose.model("RetailSaleAttribution", retailSaleAttributionSchema);

export default RetailSaleAttribution;
