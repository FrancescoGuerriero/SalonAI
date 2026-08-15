import mongoose from "mongoose";

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: { type: String, trim: true, maxlength: 100, default: "" },
    comment: { type: String, trim: true, maxlength: 1500, required: true },
    status: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const favouriteSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["service", "stylist", "product"],
      required: true,
    },
    referenceId: { type: String, trim: true, maxlength: 100, required: true },
    label: { type: String, trim: true, maxlength: 150, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const offerClaimSchema = new Schema(
  {
    offer: { type: Schema.Types.ObjectId, ref: "SalonOffer", required: true },
    code: { type: String, trim: true, uppercase: true, required: true },
    claimedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const walletCardSchema = new Schema(
  {
    giftCard: { type: Schema.Types.ObjectId, ref: "GiftCard", required: true },
    label: { type: String, trim: true, maxlength: 80, default: "Salon gift card" },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const appointmentRequestSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    requestType: { type: String, enum: ["cancel", "reschedule"], required: true },
    preferredDate: { type: Date, default: null },
    preferredTime: { type: String, trim: true, maxlength: 5, default: "" },
    reason: { type: String, trim: true, maxlength: 750, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "completed"],
      default: "pending",
    },
    managerNote: { type: String, trim: true, maxlength: 750, default: "" },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const consultationSchema = new Schema(
  {
    appointment: { type: Schema.Types.ObjectId, ref: "Appointment", default: null },

    /* Hair profile */
    hairType: { type: String, trim: true, maxlength: 80, default: "" },
    texturePattern: { type: String, trim: true, maxlength: 80, default: "" },
    density: { type: String, trim: true, maxlength: 60, default: "" },
    strandThickness: { type: String, trim: true, maxlength: 60, default: "" },
    length: { type: String, trim: true, maxlength: 80, default: "" },
    porosity: { type: String, trim: true, maxlength: 60, default: "" },
    scalpCondition: { type: String, trim: true, maxlength: 250, default: "" },
    hairCondition: { type: String, trim: true, maxlength: 500, default: "" },

    /* Colour and chemical history */
    naturalColour: { type: String, trim: true, maxlength: 100, default: "" },
    currentColour: { type: String, trim: true, maxlength: 100, default: "" },
    greyPercentage: { type: String, trim: true, maxlength: 50, default: "" },
    colourHistory: { type: String, trim: true, maxlength: 1500, default: "" },
    bleachHistory: { type: String, trim: true, maxlength: 1000, default: "" },
    previousTreatments: { type: String, trim: true, maxlength: 1500, default: "" },

    /* Routine and concerns */
    washFrequency: { type: String, trim: true, maxlength: 100, default: "" },
    heatStylingFrequency: { type: String, trim: true, maxlength: 100, default: "" },
    homeCareRoutine: { type: String, trim: true, maxlength: 1500, default: "" },
    currentProducts: { type: String, trim: true, maxlength: 1500, default: "" },
    lifestyleExposure: { type: String, trim: true, maxlength: 750, default: "" },
    concerns: { type: [String], default: [] },

    /* Goals and practical constraints */
    desiredOutcome: { type: String, trim: true, maxlength: 1500, required: true },
    maintenancePreference: { type: String, trim: true, maxlength: 250, default: "" },
    budgetRange: { type: String, trim: true, maxlength: 100, default: "" },
    upcomingEvent: { type: String, trim: true, maxlength: 500, default: "" },
    inspirationNotes: { type: String, trim: true, maxlength: 1000, default: "" },

    /* Salon safety */
    sensitivities: { type: String, trim: true, maxlength: 1000, default: "" },
    patchTestRequired: { type: Boolean, default: false },
    safetyNotes: { type: String, trim: true, maxlength: 1000, default: "" },

    notes: { type: String, trim: true, maxlength: 1500, default: "" },
    dataProcessingConsent: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["submitted", "reviewed", "archived"],
      default: "submitted",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const inspirationSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 120, required: true },
    imageUrl: { type: String, trim: true, maxlength: 1000, default: "" },
    notes: { type: String, trim: true, maxlength: 750, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const feedbackSchema = new Schema(
  {
    category: {
      type: String,
      enum: ["booking", "account", "shop", "accessibility", "performance", "other"],
      default: "other",
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    message: { type: String, trim: true, maxlength: 2000, required: true },
    allowContact: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["new", "reviewing", "planned", "resolved", "closed"],
      default: "new",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    consents: {
      necessary: { type: Boolean, default: true, immutable: true },
      analytics: { type: Boolean, default: false },
      personalisation: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now },
    },
    reviews: { type: [reviewSchema], default: [] },
    favourites: { type: [favouriteSchema], default: [] },
    claimedOffers: { type: [offerClaimSchema], default: [] },
    walletCards: { type: [walletCardSchema], default: [] },
    appointmentRequests: { type: [appointmentRequestSchema], default: [] },
    discovery: {
      postcode: { type: String, trim: true, uppercase: true, maxlength: 20, default: "" },
      travelRadiusMiles: { type: Number, min: 1, max: 100, default: 10 },
      serviceCategories: { type: [String], default: [] },
      preferredStylist: { type: String, trim: true, maxlength: 100, default: "" },
      preferredDays: { type: [String], default: [] },
      preferredTimeOfDay: {
        type: String,
        enum: ["", "morning", "afternoon", "evening"],
        default: "",
      },
    },
    consultations: { type: [consultationSchema], default: [] },
    inspirationItems: { type: [inspirationSchema], default: [] },
    feedback: { type: [feedbackSchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true }
);

export default mongoose.models.CustomerExperienceProfile ||
  mongoose.model("CustomerExperienceProfile", schema);
