import mongoose from "mongoose";

const { Schema } = mongoose;

const calendarSyncTaskSchema =
  new Schema(
    {
      appointment: {
        type: Schema.Types.ObjectId,
        ref: "Appointment",
        required: true,
        unique: true,
        index: true,
      },
      state: {
        type: String,
        enum: [
          "pending",
          "processing",
          "retry",
          "completed",
          "dead",
        ],
        default: "pending",
        index: true,
      },
      dueAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      attempts: {
        type: Number,
        min: 0,
        default: 0,
      },
      requestedRevision: {
        type: Number,
        min: 1,
        default: 1,
      },
      processedRevision: {
        type: Number,
        min: 0,
        default: 0,
      },
      lockedAt: {
        type: Date,
        default: null,
      },
      lockExpiresAt: {
        type: Date,
        default: null,
        index: true,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      lastError: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },
      lastResult: {
        type: Schema.Types.Mixed,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

calendarSyncTaskSchema.index({
  state: 1,
  dueAt: 1,
  lockExpiresAt: 1,
});

const CalendarSyncTask =
  mongoose.models
    .CalendarSyncTask ||
  mongoose.model(
    "CalendarSyncTask",
    calendarSyncTaskSchema
  );

export default CalendarSyncTask;
