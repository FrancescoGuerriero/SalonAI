import mongoose from "mongoose";

import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationCampaignRecipient from "../models/CommunicationCampaignRecipient.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";
import MessageDelivery from "../models/MessageDelivery.js";

import {
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

function requiredText(value, { maximumLength = 255 } = {}) {
  const candidate = text(value);
  if (!candidate || candidate.length > maximumLength) {
    throw notFound();
  }
  return candidate;
}

function requiredObjectId(value) {
  const candidate = requiredText(value, { maximumLength: 64 });
  if (!mongoose.isValidObjectId(candidate)) {
    throw notFound();
  }
  return candidate;
}

function scopeFilter(request, { allowBusinessWide = true } = {}) {
  return communicationAggregateAuthorityFilter(request.communicationScope, {
    includeBusinessWide: allowBusinessWide,
  });
}

function scopedFilter(request, resourceFilter, options = {}) {
  return {
    $and: [scopeFilter(request, options), resourceFilter],
  };
}

function requireScopedResource(resource) {
  if (!resource) {
    throw notFound();
  }
  return resource;
}

function asNonDisclosingLookupError(error) {
  if (error?.name === "CastError" || error?.name === "BSONError") {
    return notFound();
  }
  return error;
}

async function attachScopedObjectIdResource({
  request,
  Model,
  rawId,
  attachAs,
  allowBusinessWide = true,
}) {
  const resourceId = requiredObjectId(rawId);
  const resource = requireScopedResource(
    await Model.findOne(
      scopedFilter(
        request,
        { _id: resourceId },
        { allowBusinessWide }
      )
    )
  );

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
    return next(asNonDisclosingLookupError(error));
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
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedTemplateMutationResource(request, response, next) {
  return scopedTemplateResource(request, response, next);
}

export async function scopedTemplateSlugResource(request, response, next) {
  try {
    const slug = requiredText(request.params?.slug, { maximumLength: 160 });
    const resource = requireScopedResource(
      await CommunicationTemplate.findOne(
        scopedFilter(request, { slug })
      )
    );

    request.communicationTemplate = resource;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedScheduledCampaignResource(request, response, next) {
  return scopedCampaignResource(request, response, next);
}

async function attachScopedDelivery(request, rawIdentifier) {
  const identifier = requiredText(rawIdentifier, { maximumLength: 255 });
  const identifiers = [
    { deliveryId: identifier },
    { providerMessageId: identifier },
  ];

  if (mongoose.isValidObjectId(identifier)) {
    identifiers.push({ _id: identifier });
  }

  const resource = requireScopedResource(
    await MessageDelivery.findOne(
      scopedFilter(request, { $or: identifiers })
    )
  );

  request.messageDelivery = resource;
  return resource;
}

export async function scopedDeliveryResource(request, response, next) {
  try {
    await attachScopedDelivery(request, request.params?.identifier);
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedProviderDeliveryResource(request, response, next) {
  try {
    const providerMessageId = requiredText(request.params?.providerMessageId, {
      maximumLength: 255,
    });
    const resource = requireScopedResource(
      await MessageDelivery.findOne(
        scopedFilter(request, { providerMessageId })
      )
    );

    request.messageDelivery = resource;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedRecipientResource(request, response, next) {
  try {
    const recipientId = requiredObjectId(request.params?.recipientId);
    const campaignId = requiredObjectId(request.params?.campaignId);
    const recipient = requireScopedResource(
      await CommunicationCampaignRecipient.findOne(
        scopedFilter(request, {
          _id: recipientId,
          campaign: campaignId,
        })
      )
    );

    request.communicationRecipient = recipient;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedScheduledCommunicationResource(
  request,
  response,
  next
) {
  try {
    const campaignId = requiredObjectId(request.params?.campaignId);
    const campaign = requireScopedResource(
      await CommunicationCampaign.findOne(
        scopedFilter(request, { _id: campaignId })
      )
    );

    // Downstream scheduling services operate on CommunicationCampaign IDs.
    // Replace the request value with the canonical ID returned by the trusted,
    // tenant-scoped lookup so subsequent operations consume the authorised key.
    request.params.campaignId = String(campaign._id);
    request.communicationCampaign = campaign;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
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
