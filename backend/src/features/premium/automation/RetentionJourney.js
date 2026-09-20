import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const RETENTION_TRIGGERS =
  Object.freeze([
    "customer_created",
    "appointment_completed",
    "customer_inactive",
    "loyalty_tier_changed",
    "referral_rewarded",
  ]);

const RETENTION_CHANNELS =
  Object.freeze([
    "email",
    "sms",
    "push",
    "whatsapp",
    "in_app",
  ]);

const RETENTION_STOP_CONDITIONS =
  Object.freeze([
    "appointment_booked",
    "purchase_completed",
    "customer_opted_out",
    "none",
  ]);

const stepSchema =
  new Schema(
    {
      order: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
      },
      delayMinutes: {
        type: Number,
        default: 0,
        min: 0,
        max: 525600,
      },
      channel: {
        type: String,
        enum: RETENTION_CHANNELS,
        required: true,
      },
      subject: {
        type: String,
        trim: true,
        default: "",
        maxlength: 240,
      },
      body: {
        type: String,
        trim: true,
        required: true,
        maxlength: 5000,
      },
      stopIf: {
        type: String,
        enum:
          RETENTION_STOP_CONDITIONS,
        default: "none",
      },
    },
    {
      _id: true,
    }
  );

const retentionJourneySchema =
  new Schema(
    {
      name: {
        type: String,
        trim: true,
        required: true,
        minlength: 2,
        maxlength: 120,
      },
      description: {
        type: String,
        trim: true,
        default: "",
        maxlength: 600,
      },
      trigger: {
        type: String,
        enum: RETENTION_TRIGGERS,
        required: true,
        index: true,
      },
      enabled: {
        type: Boolean,
        default: false,
        index: true,
      },
      conditions: {
        type: Schema.Types.Mixed,
        default: () => ({
          inactiveDays: 60,
          minimumVisits: 0,
          minimumLifetimeValue: 0,
          retentionRiskLevels: [],
        }),
      },
      steps: {
        type: [
          stepSchema,
        ],
        default: [],
        validate: {
          validator(value) {
            return (
              Array.isArray(value) &&
              value.length >= 1 &&
              value.length <= 10
            );
          },
          message:
            "A retention journey must contain between 1 and 10 steps.",
        },
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
    }
  );

retentionJourneySchema.index({
  enabled: 1,
  trigger: 1,
  updatedAt: -1,
});

const RetentionJourney =
  mongoose.models
    .RetentionJourney ||
  mongoose.model(
    "RetentionJourney",
    retentionJourneySchema
  );

export {
  RETENTION_CHANNELS,
  RETENTION_STOP_CONDITIONS,
  RETENTION_TRIGGERS,
};

export default RetentionJourney;
