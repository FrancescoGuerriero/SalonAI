import Customer from "../models/customer.js";
import CommunicationCampaign from "../models/CommunicationCampaign.js";
import CommunicationTemplate from "../models/CommunicationTemplate.js";

import {
  communicationAggregateAuthorityFilter,
} from "../services/communicationEffectiveAuthorityService.js";

function notFound() {
  const error = new Error("Communication resource not found.");
  error.code = "COMMUNICATION_RESOURCE_NOT_FOUND";
  error.statusCode = 404;
  return error;
}

function idText(value) {
  const candidate =
    value && typeof value === "object" && "_id" in value
      ? value._id
      : value;
  return String(candidate ?? "").trim();
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(idText(value));
}

function strictObjectIds(values = []) {
  const source = Array.isArray(values) ? values : [values];
  const ids = [];

  for (const value of source) {
    // Undefined represents an optional reference that was not supplied by the
    // client. Every supplied value, including null/blank/malformed values,
    // must validate rather than being silently filtered out of authorization.
    if (value === undefined) continue;

    const id = idText(value);
    if (!isObjectId(id)) throw notFound();
    ids.push(id);
  }

  return [...new Set(ids)];
}

async function assertOwnedCampaign(request, campaignId) {
  const campaign = await CommunicationCampaign.exists({
    $and: [
      communicationAggregateAuthorityFilter(request.communicationScope),
      { _id: campaignId },
    ],
  });
  if (!campaign) throw notFound();
}

async function assertOwnedTemplate(request, templateId) {
  const template = await CommunicationTemplate.exists({
    $and: [
      communicationAggregateAuthorityFilter(request.communicationScope),
      { _id: templateId },
    ],
  });
  if (!template) throw notFound();
}

async function assertOwnedCustomers(request, ids) {
  if (ids.length === 0) return;

  const businessId = idText(request.communicationScope?.businessId);
  if (!isObjectId(businessId)) throw notFound();

  const count = await Customer.countDocuments({
    business: businessId,
    _id: { $in: ids },
  });

  if (count !== ids.length) throw notFound();
}

function collectReferences(body = {}) {
  const messages = Array.isArray(body.messages)
    ? body.messages
    : [body];

  const campaignIds = [];
  const templateIds = [];
  const customerIds = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;

    campaignIds.push(
      message.campaignId,
      message.campaign
    );
    templateIds.push(
      message.templateId,
      message.template
    );
    customerIds.push(
      message.customerId,
      message.customer
    );

    if (
      message.audience &&
      typeof message.audience === "object"
    ) {
      if (message.audience.customerIds !== undefined) {
        if (!Array.isArray(message.audience.customerIds)) throw notFound();
        customerIds.push(...message.audience.customerIds);
      }

      if (message.audience.excludedCustomerIds !== undefined) {
        if (!Array.isArray(message.audience.excludedCustomerIds)) throw notFound();
        customerIds.push(...message.audience.excludedCustomerIds);
      }
    }
  }

  return {
    campaignIds: strictObjectIds(campaignIds),
    templateIds: strictObjectIds(templateIds),
    customerIds: strictObjectIds(customerIds),
  };
}

export async function communicationReferenceScopeMiddleware(
  request,
  response,
  next
) {
  try {
    const refs = collectReferences(request.body || {});

    for (const campaignId of refs.campaignIds) {
      await assertOwnedCampaign(request, campaignId);
    }

    for (const templateId of refs.templateIds) {
      await assertOwnedTemplate(request, templateId);
    }

    await assertOwnedCustomers(request, refs.customerIds);

    return next();
  } catch (error) {
    return next(error);
  }
}

export default communicationReferenceScopeMiddleware;
