import mongoose from "mongoose";

const { Schema } = mongoose;

const whatsAppChannelBindingSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["twilio", "meta"],
      required: true,
      index: true,
    },
    destinationKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

whatsAppChannelBindingSchema.index(
  { provider: 1, destinationKey: 1 },
  { unique: true }
);

whatsAppChannelBindingSchema.index({
  business: 1,
  location: 1,
  status: 1,
});

const WhatsAppChannelBinding =
  mongoose.models.WhatsAppChannelBinding ||
  mongoose.model("WhatsAppChannelBinding", whatsAppChannelBindingSchema);

export default WhatsAppChannelBinding;
