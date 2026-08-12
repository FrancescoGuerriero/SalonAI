import mongoose from "mongoose";

import {
  isSupportedProfileImage,
} from "../utils/profileMedia.js";

const {
  Schema,
} = mongoose;

const USER_ROLES = [
  "customer",
  "stylist",
  "manager",
  "admin",
];

const addressSchema = new Schema(
  {
    line1: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },
    line2: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    county: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },
    postcode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 20,
    },
    country: {
      type: String,
      trim: true,
      default: "United Kingdom",
      maxlength: 100,
    },
  },
  {
    _id: false,
  }
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [
        true,
        "User name is required.",
      ],
      trim: true,
      maxlength: [
        120,
        "User name cannot exceed 120 characters.",
      ],
    },

    email: {
      type: String,
      required: [
        true,
        "Email address is required.",
      ],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [
        254,
        "Email address cannot exceed 254 characters.",
      ],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "A valid email address is required.",
      ],
    },

    password: {
      type: String,
      required: [
        true,
        "Password is required.",
      ],
      minlength: [
        6,
        "Password must contain at least 6 characters.",
      ],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message:
          "User role must be customer, stylist, manager or admin.",
      },
      default: "customer",
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },

    profilePhoto: {
      type: String,
      trim: true,
      default: "",
      maxlength: [
        650000,
        "Profile photo data is too large.",
      ],
      validate: {
        validator(value) {
          return isSupportedProfileImage(
            value
          );
        },
        message:
          "Profile photo must be an HTTPS URL or a supported JPEG, PNG or WebP upload.",
      },
    },

    homeAddress: {
      type: addressSchema,
      default: () => ({}),
    },

    /*
     * Links a login account to its separate
     * salon CRM customer record.
     *
     * The field is intentionally optional
     * because stylists, managers and
     * administrators do not require a
     * Customer document.
     */
    customerProfile: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      unique: true,
      sparse: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
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

    toJSON: {
      virtuals: true,

      transform(
        document,
        returnedObject
      ) {
        delete returnedObject.password;
        delete returnedObject.__v;

        return returnedObject;
      },
    },

    toObject: {
      virtuals: true,

      transform(
        document,
        returnedObject
      ) {
        delete returnedObject.password;
        delete returnedObject.__v;

        return returnedObject;
      },
    },
  }
);

/*
|--------------------------------------------------------------------------
| Virtual properties
|--------------------------------------------------------------------------
*/

userSchema
  .virtual("isManagementUser")
  .get(function getManagementStatus() {
    return [
      "stylist",
      "manager",
      "admin",
    ].includes(this.role);
  });

userSchema
  .virtual("hasCustomerProfile")
  .get(function getCustomerProfileStatus() {
    return Boolean(
      this.customerProfile
    );
  });

/*
|--------------------------------------------------------------------------
| Validation and normalisation
|--------------------------------------------------------------------------
*/

userSchema.pre(
  "validate",
  function normaliseUser() {
    if (this.email) {
      this.email = String(
        this.email
      )
        .trim()
        .toLowerCase();
    }

    if (
      this.customerProfile ===
      ""
    ) {
      this.customerProfile =
        undefined;
    }
  }
);

/*
|--------------------------------------------------------------------------
| User methods
|--------------------------------------------------------------------------
*/

userSchema.methods.canManageSalon =
  function canManageSalon() {
    return [
      "stylist",
      "manager",
      "admin",
    ].includes(this.role);
  };

userSchema.methods.isAdministrator =
  function isAdministrator() {
    return this.role === "admin";
  };

userSchema.methods.recordLogin =
  function recordLogin() {
    this.lastLoginAt =
      new Date();

    return this;
  };

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

userSchema.index({
  role: 1,
  isActive: 1,
});

userSchema.index({
  createdAt: -1,
});

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

export {
  USER_ROLES,
};

export default User;
