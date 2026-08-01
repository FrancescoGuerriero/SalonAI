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
      name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
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
    }
  );

const CustomerSegment =
  mongoose.models.CustomerSegment ||
  mongoose.model(
    "CustomerSegment",
    customerSegmentSchema
  );

export default CustomerSegment;
