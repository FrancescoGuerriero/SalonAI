import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["product", "appointment"],
      default: "product",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: undefined,
      required() {
        return this.itemType === "product";
      },
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: undefined,
      required() {
        return this.itemType === "appointment";
      },
    },
    appointmentPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: undefined,
    },
    paymentPurpose: {
      type: String,
      enum: ["appointment_deposit", "appointment_balance"],
      default: undefined,
      required() {
        return this.itemType === "appointment";
      },
    },
    sku: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      min: 1,
      required: true,
    },
    unitPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    lineTotal: {
      type: Number,
      min: 0,
      required: true,
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    postcode: { type: String, trim: true, uppercase: true, default: "" },
    country: { type: String, trim: true, default: "United Kingdom" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    contact: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, trim: true, default: "" },
    },
    items: {
      type: [orderItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    subtotal: { type: Number, min: 0, default: 0 },
    appointmentSubtotal: { type: Number, min: 0, default: 0 },
    deliveryFee: { type: Number, min: 0, default: 0 },
    discountTotal: { type: Number, min: 0, default: 0 },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "SalonOffer", default: null },
    offerCode: { type: String, trim: true, uppercase: true, default: "" },
    discountDescription: { type: String, trim: true, maxlength: 200, default: "" },
    total: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "GBP", uppercase: true },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "paid",
        "processing",
        "ready",
        "completed",
        "cancelled",
        "refunded",
      ],
      default: "pending_payment",
      index: true,
    },
    fulfilmentType: {
      type: String,
      enum: ["collection", "delivery"],
      default: "collection",
    },
    deliveryAddress: {
      type: addressSchema,
      default: undefined,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    notes: { type: String, trim: true, default: "", maxlength: 1000 },
    inventoryCommittedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

orderSchema.pre("save", function assignOrderNumber() {
  if (!this.orderNumber) {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const suffix = String(this._id).slice(-6).toUpperCase();
    this.orderNumber = `SA-${date}-${suffix}`;
  }

});

const Order =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);

export default Order;
