import mongoose from "mongoose";

const ruleSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      enum: [
        "appointmentCount",
        "totalSpend",
        "daysSinceLastAppointment",
        "preferredService",
        "preferredStylist",
        "tag",
        "createdAt",
      ],
    },
    operator: {
      type: String,
      required: true,
      enum: [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "in",
        "not_in",
        "contains",
      ],
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const customerSegmentSchema =
  new mongoose.Schema(
    {
      // Legacy segment rows can remain unowned until the controlled backfill.
      // Point 6 service writes require trusted business ownership.
      business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
        default: undefined,
        index: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },
      description: {
        type: String,
        default: "",
        maxlength: 500,
      },
      matchMode: {
        type: String,
        enum: ["all", "any"],
        default: "all",
      },
      rules: {
        type: [ruleSchema],
        default: [],
      },
      staticCustomers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
      ],
      active: {
        type: Boolean,
        default: true,
        index: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    {
      timestamps: true,
      optimisticConcurrency: true,
    }
  );

customerSegmentSchema.index(
  { business: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: {
      business: { $type: "objectId" },
    },
  }
);
customerSegmentSchema.index({ business: 1, active: 1, updatedAt: -1 });

const CustomerSegment =
  mongoose.models.CustomerSegment ||
  mongoose.model(
    "CustomerSegment",
    customerSegmentSchema
  );

export default CustomerSegment;
