import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: mongoose.Schema.Types.Mixed,
    category: {
      type: String,
      default: "general",
      index: true,
    },
    secret: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default (
  mongoose.models.SystemSetting ||
  mongoose.model("SystemSetting", schema)
);
