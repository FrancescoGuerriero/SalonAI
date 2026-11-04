import mongoose from "mongoose";

const { Schema } = mongoose;

// Editorial outreach is review-controlled. This model never publishes content,
// sends messages, buys links or changes external campaigns.
const editorialPlacementSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    contentPage: { type: Schema.Types.ObjectId, ref: "ContentPage", default: null },
    workingTitle: { type: String, required: true, trim: true, maxlength: 220 },
    publisherName: { type: String, required: true, trim: true, maxlength: 180 },
    publisherWebsite: { type: String, required: true, trim: true, maxlength: 2048 },
    contactName: { type: String, trim: true, maxlength: 180, default: "" },
    contactAddress: { type: String, trim: true, maxlength: 320, default: "" },
    pitchSummary: { type: String, trim: true, maxlength: 3000, default: "" },
    status: {
      type: String,
      enum: ["prospect", "draft", "review", "approved", "submitted", "accepted", "published", "rejected", "withdrawn"],
      default: "prospect",
      index: true,
    },
    submissionMode: { type: String, enum: ["none", "manual", "authorised_cms"], default: "none" },
    sponsored: { type: Boolean, default: false },
    compensationDisclosure: { type: String, trim: true, maxlength: 1000, default: "" },
    rightsConfirmed: { type: Boolean, default: false },
    originalityReviewed: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    publishedUrl: { type: String, trim: true, maxlength: 2048, default: "" },
    publishedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

editorialPlacementSchema.index({ business: 1, location: 1, status: 1, createdAt: -1 });
editorialPlacementSchema.index({ business: 1, location: 1, publisherWebsite: 1 });
editorialPlacementSchema.index({ business: 1, location: 1, contentPage: 1 });

export default mongoose.models.MarketingEditorialPlacement ||
  mongoose.model("MarketingEditorialPlacement", editorialPlacementSchema);
