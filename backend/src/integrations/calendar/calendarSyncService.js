import {
  integrationRegistry,
} from "../integrationRegistry.js";
import {
  buildAppointmentCalendarEvent,
} from "./calendarEvent.js";

function calendarIntegrationError(
  message,
  code,
  statusCode = 409
) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function requireCalendarAdapter(
  providerId,
  registry
) {
  const descriptor =
    registry.describe(providerId);

  if (!descriptor) {
    throw calendarIntegrationError(
      `Unknown calendar integration "${providerId}".`,
      "UNKNOWN_CALENDAR_INTEGRATION",
      400
    );
  }

  if (descriptor.category !== "calendar") {
    throw calendarIntegrationError(
      `Integration "${providerId}" is not a calendar provider.`,
      "NOT_A_CALENDAR_INTEGRATION",
      400
    );
  }

  if (!descriptor.registered) {
    throw calendarIntegrationError(
      `Calendar integration "${providerId}" is not configured.`,
      "CALENDAR_INTEGRATION_NOT_CONFIGURED"
    );
  }

  if (
    !descriptor.capabilities.includes(
      "calendar.write"
    )
  ) {
    throw calendarIntegrationError(
      `Calendar integration "${providerId}" does not allow calendar.write.`,
      "CALENDAR_WRITE_NOT_AVAILABLE",
      403
    );
  }

  const adapter =
    registry.getAdapter(providerId);

  if (
    !adapter ||
    typeof adapter.upsertEvent !==
      "function"
  ) {
    throw calendarIntegrationError(
      `Calendar integration "${providerId}" does not implement upsertEvent().`,
      "INVALID_CALENDAR_ADAPTER",
      500
    );
  }

  return adapter;
}

function normaliseProviderResult(
  providerId,
  event,
  result = {}
) {
  return Object.freeze({
    providerId,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    providerEventId:
      String(
        result.providerEventId ??
          result.id ??
          ""
      ).trim(),
    status:
      String(
        result.status ??
          "synced"
      ).trim() ||
      "synced",
    syncedAt:
      new Date().toISOString(),
  });
}

export class CalendarSyncService {
  constructor({
    registry = integrationRegistry,
  } = {}) {
    this.registry = registry;
  }

  async syncAppointment({
    providerId,
    calendarId,
    appointment,
    includeCustomerName = false,
  }) {
    const adapter =
      requireCalendarAdapter(
        providerId,
        this.registry
      );

    const safeCalendarId =
      String(calendarId ?? "").trim();

    if (!safeCalendarId) {
      throw calendarIntegrationError(
        "A calendar identifier is required.",
        "MISSING_CALENDAR_ID",
        400
      );
    }

    const event =
      buildAppointmentCalendarEvent({
        appointment,
        includeCustomerName,
      });

    const result =
      await adapter.upsertEvent({
        calendarId: safeCalendarId,
        event,
        idempotencyKey:
          `appointment:${event.sourceId}`,
      });

    return normaliseProviderResult(
      providerId,
      event,
      result
    );
  }
}

export const calendarSyncService =
  new CalendarSyncService();
