import mongoose from "mongoose";

const { Schema } = mongoose;

const workforceCapacitySnapshotSchema = new Schema(
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
    businessDate: {
      type: Date,
      required: true,
      index: true,
    },
    availableStaffHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    eligibleStaffCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    appointmentCapacity: {
      type: Number,
      min: 0,
      default: 0,
    },
    sourceType: {
      type: String,
      enum: [
        "recurring_working_hours",
        "manual_roster",
        "imported_roster",
      ],
      required: true,
      default: "recurring_working_hours",
      index: true,
    },
    sourceVersion: {
      type: String,
      trim: true,
      default: "workforce-capacity-v1",
      maxlength: 80,
    },
    sourceRefs: {
      type: [
        {
          collection: {
            type: String,
            trim: true,
            required: true,
          },
          documentId: {
            type: String,
            trim: true,
            required: true,
          },
          _id: false,
        },
      ],
      default: [],
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

workforceCapacitySnapshotSchema.index(
  {
    business: 1,
    location: 1,
    businessDate: 1,
  },
  {
    unique: true,
  }
);

const WorkforceCapacitySnapshot =
  mongoose.models.WorkforceCapacitySnapshot ||
  mongoose.model(
    "WorkforceCapacitySnapshot",
    workforceCapacitySnapshotSchema
  );

export default WorkforceCapacitySnapshot;
