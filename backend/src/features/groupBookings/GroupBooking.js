import mongoose from "mongoose";

const { Schema } = mongoose;

const participantSchema = new Schema(
  {
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
  },
  {
    _id: true,
  }
);

const groupBookingSchema = new Schema(
  {
    organiser: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "Group booking",
      maxlength: 160,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length >= 2 && value.length <= 25;
        },
        message: "A group booking must contain between 2 and 25 participants.",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

groupBookingSchema.pre("validate", function preventDuplicateAppointments() {
  const identifiers = (this.participants || [])
    .map((participant) => String(participant.appointment || ""))
    .filter(Boolean);

  if (new Set(identifiers).size !== identifiers.length) {
    this.invalidate(
      "participants",
      "A canonical appointment can only belong to a group booking once."
    );
  }
});

groupBookingSchema.index({ organiser: 1, createdAt: -1 });
groupBookingSchema.index({ "participants.appointment": 1 }, { unique: true });

const GroupBooking =
  mongoose.models.GroupBooking ||
  mongoose.model("GroupBooking", groupBookingSchema);

export default GroupBooking;
