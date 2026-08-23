import mongoose from "mongoose";

const {
  Schema,
  model,
  models,
} = mongoose;

const DELIVERY_CHANNELS = [
  "email",
  "sms",
];

const DELIVERY_MODES = [
  "sandbox",
  "live",
];

const DELIVERY_STATUSES = [
  "pending",
  "processing",
  "accepted",
  "queued",
  "sent",
  "delivered",
  "partially_delivered",
  "sandbox",
  "skipped",
  "failed",
  "undelivered",
  "cancelled",
];

const TERMINAL_DELIVERY_STATUSES = [
  "delivered",
  "partially_delivered",
  "sandbox",
  "skipped",
  "failed",
  "undelivered",
  "cancelled",
];

const SUCCESSFUL_DELIVERY_STATUSES = [
  "accepted",
  "queued",
  "sent",
  "delivered",
  "partially_delivered",
  "sandbox",
];

const ATTEMPT_STATUSES = [
  "started",
  "accepted",
  "succeeded",
  "failed",
  "retry_scheduled",
];

function normaliseText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normaliseLowercase(value) {
  return normaliseText(
    value
  ).toLowerCase();
}

function normaliseEmail(value) {
  return normaliseLowercase(
    value
  );
}

function normalisePhone(value) {
  return normaliseText(value)
    .replace(/[\s\-().]/g, "");
}

function createDeliveryIdentifier() {
  const randomValue =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return `salonai-delivery-${Date.now()}-${randomValue}`;
}

const deliveryAttemptSchema =
  new Schema(
    {
      attemptNumber: {
        type: Number,
        required: true,
        min: 1,
      },

      status: {
        type: String,
        enum: ATTEMPT_STATUSES,
        required: true,
        default: "started",
      },

      startedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      durationMs: {
        type: Number,
        min: 0,
        default: null,
      },

      providerMessageId: {
        type: String,
        trim: true,
        default: "",
      },

      providerStatus: {
        type: String,
        trim: true,
        default: "",
      },

      response: {
        type: Schema.Types.Mixed,
        default: null,
      },

      error: {
        code: {
          type: String,
          trim: true,
          default: "",
        },

        message: {
          type: String,
          trim: true,
          default: "",
        },

        statusCode: {
          type: Number,
          default: null,
        },

        providerCode: {
          type: Schema.Types.Mixed,
          default: null,
        },

        retryable: {
          type: Boolean,
          default: false,
        },

        details: {
          type: Schema.Types.Mixed,
          default: null,
        },
      },

      retryDelayMs: {
        type: Number,
        min: 0,
        default: 0,
      },

      nextRetryAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: true,
      timestamps: false,
    }
  );

const messageDeliverySchema =
  new Schema(
    {
      deliveryId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        default:
          createDeliveryIdentifier,
      },

      campaign: {
        type: Schema.Types.ObjectId,
        ref: "CommunicationCampaign",
        default: null,
      },

      customer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      channel: {
        type: String,
        enum: DELIVERY_CHANNELS,
        required: true,
        lowercase: true,
        trim: true,
      },

      mode: {
        type: String,
        enum: DELIVERY_MODES,
        required: true,
        default: "sandbox",
        lowercase: true,
        trim: true,
      },

      provider: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },

      status: {
        type: String,
        enum: DELIVERY_STATUSES,
        required: true,
        default: "pending",
        lowercase: true,
        trim: true,
      },

      recipient: {
        name: {
          type: String,
          trim: true,
          default: "",
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
          default: "",
          set: normaliseEmail,
        },

        phone: {
          type: String,
          trim: true,
          default: "",
          set: normalisePhone,
        },
      },

      sender: {
        name: {
          type: String,
          trim: true,
          default: "",
        },

        email: {
          type: String,
          trim: true,
          lowercase: true,
          default: "",
          set: normaliseEmail,
        },

        phone: {
          type: String,
          trim: true,
          default: "",
          set: normalisePhone,
        },
      },

      contentSnapshot: {
        subject: {
          type: String,
          trim: true,
          default: "",
        },

        text: {
          type: String,
          default: "",
        },

        html: {
          type: String,
          default: "",
        },

        body: {
          type: String,
          default: "",
        },

        mediaUrls: {
          type: [
            {
              type: String,
              trim: true,
            },
          ],
          default: [],
        },
      },

      providerMessageId: {
        type: String,
        trim: true,
        default: "",
      },

      providerStatus: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },

      providerResponse: {
        type: Schema.Types.Mixed,
        default: null,
      },

      deliveryResponse: {
        type: Schema.Types.Mixed,
        default: null,
      },

      consent: {
        required: {
          type: Boolean,
          default: true,
        },

        checked: {
          type: Boolean,
          default: false,
        },

        granted: {
          type: Boolean,
          default: false,
        },

        source: {
          type: String,
          trim: true,
          default: "",
        },

        checkedAt: {
          type: Date,
          default: null,
        },
      },

      attemptCount: {
        type: Number,
        min: 0,
        default: 0,
      },

      maximumAttempts: {
        type: Number,
        min: 1,
        max: 10,
        default: 3,
      },

      attempts: {
        type: [deliveryAttemptSchema],
        default: [],
      },

      retry: {
        retryable: {
          type: Boolean,
          default: false,
        },

        nextRetryAt: {
          type: Date,
          default: null,
        },

        lastRetryDelayMs: {
          type: Number,
          min: 0,
          default: 0,
        },
      },

      failure: {
        code: {
          type: String,
          trim: true,
          default: "",
        },

        message: {
          type: String,
          trim: true,
          default: "",
        },

        statusCode: {
          type: Number,
          default: null,
        },

        providerCode: {
          type: Schema.Types.Mixed,
          default: null,
        },

        retryable: {
          type: Boolean,
          default: false,
        },

        details: {
          type: Schema.Types.Mixed,
          default: null,
        },
      },

      metrics: {
        durationMs: {
          type: Number,
          min: 0,
          default: null,
        },

        segments: {
          type: Number,
          min: 0,
          default: null,
        },

        mediaCount: {
          type: Number,
          min: 0,
          default: 0,
        },

        price: {
          type: String,
          trim: true,
          default: "",
        },

        priceUnit: {
          type: String,
          trim: true,
          uppercase: true,
          default: "",
        },
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },

      queuedAt: {
        type: Date,
        default: null,
      },

      processingStartedAt: {
        type: Date,
        default: null,
      },

      acceptedAt: {
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

      failedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },

      completedAt: {
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

        transform(
          document,
          returnedObject
        ) {
          delete returnedObject.__v;

          return returnedObject;
        },
      },

      toObject: {
        virtuals: true,
      },
    }
  );

messageDeliverySchema.index({
  campaign: 1,
  status: 1,
  createdAt: -1,
});

messageDeliverySchema.index({
  customer: 1,
  createdAt: -1,
});

messageDeliverySchema.index({
  channel: 1,
  status: 1,
  createdAt: -1,
});

messageDeliverySchema.index(
  {
    providerMessageId: 1,
  },
  {
    sparse: true,
  }
);

messageDeliverySchema.index({
  status: 1,
  "retry.nextRetryAt": 1,
});

messageDeliverySchema.index({
  createdAt: -1,
});

messageDeliverySchema.index({
  "recipient.email": 1,
  createdAt: -1,
});

messageDeliverySchema.index({
  "recipient.phone": 1,
  createdAt: -1,
});

messageDeliverySchema.virtual(
  "recipientAddress"
).get(function getRecipientAddress() {
  if (this.channel === "email") {
    return (
      this.recipient?.email || ""
    );
  }

  if (this.channel === "sms") {
    return (
      this.recipient?.phone || ""
    );
  }

  return "";
});

messageDeliverySchema.virtual(
  "isTerminal"
).get(function getIsTerminal() {
  return TERMINAL_DELIVERY_STATUSES.includes(
    this.status
  );
});

messageDeliverySchema.virtual(
  "isSuccessful"
).get(function getIsSuccessful() {
  return SUCCESSFUL_DELIVERY_STATUSES.includes(
    this.status
  );
});

messageDeliverySchema.virtual(
  "canRetry"
).get(function getCanRetry() {
  return (
    this.retry?.retryable ===
      true &&
    this.attemptCount <
      this.maximumAttempts &&
    ![
      "delivered",
      "sandbox",
      "cancelled",
      "skipped",
    ].includes(this.status)
  );
});

messageDeliverySchema.pre(
  "validate",
  function validateRecipient() {
    if (
      this.channel === "email" &&
      !normaliseText(
        this.recipient?.email
      )
    ) {
      this.invalidate(
        "recipient.email",
        "An email recipient is required for email delivery."
      );
    }

    if (
      this.channel === "sms" &&
      !normaliseText(
        this.recipient?.phone
      )
    ) {
      this.invalidate(
        "recipient.phone",
        "A phone recipient is required for SMS delivery."
      );
    }


  }
);

messageDeliverySchema.pre(
  "save",
  function applyStatusTimestamps() {
    if (!this.isModified("status")) {

      return;
    }

    const now = new Date();

    switch (this.status) {
      case "processing":
        this.processingStartedAt =
          this.processingStartedAt ||
          now;
        break;

      case "accepted":
        this.acceptedAt =
          this.acceptedAt || now;
        break;

      case "queued":
        this.queuedAt =
          this.queuedAt || now;
        break;

      case "sent":
        this.sentAt =
          this.sentAt || now;
        break;

      case "delivered":
      case "partially_delivered":
        this.deliveredAt =
          this.deliveredAt || now;

        this.completedAt =
          this.completedAt || now;
        break;

      case "sandbox":
      case "skipped":
        this.completedAt =
          this.completedAt || now;
        break;

      case "failed":
      case "undelivered":
        this.failedAt =
          this.failedAt || now;

        if (
          !this.retry?.retryable ||
          this.attemptCount >=
            this.maximumAttempts
        ) {
          this.completedAt =
            this.completedAt || now;
        }

        break;

      case "cancelled":
        this.cancelledAt =
          this.cancelledAt || now;

        this.completedAt =
          this.completedAt || now;
        break;

      default:
        break;
    }


  }
);

messageDeliverySchema.methods.startAttempt =
  function startAttempt() {
    const attemptNumber =
      this.attemptCount + 1;

    const attempt = {
      attemptNumber,
      status: "started",
      startedAt: new Date(),
    };

    this.attemptCount =
      attemptNumber;

    this.lastAttemptAt =
      attempt.startedAt;

    this.status = "processing";

    this.attempts.push(attempt);

    return this.attempts[
      this.attempts.length - 1
    ];
  };

messageDeliverySchema.methods.completeAttempt =
  function completeAttempt({
    status = "succeeded",
    providerMessageId = "",
    providerStatus = "",
    response = null,
    error = null,
    retryDelayMs = 0,
    nextRetryAt = null,
  } = {}) {
    const attempt =
      this.attempts[
        this.attempts.length - 1
      ];

    if (!attempt) {
      throw new Error(
        "No active message-delivery attempt exists."
      );
    }

    const completedAt =
      new Date();

    attempt.status = status;
    attempt.completedAt =
      completedAt;

    attempt.durationMs =
      completedAt.getTime() -
      new Date(
        attempt.startedAt
      ).getTime();

    attempt.providerMessageId =
      normaliseText(
        providerMessageId
      );

    attempt.providerStatus =
      normaliseLowercase(
        providerStatus
      );

    attempt.response = response;

    attempt.retryDelayMs =
      Math.max(
        0,
        Number(retryDelayMs) || 0
      );

    attempt.nextRetryAt =
      nextRetryAt || null;

    if (error) {
      attempt.error = {
        code:
          normaliseText(
            error.code
          ),

        message:
          normaliseText(
            error.message
          ),

        statusCode:
          error.statusCode ??
          null,

        providerCode:
          error.providerCode ??
          null,

        retryable:
          Boolean(
            error.retryable
          ),

        details:
          error.details ??
          null,
      };
    }

    return attempt;
  };

messageDeliverySchema.methods.markSuccessful =
  function markSuccessful(
    deliveryResult = {}
  ) {
    const providerResult =
      deliveryResult.result ||
      deliveryResult;

    this.providerMessageId =
      normaliseText(
        deliveryResult
          .providerMessageId ||
          providerResult
            .providerMessageId ||
          providerResult.messageId
      );

    this.providerStatus =
      normaliseLowercase(
        deliveryResult.status ||
          providerResult.status ||
          "accepted"
      );

    this.providerResponse =
      providerResult;

    this.deliveryResponse =
      deliveryResult;

    this.metrics.durationMs =
      deliveryResult.durationMs ??
      providerResult.durationMs ??
      null;

    this.metrics.segments =
      providerResult.segments ??
      null;

    this.metrics.mediaCount =
      providerResult.mediaCount ??
      0;

    this.metrics.price =
      normaliseText(
        providerResult.price
      );

    this.metrics.priceUnit =
      normaliseText(
        providerResult.priceUnit
      ).toUpperCase();

    this.retry.retryable =
      false;

    this.retry.nextRetryAt =
      null;

    this.retry.lastRetryDelayMs =
      0;

    this.failure = {
      code: "",
      message: "",
      statusCode: null,
      providerCode: null,
      retryable: false,
      details: null,
    };

    if (
      providerResult.mode ===
        "sandbox" ||
      providerResult.status ===
        "sandbox"
    ) {
      this.status = "sandbox";
    } else if (
      providerResult.status ===
      "delivered"
    ) {
      this.status = "delivered";
    } else if (
      providerResult.status ===
      "sent"
    ) {
      this.status = "sent";
    } else if (
      providerResult.status ===
      "queued"
    ) {
      this.status = "queued";
    } else {
      this.status = "accepted";
    }

    return this;
  };

messageDeliverySchema.methods.markFailed =
  function markFailed(
    error,
    {
      retryDelayMs = 0,
      nextRetryAt = null,
    } = {}
  ) {
    const retryable =
      Boolean(
        error?.retryable
      );

    this.status = "failed";

    this.failure = {
      code:
        normaliseText(
          error?.code
        ) ||
        "MESSAGE_DELIVERY_FAILED",

      message:
        normaliseText(
          error?.message
        ) ||
        "Message delivery failed.",

      statusCode:
        error?.statusCode ??
        500,

      providerCode:
        error?.providerCode ??
        error?.providerResponse
          ?.providerCode ??
        null,

      retryable,

      details:
        error?.providerResponse ||
        error?.details ||
        null,
    };

    this.retry.retryable =
      retryable;

    this.retry.lastRetryDelayMs =
      Math.max(
        0,
        Number(retryDelayMs) || 0
      );

    this.retry.nextRetryAt =
      retryable
        ? nextRetryAt || null
        : null;

    return this;
  };

messageDeliverySchema.methods.cancel =
  function cancel(reason = "") {
    this.status = "cancelled";

    this.failure = {
      code:
        "DELIVERY_CANCELLED",

      message:
        normaliseText(reason) ||
        "Message delivery was cancelled.",

      statusCode: null,
      providerCode: null,
      retryable: false,
      details: null,
    };

    this.retry.retryable =
      false;

    this.retry.nextRetryAt =
      null;

    return this;
  };

messageDeliverySchema.statics.findRetryable =
  function findRetryable({
    dueBefore = new Date(),
    limit = 100,
  } = {}) {
    const safeLimit =
      Math.min(
        1000,
        Math.max(
          1,
          Number(limit) || 100
        )
      );

    return this.find({
      status: {
        $in: [
          "failed",
          "undelivered",
        ],
      },

      "retry.retryable": true,

      "retry.nextRetryAt": {
        $ne: null,
        $lte: dueBefore,
      },

      $expr: {
        $lt: [
          "$attemptCount",
          "$maximumAttempts",
        ],
      },
    })
      .sort({
        "retry.nextRetryAt": 1,
      })
      .limit(safeLimit);
  };

messageDeliverySchema.statics.findByProviderMessageId =
  function findByProviderMessageId(
    providerMessageId
  ) {
    return this.findOne({
      providerMessageId:
        normaliseText(
          providerMessageId
        ),
    });
  };

messageDeliverySchema.statics.getCampaignSummary =
  function getCampaignSummary(
    campaignId
  ) {
    return this.aggregate([
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

      {
        $group: {
          _id: null,

          statusCounts: {
            $push: {
              status: "$_id",
              count: "$count",
            },
          },

          total: {
            $sum: "$count",
          },
        },
      },

      {
        $project: {
          _id: 0,
          total: 1,
          statusCounts: 1,
        },
      },
    ]);
  };

const MessageDelivery =
  models.MessageDelivery ||
  model(
    "MessageDelivery",
    messageDeliverySchema
  );

export {
  ATTEMPT_STATUSES,
  DELIVERY_CHANNELS,
  DELIVERY_MODES,
  DELIVERY_STATUSES,
  SUCCESSFUL_DELIVERY_STATUSES,
  TERMINAL_DELIVERY_STATUSES,
};

export default MessageDelivery;