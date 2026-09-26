const PROVIDERS = Object.freeze([
  "google",
  "outlook",
]);

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function enabled(value) {
  return [
    "1",
    "true",
    "yes",
    "on",
    "enabled",
  ].includes(
    text(value)
      .toLowerCase()
  );
}

function validEncryptionKey(value) {
  const raw =
    text(value);

  if (!raw) {
    return false;
  }

  try {
    const key =
      /^[a-f0-9]{64}$/i.test(raw)
        ? Buffer.from(
            raw,
            "hex"
          )
        : Buffer.from(
            raw,
            "base64"
          );

    return key.length === 32;
  } catch {
    return false;
  }
}

function validHttpsUrl(value) {
  try {
    return (
      new URL(
        text(value)
      ).protocol ===
      "https:"
    );
  } catch {
    return false;
  }
}

function webhookReadiness(
  env
) {
  const webhooksEnabled =
    enabled(
      env
        .CALENDAR_WEBHOOKS_ENABLED
    );

  const baseUrlConfigured =
    validHttpsUrl(
      env
        .CALENDAR_WEBHOOK_BASE_URL
    );
  const secretConfigured =
    text(
      env
        .CALENDAR_WEBHOOK_SECRET
    ).length >= 32;

  return {
    enabled:
      webhooksEnabled,
    configurationValid:
      !webhooksEnabled ||
      (
        baseUrlConfigured &&
        secretConfigured
      ),
    httpsBaseUrlConfigured:
      baseUrlConfigured,
    secretConfigured,
  };
}

function providerSummary({
  provider,
  configured,
  connections,
  now,
}) {
  const matching =
    connections.filter(
      (connection) =>
        connection.provider ===
        provider
    );

  const connected =
    matching.filter(
      (connection) =>
        connection.status ===
        "connected"
    );

  const syncEnabled =
    connected.filter(
      (connection) =>
        connection.syncEnabled ===
          true &&
        text(
          connection.calendarId
        )
    );

  const webhookActive =
    syncEnabled.filter(
      (connection) => {
        const expiresAt =
          connection
            .subscriptionExpiresAt
            ? new Date(
                connection
                  .subscriptionExpiresAt
              )
            : null;

        return (
          expiresAt &&
          !Number.isNaN(
            expiresAt.getTime()
          ) &&
          expiresAt.getTime() >
            now.getTime()
        );
      }
    );

  return {
    provider,
    configured:
      configured === true,
    connectionCount:
      matching.length,
    connectedCount:
      connected.length,
    syncEnabledCount:
      syncEnabled.length,
    acceptanceCandidateCount:
      configured === true
        ? syncEnabled.length
        : 0,
    webhookActiveCount:
      webhookActive.length,
    reauthorizationRequiredCount:
      matching.filter(
        (connection) =>
          connection.status ===
          "reauthorization_required"
      ).length,
    errorCount:
      matching.filter(
        (connection) =>
          connection.status ===
          "error"
      ).length,
    syncErrorCount:
      matching.filter(
        (connection) =>
          Boolean(
            text(
              connection
                .lastSyncError
            )
          )
      ).length,
  };
}

export function buildCalendarReadinessReport({
  providerAvailability = [],
  connections = [],
  env = process.env,
  databaseReadable = true,
  now = new Date(),
} = {}) {
  const availability =
    new Map(
      providerAvailability.map(
        (entry) => [
          entry.provider,
          entry.configured ===
            true,
        ]
      )
    );

  const providers =
    PROVIDERS.map(
      (provider) =>
        providerSummary({
          provider,
          configured:
            availability.get(
              provider
            ) === true,
          connections,
          now,
        })
    );

  const tokenEncryptionConfigured =
    validEncryptionKey(
      env
        .CALENDAR_TOKEN_ENCRYPTION_KEY
    );

  const webhooks =
    webhookReadiness(
      env
    );

  const configuredProviderCount =
    providers.filter(
      (provider) =>
        provider.configured
    ).length;

  const acceptanceCandidateCount =
    providers.reduce(
      (
        total,
        provider
      ) =>
        total +
        provider
          .acceptanceCandidateCount,
      0
    );

  const blockers = [];

  if (
    databaseReadable !==
    true
  ) {
    blockers.push(
      "databaseConnection"
    );
  }

  if (
    !tokenEncryptionConfigured
  ) {
    blockers.push(
      "tokenEncryptionKey"
    );
  }

  if (
    configuredProviderCount ===
    0
  ) {
    blockers.push(
      "providerConfiguration"
    );
  }

  if (
    acceptanceCandidateCount ===
    0
  ) {
    blockers.push(
      "connectedSyncEnabledCalendar"
    );
  }

  if (
    !webhooks
      .configurationValid
  ) {
    blockers.push(
      "webhookConfiguration"
    );
  }

  return {
    readyForAcceptance:
      blockers.length === 0,
    databaseReadable:
      databaseReadable ===
      true,
    tokenEncryptionConfigured,
    webhooks,
    configuredProviderCount,
    acceptanceCandidateCount,
    providers,
    blockers,
  };
}

export default {
  buildCalendarReadinessReport,
};
