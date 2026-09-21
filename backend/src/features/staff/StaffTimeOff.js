import mongoose from "mongoose";

export const STAFF_SCHEDULE_BLOCK_TYPES =
  Object.freeze([
    "time_off",
    "meeting",
    "training",
    "personal",
    "other",
  ]);

const staffTimeOffSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
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
    blockType: {
      type: String,
      enum:
        STAFF_SCHEDULE_BLOCK_TYPES,
      default: "time_off",
      index: true,
    },
    title: {
      type: String,
      maxlength: 120,
      default: "",
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

staffTimeOffSchema.index({
  staff: 1,
  status: 1,
  startsAt: 1,
  endsAt: 1,
});

const StaffTimeOff =
  mongoose.models.StaffTimeOff ||
  mongoose.model(
    "StaffTimeOff",
    staffTimeOffSchema
  );

export default StaffTimeOff;
