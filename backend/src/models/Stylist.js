import mongoose from "mongoose";

import {
  isSupportedProfileImage,
} from "../utils/profileMedia.js";

const breakSchema = new mongoose.Schema(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const workingHoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },

    start: {
      type: String,
      default: "09:00",
    },

    end: {
      type: String,
      default: "17:00",
    },

    available: {
      type: Boolean,
      default: true,
    },

    breaks: {
      type: [breakSchema],
      default: [],
    },
  },
  { _id: false }
);

const stylistSchema = new mongoose.Schema(
  {
    // Transitional Roadmap v3 ownership fields. They remain optional until
    // the canonical Salon AI workforce has passed dry-run/backfill gates.
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },

    workingLocations: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Location",
        },
      ],
      default: [],
    },

    userAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },

    jobTitle: {
      type: String,
      trim: true,
      default: "Hair professional",
      maxlength: 120,
    },

    biography: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: [
        650000,
        "Profile image data is too large.",
      ],
      validate: {
        validator(value) {
          return isSupportedProfileImage(value);
        },
        message:
          "Profile image must be an HTTPS URL or a supported JPEG, PNG or WebP upload.",
      },
    },

    yearsExperience: {
      type: Number,
      default: 0,
      min: 0,
      max: 80,
    },

    specialties: [
      {
        type: String,
        trim: true,
        maxlength: 120,
      },
    ],

    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],

    workingHours: {
      type: [workingHoursSchema],
      default: [
        { day: "Monday" },
        { day: "Tuesday" },
        { day: "Wednesday" },
        { day: "Thursday" },
        { day: "Friday" },
        {
          day: "Saturday",
          start: "09:00",
          end: "15:00",
        },
        {
          day: "Sunday",
          available: false,
        },
      ],
    },

    languages: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],

    instagram: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    facebook: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    website: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },

    reviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    profilePublished: {
      type: Boolean,
      default: true,
      index: true,
    },

    displayOrder: {
      type: Number,
      default: 100,
      min: 0,
      max: 10000,
    },

    acceptsAppointments: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

stylistSchema.pre(
  "validate",
  function normaliseWorkforceOwnership() {
    if (
      Array.isArray(
        this.workingLocations
      )
    ) {
      const unique =
        new Map();

      for (
        const value of
          this.workingLocations
      ) {
        const id =
          String(
            value || ""
          ).trim();

        if (
          mongoose.Types.ObjectId.isValid(
            id
          )
        ) {
          unique.set(
            id,
            new mongoose.Types.ObjectId(
              id
            )
          );
        }
      }

      this.workingLocations =
        [...unique.values()];
    }
  }
);

stylistSchema.virtual("fullName").get(function getFullName() {
  return `${this.firstName} ${this.lastName}`;
});

stylistSchema.set("toJSON", {
  virtuals: true,
});

stylistSchema.set("toObject", {
  virtuals: true,
});

stylistSchema.index(
  {
    userAccount: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      userAccount: {
        $type: "objectId",
      },
    },
  }
);

stylistSchema.index({
  isActive: 1,
  acceptsAppointments: 1,
  profilePublished: 1,
  displayOrder: 1,
  firstName: 1,
});

stylistSchema.index({
  business: 1,
  isActive: 1,
  acceptsAppointments: 1,
  profilePublished: 1,
  displayOrder: 1,
});

stylistSchema.index({
  business: 1,
  workingLocations: 1,
  isActive: 1,
});

const Stylist =
  mongoose.models.Stylist ||
  mongoose.model(
    "Stylist",
    stylistSchema
  );

export default Stylist;
