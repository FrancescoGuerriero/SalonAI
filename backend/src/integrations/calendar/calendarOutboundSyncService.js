import crypto from "node:crypto";

import Appointment from "../../models/Appointment.js";
import ExternalCalendarConnection from "../../models/ExternalCalendarConnection.js";
import ExternalCalendarEventLink from "../../models/ExternalCalendarEventLink.js";
import {
  buildAppointmentCalendarEvent,
} from "./calendarEvent.js";
import {
  getCalendarProviderContext,
} from "./calendarConnectionService.js";
import {
  createProviderEvent,
  deleteProviderEvent,
  updateProviderEvent,
} from "./calendarProviderEventApi.js";

function hashEvent(event) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        sourceType:
          event.sourceType,
        sourceId:
          event.sourceId,
        summary:
          event.summary,
        start:
          event.start,
        end:
          event.end,
        timeZone:
          event.timeZone,
        visibility:
          event.visibility,
        status:
          event.status,
        metadata:
          event.metadata,
      })
    )
    .digest("hex");
}

function dateOrNull(
  value
) {
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

async function markConnectionSuccess(
  connection
) {
  connection.lastSyncedAt =
    new Date();
  connection.lastSyncError =
    "";
  await connection.save();
}

async function markConnectionFailure(
  connection,
  error
) {
  connection.lastSyncError =
    String(
      error?.message ||
        "External calendar synchronization failed."
    ).slice(0, 2000);
  await connection.save();
}

async function deleteLinkedEvent({
  connection,
  accessToken,
  link,
}) {
  if (
    !link ||
    link.status ===
      "deleted"
  ) {
    return {
      action: "noop",
      reason:
        "no_active_external_event",
    };
  }

  try {
    await deleteProviderEvent({
      provider:
        connection.provider,
      calendarId:
        link.calendarId,
      providerEventId:
        link.providerEventId,
      accessToken,
    });
  } catch (error) {
    if (
      error.providerStatus !==
      404
    ) {
      throw error;
    }
  }

  link.status =
    "deleted";
  link.lastSyncedAt =
    new Date();
  link.lastError = "";
  link.failureCount = 0;
  await link.save();

  return {
    action: "deleted",
    providerEventId:
      link.providerEventId,
  };
}

async function syncConnection({
  appointment,
  connectionId,
}) {
  const {
    connection,
    accessToken,
  } =
    await getCalendarProviderContext({
      connectionId,
    });

  const event =
    buildAppointmentCalendarEvent({
      appointment,
      includeCustomerName:
        false,
    });

  const payloadHash =
    hashEvent(event);

  let link =
    await ExternalCalendarEventLink.findOne({
      connection:
        connection._id,
      appointment:
        appointment._id,
    });

  try {
    if (
      event.status ===
      "cancelled"
    ) {
      const result =
        await deleteLinkedEvent({
          connection,
          accessToken,
          link,
        });

      await markConnectionSuccess(
        connection
      );

      return {
        provider:
          connection.provider,
        ...result,
      };
    }

    if (
      link &&
      link.status ===
        "synced" &&
      link.calendarId ===
        connection.calendarId &&
      link.payloadHash ===
        payloadHash
    ) {
      await markConnectionSuccess(
        connection
      );

      return {
        provider:
          connection.provider,
        action: "unchanged",
        providerEventId:
          link.providerEventId,
      };
    }

    if (
      link &&
      link.status ===
        "synced" &&
      link.calendarId !==
        connection.calendarId
    ) {
      await deleteLinkedEvent({
        connection,
        accessToken,
        link,
      });

      link = null;
    }

    const appointmentEnd =
      dateOrNull(
        appointment.endsAt
      );

    if (
      !link &&
      appointmentEnd &&
      appointmentEnd <
        new Date()
    ) {
      await markConnectionSuccess(
        connection
      );

      return {
        provider:
          connection.provider,
        action: "noop",
        reason:
          "historical_appointment_without_external_mapping",
      };
    }

    let providerResult;
    let action;

    if (
      link &&
      link.status !==
        "deleted"
    ) {
      try {
        providerResult =
          await updateProviderEvent({
            provider:
              connection.provider,
            calendarId:
              connection.calendarId,
            providerEventId:
              link.providerEventId,
            accessToken,
            event,
          });
        action = "updated";
      } catch (error) {
        if (
          error.providerStatus !==
          404
        ) {
          throw error;
        }

        providerResult =
          await createProviderEvent({
            provider:
              connection.provider,
            calendarId:
              connection.calendarId,
            accessToken,
            event,
          });
        action =
          "recreated";
      }
    } else {
      providerResult =
        await createProviderEvent({
          provider:
            connection.provider,
          calendarId:
            connection.calendarId,
          accessToken,
          event,
        });
      action = "created";
    }

    link =
      await ExternalCalendarEventLink.findOneAndUpdate(
        {
          connection:
            connection._id,
          appointment:
            appointment._id,
        },
        {
          $set: {
            provider:
              connection.provider,
            calendarId:
              connection.calendarId,
            providerEventId:
              providerResult
                .providerEventId,
            providerVersion:
              providerResult
                .providerVersion,
            payloadHash,
            status: "synced",
            lastSyncedAt:
              new Date(),
            lastProviderUpdatedAt:
              dateOrNull(
                providerResult
                  .providerUpdatedAt
              ),
            lastError: "",
            failureCount: 0,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert:
            true,
        }
      );

    await markConnectionSuccess(
      connection
    );

    return {
      provider:
        connection.provider,
      action,
      providerEventId:
        link.providerEventId,
    };
  } catch (error) {
    if (link) {
      link.status = "error";
      link.lastError =
        String(
          error?.message ||
            "Calendar synchronization failed."
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
    }

    await markConnectionFailure(
      connection,
      error
    ).catch(
      () => undefined
    );

    throw error;
  }
}

export async function syncAppointmentToEnabledCalendars(
  appointmentId
) {
  const appointment =
    await Appointment.findById(
      appointmentId
    )
      .populate(
        "service",
        "name"
      )
      .populate({
        path: "stylist",
        select:
          "firstName lastName name userAccount",
      });

  if (!appointment) {
    const error =
      new Error(
        "Appointment was not found for calendar synchronization."
      );
    error.statusCode = 404;
    error.code =
      "CALENDAR_SYNC_APPOINTMENT_NOT_FOUND";
    throw error;
  }

  const userAccount =
    appointment.stylist
      ?.userAccount;

  if (!userAccount) {
    return {
      appointmentId:
        String(
          appointment._id
        ),
      attempted: 0,
      synced: 0,
      failed: 0,
      results: [],
      reason:
        "stylist_has_no_linked_staff_account",
    };
  }

  const connections =
    await ExternalCalendarConnection.find({
      user: userAccount,
      status: "connected",
      syncEnabled: true,
    }).select("_id provider");

  const results = [];

  for (
    const connection of
    connections
  ) {
    try {
      results.push({
        success: true,
        ...(await syncConnection({
          appointment,
          connectionId:
            connection._id,
        })),
      });
    } catch (error) {
      results.push({
        success: false,
        provider:
          connection.provider,
        error:
          String(
            error?.message ||
              "Calendar synchronization failed."
          ),
        code:
          error?.code ||
          "CALENDAR_SYNC_FAILED",
      });
    }
  }

  return {
    appointmentId:
      String(
        appointment._id
      ),
    attempted:
      connections.length,
    synced:
      results.filter(
        (item) =>
          item.success
      ).length,
    failed:
      results.filter(
        (item) =>
          !item.success
      ).length,
    results,
  };
}

export {
  hashEvent,
};

export default {
  syncAppointmentToEnabledCalendars,
};
