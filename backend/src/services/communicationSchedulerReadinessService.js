function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : 0;
}

export function buildCommunicationSchedulerReadinessReport({
  databaseReadable = false,
  schedulerConfiguration = {},
  reminderConfiguration = {},
  inventory = {},
} = {}) {
  const schedulerEnabled =
    schedulerConfiguration.enabled === true;
  const reminderEnabled =
    reminderConfiguration.enabled === true;

  const reminderWindowValid =
    Number(reminderConfiguration.lookAheadHours) >=
    Number(reminderConfiguration.hoursBefore);

  const blockers = [];

  if (!databaseReadable) {
    blockers.push("databaseReadable");
  }

  if (!schedulerEnabled) {
    blockers.push("messageDeliverySchedulerEnabled");
  }

  if (!reminderEnabled) {
    blockers.push("appointmentReminderJobEnabled");
  }

  if (!reminderWindowValid) {
    blockers.push("appointmentReminderWindow");
  }

  const report = {
    readOnly: true,
    readyForActivation:
      blockers.length === 0,
    scheduler: {
      enabled:
        schedulerEnabled,
      intervalMs:
        Number(schedulerConfiguration.intervalMs) || null,
      campaignLimit:
        Number(schedulerConfiguration.campaignLimit) || null,
      campaignConcurrency:
        Number(schedulerConfiguration.campaignConcurrency) || null,
      retryLimit:
        Number(schedulerConfiguration.retryLimit) || null,
      retryConcurrency:
        Number(schedulerConfiguration.retryConcurrency) || null,
      runImmediately:
        schedulerConfiguration.runImmediately === true,
    },
    appointmentReminders: {
      enabled:
        reminderEnabled,
      intervalMs:
        Number(reminderConfiguration.intervalMs) || null,
      hoursBefore:
        Number(reminderConfiguration.hoursBefore) || 0,
      lookAheadHours:
        Number(reminderConfiguration.lookAheadHours) || 0,
      runImmediately:
        reminderConfiguration.runImmediately === true,
      channelPolicy:
        "customer_preference",
      windowValid:
        reminderWindowValid,
    },
    inventory: {
      scheduledCampaignsDue:
        safeCount(inventory.scheduledCampaignsDue),
      scheduledCampaignsFuture:
        safeCount(inventory.scheduledCampaignsFuture),
      retryableDeliveriesDue:
        safeCount(inventory.retryableDeliveriesDue),
      retryableDeliveriesFuture:
        safeCount(inventory.retryableDeliveriesFuture),
      processingDeliveries:
        safeCount(inventory.processingDeliveries),
      failedOrUndelivered:
        safeCount(inventory.failedOrUndelivered),
      pendingDeliveries:
        safeCount(inventory.pendingDeliveries),
    },
    blockers,
    databaseWrites: false,
    providerSends: false,
    piiIncluded: false,
  };

  return report;
}

export default {
  buildCommunicationSchedulerReadinessReport,
};
