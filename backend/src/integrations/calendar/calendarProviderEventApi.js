import crypto from "node:crypto";

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function requireValue(
  value,
  label
) {
  const result =
    text(value);

  if (!result) {
    throw new Error(
      `${label} is required.`
    );
  }

  return result;
}

function providerError(
  provider,
  status,
  body
) {
  const message =
    body?.error
      ?.message ||
    body?.error_description ||
    body?.message ||
    `${provider} calendar request failed with HTTP ${status}.`;

  const error =
    new Error(message);

  error.statusCode =
    status === 401 ||
    status === 403
      ? 409
      : 502;

  error.code =
    "CALENDAR_PROVIDER_EVENT_REQUEST_FAILED";
  error.provider =
    provider;
  error.providerStatus =
    status;

  return error;
}

async function providerRequest({
  provider,
  url,
  accessToken,
  method = "GET",
  body = null,
  headers = {},
}) {
  const response =
    await fetch(url, {
      method,
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        ...(body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
        ...headers,
      },
      body:
        body
          ? JSON.stringify(
              body
            )
          : undefined,
    });

  const payload =
    response.status === 204
      ? null
      : await response
          .json()
          .catch(() => null);

  if (!response.ok) {
    throw providerError(
      provider,
      response.status,
      payload
    );
  }

  return payload;
}

function googleEventId(
  event
) {
  return crypto
    .createHash("sha256")
    .update(
      `salonai:${event.sourceType}:${event.sourceId}`
    )
    .digest("hex")
    .slice(0, 40);
}

function googlePayload(
  event,
  {
    includeId = false,
  } = {}
) {
  return {
    ...(includeId
      ? {
          id:
            googleEventId(
              event
            ),
        }
      : {}),
    summary:
      event.summary,
    description:
      "Managed by SalonAI. Change this appointment in SalonAI so availability and booking rules remain authoritative.",
    start: {
      dateTime:
        event.start,
      timeZone:
        event.timeZone,
    },
    end: {
      dateTime:
        event.end,
      timeZone:
        event.timeZone,
    },
    visibility:
      "private",
    extendedProperties: {
      private: {
        salonAiSourceType:
          event.sourceType,
        salonAiSourceId:
          event.sourceId,
      },
    },
  };
}

function graphDateTime(
  instant
) {
  return new Date(
    instant
  )
    .toISOString()
    .replace(
      /Z$/,
      ""
    );
}

function transactionId(
  event
) {
  const digest =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        `salonai:${event.sourceType}:${event.sourceId}`
      )
      .digest("hex")
      .slice(0, 32);

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(
      12,
      16
    ),
    digest.slice(
      16,
      20
    ),
    digest.slice(
      20,
      32
    ),
  ].join("-");
}

function outlookPayload(
  event,
  {
    includeTransactionId =
      false,
  } = {}
) {
  return {
    subject:
      event.summary,
    body: {
      contentType:
        "text",
      content:
        "Managed by SalonAI. Change this appointment in SalonAI so availability and booking rules remain authoritative.",
    },
    start: {
      dateTime:
        graphDateTime(
          event.start
        ),
      timeZone: "UTC",
    },
    end: {
      dateTime:
        graphDateTime(
          event.end
        ),
      timeZone: "UTC",
    },
    sensitivity:
      "private",
    showAs: "busy",
    ...(includeTransactionId
      ? {
          transactionId:
            transactionId(
              event
            ),
        }
      : {}),
  };
}

function encoded(value) {
  return encodeURIComponent(
    requireValue(
      value,
      "Calendar identifier"
    )
  );
}

function eventId(value) {
  return encodeURIComponent(
    requireValue(
      value,
      "Provider event identifier"
    )
  );
}

export async function getProviderEvent({
  provider,
  calendarId,
  providerEventId,
  accessToken,
}) {
  if (
    provider === "google"
  ) {
    try {
      const payload =
        await providerRequest({
          provider,
          accessToken,
          url:
            `https://www.googleapis.com/calendar/v3/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
        });

      return {
        providerEventId:
          text(payload.id),
        providerVersion:
          text(payload.etag),
        providerUpdatedAt:
          payload.updated ||
          null,
        deleted:
          payload.status ===
          "cancelled",
        start:
          payload.start
            ?.dateTime ||
          null,
        end:
          payload.end
            ?.dateTime ||
          null,
      };
    } catch (error) {
      if (
        [404, 410].includes(
          error.providerStatus
        )
      ) {
        return {
          providerEventId:
            text(
              providerEventId
            ),
          providerVersion:
            "",
          providerUpdatedAt:
            null,
          deleted: true,
          start: null,
          end: null,
        };
      }

      throw error;
    }
  }

  if (
    provider === "outlook"
  ) {
    try {
      const payload =
        await providerRequest({
          provider,
          accessToken,
          url:
            `https://graph.microsoft.com/v1.0/me/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
          headers: {
            Prefer:
              'outlook.timezone="UTC"',
          },
        });

      const utcInstant =
        (value) => {
          const safe =
            text(value);

          if (!safe) {
            return null;
          }

          return /(?:Z|[+-]\d{2}:\d{2})$/.test(
            safe
          )
            ? safe
            : safe + "Z";
        };

      return {
        providerEventId:
          text(payload.id),
        providerVersion:
          text(
            payload.changeKey
          ),
        providerUpdatedAt:
          payload.lastModifiedDateTime ||
          null,
        deleted: false,
        start:
          utcInstant(
            payload.start
              ?.dateTime
          ),
        end:
          utcInstant(
            payload.end
              ?.dateTime
          ),
      };
    } catch (error) {
      if (
        error.providerStatus ===
        404
      ) {
        return {
          providerEventId:
            text(
              providerEventId
            ),
          providerVersion:
            "",
          providerUpdatedAt:
            null,
          deleted: true,
          start: null,
          end: null,
        };
      }

      throw error;
    }
  }

  throw new Error(
    `Unsupported calendar provider: ${provider}`
  );
}

export async function createProviderEvent({
  provider,
  calendarId,
  accessToken,
  event,
}) {
  if (
    provider === "google"
  ) {
    const stableEventId =
      googleEventId(
        event
      );

    try {
      const payload =
        await providerRequest({
          provider,
          accessToken,
          method: "POST",
          url:
            `https://www.googleapis.com/calendar/v3/calendars/${encoded(calendarId)}/events`,
          body:
            googlePayload(
              event,
              {
                includeId:
                  true,
              }
            ),
        });

      return {
        providerEventId:
          text(payload.id),
        providerVersion:
          text(payload.etag),
        providerUpdatedAt:
          payload.updated ||
          null,
      };
    } catch (error) {
      if (
        error.providerStatus !==
        409
      ) {
        throw error;
      }

      return updateProviderEvent({
        provider,
        calendarId,
        providerEventId:
          stableEventId,
        accessToken,
        event,
      });
    }
  }

  if (
    provider === "outlook"
  ) {
    const payload =
      await providerRequest({
        provider,
        accessToken,
        method: "POST",
        url:
          `https://graph.microsoft.com/v1.0/me/calendars/${encoded(calendarId)}/events`,
        body:
          outlookPayload(
            event,
            {
              includeTransactionId:
                true,
            }
          ),
      });

    return {
      providerEventId:
        text(payload.id),
      providerVersion:
        text(
          payload.changeKey
        ),
      providerUpdatedAt:
        payload.lastModifiedDateTime ||
        null,
    };
  }

  throw new Error(
    `Unsupported calendar provider: ${provider}`
  );
}

export async function updateProviderEvent({
  provider,
  calendarId,
  providerEventId,
  accessToken,
  event,
}) {
  if (
    provider === "google"
  ) {
    const payload =
      await providerRequest({
        provider,
        accessToken,
        method: "PATCH",
        url:
          `https://www.googleapis.com/calendar/v3/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
        body:
          googlePayload(
            event
          ),
      });

    return {
      providerEventId:
        text(payload.id),
      providerVersion:
        text(payload.etag),
      providerUpdatedAt:
        payload.updated ||
        null,
    };
  }

  if (
    provider === "outlook"
  ) {
    const payload =
      await providerRequest({
        provider,
        accessToken,
        method: "PATCH",
        url:
          `https://graph.microsoft.com/v1.0/me/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
        body:
          outlookPayload(
            event
          ),
      });

    return {
      providerEventId:
        text(payload.id),
      providerVersion:
        text(
          payload.changeKey
        ),
      providerUpdatedAt:
        payload.lastModifiedDateTime ||
        null,
    };
  }

  throw new Error(
    `Unsupported calendar provider: ${provider}`
  );
}

export async function deleteProviderEvent({
  provider,
  calendarId,
  providerEventId,
  accessToken,
}) {
  if (
    provider === "google"
  ) {
    await providerRequest({
      provider,
      accessToken,
      method: "DELETE",
      url:
        `https://www.googleapis.com/calendar/v3/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
    });

    return {
      deleted: true,
    };
  }

  if (
    provider === "outlook"
  ) {
    await providerRequest({
      provider,
      accessToken,
      method: "DELETE",
      url:
        `https://graph.microsoft.com/v1.0/me/calendars/${encoded(calendarId)}/events/${eventId(providerEventId)}`,
    });

    return {
      deleted: true,
    };
  }

  throw new Error(
    `Unsupported calendar provider: ${provider}`
  );
}
