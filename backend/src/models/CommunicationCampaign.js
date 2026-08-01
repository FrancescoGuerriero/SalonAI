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

const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "queued",
  "processing",
  "paused",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
];

const SEND_MODES = [
  "draft",
  "immediate",
  "scheduled",
];

const AUDIENCE_TYPES = [
  "all_customers",
  "segments",
  "selected_customers",
  "custom_filters",
];

const CUSTOMER_SEGMENTS = [
  "new_customers",
  "returning_customers",
  "dormant_customers",
  "high_value_customers",
  "upcoming_appointments",
  "birthday_customers",
  "inactive_customers",
  "vip_customers",
  "custom",
];

const VARIABLE_NAME_PATTERN =
  /^[a-zA-Z][a-zA-Z0-9_]*$/;

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

function extractCampaignVariables(...values) {
  const variables = new Set();

  const pattern =
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g;

  for (const value of values) {
    const text = normalizeText(value);

    let match = pattern.exec(text);

    while (match) {
      variables.add(match[1]);
      match = pattern.exec(text);
    }

    pattern.lastIndex = 0;
  }

  return Array.from(variables).sort();
}

const audienceFilterSchema =
  new mongoose.Schema(
    {
      dormantDays: {
        type: Number,
        min: 1,
        max: 3650,
        default: null,
      },

      minimumSpend: {
        type: Number,
        min: 0,
        default: null,
      },

      maximumSpend: {
        type: Number,
        min: 0,
        default: null,
      },

      minimumAppointments: {
        type: Number,
        min: 0,
        default: null,
      },

      maximumAppointments: {
        type: Number,
        min: 0,
        default: null,
      },

      lastAppointmentBefore: {
        type: Date,
        default: null,
      },

      lastAppointmentAfter: {
        type: Date,
        default: null,
      },

      appointmentDateFrom: {
        type: Date,
        default: null,
      },

      appointmentDateTo: {
        type: Date,
        default: null,
      },

      preferredStylist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stylist",
        default: null,
      },

      preferredService: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        default: null,
      },

      tags: {
        type: [String],
        default: [],
      },

      excludeTags: {
        type: [String],
        default: [],
      },

      hasEmail: {
        type: Boolean,
        default: null,
      },

      hasPhone: {
        type: Boolean,
        default: null,
      },

      birthdayMonth: {
        type: Number,
        min: 1,
        max: 12,
        default: null,
      },

      customQuery: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },
    },
    {
      _id: false,
    }
  );

const audienceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: AUDIENCE_TYPES,
        message:
          "Unsupported campaign audience type.",
      },
      default: "selected_customers",
    },

    segments: {
      type: [
        {
          type: String,
          enum: {
            values: CUSTOMER_SEGMENTS,
            message:
              "Unsupported customer segment.",
          },
        },
      ],
      default: [],
    },

    customerIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
      ],
      default: [],
    },

    excludedCustomerIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
        },
      ],
      default: [],
    },

    filters: {
      type: audienceFilterSchema,
      default: () => ({}),
    },

    estimatedRecipients: {
      type: Number,
      min: 0,
      default: 0,
    },

    calculatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const scheduleSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: {
        values: SEND_MODES,
        message:
          "Unsupported campaign send mode.",
      },
      default: "draft",
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    timezone: {
      type: String,
      trim: true,
      default: "Europe/London",
    },

    batchSize: {
      type: Number,
      min: 1,
      max: 1000,
      default: 100,
    },

    delayBetweenBatchesSeconds: {
      type: Number,
      min: 0,
      max: 86400,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const deliveryCountsSchema =
  new mongoose.Schema(
    {
      totalRecipients: {
        type: Number,
        min: 0,
        default: 0,
      },

      queued: {
        type: Number,
        min: 0,
        default: 0,
      },

      sent: {
        type: Number,
        min: 0,
        default: 0,
      },

      delivered: {
        type: Number,
        min: 0,
        default: 0,
      },

      opened: {
        type: Number,
        min: 0,
        default: 0,
      },

      responded: {
        type: Number,
        min: 0,
        default: 0,
      },

      failed: {
        type: Number,
        min: 0,
        default: 0,
      },

      skipped: {
        type: Number,
        min: 0,
        default: 0,
      },

      cancelled: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    {
      _id: false,
    }
  );

const campaignOptionsSchema =
  new mongoose.Schema(
    {
      trackDelivery: {
        type: Boolean,
        default: true,
      },

      trackOpens: {
        type: Boolean,
        default: true,
      },

      trackResponses: {
        type: Boolean,
        default: true,
      },

      requireContactConsent: {
        type: Boolean,
        default: true,
      },

      excludeUnsubscribed: {
        type: Boolean,
        default: true,
      },

      excludeInvalidContacts: {
        type: Boolean,
        default: true,
      },

      preventDuplicateRecipients: {
        type: Boolean,
        default: true,
      },

      createContactLogs: {
        type: Boolean,
        default: true,
      },

      dryRun: {
        type: Boolean,
        default: false,
      },
    },
    {
      _id: false,
    }
  );

const communicationCampaignSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: [
          true,
          "Campaign name is required.",
        ],
        trim: true,
        minlength: [
          2,
          "Campaign name must contain at least 2 characters.",
        ],
        maxlength: [
          150,
          "Campaign name cannot exceed 150 characters.",
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
          1000,
          "Campaign description cannot exceed 1,000 characters.",
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

      template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunicationTemplate",
        default: null,
        index: true,
      },

      subject: {
        type: String,
        trim: true,
        maxlength: [
          200,
          "Campaign subject cannot exceed 200 characters.",
        ],
        default: "",
      },

      body: {
        type: String,
        required: [
          true,
          "Campaign message body is required.",
        ],
        trim: true,
        maxlength: [
          10000,
          "Campaign message body cannot exceed 10,000 characters.",
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
                "Campaign variables must start with a letter and contain only letters, numbers and underscores.",
            },
          },
        ],
        default: [],
      },

      variableValues: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },

      audience: {
        type: audienceSchema,
        default: () => ({}),
      },

      schedule: {
        type: scheduleSchema,
        default: () => ({}),
      },

      options: {
        type: campaignOptionsSchema,
        default: () => ({}),
      },

      status: {
        type: String,
        enum: {
          values: CAMPAIGN_STATUSES,
          message:
            "Unsupported campaign status.",
        },
        default: "draft",
        index: true,
      },

      deliveryCounts: {
        type: deliveryCountsSchema,
        default: () => ({}),
      },

      failureReason: {
        type: String,
        trim: true,
        maxlength: [
          2000,
          "Campaign failure reason cannot exceed 2,000 characters.",
        ],
        default: "",
      },

      launchedAt: {
        type: Date,
        default: null,
      },

      processingStartedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      pausedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
      },

      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
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

communicationCampaignSchema.index({
  status: 1,
  "schedule.scheduledAt": 1,
});

communicationCampaignSchema.index({
  campaignType: 1,
  channel: 1,
  createdAt: -1,
});

communicationCampaignSchema.index({
  createdBy: 1,
  createdAt: -1,
});

communicationCampaignSchema.index({
  name: "text",
  description: "text",
  subject: "text",
  body: "text",
});

communicationCampaignSchema.pre(
  "validate",
  function prepareCommunicationCampaign() {
    this.name = normalizeText(this.name);
    this.description = normalizeText(
      this.description
    );
    this.subject = normalizeText(this.subject);
    this.body = normalizeText(this.body);
    this.failureReason = normalizeText(
      this.failureReason
    );

    if (!this.slug || this.isModified("name")) {
      const baseSlug =
        createSlug(this.name) || "campaign";

      const uniqueSuffix = String(this._id).slice(
        -8
      );

      this.slug = `${baseSlug}-${uniqueSuffix}`;
    }

    if (
      this.channel === "email" &&
      !this.subject
    ) {
      this.invalidate(
        "subject",
        "Email campaigns require a subject."
      );
    }

    if (this.channel !== "email") {
      this.subject = "";
    }

    const extractedVariables =
      extractCampaignVariables(
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

    if (
      this.schedule?.mode === "scheduled" &&
      !this.schedule.scheduledAt
    ) {
      this.invalidate(
        "schedule.scheduledAt",
        "Scheduled campaigns require a scheduled date and time."
      );
    }

    if (
      this.schedule?.mode !== "scheduled"
    ) {
      this.schedule.scheduledAt = null;
    }

    const audienceType =
      this.audience?.type ||
      "selected_customers";

    const selectedCustomers =
      this.audience?.customerIds || [];

    const selectedSegments =
      this.audience?.segments || [];

    if (
      audienceType ===
        "selected_customers" &&
      selectedCustomers.length === 0
    ) {
      this.invalidate(
        "audience.customerIds",
        "Selected-customer campaigns require at least one customer."
      );
    }

    if (
      audienceType === "segments" &&
      selectedSegments.length === 0
    ) {
      this.invalidate(
        "audience.segments",
        "Segment campaigns require at least one customer segment."
      );
    }
  }
);

communicationCampaignSchema.pre(
  "save",
  function updateCampaignTimestamps() {
    if (!this.isModified("status")) {
      return;
    }

    const now = new Date();

    switch (this.status) {
      case "queued":
        if (!this.launchedAt) {
          this.launchedAt = now;
        }
        break;

      case "processing":
        if (!this.launchedAt) {
          this.launchedAt = now;
        }

        if (!this.processingStartedAt) {
          this.processingStartedAt = now;
        }
        break;

      case "paused":
        this.pausedAt = now;
        break;

      case "completed":
      case "partially_completed":
      case "failed":
        this.completedAt = now;
        break;

      case "cancelled":
        this.cancelledAt = now;
        break;

      default:
        break;
    }
  }
);

communicationCampaignSchema.virtual(
  "isEditable"
).get(function getIsEditable() {
  return [
    "draft",
    "scheduled",
    "paused",
  ].includes(this.status);
});

communicationCampaignSchema.virtual(
  "isScheduled"
).get(function getIsScheduled() {
  return (
    this.schedule?.mode === "scheduled" &&
    Boolean(this.schedule?.scheduledAt)
  );
});

communicationCampaignSchema.virtual(
  "processedRecipients"
).get(function getProcessedRecipients() {
  const counts = this.deliveryCounts || {};

  return (
    Number(counts.sent || 0) +
    Number(counts.failed || 0) +
    Number(counts.skipped || 0) +
    Number(counts.cancelled || 0)
  );
});

communicationCampaignSchema.virtual(
  "progressPercentage"
).get(function getProgressPercentage() {
  const total = Number(
    this.deliveryCounts?.totalRecipients || 0
  );

  if (total <= 0) {
    return 0;
  }

  const processed =
    Number(this.deliveryCounts?.sent || 0) +
    Number(this.deliveryCounts?.failed || 0) +
    Number(this.deliveryCounts?.skipped || 0) +
    Number(
      this.deliveryCounts?.cancelled || 0
    );

  return Number(
    Math.min(
      100,
      (processed / total) * 100
    ).toFixed(1)
  );
});

communicationCampaignSchema.methods.resetDeliveryCounts =
  function resetDeliveryCounts() {
    this.deliveryCounts = {
      totalRecipients: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      failed: 0,
      skipped: 0,
      cancelled: 0,
    };

    return this;
  };

communicationCampaignSchema.methods.canTransitionTo =
  function canTransitionTo(nextStatus) {
    const transitions = {
      draft: [
        "scheduled",
        "queued",
        "cancelled",
      ],

      scheduled: [
        "draft",
        "queued",
        "cancelled",
      ],

      queued: [
        "processing",
        "paused",
        "failed",
        "cancelled",
      ],

      processing: [
        "paused",
        "completed",
        "partially_completed",
        "failed",
        "cancelled",
      ],

      paused: [
        "queued",
        "processing",
        "cancelled",
      ],

      completed: [],

      partially_completed: [],

      failed: [
        "draft",
        "queued",
        "cancelled",
      ],

      cancelled: [],
    };

    return Boolean(
      transitions[this.status]?.includes(
        nextStatus
      )
    );
  };

communicationCampaignSchema.statics.findScheduledCampaigns =
  function findScheduledCampaigns(
    scheduledBefore = new Date()
  ) {
    return this.find({
      status: "scheduled",
      "schedule.mode": "scheduled",
      "schedule.scheduledAt": {
        $lte: scheduledBefore,
      },
    }).sort({
      "schedule.scheduledAt": 1,
    });
  };

const CommunicationCampaign =
  mongoose.models.CommunicationCampaign ||
  mongoose.model(
    "CommunicationCampaign",
    communicationCampaignSchema
  );

export {
  AUDIENCE_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  COMMUNICATION_CHANNELS,
  CUSTOMER_SEGMENTS,
  SEND_MODES,
  extractCampaignVariables,
};

export default CommunicationCampaign;