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

function identifierConditions(identifier) {
  const value = String(identifier ?? "").trim();
  if (!value) return [];

  const conditions = [
    { deliveryId: value },
    { providerMessageId: value },
  ];

  if (/^[a-f\d]{24}$/i.test(value)) {
    conditions.unshift({ _id: value });
  }

  return conditions;
}

export function communicationEffectiveScopeMiddleware(
  request,
  response,
  next
) {
  try {
    request.communicationScope =
      buildCommunicationEffectiveScope(
        request.effectiveAuthority
      );

    request.communicationOwnership =
      trustedCommunicationOwnership(
        request.communicationScope
      );

    request.body =
      sanitizeCommunicationPayload(
        request.body || {}
      );

    return next();
  } catch (error) {
    return next(error);
  }
}

function resourceMiddleware({
  Model,
  param,
  attachAs,
  identifier = false,
  requireSelectedLocation = false,
  allowBusinessWide = true,
}) {
  return async function scopedCommunicationResource(
    request,
    response,
    next
  ) {
    try {
      const value = request.params?.[param];
      const scopeFilter =
        communicationAggregateAuthorityFilter(
          request.communicationScope,
          { includeBusinessWide: allowBusinessWide }
        );

      const identityFilter = identifier
        ? { $or: identifierConditions(value) }
        : { _id: value };

      if (
        identifier &&
        identityFilter.$or.length === 0
      ) {
        throw notFound();
      }

      const resource = await Model.findOne({
        $and: [
          scopeFilter,
          identityFilter,
        ],
      });

      if (!resource) {
        throw notFound();
      }

      assertCommunicationAuthorityResource(
        resource,
        request.communicationScope,
        {
          allowBusinessWide,
          requireSelectedLocation,
        }
      );

      request[attachAs] = resource;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const scopedCampaignResource =
  resourceMiddleware({
    Model: CommunicationCampaign,
    param: "campaignId",
    attachAs: "communicationCampaign",
  });

export const scopedCampaignMutationResource =
  resourceMiddleware({
    Model: CommunicationCampaign,
    param: "campaignId",
    attachAs: "communicationCampaign",
    requireSelectedLocation: false,
  });

export const scopedTemplateResource =
  resourceMiddleware({
    Model: CommunicationTemplate,
    param: "templateId",
    attachAs: "communicationTemplate",
  });

export const scopedTemplateMutationResource =
  resourceMiddleware({
    Model: CommunicationTemplate,
    param: "templateId",
    attachAs: "communicationTemplate",
    requireSelectedLocation: false,
  });

export const scopedScheduledCampaignResource =
  resourceMiddleware({
    Model: CommunicationCampaign,
    param: "campaignId",
    attachAs: "communicationCampaign",
  });

export const scopedDeliveryResource =
  resourceMiddleware({
    Model: MessageDelivery,
    param: "identifier",
    attachAs: "messageDelivery",
    identifier: true,
  });

export const scopedProviderDeliveryResource =
  resourceMiddleware({
    Model: MessageDelivery,
    param: "providerMessageId",
    attachAs: "messageDelivery",
    identifier: true,
  });

export async function scopedRecipientResource(
  request,
  response,
  next
) {
  try {
    const scopeFilter =
      communicationAggregateAuthorityFilter(
        request.communicationScope
      );

    const recipient =
      await CommunicationCampaignRecipient.findOne({
        $and: [
          scopeFilter,
          {
            _id: request.params?.recipientId,
            campaign: request.params?.campaignId,
          },
        ],
      });

    if (!recipient) {
      throw notFound();
    }

    assertCommunicationAuthorityResource(
      recipient,
      request.communicationScope
    );

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
    const scopeFilter =
      communicationAggregateAuthorityFilter(
        request.communicationScope
      );

    const scheduled =
      await ScheduledCommunication.findOne({
        $and: [
          scopeFilter,
          {
            $or: [
              { _id: request.params?.campaignId },
              { campaign: request.params?.campaignId },
            ],
          },
        ],
      });

    if (scheduled) {
      assertCommunicationAuthorityResource(
        scheduled,
        request.communicationScope
      );
      request.scheduledCommunication = scheduled;
      return next();
    }

    return scopedScheduledCampaignResource(
      request,
      response,
      next
    );
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
};
