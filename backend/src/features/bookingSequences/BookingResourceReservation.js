import mongoose from "mongoose";

import { RESOURCE_KINDS } from "./ServiceSequence.js";

const { Schema } = mongoose;

const bookingResourceReservationSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    location: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    serviceSequence: {
      type: Schema.Types.ObjectId,
      ref: "ServiceSequence",
      required: true,
      index: true,
    },
    resource: {
      type: Schema.Types.ObjectId,
      ref: "BookingResource",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: RESOURCE_KINDS,
      required: true,
    },
    resourceKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    segmentOrder: {
      type: Number,
      required: true,
      min: 0,
    },
    segmentType: {
      type: String,
      enum: ["service", "processing_gap"],
      required: true,
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

bookingResourceReservationSchema.pre("validate", function validateWindow() {
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "Resource reservation end must be after its start.");
  }
});

bookingResourceReservationSchema.index({
  resource: 1,
  startsAt: 1,
  endsAt: 1,
});

bookingResourceReservationSchema.index({
  appointment: 1,
  segmentOrder: 1,
  resource: 1,
  startsAt: 1,
});

export default (
  mongoose.models.BookingResourceReservation ||
  mongoose.model(
    "BookingResourceReservation",
    bookingResourceReservationSchema
  )
);
