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

function scopeFilter(request, { allowBusinessWide = true } = {}) {
  return communicationAggregateAuthorityFilter(request.communicationScope, {
    includeBusinessWide: allowBusinessWide,
  });
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
  requireSelectedLocation = false,
}) {
  const resource = await Model.findOne({
    $and: [
      scopeFilter(request, { allowBusinessWide }),
      { _id: text(rawId) },
    ],
  });

  // Always execute the trusted authority assertion. The assertion already
  // handles a missing resource as a non-disclosing 404, so user-controlled
  // identifiers never determine whether the security check runs.
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
    const resource = await CommunicationTemplate.findOne({
      $and: [scopeFilter(request), { slug: text(request.params?.slug) }],
    });

    assertCommunicationAuthorityResource(resource, request.communicationScope);
    request.communicationTemplate = resource;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedScheduledCampaignResource(request, response, next) {
  return scopedCampaignResource(request, response, next);
}

async function findScopedDeliveryByPublicIdentifier(request, rawIdentifier) {
  const identifier = text(rawIdentifier);
  return MessageDelivery.findOne({
    $and: [
      scopeFilter(request),
      {
        $or: [
          { deliveryId: identifier },
          { providerMessageId: identifier },
        ],
      },
    ],
  });
}

async function findScopedDeliveryByMongoId(request, rawIdentifier) {
  try {
    return await MessageDelivery.findOne({
      $and: [scopeFilter(request), { _id: text(rawIdentifier) }],
    });
  } catch (error) {
    if (error?.name === "CastError" || error?.name === "BSONError") {
      return null;
    }
    throw error;
  }
}

async function attachScopedDelivery(request, rawIdentifier) {
  const byPublicIdentifier = await findScopedDeliveryByPublicIdentifier(
    request,
    rawIdentifier
  );
  const resource =
    byPublicIdentifier ||
    (await findScopedDeliveryByMongoId(request, rawIdentifier));

  assertCommunicationAuthorityResource(resource, request.communicationScope);
  request.messageDelivery = resource;
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
    const resource = await MessageDelivery.findOne({
      $and: [
        scopeFilter(request),
        { providerMessageId: text(request.params?.providerMessageId) },
      ],
    });

    assertCommunicationAuthorityResource(resource, request.communicationScope);
    request.messageDelivery = resource;
    return next();
  } catch (error) {
    return next(asNonDisclosingLookupError(error));
  }
}

export async function scopedRecipientResource(request, response, next) {
  try {
    const recipient = await CommunicationCampaignRecipient.findOne({
      $and: [
        scopeFilter(request),
        {
          _id: text(request.params?.recipientId),
          campaign: text(request.params?.campaignId),
        },
      ],
    });

    assertCommunicationAuthorityResource(recipient, request.communicationScope);
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
    const campaignId = text(request.params?.campaignId);
    let scheduled = null;

    try {
      scheduled = await ScheduledCommunication.findOne({
        $and: [
          scopeFilter(request),
          {
            $or: [{ _id: campaignId }, { campaign: campaignId }],
          },
        ],
      });
    } catch (error) {
      if (error?.name !== "CastError" && error?.name !== "BSONError") {
        throw error;
      }
    }

    if (scheduled) {
      assertCommunicationAuthorityResource(scheduled, request.communicationScope);
      request.scheduledCommunication = scheduled;
      return next();
    }

    const campaign = await CommunicationCampaign.findOne({
      $and: [scopeFilter(request), { _id: campaignId }],
    });

    assertCommunicationAuthorityResource(campaign, request.communicationScope);
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