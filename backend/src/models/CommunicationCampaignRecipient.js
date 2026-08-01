import mongoose from "mongoose";

const RECIPIENT_STATUSES = [
  "pending",
  "queued",
  "processing",
  "sent",
  "delivered",
  "opened",
  "responded",
  "failed",
  "skipped",
  "cancelled",
];

const COMMUNICATION_CHANNELS = [
  "email",
  "sms",
  "whatsapp",
  "phone",
  "in_app",
];

const SKIP_REASONS = [
  "unsubscribed",
  "consent_missing",
  "missing_contact",
  "invalid_contact",
  "duplicate_recipient",
  "excluded_customer",
  "audience_mismatch",
  "inactive_customer",
  "other",
];

const TERMINAL_STATUSES = [
  "responded",
  "failed",
  "skipped",
  "cancelled",
];

const SUCCESSFUL_STATUSES = [
  "sent",
  "delivered",
  "opened",
  "responded",
];

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeRecipient(value, channel) {
  const recipient = normalizeText(value);

  if (
    channel === "email" ||
    channel === "in_app"
  ) {
    return recipient.toLowerCase();
  }

  if (
    channel === "sms" ||
    channel === "whatsapp" ||
    channel === "phone"
  ) {
    return recipient.replace(/[^\d+]/g, "");
  }

  return recipient;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function isValidPhone(value) {
  return /^\+?[0-9]{7,15}$/.test(value);
}

const deliveryAttemptSchema =
  new mongoose.Schema(
    {
      attemptedAt: {
        type: Date,
        default: Date.now,
      },

      provider: {
        type: String,
        trim: true,
        default: "",
      },

      providerMessageId: {
        type: String,
        trim: true,
        default: "",
      },

      successful: {
        type: Boolean,
        default: false,
      },

      statusCode: {
        type: Number,
        default: null,
      },

      errorCode: {
        type: String,
        trim: true,
        default: "",
      },

      errorMessage: {
        type: String,
        trim: true,
        maxlength: [
          2000,
          "Delivery-attempt error messages cannot exceed 2,000 characters.",
        ],
        default: "",
      },

      response: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },
    },
    {
      _id: true,
      timestamps: false,
    }
  );

const trackingSchema = new mongoose.Schema(
  {
    deliveryTrackingEnabled: {
      type: Boolean,
      default: true,
    },

    openTrackingEnabled: {
      type: Boolean,
      default: true,
    },

    responseTrackingEnabled: {
      type: Boolean,
      default: true,
    },

    trackingId: {
      type: String,
      trim: true,
      default: "",
      index: true,
      sparse: true,
    },

    trackingUrl: {
      type: String,
      trim: true,
      default: "",
    },

    unsubscribeUrl: {
      type: String,
      trim: true,
      default: "",
    },

    openedFromIp: {
      type: String,
      trim: true,
      default: "",
    },

    openedUserAgent: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);

const communicationCampaignRecipientSchema =
  new mongoose.Schema(
    {
      campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunicationCampaign",
        required: [
          true,
          "Communication campaign is required.",
        ],
        index: true,
      },

      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: [
          true,
          "Campaign recipient customer is required.",
        ],
        index: true,
      },

      appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
        default: null,
        index: true,
      },

      template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommunicationTemplate",
        default: null,
      },

      contactLog: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CustomerContactLog",
        default: null,
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

      recipient: {
        type: String,
        required: [
          true,
          "Campaign recipient address is required.",
        ],
        trim: true,
        maxlength: [
          320,
          "Campaign recipient address cannot exceed 320 characters.",
        ],
        index: true,
      },

      customerName: {
        type: String,
        trim: true,
        maxlength: [
          200,
          "Customer name cannot exceed 200 characters.",
        ],
        default: "",
      },

      subject: {
        type: String,
        trim: true,
        maxlength: [
          200,
          "Campaign recipient subject cannot exceed 200 characters.",
        ],
        default: "",
      },

      body: {
        type: String,
        required: [
          true,
          "Campaign recipient message body is required.",
        ],
        trim: true,
        maxlength: [
          10000,
          "Campaign recipient message body cannot exceed 10,000 characters.",
        ],
      },

      variables: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },

      status: {
        type: String,
        enum: {
          values: RECIPIENT_STATUSES,
          message:
            "Unsupported campaign-recipient status.",
        },
        default: "pending",
        index: true,
      },

      skipReason: {
        type: String,
        enum: {
          values: ["", ...SKIP_REASONS],
          message:
            "Unsupported campaign-recipient skip reason.",
        },
        default: "",
      },

      skipDetails: {
        type: String,
        trim: true,
        maxlength: [
          2000,
          "Campaign-recipient skip details cannot exceed 2,000 characters.",
        ],
        default: "",
      },

      failureReason: {
        type: String,
        trim: true,
        maxlength: [
          2000,
          "Campaign-recipient failure reason cannot exceed 2,000 characters.",
        ],
        default: "",
      },

      provider: {
        type: String,
        trim: true,
        maxlength: [
          100,
          "Communication provider name cannot exceed 100 characters.",
        ],
        default: "",
      },

      externalMessageId: {
        type: String,
        trim: true,
        maxlength: [
          500,
          "External message ID cannot exceed 500 characters.",
        ],
        default: "",
        index: true,
        sparse: true,
      },

      providerResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
      },

      attemptCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      maximumAttempts: {
        type: Number,
        min: 1,
        max: 20,
        default: 3,
      },

      attempts: {
        type: [deliveryAttemptSchema],
        default: [],
      },

      nextAttemptAt: {
        type: Date,
        default: null,
        index: true,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },

      queuedAt: {
        type: Date,
        default: null,
      },

      processingStartedAt: {
        type: Date,
        default: null,
      },

      sentAt: {
        type: Date,
        default: null,
      },

      deliveredAt: {
        type: Date,
        default: null,
      },

      openedAt: {
        type: Date,
        default: null,
      },

      respondedAt: {
        type: Date,
        default: null,
      },

      failedAt: {
        type: Date,
        default: null,
      },

      skippedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      tracking: {
        type: trackingSchema,
        default: () => ({}),
      },

      consentVerified: {
        type: Boolean,
        default: false,
      },

      consentVerifiedAt: {
        type: Date,
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

communicationCampaignRecipientSchema.index(
  {
    campaign: 1,
    customer: 1,
  },
  {
    unique: true,
    name: "unique_customer_per_campaign",
  }
);

communicationCampaignRecipientSchema.index({
  campaign: 1,
  status: 1,
  createdAt: 1,
});

communicationCampaignRecipientSchema.index({
  status: 1,
  nextAttemptAt: 1,
  attemptCount: 1,
});

communicationCampaignRecipientSchema.index({
  channel: 1,
  recipient: 1,
});

communicationCampaignRecipientSchema.index({
  campaign: 1,
  sentAt: -1,
});

communicationCampaignRecipientSchema.pre(
  "validate",
  function prepareCampaignRecipient() {
    this.recipient = normalizeRecipient(
      this.recipient,
      this.channel
    );

    this.customerName = normalizeText(
      this.customerName
    );

    this.subject = normalizeText(this.subject);
    this.body = normalizeText(this.body);

    this.skipDetails = normalizeText(
      this.skipDetails
    );

    this.failureReason = normalizeText(
      this.failureReason
    );

    this.provider = normalizeText(
      this.provider
    );

    this.externalMessageId = normalizeText(
      this.externalMessageId
    );

    if (
      this.channel === "email" &&
      !this.subject
    ) {
      this.invalidate(
        "subject",
        "Email campaign recipients require a subject."
      );
    }

    if (this.channel !== "email") {
      this.subject = "";
    }

    if (
      this.channel === "email" &&
      this.recipient &&
      !isValidEmail(this.recipient)
    ) {
      this.invalidate(
        "recipient",
        "The campaign recipient email address is invalid."
      );
    }

    if (
      ["sms", "whatsapp", "phone"].includes(
        this.channel
      ) &&
      this.recipient &&
      !isValidPhone(this.recipient)
    ) {
      this.invalidate(
        "recipient",
        "The campaign recipient phone number is invalid."
      );
    }

    if (
      this.status === "skipped" &&
      !this.skipReason
    ) {
      this.invalidate(
        "skipReason",
        "Skipped campaign recipients require a skip reason."
      );
    }

    if (
      this.status === "failed" &&
      !this.failureReason
    ) {
      this.invalidate(
        "failureReason",
        "Failed campaign recipients require a failure reason."
      );
    }

    if (
      this.attemptCount >
      this.maximumAttempts
    ) {
      this.invalidate(
        "attemptCount",
        "Attempt count cannot exceed the maximum number of attempts."
      );
    }

    if (
      this.consentVerified &&
      !this.consentVerifiedAt
    ) {
      this.consentVerifiedAt = new Date();
    }
  }
);

communicationCampaignRecipientSchema.pre(
  "save",
  function updateStatusTimestamps() {
    if (!this.isModified("status")) {
      return;
    }

    const now = new Date();

    switch (this.status) {
      case "queued":
        if (!this.queuedAt) {
          this.queuedAt = now;
        }
        break;

      case "processing":
        if (!this.processingStartedAt) {
          this.processingStartedAt = now;
        }

        if (!this.lastAttemptAt) {
          this.lastAttemptAt = now;
        }
        break;

      case "sent":
        if (!this.sentAt) {
          this.sentAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "delivered":
        if (!this.sentAt) {
          this.sentAt = now;
        }

        if (!this.deliveredAt) {
          this.deliveredAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "opened":
        if (!this.sentAt) {
          this.sentAt = now;
        }

        if (!this.deliveredAt) {
          this.deliveredAt = now;
        }

        if (!this.openedAt) {
          this.openedAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "responded":
        if (!this.sentAt) {
          this.sentAt = now;
        }

        if (!this.deliveredAt) {
          this.deliveredAt = now;
        }

        if (!this.openedAt) {
          this.openedAt = now;
        }

        if (!this.respondedAt) {
          this.respondedAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "failed":
        if (!this.failedAt) {
          this.failedAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "skipped":
        if (!this.skippedAt) {
          this.skippedAt = now;
        }

        this.nextAttemptAt = null;
        break;

      case "cancelled":
        if (!this.cancelledAt) {
          this.cancelledAt = now;
        }

        this.nextAttemptAt = null;
        break;

      default:
        break;
    }
  }
);

communicationCampaignRecipientSchema.virtual(
  "isTerminal"
).get(function getIsTerminal() {
  return TERMINAL_STATUSES.includes(
    this.status
  );
});

communicationCampaignRecipientSchema.virtual(
  "isSuccessful"
).get(function getIsSuccessful() {
  return SUCCESSFUL_STATUSES.includes(
    this.status
  );
});

communicationCampaignRecipientSchema.virtual(
  "canRetry"
).get(function getCanRetry() {
  return (
    this.status === "failed" &&
    this.attemptCount < this.maximumAttempts
  );
});

communicationCampaignRecipientSchema.virtual(
  "remainingAttempts"
).get(function getRemainingAttempts() {
  return Math.max(
    0,
    Number(this.maximumAttempts || 0) -
      Number(this.attemptCount || 0)
  );
});

communicationCampaignRecipientSchema.methods.canTransitionTo =
  function canTransitionTo(nextStatus) {
    const transitions = {
      pending: [
        "queued",
        "skipped",
        "cancelled",
      ],

      queued: [
        "processing",
        "skipped",
        "cancelled",
      ],

      processing: [
        "sent",
        "failed",
        "skipped",
        "cancelled",
      ],

      sent: [
        "delivered",
        "opened",
        "responded",
        "failed",
      ],

      delivered: [
        "opened",
        "responded",
      ],

      opened: ["responded"],

      responded: [],

      failed: [
        "queued",
        "cancelled",
      ],

      skipped: [],

      cancelled: [],
    };

    return Boolean(
      transitions[this.status]?.includes(
        nextStatus
      )
    );
  };

communicationCampaignRecipientSchema.methods.recordAttempt =
  function recordAttempt({
    provider = "",
    providerMessageId = "",
    successful = false,
    statusCode = null,
    errorCode = "",
    errorMessage = "",
    response = {},
  } = {}) {
    const attemptedAt = new Date();

    this.attemptCount += 1;
    this.lastAttemptAt = attemptedAt;

    this.attempts.push({
      attemptedAt,
      provider: normalizeText(provider),
      providerMessageId: normalizeText(
        providerMessageId
      ),
      successful: Boolean(successful),
      statusCode:
        statusCode === undefined
          ? null
          : statusCode,
      errorCode: normalizeText(errorCode),
      errorMessage:
        normalizeText(errorMessage),
      response:
        response &&
        typeof response === "object"
          ? response
          : {},
    });

    if (provider) {
      this.provider =
        normalizeText(provider);
    }

    if (providerMessageId) {
      this.externalMessageId =
        normalizeText(providerMessageId);
    }

    if (response) {
      this.providerResponse = response;
    }

    return this;
  };

communicationCampaignRecipientSchema.methods.scheduleRetry =
  function scheduleRetry({
    delaySeconds = 300,
    failureReason = "",
  } = {}) {
    if (
      this.attemptCount >=
      this.maximumAttempts
    ) {
      this.status = "failed";

      this.failureReason =
        normalizeText(failureReason) ||
        "Maximum delivery attempts reached.";

      this.nextAttemptAt = null;

      return this;
    }

    const safeDelaySeconds = Math.max(
      0,
      Number(delaySeconds) || 0
    );

    this.status = "queued";

    this.failureReason =
      normalizeText(failureReason);

    this.nextAttemptAt = new Date(
      Date.now() +
        safeDelaySeconds * 1000
    );

    return this;
  };

communicationCampaignRecipientSchema.methods.markSkipped =
  function markSkipped(
    reason,
    details = ""
  ) {
    if (!SKIP_REASONS.includes(reason)) {
      throw new Error(
        `Unsupported recipient skip reason: ${reason}`
      );
    }

    this.status = "skipped";
    this.skipReason = reason;
    this.skipDetails = normalizeText(details);
    this.nextAttemptAt = null;

    return this;
  };

communicationCampaignRecipientSchema.statics.findReadyForDelivery =
  function findReadyForDelivery({
    campaignId,
    limit = 100,
    now = new Date(),
  } = {}) {
    const match = {
      status: "queued",

      $or: [
        {
          nextAttemptAt: null,
        },
        {
          nextAttemptAt: {
            $lte: now,
          },
        },
      ],

      $expr: {
        $lt: [
          "$attemptCount",
          "$maximumAttempts",
        ],
      },
    };

    if (
      campaignId &&
      mongoose.Types.ObjectId.isValid(
        campaignId
      )
    ) {
      match.campaign =
        new mongoose.Types.ObjectId(
          campaignId
        );
    }

    const safeLimit = Math.min(
      Math.max(
        1,
        Number.parseInt(limit, 10) || 100
      ),
      1000
    );

    return this.find(match)
      .sort({
        nextAttemptAt: 1,
        createdAt: 1,
      })
      .limit(safeLimit);
  };

communicationCampaignRecipientSchema.statics.getCampaignStatusCounts =
  async function getCampaignStatusCounts(
    campaignId
  ) {
    if (
      !mongoose.Types.ObjectId.isValid(
        campaignId
      )
    ) {
      throw new Error(
        "campaignId must be a valid MongoDB ID."
      );
    }

    const results = await this.aggregate([
      {
        $match: {
          campaign:
            new mongoose.Types.ObjectId(
              campaignId
            ),
        },
      },

      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const counts = {
      totalRecipients: 0,
      pending: 0,
      queued: 0,
      processing: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      responded: 0,
      failed: 0,
      skipped: 0,
      cancelled: 0,
    };

    for (const result of results) {
      const status = result._id;
      const count = Number(
        result.count
      );

      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          status
        )
      ) {
        counts[status] = count;
      }

      counts.totalRecipients += count;
    }

    return counts;
  };

const CommunicationCampaignRecipient =
  mongoose.models
    .CommunicationCampaignRecipient ||
  mongoose.model(
    "CommunicationCampaignRecipient",
    communicationCampaignRecipientSchema
  );

export {
  COMMUNICATION_CHANNELS,
  RECIPIENT_STATUSES,
  SKIP_REASONS,
  SUCCESSFUL_STATUSES,
  TERMINAL_STATUSES,
};

export default CommunicationCampaignRecipient;