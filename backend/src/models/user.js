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
  "receptionist",
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
          "User role must be customer, stylist, receptionist, manager or admin.",
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
      index: true,
    },

    emailVerificationRequired: {
      type: Boolean,
      default: false,
      index: true,
    },

    emailVerificationTokenHash: {
      type: String,
      default: "",
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    lastVerificationEmailSentAt: {
      type: Date,
      default: null,
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
        delete returnedObject.emailVerificationTokenHash;
        delete returnedObject.emailVerificationExpiresAt;
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
        delete returnedObject.emailVerificationTokenHash;
        delete returnedObject.emailVerificationExpiresAt;
        delete returnedObject.__v;

        return returnedObject;
      },
    },
  }
);

userSchema
  .virtual("isManagementUser")
  .get(function getManagementStatus() {
    return [
      "stylist",
      "receptionist",
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

userSchema.methods.canManageSalon =
  function canManageSalon() {
    return [
      "stylist",
      "receptionist",
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
