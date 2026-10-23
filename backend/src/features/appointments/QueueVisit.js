import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

export const QUEUE_VISIT_SOURCES = [
  "walk_in",
  "call_ahead",
];

const queueVisitSchema =
  new Schema(
    {
      business: {
        type:
          Schema.Types.ObjectId,
        ref: "Business",
        default: undefined,
        index: true,
      },

      location: {
        type:
          Schema.Types.ObjectId,
        ref: "Location",
        default: undefined,
        index: true,
      },

      appointment: {
        type:
          Schema.Types.ObjectId,
        ref: "Appointment",
        required: true,
        unique: true,
        index: true,
      },

      source: {
        type: String,
        enum: {
          values:
            QUEUE_VISIT_SOURCES,
          message:
            "Queue source must be walk_in or call_ahead.",
        },
        required: true,
        index: true,
      },

      joinedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      expectedArrivalAt: {
        type: Date,
        default: null,
        index: true,
      },

      priority: {
        type: Number,
        default: 0,
        min: -100,
        max: 100,
      },

      partySize: {
        type: Number,
        default: 1,
        min: 1,
        max: 100,
      },

      notes: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },

      createdBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      updatedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

queueVisitSchema.index({
  source: 1,
  joinedAt: 1,
  priority: -1,
});

queueVisitSchema.index({
  business: 1,
  location: 1,
  joinedAt: 1,
});

queueVisitSchema.index({
  expectedArrivalAt: 1,
  source: 1,
});

const QueueVisit =
  mongoose.models.QueueVisit ||
  mongoose.model(
    "QueueVisit",
    queueVisitSchema
  );

export default QueueVisit;
