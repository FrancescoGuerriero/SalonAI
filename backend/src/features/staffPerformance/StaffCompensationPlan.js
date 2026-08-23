import mongoose from "mongoose";

const commissionTierSchema = new mongoose.Schema(
  {
    threshold: {
      type: Number,
      required: true,
      min: 0,
    },
    ratePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  {
    _id: false,
  }
);

const commissionRuleSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    basis: {
      type: String,
      enum: ["earned", "collected", "subtotal", "total"],
      required: true,
    },
    ratePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tiers: {
      type: [commissionTierSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const monthlyTargetSchema = new mongoose.Schema(
  {
    serviceRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    retailRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedAppointments: {
      type: Number,
      default: 0,
      min: 0,
    },
    rebookingRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    productivityRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 300,
    },
  },
  {
    _id: false,
  }
);

const staffCompensationPlanSchema = new mongoose.Schema(
  {
    stylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      required: true,
      unique: true,
    },
    serviceCommission: {
      type: commissionRuleSchema,
      default: () => ({
        enabled: false,
        basis: "earned",
        ratePercent: 0,
        tiers: [],
      }),
    },
    retailCommission: {
      type: commissionRuleSchema,
      default: () => ({
        enabled: false,
        basis: "subtotal",
        ratePercent: 0,
        tiers: [],
      }),
    },
    monthlyTargets: {
      type: monthlyTargetSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    active: {
      type: Boolean,
      default: true,
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

staffCompensationPlanSchema.pre("validate", function normaliseTiers() {
  for (const ruleName of ["serviceCommission", "retailCommission"]) {
    const rule = this[ruleName];

    if (!rule || !Array.isArray(rule.tiers)) {
      continue;
    }

    rule.tiers = [...rule.tiers]
      .map((tier) => ({
        threshold: Number(tier.threshold) || 0,
        ratePercent: Number(tier.ratePercent) || 0,
      }))
      .sort((first, second) => first.threshold - second.threshold);
  }

  return;
});

const StaffCompensationPlan =
  mongoose.models.StaffCompensationPlan ||
  mongoose.model("StaffCompensationPlan", staffCompensationPlanSchema);

export default StaffCompensationPlan;
