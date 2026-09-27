import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  notificationChannels,
} from "../features/appointments/appointmentNotificationService.js";
import {
  customerAllowsTransactionalMessage,
} from "../services/transactionalNotificationService.js";

function customer({
  preferredReminderChannel = "email",
  preferredChannel = "email",
  email = "customer@example.com",
  phone = "+447700900123",
  communicationPreferences = {},
} = {}) {
  return {
    email,
    phone,
    bookingPreferences: {
      preferredReminderChannel,
    },
    communicationPreferences: {
      preferredChannel,
      appointmentReminders: true,
      unsubscribed: false,
      emailUnsubscribed: false,
      smsUnsubscribed: false,
      whatsappUnsubscribed: false,
      ...communicationPreferences,
    },
  };
}

test("appointment reminders use exactly the preferred reminder channel", () => {
  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "email",
      }),
      {
        reminder: true,
      }
    ),
    [
      "email",
    ]
  );

  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "sms",
      }),
      {
        reminder: true,
      }
    ),
    [
      "sms",
    ]
  );

  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "whatsapp",
      }),
      {
        reminder: true,
      }
    ),
    [
      "whatsapp",
    ]
  );
});

test("preferred reminder channel none suppresses reminder delivery even when email exists", () => {
  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "none",
      }),
      {
        reminder: true,
      }
    ),
    []
  );
});

test("reminder routing respects channel-level unsubscribe and missing contact", () => {
  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "whatsapp",
        communicationPreferences: {
          whatsappUnsubscribed: true,
        },
      }),
      {
        reminder: true,
      }
    ),
    []
  );

  assert.deepEqual(
    notificationChannels(
      customer({
        preferredReminderChannel:
          "sms",
        phone: "",
      }),
      {
        reminder: true,
      }
    ),
    []
  );
});

test("transactional WhatsApp respects the customer's WhatsApp unsubscribe", () => {
  assert.equal(
    customerAllowsTransactionalMessage(
      customer({
        communicationPreferences: {
          whatsappUnsubscribed: true,
        },
      }),
      "whatsapp"
    ),
    false
  );

  assert.equal(
    customerAllowsTransactionalMessage(
      customer(),
      "whatsapp"
    ),
    true
  );
});

test("scheduler activation workflow is release-pinned, zero-backlog gated and rollback capable", async () => {
  const workflow =
    await readFile(
      new URL(
        "../../../.github/workflows/production-message-delivery-scheduler-activation.yml",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    workflow,
    /ENABLE_MESSAGE_DELIVERY_SCHEDULER/
  );
  assert.match(
    workflow,
    /scheduledCampaignsDue/
  );
  assert.match(
    workflow,
    /retryableDeliveriesDue/
  );
  assert.match(
    workflow,
    /MESSAGE_DELIVERY_SCHEDULER_ENABLED true/
  );
  assert.match(
    workflow,
    /MESSAGE_DELIVERY_SCHEDULER_RUN_IMMEDIATELY false/
  );
  assert.match(
    workflow,
    /APPOINTMENT_REMINDER_JOB_ENABLED false/
  );
  assert.match(
    workflow,
    /rollback\(\)/
  );
  assert.match(
    workflow,
    /--force-recreate backend/
  );
  assert.match(
    workflow,
    /restart edge/
  );
});

test("appointment reminder candidate audit is aggregate-only and send-free", async () => {
  const workflow =
    await readFile(
      new URL(
        "../../../.github/workflows/production-appointment-reminder-candidate-audit.yml",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    workflow,
    /piiIncluded:\s*false/
  );
  assert.match(
    workflow,
    /providerSends:\s*false/
  );
  assert.match(
    workflow,
    /databaseWrites:\s*false/
  );
  assert.match(
    workflow,
    /preferredReminderChannel/
  );
  assert.match(
    workflow,
    /duplicateEventKeys/
  );
  assert.match(
    workflow,
    /providerBlockedCandidates/
  );

  assert.doesNotMatch(
    workflow,
    /notifyAppointmentReminder\(/
  );
  assert.doesNotMatch(
    workflow,
    /sendTransactionalNotification\(/
  );
});
