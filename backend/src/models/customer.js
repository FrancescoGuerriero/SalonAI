import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

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

const emergencyContactSchema =
  new Schema(
    {
      name: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      relationship: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      phone: {
        type: String,
        trim: true,
        default: "",
        maxlength: 30,
      },
    },
    {
      _id: false,
    }
  );

const hairProfileSchema =
  new Schema(
    {
      hairType: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      naturalHairColour: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      currentHairColour: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      /*
       * Retained for compatibility with
       * the original customer model.
       */
      hairColour: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      hairLength: {
        type: String,
        enum: [
          "",
          "very_short",
          "short",
          "medium",
          "long",
          "very_long",
        ],
        default: "",
      },

      texture: {
        type: String,
        trim: true,
        default: "",
        maxlength: 100,
      },

      density: {
        type: String,
        enum: [
          "",
          "fine",
          "medium",
          "thick",
        ],
        default: "",
      },

      porosity: {
        type: String,
        enum: [
          "",
          "low",
          "medium",
          "high",
        ],
        default: "",
      },

      scalpCondition: {
        type: String,
        trim: true,
        default: "",
        maxlength: 500,
      },

      concerns: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],

      allergies: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],

      sensitivities: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],

      preferredProducts: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],

      productsToAvoid: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],

      chemicalHistory: {
        type: String,
        trim: true,
        default: "",
        maxlength: 3000,
      },

      consultationNotes: {
        type: String,
        trim: true,
        default: "",
        maxlength: 5000,
      },

      lastPatchTestAt: {
        type: Date,
        default: null,
      },

      patchTestResult: {
        type: String,
        enum: [
          "",
          "passed",
          "failed",
          "inconclusive",
        ],
        default: "",
      },
    },
    {
      _id: false,
    }
  );

const communicationPreferencesSchema =
  new Schema(
    {
      preferredChannel: {
        type: String,
        enum: [
          "email",
          "sms",
          "phone",
          "whatsapp",
          "none",
        ],
        default: "email",
      },

      appointmentReminders: {
        type: Boolean,
        default: true,
      },

      promotionalMessages: {
        type: Boolean,
        default: true,
      },

      serviceUpdates: {
        type: Boolean,
        default: true,
      },

      birthdayMessages: {
        type: Boolean,
        default: true,
      },

      feedbackRequests: {
        type: Boolean,
        default: true,
      },

      emailUnsubscribed: {
        type: Boolean,
        default: false,
      },

      smsUnsubscribed: {
        type: Boolean,
        default: false,
      },

      unsubscribed: {
        type: Boolean,
        default: false,
      },

      consentUpdatedAt: {
        type: Date,
        default: null,
      },

      consentSource: {
        type: String,
        trim: true,
        default: "",
        maxlength: 150,
      },
    },
    {
      _id: false,
    }
  );

const bookingPreferencesSchema =
  new Schema(
    {
      preferredDays: [
        {
          type: String,
          enum: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
        },
      ],

      preferredTimeOfDay: {
        type: String,
        enum: [
          "",
          "morning",
          "afternoon",
          "evening",
        ],
        default: "",
      },

      preferredReminderChannel: {
        type: String,
        enum: [
          "email",
          "sms",
          "phone",
          "whatsapp",
          "none",
        ],
        default: "email",
      },

      accessibilityRequirements: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },

      additionalRequirements: {
        type: String,
        trim: true,
        default: "",
        maxlength: 2000,
      },
    },
    {
      _id: false,
    }
  );

const customerSchema = new Schema(
  {
    userAccount: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      unique: true,
      sparse: true,
    },

    title: {
      type: String,
      enum: [
        "",
        "Mr",
        "Mrs",
        "Miss",
        "Ms",
        "Mx",
        "Dr",
        "Other",
      ],
      default: "",
    },

    firstName: {
      type: String,
      required: [
        true,
        "Customer first name is required.",
      ],
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: [
        true,
        "Customer last name is required.",
      ],
      trim: true,
      maxlength: 50,
    },

    preferredName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    pronouns: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: 30,
    },

    alternativePhone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: [
        "male",
        "female",
        "non_binary",
        "other",
        "prefer_not_to_say",
      ],
      default: "prefer_not_to_say",
    },

    address: {
      type: addressSchema,
      default: () => ({}),
    },

    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },

    hairProfile: {
      type: hairProfileSchema,
      default: () => ({}),
    },

    preferredStylist: {
      type: Schema.Types.ObjectId,
      ref: "Stylist",
      default: null,
    },

    preferredServices: [
      {
        type: Schema.Types.ObjectId,
        ref: "Service",
      },
    ],

    bookingPreferences: {
      type: bookingPreferencesSchema,
      default: () => ({}),
    },

    communicationPreferences: {
      type: communicationPreferencesSchema,
      default: () => ({}),
    },

    /*
     * Retained for compatibility with
     * existing customer and campaign code.
     */
    marketing: {
      emailConsent: {
        type: Boolean,
        default: true,
      },

      smsConsent: {
        type: Boolean,
        default: false,
      },

      emailConsentUpdatedAt: {
        type: Date,
        default: null,
      },

      smsConsentUpdatedAt: {
        type: Date,
        default: null,
      },

      consentSource: {
        type: String,
        trim: true,
        default: "",
        maxlength: 150,
      },
    },

    visitCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedAppointmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    cancelledAppointmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    noShowCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    firstVisit: {
      type: Date,
      default: null,
    },

    lastVisit: {
      type: Date,
      default: null,
    },

    nextAppointment: {
      type: Date,
      default: null,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageSpend: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastSpendAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    loyaltyTier: {
      type: String,
      enum: [
        "standard",
        "silver",
        "gold",
        "platinum",
      ],
      default: "standard",
    },

    membershipStatus: {
      type: String,
      enum: [
        "none",
        "active",
        "paused",
        "cancelled",
        "expired",
      ],
      default: "none",
    },

    membershipName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    membershipStartedAt: {
      type: Date,
      default: null,
    },

    membershipExpiresAt: {
      type: Date,
      default: null,
    },

    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: 50,
    },

    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100,
      },
    ],

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 10000,
    },

    internalWarnings: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
      select: false,
    },

    photo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    source: {
      type: String,
      enum: [
        "manual",
        "website",
        "booking",
        "referral",
        "import",
        "social_media",
        "other",
      ],
      default: "manual",
    },

    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "archived",
        "deleted",
      ],
      default: "active",
      index: true,
    },

    archivedAt: {
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
    },

    toObject: {
      virtuals: true,
    },
  }
);

/*
|--------------------------------------------------------------------------
| Virtual properties
|--------------------------------------------------------------------------
*/

customerSchema
  .virtual("fullName")
  .get(function getFullName() {
    return [
      this.firstName,
      this.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  });

customerSchema
  .virtual("displayName")
  .get(function getDisplayName() {
    return (
      this.preferredName ||
      this.fullName
    );
  });

customerSchema
  .virtual("age")
  .get(function getAge() {
    if (!this.dateOfBirth) {
      return null;
    }

    const today = new Date();

    const birthDate =
      new Date(this.dateOfBirth);

    let age =
      today.getFullYear() -
      birthDate.getFullYear();

    const monthDifference =
      today.getMonth() -
      birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() <
          birthDate.getDate()
      )
    ) {
      age -= 1;
    }

    return age;
  });

customerSchema
  .virtual("totalSpend")
  .get(function getTotalSpend() {
    return this.totalSpent || 0;
  });

customerSchema
  .virtual("lastVisitAt")
  .get(function getLastVisitAt() {
    return this.lastVisit;
  });

customerSchema
  .virtual("isMarketingEligible")
  .get(function getMarketingEligibility() {
    return (
      this.status === "active" &&
      !this.communicationPreferences
        ?.unsubscribed &&
      (
        this.marketing
          ?.emailConsent ||
        this.marketing
          ?.smsConsent
      )
    );
  });

/*
|--------------------------------------------------------------------------
| Validation and normalisation
|--------------------------------------------------------------------------
*/

customerSchema.pre(
  "validate",
  function normaliseCustomer() {
    if (this.email === "") {
      this.email = undefined;
    }

    if (this.phone === "") {
      this.phone = undefined;
    }

    if (
      Array.isArray(this.tags)
    ) {
      this.tags = Array.from(
        new Set(
          this.tags
            .map((tag) =>
              String(tag)
                .trim()
                .toLowerCase()
            )
            .filter(Boolean)
        )
      );
    }

    if (
      this.dateOfBirth &&
      this.dateOfBirth >
        new Date()
    ) {
      this.invalidate(
        "dateOfBirth",
        "Date of birth cannot be in the future."
      );
    }

    if (
      this.status ===
        "archived" &&
      !this.archivedAt
    ) {
      this.archivedAt =
        new Date();
    }

    if (
      this.status !==
      "archived"
    ) {
      this.archivedAt =
        null;
    }

    if (
      this.visitCount > 0
    ) {
      this.averageSpend =
        Number(
          (
            this.totalSpent /
            this.visitCount
          ).toFixed(2)
        );
    } else {
      this.averageSpend = 0;
    }
  }
);

/*
|--------------------------------------------------------------------------
| Customer methods
|--------------------------------------------------------------------------
*/

customerSchema.methods.addLoyaltyPoints =
  function addLoyaltyPoints(
    points
  ) {
    const safePoints =
      Math.max(
        0,
        Number(points) || 0
      );

    this.loyaltyPoints +=
      safePoints;

    return this.loyaltyPoints;
  };

customerSchema.methods.recordVisit =
  function recordVisit({
    amountSpent = 0,
    visitedAt = new Date(),
  } = {}) {
    const safeAmount =
      Math.max(
        0,
        Number(amountSpent) || 0
      );

    const visitDate =
      new Date(visitedAt);

    this.visitCount += 1;

    this.completedAppointmentCount +=
      1;

    this.totalSpent +=
      safeAmount;

    this.lastSpendAmount =
      safeAmount;

    this.lastVisit =
      visitDate;

    if (!this.firstVisit) {
      this.firstVisit =
        visitDate;
    }

    this.averageSpend =
      Number(
        (
          this.totalSpent /
          this.visitCount
        ).toFixed(2)
      );

    return this;
  };

customerSchema.methods.archive =
  function archive() {
    this.status = "archived";
    this.archivedAt =
      new Date();

    return this;
  };

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

customerSchema.index({
  firstName: "text",
  lastName: "text",
  preferredName: "text",
  email: "text",
  phone: "text",
  tags: "text",
});

customerSchema.index({
  status: 1,
  lastVisit: -1,
});

customerSchema.index({
  preferredStylist: 1,
  status: 1,
});

customerSchema.index({
  loyaltyTier: 1,
  loyaltyPoints: -1,
});

customerSchema.index({
  createdAt: -1,
});

const Customer =
  mongoose.models.Customer ||
  mongoose.model(
    "Customer",
    customerSchema
  );

export default Customer;