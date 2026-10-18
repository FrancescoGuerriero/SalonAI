import mongoose from "mongoose";

const supplierContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 180 },
    phone: { type: String, trim: true, maxlength: 60 },
    role: { type: String, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const supplierAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 180 },
    line2: { type: String, trim: true, maxlength: 180 },
    city: { type: String, trim: true, maxlength: 120 },
    postcode: { type: String, trim: true, maxlength: 30 },
    country: {
      type: String,
      trim: true,
      default: "United Kingdom",
      maxlength: 120,
    },
  },
  { _id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    // Transitional #476 ownership. Required after the guarded ownership
    // migration is production-accepted; optional during backfill compatibility.
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    // Optional provenance for suppliers configured for one primary Location.
    // A missing location means Business-wide supplier availability.
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: undefined,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      index: true,
    },
    accountReference: { type: String, trim: true, maxlength: 100 },
    website: { type: String, trim: true, maxlength: 300 },
    contacts: { type: [supplierContactSchema], default: [] },
    address: { type: supplierAddressSchema, default: {} },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: 30 },
    standardLeadTimeDays: { type: Number, min: 0, max: 365, default: 7 },
    minimumOrderValue: { type: Number, min: 0, default: 0 },
    preferred: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, maxlength: 3000 },
    performance: {
      totalOrders: { type: Number, min: 0, default: 0 },
      completedOrders: { type: Number, min: 0, default: 0 },
      lateDeliveries: { type: Number, min: 0, default: 0 },
      damagedUnits: { type: Number, min: 0, default: 0 },
      receivedUnits: { type: Number, min: 0, default: 0 },
      averageDeliveryDays: { type: Number, min: 0, default: 0 },
      lastOrderAt: { type: Date },
      lastDeliveryAt: { type: Date },
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

supplierSchema.index({ name: "text", code: "text", accountReference: "text" });
supplierSchema.index({ business: 1, active: 1, preferred: -1, name: 1 });
supplierSchema.index({ business: 1, location: 1, active: 1, name: 1 });
supplierSchema.index(
  { business: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { business: { $type: "objectId" } },
    name: "supplier_business_code_unique",
  }
);

const Supplier =
  mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);

export default Supplier;
