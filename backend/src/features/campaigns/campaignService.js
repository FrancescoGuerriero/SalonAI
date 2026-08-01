import Customer from "../../models/customer.js";
import Campaign from "./Campaign.js";
import CommunicationTemplate from "../../models/CommunicationTemplate.js";
import ScheduledCommunication from "../scheduler/ScheduledCommunication.js";
import { previewSegment } from "../segments/segmentService.js";
import {
  buildCustomerContext,
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
import { userId } from "../../shared/modelHelpers.js";

function recipientForChannel(customer, channel) {
  if (channel === "email") {
    return customer.email;
  }

  if (["sms", "phone", "whatsapp"].includes(channel)) {
    return (
      customer.phone ||
      customer.phoneNumber ||
      customer.mobile
    );
  }

  return String(customer._id);
}

async function campaignRecipients(campaign) {
  const recipients = new Map();

  if (campaign.segment) {
    const preview = await previewSegment(
      String(campaign.segment),
      { limit: 5000 }
    );

    for (const customer of preview.customers) {
      recipients.set(String(customer._id), customer);
    }
  }

  if (campaign.recipients?.length) {
    const direct = await Customer.find({
      _id: {
        $in: campaign.recipients,
      },
    })
      .select(
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .lean();

    for (const customer of direct) {
      recipients.set(String(customer._id), customer);
    }
  }

  return [...recipients.values()];
}

export async function createCampaign(payload, user) {
  if (!String(payload.name || "").trim()) {
    throw createServiceError(
      "Campaign name is required.",
      400
    );
  }

  if (!String(payload.message || "").trim() && !payload.template) {
    throw createServiceError(
      "A campaign message or template is required.",
      400
    );
  }

  const campaign = await Campaign.create({
    name: String(payload.name).trim(),
    campaignType:
      payload.campaignType || "general",
    channel: payload.channel || "email",
    template: payload.template || undefined,
    segment: payload.segment || undefined,
    recipients: Array.isArray(payload.recipients)
      ? payload.recipients
      : [],
    subject: String(payload.subject || "").trim(),
    message: String(payload.message || "").trim(),
    status: "draft",
    createdBy: userId(user),
    updatedBy: userId(user),
  });

  return campaign.toObject();
}

export async function listCampaigns(query = {}) {
  const { page, limit, skip } =
    paginationFromQuery(query);

  const match = {};

  if (query.status) {
    match.status = query.status;
  }

  if (query.channel) {
    match.channel = query.channel;
  }

  if (query.campaignType) {
    match.campaignType = query.campaignType;
  }

  const [items, total] = await Promise.all([
    Campaign.find(match)
      .populate("template", "name channel campaignType")
      .populate("segment", "name")
      .populate(
        "createdBy",
        "name firstName lastName email"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Campaign.countDocuments(match),
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

export async function getCampaign(id) {
  return assertFound(
    await Campaign.findById(id)
      .populate("template")
      .populate("segment")
      .populate(
        "recipients",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .lean(),
    "Campaign not found."
  );
}

export async function updateCampaign(
  id,
  payload,
  user
) {
  const campaign = assertFound(
    await Campaign.findById(id),
    "Campaign not found."
  );

  if (
    ["processing", "completed", "cancelled"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `Campaign cannot be edited from status ${campaign.status}.`,
      409
    );
  }

  for (const field of [
    "name",
    "campaignType",
    "channel",
    "template",
    "segment",
    "recipients",
    "subject",
    "message",
  ]) {
    if (payload[field] !== undefined) {
      campaign[field] = payload[field];
    }
  }

  campaign.updatedBy = userId(user);
  await campaign.save();

  return campaign.toObject();
}

export async function previewCampaign(id) {
  const campaign = await getCampaign(id);
  const recipients = await campaignRecipients(campaign);
  const template = campaign.template?._id
    ? campaign.template
    : campaign.template
      ? await CommunicationTemplate.findById(
          campaign.template
        ).lean()
      : null;

  const examples = recipients.slice(0, 10).map((customer) => {
    const context = buildCustomerContext(customer);

    return {
      customer,
      recipient: recipientForChannel(
        customer,
        campaign.channel
      ),
      subject: renderTemplate(
        template?.subject || campaign.subject,
        context
      ),
      message: renderTemplate(
        template?.body || campaign.message,
        context
      ),
    };
  });

  return {
    campaign,
    recipientCount: recipients.filter((customer) =>
      recipientForChannel(customer, campaign.channel)
    ).length,
    examples,
  };
}

export async function scheduleCampaign(
  id,
  scheduledFor
) {
  const campaign = assertFound(
    await Campaign.findById(id),
    "Campaign not found."
  );

  if (
    ["processing", "completed", "cancelled"].includes(
      campaign.status
    )
  ) {
    throw createServiceError(
      `Campaign cannot be scheduled from status ${campaign.status}.`,
      409
    );
  }

  const runAt = new Date(
    scheduledFor || campaign.scheduledFor
  );

  if (Number.isNaN(runAt.getTime())) {
    throw createServiceError(
      "A valid scheduledFor date is required.",
      400
    );
  }

  const recipients = await campaignRecipients(campaign);

  if (!recipients.length) {
    throw createServiceError(
      "The campaign has no matching recipients.",
      400
    );
  }

  const template = campaign.template
    ? await CommunicationTemplate.findById(
        campaign.template
      ).lean()
    : null;

  const jobs = [];

  for (const customer of recipients) {
    const recipient = recipientForChannel(
      customer,
      campaign.channel
    );

    if (!recipient) {
      continue;
    }

    const context = buildCustomerContext(customer);

    jobs.push({
      campaign: campaign._id,
      customer: customer._id,
      communicationType: "campaign",
      channel: campaign.channel,
      recipient,
      subject: renderTemplate(
        template?.subject || campaign.subject,
        context
      ),
      message: renderTemplate(
        template?.body || campaign.message,
        context
      ),
      scheduledFor: runAt,
      status: "queued",
      metadata: {
        campaignType: campaign.campaignType,
      },
    });
  }

  await ScheduledCommunication.deleteMany({
    campaign: campaign._id,
    status: "queued",
  });

  if (jobs.length) {
    await ScheduledCommunication.insertMany(
      jobs,
      { ordered: false }
    );
  }

  campaign.status = "scheduled";
  campaign.scheduledFor = runAt;
  campaign.recipientCount = jobs.length;
  campaign.sentCount = 0;
  campaign.failedCount = 0;

  await campaign.save();

  return getCampaign(campaign._id);
}

export async function cancelCampaign(id) {
  const campaign = assertFound(
    await Campaign.findById(id),
    "Campaign not found."
  );

  if (campaign.status === "completed") {
    throw createServiceError(
      "A completed campaign cannot be cancelled.",
      409
    );
  }

  campaign.status = "cancelled";
  await campaign.save();

  await ScheduledCommunication.updateMany(
    {
      campaign: campaign._id,
      status: {
        $in: ["queued", "processing"],
      },
    },
    {
      $set: {
        status: "cancelled",
        lockedAt: null,
        lockedBy: "",
      },
    }
  );

  return campaign.toObject();
}

export async function campaignJobs(
  id,
  query = {}
) {
  const { page, limit, skip } =
    paginationFromQuery(query);

  const match = {
    campaign: id,
  };

  if (query.status) {
    match.status = query.status;
  }

  const [items, total] = await Promise.all([
    ScheduledCommunication.find(match)
      .populate(
        "customer",
        "firstName lastName fullName name email phone phoneNumber mobile"
      )
      .sort({ scheduledFor: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ScheduledCommunication.countDocuments(match),
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
