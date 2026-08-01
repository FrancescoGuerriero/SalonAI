import mongoose from "mongoose";

const supplierContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 100,
    },
  },
  {
    _id: false,
  }
);

const supplierAddressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    line2: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    postcode: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    country: {
      type: String,
      trim: true,
      default: "United Kingdom",
      maxlength: 120,
    },
  },
  {
    _id: false,
  }
);

const supplierSchema = new mongoose.Schema(
  {
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
      unique: true,
      index: true,
    },
    accountReference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    contacts: {
      type: [supplierContactSchema],
      default: [],
    },
    address: {
      type: supplierAddressSchema,
      default: {},
    },
    paymentTermsDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 30,
    },
    standardLeadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 7,
    },
    minimumOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    preferred: {
      type: Boolean,
      default: false,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    performance: {
      totalOrders: {
        type: Number,
        min: 0,
        default: 0,
      },
      completedOrders: {
        type: Number,
        min: 0,
        default: 0,
      },
      lateDeliveries: {
        type: Number,
        min: 0,
        default: 0,
      },
      damagedUnits: {
        type: Number,
        min: 0,
        default: 0,
      },
      receivedUnits: {
        type: Number,
        min: 0,
        default: 0,
      },
      averageDeliveryDays: {
        type: Number,
        min: 0,
        default: 0,
      },
      lastOrderAt: {
        type: Date,
      },
      lastDeliveryAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

supplierSchema.index({
  name: "text",
  code: "text",
  accountReference: "text",
});

const Supplier =
  mongoose.models.Supplier ||
  mongoose.model(
    "Supplier",
    supplierSchema
  );

export default Supplier;
