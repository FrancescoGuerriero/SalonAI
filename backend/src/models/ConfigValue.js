import mongoose from "mongoose";

const { Schema } = mongoose;

export const CONFIG_SCOPE_TYPES = Object.freeze([
  "platform",
  "vertical",
  "business",
  "brand",
  "region",
  "zone",
  "location",
  "business-unit",
]);

export const CONFIG_INHERITANCE_MODES = Object.freeze([
  "inherit",
  "override",
  "locked-by-parent",
  "disabled",
]);

export const CONFIG_VALUE_STATUSES = Object.freeze([
  "draft",
  "active",
  "retired",
]);

const configValueSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: null,
      index: true,
    },
    scopeType: {
      type: String,
      enum: CONFIG_SCOPE_TYPES,
      required: true,
      index: true,
    },
    scopeKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    configKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      match: [
        /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
        "Configuration keys may contain lowercase letters, numbers, dots, underscores and hyphens.",
      ],
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
    inheritanceMode: {
      type: String,
      enum: CONFIG_INHERITANCE_MODES,
      default: "override",
      required: true,
    },
    version: {
      type: Number,
      min: 1,
      default: 1,
      required: true,
    },
    status: {
      type: String,
      enum: CONFIG_VALUE_STATUSES,
      default: "draft",
      required: true,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: null,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

configValueSchema.pre("validate", function validateScope() {
  if (this.scopeType === "platform") {
    this.business = null;
    this.scopeKey = "platform";
  } else if (!this.business) {
    this.invalidate(
      "business",
      "Non-platform configuration values require a business."
    );
  }

  if (
    this.effectiveFrom &&
    this.effectiveTo &&
    this.effectiveTo <= this.effectiveFrom
  ) {
    this.invalidate(
      "effectiveTo",
      "effectiveTo must be later than effectiveFrom."
    );
  }
});

configValueSchema.index(
  {
    business: 1,
    scopeType: 1,
    scopeKey: 1,
    configKey: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

configValueSchema.index({
  business: 1,
  scopeType: 1,
  scopeKey: 1,
  status: 1,
  effectiveFrom: 1,
  effectiveTo: 1,
});

const ConfigValue =
  mongoose.models.ConfigValue ||
  mongoose.model("ConfigValue", configValueSchema);

export default ConfigValue;
