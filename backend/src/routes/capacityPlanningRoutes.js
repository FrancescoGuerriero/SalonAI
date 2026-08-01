import mongoose from "mongoose";

const staffTimeOffSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["requested", "approved", "declined", "cancelled"],
      default: "requested",
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const StaffTimeOff =
  mongoose.models.StaffTimeOff ||
  mongoose.model(
    "StaffTimeOff",
    staffTimeOffSchema
  );

export default StaffTimeOff;
