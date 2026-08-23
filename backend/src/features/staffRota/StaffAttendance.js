import mongoose from "mongoose";

const ATTENDANCE_STATUSES = [
  "scheduled",
  "present",
  "late",
  "absent",
  "completed",
];

const staffAttendanceSchema = new mongoose.Schema(
  {
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffShift",
      required: true,
      unique: true,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },
    clockInAt: {
      type: Date,
      default: null,
    },
    clockOutAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: "scheduled",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

staffAttendanceSchema.pre(
  "validate",
  function validateAttendance() {
    if (this.clockInAt && this.clockOutAt) {
      const clockInAt = new Date(this.clockInAt);
      const clockOutAt = new Date(this.clockOutAt);

      if (clockOutAt <= clockInAt) {
        this.invalidate(
          "clockOutAt",
          "Clock-out time must be after clock-in time."
        );
      }
    }

    return;
  }
);

const StaffAttendance =
  mongoose.models.StaffAttendance ||
  mongoose.model("StaffAttendance", staffAttendanceSchema);

export { ATTENDANCE_STATUSES };
export default StaffAttendance;
