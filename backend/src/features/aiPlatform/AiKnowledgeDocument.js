import mongoose from "mongoose";

const { Schema } = mongoose;

export const AI_KNOWLEDGE_SCOPE_MODES = Object.freeze([
  "platform_global",
  "vertical",
  "tenant",
]);

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
      knowledgeScope: {
        mode: {
          type: String,
          enum: AI_KNOWLEDGE_SCOPE_MODES,
          default: undefined,
          index: true,
        },
        business: {
          type: Schema.Types.ObjectId,
          ref: "Business",
          default: undefined,
          index: true,
        },
        locations: {
          type: [
            {
              type: Schema.Types.ObjectId,
              ref: "Location",
            },
          ],
          default: [],
        },
        verticals: {
          type: [String],
          default: [],
        },
        tenantBlueprintKey: {
          type: String,
          trim: true,
          lowercase: true,
          default: "",
        },
        profileKeys: {
          type: [String],
          default: [],
        },
        crossTenantUseApproved: {
          type: Boolean,
          default: false,
        },
        deidentified: {
          type: Boolean,
          default: false,
        },
        governanceBasis: {
          type: String,
          trim: true,
          maxlength: 2000,
          default: "",
        },
      },
      retrieval: {
        strategy: {
          type: String,
          enum: [
            "lexical",
            "vector",
            "hybrid",
          ],
          default: "lexical",
        },
        embeddingModel: {
          type: String,
          trim: true,
          default: "",
        },
        vectorReference: {
          type: String,
          trim: true,
          default: "",
        },
        indexedAt: {
          type: Date,
          default: null,
        },
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

aiKnowledgeDocumentSchema.pre(
  "validate",
  function validateAiKnowledgeScope() {
    const scope = this.knowledgeScope || {};

    // Legacy records intentionally remain unscoped. Retrieval services must
    // fail closed and ignore them until they are explicitly classified.
    if (!scope.mode) {
      return;
    }

    const hasBusiness = Boolean(scope.business);
    const locations = Array.isArray(scope.locations)
      ? scope.locations
      : [];
    const verticals = Array.isArray(scope.verticals)
      ? scope.verticals.filter(Boolean)
      : [];

    if (scope.mode === "tenant" && !hasBusiness) {
      this.invalidate(
        "knowledgeScope.business",
        "Tenant AI knowledge requires Business ownership."
      );
    }

    if (scope.mode !== "tenant" && hasBusiness) {
      this.invalidate(
        "knowledgeScope.business",
        "Cross-tenant AI knowledge must not carry private Business ownership."
      );
    }

    if (scope.mode !== "tenant" && locations.length > 0) {
      this.invalidate(
        "knowledgeScope.locations",
        "Only tenant AI knowledge may be Location scoped."
      );
    }

    if (scope.mode === "vertical" && verticals.length === 0) {
      this.invalidate(
        "knowledgeScope.verticals",
        "Vertical AI knowledge requires at least one vertical."
      );
    }

    if (
      scope.mode !== "tenant" &&
      scope.crossTenantUseApproved !== true
    ) {
      this.invalidate(
        "knowledgeScope.crossTenantUseApproved",
        "Platform and vertical AI knowledge requires explicit cross-tenant use approval."
      );
    }

    if (
      scope.mode !== "tenant" &&
      !String(scope.governanceBasis || "").trim()
    ) {
      this.invalidate(
        "knowledgeScope.governanceBasis",
        "Platform and vertical AI knowledge requires a documented governance basis."
      );
    }
  }
);

// Keep the historical global source identity contract until an explicit index
// migration is approved. New tenant source keys should therefore be namespaced
// by tenant/business when necessary. No production index migration occurs here.
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

aiKnowledgeDocumentSchema.index({
  "knowledgeScope.mode": 1,
  "knowledgeScope.business": 1,
  status: 1,
  validFrom: 1,
  validUntil: 1,
});

aiKnowledgeDocumentSchema.index({
  "knowledgeScope.mode": 1,
  "knowledgeScope.verticals": 1,
  "knowledgeScope.crossTenantUseApproved": 1,
  status: 1,
});

const AiKnowledgeDocument =
  mongoose.models
    .AiKnowledgeDocument ||
  mongoose.model(
    "AiKnowledgeDocument",
    aiKnowledgeDocumentSchema
  );

export default AiKnowledgeDocument;
