import mongoose from "mongoose";

import CommunicationTemplate, {
  CAMPAIGN_TYPES,
  COMMUNICATION_CHANNELS,
  extractTemplateVariables,
} from "../models/CommunicationTemplate.js";

const SORT_OPTIONS = {
  newest: {
    createdAt: -1,
    _id: -1,
  },

  oldest: {
    createdAt: 1,
    _id: 1,
  },

  name_asc: {
    name: 1,
    _id: 1,
  },

  name_desc: {
    name: -1,
    _id: -1,
  },

  most_used: {
    usageCount: -1,
    lastUsedAt: -1,
    _id: -1,
  },

  recently_used: {
    lastUsedAt: -1,
    usageCount: -1,
    _id: -1,
  },

  recently_updated: {
    updatedAt: -1,
    _id: -1,
  },
};

const EDITABLE_FIELDS = [
  "name",
  "description",
  "campaignType",
  "channel",
  "subject",
  "body",
  "variables",
  "tags",
  "active",
  "metadata",
];

function createServiceError(
  message,
  statusCode = 400,
  code = "COMMUNICATION_TEMPLATE_ERROR"
) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.code = code;

  return error;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value, fieldName = "ID") {
  if (!value || !isValidObjectId(value)) {
    throw createServiceError(
      `${fieldName} must be a valid MongoDB ID.`,
      400,
      "INVALID_OBJECT_ID"
    );
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizePositiveInteger(
  value,
  fallback,
  maximum
) {
  const parsedValue = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value
      .trim()
      .toLowerCase();

    if (
      normalizedValue === "true" ||
      normalizedValue === "1"
    ) {
      return true;
    }

    if (
      normalizedValue === "false" ||
      normalizedValue === "0"
    ) {
      return false;
    }
  }

  return undefined;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((tag) =>
            normalizeText(tag).toLowerCase()
          )
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((tag) =>
            normalizeText(tag).toLowerCase()
          )
          .filter(Boolean)
      )
    );
  }

  return [];
}

function normalizeVariables(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(normalizeText)
        .filter(Boolean)
    )
  ).sort();
}

function escapeRegularExpression(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function validateEnumValue(
  value,
  allowedValues,
  fieldName
) {
  if (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !allowedValues.includes(value)
  ) {
    throw createServiceError(
      `${fieldName} must be one of: ${allowedValues.join(
        ", "
      )}.`,
      400,
      "INVALID_TEMPLATE_FILTER"
    );
  }
}

function getUserId(user) {
  const candidate =
    user?._id ||
    user?.id ||
    user;

  if (!candidate || !isValidObjectId(candidate)) {
    return null;
  }

  return candidate;
}

function buildTemplateMatch(filters = {}) {
  const match = {};

  const search = normalizeText(filters.search);

  if (search) {
    const searchExpression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );

    match.$or = [
      {
        name: searchExpression,
      },
      {
        description: searchExpression,
      },
      {
        subject: searchExpression,
      },
      {
        body: searchExpression,
      },
      {
        tags: searchExpression,
      },
    ];
  }

  if (filters.campaignType) {
    validateEnumValue(
      filters.campaignType,
      CAMPAIGN_TYPES,
      "campaignType"
    );

    match.campaignType =
      filters.campaignType;
  }

  if (filters.channel) {
    validateEnumValue(
      filters.channel,
      COMMUNICATION_CHANNELS,
      "channel"
    );

    match.channel = filters.channel;
  }

  const active = normalizeBoolean(
    filters.active
  );

  if (active !== undefined) {
    match.active = active;
  }

  const isSystemTemplate =
    normalizeBoolean(
      filters.isSystemTemplate
    );

  if (isSystemTemplate !== undefined) {
    match.isSystemTemplate =
      isSystemTemplate;
  }

  if (filters.createdBy) {
    match.createdBy = toObjectId(
      filters.createdBy,
      "createdBy"
    );
  }

  const tag = normalizeText(
    filters.tag
  ).toLowerCase();

  if (tag) {
    match.tags = tag;
  }

  return match;
}

function getSortOption(sort) {
  const normalizedSort =
    normalizeText(sort) ||
    "recently_updated";

  return (
    SORT_OPTIONS[normalizedSort] ||
    SORT_OPTIONS.recently_updated
  );
}

function prepareTemplatePayload(
  payload = {},
  {
    partial = false,
  } = {}
) {
  const preparedPayload = {};

  for (const field of EDITABLE_FIELDS) {
    const hasField =
      Object.prototype.hasOwnProperty.call(
        payload,
        field
      );

    if (!hasField && partial) {
      continue;
    }

    if (!hasField) {
      continue;
    }

    switch (field) {
      case "name":
      case "description":
      case "subject":
      case "body":
        preparedPayload[field] =
          normalizeText(payload[field]);
        break;

      case "campaignType":
        validateEnumValue(
          payload[field],
          CAMPAIGN_TYPES,
          "campaignType"
        );

        preparedPayload[field] =
          payload[field];
        break;

      case "channel":
        validateEnumValue(
          payload[field],
          COMMUNICATION_CHANNELS,
          "channel"
        );

        preparedPayload[field] =
          payload[field];
        break;

      case "variables":
        preparedPayload.variables =
          normalizeVariables(payload.variables);
        break;

      case "tags":
        preparedPayload.tags =
          normalizeTags(payload.tags);
        break;

      case "active": {
        const active = normalizeBoolean(
          payload.active
        );

        if (active === undefined) {
          throw createServiceError(
            "active must be a boolean value.",
            400,
            "INVALID_ACTIVE_VALUE"
          );
        }

        preparedPayload.active = active;
        break;
      }

      case "metadata":
        preparedPayload.metadata =
          payload.metadata &&
          typeof payload.metadata === "object" &&
          !Array.isArray(payload.metadata)
            ? payload.metadata
            : {};
        break;

      default:
        break;
    }
  }

  return preparedPayload;
}

function validateTemplateRequirements(payload) {
  if (!normalizeText(payload.name)) {
    throw createServiceError(
      "Template name is required.",
      400,
      "TEMPLATE_NAME_REQUIRED"
    );
  }

  if (!normalizeText(payload.channel)) {
    throw createServiceError(
      "Communication channel is required.",
      400,
      "TEMPLATE_CHANNEL_REQUIRED"
    );
  }

  if (!normalizeText(payload.body)) {
    throw createServiceError(
      "Template message body is required.",
      400,
      "TEMPLATE_BODY_REQUIRED"
    );
  }

  if (
    payload.channel === "email" &&
    !normalizeText(payload.subject)
  ) {
    throw createServiceError(
      "Email templates require a subject.",
      400,
      "EMAIL_SUBJECT_REQUIRED"
    );
  }
}

function handleDatabaseError(
  error,
  fallbackMessage
) {
  if (error?.code === 11000) {
    throw createServiceError(
      "A communication template with this name and channel already exists.",
      409,
      "DUPLICATE_COMMUNICATION_TEMPLATE"
    );
  }

  if (error?.name === "ValidationError") {
    const validationMessages =
      Object.values(error.errors || {})
        .map(
          (validationError) =>
            validationError.message
        )
        .filter(Boolean);

    throw createServiceError(
      validationMessages.join(" ") ||
        fallbackMessage,
      400,
      "COMMUNICATION_TEMPLATE_VALIDATION_ERROR"
    );
  }

  throw error;
}

function renderText(
  value,
  variables = {}
) {
  const missingVariables = new Set();

  const renderedText = normalizeText(value).replace(
    /{{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*}}/g,
    (placeholder, variableName) => {
      const suppliedValue =
        variables[variableName];

      if (
        suppliedValue === undefined ||
        suppliedValue === null
      ) {
        missingVariables.add(variableName);
        return placeholder;
      }

      return String(suppliedValue);
    }
  );

  return {
    text: renderedText,
    missingVariables:
      Array.from(missingVariables).sort(),
  };
}

async function findTemplateDocument(
  templateId
) {
  const id = toObjectId(
    templateId,
    "templateId"
  );

  const template =
    await CommunicationTemplate.findById(id);

  if (!template) {
    throw createServiceError(
      "Communication template not found.",
      404,
      "COMMUNICATION_TEMPLATE_NOT_FOUND"
    );
  }

  return template;
}

export async function createCommunicationTemplate(
  payload = {},
  user
) {
  const preparedPayload =
    prepareTemplatePayload(payload);

  preparedPayload.campaignType =
    preparedPayload.campaignType ||
    "general";

  preparedPayload.active =
    preparedPayload.active ?? true;

  preparedPayload.variables =
    Array.from(
      new Set([
        ...normalizeVariables(
          preparedPayload.variables
        ),
        ...extractTemplateVariables(
          preparedPayload.subject,
          preparedPayload.body
        ),
      ])
    ).sort();

  validateTemplateRequirements(
    preparedPayload
  );

  const userId = getUserId(user);

  try {
    const template =
      await CommunicationTemplate.create({
        ...preparedPayload,
        createdBy: userId,
        updatedBy: userId,
      });

    return getCommunicationTemplate(
      template._id
    );
  } catch (error) {
    handleDatabaseError(
      error,
      "Unable to create the communication template."
    );
  }
}

export async function listCommunicationTemplates(
  filters = {}
) {
  const page = normalizePositiveInteger(
    filters.page,
    1,
    100000
  );

  const limit = normalizePositiveInteger(
    filters.limit,
    12,
    100
  );

  const skip = (page - 1) * limit;

  const match =
    buildTemplateMatch(filters);

  const sort = getSortOption(
    filters.sort
  );

  const [templates, total] =
    await Promise.all([
      CommunicationTemplate.find(match)
        .populate(
          "createdBy",
          "name firstName lastName email"
        )
        .populate(
          "updatedBy",
          "name firstName lastName email"
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({
          virtuals: true,
        }),

      CommunicationTemplate.countDocuments(
        match
      ),
    ]);

  return {
    templates,

    pagination: {
      page,
      limit,
      total,
      pages: Math.max(
        1,
        Math.ceil(total / limit)
      ),
    },

    filters: {
      search:
        normalizeText(filters.search),

      campaignType:
        filters.campaignType || "",

      channel: filters.channel || "",

      active:
        normalizeBoolean(filters.active),

      tag:
        normalizeText(
          filters.tag
        ).toLowerCase(),

      sort:
        normalizeText(filters.sort) ||
        "recently_updated",
    },
  };
}

export async function getCommunicationTemplate(
  templateId
) {
  const id = toObjectId(
    templateId,
    "templateId"
  );

  const template =
    await CommunicationTemplate.findById(id)
      .populate(
        "createdBy",
        "name firstName lastName email"
      )
      .populate(
        "updatedBy",
        "name firstName lastName email"
      )
      .lean({
        virtuals: true,
      });

  if (!template) {
    throw createServiceError(
      "Communication template not found.",
      404,
      "COMMUNICATION_TEMPLATE_NOT_FOUND"
    );
  }

  return template;
}

export async function getCommunicationTemplateBySlug(
  slug
) {
  const normalizedSlug =
    normalizeText(slug).toLowerCase();

  if (!normalizedSlug) {
    throw createServiceError(
      "Template slug is required.",
      400,
      "TEMPLATE_SLUG_REQUIRED"
    );
  }

  const template =
    await CommunicationTemplate.findOne({
      slug: normalizedSlug,
    })
      .populate(
        "createdBy",
        "name firstName lastName email"
      )
      .populate(
        "updatedBy",
        "name firstName lastName email"
      )
      .lean({
        virtuals: true,
      });

  if (!template) {
    throw createServiceError(
      "Communication template not found.",
      404,
      "COMMUNICATION_TEMPLATE_NOT_FOUND"
    );
  }

  return template;
}

export async function updateCommunicationTemplate(
  templateId,
  payload = {},
  user
) {
  const template =
    await findTemplateDocument(
      templateId
    );

  const preparedPayload =
    prepareTemplatePayload(payload, {
      partial: true,
    });

  for (const [
    field,
    value,
  ] of Object.entries(preparedPayload)) {
    template[field] = value;
  }

  const finalPayload = {
    name: template.name,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
  };

  validateTemplateRequirements(
    finalPayload
  );

  template.variables =
    Array.from(
      new Set([
        ...normalizeVariables(
          template.variables
        ),
        ...extractTemplateVariables(
          template.subject,
          template.body
        ),
      ])
    ).sort();

  const userId = getUserId(user);

  if (userId) {
    template.updatedBy = userId;
  }

  try {
    await template.save();

    return getCommunicationTemplate(
      template._id
    );
  } catch (error) {
    handleDatabaseError(
      error,
      "Unable to update the communication template."
    );
  }
}

export async function setCommunicationTemplateStatus(
  templateId,
  active,
  user
) {
  const normalizedActive =
    normalizeBoolean(active);

  if (normalizedActive === undefined) {
    throw createServiceError(
      "active must be a boolean value.",
      400,
      "INVALID_ACTIVE_VALUE"
    );
  }

  return updateCommunicationTemplate(
    templateId,
    {
      active: normalizedActive,
    },
    user
  );
}

export async function deleteCommunicationTemplate(
  templateId
) {
  const template =
    await findTemplateDocument(
      templateId
    );

  if (template.isSystemTemplate) {
    throw createServiceError(
      "System communication templates cannot be deleted. Deactivate the template instead.",
      403,
      "SYSTEM_TEMPLATE_DELETE_FORBIDDEN"
    );
  }

  await template.deleteOne();

  return {
    message:
      "Communication template deleted successfully.",

    templateId: String(template._id),
  };
}

export async function renderCommunicationTemplate(
  templateId,
  variables = {},
  options = {}
) {
  const template =
    await findTemplateDocument(
      templateId
    );

  if (
    options.requireActive !== false &&
    !template.active
  ) {
    throw createServiceError(
      "This communication template is inactive.",
      409,
      "COMMUNICATION_TEMPLATE_INACTIVE"
    );
  }

  const safeVariables =
    variables &&
    typeof variables === "object" &&
    !Array.isArray(variables)
      ? variables
      : {};

  const subjectResult = renderText(
    template.subject,
    safeVariables
  );

  const bodyResult = renderText(
    template.body,
    safeVariables
  );

  const missingVariables =
    Array.from(
      new Set([
        ...subjectResult.missingVariables,
        ...bodyResult.missingVariables,
      ])
    ).sort();

  if (
    options.requireAllVariables === true &&
    missingVariables.length > 0
  ) {
    throw createServiceError(
      `Missing template variables: ${missingVariables.join(
        ", "
      )}.`,
      400,
      "MISSING_TEMPLATE_VARIABLES"
    );
  }

  if (options.recordUsage === true) {
    template.usageCount += 1;
    template.lastUsedAt = new Date();

    await template.save();
  }

  return {
    template: {
      _id: template._id,
      name: template.name,
      slug: template.slug,
      campaignType: template.campaignType,
      channel: template.channel,
      variables: template.variables,
    },

    subject: subjectResult.text,
    body: bodyResult.text,
    missingVariables,

    complete:
      missingVariables.length === 0,
  };
}

export async function duplicateCommunicationTemplate(
  templateId,
  payload = {},
  user
) {
  const sourceTemplate =
    await getCommunicationTemplate(
      templateId
    );

  const copyName =
    normalizeText(payload.name) ||
    `${sourceTemplate.name} Copy`;

  return createCommunicationTemplate(
    {
      name: copyName,

      description:
        normalizeText(payload.description) ||
        sourceTemplate.description,

      campaignType:
        payload.campaignType ||
        sourceTemplate.campaignType,

      channel:
        payload.channel ||
        sourceTemplate.channel,

      subject:
        payload.subject !== undefined
          ? payload.subject
          : sourceTemplate.subject,

      body:
        payload.body !== undefined
          ? payload.body
          : sourceTemplate.body,

      variables:
        sourceTemplate.variables,

      tags:
        sourceTemplate.tags,

      active:
        payload.active ?? false,

      metadata: {
        ...(sourceTemplate.metadata || {}),
        duplicatedFrom:
          sourceTemplate._id,
      },
    },
    user
  );
}

export async function getCommunicationTemplateSummary(
  filters = {}
) {
  const match =
    buildTemplateMatch(filters);

  const [analytics] =
    await CommunicationTemplate.aggregate([
      {
        $match: match,
      },

      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,

                total: {
                  $sum: 1,
                },

                active: {
                  $sum: {
                    $cond: [
                      "$active",
                      1,
                      0,
                    ],
                  },
                },

                inactive: {
                  $sum: {
                    $cond: [
                      "$active",
                      0,
                      1,
                    ],
                  },
                },

                totalUsage: {
                  $sum: "$usageCount",
                },

                systemTemplates: {
                  $sum: {
                    $cond: [
                      "$isSystemTemplate",
                      1,
                      0,
                    ],
                  },
                },
              },
            },

            {
              $project: {
                _id: 0,
                total: 1,
                active: 1,
                inactive: 1,
                totalUsage: 1,
                systemTemplates: 1,
              },
            },
          ],

          byChannel: [
            {
              $group: {
                _id: "$channel",
                count: {
                  $sum: 1,
                },
                usageCount: {
                  $sum: "$usageCount",
                },
              },
            },

            {
              $project: {
                _id: 0,
                channel: "$_id",
                count: 1,
                usageCount: 1,
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],

          byCampaign: [
            {
              $group: {
                _id: "$campaignType",
                count: {
                  $sum: 1,
                },
                usageCount: {
                  $sum: "$usageCount",
                },
              },
            },

            {
              $project: {
                _id: 0,
                campaignType: "$_id",
                count: 1,
                usageCount: 1,
              },
            },

            {
              $sort: {
                count: -1,
              },
            },
          ],

          mostUsed: [
            {
              $sort: {
                usageCount: -1,
                lastUsedAt: -1,
              },
            },

            {
              $limit: 5,
            },

            {
              $project: {
                name: 1,
                slug: 1,
                channel: 1,
                campaignType: 1,
                usageCount: 1,
                lastUsedAt: 1,
                active: 1,
              },
            },
          ],
        },
      },
    ]);

  return {
    summary:
      analytics?.summary?.[0] || {
        total: 0,
        active: 0,
        inactive: 0,
        totalUsage: 0,
        systemTemplates: 0,
      },

    byChannel:
      analytics?.byChannel || [],

    byCampaign:
      analytics?.byCampaign || [],

    mostUsed:
      analytics?.mostUsed || [],
  };
}

const communicationTemplateService = {
  createCommunicationTemplate,
  listCommunicationTemplates,
  getCommunicationTemplate,
  getCommunicationTemplateBySlug,
  updateCommunicationTemplate,
  setCommunicationTemplateStatus,
  deleteCommunicationTemplate,
  renderCommunicationTemplate,
  duplicateCommunicationTemplate,
  getCommunicationTemplateSummary,
};

export default communicationTemplateService;