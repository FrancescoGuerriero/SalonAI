import {
  createCalendarAuthorization,
  calendarFrontendRedirect,
  readCalendarOAuthState,
} from "./calendarOAuthProvider.js";
import {
  disconnectCalendar,
  listAvailableCalendars,
  listCalendarConnections,
  saveOAuthConnection,
  selectCalendar,
  setCalendarSyncEnabled,
} from "./calendarConnectionService.js";

function provider(value) {
  const normalised =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    !["google", "outlook"].includes(
      normalised
    )
  ) {
    const error = new Error(
      "Calendar provider must be google or outlook."
    );
    error.statusCode = 400;
    throw error;
  }

  return normalised;
}

export async function listConnections(
  request,
  response
) {
  const connections =
    await listCalendarConnections(
      request.user._id
    );

  return response.json({
    success: true,
    connections,
  });
}

export async function startConnection(
  request,
  response
) {
  const result =
    createCalendarAuthorization({
      provider:
        provider(
          request.params.provider
        ),
      userId:
        request.user._id,
    });

  return response.json({
    success: true,
    ...result,
  });
}

export async function calendars(
  request,
  response
) {
  const items =
    await listAvailableCalendars({
      userId:
        request.user._id,
      provider:
        provider(
          request.params.provider
        ),
    });

  return response.json({
    success: true,
    calendars: items,
  });
}

export async function updateCalendar(
  request,
  response
) {
  const result =
    await selectCalendar({
      userId:
        request.user._id,
      provider:
        provider(
          request.params.provider
        ),
      calendarId:
        request.body?.calendarId,
    });

  return response.json({
    success: true,
    message:
      "Calendar selection updated. Synchronization is paused until you turn it on again.",
    connection: result,
  });
}

export async function updateSync(
  request,
  response
) {
  const enabled =
    request.body?.enabled === true;

  const connection =
    await setCalendarSyncEnabled({
      userId:
        request.user._id,
      provider:
        provider(
          request.params.provider
        ),
      enabled,
    });

  return response.json({
    success: true,
    message: enabled
      ? "External calendar synchronization enabled."
      : "External calendar synchronization paused.",
    connection: {
      provider:
        connection.provider,
      connected: true,
      syncEnabled:
        connection.syncEnabled,
      status:
        connection.status,
    },
  });
}

export async function removeConnection(
  request,
  response
) {
  const result =
    await disconnectCalendar({
      userId:
        request.user._id,
      provider:
        provider(
          request.params.provider
        ),
    });

  return response.json({
    success: true,
    message:
      "External calendar account disconnected.",
    connection: result,
  });
}

export async function oauthCallback(
  request,
  response,
  next
) {
  const selectedProvider =
    provider(
      request.params.provider
    );

  try {
    if (
      request.query.error
    ) {
      return response.redirect(
        calendarFrontendRedirect({
          provider:
            selectedProvider,
          status: "cancelled",
        })
      );
    }

    const state =
      readCalendarOAuthState(
        request.query.state
      );

    if (
      state.provider !==
      selectedProvider
    ) {
      throw new Error(
        "Calendar OAuth provider mismatch."
      );
    }

    await saveOAuthConnection({
      userId: state.sub,
      provider:
        selectedProvider,
      code:
        request.query.code,
    });

    return response.redirect(
      calendarFrontendRedirect({
        provider:
          selectedProvider,
        status: "connected",
      })
    );
  } catch (error) {
    if (
      error.statusCode &&
      error.statusCode < 500
    ) {
      return response.redirect(
        calendarFrontendRedirect({
          provider:
            selectedProvider,
          status: "error",
        })
      );
    }

    return next(error);
  }
}
