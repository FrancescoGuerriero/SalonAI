import mongoose from "mongoose";

import { TENANT_SUBSCRIPTION_STATES } from "../platform/subscriptions/tenantSubscriptionLifecycle.js";
import { getTenantPlan } from "../platform/subscriptions/tenantPlanRegistry.js";

const { Schema } = mongoose;

const entitlementGrantSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true, default: "plan" },
    limit: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const providerBindingSchema = new Schema(
  {
    provider: { type: String, trim: true, default: "", maxlength: 80 },
    customerRef: { type: String, trim: true, default: "", maxlength: 255 },
    subscriptionRef: { type: String, trim: true, default: "", maxlength: 255 },
    lastEventId: { type: String, trim: true, default: "", maxlength: 255 },
    lastEventAt: { type: Date, default: null },
  },
  { _id: false }
);

const tenantSubscriptionSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    planKey: { type: String, required: true, trim: true, lowercase: true, default: "standard" },
    planVersion: { type: String, required: true, trim: true, default: "1" },
    status: {
      type: String,
      enum: TENANT_SUBSCRIPTION_STATES,
      required: true,
      default: "provisioning",
      index: true,
    },
    entitlementGrants: { type: [entitlementGrantSchema], default: [] },
    lifecycleRevision: { type: Number, required: true, min: 1, default: 1 },
    lastTransitionFingerprint: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [/^$|^[a-f0-9]{64}$/, "Transition fingerprint must be empty or a SHA-256 hex digest."],
    },
    trialStartedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
    suspendedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    providerBinding: { type: providerBindingSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, optimisticConcurrency: true }
);

tenantSubscriptionSchema.index({ status: 1, planKey: 1 });

tenantSubscriptionSchema.pre("validate", function validateTenantPlanReference() {
  try {
    const plan = getTenantPlan(this.planKey);
    if (String(this.planVersion || "").trim() !== plan.version) {
      this.invalidate("planVersion", "Tenant plan version is not registered.");
    }
  } catch (error) {
    this.invalidate("planKey", error.message);
  }
});

const TenantSubscription =
  mongoose.models.TenantSubscription || mongoose.model("TenantSubscription", tenantSubscriptionSchema);

export default TenantSubscription;
