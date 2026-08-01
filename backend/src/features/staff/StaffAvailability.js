import mongoose from "mongoose";

const rangeSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const staffAvailabilitySchema =
  new mongoose.Schema(
    {
      staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stylist",
        required: true,
        index: true,
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        required: true,
        index: true,
      },
      ranges: {
        type: [rangeSchema],
        default: [],
      },
      active: {
        type: Boolean,
        default: true,
      },
      effectiveFrom: Date,
      effectiveTo: Date,
    },
    {
      timestamps: true,
    }
  );

staffAvailabilitySchema.index({
  staff: 1,
  dayOfWeek: 1,
  effectiveFrom: 1,
});

const StaffAvailability =
  mongoose.models.StaffAvailability ||
  mongoose.model(
    "StaffAvailability",
    staffAvailabilitySchema
  );

export default StaffAvailability;
