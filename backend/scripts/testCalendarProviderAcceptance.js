import "dotenv/config";
import mongoose from "mongoose";

import ExternalCalendarConnection from "../src/models/ExternalCalendarConnection.js";
import {
  getCalendarProviderContext,
} from "../src/integrations/calendar/calendarConnectionService.js";
import {
  calendarWebhooksEnabled,
  ensureCalendarWebhookSubscription,
} from "../src/integrations/calendar/calendarWebhookProviderService.js";
import {
  runCalendarProviderAcceptance,
} from "../src/integrations/calendar/calendarProviderAcceptanceService.js";

const CONFIRMATION =
  "RUN_CALENDAR_PROVIDER_ACCEPTANCE";

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function boolean(
  value
) {
  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    text(value)
      .toLowerCase()
  );
}

function integer(
  value,
  fallback,
  min,
  max
) {
  const parsed =
    Number.parseInt(
      value,
      10
    );

  return (
    Number.isFinite(
      parsed
    ) &&
    parsed >= min &&
    parsed <= max
  )
    ? parsed
    : fallback;
}

async function findConnection() {
  const provider =
    text(
      process.env
        .CALENDAR_ACCEPTANCE_PROVIDER
    )
      .toLowerCase();
  const connectionId =
    text(
      process.env
        .CALENDAR_ACCEPTANCE_CONNECTION_ID
    );
  const accountEmail =
    text(
      process.env
        .CALENDAR_ACCEPTANCE_ACCOUNT_EMAIL
    )
      .toLowerCase();

  if (
    ![
      "google",
      "outlook",
    ].includes(
      provider
    )
  ) {
    throw new Error(
      "CALENDAR_ACCEPTANCE_PROVIDER must be google or outlook."
    );
  }

  if (connectionId) {
    const connection =
      await ExternalCalendarConnection.findById(
        connectionId
      )
        .select(
          "_id provider accountEmail calendarId calendarName syncEnabled status lastWebhookAt subscriptionExpiresAt"
        )
        .lean();

    if (
      !connection ||
      connection.provider !==
        provider
    ) {
      throw new Error(
        "CALENDAR_ACCEPTANCE_CONNECTION_ID does not identify the requested provider connection."
      );
    }

    return connection;
  }

  if (!accountEmail) {
    throw new Error(
      "Set CALENDAR_ACCEPTANCE_CONNECTION_ID or CALENDAR_ACCEPTANCE_ACCOUNT_EMAIL."
    );
  }

  const matches =
    await ExternalCalendarConnection.find({
      provider,
      accountEmail,
    })
      .select(
        "_id provider accountEmail calendarId calendarName syncEnabled status lastWebhookAt subscriptionExpiresAt"
      )
      .limit(2)
      .lean();

  if (
    matches.length !==
    1
  ) {
    throw new Error(
      matches.length === 0
        ? "No calendar connection matches CALENDAR_ACCEPTANCE_ACCOUNT_EMAIL."
        : "More than one calendar connection matches CALENDAR_ACCEPTANCE_ACCOUNT_EMAIL; use CALENDAR_ACCEPTANCE_CONNECTION_ID."
    );
  }

  return matches[0];
}

async function sleep(
  milliseconds
) {
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function waitForWebhook({
  connectionId,
  after,
  timeoutMs,
}) {
  const started =
    Date.now();
  const baseline =
    after
      ? new Date(
          after
        ).getTime()
      : 0;

  while (
    Date.now() -
      started <
    timeoutMs
  ) {
    const current =
      await ExternalCalendarConnection.findById(
        connectionId
      )
        .select(
          "lastWebhookAt"
        )
        .lean();

    const webhookAt =
      current
        ?.lastWebhookAt
        ? new Date(
            current.lastWebhookAt
          )
        : null;

    if (
      webhookAt &&
      webhookAt.getTime() >
        baseline
    ) {
      return webhookAt;
    }

    await sleep(
      500
    );
  }

  return null;
}

async function main() {
  if (
    text(
      process.env
        .CALENDAR_ACCEPTANCE_CONFIRM
    ) !==
    CONFIRMATION
  ) {
    throw new Error(
      `Refusing to modify a real calendar. Set CALENDAR_ACCEPTANCE_CONFIRM=${CONFIRMATION} only for a deliberate acceptance run.`
    );
  }

  const mongoUri =
    text(
      process.env.MONGODB_URI
    );

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is required for calendar provider acceptance."
    );
  }

  const requireWebhook =
    boolean(
      process.env
        .CALENDAR_ACCEPTANCE_REQUIRE_WEBHOOK
    );
  const webhookTimeoutMs =
    integer(
      process.env
        .CALENDAR_ACCEPTANCE_WEBHOOK_TIMEOUT_MS,
      30_000,
      5_000,
      120_000
    );

  await mongoose.connect(
    mongoUri,
    {
      serverSelectionTimeoutMS:
        15_000,
    }
  );

  const selected =
    await findConnection();

  if (
    selected.status !==
      "connected" ||
    selected.syncEnabled !==
      true
  ) {
    throw new Error(
      "The acceptance connection must be connected with Sync enabled. Use a dedicated staff/test calendar; the calendar worker may remain disabled."
    );
  }

  const {
    connection,
    accessToken,
  } =
    await getCalendarProviderContext({
      connectionId:
        selected._id,
    });

  if (
    requireWebhook &&
    !calendarWebhooksEnabled()
  ) {
    throw new Error(
      "CALENDAR_ACCEPTANCE_REQUIRE_WEBHOOK=true requires CALENDAR_WEBHOOKS_ENABLED=true."
    );
  }

  const subscription =
    await ensureCalendarWebhookSubscription({
      connection,
      accessToken,
    });

  // Allow an initial Google channel sync notification to settle before
  // taking the webhook baseline for the event lifecycle below.
  if (
    requireWebhook
  ) {
    await sleep(
      1_500
    );
  }

  const baseline =
    await ExternalCalendarConnection.findById(
      selected._id
    )
      .select(
        "lastWebhookAt"
      )
      .lean();

  const lifecycle =
    await runCalendarProviderAcceptance({
      provider:
        connection.provider,
      calendarId:
        connection.calendarId,
      accessToken,
      timeZone:
        process.env
          .SALON_TIME_ZONE ||
        "Europe/London",
    });

  let webhookObservedAt =
    null;

  if (
    requireWebhook
  ) {
    webhookObservedAt =
      await waitForWebhook({
        connectionId:
          selected._id,
        after:
          baseline
            ?.lastWebhookAt ||
          null,
        timeoutMs:
          webhookTimeoutMs,
      });

    if (!webhookObservedAt) {
      throw new Error(
        `No verified provider webhook was observed within ${webhookTimeoutMs}ms after the acceptance event changed.`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        provider:
          connection.provider,
        accountEmail:
          connection.accountEmail,
        calendarName:
          connection.calendarName,
        calendarId:
          connection.calendarId,
        lifecycle,
        webhook: {
          required:
            requireWebhook,
          enabled:
            calendarWebhooksEnabled(),
          subscriptionMaintained:
            subscription.enabled !==
            false,
          observedAt:
            webhookObservedAt
              ?.toISOString() ||
            null,
        },
      },
      null,
      2
    )
  );
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        success: false,
        code:
          error?.code ||
          "CALENDAR_ACCEPTANCE_FAILED",
        message:
          error?.message ||
          "Calendar provider acceptance failed.",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await mongoose
    .disconnect()
    .catch(
      () => undefined
    );
}
