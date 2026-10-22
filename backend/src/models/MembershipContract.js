import mongoose from "mongoose";

const { Schema } = mongoose;

export const MEMBERSHIP_CONTRACT_STATUSES = Object.freeze([
  "trial",
  "active",
  "frozen",
  "past_due",
  "cancelled",
  "expired",
]);

const benefitWalletSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueInstrument",
      required: true,
    },
    unit: {
      type: String,
      enum: ["money", "quantity", "points"],
      required: true,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 3,
    },
  },
  {
    _id: false,
  }
);

const membershipContractSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    homeLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
      index: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: MEMBERSHIP_CONTRACT_STATUSES,
      default: "active",
      index: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    renewsAt: {
      type: Date,
      default: null,
      index: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    frozenAt: {
      type: Date,
      default: null,
    },
    resumesAt: {
      type: Date,
      default: null,
    },
    freezeDaysUsed: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Compatibility pointer for older single-benefit consumers. New membership
    // benefit state lives in benefitWallets and the immutable stored-value ledger.
    benefitInstrument: {
      type: Schema.Types.ObjectId,
      ref: "StoredValueInstrument",
      default: null,
      index: true,
    },
    benefitWallets: {
      type: [benefitWalletSchema],
      default: [],
    },
    familyMemberCustomers: {
      type: [{ type: Schema.Types.ObjectId, ref: "Customer" }],
      default: [],
    },
    paymentProvider: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    paymentProviderSubscriptionId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
    },
    collectionStatus: {
      type: String,
      enum: ["not_due", "due", "collecting", "paid", "failed", "cancelled"],
      default: "not_due",
      index: true,
    },
    lastCollectionAt: {
      type: Date,
      default: null,
    },
    nextCollectionAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

membershipContractSchema.index({
  business: 1,
  customer: 1,
  status: 1,
});

membershipContractSchema.index({
  business: 1,
  "benefitWallets.instrument": 1,
});

membershipContractSchema.index(
  {
    business: 1,
    paymentProvider: 1,
    paymentProviderSubscriptionId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      paymentProviderSubscriptionId: { $type: "string", $gt: "" },
    },
  }
);

export default (
  mongoose.models.MembershipContract ||
  mongoose.model("MembershipContract", membershipContractSchema)
);
