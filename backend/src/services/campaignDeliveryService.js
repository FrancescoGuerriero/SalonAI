import mongoose from "mongoose";

import CommunicationCampaign from "../models/CommunicationCampaign.js";

import {
  getMessageDeliveryConfig,
} from "../config/messageDeliveryConfig.js";

import {
  deliverAndRecordMessage,
} from "./messageDeliveryRecordService.js";

const SUPPORTED_CAMPAIGN_CHANNELS = [
  "email",
  "sms",
];

const PROCESSABLE_CAMPAIGN_STATUSES = [
  "scheduled",
  "queued",
  "paused",
];

const TERMINAL_CAMPAIGN_STATUSES = [
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
];

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 5;
const MAX_CAMPAIGN_RECIPIENTS = 10000;

let customerModelCache = null;
let customerSegmentModelCache = null;

function createCampaignDeliveryError(
  message,
  {
    statusCode = 500,
    code = "CAMPAIGN_DELIVERY_ERROR",
    cause = null,
    campaign = null,
    details = null,
  } = {}
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;
  error.campaign = campaign;
  error.details = details;

  if (cause) {
    error.cause = cause;
  }

  return error;
}

function normaliseText(value) {
  return String(value ?? "").trim();
}

function normaliseLowercase(value) {
  return normaliseText(
    value
  ).toLowerCase();
}

function normaliseInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.floor(number)
    )
  );
}

function normaliseBoolean(
  value,
  fallback = false
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalisedValue =
    normaliseLowercase(value);

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "enabled",
      "subscribed",
    ].includes(normalisedValue)
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "disabled",
      "unsubscribed",
    ].includes(normalisedValue)
  ) {
    return false;
  }

  return fallback;
}

function normaliseObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
}

function sleep(milliseconds) {
  const delay =
    normaliseInteger(
      milliseconds,
      0,
      0,
      3600000
    );

  if (delay === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

function getDocumentId(document) {
  return (
    document?._id ||
    document?.id ||
    null
  );
}

function getValueByPath(
  object,
  path
) {
  if (!object || !path) {
    return undefined;
  }

  return path
    .split(".")
    .reduce(
      (value, part) =>
        value === undefined ||
        value === null
          ? undefined
          : value[part],
      object
    );
}

function getFirstValue(
  object,
  paths
) {
  for (const path of paths) {
    const value =
      getValueByPath(
        object,
        path
      );

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return undefined;
}

function modelHasPath(
  Model,
  path
) {
  return Boolean(
    Model?.schema?.path(path)
  );
}

function getFirstModelPath(
  Model,
  candidates
) {
  return (
    candidates.find((path) =>
      modelHasPath(Model, path)
    ) || null
  );
}

async function importFirstAvailableModel({
  modelNames,
  importPaths,
}) {
  for (const modelName of modelNames) {
    if (mongoose.models[modelName]) {
      return mongoose.models[
        modelName
      ];
    }
  }

  for (const importPath of importPaths) {
    try {
      const importedModule =
        await import(importPath);

      const ImportedModel =
        importedModule.default;

      if (ImportedModel) {
        return ImportedModel;
      }
    } catch (error) {
      if (
        error?.code !==
          "ERR_MODULE_NOT_FOUND" &&
        !String(
          error?.message || ""
        ).includes(
          "Cannot find module"
        )
      ) {
        throw error;
      }
    }
  }

  for (const modelName of modelNames) {
    if (mongoose.models[modelName]) {
      return mongoose.models[
        modelName
      ];
    }
  }

  return null;
}

async function getCustomerModel() {
  if (customerModelCache) {
    return customerModelCache;
  }

  customerModelCache =
    await importFirstAvailableModel({
      modelNames: [
        "Customer",
        "User",
      ],

      importPaths: [
        "../models/Customer.js",
        "../models/Customer.js",
        "../models/User.js",
        "../models/User.js",
      ],
    });

  if (!customerModelCache) {
    throw createCampaignDeliveryError(
      "A Customer or User model could not be loaded.",
      {
        statusCode: 500,
        code:
          "CUSTOMER_MODEL_UNAVAILABLE",
      }
    );
  }

  return customerModelCache;
}

async function getCustomerSegmentModel() {
  if (customerSegmentModelCache) {
    return customerSegmentModelCache;
  }

  customerSegmentModelCache =
    await importFirstAvailableModel({
      modelNames: [
        "CustomerSegment",
        "Segment",
      ],

      importPaths: [
        "../models/CustomerSegment.js",
        "../models/customerSegment.js",
        "../models/Segment.js",
        "../models/segment.js",
      ],
    });

  return customerSegmentModelCache;
}

function assertValidCampaignId(
  campaignId
) {
  if (
    !mongoose.isValidObjectId(
      campaignId
    )
  ) {
    throw createCampaignDeliveryError(
      "A valid communication campaign ID is required.",
      {
        statusCode: 400,
        code:
          "INVALID_CAMPAIGN_ID",
      }
    );
  }
}

function getCampaignChannel(
  campaign
) {
  const channel =
    normaliseLowercase(
      campaign?.channel
    );

  if (
    !SUPPORTED_CAMPAIGN_CHANNELS.includes(
      channel
    )
  ) {
    throw createCampaignDeliveryError(
      `Real delivery is not currently supported for the ${channel || "unknown"} channel.`,
      {
        statusCode: 400,
        code:
          "UNSUPPORTED_CAMPAIGN_CHANNEL",
        campaign,
      }
    );
  }

  return channel;
}

function getCustomerName(
  customer
) {
  const directName =
    normaliseText(
      getFirstValue(
        customer,
        [
          "name",
          "fullName",
          "displayName",
          "profile.name",
        ]
      )
    );

  if (directName) {
    return directName;
  }

  const firstName =
    normaliseText(
      getFirstValue(
        customer,
        [
          "firstName",
          "profile.firstName",
          "personalDetails.firstName",
        ]
      )
    );

  const lastName =
    normaliseText(
      getFirstValue(
        customer,
        [
          "lastName",
          "profile.lastName",
          "personalDetails.lastName",
        ]
      )
    );

  return [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function getCustomerFirstName(
  customer
) {
  const firstName =
    normaliseText(
      getFirstValue(
        customer,
        [
          "firstName",
          "profile.firstName",
          "personalDetails.firstName",
        ]
      )
    );

  if (firstName) {
    return firstName;
  }

  return getCustomerName(
    customer
  )
    .split(/\s+/)[0] || "";
}

function getCustomerLastName(
  customer
) {
  const lastName =
    normaliseText(
      getFirstValue(
        customer,
        [
          "lastName",
          "profile.lastName",
          "personalDetails.lastName",
        ]
      )
    );

  if (lastName) {
    return lastName;
  }

  const nameParts =
    getCustomerName(
      customer
    ).split(/\s+/);

  return nameParts.length > 1
    ? nameParts
        .slice(1)
        .join(" ")
    : "";
}

function getCustomerEmail(
  customer
) {
  return normaliseLowercase(
    getFirstValue(
      customer,
      [
        "email",
        "contact.email",
        "contactDetails.email",
        "profile.email",
      ]
    )
  );
}

function getCustomerPhone(
  customer
) {
  return normaliseText(
    getFirstValue(
      customer,
      [
        "phone",
        "phoneNumber",
        "mobile",
        "mobileNumber",
        "contact.phone",
        "contact.mobile",
        "contactDetails.phone",
        "contactDetails.mobile",
        "profile.phone",
      ]
    )
  );
}

function getCustomerTags(
  customer
) {
  const tags =
    getFirstValue(
      customer,
      [
        "tags",
        "customerTags",
        "profile.tags",
      ]
    );

  return Array.isArray(tags)
    ? tags.map(normaliseText).filter(Boolean)
    : [];
}

function getCustomerTemplateValues(
  customer,
  campaign
) {
  const config =
    getMessageDeliveryConfig();

  const name =
    getCustomerName(customer);

  return {
    firstName:
      getCustomerFirstName(
        customer
      ),

    lastName:
      getCustomerLastName(
        customer
      ),

    name,

    fullName: name,

    email:
      getCustomerEmail(
        customer
      ),

    phone:
      getCustomerPhone(
        customer
      ),

    salonName:
      normaliseText(
        campaign?.salonName
      ) ||
      config.application.name ||
      "SalonAI",

    campaignName:
      normaliseText(
        campaign?.name
      ),

    unsubscribeUrl:
      normaliseText(
        campaign
          ?.unsubscribeUrl
      ),

    customerId:
      String(
        getDocumentId(
          customer
        ) || ""
      ),

    tags:
      getCustomerTags(
        customer
      ).join(", "),
  };
}

function renderTemplate(
  template,
  values
) {
  return String(
    template ?? ""
  ).replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (
      fullMatch,
      variableName
    ) => {
      const value =
        getValueByPath(
          values,
          variableName
        );

      if (
        value === undefined ||
        value === null
      ) {
        return "";
      }

      return String(value);
    }
  );
}

function getCampaignContent(
  campaign,
  customer
) {
  const values =
    getCustomerTemplateValues(
      customer,
      campaign
    );

  const subject =
    getFirstValue(
      campaign,
      [
        "subject",
        "message.subject",
        "content.subject",
        "email.subject",
      ]
    );

  const text =
    getFirstValue(
      campaign,
      [
        "text",
        "message.text",
        "content.text",
      ]
    );

  const html =
    getFirstValue(
      campaign,
      [
        "html",
        "message.html",
        "content.html",
        "email.html",
      ]
    );

  const body =
    getFirstValue(
      campaign,
      [
        "body",
        "message.body",
        "content.body",
        "sms.body",
      ]
    );

  return {
    subject:
      renderTemplate(
        subject,
        values
      ),

    text:
      renderTemplate(
        text || body,
        values
      ),

    html:
      renderTemplate(
        html,
        values
      ),

    body:
      renderTemplate(
        body || text,
        values
      ),

    values,
  };
}

function getExplicitConsentValue(
  customer,
  channel
) {
  const channelPaths =
    channel === "email"
      ? [
          "communicationPreferences.email",
          "communicationPreferences.emailMarketing",
          "preferences.email",
          "preferences.emailMarketing",
          "marketingConsent.email",
          "consent.email",
          "emailConsent",
          "emailMarketingConsent",
          "allowEmail",
          "subscribedToEmail",
        ]
      : [
          "communicationPreferences.sms",
          "communicationPreferences.smsMarketing",
          "preferences.sms",
          "preferences.smsMarketing",
          "marketingConsent.sms",
          "consent.sms",
          "smsConsent",
          "smsMarketingConsent",
          "allowSms",
          "subscribedToSms",
        ];

  for (const path of channelPaths) {
    const value =
      getValueByPath(
        customer,
        path
      );

    if (
      value !== undefined &&
      value !== null
    ) {
      return {
        found: true,
        granted:
          normaliseBoolean(
            value,
            false
          ),
        source: path,
      };
    }
  }

  return {
    found: false,
    granted: false,
    source: "",
  };
}

function isCustomerUnsubscribed(
  customer,
  channel
) {
  const generalPaths = [
    "unsubscribed",
    "isUnsubscribed",
    "marketingUnsubscribed",
    "communicationPreferences.unsubscribed",
    "preferences.unsubscribed",
  ];

  const channelPaths =
    channel === "email"
      ? [
          "emailUnsubscribed",
          "communicationPreferences.emailUnsubscribed",
          "preferences.emailUnsubscribed",
        ]
      : [
          "smsUnsubscribed",
          "communicationPreferences.smsUnsubscribed",
          "preferences.smsUnsubscribed",
        ];

  return [
    ...generalPaths,
    ...channelPaths,
  ].some((path) =>
    normaliseBoolean(
      getValueByPath(
        customer,
        path
      ),
      false
    )
  );
}

function resolveCustomerConsent(
  customer,
  channel,
  {
    consentRequired,
    excludeUnsubscribed,
  }
) {
  if (
    excludeUnsubscribed &&
    isCustomerUnsubscribed(
      customer,
      channel
    )
  ) {
    return {
      required:
        consentRequired,
      checked: true,
      granted: false,
      source:
        "customer_unsubscribed",
      checkedAt:
        new Date(),
    };
  }

  if (!consentRequired) {
    return {
      required: false,
      checked: true,
      granted: true,
      source:
        "consent_not_required",
      checkedAt:
        new Date(),
    };
  }

  const consent =
    getExplicitConsentValue(
      customer,
      channel
    );

  return {
    required: true,
    checked:
      consent.found,
    granted:
      consent.found &&
      consent.granted,
    source:
      consent.source ||
      "consent_not_recorded",
    checkedAt:
      new Date(),
  };
}

function buildBaseCustomerQuery(
  CustomerModel
) {
  const query = {};

  const rolePath =
    getFirstModelPath(
      CustomerModel,
      [
        "role",
        "account.role",
      ]
    );

  if (
    rolePath &&
    CustomerModel.modelName ===
      "User"
  ) {
    query[rolePath] =
      "customer";
  }

  const activePath =
    getFirstModelPath(
      CustomerModel,
      [
        "active",
        "isActive",
        "account.active",
      ]
    );

  if (activePath) {
    query[activePath] = {
      $ne: false,
    };
  }

  const deletedPath =
    getFirstModelPath(
      CustomerModel,
      [
        "deleted",
        "isDeleted",
      ]
    );

  if (deletedPath) {
    query[deletedPath] = {
      $ne: true,
    };
  }

  return query;
}

function applyRangeFilter(
  query,
  path,
  {
    minimum,
    maximum,
  }
) {
  if (!path) {
    return;
  }

  const range = {};

  if (
    minimum !== undefined &&
    minimum !== null &&
    minimum !== ""
  ) {
    range.$gte =
      Number(minimum);
  }

  if (
    maximum !== undefined &&
    maximum !== null &&
    maximum !== ""
  ) {
    range.$lte =
      Number(maximum);
  }

  if (
    Object.keys(range).length >
    0
  ) {
    query[path] = range;
  }
}

function applyDateRangeFilter(
  query,
  path,
  {
    from,
    to,
  }
) {
  if (!path) {
    return;
  }

  const range = {};

  if (from) {
    const fromDate =
      new Date(from);

    if (
      !Number.isNaN(
        fromDate.getTime()
      )
    ) {
      range.$gte = fromDate;
    }
  }

  if (to) {
    const toDate =
      new Date(to);

    if (
      !Number.isNaN(
        toDate.getTime()
      )
    ) {
      range.$lte = toDate;
    }
  }

  if (
    Object.keys(range).length >
    0
  ) {
    query[path] = range;
  }
}

function buildCustomCustomerQuery(
  CustomerModel,
  filters = {}
) {
  const query =
    buildBaseCustomerQuery(
      CustomerModel
    );

  const normalisedFilters =
    normaliseObject(filters);

  const statusPath =
    getFirstModelPath(
      CustomerModel,
      [
        "status",
        "customerStatus",
      ]
    );

  if (
    statusPath &&
    normalisedFilters.status
  ) {
    query[statusPath] =
      normalisedFilters.status;
  }

  const tagsPath =
    getFirstModelPath(
      CustomerModel,
      [
        "tags",
        "customerTags",
        "profile.tags",
      ]
    );

  const tags =
    Array.isArray(
      normalisedFilters.tags
    )
      ? normalisedFilters.tags
          .map(normaliseText)
          .filter(Boolean)
      : [];

  if (
    tagsPath &&
    tags.length > 0
  ) {
    query[tagsPath] = {
      $in: tags,
    };
  }

  applyRangeFilter(
    query,
    getFirstModelPath(
      CustomerModel,
      [
        "totalSpend",
        "metrics.totalSpend",
        "statistics.totalSpend",
      ]
    ),
    {
      minimum:
        normalisedFilters
          .minimumSpend ??
        normalisedFilters
          .minSpend,

      maximum:
        normalisedFilters
          .maximumSpend ??
        normalisedFilters
          .maxSpend,
    }
  );

  applyRangeFilter(
    query,
    getFirstModelPath(
      CustomerModel,
      [
        "appointmentCount",
        "metrics.appointmentCount",
        "statistics.appointmentCount",
      ]
    ),
    {
      minimum:
        normalisedFilters
          .minimumAppointments ??
        normalisedFilters
          .minAppointments,

      maximum:
        normalisedFilters
          .maximumAppointments ??
        normalisedFilters
          .maxAppointments,
    }
  );

  applyDateRangeFilter(
    query,
    getFirstModelPath(
      CustomerModel,
      [
        "lastVisitAt",
        "lastAppointmentAt",
        "metrics.lastVisitAt",
      ]
    ),
    {
      from:
        normalisedFilters
          .lastVisitFrom,

      to:
        normalisedFilters
          .lastVisitTo,
    }
  );

  applyDateRangeFilter(
    query,
    "createdAt",
    {
      from:
        normalisedFilters
          .createdFrom,

      to:
        normalisedFilters
          .createdTo,
    }
  );

  return query;
}

function extractSegmentCustomerIds(
  segment
) {
  const candidateLists = [
    segment?.customerIds,
    segment?.customers,
    segment?.members,
    segment?.matchingCustomerIds,
    segment?.matchedCustomerIds,
    segment?.cachedCustomerIds,
  ];

  const identifiers = [];

  for (const candidate of candidateLists) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    for (const entry of candidate) {
      const identifier =
        entry?._id ||
        entry?.customerId ||
        entry?.customer ||
        entry;

      if (
        mongoose.isValidObjectId(
          identifier
        )
      ) {
        identifiers.push(
          String(identifier)
        );
      }
    }
  }

  return Array.from(
    new Set(identifiers)
  );
}

function getSegmentFilters(
  segment
) {
  return (
    segment?.filters ||
    segment?.criteria ||
    segment?.rules ||
    segment?.query ||
    segment?.mongoQuery ||
    {}
  );
}

async function resolveSegmentCustomers({
  CustomerModel,
  segmentIds,
  maximumRecipients,
}) {
  const SegmentModel =
    await getCustomerSegmentModel();

  if (!SegmentModel) {
    throw createCampaignDeliveryError(
      "Customer segment delivery requires a CustomerSegment model.",
      {
        statusCode: 500,
        code:
          "CUSTOMER_SEGMENT_MODEL_UNAVAILABLE",
      }
    );
  }

  const validSegmentIds =
    segmentIds
      .map(String)
      .filter((identifier) =>
        mongoose.isValidObjectId(
          identifier
        )
      );

  if (
    validSegmentIds.length === 0
  ) {
    return [];
  }

  const segments =
    await SegmentModel.find({
      _id: {
        $in: validSegmentIds,
      },
    }).lean();

  const customerMap =
    new Map();

  for (const segment of segments) {
    const customerIds =
      extractSegmentCustomerIds(
        segment
      );

    if (
      customerIds.length > 0
    ) {
      const customers =
        await CustomerModel.find({
          ...buildBaseCustomerQuery(
            CustomerModel
          ),

          _id: {
            $in: customerIds,
          },
        })
          .limit(
            maximumRecipients
          )
          .lean();

      for (const customer of customers) {
        customerMap.set(
          String(
            getDocumentId(
              customer
            )
          ),
          customer
        );
      }
    } else {
      const filters =
        getSegmentFilters(
          segment
        );

      const customers =
        await CustomerModel.find(
          buildCustomCustomerQuery(
            CustomerModel,
            filters
          )
        )
          .limit(
            maximumRecipients
          )
          .lean();

      for (const customer of customers) {
        customerMap.set(
          String(
            getDocumentId(
              customer
            )
          ),
          customer
        );
      }
    }

    if (
      customerMap.size >=
      maximumRecipients
    ) {
      break;
    }
  }

  return Array.from(
    customerMap.values()
  ).slice(
    0,
    maximumRecipients
  );
}

async function resolveCampaignAudience(
  campaign,
  options = {}
) {
  const CustomerModel =
    await getCustomerModel();

  const maximumRecipients =
    normaliseInteger(
      options.maximumRecipients,
      MAX_CAMPAIGN_RECIPIENTS,
      1,
      MAX_CAMPAIGN_RECIPIENTS
    );

  const audience =
    normaliseObject(
      campaign?.audience
    );

  const audienceType =
    normaliseLowercase(
      audience.type ||
      campaign?.audienceType ||
      "all_customers"
    );

  if (
    audienceType ===
    "selected_customers"
  ) {
    const customerIds = [
      ...(Array.isArray(
        audience.customerIds
      )
        ? audience.customerIds
        : []),

      ...(Array.isArray(
        campaign
          ?.customerIds
      )
        ? campaign.customerIds
        : []),
    ]
      .map((entry) =>
        entry?._id ||
        entry?.customerId ||
        entry
      )
      .filter((identifier) =>
        mongoose.isValidObjectId(
          identifier
        )
      );

    if (
      customerIds.length === 0
    ) {
      return [];
    }

    return CustomerModel.find({
      ...buildBaseCustomerQuery(
        CustomerModel
      ),

      _id: {
        $in: customerIds,
      },
    })
      .limit(
        maximumRecipients
      )
      .lean();
  }

  if (
    audienceType === "segments"
  ) {
    const segmentIds = [
      ...(Array.isArray(
        audience.segments
      )
        ? audience.segments
        : []),

      ...(Array.isArray(
        audience.segmentIds
      )
        ? audience.segmentIds
        : []),

      ...(Array.isArray(
        campaign?.segmentIds
      )
        ? campaign.segmentIds
        : []),
    ].map((entry) =>
      entry?._id ||
      entry?.segmentId ||
      entry
    );

    return resolveSegmentCustomers({
      CustomerModel,
      segmentIds,
      maximumRecipients,
    });
  }

  if (
    audienceType ===
    "custom_filters"
  ) {
    const filters =
      audience.filters ||
      audience.criteria ||
      audience.rules ||
      campaign?.audienceFilters ||
      {};

    return CustomerModel.find(
      buildCustomCustomerQuery(
        CustomerModel,
        filters
      )
    )
      .limit(
        maximumRecipients
      )
      .lean();
  }

  if (
    audienceType !==
    "all_customers"
  ) {
    throw createCampaignDeliveryError(
      `Unsupported campaign audience type: ${audienceType}.`,
      {
        statusCode: 400,
        code:
          "UNSUPPORTED_CAMPAIGN_AUDIENCE",
        campaign,
      }
    );
  }

  return CustomerModel.find(
    buildBaseCustomerQuery(
      CustomerModel
    )
  )
    .limit(
      maximumRecipients
    )
    .lean();
}

function setCampaignPath(
  campaign,
  candidatePaths,
  value
) {
  for (const path of candidatePaths) {
    if (
      campaign.schema?.path(path) ||
      campaign.get(path) !==
        undefined
    ) {
      campaign.set(path, value);

      return path;
    }
  }

  return null;
}

function incrementCampaignPath(
  campaign,
  candidatePaths,
  incrementBy
) {
  for (const path of candidatePaths) {
    if (
      campaign.schema?.path(path) ||
      campaign.get(path) !==
        undefined
    ) {
      const currentValue =
        Number(
          campaign.get(path)
        ) || 0;

      campaign.set(
        path,
        currentValue +
          incrementBy
      );

      return path;
    }
  }

  return null;
}

function setCampaignStatus(
  campaign,
  status
) {
  if (
    normaliseLowercase(
      campaign.status
    ) === status
  ) {
    return;
  }

  if (
    typeof campaign.canTransitionTo ===
      "function" &&
    !campaign.canTransitionTo(status)
  ) {
    throw createCampaignDeliveryError(
      `Campaign cannot transition from ${campaign.status} to ${status}.`,
      {
        statusCode: 409,
        code:
          "INVALID_CAMPAIGN_STATUS_TRANSITION",
        campaign,
      }
    );
  }

  campaign.status = status;
}

function updateCampaignProgress(
  campaign,
  summary
) {
  setCampaignPath(
    campaign,
    [
      "deliveryCounts.totalRecipients",
      "delivery.totalRecipients",
      "metrics.totalRecipients",
    ],
    summary.totalRecipients
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.processed",
      "delivery.processed",
      "metrics.processed",
    ],
    summary.processed
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.sent",
      "deliveryCounts.successful",
      "delivery.sent",
      "metrics.sent",
    ],
    summary.successful
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.failed",
      "delivery.failed",
      "metrics.failed",
    ],
    summary.failed
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.skipped",
      "delivery.skipped",
      "metrics.skipped",
    ],
    summary.skipped
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.deferred",
      "delivery.deferred",
      "metrics.deferred",
    ],
    summary.deferred
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.delivered",
      "delivery.delivered",
      "metrics.delivered",
    ],
    summary.successful
  );

  setCampaignPath(
    campaign,
    [
      "delivery.lastUpdatedAt",
      "deliveryUpdatedAt",
      "lastProcessedAt",
    ],
    new Date()
  );
}

function createInitialSummary(
  campaign,
  recipients
) {
  return {
    campaignId:
      String(
        getDocumentId(
          campaign
        )
      ),

    campaignName:
      normaliseText(
        campaign.name
      ),

    channel:
      getCampaignChannel(
        campaign
      ),

    totalRecipients:
      recipients.length,

    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,

    results: [],

    startedAt:
      new Date().toISOString(),

    completedAt: null,
  };
}

function createDeliveryRequest({
  campaign,
  customer,
  channel,
  consent,
}) {
  const content =
    getCampaignContent(
      campaign,
      customer
    );

  const customerId =
    getDocumentId(
      customer
    );

  const recipientName =
    getCustomerName(
      customer
    );

  const commonRequest = {
    channel,

    campaignId:
      getDocumentId(
        campaign
      ),

    customerId,

    recipient: {
      name: recipientName,

      email:
        getCustomerEmail(
          customer
        ),

      phone:
        getCustomerPhone(
          customer
        ),
    },

    consent,

    metadata: {
      campaignId:
        String(
          getDocumentId(
            campaign
          )
        ),

      campaignName:
        normaliseText(
          campaign.name
        ),

      customerId:
        String(
          customerId || ""
        ),

      recipientName,

      audienceType:
        normaliseText(
          campaign.audience?.type
        ),

      templateValues:
        content.values,
    },
  };

  if (channel === "email") {
    const email =
      getCustomerEmail(
        customer
      );

    if (!email) {
      throw createCampaignDeliveryError(
        "Customer does not have an email address.",
        {
          statusCode: 400,
          code:
            "CUSTOMER_EMAIL_MISSING",
          campaign,
          details: {
            customerId:
              String(
                customerId || ""
              ),
          },
        }
      );
    }

    if (!content.subject) {
      throw createCampaignDeliveryError(
        "Email campaign subject is required.",
        {
          statusCode: 400,
          code:
            "CAMPAIGN_EMAIL_SUBJECT_REQUIRED",
          campaign,
        }
      );
    }

    if (
      !content.text &&
      !content.html
    ) {
      throw createCampaignDeliveryError(
        "Email campaign content is required.",
        {
          statusCode: 400,
          code:
            "CAMPAIGN_EMAIL_CONTENT_REQUIRED",
          campaign,
        }
      );
    }

    return {
      ...commonRequest,
      to: email,
      subject:
        content.subject,
      text:
        content.text,
      html:
        content.html,
    };
  }

  const phone =
    getCustomerPhone(
      customer
    );

  if (!phone) {
    throw createCampaignDeliveryError(
      "Customer does not have a phone number.",
      {
        statusCode: 400,
        code:
          "CUSTOMER_PHONE_MISSING",
        campaign,
        details: {
          customerId:
            String(
              customerId || ""
            ),
        },
      }
    );
  }

  if (!content.body) {
    throw createCampaignDeliveryError(
      "SMS campaign content is required.",
      {
        statusCode: 400,
        code:
          "CAMPAIGN_SMS_CONTENT_REQUIRED",
        campaign,
      }
    );
  }

  return {
    ...commonRequest,
    to: phone,
    body: content.body,
  };
}

function serialiseCampaignDeliveryError(
  error
) {
  return {
    message:
      error?.message ||
      "Campaign message delivery failed.",

    code:
      error?.code ||
      "CAMPAIGN_MESSAGE_DELIVERY_FAILED",

    statusCode:
      error?.statusCode ||
      500,

    retryable:
      Boolean(
        error?.retryable
      ),

    details:
      error?.details ||
      error?.providerResponse ||
      null,
  };
}

async function processRecipient({
  campaign,
  customer,
  channel,
  consentOptions,
  deliveryOptions,
}) {
  const consent =
    resolveCustomerConsent(
      customer,
      channel,
      consentOptions
    );

  const request =
    createDeliveryRequest({
      campaign,
      customer,
      channel,
      consent,
    });

  return deliverAndRecordMessage(
    request,
    {
      campaignId:
        getDocumentId(
          campaign
        ),

      customerId:
        getDocumentId(
          customer
        ),

      maximumAttempts:
        deliveryOptions
          .maximumAttempts,

      retryDelayMs:
        deliveryOptions
          .retryDelayMs,

      deferRetries:
        deliveryOptions
          .deferRetries,

      consent,

      createdBy:
        deliveryOptions
          .userId,

      updatedBy:
        deliveryOptions
          .userId,

      metadata: {
        source:
          "campaign_delivery",

        campaignBatch:
          deliveryOptions
            .batchNumber,
      },
    }
  );
}

async function processRecipientBatch({
  campaign,
  recipients,
  channel,
  concurrency,
  consentOptions,
  deliveryOptions,
}) {
  const results =
    new Array(
      recipients.length
    );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        recipients.length
      ) {
        return;
      }

      const customer =
        recipients[currentIndex];

      try {
        const result =
          await processRecipient({
            campaign,
            customer,
            channel,
            consentOptions,
            deliveryOptions,
          });

        results[currentIndex] = {
          success:
            Boolean(
              result.success
            ),

          skipped:
            Boolean(
              result.skipped
            ),

          deferred:
            Boolean(
              result.deferred
            ),

          customerId:
            String(
              getDocumentId(
                customer
              ) || ""
            ),

          deliveryId:
            result.delivery
              ?.deliveryId ||
            null,

          status:
            result.delivery
              ?.status ||
            null,

          result,
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,
          skipped: false,
          deferred: false,

          customerId:
            String(
              getDocumentId(
                customer
              ) || ""
            ),

          deliveryId:
            error?.delivery
              ?.deliveryId ||
            null,

          status:
            error?.delivery
              ?.status ||
            "failed",

          error:
            serialiseCampaignDeliveryError(
              error
            ),
        };
      }
    }
  }

  const workerCount =
    Math.min(
      concurrency,
      recipients.length
    );

  await Promise.all(
    Array.from(
      {
        length: workerCount,
      },
      () => worker()
    )
  );

  return results.filter(Boolean);
}

function mergeBatchResults(
  summary,
  batchResults
) {
  for (const result of batchResults) {
    summary.processed += 1;

    if (result.skipped) {
      summary.skipped += 1;
    } else if (
      result.deferred
    ) {
      summary.deferred += 1;
    } else if (
      result.success
    ) {
      summary.successful += 1;
    } else {
      summary.failed += 1;
    }

    summary.results.push(result);
  }
}

function determineFinalCampaignStatus(
  summary
) {
  if (
    summary.processed === 0
  ) {
    return "failed";
  }

  if (
    summary.failed === 0 &&
    summary.deferred === 0
  ) {
    return "completed";
  }

  if (
    summary.successful > 0 ||
    summary.skipped > 0
  ) {
    return "partially_completed";
  }

  return "failed";
}

async function loadCampaign(
  campaignId
) {
  assertValidCampaignId(
    campaignId
  );

  const campaign =
    await CommunicationCampaign.findById(
      campaignId
    );

  if (!campaign) {
    throw createCampaignDeliveryError(
      "Communication campaign not found.",
      {
        statusCode: 404,
        code:
          "COMMUNICATION_CAMPAIGN_NOT_FOUND",
      }
    );
  }

  return campaign;
}

function assertCampaignCanBeProcessed(
  campaign,
  {
    allowDraft = false,
    force = false,
  } = {}
) {
  const status =
    normaliseLowercase(
      campaign.status
    );

  if (
    TERMINAL_CAMPAIGN_STATUSES.includes(
      status
    ) &&
    !force
  ) {
    throw createCampaignDeliveryError(
      `Campaign is already in terminal status: ${status}.`,
      {
        statusCode: 409,
        code:
          "CAMPAIGN_ALREADY_COMPLETED",
        campaign,
      }
    );
  }

  if (
    status === "draft" &&
    !allowDraft
  ) {
    throw createCampaignDeliveryError(
      "Draft campaigns must be scheduled or explicitly sent before delivery.",
      {
        statusCode: 409,
        code:
          "CAMPAIGN_IS_DRAFT",
        campaign,
      }
    );
  }

  if (
    status !== "draft" &&
    !PROCESSABLE_CAMPAIGN_STATUSES.includes(
      status
    ) &&
    status !== "processing" &&
    !force
  ) {
    throw createCampaignDeliveryError(
      `Campaign cannot be processed from status: ${status}.`,
      {
        statusCode: 409,
        code:
          "CAMPAIGN_NOT_PROCESSABLE",
        campaign,
      }
    );
  }
}

async function processCampaignDelivery(
  campaignId,
  options = {}
) {
  const campaign =
    await loadCampaign(
      campaignId
    );

  assertCampaignCanBeProcessed(
    campaign,
    options
  );

  const config =
    getMessageDeliveryConfig();

  const channel =
    getCampaignChannel(
      campaign
    );

  const recipients =
    await resolveCampaignAudience(
      campaign,
      {
        maximumRecipients:
          options.maximumRecipients,
      }
    );

  const summary =
    createInitialSummary(
      campaign,
      recipients
    );

  const batchSize =
    normaliseInteger(
      options.batchSize ??
        campaign.schedule
          ?.batchSize,
      DEFAULT_BATCH_SIZE,
      1,
      1000
    );

  const delayBetweenBatchesSeconds =
    normaliseInteger(
      options.delayBetweenBatchesSeconds ??
        campaign.schedule
          ?.delayBetweenBatchesSeconds,
      0,
      0,
      86400
    );

  const concurrency =
    normaliseInteger(
      options.concurrency,
      DEFAULT_CONCURRENCY,
      1,
      50
    );

  const userId =
    options.userId ||
    options.updatedBy ||
    campaign.updatedBy ||
    campaign.createdBy ||
    null;

  const consentOptions = {
    consentRequired:
      options.consentRequired ??
      campaign.deliverySettings
        ?.consentRequired ??
      config.consent.required,

    excludeUnsubscribed:
      options.excludeUnsubscribed ??
      config.consent
        .excludeUnsubscribed,
  };

  const deliveryOptions = {
    maximumAttempts:
      options.maximumAttempts ??
      config.retry
        .maximumAttempts,

    retryDelayMs:
      options.retryDelayMs ??
      config.retry.delayMs,

    deferRetries:
      options.deferRetries ??
      true,

    userId,
    batchNumber: 0,
  };

  setCampaignStatus(
    campaign,
    "processing"
  );

  setCampaignPath(
    campaign,
    [
      "delivery.startedAt",
      "processingStartedAt",
      "startedAt",
    ],
    new Date()
  );

  setCampaignPath(
    campaign,
    [
      "deliveryCounts.totalRecipients",
      "delivery.totalRecipients",
      "metrics.totalRecipients",
    ],
    recipients.length
  );

  await campaign.save();

  if (recipients.length === 0) {
    summary.completedAt =
      new Date().toISOString();

    setCampaignStatus(
      campaign,
      "failed"
    );

    setCampaignPath(
      campaign,
      [
        "failureReason",
        "delivery.failureReason",
      ],
      "The campaign audience contained no customers."
    );

    setCampaignPath(
      campaign,
      [
        "delivery.completedAt",
        "completedAt",
      ],
      new Date()
    );

    await campaign.save();

    throw createCampaignDeliveryError(
      "The campaign audience contained no customers.",
      {
        statusCode: 409,
        code:
          "CAMPAIGN_AUDIENCE_EMPTY",
        campaign,
        details: summary,
      }
    );
  }

  try {
    for (
      let startIndex = 0;
      startIndex <
      recipients.length;
      startIndex += batchSize
    ) {
      const batchNumber =
        Math.floor(
          startIndex / batchSize
        ) + 1;

      const batch =
        recipients.slice(
          startIndex,
          startIndex + batchSize
        );

      deliveryOptions.batchNumber =
        batchNumber;

      const batchResults =
        await processRecipientBatch({
          campaign,
          recipients: batch,
          channel,
          concurrency,
          consentOptions,
          deliveryOptions,
        });

      mergeBatchResults(
        summary,
        batchResults
      );

      updateCampaignProgress(
        campaign,
        summary
      );

      await campaign.save();

      const hasMoreBatches =
        startIndex +
          batchSize <
        recipients.length;

      if (
        hasMoreBatches &&
        delayBetweenBatchesSeconds >
          0
      ) {
        await sleep(
          delayBetweenBatchesSeconds *
            1000
        );
      }
    }

    const finalStatus =
      determineFinalCampaignStatus(
        summary
      );

    setCampaignStatus(
      campaign,
      finalStatus
    );

    summary.completedAt =
      new Date().toISOString();

    setCampaignPath(
      campaign,
      [
        "delivery.completedAt",
        "completedAt",
      ],
      new Date(
        summary.completedAt
      )
    );

    setCampaignPath(
      campaign,
      [
        "failureReason",
        "delivery.failureReason",
      ],
      finalStatus ===
        "completed"
        ? ""
        : `${summary.failed} delivery failure(s), ${summary.deferred} deferred retry/retries and ${summary.skipped} skipped recipient(s).`
    );

    updateCampaignProgress(
      campaign,
      summary
    );

    await campaign.save();

    return {
      success:
        finalStatus ===
        "completed",

      campaign,
      summary,
    };
  } catch (error) {
    summary.completedAt =
      new Date().toISOString();

    if (
      normaliseLowercase(
        campaign.status
      ) === "processing"
    ) {
      setCampaignStatus(
        campaign,
        summary.successful > 0
          ? "partially_completed"
          : "failed"
      );
    }

    setCampaignPath(
      campaign,
      [
        "failureReason",
        "delivery.failureReason",
      ],
      error?.message ||
        "Campaign delivery failed."
    );

    setCampaignPath(
      campaign,
      [
        "delivery.completedAt",
        "completedAt",
      ],
      new Date()
    );

    updateCampaignProgress(
      campaign,
      summary
    );

    await campaign.save();

    throw createCampaignDeliveryError(
      error?.message ||
        "Campaign delivery failed.",
      {
        statusCode:
          error?.statusCode ||
          500,

        code:
          error?.code ||
          "CAMPAIGN_DELIVERY_FAILED",

        cause: error,
        campaign,
        details: summary,
      }
    );
  }
}

async function previewCampaignAudience(
  campaignId,
  options = {}
) {
  const campaign =
    await loadCampaign(
      campaignId
    );

  const channel =
    getCampaignChannel(
      campaign
    );

  const recipients =
    await resolveCampaignAudience(
      campaign,
      {
        maximumRecipients:
          options.maximumRecipients,
      }
    );

  const config =
    getMessageDeliveryConfig();

  const consentOptions = {
    consentRequired:
      options.consentRequired ??
      config.consent.required,

    excludeUnsubscribed:
      options.excludeUnsubscribed ??
      config.consent
        .excludeUnsubscribed,
  };

  const preview =
    recipients.map((customer) => {
      const consent =
        resolveCustomerConsent(
          customer,
          channel,
          consentOptions
        );

      const address =
        channel === "email"
          ? getCustomerEmail(
              customer
            )
          : getCustomerPhone(
              customer
            );

      return {
        customerId:
          String(
            getDocumentId(
              customer
            ) || ""
          ),

        name:
          getCustomerName(
            customer
          ),

        address,

        hasAddress:
          Boolean(address),

        consent,

        eligible:
          Boolean(address) &&
          (
            !consent.required ||
            consent.granted
          ),
      };
    });

  return {
    campaignId:
      String(
        getDocumentId(
          campaign
        )
      ),

    campaignName:
      campaign.name,

    channel,

    total:
      preview.length,

    eligible:
      preview.filter(
        (entry) =>
          entry.eligible
      ).length,

    missingAddress:
      preview.filter(
        (entry) =>
          !entry.hasAddress
      ).length,

    consentNotGranted:
      preview.filter(
        (entry) =>
          entry.hasAddress &&
          entry.consent.required &&
          !entry.consent.granted
      ).length,

    recipients: preview,
  };
}

async function getDueCampaigns({
  dueBefore = new Date(),
  limit = 25,
} = {}) {
  const safeLimit =
    normaliseInteger(
      limit,
      25,
      1,
      100
    );

  const dueDate =
    new Date(dueBefore);

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    throw createCampaignDeliveryError(
      "dueBefore must be a valid date.",
      {
        statusCode: 400,
        code:
          "INVALID_CAMPAIGN_DUE_DATE",
      }
    );
  }

  return CommunicationCampaign.find({
    status: {
      $in: [
        "scheduled",
        "queued",
      ],
    },

    "schedule.scheduledAt": {
      $ne: null,
      $lte: dueDate,
    },
  })
    .sort({
      "schedule.scheduledAt": 1,
    })
    .limit(safeLimit);
}

async function processDueCampaigns({
  dueBefore = new Date(),
  limit = 25,
  concurrency = 2,
  userId = null,
  deliveryOptions = {},
} = {}) {
  const campaigns =
    await getDueCampaigns({
      dueBefore,
      limit,
    });

  const workerCount =
    normaliseInteger(
      concurrency,
      2,
      1,
      10
    );

  const results =
    new Array(
      campaigns.length
    );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        campaigns.length
      ) {
        return;
      }

      const campaign =
        campaigns[currentIndex];

      try {
        const result =
          await processCampaignDelivery(
            campaign._id,
            {
              ...deliveryOptions,
              userId,
            }
          );

        results[currentIndex] = {
          success:
            result.success,

          campaignId:
            String(
              campaign._id
            ),

          status:
            result.campaign
              .status,

          summary:
            result.summary,
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,

          campaignId:
            String(
              campaign._id
            ),

          status:
            error?.campaign
              ?.status ||
            "failed",

          error:
            serialiseCampaignDeliveryError(
              error
            ),
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          workerCount,
          campaigns.length
        ),
      },
      () => worker()
    )
  );

  const successful =
    results.filter(
      (result) =>
        result?.success
    ).length;

  const failed =
    results.filter(
      (result) =>
        result &&
        !result.success
    ).length;

  return {
    success:
      failed === 0,

    dueBefore:
      new Date(
        dueBefore
      ).toISOString(),

    total:
      campaigns.length,

    successful,
    failed,

    results:
      results.filter(Boolean),

    processedAt:
      new Date().toISOString(),
  };
}

export {
  PROCESSABLE_CAMPAIGN_STATUSES,
  SUPPORTED_CAMPAIGN_CHANNELS,
  createCampaignDeliveryError,
  getDueCampaigns,
  previewCampaignAudience,
  processCampaignDelivery,
  processDueCampaigns,
  resolveCampaignAudience,
};

export default processCampaignDelivery;