import mongoose from "mongoose";

const { Schema } = mongoose;

const mediaSchema = new Schema(
  {
    url: { type: String, trim: true, maxlength: 1500, default: "" },
    alt: { type: String, trim: true, maxlength: 300, default: "" },
    width: { type: Number, min: 1, default: undefined },
    height: { type: Number, min: 1, default: undefined },
    variants: {
      type: [
        new Schema(
          {
            url: { type: String, trim: true, maxlength: 1500, required: true },
            width: { type: Number, min: 1, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const blockSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["heading", "paragraph", "image", "call_to_action"],
      required: true,
    },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    level: { type: Number, min: 2, max: 4, default: 2 },
    media: { type: mediaSchema, default: undefined },
    label: { type: String, trim: true, maxlength: 120, default: "" },
    href: { type: String, trim: true, maxlength: 1500, default: "" },
  },
  { _id: true }
);

const localeSchema = new Schema(
  {
    locale: { type: String, trim: true, maxlength: 20, required: true },
    title: { type: String, trim: true, maxlength: 180, required: true },
    summary: { type: String, trim: true, maxlength: 500, default: "" },
    seoTitle: { type: String, trim: true, maxlength: 180, default: "" },
    seoDescription: { type: String, trim: true, maxlength: 320, default: "" },
    blocks: { type: [blockSchema], default: [] },
  },
  { _id: false }
);

const versionSchema = new Schema(
  {
    version: { type: Number, min: 1, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
  },
  { _id: false }
);

const schema = new Schema(
  {
    business: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      maxlength: 160,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Content slug must be URL-safe."],
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    defaultLocale: { type: String, trim: true, default: "en-GB", maxlength: 20 },
    locales: { type: [localeSchema], default: [] },
    currentVersion: { type: Number, min: 1, default: 1 },
    versions: { type: [versionSchema], default: [] },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
  },
  { timestamps: true, optimisticConcurrency: true }
);

schema.index({ business: 1, slug: 1 }, { unique: true });
schema.index({ status: 1, slug: 1 });

export default mongoose.models.ContentPage || mongoose.model("ContentPage", schema);
