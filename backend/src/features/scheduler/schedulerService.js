import os from "node:os";

import ScheduledCommunication from "./ScheduledCommunication.js";
import Campaign from "../campaigns/Campaign.js";
import CustomerContactLog from "../../models/customerContactLog.js";
import { sendCommunication } from "../../providers/communicationProvider.js";

const workerId = `${os.hostname()}_${process.pid}`;

async function claimNextJob() {
  const staleLock = new Date(Date.now() - 10 * 60 * 1000);

  return ScheduledCommunication.findOneAndUpdate(
    {
      status: "queued",
      scheduledFor: {
        $lte: new Date(),
      },
      $or: [
        {
          lockedAt: null,
        },
        {
          lockedAt: {
            $exists: false,
          },
        },
        {
          lockedAt: {
            $lt: staleLock,
          },
        },
      ],
    },
    {
      $set: {
        status: "processing",
        lockedAt: new Date(),
        lockedBy: workerId,
        lastAttemptAt: new Date(),
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
      sort: {
        scheduledFor: 1,
      },
    }
  );
}

async function updateCampaignCounters(campaignId) {
  if (!campaignId) {
    return;
  }

  const rows =
    await ScheduledCommunication.aggregate([
      {
        $match: {
          campaign: campaignId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]);

  const counts = Object.fromEntries(
    rows.map((row) => [row._id, row.count])
  );

  const pending =
    (counts.queued || 0) +
    (counts.processing || 0);

  const sent =
    (counts.sent || 0) +
    (counts.delivered || 0) +
    (counts.opened || 0) +
    (counts.responded || 0);

  const failed = counts.failed || 0;

  const status =
    pending > 0
      ? "processing"
      : failed > 0 && sent > 0
        ? "partially_failed"
        : failed > 0
          ? "failed"
          : "completed";

  await Campaign.findByIdAndUpdate(campaignId, {
    $set: {
      status,
      sentCount: sent,
      failedCount: failed,
      ...(pending === 0
        ? {
            completedAt: new Date(),
          }
        : {}),
    },
  });
}

async function createContactLog(job, result) {
  const status =
    result.status === "delivered"
      ? "delivered"
      : "sent";

  return CustomerContactLog.create({
    customer: job.customer,
    appointment: job.appointment || undefined,
    campaignType:
      job.metadata?.campaignType ||
      (job.communicationType ===
      "appointment_reminder"
        ? "appointment_reminder"
        : "general"),
    channel: job.channel,
    direction: "outbound",
    subject: job.subject,
    message: job.message,
    status,
    recipient: job.recipient,
    externalMessageId: result.messageId,
    sentAt: new Date(),
    deliveredAt:
      status === "delivered"
        ? new Date()
        : undefined,
    metadata: {
      scheduledCommunicationId: String(job._id),
      campaignId: job.campaign
        ? String(job.campaign)
        : undefined,
      provider: result.provider,
    },
  });
}

export async function processNextJob() {
  const job = await claimNextJob();

  if (!job) {
    return null;
  }

  try {
    const result = await sendCommunication(
      job.channel,
      {
        to: job.recipient,
        subject: job.subject,
        message: job.message,
        metadata: {
          campaignId: job.campaign
            ? String(job.campaign)
            : undefined,
          customerId: String(job.customer),
          appointmentId: job.appointment
            ? String(job.appointment)
            : undefined,
        },
      }
    );

    job.status =
      result.status === "delivered"
        ? "delivered"
        : "sent";
    job.provider = result.provider;
    job.providerMessageId = result.messageId;
    job.sentAt = new Date();
    job.failureReason = "";

    await createContactLog(job, result);
  } catch (error) {
    if (job.attempts >= 3) {
      job.status = "failed";
    } else {
      job.status = "queued";
      job.scheduledFor = new Date(
        Date.now() +
          Math.min(job.attempts, 3) *
            5 *
            60 *
            1000
      );
    }

    job.failureReason = error.message;
  } finally {
    job.lockedAt = null;
    job.lockedBy = "";
    await job.save();
    await updateCampaignCounters(job.campaign);
  }

  return job.toObject();
}

export async function processBatch(limit = 25) {
  const processed = [];

  for (let index = 0; index < limit; index += 1) {
    const job = await processNextJob();

    if (!job) {
      break;
    }

    processed.push(job);
  }

  return processed;
}

export async function listScheduledJobs(query = {}) {
  const match = {};

  if (query.status) {
    match.status = query.status;
  }

  if (query.channel) {
    match.channel = query.channel;
  }

  return ScheduledCommunication.find(match)
    .populate(
      "customer",
      "firstName lastName fullName name email phone phoneNumber mobile"
    )
    .populate("campaign", "name campaignType")
    .populate(
      "appointment",
      "appointmentDate appointmentTime status"
    )
    .sort({
      scheduledFor: 1,
    })
    .limit(500)
    .lean();
}

export async function cancelScheduledJob(id) {
  const job =
    await ScheduledCommunication.findById(id);

  if (!job) {
    throw new Error(
      "Scheduled communication not found."
    );
  }

  if (
    !["queued", "processing"].includes(job.status)
  ) {
    throw new Error(
      `Communication cannot be cancelled from status ${job.status}.`
    );
  }

  job.status = "cancelled";
  job.lockedAt = null;
  job.lockedBy = "";
  await job.save();

  await updateCampaignCounters(job.campaign);

  return job.toObject();
}
