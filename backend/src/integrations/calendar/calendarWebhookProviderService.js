import crypto from "node:crypto";

const GOOGLE_TTL_SECONDS = 604800;
const OUTLOOK_TTL_MINUTES = 8640;
const RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;

function text(value) {
  return String(value ?? "").trim();
}

function enabled() {
  return ["1", "true", "yes", "on", "enabled"].includes(
    text(process.env.CALENDAR_WEBHOOKS_ENABLED).toLowerCase()
  );
}

function webhookBaseUrl() {
  const value = text(process.env.CALENDAR_WEBHOOK_BASE_URL);

  if (!value) {
    const error = new Error(
      "CALENDAR_WEBHOOK_BASE_URL is required when calendar webhooks are enabled."
    );
    error.code = "CALENDAR_WEBHOOK_CONFIGURATION_INVALID";
    throw error;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    const error = new Error(
      "CALENDAR_WEBHOOK_BASE_URL must be an absolute HTTPS URL."
    );
    error.code = "CALENDAR_WEBHOOK_CONFIGURATION_INVALID";
    throw error;
  }

  const isLocal =
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (url.protocol !== "https:" && !isLocal) {
    const error = new Error(
      "CALENDAR_WEBHOOK_BASE_URL must use HTTPS outside local development."
    );
    error.code = "CALENDAR_WEBHOOK_CONFIGURATION_INVALID";
    throw error;
  }

  return value.replace(/\/+$/, "");
}

function webhookSecret() {
  const value = text(process.env.CALENDAR_WEBHOOK_SECRET);

  if (value.length < 32) {
    const error = new Error(
      "CALENDAR_WEBHOOK_SECRET must contain at least 32 characters when calendar webhooks are enabled."
    );
    error.code = "CALENDAR_WEBHOOK_CONFIGURATION_INVALID";
    throw error;
  }

  return value;
}

export function calendarWebhooksEnabled() {
  return enabled();
}

export function calendarWebhookToken({
  connectionId,
  provider,
  calendarId = "",
}) {
  return crypto
    .createHmac("sha256", webhookSecret())
    .update(
      [
        "salonai-calendar-webhook",
        text(provider),
        text(connectionId),
        text(calendarId),
      ].join(":")
    )
    .digest("base64url");
}

export function verifyCalendarWebhookToken({
  actual,
  connectionId,
  provider,
  calendarId = "",
}) {
  const left = Buffer.from(text(actual));
  const right = Buffer.from(
    calendarWebhookToken({
      connectionId,
      provider,
      calendarId,
    })
  );

  return (
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

function notificationUrl(provider) {
  return `${webhookBaseUrl()}/api/calendar-webhooks/${provider}`;
}

function providerError(provider, status, body) {
  const error = new Error(
    body?.error?.message ||
      body?.error_description ||
      body?.message ||
      `${provider} calendar webhook request failed with HTTP ${status}.`
  );

  error.statusCode = status === 401 || status === 403 ? 409 : 502;
  error.code = "CALENDAR_WEBHOOK_PROVIDER_REQUEST_FAILED";
  error.provider = provider;
  error.providerStatus = status;
  return error;
}

async function providerRequest({
  provider,
  url,
  accessToken,
  method = "POST",
  body = null,
}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload =
    response.status === 204
      ? null
      : await response.json().catch(() => null);

  if (!response.ok) {
    throw providerError(provider, response.status, payload);
  }

  return payload;
}

function needsRenewal(connection) {
  if (!connection.subscriptionId || !connection.subscriptionExpiresAt) {
    return true;
  }

  const expiresAt = new Date(connection.subscriptionExpiresAt);

  return (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() - Date.now() <= RENEWAL_WINDOW_MS
  );
}

async function createGoogleSubscription({
  connection,
  accessToken,
}) {
  const previousSubscriptionId =
    text(connection.subscriptionId);
  const previousResourceId =
    text(connection.subscriptionResourceId);
  const id = crypto.randomUUID();
  const payload = await providerRequest({
    provider: "google",
    accessToken,
    url:
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        connection.calendarId
      )}/events/watch`,
    body: {
      id,
      type: "web_hook",
      address: notificationUrl("google"),
      token: calendarWebhookToken({
        connectionId: connection._id,
        provider: "google",
        calendarId: connection.calendarId,
      }),
      params: {
        ttl: String(GOOGLE_TTL_SECONDS),
      },
    },
  });

  connection.subscriptionId = text(payload?.id) || id;
  connection.subscriptionResourceId = text(payload?.resourceId);
  connection.subscriptionExpiresAt = payload?.expiration
    ? new Date(Number(payload.expiration))
    : new Date(Date.now() + GOOGLE_TTL_SECONDS * 1000);

  await connection.save();

  if (
    previousSubscriptionId &&
    previousResourceId &&
    previousSubscriptionId !==
      connection.subscriptionId
  ) {
    await providerRequest({
      provider: "google",
      accessToken,
      url: "https://www.googleapis.com/calendar/v3/channels/stop",
      body: {
        id:
          previousSubscriptionId,
        resourceId:
          previousResourceId,
      },
    }).catch(
      () => undefined
    );
  }

  return {
    provider: "google",
    subscriptionId: connection.subscriptionId,
    expiresAt: connection.subscriptionExpiresAt,
    renewed: true,
  };
}

async function createOutlookSubscription({
  connection,
  accessToken,
}) {
  const url = notificationUrl("outlook");
  const expirationDateTime = new Date(
    Date.now() + OUTLOOK_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const payload = await providerRequest({
    provider: "outlook",
    accessToken,
    url: "https://graph.microsoft.com/v1.0/subscriptions",
    body: {
      changeType: "created,updated,deleted",
      notificationUrl: url,
      lifecycleNotificationUrl: url,
      resource: "/me/events",
      expirationDateTime,
      clientState: calendarWebhookToken({
        connectionId: connection._id,
        provider: "outlook",
        calendarId: connection.calendarId,
      }),
    },
  });

  connection.subscriptionId = text(payload?.id);
  connection.subscriptionResourceId = "";
  connection.subscriptionExpiresAt = payload?.expirationDateTime
    ? new Date(payload.expirationDateTime)
    : new Date(expirationDateTime);

  await connection.save();

  return {
    provider: "outlook",
    subscriptionId: connection.subscriptionId,
    expiresAt: connection.subscriptionExpiresAt,
    renewed: true,
  };
}

async function renewOutlookSubscription({
  connection,
  accessToken,
}) {
  const expirationDateTime = new Date(
    Date.now() + OUTLOOK_TTL_MINUTES * 60 * 1000
  ).toISOString();

  try {
    const payload = await providerRequest({
      provider: "outlook",
      accessToken,
      method: "PATCH",
      url:
        `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(
          connection.subscriptionId
        )}`,
      body: {
        expirationDateTime,
      },
    });

    connection.subscriptionExpiresAt = payload?.expirationDateTime
      ? new Date(payload.expirationDateTime)
      : new Date(expirationDateTime);

    await connection.save();

    return {
      provider: "outlook",
      subscriptionId: connection.subscriptionId,
      expiresAt: connection.subscriptionExpiresAt,
      renewed: true,
    };
  } catch (error) {
    if (error.providerStatus !== 404) {
      throw error;
    }

    connection.subscriptionId = "";
    connection.subscriptionExpiresAt = null;
    await connection.save();

    return createOutlookSubscription({
      connection,
      accessToken,
    });
  }
}

export async function ensureCalendarWebhookSubscription({
  connection,
  accessToken,
}) {
  if (!enabled()) {
    return {
      enabled: false,
      renewed: false,
    };
  }

  webhookBaseUrl();
  webhookSecret();

  if (!needsRenewal(connection)) {
    return {
      enabled: true,
      renewed: false,
      provider: connection.provider,
      subscriptionId: connection.subscriptionId,
      expiresAt: connection.subscriptionExpiresAt,
    };
  }

  if (connection.provider === "google") {
    return createGoogleSubscription({
      connection,
      accessToken,
    });
  }

  if (connection.provider === "outlook") {
    if (connection.subscriptionId) {
      return renewOutlookSubscription({
        connection,
        accessToken,
      });
    }

    return createOutlookSubscription({
      connection,
      accessToken,
    });
  }

  throw new Error(
    `Unsupported calendar provider: ${connection.provider}`
  );
}

export async function stopCalendarWebhookSubscription({
  connection,
  accessToken,
}) {
  const subscriptionId = text(connection.subscriptionId);

  if (!subscriptionId) {
    return {
      stopped: false,
      reason: "not_subscribed",
    };
  }

  if (
    connection.provider === "google" &&
    text(connection.subscriptionResourceId)
  ) {
    await providerRequest({
      provider: "google",
      accessToken,
      url: "https://www.googleapis.com/calendar/v3/channels/stop",
      body: {
        id: subscriptionId,
        resourceId: text(connection.subscriptionResourceId),
      },
    });
  } else if (connection.provider === "outlook") {
    try {
      await providerRequest({
        provider: "outlook",
        accessToken,
        method: "DELETE",
        url:
          `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(
            subscriptionId
          )}`,
      });
    } catch (error) {
      if (error.providerStatus !== 404) {
        throw error;
      }
    }
  }

  connection.subscriptionId = "";
  connection.subscriptionResourceId = "";
  connection.subscriptionExpiresAt = null;
  await connection.save();

  return {
    stopped: true,
  };
}

export default {
  calendarWebhooksEnabled,
  ensureCalendarWebhookSubscription,
  stopCalendarWebhookSubscription,
  calendarWebhookToken,
  verifyCalendarWebhookToken,
};
