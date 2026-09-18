import mongoose from "mongoose";

const { Schema } = mongoose;

const aiKnowledgeDocumentSchema =
  new Schema(
    {
      sourceType: {
        type: String,
        enum: [
          "salon_policy",
          "service",
          "product",
          "procedure",
          "training_material",
          "business_rule",
          "faq",
          "document",
        ],
        required: true,
        index: true,
      },
      sourceKey: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
      title: {
        type: String,
        required: true,
        trim: true,
      },
      content: {
        type: String,
        required: true,
      },
      searchText: {
        type: String,
        required: true,
      },
      version: {
        type: String,
        required: true,
        trim: true,
        default: "1",
      },
      status: {
        type: String,
        enum: [
          "draft",
          "published",
          "retired",
        ],
        default: "draft",
        index: true,
      },
      audience: {
        type: [
          {
            type: String,
            enum: [
              "customer",
              "stylist",
              "receptionist",
              "manager",
              "admin",
              "super_admin",
            ],
          },
        ],
        default: [],
      },
      requiredPermissions: {
        type: [String],
        default: [],
      },
      tags: {
        type: [String],
        default: [],
      },
      validFrom: {
        type: Date,
        default: null,
      },
      validUntil: {
        type: Date,
        default: null,
      },
      provenance: {
        sourceUri: {
          type: String,
          trim: true,
          default: "",
        },
        sourceHash: {
          type: String,
          trim: true,
          default: "",
        },
        reviewedAt: {
          type: Date,
          default: null,
        },
        reviewedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

aiKnowledgeDocumentSchema.index(
  {
    sourceType: 1,
    sourceKey: 1,
    version: 1,
  },
  {
    unique: true,
  }
);

const AiKnowledgeDocument =
  mongoose.models
    .AiKnowledgeDocument ||
  mongoose.model(
    "AiKnowledgeDocument",
    aiKnowledgeDocumentSchema
  );

export default AiKnowledgeDocument;
