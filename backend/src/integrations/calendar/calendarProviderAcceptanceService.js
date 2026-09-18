import {
  randomUUID,
} from "node:crypto";

import {
  createProviderEvent,
  deleteProviderEvent,
  getProviderEvent,
  updateProviderEvent,
} from "./calendarProviderEventApi.js";

const DEFAULT_DURATION_MS =
  30 * 60 * 1000;
const MOVE_OFFSET_MS =
  30 * 60 * 1000;

function text(value) {
  return String(
    value ?? ""
  ).trim();
}

function instant(value) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Calendar acceptance received an invalid event instant."
    );
  }

  return date;
}

function sameInstant(
  left,
  right
) {
  return (
    Math.abs(
      instant(left).getTime() -
      instant(right).getTime()
    ) < 1000
  );
}

function nextAcceptanceStart(
  baseTime = new Date()
) {
  const base =
    instant(baseTime);
  const rounded =
    Math.ceil(
      base.getTime() /
        (15 * 60 * 1000)
    ) *
    (15 * 60 * 1000);

  return new Date(
    rounded +
      24 *
        60 *
        60 *
        1000
  );
}

function assertWindow(
  event,
  expectedStart,
  expectedEnd,
  label
) {
  if (event.deleted) {
    throw new Error(
      `${label} unexpectedly reports the acceptance event as deleted.`
    );
  }

  if (
    !sameInstant(
      event.start,
      expectedStart
    ) ||
    !sameInstant(
      event.end,
      expectedEnd
    )
  ) {
    throw new Error(
      `${label} did not return the expected acceptance event window.`
    );
  }
}

export function buildCalendarAcceptanceEvent({
  baseTime = new Date(),
  timeZone =
    process.env.SALON_TIME_ZONE ||
    "Europe/London",
  sourceId =
    randomUUID(),
} = {}) {
  const start =
    nextAcceptanceStart(
      baseTime
    );
  const end =
    new Date(
      start.getTime() +
        DEFAULT_DURATION_MS
    );

  return {
    sourceType:
      "calendar_acceptance",
    sourceId,
    summary:
      `[SalonAI acceptance] ${sourceId.slice(
        0,
        8
      )}`,
    start:
      start.toISOString(),
    end:
      end.toISOString(),
    timeZone:
      text(timeZone) ||
      "Europe/London",
  };
}

export async function runCalendarProviderAcceptance({
  provider,
  calendarId,
  accessToken,
  timeZone =
    process.env.SALON_TIME_ZONE ||
    "Europe/London",
  baseTime = new Date(),
  providerApi = {
    createProviderEvent,
    deleteProviderEvent,
    getProviderEvent,
    updateProviderEvent,
  },
} = {}) {
  const selectedProvider =
    text(provider)
      .toLowerCase();
  const selectedCalendar =
    text(calendarId);
  const token =
    text(accessToken);

  if (
    ![
      "google",
      "outlook",
    ].includes(
      selectedProvider
    )
  ) {
    throw new Error(
      "Calendar acceptance provider must be google or outlook."
    );
  }

  if (!selectedCalendar) {
    throw new Error(
      "Calendar acceptance requires the selected calendar identifier."
    );
  }

  if (!token) {
    throw new Error(
      "Calendar acceptance requires a valid provider access token."
    );
  }

  const event =
    buildCalendarAcceptanceEvent({
      baseTime,
      timeZone,
    });
  const movedEvent = {
    ...event,
    start:
      new Date(
        new Date(
          event.start
        ).getTime() +
          MOVE_OFFSET_MS
      ).toISOString(),
    end:
      new Date(
        new Date(
          event.end
        ).getTime() +
          MOVE_OFFSET_MS
      ).toISOString(),
  };

  let providerEventId =
    "";
  let deletionConfirmed =
    false;
  let cleanupAttempted =
    false;
  const steps = [];

  const request = {
    provider:
      selectedProvider,
    calendarId:
      selectedCalendar,
    accessToken:
      token,
  };

  try {
    const created =
      await providerApi
        .createProviderEvent({
          ...request,
          event,
        });

    providerEventId =
      text(
        created
          ?.providerEventId
      );

    if (!providerEventId) {
      throw new Error(
        "Provider did not return an event identifier during calendar acceptance."
      );
    }

    steps.push(
      "create"
    );

    const firstRead =
      await providerApi
        .getProviderEvent({
          ...request,
          providerEventId,
        });

    assertWindow(
      firstRead,
      event.start,
      event.end,
      "Provider read after create"
    );
    steps.push(
      "read_after_create"
    );

    await providerApi
      .updateProviderEvent({
        ...request,
        providerEventId,
        event:
          movedEvent,
      });
    steps.push(
      "update"
    );

    const secondRead =
      await providerApi
        .getProviderEvent({
          ...request,
          providerEventId,
        });

    assertWindow(
      secondRead,
      movedEvent.start,
      movedEvent.end,
      "Provider read after update"
    );
    steps.push(
      "read_after_update"
    );

    await providerApi
      .deleteProviderEvent({
        ...request,
        providerEventId,
      });
    steps.push(
      "delete"
    );

    const deletedRead =
      await providerApi
        .getProviderEvent({
          ...request,
          providerEventId,
        });

    if (
      deletedRead.deleted !==
      true
    ) {
      throw new Error(
        "Provider did not confirm deletion of the acceptance event."
      );
    }

    deletionConfirmed =
      true;
    steps.push(
      "verify_deleted"
    );

    return {
      success: true,
      provider:
        selectedProvider,
      calendarId:
        selectedCalendar,
      providerEventId,
      sourceId:
        event.sourceId,
      initialWindow: {
        start:
          event.start,
        end:
          event.end,
      },
      movedWindow: {
        start:
          movedEvent.start,
        end:
          movedEvent.end,
      },
      steps,
    };
  } finally {
    if (
      providerEventId &&
      !deletionConfirmed
    ) {
      cleanupAttempted =
        true;

      await providerApi
        .deleteProviderEvent({
          ...request,
          providerEventId,
        })
        .catch(
          () => undefined
        );
    }

    if (
      cleanupAttempted
    ) {
      steps.push(
        "cleanup_attempted"
      );
    }
  }
}

export default {
  buildCalendarAcceptanceEvent,
  runCalendarProviderAcceptance,
};
