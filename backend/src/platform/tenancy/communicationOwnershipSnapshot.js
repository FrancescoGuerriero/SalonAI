import Business from "../../models/Business.js";
import Location from "../../models/Location.js";
import CommunicationCampaign from "../../models/CommunicationCampaign.js";
import CommunicationCampaignRecipient from "../../models/CommunicationCampaignRecipient.js";
import CommunicationTemplate from "../../models/CommunicationTemplate.js";
import MessageDelivery from "../../models/MessageDelivery.js";
import ScheduledCommunication from "../../features/scheduler/ScheduledCommunication.js";

import { buildCommunicationOwnershipPlan } from "./communicationOwnershipMigration.js";

function querySession(query, session) {
  return session ? query.session(session) : query;
}

export async function resolveCanonicalCommunicationOwnership({
  configuration,
  session = null,
} = {}) {
  if (!configuration?.business?.slug || !configuration?.location?.slug) {
    throw new Error("Canonical communications tenant configuration is required.");
  }

  const business = await querySession(
    Business.findOne({ slug: configuration.business.slug })
      .select("_id slug businessType status"),
    session
  ).lean();

  if (!business) {
    throw new Error(
      "Canonical Business is missing. Complete tenant bootstrap before communications ownership work."
    );
  }

  const location = await querySession(
    Location.findOne({
      business: business._id,
      slug: configuration.location.slug,
      status: "active",
    }).select("_id business slug status"),
    session
  ).lean();

  if (!location) {
    throw new Error(
      "Canonical active primary Location is missing. Complete tenant bootstrap before communications ownership work."
    );
  }

  return Object.freeze({ business, location });
}

export async function loadCommunicationOwnershipSnapshot({
  configuration,
  session = null,
  includeIndexes = false,
} = {}) {
  const { business, location } = await resolveCanonicalCommunicationOwnership({
    configuration,
    session,
  });

  const [campaigns, recipients, templates, scheduledCommunications, messageDeliveries] =
    await Promise.all([
      querySession(
        CommunicationCampaign.find({})
          .sort({ _id: 1 })
          .select("_id business location slug"),
        session
      ).lean(),
      querySession(
        CommunicationCampaignRecipient.find({})
          .sort({ _id: 1 })
          .select("_id business location campaign appointment template customer externalMessageId"),
        session
      ).lean(),
      querySession(
        CommunicationTemplate.find({})
          .sort({ _id: 1 })
          .select("_id business location slug"),
        session
      ).lean(),
      querySession(
        ScheduledCommunication.find({})
          .sort({ _id: 1 })
          .select("_id business location campaign appointment customer providerMessageId"),
        session
      ).lean(),
      querySession(
        MessageDelivery.find({})
          .sort({ _id: 1 })
          .select("_id business location campaign customer providerMessageId"),
        session
      ).lean(),
    ]);

  const plan = buildCommunicationOwnershipPlan({
    business,
    location,
    campaigns,
    recipients,
    templates,
    scheduledCommunications,
    messageDeliveries,
  });

  let campaignIndexes = [];
  let templateIndexes = [];
  let deliveryIndexes = [];
  if (includeIndexes && !session) {
    [campaignIndexes, templateIndexes, deliveryIndexes] = await Promise.all([
      CommunicationCampaign.collection.indexes().catch(() => []),
      CommunicationTemplate.collection.indexes().catch(() => []),
      MessageDelivery.collection.indexes().catch(() => []),
    ]);
  }

  return Object.freeze({
    business,
    location,
    campaigns: Object.freeze([...campaigns]),
    recipients: Object.freeze([...recipients]),
    templates: Object.freeze([...templates]),
    scheduledCommunications: Object.freeze([...scheduledCommunications]),
    messageDeliveries: Object.freeze([...messageDeliveries]),
    plan,
    indexes: Object.freeze({
      campaigns: Object.freeze([...campaignIndexes]),
      templates: Object.freeze([...templateIndexes]),
      messageDeliveries: Object.freeze([...deliveryIndexes]),
    }),
  });
}

export default {
  resolveCanonicalCommunicationOwnership,
  loadCommunicationOwnershipSnapshot,
};
