import ExternalCalendarConnection from "../../models/ExternalCalendarConnection.js";
import User from "../../models/user.js";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
} from "./calendarCredentialCrypto.js";
import {
  exchangeCalendarAuthorizationCode,
  listProviderCalendars,
  providerAvailability,
  refreshCalendarAccessToken,
} from "./calendarOAuthProvider.js";

function descriptor(connection, availability) {
  return {
    provider: availability.provider,
    configured: availability.configured,
    connected: Boolean(connection),
    syncEnabled:
      connection?.syncEnabled === true,
    status:
      connection?.status || "not_connected",
    accountEmail:
      connection?.accountEmail || "",
    accountName:
      connection?.accountName || "",
    calendarId:
      connection?.calendarId || "",
    calendarName:
      connection?.calendarName || "",
    lastSyncedAt:
      connection?.lastSyncedAt || null,
    lastSyncError:
      connection?.lastSyncError || "",
  };
}

export async function listCalendarConnections(
  userId
) {
  const connections =
    await ExternalCalendarConnection.find({
      user: userId,
    }).lean();

  return providerAvailability().map(
    (availability) =>
      descriptor(
        connections.find(
          (item) =>
            item.provider ===
            availability.provider
        ) || null,
        availability
      )
  );
}

async function connectionWithCredentials({
  userId,
  provider,
}) {
  const connection =
    await ExternalCalendarConnection.findOne({
      user: userId,
      provider,
    }).select(
      "+encryptedAccessToken +encryptedRefreshToken"
    );

  if (!connection) {
    const error = new Error(
      "Connect the calendar account first."
    );
    error.statusCode = 409;
    error.code =
      "CALENDAR_CONNECTION_REQUIRED";
    throw error;
  }

  return connection;
}

async function validAccessToken(
  connection
) {
  const accessToken =
    decryptCalendarSecret(
      connection.encryptedAccessToken
    );
  const expiresAt =
    connection.tokenExpiresAt
      ? new Date(
          connection.tokenExpiresAt
        )
      : null;

  if (
    accessToken &&
    expiresAt &&
    expiresAt.getTime() >
      Date.now() + 60_000
  ) {
    return accessToken;
  }

  const refreshToken =
    decryptCalendarSecret(
      connection.encryptedRefreshToken
    );

  if (!refreshToken) {
    connection.status =
      "reauthorization_required";
    connection.syncEnabled =
      false;
    await connection.save();

    const error = new Error(
      "Reconnect this calendar account to continue."
    );
    error.statusCode = 409;
    error.code =
      "CALENDAR_REAUTHORIZATION_REQUIRED";
    throw error;
  }

  try {
    const refreshed =
      await refreshCalendarAccessToken({
        provider:
          connection.provider,
        refreshToken,
      });

    connection.encryptedAccessToken =
      encryptCalendarSecret(
        refreshed.accessToken
      );

    if (
      refreshed.refreshToken
    ) {
      connection.encryptedRefreshToken =
        encryptCalendarSecret(
          refreshed.refreshToken
        );
    }

    connection.tokenExpiresAt =
      new Date(
        Date.now() +
          refreshed.expiresIn *
            1000
      );

    if (
      refreshed.scopes.length
    ) {
      connection.scopes =
        refreshed.scopes;
    }

    connection.status =
      "connected";
    connection.lastSyncError =
      "";
    await connection.save();

    return refreshed.accessToken;
  } catch (error) {
    connection.status =
      "reauthorization_required";
    connection.syncEnabled =
      false;
    connection.lastSyncError =
      "Calendar authorization must be refreshed.";
    await connection.save();
    throw error;
  }
}

export async function listAvailableCalendars({
  userId,
  provider,
}) {
  const connection =
    await connectionWithCredentials({
      userId,
      provider,
    });
  const accessToken =
    await validAccessToken(
      connection
    );

  return listProviderCalendars({
    provider,
    accessToken,
  });
}

export async function selectCalendar({
  userId,
  provider,
  calendarId,
}) {
  const connection =
    await connectionWithCredentials({
      userId,
      provider,
    });
  const accessToken =
    await validAccessToken(
      connection
    );
  const calendars =
    await listProviderCalendars({
      provider,
      accessToken,
    });
  const selected =
    calendars.find(
      (calendar) =>
        calendar.id ===
        String(
          calendarId || ""
        )
    );

  if (!selected) {
    const error = new Error(
      "Choose a writable calendar from the connected account."
    );
    error.statusCode = 400;
    error.code =
      "INVALID_CALENDAR_SELECTION";
    throw error;
  }

  connection.calendarId =
    selected.id;
  connection.calendarName =
    selected.name;
  connection.syncEnabled =
    false;
  connection.syncCursor = "";
  connection.subscriptionId =
    "";
  connection.subscriptionExpiresAt =
    null;
  connection.lastSyncedAt =
    null;
  connection.lastSyncError =
    "";
  await connection.save();

  return {
    calendarId:
      connection.calendarId,
    calendarName:
      connection.calendarName,
    syncEnabled:
      connection.syncEnabled,
  };
}

export async function saveOAuthConnection({
  userId,
  provider,
  code,
}) {
  const user =
    await User.findById(
      userId
    ).select(
      "role isActive"
    );

  if (
    !user ||
    user.isActive === false ||
    ![
      "super_admin",
      "admin",
      "manager",
      "receptionist",
      "stylist",
    ].includes(user.role)
  ) {
    const error = new Error(
      "The staff account for this calendar connection is no longer eligible."
    );
    error.statusCode = 403;
    error.code =
      "CALENDAR_CONNECTION_ACCOUNT_INELIGIBLE";
    throw error;
  }

  const token =
    await exchangeCalendarAuthorizationCode({
      provider,
      code,
    });

  const calendars =
    await listProviderCalendars({
      provider,
      accessToken:
        token.accessToken,
    });
  const defaultCalendar =
    calendars.find(
      (calendar) =>
        calendar.primary
    ) ||
    calendars[0] ||
    null;

  if (!defaultCalendar) {
    const error = new Error(
      "No writable calendar is available in the connected account."
    );
    error.statusCode = 409;
    error.code =
      "WRITABLE_CALENDAR_REQUIRED";
    throw error;
  }

  const previous =
    await ExternalCalendarConnection.findOne({
      user: userId,
      provider,
    }).select(
      "+encryptedRefreshToken"
    );

  const update = {
    providerAccountId:
      token.account.id,
    accountEmail:
      token.account.email,
    accountName:
      token.account.name,
    encryptedAccessToken:
      encryptCalendarSecret(
        token.accessToken
      ),
    tokenExpiresAt:
      new Date(
        Date.now() +
          token.expiresIn * 1000
      ),
    scopes: token.scopes,
    status: "connected",
    lastSyncError: "",
  };

  if (token.refreshToken) {
    update.encryptedRefreshToken =
      encryptCalendarSecret(
        token.refreshToken
      );
  } else if (
    !previous?.encryptedRefreshToken
  ) {
    const error = new Error(
      "The calendar provider did not return an offline refresh token. Reconnect and approve offline access."
    );
    error.statusCode = 409;
    error.code =
      "CALENDAR_REFRESH_TOKEN_REQUIRED";
    throw error;
  }

  return ExternalCalendarConnection.findOneAndUpdate(
    {
      user: userId,
      provider,
    },
    {
      $set: {
        ...update,
        calendarId:
          defaultCalendar.id,
        calendarName:
          defaultCalendar.name,
        syncEnabled: false,
        syncCursor: "",
        subscriptionId: "",
        subscriptionExpiresAt:
          null,
        lastSyncedAt: null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

export async function setCalendarSyncEnabled({
  userId,
  provider,
  enabled,
}) {
  const connection =
    await ExternalCalendarConnection.findOne({
      user: userId,
      provider,
    });

  if (!connection) {
    const error = new Error(
      "Connect the calendar account before enabling synchronization."
    );
    error.statusCode = 409;
    error.code =
      "CALENDAR_CONNECTION_REQUIRED";
    throw error;
  }

  connection.syncEnabled =
    enabled === true;

  if (!connection.syncEnabled) {
    connection.lastSyncError = "";
  }

  await connection.save();

  return connection;
}

export async function disconnectCalendar({
  userId,
  provider,
}) {
  await ExternalCalendarConnection.deleteOne({
    user: userId,
    provider,
  });

  return {
    provider,
    connected: false,
    syncEnabled: false,
  };
}
