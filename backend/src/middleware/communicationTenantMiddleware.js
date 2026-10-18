import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationCampaignRecipient from "../models/CommunicationCampaignRecipient.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";
import MessageDelivery from "../models/MessageDelivery.js";
import ScheduledCommunication from "../features/scheduler/ScheduledCommunication.js";

import {
  assertCommunicationAuthorityResource,
  buildCommunicationEffectiveScope,
  communicationAggregateAuthorityFilter,
  sanitizeCommunicationPayload,
  trustedCommunicationOwnership,
} from "../services/communicationEffectiveAuthorityService.js";

function notFound(message = "Communication resource not found.") {
  const error = new Error(message);
  error.code = "COMMUNICATION_RESOURCE_NOT_FOUND";
  error.statusCode = 404;
  return error;
}

function text(value) {
  return String(value ?? "").trim();
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(text(value));
}

function scopeFilter(request, { allowBusinessWide = true } = {}) {
  return communicationAggregateAuthorityFilter(request.communicationScope, {
    includeBusinessWide: allowBusinessWide,
  });
}

async function attachScopedObjectIdResource({
  request,
  Model,
  rawId,
  attachAs,
  allowBusinessWide = true,
  requireSelectedLocation = false,
}) {
  const id = text(rawId);
  if (!isObjectId(id)) {
    throw notFound();
  }

  const resource = await Model.findOne({
    $and: [scopeFilter(request, { allowBusinessWide }), { _id: id }],
  });

  if (!resource) {
    throw notFound();
  }

  assertCommunicationAuthorityResource(resource, request.communicationScope, {
    allowBusinessWide,
    requireSelectedLocation,
  });

  request[attachAs] = resource;
  return resource;
}

export function communicationEffectiveScopeMiddleware(request, response, next) {
  try {
    request.communicationScope = buildCommunicationEffectiveScope(
      request.effectiveAuthority
    );
    request.communicationOwnership = trustedCommunicationOwnership(
      request.communicationScope
    );
    request.body = sanitizeCommunicationPayload(request.body || {});
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedCampaignResource(request, response, next) {
  try {
    await attachScopedObjectIdResource({
      request,
      Model: CommunicationCampaign,
      rawId: request.params?.campaignId,
      attachAs: "communicationCampaign",
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedCampaignMutationResource(request, response, next) {
  return scopedCampaignResource(request, response, next);
}

export async function scopedTemplateResource(request, response, next) {
  try {
    await attachScopedObjectIdResource({
      request,
      Model: CommunicationTemplate,
      rawId: request.params?.templateId,
      attachAs: "communicationTemplate",
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedTemplateMutationResource(request, response, next) {
  return scopedTemplateResource(request, response, next);
}

export async function scopedTemplateSlugResource(request, response, next) {
  try {
    const slug = text(request.params?.slug);
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || slug.length > 120) {
      throw notFound();
    }

    const resource = await CommunicationTemplate.findOne({
      $and: [scopeFilter(request), { slug }],
    });

    if (!resource) {
      throw notFound();
    }

    assertCommunicationAuthorityResource(resource, request.communicationScope);
    request.communicationTemplate = resource;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedScheduledCampaignResource(request, response, next) {
  return scopedCampaignResource(request, response, next);
}

function deliveryIdentifierConditions(identifier) {
  const value = text(identifier);
  if (!value || value.length > 256) {
    return [];
  }

  const conditions = [
    { deliveryId: value },
    { providerMessageId: value },
  ];

  if (isObjectId(value)) {
    conditions.unshift({ _id: value });
  }

  return conditions;
}

async function attachScopedDelivery(request, rawIdentifier) {
  const conditions = deliveryIdentifierConditions(rawIdentifier);
  if (conditions.length === 0) {
    throw notFound();
  }

  const resource = await MessageDelivery.findOne({
    $and: [scopeFilter(request), { $or: conditions }],
  });

  if (!resource) {
    throw notFound();
  }

  assertCommunicationAuthorityResource(resource, request.communicationScope);
  request.messageDelivery = resource;
}

export async function scopedDeliveryResource(request, response, next) {
  try {
    await attachScopedDelivery(request, request.params?.identifier);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedProviderDeliveryResource(request, response, next) {
  try {
    const providerMessageId = text(request.params?.providerMessageId);
    if (!providerMessageId || providerMessageId.length > 256) {
      throw notFound();
    }

    const resource = await MessageDelivery.findOne({
      $and: [scopeFilter(request), { providerMessageId }],
    });

    if (!resource) {
      throw notFound();
    }

    assertCommunicationAuthorityResource(resource, request.communicationScope);
    request.messageDelivery = resource;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedRecipientResource(request, response, next) {
  try {
    const recipientId = text(request.params?.recipientId);
    const campaignId = text(request.params?.campaignId);
    if (!isObjectId(recipientId) || !isObjectId(campaignId)) {
      throw notFound();
    }

    const recipient = await CommunicationCampaignRecipient.findOne({
      $and: [
        scopeFilter(request),
        { _id: recipientId, campaign: campaignId },
      ],
    });

    if (!recipient) {
      throw notFound();
    }

    assertCommunicationAuthorityResource(recipient, request.communicationScope);
    request.communicationRecipient = recipient;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function scopedScheduledCommunicationResource(
  request,
  response,
  next
) {
  try {
    const campaignId = text(request.params?.campaignId);
    if (!isObjectId(campaignId)) {
      throw notFound();
    }

    const scheduled = await ScheduledCommunication.findOne({
      $and: [
        scopeFilter(request),
        {
          $or: [{ _id: campaignId }, { campaign: campaignId }],
        },
      ],
    });

    if (scheduled) {
      assertCommunicationAuthorityResource(scheduled, request.communicationScope);
      request.scheduledCommunication = scheduled;
      return next();
    }

    await attachScopedObjectIdResource({
      request,
      Model: CommunicationCampaign,
      rawId: campaignId,
      attachAs: "communicationCampaign",
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

export default {
  communicationEffectiveScopeMiddleware,
  scopedCampaignMutationResource,
  scopedCampaignResource,
  scopedDeliveryResource,
  scopedProviderDeliveryResource,
  scopedRecipientResource,
  scopedScheduledCampaignResource,
  scopedScheduledCommunicationResource,
  scopedTemplateMutationResource,
  scopedTemplateResource,
  scopedTemplateSlugResource,
};