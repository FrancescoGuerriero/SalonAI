import ExternalCalendarEventLink from "../../models/ExternalCalendarEventLink.js";
import User from "../../models/user.js";
import {
  hasUserPermission,
} from "../../middleware/permissionMiddleware.js";
import {
  changeAppointmentStatus,
  rescheduleAppointment,
} from "../../features/appointments/appointmentManagementService.js";
import {
  getCalendarProviderContext,
} from "./calendarConnectionService.js";
import {
  getProviderEvent,
} from "./calendarProviderEventApi.js";
import {
  enqueueCalendarSyncTask,
} from "./calendarSyncQueue.js";

function instant(value) {
  const date =
    value
      ? new Date(value)
      : null;

  return (
    date &&
    !Number.isNaN(
      date.getTime()
    )
  )
    ? date
    : null;
}

function sameInstant(
  left,
  right
) {
  const a =
    instant(left);
  const b =
    instant(right);

  return Boolean(
    a &&
    b &&
    Math.abs(
      a.getTime() -
        b.getTime()
    ) < 1000
  );
}

async function rejectExternalChange({
  link,
  appointmentId,
  reason,
}) {
  link.lastError =
    String(reason).slice(
      0,
      2000
    );
  link.failureCount =
    Number(
      link.failureCount ||
        0
    ) + 1;
  await link.save();

  await enqueueCalendarSyncTask(
    appointmentId
  );

  return {
    action:
      "rejected_and_restore_queued",
    reason,
  };
}

async function reconcileLink({
  link,
  connection,
  accessToken,
  actor,
}) {
  const appointment =
    await link.populate(
      "appointment"
    ).then(
      (current) =>
        current.appointment
    );

  if (!appointment) {
    return {
      action:
        "ignored_missing_appointment",
    };
  }

  const external =
    await getProviderEvent({
      provider:
        connection.provider,
      calendarId:
        link.calendarId,
      providerEventId:
        link.providerEventId,
      accessToken,
    });

  if (
    external.deleted
  ) {
    if (
      appointment.status ===
      "cancelled"
    ) {
      link.status =
        "deleted";
      link.lastError = "";
      link.lastSyncedAt =
        new Date();
      await link.save();

      return {
        action:
          "already_cancelled",
      };
    }

    if (
      !hasUserPermission(
        actor,
        "appointment:cancel"
      )
    ) {
      return rejectExternalChange({
        link,
        appointmentId:
          appointment._id,
        reason:
          "The connected employee does not have appointment:cancel permission.",
      });
    }

    try {
      await changeAppointmentStatus(
        appointment._id,
        "cancelled",
        {
          reason:
            `Cancelled from connected ${connection.provider} calendar.`,
          requireReason:
            true,
        },
        {
          actor,
        }
      );

      link.status =
        "deleted";
      link.lastError = "";
      link.lastSyncedAt =
        new Date();
      link.lastProviderUpdatedAt =
        instant(
          external.providerUpdatedAt
        );
      await link.save();

      return {
        action:
          "cancelled_in_salonai",
      };
    } catch (error) {
      return rejectExternalChange({
        link,
        appointmentId:
          appointment._id,
        reason:
          error.message,
      });
    }
  }

  const externalStart =
    instant(
      external.start
    );
  const externalEnd =
    instant(
      external.end
    );

  if (
    !externalStart ||
    !externalEnd ||
    externalEnd <=
      externalStart
  ) {
    return rejectExternalChange({
      link,
      appointmentId:
        appointment._id,
      reason:
        "Connected calendar returned an invalid appointment window.",
    });
  }

  const timeChanged =
    !sameInstant(
      appointment.startsAt,
      externalStart
    ) ||
    !sameInstant(
      appointment.endsAt,
      externalEnd
    );

  if (!timeChanged) {
    link.providerVersion =
      external.providerVersion;
    link.lastProviderUpdatedAt =
      instant(
        external.providerUpdatedAt
      );
    link.lastSyncedAt =
      new Date();
    link.lastError = "";
    link.failureCount = 0;
    await link.save();

    return {
      action: "unchanged",
    };
  }

  if (
    !hasUserPermission(
      actor,
      "appointment:update"
    )
  ) {
    return rejectExternalChange({
      link,
      appointmentId:
        appointment._id,
      reason:
        "The connected employee does not have appointment:update permission.",
    });
  }

  try {
    await rescheduleAppointment(
      appointment._id,
      {
        startsAt:
          externalStart,
        endsAt:
          externalEnd,
        reason:
          `Changed from connected ${connection.provider} calendar.`,
      },
      {
        actor,
      }
    );

    link.providerVersion =
      external.providerVersion;
    link.lastProviderUpdatedAt =
      instant(
        external.providerUpdatedAt
      );
    link.lastSyncedAt =
      new Date();
    link.lastError = "";
    link.failureCount = 0;
    await link.save();

    return {
      action:
        "rescheduled_in_salonai",
      startsAt:
        externalStart.toISOString(),
      endsAt:
        externalEnd.toISOString(),
    };
  } catch (error) {
    return rejectExternalChange({
      link,
      appointmentId:
        appointment._id,
      reason:
        error.message,
    });
  }
}

export async function reconcileCalendarConnection(
  connectionId
) {
  const {
    connection,
    accessToken,
  } =
    await getCalendarProviderContext({
      connectionId,
    });

  const actor =
    await User.findById(
      connection.user
    ).lean();

  if (!actor) {
    const error =
      new Error(
        "The staff account for this calendar connection no longer exists."
      );
    error.statusCode = 409;
    error.code =
      "CALENDAR_STAFF_ACCOUNT_MISSING";
    throw error;
  }

  const links =
    await ExternalCalendarEventLink.find({
      connection:
        connection._id,
      status: {
        $in: [
          "synced",
          "error",
        ],
      },
    }).sort({
      updatedAt: 1,
    });

  const results = [];

  for (const link of links) {
    try {
      results.push({
        success: true,
        providerEventId:
          link.providerEventId,
        ...(await reconcileLink({
          link,
          connection,
          accessToken,
          actor,
        })),
      });
    } catch (error) {
      link.lastError =
        String(
          error?.message ||
            "Inbound calendar reconciliation failed."
        ).slice(0, 2000);
      link.failureCount =
        Number(
          link.failureCount ||
            0
        ) + 1;
      await link
        .save()
        .catch(
          () => undefined
        );

      results.push({
        success: false,
        providerEventId:
          link.providerEventId,
        error:
          error.message,
      });
    }
  }

  connection.lastSyncedAt =
    new Date();
  connection.lastSyncError =
    results.some(
      (result) =>
        !result.success
    )
      ? "One or more inbound calendar events could not be reconciled."
      : "";
  await connection.save();

  return {
    connectionId:
      String(
        connection._id
      ),
    provider:
      connection.provider,
    checked:
      links.length,
    changed:
      results.filter(
        (result) =>
          [
            "cancelled_in_salonai",
            "rescheduled_in_salonai",
          ].includes(
            result.action
          )
      ).length,
    rejected:
      results.filter(
        (result) =>
          result.action ===
          "rejected_and_restore_queued"
      ).length,
    failed:
      results.filter(
        (result) =>
          !result.success
      ).length,
    results,
  };
}

export async function reconcileAllEnabledCalendars({
  limit = 50,
} = {}) {
  const connections =
    await (
      await import(
        "../../models/ExternalCalendarConnection.js"
      )
    ).default
      .find({
        status:
          "connected",
        syncEnabled: true,
      })
      .select("_id")
      .sort({
        lastSyncedAt: 1,
        updatedAt: 1,
      })
      .limit(
        Math.max(
          1,
          Math.min(
            200,
            Number(limit) ||
              50
          )
        )
      )
      .lean();

  const results = [];

  for (
    const connection of
    connections
  ) {
    try {
      results.push({
        success: true,
        ...(await reconcileCalendarConnection(
          connection._id
        )),
      });
    } catch (error) {
      results.push({
        success: false,
        connectionId:
          String(
            connection._id
          ),
        error:
          error.message,
      });
    }
  }

  return {
    checked:
      connections.length,
    failed:
      results.filter(
        (result) =>
          !result.success
      ).length,
    results,
  };
}

export default {
  reconcileAllEnabledCalendars,
  reconcileCalendarConnection,
};
