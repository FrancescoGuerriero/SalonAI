import mongoose from "mongoose";

const SHIFT_STATUSES = [
  "draft",
  "published",
  "completed",
  "cancelled",
];

const staffShiftSchema = new mongoose.Schema(
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
    breakMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 720,
    },
    roleTitle: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Stylist",
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "Main salon",
    },
    status: {
      type: String,
      enum: SHIFT_STATUSES,
      default: "draft",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

staffShiftSchema.index({
  staff: 1,
  startsAt: 1,
  endsAt: 1,
});

staffShiftSchema.index({
  startsAt: 1,
  status: 1,
});

staffShiftSchema.pre("validate", function validateShift(next) {
  const startsAt = new Date(this.startsAt);
  const endsAt = new Date(this.endsAt);

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    return next();
  }

  if (endsAt <= startsAt) {
    this.invalidate(
      "endsAt",
      "Shift end time must be after its start time."
    );

    return next();
  }

  const durationMinutes =
    (endsAt.getTime() - startsAt.getTime()) / 60_000;

  if (durationMinutes > 18 * 60) {
    this.invalidate(
      "endsAt",
      "A staff shift cannot exceed 18 hours."
    );
  }

  if (Number(this.breakMinutes || 0) >= durationMinutes) {
    this.invalidate(
      "breakMinutes",
      "Break time must be shorter than the shift."
    );
  }

  return next();
});

const StaffShift =
  mongoose.models.StaffShift ||
  mongoose.model("StaffShift", staffShiftSchema);

export { SHIFT_STATUSES };
export default StaffShift;
