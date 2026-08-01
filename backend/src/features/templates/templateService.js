import CommunicationTemplate from "../../models/CommunicationTemplate.js";
import {
  extractTemplateVariables,
  renderTemplate,
} from "../../shared/templateRenderer.js";
import {
  assertFound,
  createServiceError,
} from "../../shared/serviceError.js";
import {
  paginationFromQuery,
  paginationResult,
} from "../../shared/pagination.js";
import {
  escapedRegex,
  userId,
} from "../../shared/modelHelpers.js";

function normalizePayload(payload = {}) {
  const name = String(payload.name || "").trim();
  const body = String(payload.body || "").trim();
  const subject = String(payload.subject || "").trim();

  if (!name) {
    throw createServiceError(
      "Template name is required.",
      400
    );
  }

  if (!body) {
    throw createServiceError(
      "Template body is required.",
      400
    );
  }

  return {
    name,
    description: String(
      payload.description || ""
    ).trim(),
    campaignType:
      payload.campaignType || "general",
    channel: payload.channel || "email",
    subject,
    body,
    variables: [
      ...new Set([
        ...extractTemplateVariables(subject),
        ...extractTemplateVariables(body),
      ]),
    ],
    active:
      payload.active === undefined
        ? true
        : Boolean(payload.active),
  };
}

export async function createTemplate(payload, user) {
  const normalized = normalizePayload(payload);

  const duplicate =
    await CommunicationTemplate.exists({
      name: normalized.name,
    });

  if (duplicate) {
    throw createServiceError(
      "A template with this name already exists.",
      409
    );
  }

  const template =
    await CommunicationTemplate.create({
      ...normalized,
      createdBy: userId(user),
      updatedBy: userId(user),
    });

  return template.toObject();
}

export async function listTemplates(query = {}) {
  const { page, limit, skip } =
    paginationFromQuery(query);

  const match = {};

  if (query.channel) {
    match.channel = query.channel;
  }

  if (query.campaignType) {
    match.campaignType = query.campaignType;
  }

  if (query.active !== undefined) {
    match.active =
      String(query.active).toLowerCase() === "true";
  }

  if (query.search) {
    const expression = escapedRegex(query.search);
    match.$or = [
      { name: expression },
      { description: expression },
      { subject: expression },
      { body: expression },
    ];
  }

  const [items, total] = await Promise.all([
    CommunicationTemplate.find(match)
      .populate(
        "createdBy updatedBy",
        "name firstName lastName email"
      )
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CommunicationTemplate.countDocuments(match),
  ]);

  return {
    items,
    pagination: paginationResult(
      page,
      limit,
      total
    ),
  };
}

export async function getTemplate(id) {
  return assertFound(
    await CommunicationTemplate.findById(id)
      .populate(
        "createdBy updatedBy",
        "name firstName lastName email"
      )
      .lean(),
    "Communication template not found."
  );
}

export async function updateTemplate(
  id,
  payload,
  user
) {
  const template = assertFound(
    await CommunicationTemplate.findById(id),
    "Communication template not found."
  );

  const normalized = normalizePayload({
    ...template.toObject(),
    ...payload,
  });

  if (normalized.name !== template.name) {
    const duplicate =
      await CommunicationTemplate.exists({
        name: normalized.name,
        _id: { $ne: template._id },
      });

    if (duplicate) {
      throw createServiceError(
        "A template with this name already exists.",
        409
      );
    }
  }

  Object.assign(template, normalized, {
    updatedBy: userId(user),
  });

  await template.save();

  return template.toObject();
}

export async function archiveTemplate(id, user) {
  const template = assertFound(
    await CommunicationTemplate.findById(id),
    "Communication template not found."
  );

  template.active = false;
  template.updatedBy = userId(user);

  await template.save();

  return template.toObject();
}

export async function renderTemplatePreview(
  id,
  context = {}
) {
  const template = await getTemplate(id);

  return {
    templateId: template._id,
    subject: renderTemplate(
      template.subject,
      context,
      { strict: false }
    ),
    body: renderTemplate(
      template.body,
      context,
      { strict: false }
    ),
    variables: template.variables,
  };
}
