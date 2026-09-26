import mongoose from "mongoose";

const { Schema } = mongoose;

export const LOCATION_STATUSES = Object.freeze([
  "active",
  "inactive",
  "suspended",
  "archived",
]);

const inheritedSettingsSchema = new Schema(
  {
    timezone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    locale: {
      type: String,
      trim: true,
      default: "",
      maxlength: 35,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 3,
      validate: {
        validator(value) {
          return !value || /^[A-Z]{3}$/.test(value);
        },
        message: "Location currency override must be a 3-letter code.",
      },
    },
  },
  { _id: false }
);

const hierarchySchema = new Schema(
  {
    brandKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    regionKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    zoneKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
    businessUnitKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 80,
    },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 80,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Location slug may contain lowercase letters, numbers and single hyphens.",
      ],
    },

    status: {
      type: String,
      enum: LOCATION_STATUSES,
      default: "active",
      index: true,
    },

    hierarchy: {
      type: hierarchySchema,
      default: () => ({}),
    },

    settings: {
      type: inheritedSettingsSchema,
      default: () => ({}),
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index(
  {
    business: 1,
    slug: 1,
  },
  {
    unique: true,
  }
);

locationSchema.index({
  business: 1,
  status: 1,
  name: 1,
});

locationSchema.index({
  business: 1,
  "hierarchy.regionKey": 1,
  "hierarchy.zoneKey": 1,
  status: 1,
});

const Location =
  mongoose.models.Location ||
  mongoose.model("Location", locationSchema);

export default Location;
