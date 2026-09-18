import ExternalCalendarConnection from "../../models/ExternalCalendarConnection.js";
import {
  encryptCalendarSecret,
} from "./calendarCredentialCrypto.js";
import {
  exchangeCalendarAuthorizationCode,
  providerAvailability,
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

export async function saveOAuthConnection({
  userId,
  provider,
  code,
}) {
  const token =
    await exchangeCalendarAuthorizationCode({
      provider,
      code,
    });

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
      $set: update,
      $setOnInsert: {
        syncEnabled: false,
        calendarId: "primary",
        calendarName:
          "Primary calendar",
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
