import mongoose from "mongoose";

const invoiceLineSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["service", "product", "service_package", "other"],
      default: "other",
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: undefined,
    },
    description: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: undefined,
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: undefined,
      unique: true,
      sparse: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: undefined,
      unique: true,
      sparse: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["appointment", "order"],
      required: true,
      index: true,
    },
    currency: {
      type: String,
      default: "GBP",
      uppercase: true,
      trim: true,
    },
    lines: {
      type: [invoiceLineSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      min: 0,
      default: 0,
    },
    amountPaid: {
      type: Number,
      min: 0,
      default: 0,
    },
    amountRefunded: {
      type: Number,
      min: 0,
      default: 0,
    },
    balanceDue: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "issued",
        "partially_paid",
        "paid",
        "partially_refunded",
        "refunded",
        "void",
      ],
      default: "issued",
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    voidedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

invoiceSchema.pre("validate", function validateSource(next) {
  const sourceCount = Number(Boolean(this.appointment)) + Number(Boolean(this.order));

  if (sourceCount !== 1) {
    return next(
      new Error("An invoice must reference exactly one appointment or order.")
    );
  }

  if (this.sourceType === "appointment" && !this.appointment) {
    return next(new Error("Appointment invoices require an appointment reference."));
  }

  if (this.sourceType === "order" && !this.order) {
    return next(new Error("Order invoices require an order reference."));
  }

  return next();
});

invoiceSchema.pre("save", function assignInvoiceNumber() {
  if (!this.invoiceNumber) {
    const date = new Date(this.issuedAt || Date.now())
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");
    const suffix = String(this._id).slice(-6).toUpperCase();
    this.invoiceNumber = `INV-${date}-${suffix}`;
  }
});

const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

export default Invoice;
