import mongoose from "mongoose";

const { Schema } = mongoose;

const checklistItemSchema = new Schema(
  {
    key: {
      type: String,
      trim: true,
      required: true,
    },

    label: {
      type: String,
      trim: true,
      default: "",
    },

    completed: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  {
    _id: false,
  }
);

const paymentBreakdownSchema = new Schema(
  {
    cash: {
      type: Number,
      default: 0,
      min: 0,
    },

    card: {
      type: Number,
      default: 0,
      min: 0,
    },

    stripe: {
      type: Number,
      default: 0,
      min: 0,
    },

    bankTransfer: {
      type: Number,
      default: 0,
      min: 0,
    },

    giftCard: {
      type: Number,
      default: 0,
      min: 0,
    },

    other: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const auditEntrySchema = new Schema(
  {
    action: {
      type: String,
      trim: true,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    at: {
      type: Date,
      default: Date.now,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: true,
  }
);

const dailyCloseSchema = new Schema(
  {
    businessDate: {
      type: Date,
      required: true,
    },

    dateKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "closed",
        "reopened",
      ],
      default: "draft",
      index: true,
    },

    checklist: {
      type: [checklistItemSchema],
      default: [],
    },

    serviceRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    productRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCollected: {
      type: Number,
      default: 0,
      min: 0,
    },

    outstandingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    expectedCash: {
      type: Number,
      default: 0,
      min: 0,
    },

    countedCash: {
      type: Number,
      default: 0,
      min: 0,
    },

    cashVariance: {
      type: Number,
      default: 0,
    },

    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: () => ({}),
    },

    unresolvedAppointments: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    snapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },

    overrideUnresolved: {
      type: Boolean,
      default: false,
    },

    overrideReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
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

    closedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reopenedAt: {
      type: Date,
      default: null,
    },

    reopenReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    auditTrail: {
      type: [auditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false,
    minimize: false,
  }
);

dailyCloseSchema.pre(
  "validate",
  function calculateCashVariance() {
    const expected = Number(
      this.expectedCash || 0
    );

    const counted = Number(
      this.countedCash || 0
    );

    this.cashVariance = Number(
      (counted - expected).toFixed(2)
    );


  }
);

dailyCloseSchema.index(
  {
    businessDate: 1,
  },
  {
    unique: true,
  }
);

const DailyClose =
  mongoose.models.DailyClose ||
  mongoose.model(
    "DailyClose",
    dailyCloseSchema
  );

export default DailyClose;

