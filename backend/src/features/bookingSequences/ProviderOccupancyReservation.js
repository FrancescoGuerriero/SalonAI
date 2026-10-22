import mongoose from "mongoose";

const { Schema } = mongoose;

const providerOccupancyReservationSchema = new Schema(
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
      default: undefined,
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
    stylist: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      index: true,
    },
    segmentOrder: {
      type: Number,
      required: true,
      min: 0,
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
  },
  {
    timestamps: true,
  }
);

providerOccupancyReservationSchema.pre(
  "validate",
  function validateProviderWindow() {
    if (
      this.startsAt &&
      this.endsAt &&
      this.endsAt <= this.startsAt
    ) {
      this.invalidate(
        "endsAt",
        "Provider occupancy end must be after its start."
      );
    }
  }
);

providerOccupancyReservationSchema.index({
  stylist: 1,
  startsAt: 1,
  endsAt: 1,
});

providerOccupancyReservationSchema.index({
  appointment: 1,
  segmentOrder: 1,
  startsAt: 1,
});

export default (
  mongoose.models.ProviderOccupancyReservation ||
  mongoose.model(
    "ProviderOccupancyReservation",
    providerOccupancyReservationSchema
  )
);
