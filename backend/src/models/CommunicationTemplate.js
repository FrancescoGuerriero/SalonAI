import mongoose from "mongoose";

const CAMPAIGN_TYPES = [
  "dormant_customer",
  "appointment_reminder",
  "follow_up",
  "promotion",
  "birthday",
  "general",
];

const COMMUNICATION_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "phone",
  "in_app",
];

const VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function createSlug(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTemplateVariables(...values) {
  const variables = new Set();
  const variablePattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

  for (const value of values) {
    const text = normalizeText(value);

    let match = variablePattern.exec(text);

    while (match) {
      variables.add(match[1]);
      match = variablePattern.exec(text);
    }

    variablePattern.lastIndex = 0;
  }

  return Array.from(variables).sort();
}

const communicationTemplateSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: [
          true,
          "Template name is required.",
        ],
        trim: true,
        minlength: [
          2,
          "Template name must contain at least 2 characters.",
        ],
        maxlength: [
          120,
          "Template name cannot exceed 120 characters.",
        ],
      },

      slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true,
      },

      description: {
        type: String,
        trim: true,
        maxlength: [
          500,
          "Template description cannot exceed 500 characters.",
        ],
        default: "",
      },

      campaignType: {
        type: String,
        enum: {
          values: CAMPAIGN_TYPES,
          message:
            "Unsupported communication campaign type.",
        },
        default: "general",
        index: true,
      },

      channel: {
        type: String,
        required: [
          true,
          "Communication channel is required.",
        ],
        enum: {
          values: COMMUNICATION_CHANNELS,
          message:
            "Unsupported communication channel.",
        },
        index: true,
      },

      subject: {
        type: String,
        trim: true,
        maxlength: [
          200,
          "Template subject cannot exceed 200 characters.",
        ],
        default: "",
      },

      body: {
        type: String,
        required: [
          true,
          "Template message body is required.",
        ],
        trim: true,
        maxlength: [
          10000,
          "Template message body cannot exceed 10,000 characters.",
        ],
      },

      variables: {
        type: [
          {
            type: String,
            trim: true,
            validate: {
              validator(value) {
                return VARIABLE_NAME_PATTERN.test(
                  value
                );
              },
              message:
                "Template variables must start with a letter and contain only letters, numbers and underscores.",
            },
          },
        ],
        default: [],
      },

      tags: {
        type: [
          {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: [
              40,
              "Template tags cannot exceed 40 characters.",
            ],
          },
        ],
        default: [],
      },

      active: {
        type: Boolean,
        default: true,
        index: true,
      },

      isSystemTemplate: {
        type: Boolean,
        default: false,
      },

      usageCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      lastUsedAt: {
        type: Date,
        default: null,
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

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

communicationTemplateSchema.index({
  campaignType: 1,
  channel: 1,
  active: 1,
});

communicationTemplateSchema.index({
  name: "text",
  description: "text",
  body: "text",
  tags: "text",
});

communicationTemplateSchema.pre(
  "validate",
  function prepareTemplate() {
    this.name = normalizeText(this.name);
    this.description = normalizeText(
      this.description
    );
    this.subject = normalizeText(this.subject);
    this.body = normalizeText(this.body);

    if (this.channel === "email" && !this.subject) {
      this.invalidate(
        "subject",
        "Email templates require a subject."
      );
    }

    if (this.channel !== "email") {
      this.subject = "";
    }

    const extractedVariables =
      extractTemplateVariables(
        this.subject,
        this.body
      );

    const suppliedVariables = Array.isArray(
      this.variables
    )
      ? this.variables
          .map(normalizeText)
          .filter((variable) =>
            VARIABLE_NAME_PATTERN.test(variable)
          )
      : [];

    this.variables = Array.from(
      new Set([
        ...extractedVariables,
        ...suppliedVariables,
      ])
    ).sort();

    this.tags = Array.from(
      new Set(
        Array.isArray(this.tags)
          ? this.tags
              .map((tag) =>
                normalizeText(tag).toLowerCase()
              )
              .filter(Boolean)
          : []
      )
    );

    const slugName =
      createSlug(this.name) || "template";

    const slugChannel =
      createSlug(this.channel) || "general";

    this.slug = `${slugName}-${slugChannel}`;
  }
);

communicationTemplateSchema.virtual(
  "characterCount"
).get(function getCharacterCount() {
  return normalizeText(this.body).length;
});

communicationTemplateSchema.virtual(
  "isEmailTemplate"
).get(function getIsEmailTemplate() {
  return this.channel === "email";
});

communicationTemplateSchema.methods.recordUsage =
  async function recordUsage() {
    this.usageCount += 1;
    this.lastUsedAt = new Date();

    await this.save();

    return this;
  };

communicationTemplateSchema.statics.findActive =
  function findActive(filters = {}) {
    return this.find({
      ...filters,
      active: true,
    }).sort({
      campaignType: 1,
      channel: 1,
      name: 1,
    });
  };

const CommunicationTemplate =
  mongoose.models.CommunicationTemplate ||
  mongoose.model(
    "CommunicationTemplate",
    communicationTemplateSchema
  );

export {
  CAMPAIGN_TYPES,
  COMMUNICATION_CHANNELS,
  extractTemplateVariables,
};

export default CommunicationTemplate;