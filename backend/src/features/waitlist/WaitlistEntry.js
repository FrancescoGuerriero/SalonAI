import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

export const WAITLIST_STATUSES = [
  "waiting",
  "notified",
  "accepted",
  "booked",
  "declined",
  "expired",
  "cancelled",
];

export const WAITLIST_TIME_PREFERENCES = [
  "morning",
  "afternoon",
  "evening",
  "any",
];

export const WAITLIST_CONTACT_CHANNELS = [
  "email",
  "sms",
  "phone",
  "whatsapp",
];

const statusHistorySchema =
  new Schema(
    {
      previousStatus: {
        type: String,
        enum: [
          ...WAITLIST_STATUSES,
          null,
        ],
        default: null,
      },

      status: {
        type: String,
        enum:
          WAITLIST_STATUSES,
        required: true,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },

      changedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      reason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },
    },
    {
      _id: false,
    }
  );

const notificationHistorySchema =
  new Schema(
    {
      channel: {
        type: String,
        enum:
          WAITLIST_CONTACT_CHANNELS,
        required: true,
      },

      recipient: {
        type: String,
        trim: true,
        default: "",
        maxlength: 254,
      },

      sentAt: {
        type: Date,
        default: Date.now,
      },

      status: {
        type: String,
        enum: [
          "queued",
          "sent",
          "failed",
        ],
        default: "queued",
      },

      error: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      communication: {
        type:
          Schema.Types.ObjectId,
        ref:
          "ScheduledCommunication",
        default: null,
      },
    },
    {
      _id: false,
    }
  );

const waitlistEntrySchema =
  new Schema(
    {
      customer: {
        type:
          Schema.Types.ObjectId,
        ref: "Customer",
        required: [
          true,
          "A customer is required.",
        ],
        index: true,
      },

      service: {
        type:
          Schema.Types.ObjectId,
        ref: "Service",
        required: [
          true,
          "A service is required.",
        ],
        index: true,
      },

      /*
       * Stylist is a separate domain
       * model and must not reference User.
       */
      stylist: {
        type:
          Schema.Types.ObjectId,
        ref: "Stylist",
        default: null,
        index: true,
      },

      preferredDates: {
        type: [
          {
            type: Date,
          },
        ],
        default: [],
      },

      dateRangeStart: {
        type: Date,
        default: null,
      },

      dateRangeEnd: {
        type: Date,
        default: null,
      },

      timePreference: {
        type: String,
        enum: {
          values:
            WAITLIST_TIME_PREFERENCES,

          message:
            "Time preference must be morning, afternoon, evening or any.",
        },
        default: "any",
      },

      earliestTime: {
        type: String,
        trim: true,
        default: "",
        match: [
          /^$|^([01]\d|2[0-3]):[0-5]\d$/,
          "Earliest time must use HH:mm format.",
        ],
      },

      latestTime: {
        type: String,
        trim: true,
        default: "",
        match: [
          /^$|^([01]\d|2[0-3]):[0-5]\d$/,
          "Latest time must use HH:mm format.",
        ],
      },

      status: {
        type: String,
        enum: {
          values:
            WAITLIST_STATUSES,

          message:
            "The waiting-list status is invalid.",
        },
        default: "waiting",
        index: true,
      },

      priority: {
        type: Number,
        default: 0,
        min: -100,
        max: 100,
      },

      notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: "",
      },

      preferredContactChannel: {
        type: String,
        enum: {
          values:
            WAITLIST_CONTACT_CHANNELS,

          message:
            "The preferred contact channel is invalid.",
        },
        default: "email",
      },

      notificationCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      notifiedAt: {
        type: Date,
        default: null,
      },

      responseDeadline: {
        type: Date,
        default: null,
      },

      acceptedAt: {
        type: Date,
        default: null,
      },

      declinedAt: {
        type: Date,
        default: null,
      },

      bookedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      expiredAt: {
        type: Date,
        default: null,
      },

      expiresAt: {
        type: Date,
        default: null,
      },

      convertedAppointment: {
        type:
          Schema.Types.ObjectId,
        ref: "Appointment",
        default: null,
      },

      statusHistory: {
        type: [
          statusHistorySchema,
        ],
        default: [],
      },

      notificationHistory: {
        type: [
          notificationHistorySchema,
        ],
        default: [],
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

/*
|--------------------------------------------------------------------------
| Virtual properties
|--------------------------------------------------------------------------
*/

waitlistEntrySchema
  .virtual("isActive")
  .get(function getIsActive() {
    return [
      "waiting",
      "notified",
      "accepted",
    ].includes(this.status);
  });

waitlistEntrySchema
  .virtual("isExpired")
  .get(function getIsExpired() {
    return Boolean(
      this.expiresAt &&
        new Date(
          this.expiresAt
        ) <= new Date()
    );
  });

/*
|--------------------------------------------------------------------------
| Validation and normalisation
|--------------------------------------------------------------------------
*/

waitlistEntrySchema.pre(
  "validate",
  function normaliseWaitlistEntry() {
    if (
      Array.isArray(
        this.preferredDates
      )
    ) {
      const uniqueDates =
        new Map();

      for (
        const value of
        this.preferredDates
      ) {
        const date =
          new Date(value);

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          continue;
        }

        date.setHours(
          0,
          0,
          0,
          0
        );

        uniqueDates.set(
          date.toISOString(),
          date
        );
      }

      this.preferredDates =
        Array.from(
          uniqueDates.values()
        ).sort(
          (left, right) =>
            left.getTime() -
            right.getTime()
        );
    }

    if (
      this.dateRangeStart &&
      this.dateRangeEnd &&
      this.dateRangeStart >
        this.dateRangeEnd
    ) {
      this.invalidate(
        "dateRangeEnd",
        "Date range end must be on or after the start date."
      );
    }

    if (
      this.earliestTime &&
      this.latestTime &&
      this.earliestTime >
        this.latestTime
    ) {
      this.invalidate(
        "latestTime",
        "Latest time must be after the earliest time."
      );
    }

    if (
      this.expiresAt &&
      this.status ===
        "waiting" &&
      this.expiresAt <=
        new Date()
    ) {
      this.status =
        "expired";

      this.expiredAt =
        this.expiredAt ||
        new Date();
    }
  }
);

/*
|--------------------------------------------------------------------------
| Status methods
|--------------------------------------------------------------------------
*/

waitlistEntrySchema.methods.changeStatus =
  function changeStatus(
    nextStatus,
    {
      user = null,
      reason = "",
    } = {}
  ) {
    if (
      !WAITLIST_STATUSES.includes(
        nextStatus
      )
    ) {
      throw new Error(
        "The waiting-list status is invalid."
      );
    }

    const previousStatus =
      this.status;

    if (
      previousStatus ===
      nextStatus
    ) {
      return this;
    }

    this.status =
      nextStatus;

    this.updatedBy =
      user || this.updatedBy;

    this.statusHistory.push({
      previousStatus,
      status:
        nextStatus,
      changedAt:
        new Date(),
      changedBy:
        user,
      reason:
        String(
          reason || ""
        ).trim(),
    });

    const now =
      new Date();

    if (
      nextStatus ===
      "notified"
    ) {
      this.notifiedAt =
        now;

      this.notificationCount +=
        1;
    }

    if (
      nextStatus ===
      "accepted"
    ) {
      this.acceptedAt =
        now;
    }

    if (
      nextStatus ===
      "declined"
    ) {
      this.declinedAt =
        now;
    }

    if (
      nextStatus ===
      "booked"
    ) {
      this.bookedAt =
        now;
    }

    if (
      nextStatus ===
      "cancelled"
    ) {
      this.cancelledAt =
        now;
    }

    if (
      nextStatus ===
      "expired"
    ) {
      this.expiredAt =
        now;
    }

    return this;
  };

waitlistEntrySchema.methods.recordNotification =
  function recordNotification({
    channel,
    recipient = "",
    status = "queued",
    communication = null,
    error = "",
  }) {
    this.notificationHistory.push({
      channel,
      recipient:
        String(
          recipient || ""
        ).trim(),
      status,
      communication,
      error:
        String(
          error || ""
        ).trim(),
      sentAt:
        new Date(),
    });

    return this;
  };

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

waitlistEntrySchema.index({
  service: 1,
  stylist: 1,
  status: 1,
  priority: -1,
  createdAt: 1,
});

waitlistEntrySchema.index({
  customer: 1,
  status: 1,
  createdAt: -1,
});

waitlistEntrySchema.index({
  status: 1,
  expiresAt: 1,
});

waitlistEntrySchema.index({
  service: 1,
  preferredDates: 1,
  status: 1,
});

const WaitlistEntry =
  mongoose.models
    .WaitlistEntry ||
  mongoose.model(
    "WaitlistEntry",
    waitlistEntrySchema
  );

export default WaitlistEntry;