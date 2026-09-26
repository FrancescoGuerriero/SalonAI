import mongoose from "mongoose";

const { Schema } = mongoose;

export const BUSINESS_MEMBERSHIP_STATUSES = Object.freeze([
  "active",
  "suspended",
  "revoked",
]);

export const LOCATION_ACCESS_MODES = Object.freeze([
  "all",
  "selected",
]);

const businessMembershipSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: BUSINESS_MEMBERSHIP_STATUSES,
      default: "active",
      index: true,
    },

    roleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 40,
      match: [
        /^[a-z][a-z0-9_]{2,39}$/,
        "Business membership role must use a valid role key.",
      ],
      index: true,
    },

    locationAccessMode: {
      type: String,
      enum: LOCATION_ACCESS_MODES,
      default: "selected",
      index: true,
    },

    locations: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Location",
        },
      ],
      default: [],
    },

    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

businessMembershipSchema.pre("validate", function normaliseMembership() {
  if (this.locationAccessMode === "all") {
    this.locations = [];
  }

  if (Array.isArray(this.locations)) {
    const unique = new Map();

    for (const value of this.locations) {
      const id = String(value || "").trim();
      if (mongoose.Types.ObjectId.isValid(id)) {
        unique.set(id, new mongoose.Types.ObjectId(id));
      }
    }

    this.locations = [...unique.values()];
  }
});

businessMembershipSchema.index(
  {
    user: 1,
    business: 1,
  },
  {
    unique: true,
  }
);

businessMembershipSchema.index(
  {
    user: 1,
    isDefault: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      isDefault: true,
      status: "active",
    },
  }
);

businessMembershipSchema.index({
  business: 1,
  status: 1,
  roleKey: 1,
});

businessMembershipSchema.index({
  user: 1,
  status: 1,
  isDefault: -1,
});

const BusinessMembership =
  mongoose.models.BusinessMembership ||
  mongoose.model("BusinessMembership", businessMembershipSchema);

export default BusinessMembership;
