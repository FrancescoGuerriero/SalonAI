import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];

const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "partially_paid",
  "refunded",
  "cancelled",
];

const PAYMENT_METHODS = [
  "cash",
  "card",
  "stripe",
  "bank_transfer",
  "gift_card",
  "other",
];

function combineDateAndTime(
  dateValue,
  timeValue
) {
  if (!dateValue) {
    return null;
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  const [
    hours = "0",
    minutes = "0",
  ] = String(
    timeValue || "00:00"
  ).split(":");

  date.setHours(
    Number(hours) || 0,
    Number(minutes) || 0,
    0,
    0
  );

  return date;
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return [
    String(
      date.getHours()
    ).padStart(2, "0"),

    String(
      date.getMinutes()
    ).padStart(2, "0"),
  ].join(":");
}

const rescheduleHistorySchema =
  new Schema(
    {
      previousStylist: {
        type:
          Schema.Types.ObjectId,
        ref: "Stylist",
        default: null,
      },

      newStylist: {
        type:
          Schema.Types.ObjectId,
        ref: "Stylist",
        default: null,
      },

      previousStartsAt: {
        type: Date,
        default: null,
      },

      previousEndsAt: {
        type: Date,
        default: null,
      },

      newStartsAt: {
        type: Date,
        default: null,
      },

      newEndsAt: {
        type: Date,
        default: null,
      },

      reason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      changedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );

const statusHistorySchema =
  new Schema(
    {
      previousStatus: {
        type: String,
        enum:
          APPOINTMENT_STATUSES,
        default: null,
      },

      newStatus: {
        type: String,
        enum:
          APPOINTMENT_STATUSES,
        required: true,
      },

      reason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      changedBy: {
        type:
          Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );

const appointmentSchema =
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

      stylist: {
        type:
          Schema.Types.ObjectId,
        ref: "Stylist",
        required: [
          true,
          "A stylist is required.",
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
      },

      appointmentDate: {
        type: Date,
        required: [
          true,
          "An appointment date is required.",
        ],
        index: true,
      },

      appointmentTime: {
        type: String,
        required: [
          true,
          "An appointment time is required.",
        ],
        trim: true,
        match: [
          /^([01]\d|2[0-3]):[0-5]\d$/,
          "Appointment time must use HH:mm format.",
        ],
      },

      startsAt: {
        type: Date,
        default: null,
        index: true,
      },

      endsAt: {
        type: Date,
        default: null,
        index: true,
      },

      duration: {
        type: Number,
        default: 60,
        min: [
          1,
          "Appointment duration must be at least one minute.",
        ],
        max: [
          1440,
          "Appointment duration cannot exceed 24 hours.",
        ],
      },

      totalPrice: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },

      discount: {
        type: Number,
        default: 0,
        min: 0,
      },

      tax: {
        type: Number,
        default: 0,
        min: 0,
      },

      finalPrice: {
        type: Number,
        default: 0,
        min: 0,
      },

      amountPaid: {
        type: Number,
        default: 0,
        min: 0,
      },

      balanceDue: {
        type: Number,
        default: 0,
        min: 0,
      },

      paymentStatus: {
        type: String,
        enum: {
          values:
            PAYMENT_STATUSES,

          message:
            "Unsupported payment status.",
        },
        default: "pending",
      },

      paymentMethod: {
        type: String,
        enum: {
          values:
            PAYMENT_METHODS,

          message:
            "Unsupported payment method.",
        },
        default: "card",
      },

      stripePaymentIntentId: {
        type: String,
        default: null,
        trim: true,
      },

      invoiceNumber: {
        type: String,
        default: undefined,
        unique: true,
        sparse: true,
        set(value) {
          const normalised =
            String(value ?? "").trim();

          return normalised || undefined;
        },
      },

      status: {
        type: String,
        enum: {
          values:
            APPOINTMENT_STATUSES,

          message:
            "Unsupported appointment status.",
        },
        default: "pending",
        index: true,
      },

      notes: {
        type: String,
        trim: true,
        default: "",
        maxlength: 5000,
      },

      bookingSource: {
        type: String,
        enum: [
          "website",
          "whatsapp",
          "phone",
          "walk_in",
          "management",
          "import",
        ],
        default: "website",
        index: true,
      },

      externalBookingReference: {
        type: String,
        trim: true,
        default: undefined,
        unique: true,
        sparse: true,
        maxlength: 180,
      },

      internalNotes: {
        type: String,
        trim: true,
        default: "",
        maxlength: 5000,
        select: false,
      },

      reminderSent: {
        type: Boolean,
        default: false,
      },

      reminderSentAt: {
        type: Date,
        default: null,
      },

      checkedInAt: {
        type: Date,
        default: null,
      },

      startedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      cancellationReason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      noShowAt: {
        type: Date,
        default: null,
      },

      noShowReason: {
        type: String,
        trim: true,
        default: "",
        maxlength: 1000,
      },

      rescheduledAt: {
        type: Date,
        default: null,
      },

      rescheduleCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      rescheduleHistory: {
        type: [
          rescheduleHistorySchema,
        ],
        default: [],
      },

      statusHistory: {
        type: [
          statusHistorySchema,
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
| Virtual fields
|--------------------------------------------------------------------------
*/

appointmentSchema
  .virtual("isOutstanding")
  .get(function getOutstandingStatus() {
    return (
      Number(
        this.balanceDue
      ) > 0
    );
  });

appointmentSchema
  .virtual("isTerminal")
  .get(function getTerminalStatus() {
    return [
      "completed",
      "cancelled",
      "no_show",
    ].includes(this.status);
  });

/*
|--------------------------------------------------------------------------
| Validation and calculated fields
|--------------------------------------------------------------------------
*/

appointmentSchema.pre(
  "validate",
  function synchroniseAppointmentWindow() {
    let start =
      this.startsAt
        ? new Date(
            this.startsAt
          )
        : combineDateAndTime(
            this.appointmentDate,
            this.appointmentTime
          );

    if (
      start &&
      Number.isNaN(
        start.getTime()
      )
    ) {
      start = null;
    }

    if (start) {
      this.startsAt = start;

      if (
        !this.appointmentDate
      ) {
        this.appointmentDate =
          start;
      }

      if (
        !this.appointmentTime
      ) {
        this.appointmentTime =
          formatTime(start);
      }
    }

    if (
      this.endsAt &&
      start
    ) {
      const end =
        new Date(this.endsAt);

      if (
        Number.isNaN(
          end.getTime()
        ) ||
        end <= start
      ) {
        this.invalidate(
          "endsAt",
          "Appointment end time must be after the start time."
        );

        return;
      }

      this.duration =
        Math.max(
          1,
          Math.round(
            (end.getTime() -
              start.getTime()) /
              60000
          )
        );

      return;
    }

    if (start) {
      const duration =
        Math.max(
          1,
          Number(
            this.duration
          ) || 60
        );

      this.duration =
        duration;

      this.endsAt =
        new Date(
          start.getTime() +
            duration * 60000
        );
    }
  }
);

appointmentSchema.pre(
  "save",
  function calculateFinancialFields() {
    const totalPrice =
      Number(
        this.totalPrice
      ) || 0;

    const discount =
      Number(
        this.discount
      ) || 0;

    const tax =
      Number(this.tax) || 0;

    const amountPaid =
      Number(
        this.amountPaid
      ) || 0;

    const discountedPrice =
      Math.max(
        totalPrice -
          discount,
        0
      );

    this.finalPrice =
      discountedPrice + tax;

    this.balanceDue =
      Math.max(
        this.finalPrice -
          amountPaid,
        0
      );

    if (
      ![
        "refunded",
        "cancelled",
      ].includes(
        this.paymentStatus
      )
    ) {
      if (
        amountPaid <= 0
      ) {
        this.paymentStatus =
          "pending";
      } else if (
        amountPaid <
        this.finalPrice
      ) {
        this.paymentStatus =
          "partially_paid";
      } else {
        this.paymentStatus =
          "paid";
      }
    }
  }
);

/*
|--------------------------------------------------------------------------
| Document methods
|--------------------------------------------------------------------------
*/

appointmentSchema.methods.recordStatusChange =
  function recordStatusChange({
    status,
    reason = "",
    changedBy = null,
  }) {
    const previousStatus =
      this.status;

    this.status = status;

    this.statusHistory.push({
      previousStatus,
      newStatus: status,
      reason:
        String(
          reason || ""
        ).trim(),
      changedBy,
      changedAt:
        new Date(),
    });

    const now =
      new Date();

    if (
      status ===
      "checked_in"
    ) {
      this.checkedInAt =
        now;
    }

    if (
      status ===
      "in_progress"
    ) {
      this.startedAt =
        now;
    }

    if (
      status ===
      "completed"
    ) {
      this.completedAt =
        now;
    }

    if (
      status ===
      "cancelled"
    ) {
      this.cancelledAt =
        now;

      this.cancellationReason =
        String(
          reason || ""
        ).trim();

      this.paymentStatus =
        this.amountPaid > 0
          ? this.paymentStatus
          : "cancelled";
    }

    if (
      status ===
      "no_show"
    ) {
      this.noShowAt =
        now;

      this.noShowReason =
        String(
          reason || ""
        ).trim();
    }

    return this;
  };

appointmentSchema.methods.recordReschedule =
  function recordReschedule({
    stylist,
    startsAt,
    endsAt,
    reason = "",
    changedBy = null,
  }) {
    this.rescheduleHistory.push({
      previousStylist:
        this.stylist,

      newStylist:
        stylist ||
        this.stylist,

      previousStartsAt:
        this.startsAt,

      previousEndsAt:
        this.endsAt,

      newStartsAt:
        startsAt,

      newEndsAt:
        endsAt,

      reason:
        String(
          reason || ""
        ).trim(),

      changedBy,

      changedAt:
        new Date(),
    });

    this.stylist =
      stylist ||
      this.stylist;

    this.startsAt =
      startsAt;

    this.endsAt =
      endsAt;

    this.appointmentDate =
      startsAt;

    this.appointmentTime =
      formatTime(
        startsAt
      );

    this.duration =
      Math.max(
        1,
        Math.round(
          (new Date(
            endsAt
          ).getTime() -
            new Date(
              startsAt
            ).getTime()) /
            60000
        )
      );

    this.rescheduleCount +=
      1;

    this.rescheduledAt =
      new Date();

    return this;
  };

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

appointmentSchema.index({
  appointmentDate: 1,
  stylist: 1,
});

appointmentSchema.index({
  stylist: 1,
  startsAt: 1,
  endsAt: 1,
  status: 1,
});

appointmentSchema.index({
  customer: 1,
  appointmentDate: -1,
});

appointmentSchema.index({
  status: 1,
  appointmentDate: 1,
});

appointmentSchema.index({
  paymentStatus: 1,
});

const Appointment =
  mongoose.models
    .Appointment ||
  mongoose.model(
    "Appointment",
    appointmentSchema
  );

export {
  APPOINTMENT_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
};

export default Appointment;
