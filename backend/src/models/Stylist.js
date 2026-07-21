import mongoose from "mongoose";

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
        "Sunday"
      ],
      required: true
    },

    start: {
      type: String,
      default: "09:00"
    },

    end: {
      type: String,
      default: "17:00"
    },

    available: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
);

const stylistSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true
    },

    lastName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: {
      type: String,
      default: ""
    },

    biography: {
      type: String,
      default: ""
    },

    profileImage: {
      type: String,
      default: ""
    },

    yearsExperience: {
      type: Number,
      default: 0
    },

    specialties: [
      {
        type: String
      }
    ],

    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
      }
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
          end: "15:00"
        },
        {
          day: "Sunday",
          available: false
        }
      ]
    },

    languages: [
      {
        type: String
      }
    ],

    instagram: {
      type: String,
      default: ""
    },

    facebook: {
      type: String,
      default: ""
    },

    website: {
      type: String,
      default: ""
    },

    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5
    },

    reviews: {
      type: Number,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

stylistSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

stylistSchema.set("toJSON", {
  virtuals: true
});

stylistSchema.set("toObject", {
  virtuals: true
});

export default mongoose.model("Stylist", stylistSchema);