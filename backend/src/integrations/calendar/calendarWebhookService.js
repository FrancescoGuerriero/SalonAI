import ExternalCalendarConnection from "../../models/ExternalCalendarConnection.js";
import {
  verifyCalendarWebhookToken,
} from "./calendarWebhookProviderService.js";

function text(value) {
  return String(value ?? "").trim();
}

function header(headers, name) {
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    return text(headers.get(name));
  }

  return text(
    headers[name] ||
      headers[name.toLowerCase()] ||
      headers[name.toUpperCase()]
  );
}

async function requestReconciliation(connection, now = new Date()) {
  await ExternalCalendarConnection.updateOne(
    {
      _id: connection._id,
      status: "connected",
      syncEnabled: true,
    },
    {
      $max: {
        reconcileRequestedAt: now,
        lastWebhookAt: now,
      },
    }
  );

  return String(connection._id);
}

export async function handleGoogleCalendarWebhook({
  headers,
}) {
  const subscriptionId = header(headers, "x-goog-channel-id");
  const suppliedToken = header(headers, "x-goog-channel-token");
  const resourceId = header(headers, "x-goog-resource-id");
  const resourceState = header(headers, "x-goog-resource-state");

  if (!subscriptionId || !suppliedToken) {
    return {
      accepted: false,
      reason: "missing_channel_identity",
    };
  }

  const connection =
    await ExternalCalendarConnection.findOne({
      provider: "google",
      status: "connected",
      syncEnabled: true,
      subscriptionId,
    }).select("+subscriptionId +subscriptionResourceId");

  if (!connection) {
    return {
      accepted: false,
      reason: "unknown_channel",
    };
  }

  if (
    !verifyCalendarWebhookToken({
      actual: suppliedToken,
      connectionId: connection._id,
      provider: "google",
      calendarId: connection.calendarId,
    })
  ) {
    return {
      accepted: false,
      reason: "invalid_channel_token",
    };
  }

  if (
    connection.subscriptionResourceId &&
    resourceId &&
    connection.subscriptionResourceId !== resourceId
  ) {
    return {
      accepted: false,
      reason: "resource_mismatch",
    };
  }

  const connectionId = await requestReconciliation(connection);

  return {
    accepted: true,
    provider: "google",
    connectionId,
    resourceState,
  };
}

export async function handleOutlookCalendarWebhook({
  body,
}) {
  const notifications = Array.isArray(body?.value)
    ? body.value
    : [];

  if (notifications.length === 0) {
    return {
      accepted: 0,
      ignored: 0,
      connectionIds: [],
    };
  }

  const connectionIds = new Set();
  let ignored = 0;

  for (const notification of notifications) {
    const subscriptionId = text(notification?.subscriptionId);
    const suppliedState = text(notification?.clientState);

    if (!subscriptionId || !suppliedState) {
      ignored += 1;
      continue;
    }

    const connection =
      await ExternalCalendarConnection.findOne({
        provider: "outlook",
        status: "connected",
        syncEnabled: true,
        subscriptionId,
      }).select("+subscriptionId +subscriptionResourceId");

    if (!connection) {
      ignored += 1;
      continue;
    }

    if (
      !verifyCalendarWebhookToken({
        actual: suppliedState,
        connectionId: connection._id,
        provider: "outlook",
        calendarId: connection.calendarId,
      })
    ) {
      ignored += 1;
      continue;
    }

    const now = new Date();
    const lifecycleEvent = text(notification?.lifecycleEvent);

    if (lifecycleEvent === "subscriptionRemoved") {
      await ExternalCalendarConnection.updateOne(
        {
          _id: connection._id,
          subscriptionId,
        },
        {
          $set: {
            subscriptionId: "",
            subscriptionResourceId: "",
            subscriptionExpiresAt: null,
          },
          $max: {
            reconcileRequestedAt: now,
            lastWebhookAt: now,
          },
        }
      );
    } else {
      const update = {
        $max: {
          reconcileRequestedAt: now,
          lastWebhookAt: now,
        },
      };

      if (lifecycleEvent === "reauthorizationRequired") {
        update.$set = {
          subscriptionExpiresAt: new Date(0),
        };
      }

      await ExternalCalendarConnection.updateOne(
        {
          _id: connection._id,
          subscriptionId,
        },
        update
      );
    }

    connectionIds.add(String(connection._id));
  }

  return {
    accepted: connectionIds.size,
    ignored,
    connectionIds: [...connectionIds],
  };
}

export default {
  handleGoogleCalendarWebhook,
  handleOutlookCalendarWebhook,
};
