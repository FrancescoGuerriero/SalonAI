import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    hairProfile: {
      hairType: {
        type: String,
        default: "",
      },

      hairColour: {
        type: String,
        default: "",
      },

      texture: {
        type: String,
        default: "",
      },

      scalpCondition: {
        type: String,
        default: "",
      },

      allergies: [
        {
          type: String,
        },
      ],
    },

    preferredStylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },

    visitCount: {
      type: Number,
      default: 0,
    },

    lastVisit: {
      type: Date,
      default: null,
    },

    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      default: "",
      maxlength: 5000,
    },

    marketing: {
      emailConsent: {
        type: Boolean,
        default: true,
      },

      smsConsent: {
        type: Boolean,
        default: false,
      },
    },

    photo: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
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

customerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

customerSchema.set("toJSON", {
  virtuals: true,
});

customerSchema.index({
  firstName: "text",
  lastName: "text",
  email: "text",
  phone: "text",
});

export default mongoose.model("Customer", customerSchema);