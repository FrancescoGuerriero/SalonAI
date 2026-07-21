import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },

    appointmentTime: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number,
      default: 60,
      min: 1,
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
      enum: [
        "pending",
        "paid",
        "partially_paid",
        "refunded",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "card",
        "stripe",
        "bank_transfer",
        "gift_card",
        "other",
      ],
      default: "card",
    },

    stripePaymentIntentId: {
      type: String,
      default: null,
      trim: true,
    },

    invoiceNumber: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "pending",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    internalNotes: {
      type: String,
      trim: true,
      default: "",
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
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.pre("save", function calculateFinancialFields(next) {
  const totalPrice = Number(this.totalPrice) || 0;
  const discount = Number(this.discount) || 0;
  const tax = Number(this.tax) || 0;
  const amountPaid = Number(this.amountPaid) || 0;

  const discountedPrice = Math.max(totalPrice - discount, 0);

  this.finalPrice = discountedPrice + tax;
  this.balanceDue = Math.max(this.finalPrice - amountPaid, 0);

  if (
    this.paymentStatus !== "refunded" &&
    this.paymentStatus !== "cancelled"
  ) {
    if (amountPaid <= 0) {
      this.paymentStatus = "pending";
    } else if (amountPaid < this.finalPrice) {
      this.paymentStatus = "partially_paid";
    } else {
      this.paymentStatus = "paid";
    }
  }

  next();
});

appointmentSchema.index({
  appointmentDate: 1,
  stylist: 1,
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
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

export default Appointment;