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

function uniqueObjectIds(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(idText)
        .filter(isObjectId)
    ),
  ];
}

async function assertOwnedCampaign(request, campaignId) {
  const id = idText(campaignId);
  if (!id) return;
  if (!isObjectId(id)) throw notFound();

  const campaign = await CommunicationCampaign.exists({
    $and: [
      communicationAggregateAuthorityFilter(request.communicationScope),
      { _id: id },
    ],
  });
  if (!campaign) throw notFound();
}

async function assertOwnedTemplate(request, templateId) {
  const id = idText(templateId);
  if (!id) return;
  if (!isObjectId(id)) throw notFound();

  const template = await CommunicationTemplate.exists({
    $and: [
      communicationAggregateAuthorityFilter(request.communicationScope),
      { _id: id },
    ],
  });
  if (!template) throw notFound();
}

async function assertOwnedCustomers(request, values) {
  const ids = uniqueObjectIds(values);
  if (ids.length === 0) return;

  const businessId = idText(request.communicationScope?.businessId);
  if (!businessId) throw notFound();

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
      customerIds.push(
        ...(Array.isArray(message.audience.customerIds)
          ? message.audience.customerIds
          : []),
        ...(Array.isArray(message.audience.excludedCustomerIds)
          ? message.audience.excludedCustomerIds
          : [])
      );
    }
  }

  return {
    campaignIds: uniqueObjectIds(campaignIds),
    templateIds: uniqueObjectIds(templateIds),
    customerIds: uniqueObjectIds(customerIds),
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
